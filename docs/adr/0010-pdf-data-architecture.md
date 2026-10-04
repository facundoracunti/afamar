# ADR 0010 — PDF data architecture (orchestrator thin + re-pricing helpers + atomic blocks)

**Estado:** Aceptado · **Fecha:** 2026-10-01

## Contexto

Los archivos frontend `buildPdfData.ts` (349 LOC) + `buildSectionData.ts` (321 LOC) + `buildSectionData.rows.ts` + `buildSectionData.measurement.ts` manejaban la generación de datos del PDF del cliente (orden de trabajo y presupuesto) y la comparativa de medición. El builder `DocumentPdf.tsx` (frontend, `@react-pdf/renderer`) renderizaba esos datos con tres modos de salida (pieces, single-section, legacy fallback) según si `form.pieces` estaba populado o no.

Tres problemas estructurales se fueron acumulando:

1. **Layout inconsistente Presupuesto vs Orden de Trabajo.** La Orden de Trabajo usaba el modo "single-section" (agrupaba todo bajo "PRINCIPAL"); el Presupuesto multi-pieza usaba el modo "pieces" (uno o más `PieceBlock` por pieza con título "PIEZA: COCINA"). El `DocumentPdf` ya tenía el branch pieces pero `buildPdfData` solo lo activaba para presupuestos (`attachBudgetPiecesData`), nunca para OTs.
2. **Página 2 huérfana.** En trabajos largos el saldo terminaba solo al fondo de la página 2 mientras la página 1 quedaba casi vacía. La causa: el bloque `TermsBlock` + `ExtrasBlock` + `footer` se renderizaban en una `Page` con `wrap` (default `true`), lo que permitía que react-pdf partiera los bloques entre páginas sin garantía de atomicidad.
3. **Re-pricing manual faltante.** `mutateUpdatePieceBuildingGroup` / `mutateUpdatePieceAlternativeGroup` re-precían los frentes del catálogo (`additional_works_data`) vía `refreshPieceFrentes`, pero los manuales de `fabrication_details` (zócalos manuales) capturaban `material_price_m2` al crearse y nunca se actualizaban — el operador veía el nuevo precio del principal y un subtotal stale en cada zócalo.

## Decisión

**Estructura de `buildPdfData` (frontend)** mantiene el patrón orchestrator-thin:

- **`buildPdfData.ts`** — solo ensambla el payload final (`PdfDocumentData`) y delega a sub-módulos.
- **`buildSectionData.ts`** + sub-módulos (`rows.ts`/`revalue.ts`/`measurement.ts`/`types.ts`) — row transformation, revaluation, comparativa de medición, types compartidos.
- **`buildPdfData.alternatives.ts`** — `attachPiecesBlocks(base, form, usdRate)` siempre (budgets + work orders) + `attachBudgetPiecesData(base, form, usdRate, opts)` solo para presupuestos (alternatives + budget terms). `attachPiecesBlocks` setea `base.pieces` con la lista de `PiecesPdfPiece` (uno por pieza) que el renderer prefiere cuando `form.pieces` no está vacío. La OT cae en el mismo branch pieces que el Presupuesto multi-pieza.

**Reactividad del material principal → fabrication_details:** nuevo helper `refreshPieceFabricationDetails(fabrications, material)` exportado desde `useBudgetPieces.helpers.ts`. Llamado desde `mutateUpdatePieceBuildingGroup` y `mutateUpdatePieceAlternativeGroup` cuando `FRENTE_PRICE_FIELDS.has(field)` (mismo gate que `refreshPieceFrentes`). Para cada fila m²-based (`BASEBOARD`/`FRONT` en `M2_CONCEPTS`) cuyo `material === material.name`: (i) sincroniza `material_price_m2` + `currency` con el principal actual; (ii) si la fila tiene dims re-precía `price = m² × $/m²` contra el principal NUEVO; (iii) si no tiene dims todavía solo sincroniza el snapshot. Filas asignadas a OTRO material o globales quedan intactas.

**Atomicidad de bloques al final del PDF:** envolver el bloque final (`TermsBlock` + `ExtrasBlock` + `footer`) en un `<View wrap={false}>` en `DocumentPdf.tsx` (los 3 branches: pieces, single-section, legacy fallback). `wrap={false}` le dice a react-pdf "no me partas — si no entro entero en la página actual, mueve TODO el bloque a la siguiente página". Así se eliminó la "huérfana con solo saldo": ahora si la página 1 se desborda, **Terms + Extras + Saldo viajan juntos como un único bloque visual** a la página 2.

## Reglas estrictas

