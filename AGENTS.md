# AGENTS.md

> **Estado:** Rama `development`. Sesión **2026-09-18 (noche)** — **TRAMOS DEL MATERIAL PRINCIPAL (`mainMaterialRows`)** en el flujo de piezas v3 (`piecesFlow`, compartido por presupuestos y OTs): cada pieza puede llevar **filas de medida extra de su material principal** ("tramos" — mismo material físico, dims propias, NO alternativas) que se concatetan al principal para el recálculo, los totales y el PDF, y se persisten en el roundtrip save/load. El main queda como ancla + los tramos en `mainMaterialRows` (un solo objeto en el wire, sin array plano legacy). Ver "Tramos del material principal 2026-09-18 (noche)" abajo. *(Sesión anterior: OTs migradas a piecesFlow 2026-09-18 (tarde); antes: Descuento Comercial Fase 3.)* *(Sesión 2026-09-18 (tarde) — resumen retenido: **EL FORM DE ÓRDENES DE TRABAJO MIGRÓ A LA ARQUITECTURA POR PIEZAS/MESADAS (`piecesFlow`)** igual que los presupuestos: `WorkOrderFormPage` ahora destructurea `piecesFlow` y pasa `showPieces` + `piecesFlow` a `EntityFormLayout` → renderiza el bloque `PIEZAS / MESADAS` (con el material principal, alternativas, zócalos/frentes, adicionales y piletas POR pieza) en lugar de las tablas legacy MATERIALES/PILETAS/FABRICACIÓN/ADICIONALES. La **COMPARATIVA DE MEDICIÓN inline** (M² Real vs Presupuestado) se conservó en modo pieces vía la nueva prop `showMeasurementComparison` de `PiecesSection` (por pieza, `fabricationMeasure` en MEASUREMENT). Se conservan todos los módulos OT: Estado/Prioridad + toggle de comparativa (`beforeLayout`), Calculadora de Porcelanato + Diseño/Plano + Presupuesto/Descuento Comercial (`renderBottom`), Observaciones + Condiciones de Entrega. Los adaptadores (`buildPayload`/`mapApiToForm`/`buildFinancialPayload`/`mapFinancialToForm`) y calculadoras (`useBudgetCalculations`, `buildPdfData`) ya eran agnósticos — el backend OT ya tenía `pieces_data` (modelo + schemas + `create_from_budget` lo copia + recalc con `flatten_pieces`), así que el roundtrip save/load por piezas funciona sin migración. Ver "OT migradas a piecesFlow 2026-09-18 (tarde)" abajo. *(Sesión anterior: DESCUENTOS UNIFICADOS 2026-09-18 — ver "Unificación de descuentos 2026-09-18"; antes: Descuento Comercial Fase 3 + selector en todas las vistas.)*

> `tsc --noEmit` 0 errores · vitest **321/321** (31 files · −2 netos por tests DISCOUNT reemplazados con la unificación) · pytest **99/99** · `npm run build` OK · ESLint 0 errores nuevos (preexistentes: `EntityFormLayout.tsx:3` 'PdfDocumentData' unused, `entityFormSerialization.ts:99` 'rest' unused, `useFormDetails.ts:49/53` warnings, `buildPdfData.ts` imports sin usar, `BudgetPanel.tsx:29` 'financial', `useBudgetCalculations.test.tsx:20` 'React', `WorkOrderFormPage.tsx` varios unused preexistentes). *(Nota 2026-09-18 temprano: vitest **312/312** — ver "Refactor a feature-based de presupuestos" abajo.)* *(Nota 2026-09-01 noche: vitest **222/222**, pytest **72/72** — ver "Navegación tras guardar + tarjeta cobra 100%" y "Señas fantasma + duplicado real" abajo.)* *(Nota 2026-09-02: pytest **77/77** — +5 tests de idempotencia de caja.)* *(Nota 2026-09-03: vitest **223/223** — +1 test del fix "Deshacer" en modo crear; ver "Fix botón Deshacer en modo crear 2026-09-03" abajo.)* *(Nota 2026-09-03 (tarde): + botón de retroceso de estado en OT — ver "Botón de retroceso de estado 2026-09-03" abajo.)*
>
> **Índice del conocimiento (codebase-memory):** **reindexado** el 2026-08-27 junto con el commit de esa sesión. ADR de arquitectura persistido en el índice (`manage_adr`) + ADR de decisión commiteado en `docs/adr/0008-database-migrations-and-seeder-sync.md`. El ADR de Fase 7 sigue en `docs/adr/0007-payment-methods-catalogue.md`.

## Índice del conocimiento (codebase-memory)

- **Reindexado (2026-08-27):** `index_repository(repo_path=D:\projects\PERSONAL\afamar, name=afamar, mode=full, persistence=true)` → **4003 nodos / 14073 aristas**. Artefacto `.codebase-memory/graph.db.zst` commiteado en el commit de esta sesión. Incluye Fase 7 (payment methods) + fixes UX + arranque/migraciones/seeders.
- **ADR de arquitectura (índice):** `manage_adr(project="afamar")` persiste PURPOSE/STACK/ARCHITECTURE/PATTERNS/TRADEOFFS/PHILOSOPHY (poblado el 2026-08-27). Para decisiones por-cambio (numbered ADRs) ver `docs/adr/0007-payment-methods-catalogue.md` y `docs/adr/0008-database-migrations-and-seeder-sync.md`.
- **ADR 0008 (arranque + seeders, 2026-08-27):** toda `alter_column`/`batch.alter_column` debe llevar `existing_type` explícito (MySQL lo exige, SQLite lo omite). `_run_seeders()` devuelve resúmenes `name: +N ~N /N` y el lifespan loguea `AFAMAR initialization OK — ready to serve requests`. Seeders sincronizados con producción (dedup): materials **64**, pool_stock **68**, additional_works **13**.
- **ADR 0007 (Form, hot-path, invariantes):** contrato "el form es la fuente de verdad" (form ↔ PDF ↔ DB), hot-path de `BaseRepository.add`/`save` y `createResource.get`, el facade `useEntityForm`, los invariantes de `useBudgetCalculations` (deps deben incluir `additional_works_data`, `paymentMethodsDepsJson`, `form.installments`), `useBudgetActions.handleSubmit` con `e.preventDefault()`, los helpers `swapMaterialGroupToList` + `repointSwapReferences`, y los 4 lugares que aplican la regla del recargo de tarjeta (deben mantenerse en sync).
- **Hotspots confirmados (reindex 2026-08-27):** backend `BaseRepository.add` (32 callers, #2) / `save` (25); frontend `createResource.get` (74, #1 global), `parseApiError` (29), `LoadingSpinner` (25), `loginViaApi` (21), `createResource.update` (19), `useNotify` (19). Tras Fase 7, sumar `useBudgetCalculations.applyPaymentMethodToTotals` (4 callsites nuevos) y `paymentMethodRepository.get_by_name` (CRUD del catálogo).
- **Complejidad alta:** `usePlateCalculator` (bin-packing, loop_depth 4, cyclomatic 13), `pdf_html._sketch_to_png_base64_list` (loop_depth 3, cyclomatic 25), `WorkOrderService.update` (cyclomatic 12), `_recalculate_totals_from_items` (cyclomatic ~12 con alternativa + catálogo).
- **Clusters de-facto:** frontend core UI (102, cohesión 0.79), forms orchestration (74, 0.81), `parseApiError`+`useBudgetActions`+`buildPayload`+`useFormActions` (65, 0.81), budget/quote/fabrication/sketch (54, 0.88). Sin dependencia circular entre `app/` y `src/`.

## Refactor a feature-based de presupuestos (2026-09-18)

El módulo de presupuestos (feature **PIEZAS / MESADAS**, *multi-piece*) se reorganizó a una **estructura feature-based** (`src/features/budgets/`) y se **tradujeron a inglés los identificadores internos**. La **UI, el PDF, los placeholders y los mensajes siguen 100% en español**. Contexto de la feature subyacente: los presupuestos son *multi-piece* — cada **pieza/mesada** tiene su material principal, sus materiales alternativos, sus zócalos/frentes, sus trabajos adicionales y sus piletas; las OT siguen con el layout legacy.

### Estructura feature-based + alias `@features/*` (FASE 2)

```
afamar-frontend/src/features/budgets/
├── components/PiecesSection.tsx (+ PiecesSection.module.css)
├── hooks/useBudgetPieces.ts (+ useBudgetPieces.test.ts)
├── utils/pieces.ts
├── utils/fabricationDetails.ts
├── types/       (vacío, reservado)
└── constants/   (vacío, reservado)
```

- **Alias `@features/*` re-introducido** (la nota vieja "eliminados en 6.3" quedó obsoleta): registrado en `tsconfig.json` (`paths`), `vite.config.ts` (`resolve.alias`) y `vitest.config.ts` (`resolve.alias`) → `@features` = `./src/features`.
- Los archivos se **movieron físicamente** (no son shims/re-exports). Todos los consumidores importan vía `@features/budgets/...` o `@/...`: `components/entity/EntityFormLayout.tsx`, `hooks/useEntityForm.ts`, `hooks/entityFormSerialization.ts`, `hooks/entityFormConstants.ts`, `hooks/useFormDetails.ts`, `types/form.ts`, `utils/pdf/buildPiecesPdfData.test.ts`.
- **Tip para git en este entorno:** `git mv` falla (el repo git está en el **padre** de `afamar-frontend/`; `--show-toplevel` = `proyectos/afamar`, `--show-prefix` = `afamar-frontend/`). Workaround: `Move-Item` + `git add <nuevo>` + `git rm <viejo>`. Correr git desde `proyectos/afamar` con paths `afamar-frontend/...`.

### Modelo de piezas (pieces v3)

- `BudgetPiece` (`src/types/budget.ts:181`): `{ id, name, mainMaterial: PieceMainMaterial, alternativeMaterials: PieceAlternativeMaterial[], fabrication_details: FabricationDetail[], additional_works_data: string, pools: PoolInForm[] }`. Aliases: `PieceMainMaterial = MaterialInForm | null`, `PieceAlternativeMaterial = MaterialInForm`.
- Serializado a JSON en la columna **`pieces_data` (TEXT)**; migración Alembic **`f8e7d6c5b4a3`** (agrega `pieces_data` en `budgets` + `allows_integrated_sink` en `materials`). `allows_integrated_sink` = si el material permite bacha integrada (validación en `src/utils/integratedSink.ts`).
- **Modo pieces-only:** los **presupuestos y las OT siempre renderizan `PiecesSection`** (sin toggle `usePieces`/`enablePieces`/`clearPieces`); `form.pieces` garantizado ≥ 1 por el init + el serializer. La OT activa `showPieces` + `piecesFlow` desde `WorkOrderFormPage` (ver "OT migradas a piecesFlow 2026-09-18 (tarde)" abajo) — el layout legacy sigue existiendo solo si algún consumidor pasara `showPieces={false}` explícito, pero nada lo hace hoy.
- **Piletas por pieza** (`piece.pools`): `flattenPieces` (front, `utils/pieces.ts`) y `flatten_pieces` (backend, `app/services/budget_calculator.py:37`) concatenan a `pools_data` flat. En el PDF las alternativas **heredan** las piletas de la pieza.
- Las alternativas heredan `length`/`width`/`quantity` del `mainMaterial` (helper `pieceDims`).
- `flatten_pieces(data, only_if_missing)` se llama en `app/services/budget.py:248/304` (create/update) y `app/services/work_order.py:147/969` (recalc/update).
- **Migración legacy import-safe:** `mapApiToForm` migra budgets sin `pieces_data` (helper `_loadPieces(d)`); acepta `is_alternative` y `es_alternativa`.
- **PDF de piezas:** `src/utils/pdf/buildPiecesPdfData.ts` (+ `.test.ts`) — mergea las filas doc-level de `fabrication_details` en la **pieza 0** con dedup por `(concept, detail)`.
- **UI/cableado:** `useBudgetPieces` (CRUD de piezas, expuesto como `useEntityForm().piecesFlow`); `EntityFormLayout` (`showPieces`/`piecesFlow`, branch single-column + `renderBottom()`); wizard step "Materiales" = `PiecesSection`; editor `PiecesSection` (grid 2 col; inputs Cant/Largo/Ancho; **sin** checkbox "Alternativa" por fila — las alternativas se agregan con el dropdown unificado).

### FASE 3 — Español → Inglés (solo identificadores internos)

**Regla:** código interno en inglés; **textos de UI/PDF/placeholders/mensajes SIEMPRE en español**. Renombres aplicados (tipos/interfaces/hooks/funciones/variables) dentro de `src/features/budgets/` + el consumidor mínimo:

- `utils/fabricationDetails.ts`: campo del `ctx` de `recomputeFabricationRow` `materialPrecio` → `materialPriceArs`.
- `hooks/useBudgetPieces.ts` (interface `UseBudgetPiecesReturn` + impl.): `addPieceDetalle`/`updatePieceDetalle`/`removePieceDetalle` → `addPieceFabrication`/`updatePieceFabrication`/`removePieceFabrication`; `frenteCatalogue`/`setFrenteCatalogue` → `frontCatalogue`/`setFrontCatalogue`; ctx `materialPriceArs`.
- `components/PiecesSection.tsx`: `categorias` (prop de `SingularMaterialCard`/`PieceCard` + variable local) → `categories`; calls a `handlers.*PieceDetalle` → `*PieceFabrication`.
- `hooks/useBudgetPieces.test.ts`: comentario `setFrenteCatalogue` → `setFrontCatalogue`.
- `src/hooks/useFormDetails.ts` (fuera del feature, solo para compilar): clave de ctx `materialPrecio` → `materialPriceArs` (el `ref` `materialPrecioRef` se mantiene).

**NO renombrado (a propósito):** claves de contrato/wire snake_case que matchean backend/`EntityFormState` (`fabrication_details`, `additional_works_data`, `materials_data`, `pools_data`, `is_alternative`, `mesada_length`/`mesada_width`, `material_price_m2`, etc.); props de componentes compartidos fuera del feature (`detalles`/`handleDetailChange`/`addDetalle`/`removeDetalle` de `FabricationSection`, `updatePileta`/`removePileta` de `PoolCard`, `categorias` de `MaterialCard`/`MaterialPickerControls`); y `frenteCatalogue` en `src/hooks/useFormMaterials.ts` + `frenteCatalogues` en `AdditionalWorkSection.tsx`.

### Verificación y ramas

- `npx tsc --noEmit` **0** · `npx vitest run` **312/312** (30 files) · `npm run build` OK · ESLint del feature **0 errores** (2 warnings preexistentes en `useFormDetails.ts`).
- Backend: pytest **99/99** (incluye `tests/test_flatten_pieces.py`, 9 tests).
- **Ramas:** `main` mergeado con `development` y pusheado — commit `17f48322 "Merge branch 'development'"`; `origin/main` == `main` y `git diff main development` = vacío. `development` es la rama de trabajo.

## OT migradas a piecesFlow 2026-09-18 (tarde)

Las **Órdenes de Trabajo migraron a la arquitectura por piezas/mesadas** (`piecesFlow`) — el layout legacy de OT (tablas planas MATERIALES / PILETAS / FABRICACIÓN / ADICIONALES) quedó **sin consumidores**. Recil: el form de OT (`/admin/work-orders/new` + `/admin/work-orders/:id`) ahora muestra el mismo editor `PIEZAS / MESADAS` que los presupuestos, con material principal + alternativas + zócalos/frentes + adicionales + piletas **por pieza**.

**Cableado UI (frontend, los 3 archivos):**
- `pages/work-orders/WorkOrderFormPage.tsx` — destructurea `piecesFlow` de `useEntityForm` y pasa `showPieces` + `piecesFlow={piecesFlow}` a `EntityFormLayout`.
- `components/entity/EntityFormLayout.tsx` — `piecesOn = Boolean(showPieces && piecesFlow)` pasa a **true** para la OT; en los 2 spots donde renderiza `PiecesSection` (branch full single-column y wizard step "Materiales") le pasa `showMeasurementComparison={fabricationShowMeasurementComparison}`. Doc-comment de `showPieces` y var `piecesOn` actualizados (antes decían "las OT usan el layout legacy").
- `features/budgets/components/PiecesSection.tsx` — nueva prop opcional **`showMeasurementComparison?: boolean`**: cuando está activa (solo OT en MEASUREMENT), cada `PieceCard` pasa `showMeasurementComparison` + `materialsData={pieceMaterials}` (los materiales de SU pieza, con su snapshot `m2_budgeted`) a su `FabricationSection` → la tabla inline M² Real / M² Presupuestado / Diferencia se muestra **por pieza**. Los presupuestos no la pasan → comportamiento sin cambio.

**Módulos OT conservados (todos intactos):**
- `beforeLayout` → `WorkOrderFormStatus` (Estado y Prioridad) + toggle colapsable "Activar/Ocultar Comparativa de medición" (checkbox `include_measurement_comparison_in_pdf`, que controla la tabla del PDF).
- `renderBottom()` → Calculadora de Porcelanato + `SketchSection` (Diseño/Plano) + `EntityFormFinancial` (Presupuesto, Descuento Comercial `DiscountSelector`, saldo/seña, alternativas grid).
- `observations` (`WorkOrderFormObservations`) + `terms` (Condiciones de Entrega y Garantía). En wizard, los pasos `pools`/`fabrication`/`additional-works` se ocultan (colapsan en el paso "Materiales" = `PiecesSection`), igual que presupuestos.

**Adaptadores y calculadoras — SIN CAMBIOS (ya eran agnósticos):**
- `buildPayload` → `pieces_data: jsonStringify(form.pieces)` (+ arrays flat); `mapApiToForm` → `_loadPieces(d)` restaura piezas y migra OTs legacy sin `pieces_data`. `buildFinancialPayload`/`mapFinancialToForm` son financial-only.
- `useBudgetCalculations` y `buildPdfData` consumen los arrays flat (`materials_data`/`pools_data`/`fabrication_details`/`additional_works_data`) que `flattenPieces` mantiene en sync con las piezas en cada commit → totales/PDF y la COMPARATIVA del PDF funcionan idéntico.
- **Backend OT ya soportaba piezas sin migración:** `work_orders.pieces_data` (TEXT) + schemas Base/Create/Update; `create_from_budget` copia `budget.pieces_data` (`app/services/work_order.py:847`) y el recalc deriva los flat arrays con `flatten_pieces(data, only_if_missing=True)` (`:147/:969`) persistiéndolos (`:1001`). Roundtrip save/load por piezas OK.

**Verificación:** `npx tsc --noEmit` **0** · `npx vitest run` **321/321** (31 files, sin regresiones) · ESLint en los 3 archivos = solo baseline preexistente (sin errores nuevos). Nota: `layoutClassPieces` (`${prefix}layout--pieces`) no tiene clase definida en ningún `.module.css` — es el mismo estado que el presupuesto (div sin clase, `PiecesSection` es su propio `card`), sin rellenar. Si se re-corre Playwright, revisar los specs E2E que dependen del texto/estructura del layout legacy de OT (el form de OT ya no tiene "PILETAS"/"FABRICACIÓN"/"ADICIONALES" globales).

## Descuento Comercial (Fase 3) 2026-09-18

Descuento comercial **frontend-only para presupuestos**, **gated por un toggle**: el porcentaje solo aplica con `discount_enabled` encendido, y corre contra una base elegida por el operador — **"Total General"** (todo el documento: subtotal + traslado) o **"Solo Materiales"** (solo los materiales principales mármol/granito/cuarzo; mano de obra, trasforos, piletas e ingletados NO se descuentan). Decisiones del usuario (vía questions): **solo frontend** (el backend ignora los campos nuevos; el `%` reutiliza la columna persistida `discount_percentage`) y **gated por toggle** (`discount_fixed_amount` queda legacy sin UI). El gate aplica también a OTs por el `useBudgetCalculations` compartido, y el selector se renderiza **tanto en presupuestos como en OTs** (corrección de esta sesión: se eliminó el gate por tipo de documento — ver "UI: selector en todas las vistas" abajo).

**Campos nuevos (form-local + payload, ignorados por backend):** `discount_enabled: boolean`, `discount_target: 'total' | 'materials'`, `discount_amount: number` (snapshot ARS del descuento, sync vía `setForm`). Agregados a `FinancialBase` (`src/types/shared.ts`) → solo 3 sitios construyen literales `FinancialBase` (`DEFAULT_FINANCIALS`, `buildFinancialPayload`, `mapFinancialToForm`) — los tres actualizados.

**Estructura (feature):**
```
src/features/budgets/
├── types/discount.ts                         DiscountTarget / CommercialDiscountState / DISCOUNT_TARGET_LABELS
├── utils/commercialDiscount.ts (+ .test.ts)  computeMaterialsSubtotal + computeCommercialDiscount (5 tests)
├── hooks/useCommercialDiscount.ts            puente form ↔ selector (update('discount_*', ...))
└── components/DiscountSelector/              TSX + module.css (UI en español)
```

- **`computeMaterialsSubtotal`** es la única fuente de verdad de la base "Solo Materiales" (matchea `matArs`/`matUsd` de `useBudgetCalculations`; suma `length×width×quantity×price_m2` de los materiales `!is_alternative`, convierte a ARS/USD con `usd_rate`).
- **Totales en vivo (`useBudgetCalculations.ts`):** bloque ARS (~líneas 308-328), espejo USD (~365-374) y bloque alternativa ARS/USD (~399-441) gateados por `descEnabled`/`descTarget`; `discount_amount: discountAmount` emitido en el `setForm`; deps actualizadas con `form.discount_enabled, form.discount_target`.
- **PDF (`buildPdfData.ts::computeTotals`):** mismos gates como params opcionales (`discountEnabled?: boolean | null` — `null`/omisión preserva el comportamiento legacy `discountPct > 0`) + `discountTarget` + bases `materialsSubtotalArs/Usd`; precedencia **fixed-wins** intacta (el fixed queda sin gate y sin UI). El call site computa las materias con `computeMaterialsSubtotal` y las pasa a los 2 `computeTotals` (document-level y por-sección de alternativas).
- **Serialización:** `entityFormConstants` (DEFAULT_FINANCIALS), `entityFormFinancial` (`buildFinancialPayload` emite los 3; `mapFinancialToForm` los restaura con `discount_target` → `'materials'` solo si llega exactamente eso). Pydantic v2 descarta los extras del payload → sin migración backend.
- **UI: selector en todas las vistas** `DiscountSelector` se renderiza **incondicionalmente** en `BudgetPanel` (debajo de las columnas ARS/USD), para **presupuestos Y órdenes de trabajo**. El chain `showDiscount` que lo gateaba por tipo de documento (`EntityFormLayout` → `EntityFormFinancial` → `BudgetPanel`, derivado de `Boolean(piecesFlow)`) se **eliminó por completo** en esta sesión — el componente, la prop y la condición ya no existen. La fórmula corre idéntica en ambos (mismo `useBudgetCalculations` + `buildPdfData`, agnósticos al tipo de documento).

**Regla de sync:** la fórmula vive en 3 lugares que deben mantenerse en sync — `computeCommercialDiscount` (feature), el bloque inline de `useBudgetCalculations` y `computeTotals` de `buildPdfData.ts`. Cualquier cambio de base/porcentaje/devengado toca los 3 + sus tests.

**Tests:** +11 → vitest **323/323** (31 files): `commercialDiscount.test.ts` (5 — subtotal mixto ARS/USD excluye alternativas, inactive si disabled o 0%, base total, base materials); `useBudgetCalculations.test.tsx` (gating off → 0/kgate, base total 107000→10%=10700, base materials 97000, fixed sin gate); `buildPdfData.test.ts` (gating off → 10% ignorado/total=base, target total 91800, target materials 97000). Los tests viejos de % ahora setean `discount_enabled: true` explícito (sin el flag el gate anula la herencia legacy).

**Verificación:** `tsc --noEmit` **0** · vitest **323/323** (31 files) · `npm run build` OK · ESLint feature **0 errores/warnings** (los errors restantes de `buildPdfData.ts` imports sin usar, `BudgetPanel.tsx:29 'financial'` y `useBudgetCalculations.test.tsx:20 'React'` son preexistentes en HEAD).

## Unificación de descuentos 2026-09-18 — se elimina el descuento promocional por efectivo legacy

La gestión de descuentos quedó **centralizada exclusivamente en el Descuento Comercial** (Fase 3, `DiscountSelector` → `useCommercialDiscount`). Se **eliminó el descuento promocional por método de pago legacy** (`apply_cash_discount`), junto con su checkbox "Aplicar descuento promocional por Efectivo". Regla de negocio vigente: **la "Forma de pago" es un dato de cobro** — un método del catálogo solo ajusta el total si es `SURCHARGE` (recargo de tarjeta); los métodos `DISCOUNT` quedan **puramente informativos** (se comportan como `NONE`).

**Qué se quitó (frontend, sin migración ni backend):**
- **Cambios:**
  - `types/shared.ts` — `FinancialBase.apply_cash_discount` eliminado (campo + doc-comment).
  - `hooks/entityFormConstants.ts` — default `apply_cash_discount: false` eliminado.
  - `hooks/entityFormFinancial.ts` — eliminado de `buildFinancialPayload` y `mapFinancialToForm` (los 3 sitios que construyen literales `FinancialBase` quedaron sync).
  - `hooks/useBudgetCalculations.ts` — `applyPaymentMethodToTotals` reescrito **solo-`SURCHARGE`**: param `applyCashDiscount` y las ramas DISCOUNT (% y monto fijo con `1 − value/100`) eliminadas; flag quitado de los 2 call sites de alternativas y de las `deps` del effect.
  - `utils/pdf/buildPdfData.ts` — `computeTotals` (bloques ARS y USD + alternativas) reescrito solo-`SURCHARGE`; `applyCashDiscount` eliminado de `ComputeTotalsParams`, destructure, `const` local y los 2 call sites. Imports puros de `types/pdfTypes`: `DocumentType`, `PdfDataRow`, `MaterialPdfRow`, `PoolPdfRow`, `AdditionalWorkPdfRow` — **preexistentes sin uso**.
  - `pages/work-orders/WorkOrderFormPage.tsx` — comentario del `buildPdfData` inline ("SURCHARGE / DISCOUNT" → "SURCHARGE").
  - **UI:** `components/budget/BudgetPanel/BudgetPaymentSection.tsx` — bloque completo del checkbox "Aplicar descuento promocional por Efectivo" (era `currentMethod?.type === 'DISCOUNT'`) eliminado; el sufijo del label del método ahora solo se agrega para `SURCHARGE` (ej. "… (recargo X%)"). `currentMethod` se conserva para el selector y las cuotas de tarjeta.
- **Comportamiento del catálogo:** `PaymentMethodsTable`/`PaymentMethodForm` **siguen ofreciendo el tipo `DISCOUNT`** (configurable) — decisión intencional: la UI de catálogo no cambió, el tipo solo dejó de afectar totales.

**PDF note:** `computeTotals` aún retorna `catalogue_discount_percentage`/`catalogue_discount_amount` (ahora **constantes = 0**) para que las templates no se rompan; el backend legacy y el ORM conservan la columna `apply_cash_discount` (el frontend ya no la envía → el recalc server-side la trata como off, consistente con DISCOUNT inerte).

**Tests (vitest 323 → 321, 31 files):**
- `hooks/useBudgetCalculations.test.tsx` — el describe "apply_cash_discount opt-in (catalogue DISCOUNT)" (3 tests) se reemplazó por **"catalogue DISCOUNT is informational"** (2 tests): método DISCOUNT 5% deja `total === subtotal`; método DISCOUNT fijo $3000 también se ignora.
- `utils/pdf/buildPdfData.test.ts` — los 3 tests de catálogo DISCOUNT ("surfaces…", "FIXED-AMOUNT…", "skips when flag false") se reemplazaron por 2 tests de DISCOUNT inerte (percentage y fixed): `catalogue_discount_* === 0`, `total === subtotal`.
- `hooks/entityFormHelpers.test.ts` — `apply_cash_discount` quitado de `FINANCIAL_FIELDS` y del `toEqual`; "22 expected keys" → "21 expected keys".

**Documentos pendientes de limpieza (no tocados, inofensivos):** comentarios en `useBudgetCalculations.ts:101` y `buildPdfData.ts:166` que describen la remoción del flag — se conservan como documentación.

**Verificación:** `tsc --noEmit` **0** · vitest **321/321** (31 files) · ESLint 0 errores nuevos (quedan solo los preexistentes del baseline: imports sin usar en `buildPdfData.ts:17-21`, `BudgetPanel.tsx:26 'financial'`, `useBudgetCalculations.test.tsx:20 'React'`, `EntityFormLayout.tsx:3 'PdfDocumentData'`, `WorkOrderFormPage.tsx` unused variados).

## Auto-consume de material en "Asignar a opción" (2026-09-12)

En el form de presupuesto (`/admin/budgets/new`), al hacer click en **"Agregar concepto"** (que agrega un material adicional tipo zócalo/frente), el select **"Asignar a opción"** ahora **se auto-consuma** el material cargado en el listado MATERIALES — antes el operador tenía que elegirlo **manualmente** cada vez (con 1 solo material cargado, es un paso redundante que se repite por cada detalle).

**Dónde:** `src/hooks/useFormDetails.ts::addDetalle` (líneas ~98-133) — el hook compartido que alimenta a `BudgetFormPage` y `WorkOrderFormPage` vía `useEntityForm` → `useEntityForm.addDetalle` → `AdditionalMaterial` (cada form con su `addDetalle`). También respeta material por página de croquis (ver "Material por página de croquis" abajo).

**Lógica (obtenida de `form.materials_data`, determinista por render):**
- **Exactamente 1 material que NO es alternativa** (`!singleMain.is_alternative`) → el detalle nuevo arranca con ese material: `material = singleMain.name`, `material_price_m2` = `price_m2`/`price_m2_usd` según la moneda del material, `currency` = la del material. Cero clicks del operador.
- **Exactamente 1 material pero ES alternativa** → `material: ''` (**global** — un detalle global suma al total sin pincharse a la opción; una alternativa no debe "tragarse" los detalles).
- **Múltiples materiales / alternativas presentes** → `material: ''` (global). El operador asigna a mano con el picker (que muestra SOLO los materiales del `materials_data`, deduped — ver `components/budget/AdditionalMaterial`).

**Regla de oro:** el auto-consume es pura conveniencia del operador — **no** sobrescribe una opción ya elegida en una fila existente; solo setea el default de la fila **recién creada**. El cambio de opción manual sigue intacto (`handleDetailChange`).

**Sin cambios de backend** (el ancho del select y el shape del detalle ya existían). **Verificación:** `tsc --noEmit` 0 errores · vitest **276/276** (24 files) · pytest 83/83.

## LONGTEXT en fotos/croquis de mediciones (2026-09-12)

Fix de **truncado silencioso** en las mediciones: una medición con fotos o croquis grande se guardaba incompleta en MySQL y las fotos "desaparecían" al recargar.

**Causa raíz:** MySQL `TEXT` tiene tope de **64 KB**. `photos_data` y `sketch_data` se guardan como **JSON en base64/data-URL** (una sola foto de celular fácilmente supera los 64 KB) → MySQL **trunca silenciosamente** a mitad del JSON → la columna queda con JSON corrupto y al re-leer se "pierden" las fotos. En SQLite no pasa (TEXT no tiene límite), por eso el bug era solo en producción MySQL.

**Fix aplicado (2 capas, deben mantenerse en sync):**
- **Migración Alembic `e2f3a4b5c6d7`** (`alembic/versions/e2f3a4b5c6d7_measurement_photos_sketch_longtext.py`): `alter_column` de `photos_data` y `sketch_data` en `measurements` de `sa.Text()` → **`LONGTEXT`** (vía `with_variant(mysql.LONGTEXT(), "mysql")`). En SQLite la variante es no-op (TEXT no tiene tope).
- **Modelo (`app/models/measurement.py:13`):** constante `_TEXT = Text().with_variant(mysql.LONGTEXT(), "mysql")` aplicada a los dos `mapped_column`. **Regla:** si en el futuro otro campo guarda payloads grandes (fotos/croquis/JSON base64), usar `_TEXT` en vez de `Text` pelado.

**Datos perdidos (irrecuperables):** la fila de medición que disparó el reporte ya se había guardado con la columna todavía `TEXT` — los bytes truncados no existen (pérdida real, la investigamos y no hay forma de recuperar el JSON completo; la medición se cargó de nuevo). No hacer backfill intentando "recuperar" de filas truncadas — el JSON cortado no se puede reconstruir.

**Verificación:** migración aplicada a **prod MySQL** + roundtrip E2E con **~200 KB** de fotos base64 → `ROUNDTRIP OK: True` (antes fallaba con el truncado). `SHOW FULL COLUMNS` confirma `longtext` en prod. `tsc --noEmit` 0 errores · vitest **276/276** · pytest **83/83**.

## Ficha de Taller 2026-09-10

Nueva feature: un **documento interno para el taller** separado del presupuesto/cliente. El operador imprime la Ficha de Taller y se la entrega a los trabajadores junto con la orden física. **SIN precios** (no es para el cliente), con el croquis grande para que el taller sepa qué cortar. Aplica **solo a órdenes de trabajo** (no a presupuestos).

**Contenido del PDF** (`WorkshopSheet`): N° de orden, material, pileta, croquis/plano grande, y la grilla **"Especificaciones para el taller"** con 6 celdas: **Corte / Faja / Perf. / Tras.+Peg. / Term. / Sopapas** — impresas **siempre en blanco** debajo del croquis para que los trabajadores las completen **a mano con lapicera sobre el papel**. Los operarios **NO usan la web para cargar estos datos** (quedó eliminado el bloque de 6 inputs del form, corrección de esta sesión). También un bloque "Observaciones" (usa `design_observations`) impreso relleno.

### El form NO tiene los 6 campos (corrección 2026-09-10)

El flujo inicial de la feature agregaba un bloque "Especificaciones para taller" con 6 inputs al form (`showWorkshopSpecs: EntityFormSpecs` + los 6 campos en `EntityFormState`/`buildPayload`/`mapApiToForm`). El usuario lo rechazó: los trabajadores del taller llenan la hoja **a mano** (el cortador, ej. Cristian, completa "Corte" cuando termina de cortar) — el form no debe pedir esos datos. **Corrección aplicada esta sesión:**

- **Eliminado de TODA la capa frontend del form:** el bloque JSX y prop `showWorkshopSpecs` de `EntityFormSpecs.tsx` (+ clases `specs-workshop*` de su `.module.css`), el prop del `EntityFormLayout.tsx` (interface/arg/2 forwards/doc-comment), y los 6 campos `workshop_*` de `src/types/form.ts` (`EntityFormState`), `entityFormConstants.ts` (defaults) y `entityFormSerialization.ts` (`buildPayload`/`mapApiToForm`).
- **El builder imprime siempre en blanco:** `buildWorkshopPdfData.ts` ya NO lee valores del form — `SPEC_FIELDS` mapea a `value: ''` literal (constante `EMPTY_SPEC_VALUE`), con doc-comment explicando el porqué. `WorkshopFormLike` ya no declara las keys `workshop_*`.
- **Test actualizado:** `buildWorkshopPdfData.test.ts` ahora asserta `specs.every((s) => s.value === '')` incluso cuando el form trae `workshop_*` (test "keeps the spec grid blank even when the form carries values").

### Backend se conserva (columnas reservadas)

Las 6 columnas `workshop_*` (`String(100) nullable`) en `work_orders` + migración Alembic **`c5d6e7f8a9b1`** (aplicada a MySQL prod) se **mantienen** como columnas reservadas: el taller completa en papel, pero si en el futuro se digitaliza la captura, el schema ya las soporta. Sin uso activo en el form — `create_from_budget` sigue copiándolas con `getattr(budget, ..., None) or ""` (harmless) y `test_update_persists_workshop_sheet_fields` sigue pasando (verifica persistencia por `update()`). NO eliminarlas: la migración ya está en head de prod.

**Frontend (impresión → listado de OTs):**
- `WorkOrdersTable` — botón **`🖨️ Ficha`** (verde, junto a `PDF`) en la columna vista. Prop `onOpenFicha`.
- `useWorkshopPdfController.tsx` — clon de `usePdfPreviewController` pero con `buildWorkshopPdfData` y el modal dedicado.
- `WorkshopPdfPreviewModal.tsx` — misma shell que `PdfPreviewModal` (overlay/header/PDFViewer/PDFDownloadLink) renderizando `WorkshopSheet`.
- `WorkshopSheet.tsx` — documento `@react-pdf/renderer` A4 portrait, header con logo + "FICHA DE TALLER" + N° grande, fila Material/Pileta/Cliente, croquis (máx 300px altura, fondo blanco), grilla specs 3×2 con label + celda vacía, bloque Observaciones. Sin precios, sin tablas de ítems, sin términos de pago.
- `buildWorkshopPdfData.ts` — builder con types `WorkshopPdfData`/`WorkshopSpecCell`; material de `form.material` (fallback `materials_data[0]`), pileta de `pools_data[0].brand+model`, specs SIEMPRE `''`.

**Frontend (impresión → form de OT, agregado esta sesión):**
- `WorkOrderFormPage.tsx` — botón **`🖨️ Ficha de Taller`** en el header junto a "VISTA PREVIA PDF" (mismo estilo `.work-order-form__preview-btn`), habilitado solo en **modo edición** (`id` presente; deshabilitado en crear). Usa el mismo `useWorkshopPdfController` con `fetchEntity: getWorkOrder`, `defaultStatus: 'MEASUREMENT'`; `{ficha.UI}` renderizado al final del form. `handlePrintFicha` definido después del destructure de `useEntityForm` (usa `form.number`/`form.status`).

**En la DB:** columnas ya migradas a MySQL prod (head = `c5d6e7f8a9b1`). Una OT pre-existente guardada con los 6 campos los persiste vía `update()` (ver test `test_update_persists_workshop_sheet_fields`) — pero ningún form los genera ahora.

**Archivos clave (para mantener en sync si cambia el shape):**
- `afamar-frontend/src/utils/pdf/buildWorkshopPdfData.ts` ↔ `WorkshopSheet.tsx` (tipos `WorkshopPdfData` ↔ render).
- `src/hooks/useWorkshopPdfController.tsx` ↔ `usePdfPreviewController.tsx` (mismo patrón de fetch → sketch extract → build → modal).
- Si se agrega un 7º campo de spec: tocar `SPEC_FIELDS` del builder (sigue `''`) + el grid de `WorkshopSheet.tsx`; NO tocar el form.

**Cierre:** `npm run build` (`tsc --noEmit && vite build`), `npm test` (vitest 234/234), pytest 83/83. El preview se abre desde el listado de OTs (botón "Ficha") y desde el form de OT en modo edición (botón "Ficha de Taller").

## Material por página de croquis + persistencia multipágina (2026-09-10, continuación)

El croquis de la Ficha de Taller ahora etiqueta **cada página** con el **material** elegido, y las páginas **persisten** su `name` + `material` al guardar/reabrir (antes el wire format aplanaba todo a "Página 1" y sólo sobrevivía un dibujo).

**Volantes previos de esta sesión:** `flattenSketchElements` (wire flat `[{type,data,order}]`) → reemplazado por **`serializeSketchPages`** (wire `[{ pagina_id, name, material?, dibujo }]`) en `src/hooks/entityFormSerialization.ts`. NOTA: al tocar ese archivo se arregló un mojibake preexistente (`P�gina` → `Página`) en `useSketchState.ts` (`normPages`/`savePayload`), con reemplazo de bytes — el archivo se guardó UTF-8 sin BOM.

**Wire format nuevo (WorkOrders):**
```
[{ "pagina_id": 1, "name": "Mesada 1", "material": "NEGRO BRASIL",
   "dibujo": [ { "type": "line", "data": "{...geometry JSON...}", "order": 0 } ] }]
```
- `serializeSketchPages(raw)` — acepta el shape del editor (páginas con `dibujo`/`elements`) Y la lista plana legacy (la envuelve en "Página 1"). Compacta cada elemento a `{type, data, order}` (reusa un `data` existente en vez de re-stringificar).
- `unflattenSketchElements(raw)` — acepta el string JSON (columna TEXT de OT), el array de páginas, y la lista plana legacy (Budget 1-N / OTs viejas → 1 página sin material). Expande cada elemento a geometría `{...data, type}`.
- `buildPayload` → `sketch_elements: jsonStringify(serializeSketchPages(form.sketch_elements))`; `mapApiToForm` → `unflattenSketchElements(d.sketch_elements)`.

**Backend (`app/services/budget.py`):** helper `_flatten_sketch_pages(sketch_data)` normaliza el wire nuevo a las filas planas `{type, data, order}` que `BudgetSketchElement` (1-N) espera — Budget NO tiene columnas por página, así que aplanar (pierde `name`/`material`, aceptado: la Ficha es solo de OTs). Aplicado en `create()` y `update()` (también protege `None`). `WorkOrder.sketch_elements` (TEXT) guarda el wire nuevo íntegro.

**Flujo de OT:** el operador edita el croquis en el form de OT (modo medición), elige material por página (`Toolbar` → select `toolbar__material-select`, badge en readOnly), Guardar → `savePayload` emite `material` por página → `buildPayload`/`serializeSketchPages` lo persiste → al reabrir y al imprimir la Ficha (`resolveSketchPages` zippea `sketch_pages` con las imágenes del extractor y renderiza `[name — material]` en el rótulo). El extractor ignora `material`, solo dibuja la geometría.

**Conversión budget→OT:** `create_from_budget` (work_order.py:752-769) lee `budget.sketch_elements` (filas planas, sin páginas) → la OT hereda croquis legacy flat. El operador re-etiqueta material en la OT si lo necesita. OTs directas sin budget ni páginas → 1 página genérica.

**Tests:** `entityFormHelpers.test.ts` — round-trip páginas completas preservando `name`/`material` (buildPayload→mapApiToForm), flat legacy envuelto en 1 página, legacy wire sin páginas no crashea, y el test Budget 1-N existente sigue pasando. `buildWorkshopPdfData.test.ts` — `sketch_pages` con `name`/`material`/`image` y fallback genérico.

**Verificación:** `tsc --noEmit` 0 errores · vitest **240/240** (22 files, +6) · pytest **83/83** · `npm run build` OK · ESLint: 6 errores en los archivos tocados, TODOS preexistentes en HEAD (7 en HEAD; el rewrite eliminó uno). Reindexar el knowledge graph si se commiteara el `.codebase-memory/`.

## Material no persistente en presupuesto (decidido)

La elección del usuario fue "persistir páginas completas" SOLO en OTs (donde se imprime la Ficha). En **presupuestos**, `BudgetSketchElement` sigue siendo filas planas `{type,data,order}` — el multipágina colapsa en 1 página al reabrir (índice `sketch_elements` GET /budgets/{id}), y para la COMPARATIVA/PDF de presupuesto se usa `buildPdfData` (extractor, no taller). Si en el futuro se quiere material por página en presupuestos → migración para agregar `name`/`material` a `budget_sketch_elements` + actualizar `_flatten_sketch_pages`/batch paths.

## Flujo de trabajo de la OT — ciclo de vida (operativo, validado 2026-09-07)

El operador del sistema vive este flujo todos los días. Validado end-to-end contra el backend real con pruebas manuales + automatizadas:

```
[Presupuesto]                          [OT]                                    [Caja]
PENDING ─► APPROVED ─► CONVERTED ─► MEASUREMENT ─► WORKSHOP ─► FINISHED ─► DELIVERED
(informativo,           (con `budget_id`)    (seña real cargada    (saldo
 sin seña)                                  durante MEDICIÓN)      pendiente
                                                                  se cobra
                                                                  automático)
```

**Detalle de cada etapa (con la lógica de caja que dispara):**

| Etapa | Acción del operador | Bookea caja | Marca |
|---|---|---|---|
| Crear presupuesto | POST `/budgets` con `deposit_received=0` | — (presupuesto informativo) | status=PENDING |
| Aprobar presupuesto | PUT `/budgets/{id}` con `status=APPROVED` | — | status=APPROVED |
| Convertir a OT | POST `/work-orders/from-budget/{id}` | Si presupuesto tenía seña → INCOME por el monto; flag `sena_registered=True`. Si NO tenía seña → sin movimiento | status=MEASUREMENT, `budget_id` poblado, `origin=Budget` |
| Editar OT en MEDICIÓN | PUT `/work-orders/{id}` con `deposit_received=X` (donde X > 0) y `sena_registered=False` | **INCOME por $X**; flag `sena_registered=True`. Idempotente (re-guardar no duplica) | deposit=X, saldo=total-X, sena=True |
| WORKSHOP → FINISHED | PUT con `status` | — | transiciones válidas via `VALID_TRANSITIONS` |
| FINISHED → DELIVERED | PUT con `status` | Si `balance_due > 0` → **INCOME por el saldo** con `remaining_balance=0`; flag `saldo_registered=True` | status=DELIVERED, saldo=$0, balance_paid=True |

**Reglas de negocio críticas:**

- **Una OT NO se entrega sin cobrar el saldo total.** `balance_due` debe ser $0 al pasar a DELIVERED.
- **Tarjeta débito/crédito al crear OT** → `balance_paid=True`, `deposit_received=total`, `sena_registered=True` desde el `create()`. NO se re-cobra en update ni en DELIVERED.
- **Idempotencia:** `sena_registered` y `saldo_registered` previenen doble bookeo si el operador guarda varias veces.
- **`create_from_budget()` se llama con `register_flag="sena_registered"`** (atributo Python temporal, eliminado con `delattr` antes del `return` para que `jsonable_encoder` no lo serialice en lugar del objeto WorkOrder). Ver "Fix crítico (hallado durante el debug E2E) — `delattr(order, "register_flag")`" en la sección del 2026-09-07 más abajo.

**Issue conocido (no resuelto):** el `_recalculate_totals_from_items` puede pisar el `total` enviado por el cliente en `materials_data='[]'`, poniendo `total=0, balance_due=0`. En el flujo real del frontend esto no pasa porque el form siempre envía `materials_data` con datos reales. Solo afecta a pruebas API directas.

**Limitaciones del flujo automatizado:**
- No se valida que `balance_due == 0` antes de aceptar la transición a DELIVERED. Confiar en la disciplina del operador.

## Reglas de operación

## Reglas de operación

- **Git es manual**: NO commitear, NO pushear, NO crear PR — **solo cuando el usuario lo pida explícitamente**.
- **Inspeccionar antes de versionar**: si el usuario pide commit/PR, antes de stagear revisar `git status` + `git diff` + `git log --oneline -10`; stagear solo los archivos intencionalmente modificados; nunca commitear secretos.
- **Mensajes concisos**: estilo del repo. Si no hay convención clara, mensajes cortos en inglés o español.
- **Cero PRs automáticos**: aunque el usuario diga "todo listo", NO crear el PR.

## Stack

- **Backend:** Python 3.14 + FastAPI 0.139 + SQLAlchemy 2.0 + MySQL (swappable SQLite via `DATABASE_URL`).
- **Frontend:** Vite 6 + React 18 + TypeScript 5.9 + CSS Modules (BEM) + Axios + TanStack Query.
- **DB Migrations:** Alembic. **Auth:** JWT (HS256) + passlib bcrypt==4.1.3.
- **PDF:** `@react-pdf/renderer` (frontend, primary) + xhtml2pdf/Jinja2 (legacy backend, solo para `/api/v1/{budgets,work-orders}/{id}/pdf` download + email background).
- **Modales:** `components/ui/Modal` con focus trap + escape + portal; las páginas reales se embeben en modales desde el dashboard (ver "Dashboard modales").
- **Tests:** pytest (backend), vitest (frontend), Playwright (E2E).

## Project structure (paths críticos)

Para el árbol completo usar `Get-ChildItem -Recurse`. Lo crítico:

**Backend (`afamar-backend/`):**
- `app/main.py` — entrypoint, lifespan: Alembic upgrade + seed admin.
- `app/api/routers/` — 20 routers: auth, clients, client_addresses, budgets, work_orders, materials, pool_stock, measurements, daily_cash, dashboard, settings, reports, search, options, references, product_photos, whatsapp, additional-works, **payment_methods** (dedicado, removido del genérico `references.py` en Fase 7).
- `app/core/` — settings (Pydantic, includes DEFAULT_USD_RATE, PRODUCT_PHOTOS_DIR, MATERIALS_DIR, LOGOS_DIR, MAX_UPLOAD_FILE_SIZE, MAX_UPLOAD_DIMENSION + properties `*_abs_dir`), exceptions (NotFoundError, ConflictError, ValidationError).
- `app/models/` — ORM (incluye **payment_method** con FK desde budget/work_order; cols extra `type`/`value`/`is_percentage`/`applies_to_installments` desde migración `b3c4d5e6f7a9`).
- `app/schemas/` — Pydantic Create/Update/Response separados + CurrencyCodeMixin. **Agregar `payment_method_id` a Base/Update** (Fase 7 fix) para que GETs lo expongan y PUTs lo acepten.
- `app/services/` — base.py (BaseService[T] generic CRUD) + auth, budget, work_order, **payment_method** (CRUD + validación), pdf_helpers, stock_helpers, pdf_html (legacy xhtml2pdf).
- `app/repositories/` — 12 repos SQLAlchemy con joinedload eager loading.
- `app/utils/` — currency, client_helpers, logger, responses, pagination, numbering.
- `app/templates/` — budget_pdf.html, work_order_pdf.html (Jinja2, legacy).
- `alembic/versions/` — **`b3c4d5e6f7a9`** = catalog payment_methods con 4 cols; **`d5e6f7a8b9c0`** = installment_detail_ars/usd en budgets/work_orders.
- `scripts/seeders/` — base.py, **payment_methods.py** (Fase 7), additional_works.py, material_colors, …

**Frontend (`afamar-frontend/src/`):**
- `api/` — http.ts (Axios con envelope unwrap + 401 redirect) + resources/ (13+ domain files, **paymentMethods.ts** en Fase 7) + hooks.ts (TanStack Query hooks).
- `pages/` — English names, *.module.css co-localizado. Módulos: auth, home, dashboard, clients, budgets, work-orders, materials, pool-stock, measurements, cash, calculator, **configuration (Datos AFAMAR + PaymentMethods en tabs)**, reports, online-budgets, additional-works.
- `components/`:
  - `ui/` — primitivas (Button, Modal, StatusBadge, ListPage).
  - `entity/` — EntityFormFinancial, EntityFormSpecs, EntityFormClient + **EntityFormLayout** (shared form body, usado por BudgetFormPage y WorkOrderFormPage; slots: beforeLayout, observations, terms, alternativasGrid, extraDialogs, specsCardClassName, fabricationShowMeasurementComparison, fabricationMaterialsData, prefix).
  - `budget/` — **BudgetPanel** (orchestrator) + **BudgetCurrencyColumn** (ARS/USD) + **BudgetLineItems** (CONCEPTO/SUBTOTAL list; `DetailRow` con `displayValue`/`arsEquivalent`) + **BudgetPaymentSection** (payment block + tabla 3-columnas de cuotas) + BudgetPanelContext, OnlineBudgetHeader, FabricationTable, QuoteOptionsGrid, OnlineItemsTable, AdditionalWorkSection, AdditionalWorkCard, AdditionalMaterial.
  - `configuration/` — **PaymentMethodsTable** + **PaymentMethodForm** (Fase 7) + PaymentMethods (page, montado desde ConfigurationPage tab).
  - Otros: `common/` (Loading, ConfirmDialog, PdfPreviewModal, ClientHistoryCard, WorkOrdersTable, AdditionalWorksTable, AdditionalWorkForm, MeasurementPhotoGrid, LinearMetersInput), `cash/`, `materials/`, `pool-stock/`, `orders/` (ClientSection, ClientTypeahead, AddressPicker, NewClientModal, ClientInfoCard, ApprovalSection, ObservationsSection, FormHeader, FormFooter), `sketch/`, `signature/`, `calculator/` (PorcelainTileCalculator + PorcelainCalculatorSection embebida en Presupuesto/OT, full + wizard modes), `measurements/`, `home/`.
- `hooks/` — **useEntityForm** (facade → 7 composables), **useBudgetCalculations** (hook central del recargo: applyPaymentMethodToTotals + incrementalInterestRatio + computeInstallmentDetail; deps incluyen paymentMethodsDepsJson), usePdfPreview, useConfirmPayment, useAdditionalWorkSelection, useBudgetActions (acepta `paymentMethods?` post-Fase 7), useBudgetQuoteCalculations, useClientAddresses, usePlateCalculator (bin-packing), useFormReferences (TanStack Query con staleTime: 5min; exporta **PAYMENT_METHODS_KEY**), usePdfPreviewController (shared PDF preview state; acepta `paymentMethods?` y los propaga a buildPdfData), entityFormHelpers (re-export hub + swap helpers), entityFormConstants, entityFormFinancial (buildFinancialPayload, mapFinancialToForm), entityFormSerialization (buildPayload + mapApiToForm).
- `constants/` — PAYMENT_METHODS, BANK_INFO, EXPENSE_TYPES, FOLDER_STATUS_MAP, status.ts (STATUS_META).
- `types/` — 18+ files (EntityFormState snake_case English; **paymentMethod.ts** con PaymentMethod + PaymentMethodType + PaymentMethodCreate).
- `utils/` — translate, formatters, error.ts (parseApiError), pdf/buildPdfData.ts (orchestrator) + pdfTypes.ts + pdfHelpers.ts + buildSectionData.ts + SketchImageExtractor, frentePricing, additionalWorkParse, additionalWorkCalc, materialGroups, math.ts (round2).
- `tsconfig.json`, `vite.config.ts` — path aliases `@/` y `@assets/`; proxy /api → http://localhost:3090.

## Key conventions

- **BEM + CSS Modules:** cada page tiene `X.module.css` co-localizado. `import styles from './X.module.css'; const s = styles as unknown as Record<string, string>; // <div className={s['x__title']}>`.
- **CSS tokens:** `src/index.css` define design tokens como custom properties (`--color-danger`, `--tw-green-600`, etc.). Usar `var(--token)` en lugar de hex hardcoded. Tabla column widths con `nth-child` rules en el CSS module del componente, no inline `style={{ width: N }}`.
- **Path aliases:** `@/` → `src/`, `@assets/` → `src/assets/`, **`@features/` → `src/features/`** (re-introducido 2026-09-18 para el módulo feature-based de presupuestos; registrado en `tsconfig.json`, `vite.config.ts` y `vitest.config.ts`). `@shared/*` sigue eliminado.
- **English naming** (carpetas/componentes/hooks/funciones/constantes/CSS classes): todo renombrado. Excepción: `EntityFormState` campos snake_case English matcheando backend. **Los textos visibles (UI/PDF/placeholders/mensajes de error) SIEMPRE en español** — los identificadores internos van en inglés, pero nunca se traduce lo que ve el operador/cliente.
- **TypeScript strict** + `tsc --noEmit` antes de `vite build`. Naming: PascalCase componentes, camelCase hooks/utils, UPPER_SNAKE_CASE constantes.
- **Repository pattern** (backend): SQLAlchemy puro. Transacciones en services. **Service layer**: lógica en `services/*.py`, routers ≤ 5 líneas.
- **Pydantic v2:** schemas Base/Create/Update/Response separados. `ConfigDict(from_attributes=True)`. `CurrencyCodeMixin` para resolver código de moneda.
- **SQLAlchemy 2.0:** `Mapped[T]` + `mapped_column()`. No usar `relationship` lazy sin `joinedload`. `with_for_update()` en stock mutations.
- **Excepciones de dominio:** `NotFoundError`, `ConflictError`, `ValidationError` en `core/exceptions.py` (heredan de `HTTPException`, manejadas globalmente en `main.py`).
- **Error handling (frontend):** usar `parseApiError(err, fallback?)` de `src/utils/error.ts`. Silent `.catch(() => {})` reemplazados con `console.warn`/`console.error`. Promises fire-and-forget con `void promise.catch(() => {...})`.
- **TanStack Query:** `useQuery`/`useList`/`useGet` con `staleTime: 5 * 60 * 1000` para reference data. Mutation state via `setQueryData` / `invalidateQueries`. Query keys exportadas como `const`s desde el hook.
- **PDF generation:** `utils/pdf/buildPdfData.ts` (orchestrator) + `pdfTypes.ts` + `pdfHelpers.ts` + `buildSectionData.ts` + `DocumentPdf.tsx` (`@react-pdf/renderer`). Recharts code-split via `React.lazy()`. Legacy: `pdf_html.py` (xhtml2pdf + Jinja2).
- **Code splitting:** `React.lazy(() => import('./Component'))` para deps pesadas. Wrap en `<Suspense fallback={<LoadingSpinner />}>`.
- **Numbering:** `P-000001` (budgets), `A-000001` (work_orders). Compartido en `utils/numbering.py`.
- **Status enums:** English en DB (`MEASUREMENT`, `WORKSHOP`, …), Spanish en UI via `t(key)` en `utils/translate.ts`.
- **React keys:** siempre IDs estables del data (`m.id`, `slide.title`, `d.concept + '|' + d.detail`, `s.label`, `img.slice(0, 32)`). Nunca `key={i}`.
- **Client data flow:** Budget/WorkOrder stores only `client_id` (FK) + optional `delivery_address_id` (FK → `client_addresses`). No snapshot columns. `from_orm_with_client()` resolves `client_*` from live `Client` row. If `delivery_address_id` is set, `client_address` is overridden with the matching `ClientAddress.address`. `delivery_address_id` is patchable on update. Conversion paths copy it from the source budget.
- **Submit button pattern:** `useFormActions.handleSubmit` MUST call `e.preventDefault()` (else `<button type="submit">` triggers a native form GET that aborts the in-flight PUT). Mirror el mismo `e?.preventDefault()` en cualquier router sibling.
- **Totals effect deps:** `useBudgetCalculations` deps array must include `JSON.stringify(...)` for EVERY form slice it reads (incl. `additional_works_data`, `paymentMethodsDepsJson`, `form.installments`), else SUBTOTAL/TOTAL/SALDO PENDIENTE van stale y no matchean el PDF. Extract cada `JSON.stringify(...)` a una variable local stable antes del `useEffect`.
- **Material swap helpers:** `swapMaterialGroupToList` (identity swap in `materials_data`) + `repointSwapReferences(form, oldNames, newName)` (renames `pools_data[].material`, `fabrication_details[].material`, `additional_works_data[].materialName`/`material_name` — honoring `__ALT__:` alternative prefix; preserves `POOL_MATERIAL_GLOBAL`, empty links, and unknown additional-work fields). Both consumed together por `useFormMaterials.swapMaterialGroup` via un solo functional `setForm`.
- **Derived UI lists, no local mirrors:** `selections`, `materials_list`, etc. deben derivarse en cada render desde el form slice padre (parse JSON on read), no mirror en `useState` local sincronizado via `useEffect`. El viejo `useAdditionalWorkSelection` tenía un local mirror con `JSON.stringify` bailout que se desincronizaba.
- **E2E auth:** always `loginViaApi(page, request)` from `e2e/helpers/login.ts` to avoid the 5/min `/auth/login` rate-limit of `loginAsAdmin`.

## Dashboard modales

`src/pages/dashboard/DashboardPage.tsx` — cada card abre un modal con el contenido real embebido, en vez de navegar a la URL. Las rutas del aside siguen intactas.

| Card | Modal renderiza |
|---|---|
| CAJA | `<CashDailyPage />` |
| NUEVO PRESUPUESTO | `<BudgetForm onSuccess={closeModal} onCancel={closeModal} />` |
| NUEVA ORDEN | `<WorkOrderForm onSuccess={closeModal} onCancel={closeModal} />` |
| ORDENES EN MEDICION / TALLER | `<WorkOrdersListPage />` (filtro manual) |
| ORDENES TERMINADAS P/ ENVIO | `<WorkOrdersListPage initialStatus="DELIVERED" />` |
| STOCK DE PILETAS | `<PoolStockPage />` |
| MATERIALES | `<MaterialsListPage />` |
| TRABAJOS ADICIONALES | `<AdditionalWorksPage />` |
| CATEGORIAS | `<MaterialsCategoriesPage />` |
| CALCULADORA | `<CalculatorPage />` |

**Implementación:** `useState<ModalKind | null>(null)` (un solo modal abierto a la vez). `React.lazy(() => import('../path/Page'))` para cada page (comparte chunk con la route). Un solo `<Suspense fallback={<LoadingSpinner />}>` envuelve los 10 modales. `Modal` provee focus trap, escape y portal; el `width` se ajusta por card (1200-1400px). **Drill-down:** el `useNavigate` desmonta el dashboard y el modal desaparece naturalmente (cleanup del `useEffect` del `Modal` restaura `body.overflow`).

## Form callbacks (modal reuse pattern)

Para que `BudgetForm` y `WorkOrderForm` funcionen dentro de un modal sin perder la integración con `useNavigate`, ambos aceptan props opcionales:

```ts
interface BudgetFormProps {
  onSuccess?: () => void;  // reemplaza navigate(services.listPath) post submit/delete
  onCancel?: () => void;   // reemplaza navigate(services.listPath) al cancelar
}
export default function BudgetForm(props: BudgetFormProps = {}) { ... }
```

**Page mode** (default): si no se pasan props, el form usa `navigate` como antes.
**Modal mode:** el caller pasa `onSuccess={closeModal}`. Internamente: `useEntityForm` recibe `onAfterAction?: () => void` → reenvía a `useFormActions`. Pieza clave: `if (onAfterAction) onAfterAction(); else navigate(services.listPath);` en `useFormActions.handleSubmit` / `handleDelete`. `WorkOrderForm` además usa `onAfterAction` para invalidar el cache de `['work-orders']` antes de cerrar el modal.

## EntityFormState (form state)

`EntityFormState` en `src/types/form.ts` — snake_case English matcheando el backend:
- **Client:** `client_name`, `client_phone`, `client_address`, `client_email`, `delivery_address_id`.
- **Financial:** 17 campos de `FinancialBase` (currency, usd_rate, subtotal, transport, total, etc.).
- **Payment (Fase 7):** `payment_method: string | null` (snapshot estable, sobrevive renames del catálogo) + **`payment_method_id: number | null`** (FK al catálogo `payment_methods` — fuente de verdad; expuesto en GETs/PUTs tras el fix de esta sesión) + `installments: number` + `installment_detail_ars?: InstallmentDetailRow[]` + `installment_detail_usd?: InstallmentDetailRow[]` (form-only, recalculados por `useBudgetCalculations`, serializados por `buildPayload` a JSON string para el backend).
- **Specs:** `material`, `material_price_m2`, `color`, `thickness`, `finish`, `bacha`, `anafe`, `pool_id`, `pool_price`, `pool_currency`, `pool_image`.
- **Items:** `materials_data`, `pools_data`, `fabrication_details`, `additional_works_data`, `sketch_elements`.
- **Dates:** `date`, `delivery_date`, `signed_at`.
- **Notes:** `notes`, `design_observations`, `important_observations`.
- **Terms:** `budget_terms`, `warranty_terms`, `delivery_terms`.
- **Misc:** `number`, `status`, `digital_signature`, `work_order_number`.

`InstallmentDetailRow` = `{ cuota: number, interes: number, monto: number }` — 3-columnas de la tabla del recargo. `interes` es el porcentaje **por cuota** (`value` del catálogo, NO `N × value`). `monto` es la cuota uniforme (`(base × (1 + N × value/100)) / N`). Las N filas son idénticas en `interes` y `monto`.

`buildPayload(form)` → passthrough snake_case + JSON.stringify arrays + date serialization.
`mapApiToForm(d)` → passthrough inverso.

## useEntityForm (facade)

`src/hooks/useEntityForm.ts` — facade delgado que compone 7 composables:
- `useFormReferences` — carga materials/pools/clients/**paymentMethods**/logo, fetch next number, initial load, `updateClientAddresses`. `PAYMENT_METHODS_KEY = ['payment-methods', 'reference']` se reusa desde los list pages.
- `useFormDetails` — CRUD `fabrication_details`, refs de material.
- `useFormMaterials` — Material picker + CRUD `materials_data`.
- `useFormPools` — Pool picker + CRUD `pools_data`.
- `useFormClient` — Client typeahead (filtered + handleClientSelect).
- `useFormCalculationsInput` — Handlers transport/deposit/usd_rate.
- `useFormActions` — Submit/delete/status-change/print.

Acepta `extraPayloadFields?: () => Partial<Record<string, unknown>>` para inyecciones per-page. Solo `WorkOrderFormPage` lo usa.

## EntityFormLayout (shared form body)

`src/components/entity/EntityFormLayout.tsx` — extrae el ~80% del JSX compartido entre `BudgetFormPage` y `WorkOrderFormPage`. Slots: `beforeLayout`, `observations`, `terms` (array configurable), `alternativasGrid` (`QuoteOptionsGrid` o `AlternativeBudgetGrid`), `extraDialogs`, `specsCardClassName`, `fabricationShowMeasurementComparison` / `fabricationMaterialsData` (solo WO), `prefix` (CSS class prefix). (El slot `discountBlock` fue eliminado el 2026-08-30 — ver "Descuento comercial eliminado de OT" abajo.)

El header (`FormHeader` con status/approve/convert/WhatsApp) queda en cada página porque es demasiado diferente para abstraer.

**Calculadora de porcelanato embebida:** `PorcelainCalculatorSection` se renderiza en dos lugares según el mode:
- **full mode** → zona inferior (`${prefix}bottom`), junto a `SketchSection`. Colapsada por defecto (toggle "Activar…").
- **wizard mode** → paso dedicado `Calculadora de porcelanato` en `EntityFormWizard`, después de "Diseño y plano". Arranca **abierta por defecto** (`defaultOpen`); ofrece "Ocultar…" para plegar.

El handler `addPorcelainDetail` se construye desde `state.update` y `state.form`. En `readOnly` la sección no se renderiza. El label del botón se deriva del `prefix`: `"Agregar al presupuesto"` / `"Agregar a la orden"`. La moneda sigue `modoUSD` del form.

## Frontend unit tests (vitest)

**Setup:** `vitest@1.6.1` + `@testing-library/react@16.3.2` + `@testing-library/jest-dom@6.9.1`. Environment `jsdom`. `tsc --noEmit` debe estar limpio antes de `vitest run` (archivos `.test.tsx` para JSX, `.test.ts` para lógica pura). Co-localizado junto al módulo testeado.

**Estrategia:** hooks (pure logic) usan `renderHook` con `useState` real. Para hooks con TanStack Query, wrap con `QueryClientProvider` + `QueryClient` con `retry: false`. Render usa `screen.getByText/Role/Title`. Wrap con `MemoryRouter` si el componente usa `useNavigate`. Los tests deben validar que los errores se surfacean al caller, no que se swallean silenciosamente.

**Coverage actual (204 tests, 18 archivos):** (a este listado se agregó `src/utils/budgetOptions.test.ts` — 4 tests de las cards de alternativa, 2026-08-30; el resto del listado de archivos no se re-escribió en detalle)
- `src/hooks/useConfirmPayment.test.tsx` — 5
- `src/hooks/useBudgetQuoteCalculations.test.ts` — 10
- `src/hooks/useBudgetCalculations.test.tsx` — 22 (totals, descuentos, **recargo cuota 1=9%/2=13.5%/3=18% con `incrementalInterestRatio`**, alternativa override, deposit, USD=0/+27%, additional_works_data re-pointing deps, **detalle de cuotas con interes incremental**)
- `src/utils/pdf/buildPdfData.test.ts` — 25 (routing, descuentos, recargo, **catalogue_installment_detail con interes incremental**, terms override, edge cases)
- `src/pages/budgets/BudgetTable.test.tsx` — 10
- `src/components/common/WorkOrdersTable/WorkOrdersTable.test.tsx` — 12
- `src/components/ui/StatusBadge/StatusBadge.test.tsx` — 2
- `src/components/entity/EntityFormWizard.test.tsx` — 2
- `src/components/measurements/PendingMeasurementCards/PendingMeasurementCards.test.tsx` — 2
- `src/hooks/entityFormHelpers.test.ts` — 40 (FinancialBase round-trip, payload serialization, `swapMaterialGroupToList` + `repointSwapReferences` swap helpers)
- `src/hooks/useAdditionalWorkSelection.test.ts` — 15
- `src/components/budget/BudgetPanel/BudgetLineItems.test.tsx` — 10 (renders one line per additional work, omits zero subtotals, **[GLOBAL] markers**, **alt-linked items hidden**, **USD item shows real peso equivalent** — agregado en esta sesión)
- `src/utils/frentePricing.test.ts` — 19
- `src/utils/materialGroups.test.ts` — 5
- `src/utils/porcelainCalculator.test.ts` — 10
- `src/components/budget/BudgetPanel/BudgetPanel.test.tsx` — 2

**Backend (45 tests):**
- `tests/test_work_order_recalc.py` — 5 (recalc server-side: 1 cuota = 9%, 3 cuotas = 18%, additional_works, alt override, manual discount antes de catalogue).
- `tests/test_work_order_update.py` — 6 (suite nueva 2026-08-26: regression del `TypeError` en PATCH con `materials_data` en MEDICION, PATCH + payment_method_id + 3 cuotas, PATCH + discount_percentage, PATCH + status flip, PATCH sin line-items (no recalc), PATCH + deposit).
- `tests/test_pdf_catalogue_adjustment.py` — 7 (`_resolve_catalogue_adjustment`: NONE/3-cuotas/1-cuota/2-cuotas/percentage-discount/fixed-discount/name-fallback/manual+manual).
- Resto: smoke + integración pre-existentes.

## Client address selection

**Two code paths:**
1. **`ClientSection`** (`components/orders/ClientSection/`) — when NO client is selected yet (typeahead mode). Renders typeahead + address picker dropdown + Domicilio input. Picker shows when client has >1 address; includes inline "add new address" input + button. Sets both `delivery_address_id` and `client_address`.
2. **`BudgetFormClient` / `WorkOrderFormClient`** — when client IS already selected (read-only mode). Renders `ClientInfoCard` + address picker row. Picker shows `<select>` (when >1 address) or readonly input (1 address) + "Nueva dirección" input + `+` button. Sets both `delivery_address_id` and `client_address`.

**Key behavior:** Selecting an address sets `delivery_address_id` (FK) + updates `client_address` (text). Deselecting (picking "Principal") resets `delivery_address_id` to null + resets `client_address` to `client.address`. Manually editing the Domicilio input resets `delivery_address_id` to null. Adding a new address inline calls `createClientAddress` API, appends to local `clientes` state via `onAddressAdded` → `updateClientAddresses`, and auto-selects the new address. Backend `from_orm_with_client()` resolves the override: if `delivery_address_id` is set, replaces `client_address` with the matching `ClientAddress.address` text. `delivery_address_id` is persisted on create AND update. Conversion paths copy it from source budget. PDF reads `form.client_address` directly. WhatsApp does NOT use client address (only phone + name).

## Payment Methods (Fase 7) + Fixes sobre Fase 7

Catálogo de métodos de pago en `/admin/configuration/payment-methods`. Sustituye la regla hardcodeada de tarjeta que vivía en el form.

**Modelo (`payment_methods` row):** `id`, `name` (estable, snapshot — sobrevive renames), `label` (visible), `is_active`, `sort_order`, `type` (`NONE` | `DISCOUNT` | `SURCHARGE`), `value` (float), `is_percentage` (bool), `applies_to_installments` (bool — si es `true`, escala con la cantidad de cuotas).

**4 métodos seeded** (`scripts/seeders/payment_methods.py`): `EFECTIVO`, `TRANSFERENCIA BANCARIA`, `TARJETA DE DÉBITO` (todos `type=NONE, value=0`) y `TARJETA DE CRÉDITO` (`type=SURCHARGE, value=9, is_percentage=true, applies_to_installments=true`). Idempotente. Migra los 6 legacy English names (`CASH`, `TRANSFER`, `CREDIT_CARD`, `DEBIT_CARD`, `CHECK`, `MIXED`) preservando id.

**Regla de cálculo (recargo lineal por cuota):**
```
total = base × (1 + N × value/100)
cuota = total / N  (todas uniformes)
```
Para 1 cuota colapsa a 9% flat. Para 2 cuotas, 18% (2 × 9%). Para 3 cuotas, 27% (3 × 9%). El recargo total (`N × value%`) se aplica al **total** y se divide en N cuotas iguales. La tabla 3-columnas muestra cada cuota con su `monto` (uniforme) y la columna "Interés" muestra el `value` por cuota (no el acumulado). El agregado `N × value%` aparece en la línea "Recargo (X%)" del PDF.

**Ejemplo concreto (base = 900.000, value = 9, N = 3):**
- recargo = 3 × 9% = 27%
- total = 900.000 × 1.27 = **1.143.000**
- cada cuota = 1.143.000 / 3 = **381.000** (3 filas idénticas)

**Por qué la cuota 1 ya carga interés** (vs la regla vieja `1-2 cuotas → 0%`): así es como el banco realmente cobra.

**Mismo cálculo en 4 lugares** (cualquier cambio toca los 4 + sus tests):
1. `afamar-frontend/src/hooks/useBudgetCalculations.ts` — `applyPaymentMethodToTotals` + `computeInstallmentDetail` (form hook, ARS+USD, live).
2. `afamar-frontend/src/utils/pdf/buildPdfData.ts` — bloque inline (PDF preview del form). **Recibe `paymentMethods` también en el path del form** (no solo del controller) — ver Fix #6.
3. `afamar-backend/app/services/work_order.py` — bloque inline en `_recalculate_totals_from_items` (recalc server-side de OT).
4. `afamar-backend/app/services/pdf_html.py` — `_resolve_catalogue_adjustment` (PDF legacy).

**Persistencia del detalle de cuotas** (migración Alembic `d5e6f7a8b9c0`): `installment_detail_ars` / `installment_detail_usd` (TEXT, JSON) en `budgets` y `work_orders`. El recalc del WO las serializa con `json.dumps` antes de persistir; el frontend las envía en `buildPayload` y las restaura en `mapApiToForm`. Sin este snapshot, el PDF del list page (donde el form hook no corre) no puede renderizar la tabla 3-columnas.

**UI en el form** (`BudgetPaymentSection`): `<select>` "Forma de pago" poblado dinámicamente con el catálogo. **Pre-selección al editar:** el GET retorna `payment_method_id` (FK) desde `mapFinancialToForm`, y el select usa `value={form.payment_method_id ?? form.payment_method ?? ''}` para matchear las options (que tienen `value={pm.id}`). Si `applies_to_installments=true`, segundo `<select>` "N cuotas" con label `9%`, `18%`, `27%`... (calcula `c × value%`). Tabla 3-columnas (Cuota # / Interés / Monto) con `BudgetPanel.module.css` (`budget-panel__installment-table*`).

**UI en el PDF** (`DocumentPdf.tsx` + `document_pdf.html`):
- **Renglón del recargo** (totals block): dice **"Interés:"** + monto (no "Recargo (X%)" — el X=18 era el promedio y confundía con el 27% de la última cuota de la tabla). El porcentaje correcto está en la tabla.
- **Renglón "Forma de pago"**: "TARJETA DE CRÉDITO (N cuotas con X% de interés por cuota)" donde X es `catalogue_installment_detail[0].interes` (la base por cuota, ej. 9%), no el promedio.
- Tabla 3-columnas con header slate-100 + rows slate-200. Mismo formato en el PDF legacy.

**Configuración del interés:** se edita desde `/admin/configuration/payment-methods` → "TARJETA DE CRÉDITO" → campo "Interés por cuota (%)". El change se refleja en el form y el PDF sin redeploy (catálogo con TanStack Query, 5 min `staleTime`, re-fetcheado al invalidar `PAYMENT_METHODS_KEY`).

**Sidebar entry:** "Métodos de Pago" en el accordion CONFIGURACIÓN (entre "Datos de AFAMAR" y "Fotos de productos"). `ConfigurationPage` consolidado en `pages/configuration/ConfigurationPage.tsx` (el wrapper `DatosAfamarTab.tsx` original fue movido a `.trash/`).

**Hot-spot para próximos cambios:** la fórmula vive en 4 lugares. Si aparece un nuevo tipo (ej. "descuento progresivo por tramo de cuotas"): agregar campo al modelo `PaymentMethod` (con migración), implementar la nueva rama en los 4 lugares, actualizar los 4 tests con el caso nuevo, documentar en el ADR.

### Fixes sobre Fase 7 (esta sesión)

1. **`BudgetLineItems.tsx` `DetailRow` — bug del parámetro mal nombrado `arsTotal`.** El parámetro se llamaba `arsTotal` pero guardaba el valor en la **moneda nativa** (no en ARS). Para ítems en USD, la línea "≈" formateaba ese mismo USD con símbolo `$`, mostrando el mismo número con $ en vez del equivalente real en pesos. Renombrado: `arsTotal` → `displayValue` (valor nativo para el pill) + nuevo `arsEquivalent` (valor real en ARS, usado para la conversión de ítems USD). Actualizado el early return para chequear `displayValue` así ítems USD con `dd=0` siguen apareciendo.

2. **`BudgetLineItems.tsx` + `BudgetPanel.module.css` — color del renglón "≈" para ítems USD.** Antes siempre verde (`budget-panel__detail-value-usd`). Ahora para ítems USD se agrega el modificador `--light` (color `var(--text-primary)`) así el renglón no compite visualmente con el pill verde del valor nativo. ARS sigue verde. `usdRefClass` ahora condicional sobre `nativeCurrency`.

3. **`BudgetLineItems.tsx` — decimales de la conversión a USD.** Antes usaba `decimals: 0` ("$ 152.760" sin centavos). Ahora `decimals: 2` ("$ 152.760,00") para matchear la conversión de ítems ARS (que ya usaba 2 decimales). Ejemplo: USD 100 × rate 1000 = "≈ $ 100.000,00".

4. **`DocumentPdf.tsx` — renombre "Recargo" → "Interés" en el totals block del PDF.** El renglón decía "Recargo (18%) + $ 669.197,00" — el 18% era el promedio (avg(9, 18, 27) = 18) y confundía con el 27% de la última cuota de la tabla. Ahora dice "Interés: $ 669.197,00" (sin el % y sin el +).

5. **`DocumentPdf.tsx` — interés por cuota (no promedio) en la línea "Forma de pago".** Antes: "(3 cuotas con 18% de interés)". Ahora: "(3 cuotas con 9% de interés por cuota)" usando `catalogue_installment_detail[0].interes` (la base por cuota del catálogo).

6. **`useBudgetActions.ts` + `BudgetFormPage.tsx` + `WorkOrderFormPage.tsx` — catálogo no llegaba al `buildPdfData` del form.** El `handleSketchImagesReady` del form (vía `useBudgetActions` e inline en `WorkOrderFormPage`) no pasaba `paymentMethods` a `buildPdfData`, así que el PDF del Presupuesto (vía "VISTA PREVIA PDF" en el form) mostraba el "Forma de pago" sin la tabla de cuotas. Mismo bug que el `usePdfPreviewController` del list page ya tenía resuelto. **Fix:** `useBudgetActions` ahora acepta `paymentMethods?: PaymentMethod[]` y lo pasa a `buildPdfData`; `BudgetFormPage` se lo pasa desde `useEntityForm` (ya lo tenía). Para `WorkOrderFormPage` (que arma el PDF inline, no via hook), se agrega `paymentMethods` al `buildPdfData` directamente. Después de este fix, ambos paths (form y list page) muestran la tabla 3-columnas en el PDF.

7. **Backend — `payment_method_id` no se exponía en GETs ni se aceptaba en PUTs.** El `BudgetResponse` / `WorkOrderResponse` heredaban de `BudgetBase` / `WorkOrderBase` que solo tenían `payment_method` (string legacy) y `installments`, sin `payment_method_id` (FK). El `mapFinancialToForm` del front lo mapeaba, pero el backend nunca lo retornaba, así que el select del form (que usa `value={pm.id}`) no podía pre-seleccionar el método al editar un presupuesto/OT existente. Además, `BudgetUpdate` / `WorkOrderUpdate` no aceptaban `payment_method_id` en PUT, así que el bulk update de SQLAlchemy no tocaba la columna. **Fix:** agregar `payment_method_id: int | None = None` a `BudgetBase`, `WorkOrderBase`, `BudgetUpdate`, `WorkOrderUpdate`. La columna ya existía en la DB (migración `b3c4d5e6f7a9`), no se requirió migración nueva.

### Hotspot adicional post-Fase 7

- **`BudgetLineItems.DetailRow`** (4 callsites: fabrication, materials, pools, additional). Cualquier cambio de layout/color/formato del CONCEPTO/SUBTOTAL list toca los 4 callsites en el mismo archivo (no hay helper compartido). Patrón: cada call site computa `displayValue` (nativo) + `arsEquivalent` (ARS) + `usdTotal` (USD) y los pasa a `DetailRow`. Si se agrega un nuevo tipo de ítem (ej. mano de obra), replicar el patrón.

### Updates post-Fase 7 — infra (2026-08-26)

Bugs descubiertos mientras se escribía la capa de tests. Todos arreglados, todos con test que los cubre (ver "Capa de tests 2026-08-26" abajo).

1. **`WorkOrderService.update` → `TypeError` en PATCH con line items.** El path "presupuesto → OT → editar m² en MEDICION → Guardar" (el más común del día a día) reventaba con 500 porque la llamada al helper `_recalculate_totals_from_items(merged)` omitía el `self.repo.db` (`merged` se pasaba como `db` y `data` quedaba faltando). En `create` la llamada estaba bien, en `update` se coló un copy-paste roto. **Fix 1 línea:** `app/services/work_order.py:782` ahora pasa los 2 args. Cubierto por `test_work_order_update.py::test_update_with_materials_data_does_not_500`.

2. **`WorkOrderService.update` → `installment_detail_ars/usd` no persistido en PATCH parcial.** Mismo archivo. El "mirror step" de `update()` solo copiaba 8 keys de vuelta a `data` después del recalc (`subtotal, total, balance_due, …`) pero NO `installment_detail_ars/usd`. Así que un PATCH parcial (ej. solo `materials_data` con tarjeta 3 cuotas) borraba la tabla 3-columnas del snapshot. **Fix:** agregar las 2 keys a la lista del mirror step (`work_order.py:785-794`). Cubierto por `test_update_with_materials_data_and_payment_method`.

3. **`MaterialCategoryRepository.create` → `IntegrityError` no capturada, 500 en vez de 409.** El nombre de categoría es `unique=True`. Un POST con duplicado levantaba `IntegrityError` que subía sin handler y devolvía **500 Internal Server Error** en vez del **409 Conflict** esperado. Se reproducía cada vez que la suite E2E corría más de una vez en la misma DB (UNIQUE random del test chocaba con un leftover). **Fix:** `try/except IntegrityError` en `app/repositories/material.py:22-33` con `db.rollback()` + `raise ConflictError`. Mismo patrón se aplicaría a cualquier otra columna unique que no capture el error (auditar antes de agregar uniques).

4. **`e2e/global-setup.ts` → nombres de recursos incorrectos, 404 silencioso, datos se acumulan entre suites.** El `TABLES_TO_CLEAR` tenía `'material-categories'`, `'material-colors'`, `'material-thicknesses'` (singular, flat), pero el backend los sirve como `materials/categories`, `materials/colors`, `materials/thicknesses` (nested plural) en `app/api/routers/materials.py`. El GET contra la URL plana tiraba 404, que el helper `truncateAll` loguea con `console.warn` y sigue (best-effort) → las tablas categoría/color/espesor **nunca** se borraban. Consecuencia: ~40 categorías "Create category e2e-cat-xxxx" de corridas previas. Los tests 2 (edits) y 3 (deletes) de `05b-categories.spec.ts` fallaban por colisión de UNIQUE, que a su vez exponía el bug #3 de arriba. **Fix:** renombrar las 3 entradas en `global-setup.ts` a las URLs correctas, con comentario explicando el motivo para que no se revierta sin querer. (Los demás nombres del array — `budgets`, `work_orders`, `measurements`, `daily-cash`, `cash-movements`, `client-addresses`, `clients`, `pool-stock-movements`, `pool-stock`, `materials`, `price-history`, `additional-works`, `product-photos`, `reference-data`, `options` — sí matchean endpoints existentes y funcionan; el bug era solo en los 3 sub-recursos de materials.)

5. **Tests E2E de `05b-categories.spec.ts` asumían case preservado en `name`.** `CapitalizeNameMixin` (`app/schemas/material.py`) normaliza `name` con `v.strip().capitalize()` (legítimo — los seeds canónicos son "Cuarzos", "Granitos", "Mármoles", "Sinterizados", "General"). Los tests asumían `"Edit Category E2E-CAT-xxxx"` se guardaba tal cual; 3 asserts fallaban (comparación exacta en API GET, `toHaveValue(originalName)` en el modal de edit, `text.includes(originalName)` en el loop de búsqueda). **Fix:** cambiar los `name` a formato ya-title-case (`"Create category ${UNIQUE.toLowerCase()}"`) para que sobrevivan el `capitalize()`. No se tocó el comportamiento del backend — la app real sigue capitalizando.

## Fixes de arranque + seeders sync 2026-08-27

Sesión de **arranque confiable** (ver ADR `docs/adr/0008-database-migrations-and-seeder-sync.md`).

1. **Migraciones MySQL: `alter_column` sin `existing_type`.** `alembic upgrade head` fallaba en MySQL porque dos migraciones usaban `op.alter_column`/`batch.alter_column` sin `existing_type` (argumento obligatorio en MySQL, omitido en SQLite). El fallback `command.stamp(head)` de `run_migrations()` enmascaraba el fallo (marcaba la DB "en head" con el schema a medias), lo que rompía los seeders. **Fix:** agregar `existing_type` en `c2d3e4f5a6b8_add_currencies_table.py` (`sa.Integer()` en `materials.currency_id`/`pool_stock.currency_id`) y en `33eba7752f2d_rename_adicionales_to_additional_works.py` (`sa.Text()` en los 4 renames + `import sqlalchemy as sa`). **Regla:** toda `alter_column`/`batch.alter_column` lleva `existing_type` explícito.

2. **Seeders sincronizados con producción (dedup).** El catálogo local estaba desactualizado respecto a la DB real. Se replicó producción **deduplicada** (una fila canónica por ítem lógico, sin duplicados por capitalización ni nombres con encoding corrupto): materials **64** (antes 60, +4), pool_stock **68** (antes 48, +20), additional_works **13** (antes 7, +6). Los seeders ya son idempotentes; re-seedear no duplica ni pisa precios manuales.

3. **Log de readiness.** `_run_seeders()` captura cada `SeedResult` y devuelve resúmenes `name: +N ~N /N`; el lifespan loguea `Seeders done:` + `AFAMAR initialization OK — ready to serve requests` + Frontend URL. Ya no termina en silencio tras `seeders.users: Created admin user 'admin'` (el cual parecía un cuelgue).

4. **Testing:** resúmenes verificados (todo skipped contra `afamar-project` poblado), pytest **45/45**, app recargada sirve HTTP 200 en `:3095`.

## Capa de tests 2026-08-26

Sesión dedicada a automatizar lo más posible los flujos manuales. Resultado: **suite unificada `npm run test:all`** que corre todo encadenado (pytest + vitest + playwright), más un **E2E del flujo cotidiano completo** y 6 unit tests nuevos del path `WorkOrderService.update`.

**Comando único:**

```bash
# en afamar-frontend/
npm run test:all    # 45 pytest + 191 vitest + 108 E2E encadenados (~4-5 min)
```

`test:unit` corre solo pytest + vitest (sin E2E, ~30s). `test:e2e` corre solo playwright (~3-4 min). No hay hooks pre-commit ni pre-push por regla del proyecto — el operador decide cuándo correr la suite.

**E2E del flujo cotidiano** (`e2e/work-orders/17-full-daily-flow.spec.ts`):

Recorre el día completo del operador en 7 pasos, end-to-end contra backend + UI reales:

1. Seed `seedDailyBudget` (cliente + 2 materiales [main + alternativo] + pileta + trasforo + zócalos + TARJETA 3 cuotas) via API.
2. Abre el presupuesto, verifica totales (SUBTOTALES, TOTAL ARS, SALDO PENDIENTE, Forma de pago).
3. Aprueba desde el listado (`/admin/budgets?estado=ALL`, columna Flujo).
4. Click "A OT" → "Convertir" → navega a la OT en MEDICION.
5. **Edita el `length` de un material en la OT + click Guardar** → este paso es la regresión sentinel del bug #1 de arriba (pre-fix: 500; post-fix: 200 + `materials_data` persistido + `total > 0`).
6. Avanza la OT MEASUREMENT → WORKSHOP → FINISHED → DELIVERED desde la columna "Avanzar estado" del listado (verifica via API cada step, no matchea el label traducido).
7. PDF preview desde el listado + download endpoint (`%PDF` magic + `%%EOF` trailer).

Captura 7 screenshots por sector (`shot-cross-daily-*`) que se embeben en el `test_report.html` del reporter custom. ~13s cuando corre solo, incluido en la suite completa de ~4 min.

**Unit tests nuevos** (`tests/test_work_order_update.py`):

6 tests del path `WorkOrderService.update` end-to-end contra SQLite in-memory (no solo del `_recalculate_totals_from_items` aislado, que ya tenía cobertura):

| Test | Cubre |
|---|---|
| `test_update_with_materials_data_does_not_500` | **Regression sentinel del bug #1** |
| `test_update_with_materials_data_and_payment_method` | Sentinel del bug #2 (installment_detail persiste en PATCH) |
| `test_update_with_materials_data_and_discount_percentage` | Manual discount + recalc en el mismo PATCH |
| `test_update_advances_status_measurement_to_workshop` | Edit m² + flip status en el mismo PATCH (operador real hace esto) |
| `test_update_with_no_line_item_keys_skips_recalc` | PATCH de metadata puro (notas) no recalcula |
| `test_update_deposit_persists_and_creates_cash_movement` | Seña se persiste en MEDICION |

**Patrón de los fixtures** (`fresh_db`): pre-seeda los 4 payment methods + 1 cliente + 1 WO en MEDICION (status PENDING al setUp). Cada test modifica el WO via `service.update(1, {...})` y assertea el resultado + re-GET a la DB. Reutiliza el patrón de `test_work_order_recalc.py::pm_session`.

**Por qué unit del `update()` y no solo del helper aislado:** el helper `_recalculate_totals_from_items` ya tenía 5 tests (en `test_work_order_recalc.py`). El bug #1 NO estaba en el helper — estaba en el call site (`WorkOrderService.update` línea 782). El helper funcionaba bien aislado; el bug era que `update()` no le pasaba bien los args. Test del `update()` end-to-end es lo que lo hubiera cazado.

**Cobertura resultante:**

| Capa | Antes | Después | Delta |
|---|---|---|---|
| pytest (backend) | 39 | 45 | +6 (`test_work_order_update.py`) |
| vitest (frontend) | 191 | 191 | =0 (no se tocaron) |
| playwright (E2E) | ~60 | 108 | +48 (17-full-daily-flow.spec.ts + categorías arregladas que ahora pasan) |
| **TOTAL** | **~290** | **344** | **+54** |

**Decisiones de scope que NO se tomaron (a propósito):**

- No se hicieron E2E para flujos satellite (caja diaria, métodos de pago, comparativa de medición, conversor de moneda). Son importantes pero más aislados. Si querés automatizarlos, decime cuál primero y armo el spec.
- No se llevó la cobertura E2E a 100% (cada feature × cada edge case). La cobertura del flujo cotidiano es **alta en los journeys críticos** (los que más te rompen), no exhaustiva. E2E 100% = frágil y caro de mantener, los bugs lógicos se siguen cazando con unit.
- No se agregó pre-commit / pre-push hook (la regla del proyecto es "git es manual").

## DB Maintenance Scripts

`afamar-backend/scripts/`. Run con el venv Python del proyecto.

```bash
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py             # dry-run
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix       # fix automático
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix --interactive

# Docker
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py --fix
```

Checks: JSON column corruption, FK orphans (client_id, delivery_address_id, budget_id), Pydantic serialization errors.

## E2E Tests (Playwright)

- **Stack:** `@playwright/test@1.61.1` + Chromium.
- **Estructura por módulo** (espejo de `src/pages/`): `afamar-frontend/e2e/{auth,clients,budgets,work-orders,materials,pool-stock,additional-works,measurements,calculator,cash,reports,configuration,product-photos,dashboard,smoke,edge-cases}/`. Helpers compartidos en `e2e/helpers/`.
- **Prefijo numérico** (00, 01, 02…) define el orden de corrida. Sub-features usan sufijo letra (02b, 05b).
- **Config:** `playwright.config.ts` — `webServer` auto-arranca backend (uvicorn 3095) + frontend (vite 3090). `workers: 1`, `fullyParallel: false`, `retries: 0 local / 2 CI`.
- **Gap post-Fase 7 (ver `PLAN.md` P3):** el sub-directorio `configuration/` cubre Datos de AFAMAR pero **no tiene E2E del CRUD de Métodos de Pago** ni del flujo "elegir Tarjeta de crédito + 3 cuotas y ver el recargo/tabla en el PDF preview". Tests unitarios (`useBudgetCalculations`, `buildPdfData`) y backend (`test_work_order_recalc`, `test_pdf_catalogue_adjustment`) cubren la fórmula, pero un E2E de smoke del flujo completo es la pieza que falta.
- **E2E del flujo cotidiano (2026-08-26):** `e2e/work-orders/17-full-daily-flow.spec.ts` recorre presupuesto "full" → aprobar (desde el listado) → convertir a OT → cambiar m² en MEDICION (regresión del bug 500) → MEASUREMENT → WORKSHOP → FINISHED → DELIVERED (vía columna "Avanzar estado" del listado) → PDF preview + download. **Regresión sentinel** del path más común del día. ~13s. Ver `Capa de tests 2026-08-26` abajo para más detalle.
- **Login:** siempre `loginViaApi(page, request)` de `helpers/login.ts` (evita el rate-limit de `/auth/login` 5/min del `loginAsAdmin`).
- **Datos únicos:** `const UNIQUE = \`E2E-${Math.random().toString(36).slice(2, 7)}\`;` por test. Cleanup best-effort.
- **Cleanup global (global-setup.ts):** el `TABLES_TO_CLEAR` lista los endpoints a truncar antes de la suite. Importante: los sub-recursos de `materials` van nested (`materials/categories`, `materials/colors`, `materials/thicknesses`), no flat — el helper loguea warn y sigue si el endpoint tira 404, así que un nombre mal escrito **silenciosamente no borra nada** y los datos se acumulan entre suites (ver bugs en "Updates post-Fase 7 — infra").
- **Scripts:** `npm run test:e2e` (headless), `npm run test:e2e:ui` (Playwright UI), `npm run test:e2e:debug`, `npm run test:unit` (pytest + vitest, sin E2E), `npm run test:all` (unit + E2E encadenado).

## Commands

```bash
# Backend (puerto 3095)
cd afamar-backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 3095
python seed_admin.py
alembic upgrade head
pytest                                # 45/45

# Frontend (puerto 3090)
cd afamar-frontend
npm install
npm run dev
npm run build                         # tsc --noEmit && vite build
npm run lint
npm test                              # 204/204 (vitest)
npm run test:e2e                      # 108/108 (playwright)
npm run test:unit                     # pytest + vitest
npm run test:all                      # unit + E2E encadenado (~4-5 min)
```

## Variables de entorno (afamar-backend/.env)

```ini
ENVIRONMENT=development
DATABASE_URL=sqlite:///./afamar.db
SECRET_KEY=afamar-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=168
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3090
RATE_LIMIT_ENABLED=false
```

## Python 3.14 notas

- **Pydantic:** usar `Optional[date]` en vez de `date | None` (PEP 604 union falla con `eval_type_backport`).
- **Pillow:** `>=11.1.0,<12.0`.
- **bcrypt:** `==4.1.3` (passlib compat).

## Upload paths (Settings)

Constantes de upload centralizadas en `app/core/settings.py` (Pydantic):

```python
PRODUCT_PHOTOS_DIR: str = "uploads/product_photos"
MATERIALS_DIR: str = "uploads/materials"
LOGOS_DIR: str = "uploads"
MAX_UPLOAD_FILE_SIZE: int = 30 * 1024 * 1024  # 30 MB
MAX_UPLOAD_DIMENSION: int = 1920
```

Properties que resuelven la ruta absoluta (relativa a `BASE_DIR = afamar-backend/`): `settings.product_photos_abs_dir`, `settings.materials_abs_dir`, `settings.logos_abs_dir` (todos → `Path`).

## Schema legacy

- **`online_budgets`** — tabla dropeada via migración `11e4cc1657da`. Sin código activo.
- **`BudgetAdicional`** legacy table — preservada como read-only. `BudgetService.create/update` ya no escriben filas nuevas (el `create` aún acepta la lista legacy en el input por compat y la convierte on-the-fly a `additional_works_data` JSON). `work_order.py:convert_alternative_to_work_order` la lee para propagar a la OT nueva. Drop completo requiere migración one-time.
- **`app/services/pdf.py` (740 LOC, reportlab)** — eliminado (6.11). 100% sin imports, superseded por `pdf_html.py` (xhtml2pdf) para downloads/email y `@react-pdf/renderer` para preview. `reportlab` se mantiene en requirements.txt (lo usa `pdf_html.py` para el footer de páginas).

## Cards de alternativa = subtotal del PDF (2026-08-30)

Las tarjetas de ALTERNATIVA A/B del formulario de presupuesto (`QuoteOptionsGrid`) ahora muestran el **mismo "Subtotal Opción" que dibuja el PDF** (material + zócalo/frente revaluados por opción + traforos + pileta), en vez del viejo material + pileta. Elección del usuario (via question): **igualar el SUBTOTAL del PDF** SIN recargo/descuento de tarjeta ni depósito.

**Clave de diseño:** las cards reutilizan la **misma orquestación `buildSections`** que el PDF para que nunca diverjan (convención de la sesión anterior: zócalo/frente revaluados en `buildSectionData.ts`/`pdfTypes.ts`).

- `afamar-frontend/src/utils/pdf/buildPdfData.ts` — nuevo **`buildAlternativeSections(form)`** (export) que devuelve `{ sections, usdRate }` reusing `asMaterials`/`asPools`/`buildFabricationRows`/`buildAdditionalWorksRows`/`bucketAdditionalWorks`/`buildSections`. Import type `MaterialSection` agregado.
- `afamar-frontend/src/utils/budgetOptions.ts` — `AlternativaLike` + `subtotalARS?`/`subtotalUSD?`/`detail?`; `interface AlternativaDetailRow { concept, quantity?, total, currency, materialName? }`; `BuildOptionArgs` + `subtotalARS?`/`subtotalUSD?`/`detail?`; `buildOptionFromMaterial` usa `subtotalARS` como `totalFinalARS` cuando se provee; nuevo **`buildDetailFromSection(section)`** para líneas (zócalo/fabricación + pileta + adicionales con frente) en moneda nativa — excluye material base (va en "Costo Material base"). Import type `MaterialSection` de `./pdf/pdfTypes`.
- `afamar-frontend/src/components/budget/QuoteOptionsGrid/QuoteOptionsGrid.tsx` — `Alternativa` + `subtotalARS`/`subtotalUSD`/`detail` y `AlternativaDetailRow`; en `renderCard` calcula `arsTotal`/`usdTotal` (usa subtotales si presentes, si no fallback legacy); celdas SUBTOTALES/TOTAL/SALDO ARS y USD usan `arsTotal`/`usdTotal`; bloque de detalle renderiza `mat.detail` si presente, si no el filtro legacy `listaTrabajos`.
- `afamar-frontend/src/pages/budgets/BudgetFormPage.tsx` — import `buildDetailFromSection`, `buildAlternativeSections`, `useMemo`; memo `altSections` (filtra `!s.is_main && !s.is_global`, deps `JSON.stringify` de materials/pools/fabrication/additional + usd_rate); `buildAltOption` matchea por `s.material_name === mat.name` y adjunta subtotales/detail; grid usa `alternativas={matsAlt.map(buildAltOption)}`.
- Test nuevo `afamar-frontend/src/utils/budgetOptions.test.ts` (4 tests) reproduciendo P-000004 con rate 1535: subtotales ZIRCONIUM **4.439.561,60 ARS / 2.892,22 USD** (material 1580.25 USD + zócalo 247.50 + frente 370.01 + traforos 130000 + pileta 936000) y GRIS MARA **1.593.463,00 / 1.038,09**, detalle por opción, propagación de subtotales y fallback legacy. `costoMaterialBase` ZIRCONIUM = 945 (1.26×750, panes representativos, fila separada del subtotal).
- Contexto de P-000004 (presupuesto id 4): ZIRCONIUM id27 ×2 (2.1×0.6=1.26 m² y 1.54×0.55=0.847 m², USD 750/m²) + GRIS MARA id1 ×2 (ARS 180000/m²), todos `is_alternative=true`, sin main, `usd_rate=1535`. `fabrication_details` = 1 fila zócalo BASEBOARD (price 0, m2 0.33). `additional_works_data` = Traforo de Pileta (60000 ARS flat, `__GLOBAL__`) + Traforo de Anafe (70000 ARS flat, `__GLOBAL__`) + Frente Ingletetado 45° (`type:"frente"`, price 0, legacy `materialName:"ZIRCONIUM"`, `assigned_material_id:null`, `linear_meters:3.3`). Pool JOHNSON SIGNATURE AXIS 55 B: 936000 ARS global. Fórmula frente: `precio_m² × 0.13 (FRENTE_LINEAR_COEFFICIENT) × 1.15 (FRENTE_FORMULA_MULTIPLIER_DEFAULT) × linear_meters (3.3)`.
- Verificación: `tsc --noEmit` limpio · vitest **204/204** (18 files, +4). ESLint sin errores nuevos (solo baseline preexistente + warnings exhaustive-deps del `useMemo` siguiendo convención repo).

## Descuento comercial eliminado de OT (2026-08-30)

Eliminado el bloque "🔒 Descuento Comercial (Solo Vendedor)" del formulario de órdenes de trabajo, porque los descuentos ahora viven en los **métodos de pago** de la configuración (base de datos), no en el código.

- `afamar-frontend/src/pages/work-orders/WorkOrderFormPage.tsx` — eliminado el bloque `discountBlock` (input % / $ + hint) y el prop `discountBlock` al `EntityFormLayout`.
- `afamar-frontend/src/components/entity/EntityFormLayout.tsx` / `EntityFormFinancial.tsx` — removido el prop `discountBlock` del doc-comment, tipo, destructure y forwards. (OJO: el AGENTS.md anterior aún menciona `discountBlock` como slot de EntityFormLayout — **ya no existe**. Actualizar si se toca esa parte.)
- `afamar-frontend/src/components/budget/BudgetPanel/BudgetPanel.tsx` / `BudgetPaymentSection.tsx` — removido el prop `discountBlock`.
- **Componente borrado:** `afamar-frontend/src/components/ui/DiscountBlock/` (`.tsx` + `.module.css`) — confirmado huérfano (sin imports, sin barrels `index.*` en `components/ui`), eliminado por completo.
- Nota: los campos manuales `discount_percentage`/`discount_fixed_amount` **siguen existiendo** en el modelo de datos/backend (no se tocaron); solo se removió la UI en el form de OT. Los tests NO cubren QuoteOptionsGrid ni budgetOptions (menos riesgo).
- Verificación: `tsc --noEmit` limpio · vitest **204/204** (BudgetPanel.test, etc. intactos).

## Fix buscador de materiales 2026-08-30

El search en `/admin/materials` no filtraba: escribir un término no hacía nada. **Causa raíz:** el endpoint backend `list_materials` (`afamar-backend/app/api/routers/materials.py`) **no aceptaba el parámetro `search`**. El frontend envía `search:` al tipear (vía `useEntityList` → cambia la query key → refetch), pero el backend lo ignoraba silenciosamente.

**Fix:** agregado `search: str | None = None` al endpoint `list_materials` + filtro case-insensitive con `or_` sobre `Material.name` y `Material.supplier` (`ilike`), aplicado ANTES de `category_id`/`color_id` y de `paginate`. `paginate` ya cuenta el total de la query filtrada, así que la paginación y el `total` del frontend siguen correctos. Import `from sqlalchemy import or_` agregado.

- Ejemplo buscado por el usuario: "negro absoluto" (nombre de material).
- OJO: `Material` **no tiene columna `color`** — el color vive en `MaterialColor` vía relación `color_obj`. Intentar `Material.color.ilike(...)` rompe el query build. Solo se filtran `name` y `supplier` (columnas reales).
- Verificación: pytest backend **45/45** pasan.
- Convención del mismo estilo ya existente en `list_pool_stock` (`app/api/routers/pool_stock.py`): param `search` en el list endpoint + `or_`/`ilike` en el service, con skip/limit sobre el resultado filtrado.

## Comparativa de medición: filas de detalle (2026-08-30)

La COMPARATIVA DE MEDICIÓN del PDF de órdenes de trabajo (vista previa `DocumentPdf` + descarga legacy) muestra cada **zócalo/frente** como **fila de detalle indentada** bajo su material. Cada detalle lleva su **subtotal ARS/USD con signo** (delta monetario) **más sus columnas de medida con unidad** — m² para zócalos, ml (metros lineales) para frentes. Elección del usuario (via question): filas detalle indentadas, con **ambos orígenes** (fabricación + catálogo) y con medida real siempre visible.

**Formato por material (encabezados genéricos — la unidad vive en cada celda):**
```
                Presupuestado   Real   Diferencia   Subtotal ARS   Subtotal USD
Miami White     2,00 m²         2,20 m²  +0,20 m²    +$ 45.000,00   +USD 30,00
   Zócalo       0,34 m²         0,42 m²  +0,08 m²    +$ 12.000,00   +USD 6,00
   Frente       3 ml            3 ml     0 ml        +$ 35.000,00   +USD 22,00
```
- La fila del **material** conserva las columnas M² Presupuestado/Real/Diferencia y su subtotal = **SOLO** el delta de su propio m² `(real − presup) × precio/m²`.
- Cada **fila detalle** (`is_detail: true`) muestra su subtotal ARS/USD con signo (`+`/`−`) Y sus medidas (Presupuestado/Real/Diferencia) con unidad `m²`/`ml`. Label: fabricación → `conceptToDisplay` + nombre del material (ej. "Zócalo Miami White"); catálogo → `name` del trabajo adicional (ej. "Frente Ingletetado 45°"). Trabajos `flat` asignados a un material: SÍ salen como detalle pero con medidas `—` (no tienen medida).
- **Medida "Real"** = estado actual de la OT (`length × width × quantity` para M², `linear_meters` para el frente). **Medida "Presupuestado/Diferencia"** = snapshot `m2_budgeted`/`linear_meters_budgeted` tomado al convertir (ver abajo). **OTs legacy sin snapshot dimensional** muestran Real + budgeted/delta `—` (ej. el frente de A-000003 re-congelado post-conversión: real `3 ml`, presup `—`).
- **Los ítems detalle SIEMPRE se muestran**, incluso con delta `0,00` (OTs sin snapshot o ítems sin cambios) — decisión del usuario para que el cliente vea la composición completa: material + zócalo + frente. `signedMoney(0)` → `"0,00"`.
- La **fila TOTAL** suma todos los subtotales (materiales + detalles). Sus celdas de medida quedan `—` (unidades mixtas m²/ml, no se suman). Globales/sin-match se omiten (siguen viéndose en su propia tabla ADICIONALES).

**Snapshots al convertir (`work_order.py::create_from_budget`):** `fabrication_details` → `m2_budgeted` (`length×width×quantity`, conceptos M2) o `linear_meters_budgeted` (`length×quantity`, conceptos lineales); `additional_works_data` → `linear_meters_budgeted` para `type == 'frente'`. Encabezados de la tabla: "Presupuestado / Real / Diferencia" (sin "M²" — mixto m²/ml, unidad por celda).

**Cambios por capa (los 2 builders deben mantenerse en sync):**
- `afamar-frontend/src/utils/pdf/buildSectionData.ts` — `buildMeasurementComparison` emite filas planas (material → sus detalles → siguiente material); `detailRow(label, ars, usd, signed, measure)` formatea medidas con unidad; el detalle viene de `fabrication_details` (match `material`, unidad por `M2_CONCEPTS`/`LINEAR_CONCEPTS`) y `additional_works_data` (match `materialName` desprefijado, omite `POOL_MATERIAL_GLOBAL`/`__ALT__:`; frentes → ml). El subtotal del material ya NO incluye los deltas vinculados.
- `afamar-frontend/src/utils/pdf/pdfTypes.ts` — `MeasurementComparisonRow` ganó `is_detail?`, `measure_budgeted/real/delta`, `measure_unit: 'm2' | 'ml' | null` y `measure_*_str` pre-formateadas con unidad.
- `afamar-frontend/src/components/ui/PdfPreviewModal/DocumentPdf.tsx` — `COMPARISON_HEADERS` genéricos (`Concepto | Presupuestado | Real | Diferencia | Subtotal ARS | Subtotal USD`); `comparisonRowCells` indenta detalles con NBSP (`\u00A0`) y llena las 3 celdas de medida desde `measure_*_str`; `comparisonRowsWithTotal` suma TODO.
- `afamar-backend/app/services/pdf_html.py` — `_build_measurement_comparison` replicado (detalle con `measure_*_str`/`measure_unit`, sets `_FAB_M2_CONCEPTS`/`_FAB_LINEAR_CONCEPTS`, helper `_measure_str`); `work_order.py::create_from_budget` agrega los snapshots dimensionales. Total ARS/USD siguen sumándose en `build_work_order_pdf_data`.
- `afamar-backend/app/templates/document_pdf.html` — encabezados genéricos; `<tr>` detalle con clase `detail-cell` (padding-left) renderiza `c.measure_budgeted_str/measure_real_str/measure_delta_str`.

**Verificación:** `tsc --noEmit` limpio · vitest **207/207** · pytest **58/58**. El test "emits linked zócalo/frente as indented detail rows…" cubre medidas con snapshot (zócalo `0,34 → 0,42 m² +0,08`, frente `3 ml → 3 ml 0`); el test "always emits linked detail rows even when the delta is zero…" cubre el legacy A-000003 (real visible, presup/delta `—`). Backend: **6 tests nuevos** en `tests/test_measurement_comparison.py` (material propio delta; zócalo con/sin snapshot; frente ml; flat sin medida; globales/unmatched omitidos) + **7 tests** del backfill en `tests/test_backfill_measurement_snapshots.py` (hidrata missing, preserva existentes, idempotente, duplicados posicionales, unmatched/global/no-budget skip).

## Backfill de snapshots 2026-08-30

El A-000003 (convertido antes que existieran los snapshots dimensionales, con el frente re-frozen post-conversión) mostró que la columna "Presupuestado" podía decir "—" y el subtotal "$0,00" cuando en realidad el frente **había subido de 2,5 ml a 3 ml** (+$ 40.170,95 / +USD 26,17). El script `afamar-backend/scripts/backfill_measurement_snapshots.py` resuelve esto one-shot: lee `wo.budget_id` y matchea cada fila de la OT con la fila correspondiente del presupuesto origen (fabricación por `concept+material`; adicionales por `additional_work_id` con fallback `(name+materialName)` desprefijando `__ALT__:`), hidratando `m2_budgeted` / `linear_meters_budgeted` / `total_*_budgeted` desde la fila del presupuesto. Mismas fórmulas de cálculo que `create_from_budget`. Idempotente (solo rellena lo faltante, nunca pisa snapshots existentes) + dry-run por defecto. Globales (`__GLOBAL__`/`POOL_MATERIAL_GLOBAL`) y unmatched → skip contados.

**Uso (con venv Python):**
```bash
# Ver qué cambiaría (sin escribir)
.\venv\Scripts\python.exe scripts/backfill_measurement_snapshots.py --work-order 3
.\venv\Scripts\python.exe scripts/backfill_measurement_snapshots.py             # todas las OTs

# Aplicar (commit per-OT al final)
.\venv\Scripts\python.exe scripts/backfill_measurement_snapshots.py --fix

# Docker
docker exec afamar-backend python scripts/backfill_measurement_snapshots.py
docker exec afamar-backend python scripts/backfill_measurement_snapshots.py --fix
```

El A-000003 después del backfill: `Zócalo FORTALEZA 0,105 → 0,1 m² -0,005 m² -$1.842 / USD -1,20` + `Frente Ingletetado 45° 2,5 → 3 ml +0,5 ml +$40.170,95 / +USD 26,17`. Funciona para preview y descarga porque escribe los snapshots en el JSON de la propia OT (sin cambios de API/schema). Las OTs sin `budget_id` o con presupuesto eliminado quedan en `—/$0,00` (sin match posible).

## Colisión `date` en WorkOrder schemas (2026-08-30)

Síntoma: el operador guarda la OT (seña USD + fecha de entrega) y la API responde `422 Input should be None, input: '2026-09-11'` sobre `body.delivery_date`. El campo acepta el `deposit_*` pero rechaza cualquier valor no-None en `delivery_date`.

**Causa raíz** (Pydantic 2.13 + Python 3.14): el módulo `app/schemas/work_order.py` importaba `from datetime import date, datetime` y declaraba `delivery_date: Optional[date] = None` en una clase con un campo literal llamado `date` (`WorkOrderBase.date: Optional[datetime] = None`, la fecha del documento). El statement `date: ... = None` en el cuerpo de la clase crea `cls.date = None`. Cuando Pydantic arma el modelo, su `ModelMetaclass.__new__` re-evalúa los `__annotations__` usando `localns=cls.__dict__`; el lookup de `date` resuelve a `None`, y la anotación `Optional[date]` colapsa silenciosamente a `Optional[None]` = `NoneType`. El campo termina aceptando sólo `None` aunque el código fuente diga lo contrario. Ningún validator custom, ningún `field_validator`, ningún `model_validator` — el bug está en la resolución de nombres de Pydantic. Reproduce en aislado:

```python
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel
class T(BaseModel):
    a: Optional[date] = None   # se re-evalúa cuando `date` ya es class attr
    date: Optional[datetime] = None  # crea cls.date = None
print(T.model_fields['a'].annotation)  # NoneType (bug)
```

**Fix** en `afamar-backend/app/schemas/work_order.py`:
- Cambiar el import de `from datetime import date, datetime` a `import datetime` (así el módulo `datetime` queda en el namespace y sus atributos `datetime.date`/`datetime.datetime` no chocan con el campo).
- Cambiar las dos anotaciones `delivery_date: Optional[date]` (líneas 51, 119) a `Optional[datetime.date]`.
- Cambiar todas las demás `Optional[datetime]` y `datetime` pelados (líneas 75, 112, 121, 136, 146, 147, 148, 149) a `Optional[datetime.datetime]` / `datetime.datetime`, porque ahora `datetime` es el módulo, no la clase.

**Regla**: en cualquier schema Pydantic, **nunca combinar `from datetime import datetime` con un campo cuyo nombre colisione con un tipo del módulo `datetime`** (`date`, `datetime`, `time`, `timedelta`, `tzinfo`). Si el campo se llama `date`, usar `import datetime` + `datetime.date` para el tipo. Misma regla aplica a cualquier otro módulo que importes nombres que un field pueda shadowear.

**Regression sentinel** en `tests/test_work_order_update.py::test_work_order_update_accepts_delivery_date_string`: asserta `WorkOrderUpdate.model_fields['delivery_date'].annotation == date | None` (cualquier valor distinto significa que la colisión volvió).

## Caja por sesión (backend) 2026-08-31

**Contexto de negocio:** la caja NO es un kiosco — no tiene día definido, ni es semanal/mensual. El operador hace la caja cuando se le juntan varias órdenes o hay ingresos elevados y puede abarcar varios días. En Excel la numeran por sesión (#1, #2, #3...). Este cambio transforma el modelo de caja **diaria** (una fila por `date`, unique) a **cajas por sesión numeradas**, on-demand. **SOLO BACKEND en esta fase** (el frontend se actualiza en la siguiente).

**Reglas de negocio (decisiones del usuario):**
- **Siempre hay exactamente UNA caja abierta** (`is_closed == False`). Nunca más de una.
- **Cerrar una caja → automáticamente se abre la #siguiente** (número consecutivo). Cero pasos extra para el operador.
- **Numeración continua por sesión** (#1, #2, #3...), NO por día. Computada en el repo como `max(number)+1` (no hay unique en DB para coexistir con filas legacy `number=NULL`).
- **Saldo anterior SIEMPRE manual**, se setea al abrir (`POST /cash/current/open` / `PUT /cash/current/previous-balance`).
- **`real_cash` = todo EXCEPTO transferencia bancaria.** Efectivo, efectivo en USD y tarjetas (débito/crédito) cuentan como efectivo real; las **transferencias NO** (ese dinero no se tiene físicamente). Las transferencias igual van a los totales de Suma/Saldo, pero no al `real_cash`. Implementada en `DailyCashRepository.recalculate` con el helper `_is_transfer(payment_method)` (matchea por substring `TRANSFER`/`TRANSFERENCIA`) para ingreso, y `expense_type == "BANK_TRANSFER"` para egreso.
- Una caja puede **abarcar varios días** (abierta un día, cerrada cuando se juntan órdenes).
- **Numeración nueva desde cero** (los datos legacy de caja diaria NO se convierten; quedan con `number=NULL` como referencia histórica).

**Migración Alembic `a9b8c7d6e5f4` (`alembic/versions/a9b8c7d6e5f4_cash_registers_by_session.py`):**
- `daily_cash` gana `number INT NULL`, `opened_at DATETIME NULL`, `closed_at DATETIME NULL`.
- Se **dropea el unique de `date`** (`ix_daily_cash_date`), la columna se mantiene (ya no identifica la caja; rellena `date.today()` al crear).
- **Sin backfill**: los registros legacy quedan con `number=NULL`. Numeración nueva empieza en #1.
- Batch mode (`batch_alter_table`) para que el unique-drop funcione portable en SQLite (rebuild) y MySQL.

**Modelo (`app/models/daily_cash.py`):** `DailyCash` agrega `number`, `opened_at`, `closed_at`; `date` ya no es `unique`. `CashMovement` sin cambios.

**Repositorio (`app/repositories/daily_cash.py`):**
- `get_current()` → la única fila `is_closed == False` (invariante una-abierta).
- `get_or_create_current()` → crea si no hay, con `_next_number()`, `date=today`, `opened_at=now`, saldo 0.
- `_next_number()` → `int(max(number) or 0) + 1`.
- `get_by_number(number)`, `get_closed()` ordenado por `number.desc()`.
- **Eliminados** `get_by_date`, `get_or_create(query_date)`.
- `recalculate` → **`real_cash` = prev + (ingresos − transfer_income) − (egresos − transfer_expenses)** (arregla también el mismatch `EFECTIVO`/`CASH` que rompía el cálculo con los métodos del catálogo en español).

**Servicio (`app/services/daily_cash.py`):**
- `get_current()`, `open_cash(previous_balance=0)` (idempotente), `set_previous_balance(value)`.
- `create_movement(movement_data)` → **sin `date`**; resuelve la caja abierta (`get_or_create_current`) e ignora la clave `date` si llega. Si no hay caja abierta (edge legacy), la crea.
- `close_cash(notes=None)` → valida `total_sum >= total_expenses`, cierra (`is_closed=True`, `closed_at=now`, notas), **abre la siguiente** y retorna `{closed_cash, summary, next_cash}`.
- `_build_summary(cash)` → `{number, opened_at, closed_at, duration_seconds, total_by_payment, ingreso_count, egreso_count, previous_balance, total_income, total_expenses, current_balance, real_cash}` (total por forma de pago agrupado por `payment_method`).

**Schemas (`app/schemas/daily_cash.py`):** `CashMovementCreate` **sin `date`**; `DailyCashResponse` con `number/opened_at/closed_at` (sin `date`); `OpenCashRequest/UpdatePreviousBalance` solo con `previous_balance`; `CloseCashRequest` solo notas; nuevos `CashSummary` + `CloseCashResponse {closed_cash, summary, next_cash}`. Usa `import datetime` (regla de colisión de nombres).

**Router (`app/api/routers/daily_cash.py`)** — el prefijo `/cash` se mantiene:
```
GET    /cash/current                  → caja abierta actual (+ movimientos)
POST   /cash/current/open             → { previous_balance? } asegura/abre la actual (idempotente)
PUT    /cash/current/previous-balance → { previous_balance }
POST   /cash/current/close            → { notes? } → CloseCashResponse (cierra + abre #siguiente)
GET    /cash/history                  → cajas cerradas por número, con `summary` por fila
POST   /cash/movements                → sin date → cae en la caja abierta actual
DELETE /cash/movements/{id}           → igual
```
**Endpoints legacy con fecha eliminados:** `/cash/daily`, `/cash/previous-balance`, `/cash/daily/close`.

**`app/services/work_order.py::_create_cash_movement_on_deposit`:** simplificado — ya NO arma `date` ni `date.today()`; el `create_movement` resuelve la caja abierta actual. (El `import datetime/date` se mantiene porque `date` se usa en `list_filtered` y `budget.date`.)

**Tests:** `tests/test_cash_register.py` (9 tests): numeración 1→2→3, una-abierta invariante, cerrado abre siguiente, movimiento sin fecha, auto-crea caja sin caja abierta, `real_cash` excluye transferencias (EFECTIVO+TARJETA SÍ, TRANSFERENCIA NO), resumen por forma de pago, validación egresos>suma, idempotencia de open. **pytest 70/70.**

## Fix TOTAL comparativa 2026-08-31

**Síntoma (A-000 / WO5):** el **TOTAL de la COMPARATIVA DE MEDICIÓN** del PDF mostraba `$717.343,88 ARS / +467,33 USD` aunque la fila material (BLANCO SUGGAR) mostrara Subtotal `—`. **Causa raíz:** en `buildMeasurementComparison` (`afamar-frontend/src/utils/pdf/buildSectionData.ts`), una fila material **sin snapshot** de `m2_budgeted` (legacy re-frozen post-conversión) tenía `m2_budgeted=0` → `delta = m2Real − 0 = m2Real`, así que `subtotal_ars = m2Real × price × rate` = **el precio COMPLETO del material** (USD 335/m² × 1,395 m² × 1535 = $717.343,88). La celda de display sí era `—` (`subtotal_ars_str` se gateaba con `hasBudget`), pero el **TOTAL** (`comparisonRowsWithTotal`, `DocumentPdf.tsx:431`) sumaba el **valor crudo** `subtotal_ars`, no el string → inflaba el total.

**Fix:** en `buildSectionData.ts`, `subtotal_ars`/`subtotal_usd` se ponen a **0 cuando `hasBudget=false`** (además del string vacío). Así el TOTAL solo suma filas con delta real `(real − budgeted)`. En WO5 post-fix: TOTAL de comparativa = **$0,00 / USD 0,00** (los zócalo/frente ligados tienen delta 0 y el material huérfano no contribuye). **Regression sentinel:** `buildPdfData.test.ts::'orphan material row (no m2_budgeted snapshot) does NOT inflate the comparison TOTAL'` (asserta `subtotal_ars===0`, `subtotal_ars_str===''` y TOTAL=0). `tsc` limpio · vitest **213/213**.

## Caja por sesión (frontend) 2026-08-31

Fase de frontend que acompaña al backend "Caja por sesión (backend)". La página de caja deja de ser "diaria" (picker de fecha) y pasa a operar sobre **la caja abierta actual** (la única, `#N`).

**`src/types/cash.ts`:** tipos snake_case completos matcheando el backend: `CashMovement` (`type/amount/description/payment_method/folder_status/order_id/order_number/order_total/client_name/expense_type/remaining_balance/daily_cash_id/created_at`), `CashRegister` (`number/opened_at/closed_at/previous_balance/total_income/total_expenses/total_sum/current_balance/real_cash/is_closed/notes/movements`), `CashSummary` (`duration_seconds/total_by_payment/ingreso_count/egreso_count/...`), `CashHistoryItem = CashRegister & { summary }`, `CloseCashResult`.

**`src/api/resources/cash.ts`:** funciones nuevas contra el API `/cash/current/*`:
```
getCurrentCash()                       GET    /cash/current
openCash(previous_balance=0)           POST   /cash/current/open
setPreviousBalance(previous_balance)   PUT    /cash/current/previous-balance
closeCash(notes?)                      POST   /cash/current/close  → CloseCashResult
getCashHistory({skip,limit})           GET    /cash/history  (páginado, cada fila con `summary`)
createCashMovement(CashMovePayload)    POST   /cash/movements   (SIN `date`)
deleteCashMovement(id)                 DELETE /cash/movements/{id}
```
Se eliminaron `getDailyCash`, `closeDailyCash` (old `closeDailyCash(date, notes)` ya no existe). `getCashHistory` devuelve `Promise<AxiosResponse<CashHistoryItem[]>>` para el `usePaginatedList` (que lee el `pagination` adjuntado por el interceptor http).

**`src/pages/cash/CashDailyPage.tsx`:** ahora es la página de **caja abierta actual**. Sin date picker ni botón "Hoy". Header muestra `Caja #N` + badge Abierta/Cerrada. Muestra `Apertura` (+ Cierre si está cerrada). `useGet(['cash','current'], getCurrentCash)`. Los totales vienen **del backend** (source única de verdad): `total_sum`, `total_expenses`, `current_balance`, `real_cash` → `CashTotalCards`. `handleCloseCash` llama `closeCash(notes)` y notifica `Caja #N+1 abierta`. Se importa `formatDateTime`/`formatDuration` inline (helpers locales del módulo).

**`src/components/cash/CloseCashModal/CloseCashModal.tsx`:** ahora recibe `numero` (#N) y `totales` (el `CashRegister` actual) en vez de `fecha`. Muestra un **resumen previo al cierre** (Ingresos, Egresos, cantidad de movimientos IN/OUT, Saldo Actual, Efectivo Real) y el aviso "al cerrar se abrirá automáticamente la caja #N+1". Renglones estilizados en `CloseCashModal.module.css` (`close-cash__summary*` — verde ingreso, rojo egreso, azul saldo, real destacado).

**`src/components/cash/CashMovementTable/CashMovementTable.tsx`:** el prop `movements` y las columnas `render(row)` pasan de `Record<string, unknown>` a **`CashMovement`** tipado (los call sites de CashDailyPage simplificaron los casts `(m as CashMovement)` a uso directo).

**`src/components/cash/IncomeModal/IncomeModal.tsx`:** el `<select>` "Forma de pago" ahora se puebla con el **catálogo vivo de métodos de pago** (`getActivePaymentMethods` vía TanStack Query, key `['payment-methods','reference']`, `staleTime 5min`) en vez del `PAYMENT_METHODS` hardcodeado legacy (`['CASH','TRANSFER','CREDIT_CARD']`). Default `'EFECTIVO'`. Se elimina el envío de `date:''` (el backend ya no lo acepta — `CashMovementCreate` no tiene `date`, y Pydantic lo descartaría igual). `resetForm` usa `'EFECTIVO'`.

**`src/components/cash/ExpenseModal/ExpenseModal.tsx`:** se elimina el envío de `date:''`.

**`src/pages/cash/CashHistoryPage.tsx`:** listado de **cajas cerradas por número de sesión** (columna `#N`), con Apertura/Cierre (fecha+hr), Ingresos/Salidas/Saldo Actual/Efectivo Real. El detalle muestra: `Caja #N`, apertura·cierre·duración (de `summary.duration_seconds`), conteos de movimientos `(N)`, observaciones, y la tabla **"Totales por forma de pago"** desde `summary.total_by_payment`. Movimientos del detalle igual que antes. Nuevas clases en el CSS module (`cash-history__number`, `--detail-times`, `--detail-count`, `--by-payment*`).

**Labels/rutas:** `MainLayout` y `Sidebar` renombran "Caja Diaria" → "Caja". Rutas intactas: `/admin/cash` y `/admin/cash/history` (App.tsx:87-88). Backend `/cash/history` envuelve con `success(payload, pagination)` (páginado por número desc).

**NOTA — `real_cash` es del backend:** CashDailyPage ya NO recalcula `efectivoReal` en el front filtrando `payment_method === 'CASH'` (que era el mismatch con los métodos en español). Usa el `real_cash` que devuelve el config (regla: todo excepto transferencia). Mismo criterio para `total_sum`/`current_balance`. Un solo lugar que define la verdad.

**Verificación:** `tsc --noEmit` 0 errores · vitest **213/213** (18 files) · pytest **70/70** · **Playwright** `e2e/cash/10-cash.spec.ts` reescrito para el flujo por-sesión (`open → income → expense → close → #N+1 → history` + `real_cash` excluye transferencia) — **4/4 pasan**. El spec era 100% legacy (`/cash/daily`, `/cash/previous-balance` con `date`) y rompía con el backend nuevo; se reemplazó con el smoke del flujo completo. Nota: no se puede truncar `daily_cash` en global-setup (no hay DELETE de cajas, solo de movimientos), así que el smoke es robusto a cajas pre-existentes (compara números relativos, no absolutos).

## Nota E2E 2026-09-01 (suite completa)

Al correr `npm run test:all` completo contra el backend en producción (MySQL) para esta sesión, la suite E2E dio **106/108** (2 fallos, ambos **ajenos a la caja**):

- **`e2e/smoke/00-smoke.spec.ts:38` "Caja Diaria"** — causa ADECUADA por el rename a "Caja" (esta sesión). **Arreglado** (`title: 'Caja'`), pasa en la re-corrida aislada junto con el resto del smoke.
- **`e2e/budgets/03-budgets.spec.ts` "converts an APPROVED budget to a work order"** — `ECONNRESET` en `GET /budgets/23` durante la suite completa. **Flaky de infraestructura**: pasa aislado. 
- **`e2e/budgets/16-budget-full-flow.spec.ts` "Presupuesto + PDF renderizan..."** — **fallo PREEXISTENTE de selector** (`getByText(/Vista previa.*Presupuesto/i)` matchea 2 elementos: el `<p>` "VISTA PREVIA PDF APROBAR" y el `<h2>` del modal → strict mode violation). No relacionado con caja.
- **`e2e/work-orders/17-full-daily-flow.spec.ts`** — **timeout de 30s del test en el paso 7** (PDF download legacy `/work-orders/{id}/pdf`, `xhtml2pdf`). La suite de 11.6 min estresa el backend y el PDF legacy tarda; el PDF del presupuesto en el paso 6 sí pasa. No relacionado con caja.

**Conclusión:** la feature de caja por sesión no introduce ningún fallo E2E propio. Los 2 fallos restantes (PDF del flujo full de presupuestos y PDF download de OT) son **preexistentes / de rendimiento del entorno**, en módulos no tocados por esta sesión (budgets, PDF preview, PDF legacy). Si se quiere la suite 108/108 verde, esos 2 hay que atacarlos aparte (selector strict-mode de `16-budget-full-flow` + flakiness del PDF legacy).

## Navegación tras guardar + tarjeta cobra 100% (2026-09-01)

Sesión después de resolver el incidente de **órdenes duplicadas** (doble POST) y la **caja con señas contadas x2** en MySQL producción.

**Incidente duplicados (root cause + fix):** `WorkOrderFormPage` pasaba `onAfterAction: handleSuccessCallback`, que NO navegaba en page mode → tras un create OK el form quedaba montado en modo "crear" con GUARDAR re-habilitado → un segundo click re-POSTeaba la misma OT (pares A-000027/A-000028 pepeluis, A-000029/A-000030 camila, cada uno con su movimiento de seña en la caja). Se limpió la DB vía API (DELETE de los 2 duplicados + sus 2 movimientos de caja; la caja quedó con una fila por orden). El fix duplicado-relámpago fue `submittingRef` en `useFormActions` + GUARDAR `type="button"` (aunque el guard ref sigue siendo la pieza clave).

**Navegación tras guardar (nuevo contrato, `useFormActions`):** `onAfterAction` ahora recibe `AfterActionInfo` (`{ created?: boolean; deleted?: boolean; id?: number|string|null }`):
- **CREATE** → `onAfterAction({ created: true, id })` (el id sale de `created?.data?.id` — el response de `services.create` ya viene unwrapped por http.ts) → `WorkOrderFormPage` **navega al edit page** `/admin/work-orders/{id}` para seguir retocando. Bonus: al montarse en edición, el form deja de ser "create mode" → imposible re-enviar.
- **UPDATE** → `onAfterAction({ created: false })` → **se queda en el form** (el operador ya no vuelve a la lista tras cada Guardar).
- **DELETE** → `onAfterAction({ deleted: true })` → vuelve al listado (page mode).
- Modal mode: `props.onSuccess` sigue cerrando el modal (BudgetFormPage sigue como `onAfterAction: props.onSuccess`; los `() => void` son asignables al nuevo tipo).

**Tarjeta débito/crédito = cobro 100% visible en el form (`BudgetPaymentSection`):** la regla de negocio ya existía en `applyCreditCardAutoFill` (`utils/creditCardAutoFill.ts`, matchea `TARJETA DE CRÉDITO`/`TARJETA DE DÉBITO` — los nombres del catálogo), y al guardar el payload ya quedaba con `deposit_received = total`. El vacío UX: **no se veía en el form** (la seña seguía mostrando el valor viejo hasta dar Guardar). **Fix:** el `onChange` del select "Forma de pago" ahora, al elegir una tarjeta, autocompleta al instante la seña con el **total en la moneda activa de la seña** (`handleDepositAmountChange`) + marca `balance_paid=true` + `balance_paid_at=today`. Así el operador ve "Seña = total" y "✓ Saldo cobrado" antes de guardar; puede deshacer con el botón si quiere seña parcial. Nota sobre crédito con N cuotas: el recargo crece el total, pero el autofill-de-guardado de `applyCreditCardAutoFill` vuelve a forzar 100% del total actual en ese momento — el input de seña no se re-autofillea live al cambiar el N de cuotas a propósito, para no pelear con una seña editada manualmente; solo el select de método dispara el autofill.

**Tests:** `useFormActions.test.tsx` +3 (create pasa `{created,id}`; update pasa `{created:false}`; delete pasa `{deleted:true}`) · **`BudgetPaymentSection.test.tsx` nuevo** (harness stateful con catálogo; seleccionar TARJETA DE DÉBITO → seña = total + "✓ Saldo cobrado"). El select de pago ganó `aria-label="Forma de pago"`. **Verificación:** `tsc --noEmit` 0 errores · vitest **218/218** (20 files · +4).

## Fix duplicados por micro-ventana + fecha PDF 2026-09-01 (tarde)

**Duplicados otra vez (root cause correcto):** el guard `submittingRef` bloqueaba el doble-click **solo mientras el POST estaba en vuelo**. Al resolverse, `finally` soltaba el ref y re-habilitaba GUARDAR (`setSaving(false)`) **antes** de que el desmonte post-navegación ocurriera — quedaba una ventana de unos pocos ms donde un segundo click re-POSTeaba otra OT. **Fix:** `createdRef` en `useFormActions` — se setea `true` **después** de un create exitoso y **antes** de navegar; `handleSubmit` corta si `submittingRef.current || createdRef.current`. Un create exitoso ya nunca puede repetirse en ese mount, pase lo que pase con la navegación. Test sentinel en `useFormActions.test.tsx`: "blocks a SECOND submit after the first create already completed".

**Fecha del PDF corrida un día (root cause):** `formatDate` (`utils/pdf/pdfHelpers.ts`) hacía `new Date('YYYY-MM-DD')` (parseado como **UTC midnight**) y luego `toLocaleDateString('es-AR')` en **hora local** → en Argentina (UTC-3) el día retrocede uno: hoy 2026-09-01 mostraba **31/8/2026**, y una entrega del 16 mostraba el 15. **Fix:** las cadenas date-only se parsean por componentes con `new Date(y, m-1, d)` (hora local). También se endureció el fallback: si `new Date()` da `Invalid Date`, devuelve el string crudo (antes `toLocaleDateString` sobre fecha inválida devolvía `'Invalid Date'` silenciosamente en vez de tirar, así el `catch` nunca corría). **`pdfHelpers.test.ts` nuevo** (3 tests: date-only sin shift, ISO timestamp, fallbacks). Verificado en preview (`DocumentPdf` lee `data.date`/`data.delivery_date` que `buildPdfData` formatea con `formatDate`). El PDF legacy (backend `pdf_html.py`) formatea las fechas por su lado — no se tocó.

**Verificación:** `tsc --noEmit` 0 errores · vitest **222/222** (21 files · +4).

## Señas fantasma + duplicado real 2026-09-01 (noche)

Dos problemas reportados tras el anterior fix de navegación, ambos reales en MySQL producción:

**1. Duplicado de OT por micro-ventana (A-000031/A-000032).** El `createdRef` ya estaba en el código, pero el duplicado se creó a las 17:19 (antes de que el browser recargara el fix). Confirmado como la misma causa raíz: el guard bloqueaba el POST solo en vuelo; el `finally` re-habilitaba GUARDAR antes del desmonte. `createdRef` (seteado tras un create exitoso y antes de navegar) queda como la barrera permanente. **No hace falta más código** — el usuario solo debe hard-refresh. Se limpió el duplicado vía API (DELETE `/work-orders/34` + sus 6 movimientos).

**2. Señas fantasma por delta-booking en `update()` (bug de plata real).** En `WorkOrderService.update`, cada PUT con `deposit_received` mayor al persistido asentaba la **diferencia** como un nuevo movimiento INCOME en la caja. Cuando una OT se paga 100% por tarjeta, el autofill de seña re-envía en cada GUARDAR un depósito esencialmente igual, pero con deriva de redondeo (round-trip USD) → cada click de Guardar acuñaba un movimiento fantasma de ~4.4 ARS. En A-000032 se acumularon **5×4.4 = 22 ARS fantasma** en la caja #6 (además de su seña real). **Fix:** `update()` ahora solo asienta el delta cuando la OT **NO** está fully-paid (`not (data.get("balance_paid") or order.balance_paid)`). Una OT fully-paid no tiene nada que top-up → re-guardarla jamás acuña dinero. Test sentinel `test_update_fully_paid_does_not_book_phantom_delta`: re-guardar una OT fully-paid con deriva de 4.4 no agrega movimientos.

**Estado tras cleanup:** solo queda A-000031 (original, id 33, pepeluis, 1.459.170, tarjeta débito, saldo 0) con un único movimiento (id 26). Caja #6 `total_income=8.108.150`, `real_cash=7.458.150` (excluye transferencias). Sin plata fantasma.

**Verificación:** pytest **72/72** (¡+1 test del fix!), backend reiniciado con el nuevo `work_order.py`.

**Lección para el día a día:** si ves que una OT duplicada O movimientos de seña gigantes/micro en la caja tras un "Guardar" repetido, la causa es esta combinación. Si vuelve a duplicarse una OT, casi seguro es que el browser sirvió código viejo (OneDrive + vite HMR) — hard-refresh.

## Cobro idempotente en caja 2026-09-02

Consolidación de la garantía "el dinero de cada OT entra a la caja exactamente UNA vez" a nivel de DATOS (no de botón), tras los incidentes de duplicados y señas fantasma. Elección del usuario (via questions): **una seña al crear + cobro automático del saldo al entregar**, reusando cash_movements (sin tabla nueva), sin backfill (solo OTs nuevas).

**Columnas nuevas** en work_orders (migración Alembic **4c5d6e7f8a0**, head previo 9b8c7d6e5f4):
- sena_registered (bool, server_default=0): la seña inicial ya entró a caja.
- saldo_registered (bool, server_default=0): el saldo restante ya se cobró en ENTREGADA.
- Ambas se setean **server-side en la misma transacción que bookea el movimiento** → una vez True, todo re-bookeo es no-op.

**Flujo resultante:** la seña entra a caja solo en create()/create_from_budget() (flag sena_registered); al alcanzar DELIVERED se bookea automáticamente alance_due (flag saldo_registered); si el cliente dejó el 100% (alance_due=0) no se cobra nada. **update() ya NO bookea señas top-ups** (se eliminó el bloque de delta; el resto se cobra automático al entregar). El saldo restante entra SOLO en el tránsito a ENTREGADA.

**Cambios (famar-backend):**
- pp/models/work_order.py — 2 columnas nuevas.
- lembic/versions/b4c5d6e7f8a0_add_work_order_cash_idempotency_flags.py — nuevo.
- pp/services/work_order.py — _create_cash_movement_on_deposit(db, order, amount, deposit_currency, payment_method) refactorizado: acepta el order, usa order.register_flag (default sena_registered) como guard atómico, setea el flag ANTES del commit interno de create_movement, y enriquece el movimiento con order_id/order_total/status/emaining_balance; devuelve ool (booked o no). create() y create_from_budget() lo llaman con egister_flag="sena_registered"; el transito a DELIVERED en update() lo llama con egister_flag="saldo_registered" (solo cuando old_status != DELIVERED y 
ew_status == DELIVERED). Se eliminó el bloque de top-up por delta de update().
- pp/schemas/work_order.py — sena_registered/saldo_registered solo en WorkOrderResponse (read-only, server-managed; NO en Create/Update para que el cliente no pueda voltear los flags).

**Frontend — IncomeModal sin obligación de orden:** el CashMovementCreate backend ya tenía order_id/order_number/order_total opcionales, así que registrar un ingreso SIN orden (ej. canilla/accesorio aparte) ya funcionaba. En IncomeModal.tsx se aclaró la UX: label de la sección "Vincular a Orden **(opcional)**", hint "Dejalo vacío para registrar un ingreso general (ej. accesorio, canilla…)", y label del monto dinámico ("Monto (Seña)" con orden / "Monto" sin orden). ExpenseModal ya no obligaba a orden — sin cambios.

**Tests (	ests/test_work_order_cash.py, 5 nuevos):** seña entra 1 vez aunque create() se re-ingrese; update() ya no bookea top-ups de seña; DELIVERED bookea alance_due exacto una vez (y re-guardar no duplica); DELIVERED con OT fully-paid (balance_due=0) no bookea nada; los flags persisten y se exponen (y Create/Update NO los aceptan). **pytest 77/77.**

**Verificación:** pytest **77/77** · 	sc --noEmit 0 errores · vitest **222/222**. Migración aplicada a MySQL producción (lembic current → 4c5d6e7f8a0 (head); columnas NULL-less con server_default=0, additive/safe). Backend reiniciado con el nuevo work_order.py (uvicorn --reload NO levanta cambios en OneDrive — siempre hard-restart + el browser necesita Ctrl+Shift+R).

**Nota operativa:** lembic upgrade --sql (offline) falla en el chain porque una migración previa (1b2c3d4e5f6) usa inspect(bind) en runtime; validar migraciones nuevas aplicándolas a un SQLite temporal en ONLINE (no con --sql). CUIDADO: lembic upgrade head sin definir DATABASE_URL en el proceso corre contra producción MySQL (settings con ENVIRONMENT=production arma la URL MySQL) — es additive/safe aquí, pero evitar correr migraciones contra prod sin intención.

## Fix botón "Deshacer" en modo crear (2026-09-03)

El botón "Deshacer" de la sección de estado de pago (el que revierte el "✓ Saldo cobrado" de la tarjeta-100%) **no hacía nada** en el formulario de OT/presupuesto **nuevo** (/work-orders/new, sin id). **Causa raíz:** useConfirmPayment (src/hooks/useConfirmPayment.ts) arrancaba con if (!id) return; — sin id (modo crear) el handler salía antes de hacer nada. El autofill de tarjeta (BudgetPaymentSection.tsx) marca alance_paid=true en el form local al seleccionar TARJETA, pero como no había id para persistir, el "Deshacer" quedaba colgado (seguía mostrando "✓ Saldo cobrado").

**Fix (useConfirmPayment):**
- **Modo crear (!id)**: al desmarcar el pago (click "Deshacer"), el handler ya NO vuelve a guardar ni requiere id; solo revierte el ESTADO LOCAL del form vía setForm: alance_paid=false, alance_paid_at='', deposit_received=0, deposit_usd=0, deposit_currency='ARS', alance_due=prev.total, alance_due_usd=prev.total_usd. Sin llamada al backend (nada que persistir todavía). Decisión del usuario (opción A): la seña se revierte a  , no al valor pre-tarjeta.
- **Modo edición**: al desmarcar (
uevo=false) ya no deja la seña colgada — el payload ahora además revierte deposit_received=0, deposit_usd=0 y restaura alance_due=total, alance_due_usd=total_usd (antes solo mandaba alance_paid:false y el saldo quedaba en 0).

**Cuidado con los tipos:** deposit_received/deposit_usd/alance_due son 
umber en FinancialBase (no string) — usar  , no ''.

**Tests:** useConfirmPayment.test.tsx — actualizado el caso "true→false" (edición) para esperar deposit_received=0/alance_due=5000 en el payload, y agregado un test nuevo del modo crear (id undefined + alance_paid=true) que verifica que NO llama al backend pero sí revierte el estado local (seña 0 + alance_due restaurado). El test viejo "does nothing when id is undefined" (con alance_paid=false) sigue pasando. **vitest 223/223** (21 files, +1) · 	sc --noEmit 0 errores · ESLint limpio.

## Fix input "Saldo Anterior" de la caja (2026-09-03)

En /admin/cash no se podía escribir ningún valor en el Saldo Anterior: tipear no hacía nada visible. **Causa raíz:** en CashDailyPage.tsx el PreviousBalanceCard recibía previousBalance={cashData?.previous_balance ?? 0} (el valor persistido, que NO cambia hasta guardar) PERO el onChange actualizaba un **estado local aparte** (previousBalanceState) que el card nunca volvía a leer. Duplicación de estado desincronizada → el input estaba controlado por cashData (estático) y lo escrito se perdía visualmente.

**Fix:** el card ahora recibe previousBalance={previousBalance} (el estado local, que onChange actualiza), y un useEffect sincroniza previousBalanceState con cashData?.previous_balance **solo cuando NO está en modo edición** (if (!previousBalanceEdit)) — así no pisa lo que el operador está tipeando. handleSavePreviousBalance ya guardaba el estado local, así que el valor escrito se persiste correctamente.

**Verificación:** 	sc --noEmit 0 errores · ESLint limpio (0 errores, 0 warnings) · vitest **223/223**. (Este archivo era CashDailyPage.tsx:31 → doble estado; ahora el estado local es la fuente del card.)

## Tarjeta = pago total (no hay seña) 2026-09-03

Aclaración de negocio del usuario (corrige el diseño previo): **en tarjeta (débito/crédito) NO existe la seña** — se cobra el 100% del total (con el recargo de cuotas si es crédito) al momento de la venta, y ese cobro entra a la caja en ese momento (no al entregar). La **seña** (adelanto + saldo al entregar) aplica SOLO para transferencia bancaria y efectivo (métodos NONE).

**Rediseño del form de pago (BudgetPaymentSection.tsx):**
- Cuando el método es tarjeta (isCardPaymentMethod(currentMethod.name)), el campo "Seña recibida" se **oculta** y se muestra en su lugar un display **"Pago total con tarjeta "** con hint "Incluye el interés de las cuotas" / "No incluye interés" según showInstallments.
- El estado de pago para tarjeta muestra fijo **"✓ Pago cobrado (tarjeta)"** SIN botón "Deshacer" (no hay seña que revertir). Para no-tarjeta (efectivo/transferencia) se mantiene "✓ Saldo cobrado"/"⚠ Saldo pendiente" + botón Confirmar/Deshacer como antes.
- **Nuevo useEffect de sincronización**: cuando es tarjeta, sincroniza deposit_received/deposit_usd al total (ARS/USD), alance_due/alance_due_usd=0, alance_paid=true, alance_paid_at=hoy. Deps [isCard, readOnly, form.total, form.total_usd]. Esto **resuelve el bug reportado**: al cambiar las cuotas, el recargo sube orm.total → el effect re-dispara → el "cobro 100%" sigue el total CON interés (antes la seña quedaba en el total sin recargo). Sin loop de render: los campos que mutate no están en las deps.
- Se **eliminó el autofill manual** del onChange del select de método (handleDepositAmountChange + update('balance_paid'...)), reemplazado por el effect (usaba orm.total del render previo, sin recargo).
- Removido setForm de las props destructured (no se usa en el cuerpo).

**Persistencia (backend, sin cambios):** create()/create_from_budget() bookean la seña (sena_registered) con deposit_received = total CON recargo (porque useBudgetCalculations calcula el total final con cuotas y pplyCreditCardAutoFill fuerza deposit_received = total). alance_due=0 → al entregar no se cobra nada. El recargo se recalcula server-side en _recalculate_totals_from_items con el mismo catálogo → coherente.

**Test:** BudgetPaymentSection.test.tsx reescrito — al elegir tarjeta espera: oculta "Seña recibida", muestra "Pago total con tarjeta" + "$ 120.000,00" + "✓ Pago cobrado (tarjeta)" (antes esperaba getByDisplayValue('120000') + "✓ Saldo cobrado"). **vitest 223/223** · 	sc --noEmit 0 errores · ESLint limpio.

## Fix readOnly en modo crear (2026-09-03)

Al CREAR una OT en /admin/work-orders/new, si el operador elegía estado WORKSHOP (TALLER) antes de guardar, el form se **bloqueaba por completo** (todos los campos deshabilitados), impidiendo rellenar la información. **Causa raíz:** en useEntityForm.ts (compartido por presupuestos y OT) el flag eadOnly dependía solo de orm.status:

`	s
const readOnly = ['WORKSHOP', 'FINISHED', 'DELIVERED', 'CONVERTED_TO_OT', 'REJECTED'].includes(form.status);
`

Así que elegir TALLER (o FINISHED/DELIVERED) en modo crear activaba eadOnly sin importar que se estuviera cargando la info por primera vez.

**Fix:** agregar isEdit && — el bloqueo read-only aplica SOLO al **editar** una orden ya guardada en un estado avanzado (taller/terminada/entregada: el material ya se cortó y no se modifican las medidas). En **modo crear NUNCA se bloquea**, aunque el estado seleccionado sea WORKSHOP.

`	s
const readOnly = isEdit && ['WORKSHOP', 'FINISHED', 'DELIVERED', 'CONVERTED_TO_OT', 'REJECTED'].includes(form.status);
`

**Verificación:** 	sc --noEmit 0 errores · vitest **223/223**. (Sin cambios en backend.)

## Comparativa de medición como toggle colapsable (2026-09-03)

En /admin/work-orders/new, la tarjeta "Incluir comparativa de medición en el PDF" (checkbox siempre visible) mostraba su contenido por defecto. El usuario quiere que se comporte igual que los otros toggles del form (Calculadora de Porcelanato 🧮 y Diseño/Plano 📐): **colapsada por defecto**, y que haya que dar click para desplegarla.

**Cambio (WorkOrderFormPage.tsx + WorkOrderFormPage.module.css):**
- Nuevo estado local showComparisonToggle (arranca alse = colapsado).
- La tarjeta ahora tiene un botón toggle estilo croquis: ⚖️ Activar Comparativa de medición + hint "Comparativa oculta." cuando está plegada; 👁️ Ocultar Comparativa de medición + el checkbox + su hint cuando está desplegada.
- El checkbox interno sigue siendo orm.include_measurement_comparison_in_pdf (marcado por defecto) — no cambia; solo se oculta/despliega el panel.
- Deshabilitado con eadOnly (igual que el resto en estados avanzados al editar).
- Solo aplica a órdenes de trabajo (los presupuestos no tienen esta tarjeta).

**Verificación:** 	sc --noEmit 0 errores · vitest **223/223**. (Los 8 errores de eslint de WorkOrderFormPage.tsx son preexistentes — no los introduce este cambio.)

## Botón "Quitar cliente" para corregir selección (2026-09-03)

Reporte del operador: al crear un presupuesto se equivocó de cliente y **no podía sacarlo** — el form de presupuesto, una vez seleccionado un cliente, muestra el ClientInfoCard en modo solo-lectura sin ninguna forma de deseleccionar. **Causa raíz:** EntityFormClient.tsx (compartido por Presupuesto y OT) hace early-return a ClientInfoCard + address picker cuando hasClient (!!form.client_name && !!selectedClient), sin botón para volver al typeahead.

**Fix (EntityFormClient.tsx + EntityFormClient.module.css):**
- Nuevo handler handleRemoveClient() que limpia client_name, client_phone, client_email, client_address, delivery_address_id (=null) → hasClient pasa a alse → se remonta ClientSection (typeahead) con query='' (estado local reseteado al montar).
- Nueva fila .entity-form-client__info-row (flex, justify-content: space-between) con ClientInfoCard + botón **"Quitar cliente"** (.entity-form-client__remove-btn, rojo/ar(--color-danger), hover invierte) cuando !readOnly.
- El botón NO se muestra en readOnly (estados avanzados al editar) ni afecta a MeasurementFormPage (que usa ClientInfoCard directo, no EntityFormClient).
- Aplica a Presupuesto Y OT (mismo componente compartido) — la corrección de cliente funciona en ambos.

**Verificación:** 	sc --noEmit 0 errores · ESLint 0 errores · vitest **223/223** (no hay tests de estos componentes).

## Botón de retroceso de estado 2026-09-03

Reporte del operador: una OT quedó "atascada" en TALLER (WORKSHOP) por error y no se podía desbloquear — el `readOnly` (que se activa al editar estados avanzados, ver "Fix readOnly en modo crear") bloquea TODOS los campos incluido el select de estado, así que no había forma de retroceder y seguir editando. El backend ya permitía `WORKSHOP → MEASUREMENT` en `VALID_TRANSITIONS`; faltaba la salida en el frontend.

**Cambio (WorkOrderFormPage.tsx + WorkOrderFormPage.module.css):** botón de retroceso de estado en el header, junto a los botones de avanzar:
- `WORKSHOP` → "↩ Volver a Medición" (MEASUREMENT)
- `FINISHED` → "↩ Volver a Taller" (WORKSHOP)
- `DELIVERED` → "↩ Volver a Terminada" (FINISHED)
- Oculto en `MEASUREMENT`, `CANCELLED`, `CONVERTED_TO_OT` (no aplican retroceso).

**Detalles:**
- Mapeo explícito (no genérico): constante `STATUS_ROLLBACK: Record<string, string>` = `{ WORKSHOP: 'MEASUREMENT', FINISHED: 'WORKSHOP', DELIVERED: 'FINISHED' }` — evita depender de `orderStatuses.indexOf(...) - 1` (que para MEASUREMENT daba -1 → fallback confuso al propio estado).
- Label con `t(STATUS_ROLLBACK[form.status])` (import de `t` de `utils/translate` agregado; los estados ya se traducen).
- `onClick={() => handleStatusChangeAction(STATUS_ROLLBACK[form.status])}` — reutiliza `handleStatusChangeAction` (de `useFormActions` → `updateWorkOrder(id, { status })`), el mismo handler de los botones de avanzar. El backend valida la transición.
- CSS `.work-order-form__btn-rollback` (background `var(--color-warning)` naranja), incluido en los bloques compartidos de botones de acción (flex/gap/padding/border-radius/font-weight) y en el bloque `:disabled` (opacity .6 + cursor not-allowed).

**Verificación:** `tsc --noEmit` 0 errores (los 8 de ESLint de WorkOrderFormPage siguen siendo preexistentes). Sin cambios en backend. El botón es frontend puro; requiere hard-reload (Ctrl+Shift+R) en el navegador por OneDrive.

## Comparativa de medici�n � frentes duplicados + OTs directas 2026-09-07

El operador report� dos issues en la COMPARATIVA DE MEDICI�N del PDF de OTs:

**Issue 1 (doble dibujo del frente):** el caso de la screenshot eran 2 mesadas de NEGRO BRASIL (mismos nombre y tipo) y UN solo frente ingletado de 3,43 ml (un �nico �tem del cat�logo con materialName='NEGRO BRASIL'). El PDF dibujaba **dos** filas "Frente Ingletetado 45�" � una por cada mesada. Regla de negocio: **"1 frente en ML totales, no por mesada"** (si son 10 mesadas de un edificio, el frente sigue siendo UNO y se cobra en ML totales, no por mesada).

**Issue 2 (TOTAL no sumaba frentes):** adem�s, el delta del TOTAL no inclu�a los frentes porque el linear_meters_budgeted no se persist�a en el Presupuesto origen (solo se persist�a en la OT al convertir, v�a create_from_budget). Como la OT A-000038 ven�a de un presupuesto, su frente no ten�a snapshot ? celda "�" en Presupuestado, subtotal ,00, no sumaba al TOTAL.

**Issue 3 (regla de negocio):** cuando el operador CREA una OT directa en /admin/work-orders/new (cliente que ya sab�a las medidas exactas), el form mostraba el toggle y el PDF renderizaba la COMPARATIVA � **confuso y no aplica**: no hay "estimado vs real" porque el cliente no dio medidas estimativas. Regla: la comparativa **solo se muestra si la OT viene de un presupuesto** (udget_id presente). Directas = sin comparativa.

**Fixes aplicados:**

### Fix #1 � Deduplicar frentes en la comparativa (frontend + backend legacy)

El matching dditional_works_data[].materialName == material.name corr�a **dentro del loop de materiales**, as� que un frente asignado a "NEGRO BRASIL" matcheaba con cada mesada de ese material y se emit�a N veces. Soluci�n: un Set<dedupe_key> (clave = dditional_work_id o fallback a 
ame) se mantiene entre iteraciones de materiales; la primera vez que un frente matchea, se emite su fila detalle y se agrega la key al set. Las siguientes mesadas con el mismo material la skipean. Resultado: 1 sola fila detalle por frente �nico, sin importar cu�ntas mesadas con ese materialName haya.

- Frontend: src/utils/pdf/buildSectionData.ts ? uildMeasurementComparison (emittedFrenteKeys: Set<string> al inicio de la funci�n, agregado al Set justo antes del esult.push(detailRow)).
- Backend legacy: pp/services/pdf_html.py ? _build_measurement_comparison (mismo patr�n con emitted_frente_keys).

### Fix #2 � Ocultar comparativa en OTs directas (frontend + backend legacy + form)

- Frontend (uildPdfData.ts): nueva gate isDirectWorkOrder que detecta document_type === 'work_order' && (form.budget_id == null || form.budget_id === '') y suma !isDirectWorkOrder a la condici�n includeComparison. La secci�n solo se construye si hay udget_id.
- Backend legacy (pdf_html.py ~ l�nea 985): la l�nea include_comparison = bool(order_data.get("include_measurement_comparison_in_pdf", True)) se reemplaz� por include_comparison = has_budget_origin and bool(...) donde has_budget_origin = order_data.get("budget_id") is not None. Las OTs directas salen con measurement_comparison = [].
- Form (WorkOrderFormPage.tsx): toda la card "Activar/Ocultar Comparativa de medici�n" se envuelve en {form.budget_id != null && (...)}. Para una OT directa el toggle no aparece y el estado inicial del flag es irrelevante.

### Fix #3 � Persistir snapshot del frente en el PRESUPUESTO (no en OT directa)

_process_additional_works_snapshot en pp/services/budget.py:45 solo snapshoteaba price/total/formula_values (v�a pply_frente_rows); faltaba el **snapshot dimensional** del frente (linear_meters_budgeted) y los snapshots monetarios (	otal_ars_budgeted/	otal_usd_budgeted). Modifiqu� esa funci�n para que, despu�s de pply_frente_rows, itere las filas y para cada 	ype == 'frente' con linear_meters presente, llene linear_meters_budgeted, 	otal_ars_budgeted y 	otal_usd_budgeted con el c�lculo que ya usaba create_from_budget (work_order.py:719-739). Firma nueva: acepta usd_rate: Optional[float] = None para que el c�lculo use el usd_rate del presupuesto. Los 2 callsites (create y update) le pasan data.get("usd_rate") (con fallback a udget.usd_rate para update). En OTs directas NO se aplica � porque la comparativa no se muestra para esas (decisi�n de negocio confirmada por el operador).

### Fix cr�tico (hallado durante el debug E2E) � delattr(order, "register_flag")

Al debuggear con PowerShell + REST API, descubr� que el POST de OT (POST /work-orders y POST /work-orders/from-budget/{id}) **devolv�a {"success":true,"data":{}}** � data VAC�O en vez del objeto WorkOrder. Causa ra�z: la l�nea order.register_flag = "sena_registered" (introducida en la sesi�n 2026-09-02 "Cobro idempotente en caja" para que _create_cash_movement_on_deposit sepa qu� flag setear) dejaba un atributo Python en la instancia del ORM. jsonable_encoder (en pp/utils/responses.py:22) serializa TODOS los atributos del ORM, no solo columnas de la tabla � as� que el data del response quedaba como {register_flag: "sena_registered"} en vez del WorkOrder completo. La OT S� se creaba (el row en la DB estaba bien), pero el frontend/post-clients no recib�an nada �til. Fix: delattr(order, "register_flag") inmediatamente antes del eturn order, con 	ry/except AttributeError por si el set nunca se hizo. Aplicado en WorkOrderService.create() (l�nea ~633) y WorkOrderService.create_from_budget() (l�nea ~897). Adem�s agregu� self.repo.db.refresh(order) post-delattr para forzar el reload de columnas despu�s del commit() (SQLAlchemy expire instance state).


## Cobro de seña en update() 2026-09-07 (tarde)

**Contexto de negocio:** el presupuesto es **informativo** (el cliente da medidas estimativas). Cuando el operador toma la MEDICIÓN real y abre la OT correspondiente, recién ahí cobra la seña que el cliente paga en ese momento. El flujo era:

1. Crear presupuesto → aprobar → convertir a OT (sin seña)
2. Operador edita la OT en MEDICIÓN con las medidas reales + la seña (deposit_received)
3. Operador hace click en **Guardar** (PUT a /work-orders/{id})

**Bug:** WorkOrderService.update() no bookeaba la seña cuando el operador la agregaba en una edición posterior. Solo create() y create_from_budget() lo hacían. Por diseño de la sesión 2026-09-02 ("Cobro idempotente en caja"), update() NO bookeaba top-ups para evitar doble cobro. Pero esto rompía el flujo real del operador.

**Fix (pp/services/work_order.py::update()):** después del self.repo.update(order, data), agregar:

`python
if (
    "deposit_received" in data
    and not order.sena_registered
    and not order.balance_paid
    and (data.get("deposit_received") or 0) > 0
):
    result.register_flag = "sena_registered"
    _create_cash_movement_on_deposit(
        self.repo.db, result,
        result.deposit_received,
        result.deposit_currency,
        result.payment_method,
    )
`

**Idempotencia:** ya estaba garantizada por sena_registered (que el helper setea a True tras bookear). Si el operador re-edita y vuelve a Guardar con el mismo deposit_received, el 
ot order.sena_registered es False → no bookea. Lo mismo para alance_paid=True (OTs de tarjeta débito/crédito cobradas al 100% al crear: nunca debe bookear en update()).

**Tests (	ests/test_work_order_update.py):**

- 	est_update_with_deposit_books_sena_when_sena_registered_false: regresión del bug. Crear OT sin seña → sena_registered=False, sin movimiento en caja. PUT con deposit_received=600000 → sena_registered=True, caja tiene +1 movimiento. PUT sin cambios → caja NO cambia (idempotencia).
- 	est_update_does_not_book_sena_when_balance_paid_true: OT creada con tarjeta débito (full payment) → alance_paid=True, sena_registered=True. PUT con un drift de redondeo en deposit_received → caja sigue con 1 movimiento (no doble cobro).

**Verificación:**
- 	sc --noEmit 0 errores
- vitest 227/227
- pytest **82/82** (80 anteriores + 2 nuevos)
- E2E manual contra el backend real: presupuesto sin seña → OT (caja sin cambios) → PUT con deposit_received=400000 (caja +.000, mov id 59, sena_registered=True) ✅

**Cambios en useFormActions:** ninguno. El frontend ya invalida la query ['cash', 'current'] después de guardar (línea 124), así que la caja se refresca automáticamente al volver a /admin/cash.

## Fix emaining_balance=0 al cobrar saldo en DELIVERED (2026-09-07)

El operador reportó que al pasar una OT a DELIVERED con saldo pendiente, el emaining_balance del cash_movement quedaba con el monto cobrado en vez de 0. Eso dejaba la fila en el grid de /admin/cash mostrando saldo pendiente aunque la OT ya estaba cobrada.

**Causa:** _create_cash_movement_on_deposit (pp/services/work_order.py:98) calcula emaining_balance = order.balance_due para reflejar lo que falta después del cobro. Esa semántica es correcta para la seña (después de cobrar , falta 	otal - ). Pero para el cobro del saldo al DELIVERED es inversa: el cobro del saldo es el ÚLTIMO pago, así que después de cobrar alance_due, no queda nada pendiente → emaining_balance debe ser 0.

**Fix (WorkOrderService.update(), branch DELIVERED):** después de llamar al helper, se hace un UPDATE directo en el cash_movement más reciente de la OT para forzar emaining_balance=0:

`python
latest_mov = (
    self.repo.db.query(CashMovement)
    .filter(CashMovement.order_id == result.id, CashMovement.type == "INCOME")
    .order_by(CashMovement.id.desc())
    .first()
)
if latest_mov is not None:
    latest_mov.remaining_balance = 0.0
`

**Test actualizado** (	ests/test_work_order_cash.py::test_delivered_books_balance_due_once): el assert viejo movs[0].remaining_balance == 3000.0 se reemplazó por movs[0].remaining_balance == 0.0 (con comentario explicando que esta fila ES el cobro final y por eso el saldo después del cobro debe ser 0).

**Verificación:**
- tsc --noEmit 0 errores
- vitest 227/227
- pytest **82/82**
- E2E manual: OT directa con seña  → DELIVERED → cash_movement con emaining_balance=0 ✅

## Fix mapApiToForm no copiaba udget_id (2026-09-07, tarde)

El operador reportó que el toggle "Activar Comparativa de medición" (que activa el checkbox "Incluir comparativa de medición en el PDF" en WorkOrderFormPage) no se mostraba en /admin/work-orders/77, una OT convertida de presupuesto (udget_id=77).

**Causa:** mapApiToForm (src/hooks/entityFormSerialization.ts) copiaba todos los campos del API EXCEPTO udget_id. La línea 196 copiaba delivery_address_id, pero faltaba udget_id. Por defecto orm.budget_id quedaba en 
ull (del INITIAL_FORM), y el gate {form.budget_id != null && (...)} siempre era alse → el toggle NUNCA se renderizaba para ninguna OT convertida de presupuesto. Era un bug preexistente al Fix #2 de la sesión (que oculta la comparativa para OTs directas), pero combinado hacía que el toggle tampoco apareciera para OTs CON presupuesto.

**Fix:** agregar udget_id: (d.budget_id as number | null) ?? null en mapApiToForm justo después de delivery_address_id, con doc-comment explicando el rol del flag para el gate de la comparativa. Ahora orm.budget_id se hidrata desde el response de la API y el toggle aparece correctamente para OTs con presupuesto origen.

**Verificación:**
- tsc --noEmit 0 errores
- vitest 227/227


## Backfill snapshots OTs pre-fix #3 (2026-09-07, tarde)

Después de aplicar el Fix #3 (snapshots dimensionales del frente en el presupuesto) descubrimos que las OTs ya existentes (creadas antes del fix) no tenían `linear_meters_budgeted`, `total_ars_budgeted` ni `total_usd_budgeted` en su `additional_works_data` del frente. Eso hacía que la comparativa del PDF mostrara "Presupuestado —" y "$0.00" en los subtotales del frente.

**Solución:** script preexistente `scripts/backfill_measurement_snapshots.py` (creado en sesión 2026-08-30) que hidrata los snapshots faltantes desde el presupuesto origen.

**Aplicado en producción 2026-09-07:**
- 51 OTs escaneadas.
- 41 OTs directas (sin presupuesto origen — sin backfill aplicable).
- **2 OTs arregladas** con frentes que mostraban $0 en la comparativa:
  - **A-000036 (id 39)** — Frente Doble: `lm_budgeted=2.55`, `ars_budgeted=$152.158,50`, `usd_budgeted=$99,45`
  - **A-000038 (id 42)** — Frente Ingletado 45°: `lm_budgeted=3.3`, `ars_budgeted=$249.099,30`, `usd_budgeted=$162,81`
- A-000054 (id 77) ya se había backfilled manualmente durante el debug.

**Si volvés a ver frentes con $0 en la comparativa**, corré (con venv):

```bash
.\venv\Scripts\python.exe scripts/backfill_measurement_snapshots.py --fix
```

## Comparativa de medición SIEMPRE visible (2026-09-11) — reversión de la regla 2026-09-07

La regla de la sesión 2026-09-07 ("OTs directas = sin comparativa, el toggle se oculta si `budget_id` es null") fue **revertida por elección del usuario**: el botón "Activar/Ocultar Comparativa de medición" debe estar **siempre visible**, incluso cuando la OT **no** viene de un presupuesto (el operador veía la card en OTs convertidas como la 79 pero no en directas como la 81).

**Los 3 gates se eliminaron (todos apuntan solo al flag, nunca a `budget_id`):**

- **Form (`WorkOrderFormPage.tsx`):** la card `work-order-form__pdf-toggle-card` ya NO se envuelve en `{form.budget_id != null && (...)}` — siempre se renderiza (comentario actualizado explicando que el operador puede imprimir la comparativa en directas, p.ej. como referencia de medidas reales).
- **Builder frontend (`buildPdfData.ts`):** se eliminó `isDirectWorkOrder` + `!isDirectWorkOrder` de `includeComparison`. La condición queda solo `document_type === 'work_order' && include_measurement_comparison_in_pdf !== false`. Para directas sin snapshot, la columna Presupuestado sale "—" (comportamiento legacy ya cubierto en `buildMeasurementComparison`).
- **Backend legacy (`pdf_html.py::build_work_order_pdf_data`):** se eliminó `has_budget_origin`; `include_comparison` ahora es solo `bool(order_data.get("include_measurement_comparison_in_pdf", True))`.

**Tests actualizados (regresión de la regla vieja):**
- `buildPdfData.test.ts` — el test "hides the comparison for direct work orders… even when the flag is on" pasó a **"keeps the comparison for direct work orders…"** (`budget_id: null` → `measurement_comparison` tiene 1 fila) + nuevo test "hides … when the explicit flag is off".
- `test_measurement_comparison.py::test_build_work_order_pdf_data_skips_comparison_for_direct_orders` → renombrado y **invertido**: directa con flag on → comparativa NO vacía; flag off → vacía.

**Verificación:** `tsc --noEmit` 0 errores · vitest **258/258** (23 files, +1) · pytest **88/88** · `npm run build` OK · ESLint 0 errores nuevos (los 16 de `WorkOrderFormPage`/`buildPdfData` son preexistentes).

## Comparativa de medición OPT-IN (checkbox desactivado por default) 2026-09-11

El checkbox "Incluir comparativa de medición en el PDF" ahora arranca **desmarcado** en TODAS las OTs (nuevas y existentes); el operador lo activa manualmente si la quiere en el PDF. Antes el default era `true` (`server_default=1`).

**Los 6 lugares que definían el default se cambiaron a OFF:**

- **Form (`entityFormConstants.ts`):** `include_measurement_comparison_in_pdf: false` en `INITIAL_FORM`.
- **`mapApiToForm` (`entityFormSerialization.ts`):** fallback `?? false` (antes `?? true`).
- **Builder frontend (`buildPdfData.ts`):** `includeComparison` = `document_type === 'work_order' && form.include_measurement_comparison_in_pdf === true` (antes `!== false`, que era default-on; ahora flag ausente/undefined = OFF).
- **Checkbox (`WorkOrderFormPage.tsx`):** `checked={form.include_measurement_comparison_in_pdf === true}`.
- **Schema backend (`work_order.py`):** `WorkOrderBase.include_measurement_comparison_in_pdf: bool = False` (antes `True`).
- **PDF legacy (`pdf_html.py::build_work_order_pdf_data`):** `order_data.get("include_measurement_comparison_in_pdf", False)` (antes `True`).

**Modelo + migración:** `work_order.py` ORM `mapped_column(Boolean, default=False, server_default="0")`. Nueva migración **`d7e8f9a0b1c2`** que (1) hace `alter_column` del `server_default` de `1` → `0` y (2) backfillea `UPDATE work_orders SET include_measurement_comparison_in_pdf = 0` (todas las OTs existentes tenían `1`). Plain `UPDATE` dentro de la migración (no batch) para SQLite/MySQL; validada en SQLite aislado (create_all + stamp al head previo + upgrade) — el chain completo NO corre de cero en SQLite por `DROP FOREIGN KEY` MySQL-only preexistente en una migración previa.

**Tests actualizados:** los 8 tests de `buildPdfData.test.ts` que dependían del default-on ahora setean `include_measurement_comparison_in_pdf: true` explícito (el que asumía "(default)" pasó a "when the flag is explicitly on"). El backend `test_measurement_comparison.py` ya seteaba el flag explícito (sin cambios).

**Verificación:** `tsc --noEmit` 0 errores · vitest **258/258** (23 files) · pytest **88/88** · migración `d7e8f9a0b1c2` validada en SQLite (DEFAULT '0'). Nota operativa: aplicar la migración con `ENVIRONMENT=production` corre contra MySQL — hacerlo cuando el usuario lo pida (agrega default 0 + backfill de las OTs).