1. **`buildPdfData` nunca debe agrupar materiales por defecto.** Siempre debe delegar a `attachPiecesBlocks` (que setea `base.pieces` cuando `form.pieces` no está vacío) — el `DocumentPdf` prefiere el branch pieces para que el OT tenga la misma agrupación "PIEZA: COCINA" / "PIEZA: BAÑO" que el Presupuesto.
2. **Si se agrega un nuevo tipo de documento** (ej. "workshop sheet", "remito") al `DocumentPdf`, debe poblar `data.pieces` vía `attachPiecesBlocks` para que herede la agrupación por pieza.
3. **Para evitar páginas huérfanas**, cualquier bloque que deba viajar atómicamente (totals + saldo, header + croquis, terms + saldo) debe envolverse en un `<View wrap={false}>` con TODO su contenido adentro.
4. **Mutadores que cambien el `$/m²` o la moneda de un material principal/alternativa** deben re-preciar TANTO los frentes del catálogo (`refreshPieceFrentes`) COMO los manuales de `fabrication_details` (`refreshPieceFabricationDetails`) en la misma transacción — si agregás un nuevo campo de precio al modelo de material (ej. `price_per_panel`), replicá la lógica en ambos helpers.
5. **Backend sin cambios.** La OT PDF legacy (`pdf_html.py::_build_measurement_comparison`) sigue el mismo patrón para frentes manuales; la lógica de re-pricing equivalente se aplica solo en el render (snapshot `material_price_m2` re-leído del row actualizado en el commit).

## Estado de aplicación

| Archivo | Antes | Después |
|---|---|---|
| `app/services/work_order.py` | 1262 LOC | 6 módulos (`__init__.py`/`helpers.py`/`cash.py`/`recalc.py`/`snapshots.py`/`conversion.py`) |
| `src/utils/pdf/buildPdfData.ts` | 349 LOC | orchestrator fino + extrae `attachPiecesBlocks` (no nuevo módulo, método nuevo) |
| `src/utils/pdf/buildSectionData.measurement.ts` | comparativa plana | + per-piece grouping + section header band + `piece_name` en cada row |
| `src/components/ui/PdfPreviewModal/DocumentPdf.tsx` | 3 branches de Page | + `<View wrap={false}>` envolviendo Terms+Extras+footer en los 3 branches |
| `src/features/budgets/hooks/useBudgetPieces.helpers.ts` | 749 LOC | + `refreshPieceFabrionDetails` (helper exportado) |

## Verificación

- `npx tsc --noEmit` → 0 errores
- `npx vitest run` → **512/512**
- `pytest -q` → **164/164**

## Consecuencias

### Positivas

- La OT ahora se ve igual que un Presupuesto multi-pieza: un `PieceBlock` por pieza con sus materiales/fabrication/additional works/pools.
- El re-pricing de zócalos/frentes manuales en `mutateUpdatePieceMainGroup`/`mutateUpdatePieceAlternativeGroup` evita el bug "subtotal congelado" cuando el operador cambia el `$/m²` del material principal.
- `wrap={false}` evita que el saldo quede huérfano en una página 2 cuando el contenido se desborda.

### Negativas / costos

- El branch pieces del renderer debe seguir funcionando para presupuestos — los tests de `buildPiecesPdfData.test.ts` y `buildPdfData.test.ts` (66 + 21 tests) cubren los flujos de presupuesto, piezas, alternativas, y comparativa.
- `attachPiecesBlocks` se llama siempre — para formularios legacy sin `form.pieces` retorna temprano (no popula `base.pieces`), así que el comportamiento legacy sigue igual.

## Migración

No requiere migración de base de datos ni de schema. Solo cambios de código:
- `buildPdfData.ts` — extraer `attachPiecesBlocks` de `attachBudgetPiecesData` y llamarlo para ambos tipos de documento.
- `buildPdfData.alternatives.ts` — añadir `attachPiecesBlocks`, mantener `attachBudgetPiecesData` solo para presupuestos.
- `DocumentPdf.tsx` — envolver los 3 bloques finales con `<View wrap={false}>`.
- `useBudgetPieces.helpers.ts` — añadir `refreshPieceFabricationDetails` y llamarlo en los 2 mutators.
- `useBudgetPieces.test.ts` — actualizar `does not attach the pieces layout to a work order` → `attaches the pieces layout to a work order` (WO ahora sí usa pieces mode).

## ADRs relacionados

- ADR 0009 — Modularización de archivos monolíticos (orchestrator thin + módulos enfocados). ADR 0010 extiende este patrón al módulo de PDF (`buildPdfData.ts` + `buildSectionData.ts` + `buildPiecesPdfData.ts`) y al patrón de bloques atómicos (`wrap={false}`).
- ADR 0008 — Migraciones Alembic idempotentes + seeders sync. Aplica al backend del módulo work_order (no relevante para este ADR).
- ADR 0007 — Catálogo de métodos de pago (Fase 7). El recargo de tarjeta (SURCHARGE) sigue el patrón `applyPaymentMethodToTotals` (frontend) + `_resolve_catalogue_adjustment` (backend) — mirror de esta regla.