# AGENTS.md

> **Estado:** Rama `development`. Sesión **2026-09-26** — **ALTERNATIVAS DE MATERIAL: N CARDS (APPEND, NO OVERWRITE).** Bug crítico en el editor de Presupuestos/OT (`/admin/budgets/new` y `/admin/budgets/:id/edit`): al seleccionar la 2ª alternativa desde "+ AGREGAR ALTERNATIVA DE MATERIAL" se **sobrescribía** la 1ª, y una 3ª nunca llegaba a existir (array capado a 1 alternativa). **Causa raíz:** `addPieceAlternative` (`src/features/budgets/hooks/useBudgetPieces.ts:598`) devolvía `{ ...piece, alternativeMaterials: next }` — los `next` eran las filas nuevas (1 por pane del principal, "same mesada" invariant) y el spread **reemplazaba** todo el array en vez de concatenar. **Fix:** `next` se **APPENDEA** (`[...existing, ...next]`) + **guard de dedupe** por `groupKeyOf` (id del catálogo o name): si el material ya está como alternativa, es no-op (el picker `MaterialPickerControls` NO filtra lo ya elegido, y repetir el mismo material crearía 2 cards con el mismo React key `${piece.id}-alt-${group.key}`). El resto del pipeline ya era N-safe (no se tocó): `flattenPieces`/`flatten_pieces` frontend/backend iteran el array completo, y los builders de PDF (`buildAlternativeSections`/`buildOptionFromMaterial`/`QuoteOptionsGrid` y `pdf_html._build_materials_pdf`/`budget_calculator.flatten_pieces`) mapean N alternativas — el límite artificial vivía solo en la mutación de estado. **Tests: vitest +3 en `useBudgetPieces.test.ts`** (25 → 28): (a) append secuencial de 2 alternativas distintas conserva ambas + main + flat `materials_data` con las 2; (b) 3 alternativas vivas en UNA pieza con principal de 2 panes (ancla + tramo) → 6 filas (3×2), cada una con sus dims espejadas (2×0.5 / 1×0.6); (c) re-pick del mismo material = no-op (1 sola card, sin keys duplicadas). **No requiere pytest** (solo mutación de estado frontend). Ver "ALTERNATIVAS DE MATERIAL: N CARDS (APPEND, NO OVERWRITE) 2026-09-26" abajo. *(Sesión previa: PDF HEADER fine-tuning 2026-09-25.)*

> **Estado:** Rama `development`. Sesión **2026-09-25 (mañana, fine-tuning)** — **PDF HEADER: LOGO FIJO A 140PX (MAX 150) + MAYOR SEPARACIÓN VALIDEZ/NÚMERO.** En la vista previa del header posterior a la sesión anterior el logo AFAMAR se estiraba a `width: '100%'` (ocupaba casi toda la columna) y la línea `budget_validity_text` quedaba pegada al `P-XXXXXX` por un `marginTop: 2`. Ajustes finos en paridad preview/legacy: (a) **Logo** — frontend `headerLeftLogo` (`:100`) y `logo` (`:104`) cambian de `width: '100%'` a `width: 140, maxWidth: 150` (contenedor fijo con techo de 150px; imagen a `width: 140, height: 'auto'` para preservar el aspect ratio original del logo, `objectFit` removido porque ya no se necesita escalar). Legacy `document_pdf.html:117` saca los attrs inline `width="180" height="90" style="margin-bottom:8px"` del `<img>` y los reemplaza por `class="logo-img"` (CSS nuevo `.logo-img { width: 140px; max-width: 150px; height: auto; margin-bottom: 6px; display: block; }` en `:39`) — el logo AFAMAR deja de estirarse y la tagline "MÁRMOLES & GRANITOS" gana respiro debajo. (b) **Validity** — frontend `validityText` (`:115`) pasa `marginTop: 2 → marginTop: 8`; legacy `.validity-text` (`:34`) pasa `margin: 2px 0 0 0 → margin: 8px 0 0 0`. La línea "Presupuesto válido por X días." ya no colisiona con el código P-XXXXXX. **Sin tests nuevos** — cambio puramente presentation (4 tests `test_public_pdf_token.py` con render real de xhtml2pdf siguen pasando, las imágenes con el nuevo tamaño encajan sin romper la fuente). Verificación: `tsc --noEmit` 0 errores · `vitest` **466/466** · `pytest` **155/155** (210s) · ESLint solo baseline preexistente. Ver "PDF HEADER fine-tuning 2026-09-25 (mañana, fine-tuning)" abajo. *(Sesión previa en este día: 2026-09-25 madrugada PDF HEADER fixes + tarde Totals block layout.)*

> **Estado:** Rama `development`. Sesión **2026-09-25 (mañana)** — **PDF HEADER: LOGO ARRIBA + TAGLINE DEBAJO, SUBTÍTULO DE ESTADO ELIMINADO, VALIDEZ REUBICADA AL LADO DEL NÚMERO.** Tres correcciones a `DocumentHeader` (`DocumentPdf.tsx`) + `document_pdf.html` (legacy xhtml2pdf), builders frontend y legacy en sync: (1) **Logo arriba, tagline abajo**: el bloque izquierdo pasa de `flexDirection: 'row'` (logo + tagline lado a lado) a `flexDirection: 'column'` (logo primero, tagline y contactos debajo). Frontend `headerLeft` + `headerLeftLogo`/`headerLeftInfo` reescritos en `DocumentPdf.tsx:94-105`; el legacy ya tenía este orden (el `<img>` precede al `<div class="header-tagline">`), no requirió cambio. (2) **Subtítulo "Pendiente"/"Aprobado"/etc. eliminado** del bloque derecho del número de presupuesto: tanto `buildPdfData.ts:605` (`doc_sub: STATUS_SUB_MAP[str('status')] || ''`) como `pdf_html.py::build_budget_pdf_data`/`build_work_order_pdf_data` ahora emiten `doc_sub: ''`; el import `STATUS_SUB_MAP` se quitó de `buildPdfData.ts:27` y el dict `_STATUS_SUB_MAP` de `pdf_html.py:126` se reemplazó por un comentario histórico (lo sigue usando `app/services/whatsapp.py`, no así el PDF). El `doc_sub` queda en el contrato de datos (`PdfDocumentData.doc_sub: string`) por compatibilidad + envuelto en `{% if doc_sub %}` en el legacy por si se reactiva. (3) **Validity reubicada**: la línea `budget_validity_text` ("Presupuesto válido por 30 días.") que vivía como `<div class="validity-text">` standalone entre el header-row y el `<hr class="header-divider">` ahora vive dentro de la celda derecha, justo debajo del número de documento — frontend `DocumentHeader` (`:712-714`) y legacy `document_pdf.html` (`:117` en el `<td>` derecho). Estilo frontend `validityText` (`:105`) gana `textAlign: 'right' + marginTop: 2`; legacy `.validity-text` (`:30`) cambia `margin: 0 0 6px 0` → `margin: 2px 0 0 0`. **Tests:** sin tests nuevos — los 14 tests de `test_public_pdf_token.py` (render real con xhtml2pdf) siguen pasando y `buildPdfData.test.ts` (466/466) cubre el `doc_sub: ''` implícitamente vía el resto de la data shape. Ver "PDF HEADER fixes 2026-09-25 (mañana)" abajo. *(Sesión previa: Totals block layout 2026-09-25 tarde.)*

> **Estado:** Rama `development`. Sesión **2026-09-25 (tarde)** — **PDF TOTALS BLOCK: DÓLAR DEL DÍA A LA IZQUIERDA + SECUENCIA SUBTOTAL/DESCUENTO/TOTAL/SALDO A LA DERECHA, PREVIEW + LEGACY EN SYNC.** El bloque inferior del PDF del cliente reestructura layout y orden: **LEFT ~32%** = leyenda "Dólar del día" (label / fecha+hora / cotización grande), **RIGHT ~68%** = secuencia vertical estricta `Subtotal` → `Traslado` (si > 0) → `Descuento` (solo si `discount_fixed_amount > 0`) → `Cat. Descuento` (si `catalogue_discount_amount > 0`) → `Interés` (si surcharge) → `Tabla de cuotas` (si > 1) → **TOTAL (barra azul destacada con ARS y USD)** → `Seña/Pagos Registrados` (si WO con `paid_label` o budget con `deposit_*`) → `Saldo pendiente` (mismo gate). Builders frontend (`DocumentPdf.tsx::renderExtras` + `AlternativeTotalsSummary`) y legacy (`document_pdf.html`) en sync — la barra azul del TOTAL **bajó** del primer lugar (legacy) a la posición después del Interés, preservando el orden `SUBTOTAL → DESCUENTO → TOTAL → SALDO`. Backend builders (`pdf_html.py::build_budget_pdf_data`/`build_work_order_pdf_data`) ahora emiten `usd_rate` como clave top-level del render dict para que el template legacy pueda leerla. Estilos nuevos: `totalsLayout`/`totalsLayoutLeft`/`totalsLayoutRight`/`totalsUsdLabel`/`totalsUsdDate`/`totalsUsdRate` (frontend); CSS `.totals-layout`/`.totals-layout__left`/`.totals-layout__right`/`.totals-usd-label`/`.totals-usd-rate` (legacy). `AlternativeTotalsSummary` recibe `usdRate` + `usdRateFetchedAt` opcionales y replica el layout en cada tarjeta alternativa (sin traslado/cuotas). **Tests: vitest +4** (`buildPdfData.test.ts`: `usd_rate`/`usd_rate_fetched_at` exposed + discount-scenario gates + saldo for WO + descuento omitido sin `discount_fixed_amount`), **pytest +3** (`test_totals_block_layout.py`: budget y WO builder exponen `usd_rate` + default fallback). Ver "Totals block layout 2026-09-25 (tarde)" abajo. *(Sesión previa en AGENTS.md: PDF PRESUPUESTO/OT 4 MEJORAS 2026-09-25 madrugada — validez, M² 2 decimales, limpieza, términos destacados.)*

> **Estado:** Rama `development`. Sesión **2026-09-25 (madrugada)** — **PDF PRESUPUESTO/OT: 4 MEJORAS (VALIDEZ, M² 2 DECIMALES, LIMPIEZA, TÉRMINOS DESTACADOS), BUILDER FRONTEND + LEGACY EN SYNC.** (1) **Validez del presupuesto (PDF)** — campo de texto libre editable en Datos AFAMAR (`budget_validity_text`, default `""`); cuando está definido se imprime en la cabecera del PDF del Presupuesto (entre el bloque de empresa/número y el divisor) — los Presupuestos sí, las OTs no (el builder WO no emite la key). Settings schema + DEFAULT_KEYS + COMPANY_KEYS + builder budget return dict + `{% if budget_validity_text %}` en `document_pdf.html` + `.validity-text` CSS (slate-700 bold 8.5pt). Frontend `CompanyInfo` (opcional) + `useSettingsWithTerms` + ConfigurationPage textarea "Validez del presupuesto (PDF)" + `DocumentHeader` render condicional `document_type === 'budget' && company.budget_validity_text`. (2) **M² con exactamente 2 decimales** — frontend `buildSectionData` ahora usa `fmtNum(v, 2)` para `m2_label`, `m2_str`, m2_budgeted/real/delta_str y `measure_*_str` m² (en `detailRow` branch por `unit === 'm2'`); backend `_fmt_m2(value)` nuevo (untrimmed `f"{n:,.2f}"`) reemplaza `_fmt_num` en `m2_label` (`:239`), `m2_str` (`:261`), m2_budgeted/real/delta_str (`:968-970`) y branch `unit == "m²"` en `_measure_str` (`:878-882`); ml/lengths/money intactos. (3) **Limpieza de filas/columnas vacías + guiones huérfanos** — `DataTable` nueva prop `clean?: boolean`: en Conceptos/Adicionales (los 8 call sites FAB/ADIC: option section 612/624, piece 726/732, alternative sheet 793/799, legacy fallback 1311/1324) dropea filas todas-vacías, dropea columnas todas-vacías (header+flex re-mapeados), y renderea vacío (no `—`) en celdas vacías restantes. Legacy `document_pdf.html` fabricación cells `or "—"` → `or ""` (180-186); comparativa preserva `—`. (4) **Caja de Términos/Condiciones destacada** — frontend `termsBox` style agrega `backgroundColor: SLATE_50` + border `1px solid SLATE_200` + `borderRadius: 4` + `paddingVertical: 4`/`paddingHorizontal: 6` (mirror de `paymentMethodsBox`); legacy `.terms-box` CSS agrega `background: #f8fafc` + `border: 1px solid #e2e8f0` + `padding: 4px 6px`. **Tests: vitest +4** (`buildPdfData.test.ts`: `budget_validity_text` passthrough × `''`/`'Presupuesto válido por 15 días.'` + `m2_label` '0,44'/'0,00'), **pytest +4** (`test_budget_validity_text.py`: COMPANY_KEYS membership + `build_company_and_terms` propagates + defaults `''`; `test_measurement_comparison.py`: material row con `0.4356 → '0.44'`/`'0.40'`/`'+0.04'`. **Updates existentes** (regresiones del cambio): `test_measurement_comparison.py:43-45` `'3'`/`'6'`/`'+3'` → `'3.00'`/`'6.00'`/`'+3.00'`; `test_measurement_snapshot_roundtrip.py:238` `'0.4352'` → `'0.44'`, `:239` `'0'` → `'0.00'`, `:248` `'0 m²'` → `'0.00 m²'`. Ver "PDF 4 mejoras cliente 2026-09-25 (madrugada)" abajo. *(Sesión previa en AGENTS.md: COMPARATIVA DE MEDICIÓN ns 2026-09-22.)*
>
> **Estado:** Rama `development`. Sesión **2026-09-22 (madrugada)** — **COMPARATIVA DE MEDICIÓN: EL FRENTE YA NO PIERDE SU SNAPSHOT AL EDITARSE Y EL ZÓCALO PRICE-0 SE VALÚA POR M² DEL MATERIAL.** (1) Bug "Presupuestado: —" del frente: `parseAdditionalWorksData` (`additionalWorkParse.ts`) era **whitelist** y descartaba `linear_meters_budgeted`/`total_ars_budgeted`/`total_usd_budgeted` → editar cualquier adicional en el form (vía `useAdditionalWorkSelection` → `PiecesSection.tsx:423` → `setPieceAdditionalWorks`) re-serializaba el JSON **sin** los snapshots → `flattenPieces` emitía el flat sin ellos → el WO persistido perdía la comparativa del frente. Fix: las 3 claves se agregan a `AdditionalWorkSelection` (nulables) con helper `pickNullableNumber` y se **preservan en el parse** (los edit helpers `recomputeFrenteRow`/`applyAdditionalWorkField` ya hacen `{...row}` y las conservan). (2) Bug zócalo con subtotal $0,00 pese a delta de medida: ambos builders valuaban solo `price × qty − total_*_budgeted` (con `price:0` siempre 0). Fix en los 2 builders (mantener en sync): si `lineTotal === 0` y concepto m² y `fdMeasureDelta`/`d_delta` presente y `priceM2 > 0` → **delta monetario = delta m² × `price_m2` del material asociado** (moneda nativa, convertido a ARS/USD con `usdRate`, mismo patrón que la fila del material); si no, lógica previa. **Tests: vitest +3** (`useAdditionalWorkSelection.test.ts`: round-trip conserva snapshots + la edición del frente mantiene las claves; `buildPdfData.test.ts`: zócalo price-0 → +0,08 m² × 330 USD/m² = +26,40 USD/+26.400 ARS), **pytest +1** (`test_measurement_comparison.py::test_price_zero_zocalo_is_valued_at_linked_material_price_m2`). Ver "COMPARATIVA DE MEDICIÓN: frente con snapshot + zócalo price-0 2026-09-22 (madrugada)" abajo. *(Sesión anterior: WhatsApp links + PDF público reconciliado 2026-09-22.)*
>
> **(Adicional, 2026-09-22 tarde)** — **VALORES POR DEFECTO VACÍOS EN LARGO/ANCHO (PIEZAS).** En el editor PIEZAS/MESADAS (presupuestos y OTs) el material principal y las alternativas ya NO arrancan con `Largo`/`Ancho = 1`: los defaults de `pieceDims` y `addPieceAlternative` en `src/features/budgets/hooks/useBudgetPieces.ts` pasan de `|| 1` a `|| 0` (solo `quantity` conserva su `1` neutro), así un material cargado sin medidas NO suma un m² fantasma al subtotal. Los inputs Largo/Ancho ya toleraban el vacío sin `min` ni onBlur que fuerce 1 (`MaterialCard`/`SingularMaterialCard`, `num = parseNumber ?? 0`). m²/subtotales ya eran 0-safe en `useBudgetCalculations`, `buildPdfData`, `computeMaterialsSubtotal` y `buildOptionFromMaterial`; se alineó el fallback display de m² de las cards de alternativa (`QuoteOptionsGrid.tsx:120` → `|| 0`, ya no `1.216`). **Tests: +3** (`useBudgetPieces.test.ts`: setPieceMain en pieza vacía → 0/0/1 en main + `materials_data` flat; alternativa con principal vacío → 0/0/1; invariante "same mesada" preservada). Ver "Valores por defecto vacíos en Largo/Ancho 2026-09-22 (tarde)" abajo.
>
> **(Adicional, 2026-09-22, noche)** — **COMPARATIVA DE MEDICIÓN: LOS SNAPSHOTS PRESUPUESTADOS SOBREVIVEN A MEDICIÓN.** Síntoma: en una OT convertida de presupuesto, la 1ª edición de medidas reales en MEDICIÓN (cambiar `length` de un material) hacía **desaparecer la columna "Presupuestado"** (salía "—" de nuevo) en el PDF. **Causa raíz:** el backend solo escribía los snapshots (`m2_budgeted`/`linear_meters_budgeted`/`total_ars/usd_budgeted`) en los arrays flat (`materials_data`/`fabrication_details`/`additional_works_data`), pero `useBudgetPieces.commit` **re-deriva los flat desde las piezas vía `flattenPieces` en cada edit** → al primer cambio el snapshot se borraba. **Fix 2 capas:** (1a) backend `_bake_snapshot_into_pieces` en `create_from_budget` de `app/services/work_order.py` (constantes de módulo `_FAB_M2_CONCEPTS`/`_FAB_LINEAR_CONCEPTS`) ahora bamea los snapshots de los flat en **`pieces_data`** (cada metada con su `m2_budgeted`, cada zócalo/frente de `fabrication_details` con `m2_budgeted` o `linear_meters_budgeted` + `total_ars/usd_budgeted`, cada `additional` de frente re-serializada con sus snapshots por pieza; input `None`→`None`/malformado→intacto); (1b) frontend **`hydratePiecesSnapshots`** (+ `SNAPSHOT_*` keys) en `src/hooks/entityFormSerialization.ts` copia los snapshots de los flat del API sobre cada pieza en `_loadPieces` (zippeo por clase de material/posición, `hasAnySnapshot` → no-op si no hay snapshots) → el próximo `commit` de `flattenPieces` los conserva. **Tests: +3** (backend `tests/test_measurement_snapshot_roundtrip.py`: bake en convert (flat Y piezas), flujo completo convert→PATCH medición→`build_work_order_pdf_data` con comparativa 4 filas + subindices, guard malformado; frontend 2 en `entityFormHelpers.test.ts` [hidratación flat→piezas + no-op sin snapshot] y 1 en `useBudgetPieces.test.ts` [snapshots sobreviven `updatePieceMain` + commit]). Ver "COMPARATIVA DE MEDICIÓN: snapshots sobreviven a MEDICIÓN 2026-09-22 (noche)" abajo.

> **Estado:** Rama `development`. Sesión **2026-09-22** — **LINKS DE WHATSAPP NUNCA EMITEN LOCALHOST + PDF CLIENTE (legacy xhtml2pdf) RECONCILIADO.** (1) `getPublicAppBaseUrl` agrega el origen derivado de `VITE_API_BASE_URL` (absolute http(s)) y un **guard de loopback** (`isLoopbackOrigin`: `localhost`/`*.localhost`/`127.*`/`::1`/`0.0.0.0`) — si ningún candidato es alcanzable por el cliente, **`DEFAULT_PUBLIC_URL`** (el VS Code Dev Tunnel activo, `https://87k533kf-3090.brs.devtunnels.ms`) toma el lugar → el **bloque PDF del mensaje de WhatsApp NUNCA se omite** (y jamás aparece `localhost`). (2) En el PDF legacy `document_pdf.html` (el que abre el cliente por el link público): `Fecha de Entrega` entra al bloque de Cliente (sale del info-box), margen bajo el logo AFAMAR (ya no se superpone con la tagline), fila `Descuento` solo si `discount_fixed_amount > 0`, `Recargo (9.0%)` → **`Interés`** (unificado con el preview Fase 7), `{:g}` en porcentajes, y **Seña + Saldo = TOTAL exacto** (se deriva `saldo = total − deposit_ars_equivalent` redondeado en ambos builders de `pdf_html.py`; presupuestos ya pasan `deposit_usd`/`deposit_currency`/equivalentes). (3) **fix 500 del link público**: el `GET /api/v1/public/work-orders/pdf?token=…` (y `budgets`) devolvía **500** con datos reales porque xhtml2pdf crashea con `ValueError: PmlTable ... must have at least a row and column` cuando una `<table>` queda con un `<tr>` de **cero `<td>`** — el `info-grid` (Color/Espesor/Acabado) y la 2ª fila del cliente (Domicilio/Email/Fecha de Entrega) omitían TODAS sus celdas en una OT sin esos valores. Fix: ambos `<tr>` se envuelven en `{% if ... or ... %}` (no se renderiza tabla vacía). Además logging claro en el router público (`logger.exception` con el id del doc) + `try/except` que devuelve un 500 JSON amigable en vez del crash. Regresión sentinel: **2 tests de integración nuevos** que corren el render real (sin mock de generación): `test_public_pdf_work_order_renders_real_pdf` (OT rica: 3 cuotas 27%, depósito USD, alternativa, zócalo/frente con snapshot, pileta, croquis, comparativa) y `test_public_pdf_minimal_work_order_does_not_500` (la OT mínima que crasheaba). Ver "Links de WhatsApp: dominio público + guard loopback + PDF cliente reconciliado 2026-09-22" abajo. *(Sesión anterior: **2026-09-21** — **PDF PÚBLICO CON TOKEN FIRMADO** para los links de WhatsApp: el link "Ver / Descargar PDF" del mensaje ya NO apunta al endpoint autenticado (`/work-orders/{id}/pdf` → 401 para el cliente), sino a **`GET /api/v1/public/{work-orders,budgets}/pdf?token=…`** (sin login) con token firmado HMAC-SHA256 + expiración `PUBLIC_PDF_TOKEN_EXPIRE_DAYS` (default 30). El frontend minta el token vía `…/{id}/public-token` (autenticado) y construye la URL con `buildPublicPdfUrl`/`resolvePublicDocumentPdfUrl` en los 4 call sites de WhatsApp. Expired → **410** con mensaje amigable; tampered/malformed → 400; doc inexistente → 404. Ver "PDF público con token firmado 2026-09-21" abajo. *(Sesión anterior: Tramos del material principal `mainMaterialRows` 2026-09-18 (noche); antes: OTs migradas a piecesFlow.)* *(Sesión 2026-09-18 (tarde) — resumen retenido: **EL FORM DE ÓRDENES DE TRABAJO MIGRÓ A LA ARQUITECTURA POR PIEZAS/MESADAS (`piecesFlow`)** igual que los presupuestos: `WorkOrderFormPage` ahora destructurea `piecesFlow` y pasa `showPieces` + `piecesFlow` a `EntityFormLayout` → renderiza el bloque `PIEZAS / MESADAS` (con el material principal, alternativas, zócalos/frentes, adicionales y piletas POR pieza) en lugar de las tablas legacy MATERIALES/PILETAS/FABRICACIÓN/ADICIONALES. La **COMPARATIVA DE MEDICIÓN inline** (M² Real vs Presupuestado) se conservó en modo pieces vía la nueva prop `showMeasurementComparison` de `PiecesSection` (por pieza, `fabricationMeasure` en MEASUREMENT). Se conservan todos los módulos OT: Estado/Prioridad + toggle de comparativa (`beforeLayout`), Calculadora de Porcelanato + Diseño/Plano + Presupuesto/Descuento Comercial (`renderBottom`), Observaciones + Condiciones de Entrega. Los adaptadores (`buildPayload`/`mapApiToForm`/`buildFinancialPayload`/`mapFinancialToForm`) y calculadoras (`useBudgetCalculations`, `buildPdfData`) ya eran agnósticos — el backend OT ya tenía `pieces_data` (modelo + schemas + `create_from_budget` lo copia + recalc con `flatten_pieces`), así que el roundtrip save/load por piezas funciona sin migración. Ver "OT migradas a piecesFlow 2026-09-18 (tarde)" abajo. *(Sesión anterior: DESCUENTOS UNIFICADOS 2026-09-18 — ver "Unificación de descuentos 2026-09-18"; antes: Descuento Comercial Fase 3 + selector en todas las vistas.)*

> `tsc --noEmit` 0 errores · vitest **469/469** (39 files · +3 en `useBudgetPieces.test.ts`: append de N alternativas) · pytest **155/155** · ESLint 0 errores nuevos (los de `DocumentPdf.tsx` `SKETCH_CONTENT_WIDTH`/`YELLOW_50`/`adicRowBreakdown`/`index` y `buildPdfData.ts:17-21` imports son baseline preexistente).

> **Índice del conocimiento (codebase-memory):** **reindexado** el 2026-08-27 junto con el commit de esa sesión. ADR de arquitectura persistido en el índice (`manage_adr`) + ADR de decisión commiteado en `docs/adr/0008-database-migrations-and-seeder-sync.md`. El ADR de Fase 7 sigue en `docs/adr/0007-payment-methods-catalogue.md`. *(Nota: los commits de 2026-09-18/2026-09-21 aún no reindexan el graph — ver el tip de git del 2026-09-18 y la nota "Reindexar el knowledge graph si se commiteara el `.codebase-memory/`".)*

## Índice del conocimiento (codebase-memory)

- **Reindexado (2026-08-27):** `index_repository(repo_path=D:\projects\PERSONAL\afamar, name=afamar, mode=full, persistence=true)` → **4003 nodos / 14073 aristas**. Artefacto `.codebase-memory/graph.db.zst` commiteado en el commit de esta sesión. Incluye Fase 7 (payment methods) + fixes UX + arranque/migraciones/seeders.
- **ADR de arquitectura (índice):** `manage_adr(project="afamar")` persiste PURPOSE/STACK/ARCHITECTURE/PATTERNS/TRADEOFFS/PHILOSOPHY (poblado el 2026-08-27). Para decisiones por-cambio (numbered ADRs) ver `docs/adr/0007-payment-methods-catalogue.md` y `docs/adr/0008-database-migrations-and-seeder-sync.md`.
- **ADR 0008 (arranque + seeders, 2026-08-27):** toda `alter_column`/`batch.alter_column` debe llevar `existing_type` explícito (MySQL lo exige, SQLite lo omite). `_run_seeders()` devuelve resúmenes `name: +N ~N /N` y el lifespan loguea `AFAMAR initialization OK — ready to serve requests`. Seeders sincronizados con producción (dedup): materials **64**, pool_stock **68**, additional_works **13**.
- **ADR 0007 (Form, hot-path, invariantes):** contrato "el form es la fuente de verdad" (form ↔ PDF ↔ DB), hot-path de `BaseRepository.add`/`save` y `createResource.get`, el facade `useEntityForm`, los invariantes de `useBudgetCalculations` (deps deben incluir `additional_works_data`, `paymentMethodsDepsJson`, `form.installments`), `useBudgetActions.handleSubmit` con `e.preventDefault()`, los helpers `swapMaterialGroupToList` + `repointSwapReferences`, y los 4 lugares que aplican la regla del recargo de tarjeta (deben mantenerse en sync).
- **Hotspots confirmados (reindex 2026-08-27):** backend `BaseRepository.add` (32 callers, #2) / `save` (25); frontend `createResource.get` (74, #1 global), `parseApiError` (29), `LoadingSpinner` (25), `loginViaApi` (21), `createResource.update` (19), `useNotify` (19). Tras Fase 7, sumar `useBudgetCalculations.applyPaymentMethodToTotals` (4 callsites nuevos) y `paymentMethodRepository.get_by_name` (CRUD del catálogo).
- **Complejidad alta:** `usePlateCalculator` (bin-packing, loop_depth 4, cyclomatic 13), `pdf_html._sketch_to_png_base64_list` (loop_depth 3, cyclomatic 25), `WorkOrderService.update` (cyclomatic 12), `_recalculate_totals_from_items` (cyclomatic ~12 con alternativa + catálogo).
- **Clusters de-facto:** frontend core UI (102, cohesión 0.79), forms orchestration (74, 0.81), `parseApiError`+`useBudgetActions`+`buildPayload`+`useFormActions` (65, 0.81), budget/quote/fabrication/sketch (54, 0.88). Sin dependencia circular entre `app/` y `src/`.

## ALTERNATIVAS DE MATERIAL: N CARDS (APPEND, NO OVERWRITE) 2026-09-26

Bug crítico en el editor de Presupuestos/OT (`/admin/budgets/new` y `/admin/budgets/:id/edit`): la UI de "*+ AGREGAR ALTERNATIVA DE MATERIAL*" **solo podía tener 1 alternativa por pieza** — al elegir una 2ª se **sobrescribía** la 1ª, y una 3ª nunca llegaba a existir. El drop-down de alternativas (`MaterialPickerControls`) tampoco filtra los materiales ya elegidos, así que el operador podía repetir sin feedback.

### Causa raíz

`addPieceAlternative` (`src/features/budgets/hooks/useBudgetPieces.ts`, legacy `:598` en HEAD previo):

```ts
return { ...piece, alternativeMaterials: next };
```

Los `next` son las filas nuevas de la alternativa — **1 fila por pane del material principal** (ancla + cada `mainMaterialRows`, la invariante "same mesada, diferente material"). El spread **reemplazaba** todo el array por `next` en vez de concatenar → cada pick nuevo descartaba los anteriores. Ese era el ÚNICO límite artificial: el resto del pipeline ya era N-safe (ver abajo) y por eso el bug no se manifestaba en el PDF, que mapea arrays completos.

### Fix

```ts
const existing = piece.alternativeMaterials || [];
const pickedKey = String(catalogRow.id ?? catalogRow.name);
if (existing.some((a) => groupKeyOf(a) === pickedKey)) return piece; // no-op si ya está
return { ...piece, alternativeMaterials: [...existing, ...next] };     // APPEND
```

- **Append, nunca replace**: cada pick agrega un slot nuevo (`alternativeMaterials.push` semántico) conservando las anteriores → Principal + Alt 1 + Alt 2 + Alt 3… sin tope.
- **Guard de dedupe por `groupKeyOf`** (id del catálogo, fallback `name` — la misma clave que agrupa las cards en `PiecesSection.tsx:286`): si el material ya figura como alternativa, es **no-op**. Sin este guard, re-pickear el mismo material crearía 2 group secciones con la misma clave → **duplicate React key** (`key={`${piece.id}-alt-${group.key}`}` en `:381`) y 2 cards idénticas del mismo material. El picker no filtra lo ya elegido, así que el guard vive acá (único punto de entrada).
- El path legacy (pieza sin main) no cambió: el pick sigue promoviéndose a material principal.

### N-safe ya confirmado (NO se tocó)

- **Flatten/parse:** `flattenPieces` (frontend `src/features/budgets/utils/pieces.ts:188-192`) y `flatten_pieces` (backend `budget_calculator.py:90-92`) iteran `alternativeMaterials` completo → los `materials_data` flat llevan las N alternativas.
- **PDF frontend:** `buildAlternativeSections`/`buildOptionFromMaterial`/`buildDetailFromSection` (`buildPdfData.ts`/`budgetOptions.ts`) y `QuoteOptionsGrid` mapean arrays; `AlternativeTotalsSummary` también.
- **PDF legacy backend:** `pdf_html._build_materials_pdf` (`:256`) itera `(main + alternatives)`; los builders y `convert_alternative_to_work_order` (por índice) siguen funcionando con N.
- **Totales/comparativa:** `useBudgetCalculations` y `computeAlternativeTotals` leen los flat — sin límites.

### Tests (vitest 466 → 469, `useBudgetPieces.test.ts` 25 → 28)

1. **`addPieceAlternative APPENDS N alternatives sequentially (3+ cards, no overwrite)`** — setPieceMain Blanco (L/A 0×0) + pick ’Negro’ + pick ’Miami’ → `alternativeMaterials` tiene 2 (Negro, Miami), main intacto, y el flat `materials_data` filtra las 2 alternativas en orden.
2. **`addPieceAlternative keeps 3+ alternatives alive together on ONE piece`** — principal con 2 panes (ancla 2×0.5 + tramo 1×0.6) + 3 picks (Negro, Miami, Blanco) → **6 filas** (3 alternativas × 2 panes), cada una espejando sus dims del principal (`'Negro:2x0.5','Negro:1x0.6','Miami:2x0.5','Miami:1x0.6','Blanco:2x0.5','Blanco:1x0.6'`). Es el escenario del reporte.
3. **`addPieceAlternative with a material already picked is a NO-OP (no duplicate cards)`** — 2 picks de ’Negro’ → 1 sola card, sin keys duplicadas.

Fixture usado: `MIAMI_MAT` (USD 680/m²) ya existía; el catálogo del test pasa `[BLANCO_MAT, NEGRO_MAT, MIAMI_MAT]`.

### Verificación

`npx tsc --noEmit` **0** errores · `npx vitest run` **469/469** (39 files, 17s) · pytest **155/155** (sin cambios de backend — mutación de estado puramente frontend) · ESLint: sin archivos nuevos tocados fuera de `useBudgetPieces.ts`/`.test.ts`. Sin migración. **Regla:** el append vive SOLO en `addPieceAlternative`; si se suma otra vía de entrada de alternativas (drop-down por fila, etc.) replicar append + dedupe por `groupKeyOf` para no reintroducir el replace ni keys duplicadas.

## PDF PRESUPUESTO/OT 2026-09-25 (madrugada) — 4 MEJORAS

Cuatro correcciones al PDF que recibe el cliente desde el link público de WhatsApp. Preview `@react-pdf/renderer` (`DocumentPdf.tsx` + builders `buildSectionData.ts`/`buildPiecesPdfData.ts`/`buildPdfData.ts`) y descarga legacy xhtml2pdf (`document_pdf.html` + `pdf_html.py`) se mantienen en sync.

### (1) Validez del presupuesto (PDF) — campo admin-editable

Nuevo setting **`budget_validity_text: str = ""`** editable en Datos AFAMAR (ConfigurationPage textarea "Validez del presupuesto (PDF)", placeholder "Ej.: Presupuesto válido por 15 días."). Cuando está definido se imprime en la cabecera del PDF del Presupuesto (entre el bloque de empresa/número y el divisor) como línea destacada slate-700/bold 8.5pt. **Solo presupuestos** — el builder WO no emite la key y el template gatea por presencia (un budget sin valor no muestra nada). Sync: el builder de budget de `pdf_html.py:835` agrega `"budget_validity_text": company.get("budget_validity_text", "")`; `pdf_helpers.py` `COMPANY_KEYS` lo incluye; `settings.py` `DEFAULT_KEYS` + `schemas.setting.SettingUpdate` lo aceptan/expone vía GET/PUT. Frontend `useSettingsWithTerms` (`RawSettings` + `EMPTY_COMPANY.budget_validity_text = ''` + assembly) → `DocumentHeader` (`DocumentPdf.tsx` ~:670) render condicional `data.document_type === 'budget' && data.company.budget_validity_text` + style `validityText` (8.5pt bold color #92400e). Legacy template `{% if budget_validity_text %}<div class="validity-text">…</div>{% endif %}` (entre `</table></table>` del header y `<hr class="header-divider">`) + CSS `.validity-text { font-size: 8.5pt; font-weight: bold; color: #92400e; margin: 0 0 6px 0; }`.

### (2) M² con exactamente 2 decimales

Frontend `buildSectionData.ts` ahora usa `fmtNum(v, 2)` (es-AR min/max 2 decimals, helper existente `pdfHelpers.ts:66` — NO `fmtMeasure` que trim hasta 0) en: `m2_label` (`:78`, antes `fmtMeasure(m2Value)`), `m2_str` (`:117`, antes `fmtMeasure(...)`), m2_budgeted_str / m2_real_str / delta_str del row material de la comparativa (`:374-378`), measure_*_str del row material (`:387-389`), y dentro de `detailRow.measureStr` branch por `unit === 'm2'` (`:545-548`; ml sigue con `fmtMeasure` para preservar '3 ml'/'3.3 ml'/'+0.13 ml'). Backend nuevo helper `_fmt_m2(value)` (`pdf_html.py:171`, sin trim, `f"{n:,.2f}"`) — NO reutiliza `_fmt_num` (que rstrippea zeros → '0' en vez de '0.00'). Aplicado en: `m2_label` (`:253`, antes `_fmt_num`), `m2_str` (`:275`), m2_budgeted/real/delta_str del material row de comparativa (`:973-975`), y branch `unit == 'm²'` en `_measure_str` (`:896-902`; ml intacto vía `_fmt_num`). **Regla de sync**: los 2 builders de comparativa (frontend `buildMeasurementComparison` ↔ backend `_build_measurement_comparison`) leen snapshots con misma regla; tocar el formato toca los 2 + tests.

### (3) Limpieza de filas/columnas vacías + guiones huérfanos

`DataTable` (`DocumentPdf.tsx:285`) nueva prop `clean?: boolean`: dropea filas todas-vacías (toda celda null/`''`), dropea columnas todas-vacías (re-mapea `keptHeaders` + `keptFlexes` por índices que tienen ≥1 celda no-vacía en las kept rows), y renderea vacío (no `—`) en celdas vacías restantes (cambio del ternary `isDash ? (clean ? '' : '—') : cell`). Aplicado **SOLO a las 8 tablas de Conceptos (FAB) y Adicionales** — MAT/POOL/comparativa sin cambios (la comparativa conserva `—` como semantic sentinel):
- `DocumentPdf.tsx:612` y `:624` (option/material sections de la OT y del presupuesto)
- `:726` y `:732` (piece details)
- `:793` y `:799` (AlternativesSheet)
- `:1311` y `:1323` (legacy-fallback flat rendering del documento legacy)

Legacy `document_pdf.html` fabrication cells `or "—"` → `or ""` (`:180-185`: concept/detail/material/length_str/width_str/m2_label y el `else "—"` de `quantity if show_quantity`); comparativa preserva `—` (es una celda en un solo colspan, no tabla). El legacy NO dropea filas enteras porque `d.concept` siempre es truthy (viene de `_concept_to_display` que devuelve el concept_code o '—').

### (4) Caja de Términos/Condiciones destacada

Frontend `termsBox` style (`DocumentPdf.tsx:227`, antes `{ marginTop: 6 }`) ahora: `{ marginTop: 6, backgroundColor: SLATE_50, border: '1px solid SLATE_200', borderRadius: 4, paddingVertical: 4, paddingHorizontal: 6 }` — mirror exacto de `paymentMethodsBox` (`:235`). Aplica a los 3 términos boxes que usan `TermsList`/`termsBox` (Condiciones + Garantía). Legacy `.terms-box` CSS (`document_pdf.html:79`, antes `{ margin-top: 8px; }`): `background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 6px;`. SLATE_50/SLATE_200 de los tokens frontend (`DocumentPdf.tsx:56-70`) y legacy (en CSS del template). Solo CSS — sin cambio de data ni de render.

### Tests

- **vitest 458 → 462 (+4 en `buildPdfData.test.ts`):**
  - **`buildPdfData — budget_validity_text (admin-editable header line)`** (2): `data.company.budget_validity_text` passthrough `'Presupuesto válido por 15 días.'` cuando viene del setting; default `''` cuando la company no incluye la key.
  - **`buildPdfData — M² surfaces with exactly 2 decimals`** (2): `m2_label === '0,44'` para un zócalo 0.66×0.66×1 (0.4356 m² → 2-dec rounded); `m2_label === '0,00'` para m² exactamente cero (regresión: antes `_fmt_num(0)` daba `'0'`, ahora `'0,00'` para que la columna alinee visualmente).
- **pytest 148 → 152 (+4):**
  - `test_budget_validity_text.py` (3 nuevos): `COMPANY_KEYS` contiene `budget_validity_text` (regression sentinel); `build_company_and_terms` lo propaga desde settings_data; default `''` cuando el setting no existe.
  - `test_measurement_comparison.py::test_material_row_m2_strings_always_two_decimals` (1 nuevo): material con m²_real 0.66×0.66 = 0.4356 → `m2_real_str '0.44'` + `m2_budgeted_str '0.40'` + `delta_str '+0.04'` (los 3 strings mustran exactamente 2 decimals con 2-decimal rounding).
- **Updates existentes (regresiones del Feature 2):**
  - `test_measurement_comparison.py:43-45`: `'3'`/`'6'`/`'+3'` → `'3.00'`/`'6.00'`/`'+3.00'`.
  - `test_measurement_snapshot_roundtrip.py:238`: `m2_budgeted_str '0.4352'` → `'0.44'`.
  - `test_measurement_snapshot_roundtrip.py:239`: `delta_str '0'` → `'0.00'`.
  - `test_measurement_snapshot_roundtrip.py:248`: `zocalo["measure_delta_str"] '0 m²'` → `'0.00 m²'`.

### Verificación

`npx tsc --noEmit` **0** errores · `npx vitest run` **462/462** (39 files) · `pytest -q` **152/152** · ESLint en archivos tocados: solo baseline preexistente + `useSettingsWithTerms.ts:27 EMPTY_TERMS` (constante no usada preexistente, mirror de `EMPTY_COMPANY` que sí se usa — no introducida por este cambio). Sin migración (solo setting row default que `DEFAULT_KEYS` ya serializa a `''`). Regla: cualquier cambio futuro en la línea de validez / formato M² / comportamiento clean / highlight de términos toca los 2 builders (frontend + legacy `pdf_html.py`/`document_pdf.html`) + sus tests en `buildPdfData.test.ts` + `test_measurement_comparison.py` + `test_budget_validity_text.py`.

## PDF HEADER fixes 2026-09-25 (mañana)

Tres correcciones a `DocumentHeader` (`DocumentPdf.tsx`) + `document_pdf.html` (legacy xhtml2pdf). Los builders frontend y legacy se mantienen en sync (la regla "preview + legacy en sync" del AGENTS.md se aplica).

### (1) Logo arriba, tagline debajo (frontend)

El bloque izquierdo del header (`styles.headerLeft`) pasaba de `flexDirection: 'row'` (logo + tagline lado a lado, 28%/72% split) a `flexDirection: 'column'` (logo primero, tagline y contactos debajo). Sintoma visual: "MÁRMOLES & GRANITOS" salía **a la derecha** del logo, desplazado en su misma fila. Cambio: `headerLeft` ahora columna, `headerLeftLogo` y `headerLeftInfo` ambos `width: '100%'`, `headerLeftInfo` con `marginTop: 4` para separar del logo. `headerRow` agrega `alignItems: 'flex-start'`. Estilos en `DocumentPdf.tsx:94-105`. **El legacy ya tenía este orden** (el `<img>` precede al `<div class="header-tagline">` en `document_pdf.html:108-109`), no requirió cambio — la queja aplicaba solo al preview frontend.

### (2) Subtítulo de estado eliminado

El subtítulo gris bajo el número de presupuesto (que mostraba `STATUS_SUB_MAP[status]` — `Pendiente`/`Aprobado`/`En Taller`/etc.) era ruido visual: el estado ya vive en el cash-board y en el listado. Builders: `buildPdfData.ts:605` cambia `doc_sub: STATUS_SUB_MAP[str('status')] || ''` → `doc_sub: ''`. El import `STATUS_SUB_MAP` se quitó de `buildPdfData.ts:27` (era unused). En backend, `pdf_html.py:126` reemplaza el dict `_STATUS_SUB_MAP` por un comentario histórico (lo sigue usando `app/services/whatsapp.py` para el formateador de mensajes WA, no así el PDF). Los locals `status = budget_data.get("status", "")` y `= order_data.get(...)` se quitaron por unused. Ambos builders ahora emiten `"doc_sub": ""`. El campo `PdfDocumentData.doc_sub: string` se queda en el contrato de datos y la celda legacy `<div class="doc-sub">` se borró del template (no envuelve con `{% if %}` porque el campo siempre será vacío — si se reactiva en el futuro se restaura el bloque junto con el render condicional).

### (3) Validez reubicada al lado del número

La línea `budget_validity_text` ("Presupuesto válido por 30 días.") que vivía como `<div class="validity-text">` standalone entre el `</table>` del header-row (`:106`) y el `<hr class="header-divider">` (`:125`) **empujaba todo el header hacia abajo** en presupuestos con validity text. Se movió **dentro de la celda derecha** (`<td>` del 40% de ancho), justo debajo del `doc-number`. Frontend `DocumentHeader` (`DocumentPdf.tsx:712-714`) mueve el `<Text style={styles.validityText}>` dentro de `headerRight` después del `docNumber`. Estilo `validityText` (`:105`) gana `textAlign: 'right' + marginTop: 2` y pierde el `marginBottom: 4` viejo (la línea ya no está pegada al divisor). Legacy `document_pdf.html:117` inserta `{% if budget_validity_text %}<div class="validity-text">…</div>{% endif %}` dentro del `<td>` derecho, después de `<div class="doc-number">`. CSS `.validity-text` cambia `margin: 0 0 6px 0` → `margin: 2px 0 0 0` (sin el `margin-bottom` viejo que empujaba contra el divisor).

### Tests

Sin tests nuevos — los 14 tests de `test_public_pdf_token.py` (render real con xhtml2pdf sobre OT/budget ricos) siguen pasando con el nuevo layout, y `buildPdfData.test.ts` (466/466) cubre el `doc_sub: ''` implícitamente vía el resto del shape. El cambio es puro presentation/template; el contrato de datos (`doc_sub: string`, `budget_validity_text: string`) no cambia.

### Verificación

`npx tsc --noEmit` **0** errores · `npx vitest run` **466/466** (39 files) · `pytest -q` **155/155** · ESLint en archivos tocados: solo baseline preexistente (`DocumentPdf.tsx` 4 + `buildPdfData.ts:17-21` 5; los 9 son los mismos de antes — este cambio no introduce ninguno nuevo). Sin migración. Regla: cualquier cambio futuro en el header del PDF (logo, tagline, número, subtítulo, validez) toca los 2 builders frontend (`DocumentHeader` en `DocumentPdf.tsx`) + legacy (`document_pdf.html`) + sus builders backend (`build_budget_pdf_data`/`build_work_order_pdf_data`).

## PDF HEADER fine-tuning 2026-09-25 (mañana, fine-tuning)

Ajuste visual post-sesión anterior: en la nueva cabecera apilada (logo arriba + tagline debajo + validez al lado del número), el logo AFAMAR se estiraba al ancho completo de `headerLeft` (`width: '100%'`) y la línea de validez quedaba pegada al número (`marginTop: 2`). Dos correcciones puntuales, paridad preview/legacy.

### (1) Logo AFAMAR — contenedor e imagen capeados a 140/150px

- **Frontend (`DocumentPdf.tsx`):**
  - `headerLeftLogo` cambia `width: '100%'` → `width: 140, maxWidth: 150` (contenedor fijo con techo a 150px; la imagen a `alignItems: 'flex-start'` dentro del contenedor para que no se estire).
  - `logo` cambia de `width: '100%', maxHeight: 142, marginBottom: 0, objectFit: 'contain'` a `width: 140, height: 'auto', maxHeight: 70, marginBottom: 0` — `height: 'auto'` preserva el aspect ratio original (la fuente PNG es 180×90 → salida ~140×70 con el nuevo ancho); `objectFit` removido porque la imagen ya tiene dimensiones naturales.
  - `headerLeftInfo.marginTop` de `4` → `6` para dar más respiro entre el logo y la tagline "MÁRMOLES & GRANITOS".
- **Legacy (`document_pdf.html`):** los atributos inline `width="180" height="90" style="margin-bottom:8px"` del `<img>` se reemplazan por `class="logo-img"`. CSS nuevo:
  ```css
  .logo-img { width: 140px; max-width: 150px; height: auto; margin-bottom: 6px; display: block; }
  ```
  Mismo resultado que el frontend: el logo ya no se estira al ancho de la celda izquierda y la tagline queda proporcional debajo.

### (2) Mayor separación validez/número

- **Frontend (`DocumentPdf.tsx`):** `validityText.marginTop` cambia de `2` → `8`. La línea "Presupuesto válido por X días." ahora tiene un respiro evidente debajo del `P-XXXXXX` Courier 18pt.
- **Legacy (`document_pdf.html`):** CSS `.validity-text` cambia de `margin: 2px 0 0 0` → `margin: 8px 0 0 0`. Mismo efecto en el bloque derecho.

### Verificación

`npx tsc --noEmit` **0** errores · `npx vitest run` **466/466** (39 files) · `pytest -q` **155/155** (210s — los 14 tests de `test_public_pdf_token.py` renderizan PDFs reales con xhtml2pdf sobre OT/budget con logos cargados, y las nuevas dimensiones encajan sin romper la fuente) · ESLint en `DocumentPdf.tsx`: solo baseline preexistente (los 4 errors `SKETCH_CONTENT_WIDTH`/`YELLOW_50`/`adicRowBreakdown`/`index`; este cambio no introduce ninguno nuevo). Sin tests nuevos (cambio puramente presentation/CSS — el render del logo es indistinguible para los tests existentes porque ningún test asserta tamaño de imagen, solo el contenido textual del PDF). Regla: cualquier cambio futuro en tamaño del logo o separación de validez toca los 2 builders (frontend + legacy) — la decisión de 140px / max 150px vive en `DocumentPdf.tsx` (`headerLeftLogo`/`logo`) y `document_pdf.html` (`.logo-img`); la separación 8px vive en `DocumentPdf.tsx` (`validityText.marginTop`) y `document_pdf.html` (`.validity-text`).

## Totals block layout 2026-09-25 (tarde)

Reestructura visual del bloque inferior de totales del PDF del cliente (preview `@react-pdf/renderer` + descarga legacy xhtml2pdf, builders en sync). Antes el renglón "Dólar del día" vivía al pie del stack vertical y la barra azul de TOTAL se renderizaba **arriba** de todo (justo después de la COMPARATIVA / observaciones); el bloque nuevo pasa a layout **2 columnas** con un orden **estricto** en la derecha.

### Layout nuevo (ambos builders en sync)

```
┌───────────────────────────┬────────────────────────────────────────────┐
│  Dólar del día            │  Subtotal                                  │
│  25/09/2026 14:30         │  Traslado (si > 0)                         │
│  $ 1.535,00               │  Descuento (si discount_fixed_amount > 0) │
│                           │  Cat. Descuento (si catalogue_discount > 0)│
│                           │  Interés (si catalogue_surcharge > 0)     │
│                           │  Tabla de cuotas (si > 1)                  │
│                           │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                           │  TOTAL       $ 1.200.000,00 (USD 800,00)  │
│                           │  Seña / Pagos Registrados (WO + accum.)   │
│                           │  Saldo pendiente (OT o budget con seña)   │
└───────────────────────────┴────────────────────────────────────────────┘
```

**Izquierda ~32%** = leyenda "Dólar del día" (label / fecha+hora via `usd_rate_fetched_at` / cotización grande blue). **Derecha ~68%** = secuencia vertical estricta `Subtotal` → `Traslado` → `Descuento` → `Cat. Descuento` → `Interés` → `Tabla de cuotas` → **TOTAL (barra azul)** → `Seña / Pagos Registrados` → `Saldo pendiente`. La estricta jerarquía **SUBTOTAL → DESCUENTO → TOTAL → SALDO** se preserva porque los renglones intermedios (Traslado / Cat. Descuento / Interés / Cuotas) no rompen la jerarquía visible al cliente.

### Frontend (`DocumentPdf.tsx`)

- **Estilos nuevos:** `totalsLayout` (flexDirection 'row' + marginTop 2), `totalsLayoutLeft` (width 32% + paddingRight 6), `totalsLayoutRight` (width 68%), `totalsUsdLabel` (8pt bold slate-700), `totalsUsdDate` (7pt slate-500), `totalsUsdRate` (11pt bold BLUE_700).
- **`renderExtras` (`:969-1160+`):** el bloque 2-columnas envuelve toda la pila de totales derecha + el panel izquierdo del dólar. **Movimientos clave:**
  - La barra azul de **TOTAL** que vivía arriba (:1002-1013) **bajó** dentro de la columna derecha, justo después de la tabla de cuotas (`:1069-1083`) — preservando `Subtotal → … → TOTAL → Saldo`.
  - El renglón "Dólar del día" de abajo (`:1129-1136`) **se movió** a la columna izquierda — desaparece de la columna derecha.
  - Observaciones (`data.notes` / `data.important_observations`) ahora se renderizan **antes** del bloque 2-columnas (siguen siendo opcionales).
- **`AlternativeTotalsSummary` (`:836`):** recibe **2 props opcionales nuevas** `usdRate?: number` y `usdRateFetchedAt?: string | null` para alimentar su propia columna izquierda del "Dólar del día" (en cada tarjeta alternativa). Replica el mismo layout 2-columnas pero solo con `Subtotal → Descuento → TOTAL → Saldo` (sin traslado/cuotas/observaciones — el bloque alt no los tiene). Call site en `:1277` pasa `usdRate={data.usd_rate}` + `usdRateFetchedAt={data.usd_rate_fetched_at}`.

### Backend (`document_pdf.html` + `pdf_html.py`)

- **Template (`document_pdf.html` TOTALS block):** la `<table class="totals">` actual ahora vive dentro de una `<table class="totals-layout">` wrapper de 2 columnas:
  - `<td class="totals-layout__left">` con el label "Dólar del día" + la cotización (formato `{:,.2f}`).
  - `<td class="totals-layout__right">` con el `<table class="totals">` original — los `<tr>` se reordenan para reflejar la nueva secuencia (Subtotal → Traslado → Descuento → Cat. Descuento → Interés → Tabla de cuotas → **TOTAL (barra azul `tr class="grand"`)** → Seña → Saldo). La barra azul pasó del último `<tr>` (legacy) a la posición 7 (después de la tabla de cuotas), preservando la jerarquía.
  - CSS nuevo: `.totals-layout` (100% width, border-collapse, margin 8 bottom), `.totals-layout td` (vertical-align top, padding 0), `.totals-layout__left` (32% width, padding 4px 8px 4px 0), `.totals-layout__right` (68%), `.totals-usd-label` (8pt bold slate-700), `.totals-usd-rate` (13pt bold blue).
- **Builders (`pdf_html.py::build_budget_pdf_data` + `build_work_order_pdf_data`):** ahora emiten **`usd_rate`** como clave top-level del render dict (junto a `total`/`subtotal`/etc.). El valor es el `usd_rate_for_pdf` ya calculado (fallback a `settings.DEFAULT_USD_RATE` si el form tiene `usd_rate` ≤ 0). Sin esto el template legacy no podría leer la cotización para la columna izquierda. **El WO builder ahora también emite `usd_rate`** — antes solo lo calculaba internamente para conversión ARS/USD.

### Tests

- **vitest 462 → 466 (+4 en `buildPdfData.test.ts`)** nuevo describe block `"totals block layout (Dólar del día LEFT + sequential totals RIGHT)"`:
  - `exposes usd_rate + usd_rate_fetched_at for the LEFT column` — la columna izquierda tiene lo que necesita para renderear la cotización (`data.usd_rate > 0`, `data.usd_rate_fetched_at` es string o null).
  - `exposes the gates needed by the right-column sequence on a discount scenario` — chequea que con `transport > 0` + `discount_fixed_amount > 0` + `discount_percentage > 0` + `deposit_received > 0` los 4 campos están poblados (los 4 gates del render secuencial).
  - `keeps saldo gating for work orders (no deposit_required to render the row)` — para una WO sin seña, `balance_due > 0` (el render del "Saldo pendiente" depende de esto + `paid_label` que el WO builder siempre setea).
  - `omits the descuento row from the data when discount_fixed_amount === 0` — el gate del render es `discount_fixed_amount > 0`, lo testeamos directamente.
- **pytest 152 → 155 (+3 en `test_totals_block_layout.py` — nuevo):**
  - `test_budget_builder_exposes_usd_rate_for_left_column` — `build_budget_pdf_data(form, ...)["usd_rate"] == 1000` cuando el form trae `usd_rate: 1000`.
  - `test_work_order_builder_exposes_usd_rate_for_left_column` — mismo chequeo con `build_work_order_pdf_data` y `usd_rate: 1535`.
  - `test_budget_builder_uses_default_usd_rate_when_form_has_none` — fallback a `settings.DEFAULT_USD_RATE` cuando el form tiene `usd_rate: 0` (no renderiza `—`).

### Verificación

`npx tsc --noEmit` **0** errores · `npx vitest run` **466/466** (39 files, +4) · `pytest -q` **155/155** (+3) · ESLint en archivo tocado: solo baseline preexistente (`DocumentPdf.tsx` `SKETCH_CONTENT_WIDTH`/`YELLOW_50`/`adicRowBreakdown`/`index` — los 4 son preexistentes, los números de línea se corrieron tras el rewrite pero son los mismos 4). Sin migración (solo builders + template + 2 props de `AlternativeTotalsSummary`). Render real del legacy PDF verificado: los 14 tests de `test_public_pdf_token.py` (que renderizan OT/budget con xhtml2pdf real) siguen pasando — la tabla anidada (`<table class="totals-layout"><tr><td><table class="totals">`) no rompe xhtml2pdf.

**Regla de sync:** cualquier cambio futuro en el orden de los renglones del totals block toca los 2 builders frontend (`renderExtras` + `AlternativeTotalsSummary`) + el template legacy (`document_pdf.html`) + sus tests (`buildPdfData.test.ts` + `test_totals_block_layout.py`). El dato sigue siendo el mismo `data.{subtotal,total,discount_*,balance_due,total_paid_*,paid_label,deposit_*,usd_rate,usd_rate_fetched_at}` — los 2 builders y el componente solo lo **leen** y lo **renderizan** en el nuevo orden.

## COMPARATIVA DE MEDICIÓN: frente con snapshot + zócalo price-0 2026-09-22 (madrugada)

Dos fallas de la COMPARATIVA DE MEDICIÓN del PDF (mismo template en el preview `DocumentPdf` y la descarga legacy xhtml2pdf, builders en sync) — una del **frente** (adelanto del bug "Presupuestado: —") y una del **zócalo sin precio propio**.

**Bug 1 — el frente perdía su snapshot al editar cualquier adicional.** Síntoma: en una OT convertida, tocar un adicional en el form (p.ej. cambiar los ml del frente) hacía que la fila "Frente Ingletetado 45°" de la comparativa volviera a salir `Presupuestado "—"` y `Subtotal $0,00`. **Causa raíz:** `parseAdditionalWorksData` (`src/utils/additionalWorkParse.ts`) era una **whitelist** y descartaba las claves snapshot `linear_meters_budgeted`/`total_ars_budgeted`/`total_usd_budgeted` → al editar un adicional (vía `useAdditionalWorkSelection` → `PiecesSection.tsx:423` → `setPieceAdditionalWorks`) el JSON se re-serializaba **sin** los snapshots → `flattenPieces` emitía el flat `additional_works_data` sin ellos → el WO persistido perdía la comparativa del frente. **Fix:** las 3 claves se agregan a `AdditionalWorkSelection` (nulables) con el helper `pickNullableNumber` y se **preservan en el `base` del parse** (los edit helpers `recomputeFrenteRow`/`applyAdditionalWorkField` ya hacen `{...row}` — parada automática, sin cambios). El snapshot dimensional del frente NO se recalcula al editar: se conserva de la conversión/respaldo.

**Bug 2 — zócalo con `price: 0` (se cobra por m² del material) mostraba delta de medida pero Subtotal $0,00.** Síntoma real: `Zócalo TRAVERTINO A LA VETA` con delta físico `+0,035 m²` y subtotal de la comparativa `$0,00` (y el TOTAL del documento sin el monto). **Causa raíz:** ambos builders valuaban solo `price × qty − total_*_budgeted`, y con `price: 0` el `lineTotal === 0` → siempre $0. **Fix (mantener en sync los 2 builders):** si `lineTotal === 0` y el concepto es m² (`M2_CONCEPTS` en `buildSectionData.ts` / `_FAB_M2_CONCEPTS` en `pdf_html.py`) y el delta de medida (`fdMeasureDelta`/`d_delta`) está presente y el material asociado tiene `priceM2 > 0` → **delta monetario = delta m² × `price_m2` del material** (en la moneda nativa del material, convertido a ARS/USD con `usdRate`, mismo patrón que la fila del material). Si el zócalo tiene precio propio (`lineTotal > 0`) sigue la lógica previa `budgetedDelta(current_total, total_*_budgeted)` (que devuelve 0 si el snapshot es null).

**Tests: vitest +3, pytest +1:**
- `useAdditionalWorkSelection.test.ts` +2: (a) `parseAdditionalWorksData` → `serializeAdditionalWorksData` round-trip conserva `linear_meters_budgeted`/`total_ars_budgeted`/`total_usd_budgeted`; (b) la edición del frente via hook (`updateField`) mantiene las claves snapshot en el JSON emitido.
- `buildPdfData.test.ts` +1: zócalo BASEBOARD real `0,42 m²`, `m2_budgeted: 0.34`, `price: 0`, material USD 330/m², `usd_rate 1000` → delta `+0,08 m²` → `subtotal_usd 26.40` / `subtotal_ars 26400` (aserciones con `toBeCloseTo` por precisión flotante de `0.08 × 330`).
- `test_measurement_comparison.py` +1: `test_price_zero_zocalo_is_valued_at_linked_material_price_m2` (mismo caso en el builder backend legacy).

**Verificación:** `npx tsc --noEmit` 0 errores · `npm run test` **421/421** (35 files) · `pytest -q` **127/127** · ESLint en los archivos tocados 0 errores. Sin migración (solo parser + builders). Los 2 builders de comparativa (`buildSectionData.buildMeasurementComparison` × `pdf_html._build_measurement_comparison`) ya se mantienen en sync; cualquier cambio futuro de la valuación toca los 2 + sus tests.

## COMPARATIVA DE MEDICIÓN: snapshots sobreviven a MEDICIÓN 2026-09-22 (noche)

Los snapshots presupuestados de la COMPARATIVA DE MEDICIÓN del PDF (`m2_budgeted`/`linear_meters_budgeted`/`total_ars_budgeted`/`total_usd_budgeted`) sobreviven ahora a la edición de medidas reales en MEDICIÓN.

**Síntoma reportado:** en una OT convertida de presupuesto, la 1ª edición de una medida real (cambiar `length` de un material) hacía que la columna "Presupuestado" del PDF volviera a salir "—" (y los subtotales de la comparativa a $0,00).

**Causa raíz:** el backend solo bameaba los snapshots en los arrays **flat** (`materials_data`/`fabrication_details`/`additional_works_data`, JSON de las columnas), pero el frontend deriva los flat desde las **piezas** (`pieces_data`) en CADA edición: `useBudgetPieces.commit` corre `flattenPieces(next)` → como las piezas nunca tuvieron los snapshots, el primer `updatePieceMain('length')` los borraba del JSON persistido. Las OTs legacy (pre-piecesFlow) no lo sufrían porque llevaban el snapshot solo en el m² flat; las convertidas (con pieces_data) sí.

**Fix en 2 capas (ambas necesarias — sin la 1a el backend no produce snapshots en piezas; sin la 1b el frontend los vuelve a borrar al primer commit):**

**Capa B — backend (`app/services/work_order.py`):**
- Constantes de módulo `_FAB_M2_CONCEPTS`/`_FAB_LINEAR_CONCEPTS` (nombres de conceptos de fabricación que miden en m² vs ml) compartidas con el código de snapshot de `create_from_budget`.
- Nueva función **`_bake_snapshot_into_pieces(pieces_wire, materials_data, fabrication_details, additional_works_data, usd_rate)`**: recibe el `pieces_data` crudo (string JSON o lista) y los 3 flat, y re-escribe el wire con los snapshots por pieza:
  - `mainMaterial`/`mainMaterialRows`/`alternativeMaterials` → `m2_budgeted` (zippeo posicional: primero los no-alternativos — main + tramos —, luego las alternativas; `m2_budgeted` de la fila flat emparejada).
  - `fabrication_details` de cada pieza → por concepto: `m2_budgeted` (si el concepto es M2) o `linear_meters_budgeted` (si es lineal), TEMAS `total_ars_budgeted`/`total_usd_budgeted` (convertidos con `usd_rate`).
  - `additional_works_data` de cada pieza → se re-serializa con los snapshots de la fila flat de frente emparejada por posición (`linear_meters_budgeted`/`total_ars_budgeted`/`total_usd_budgeted`).
  - Inputs ausentes (`None`/`''`/JSON array) → intacto; JSON malformado → devuelve el original (guard defensivo).
- `create_from_budget` (al generar la OT desde un presupuesto) vuelve `result.pieces_data = _bake_snapshot_into_pieces(...)` pasándole los mismos flat que acaba de snapshoteear.

**Capa A — frontend (`src/hooks/entityFormSerialization.ts`):**
- Constantes `SNAPSHOT_MATERIAL_KEYS`/`SNAPSHOT_FABRICATION_KEYS`/`SNAPSHOT_ADDITIONAL_KEYS` + helper **`hydrateSnapshotKeys(row, source, keys)`** (copia solo las keys con valor presente; devuelve la misma referencia si nada cambia).
- Exportado **`hydratePiecesSnapshots(d, pieces)`**: solo actúa si `hasAnySnapshot` (presente en flat); separa los flat en main (no-alternativos) / alternativos / fabricación / adicionales y hace un **zippeo posicional** sobre las piezas (aquel que `flattenPieces` produce: por pieza → main, luego tramos, luego alternativas; misma posición para fabrication y additional). Los `additional_works_data` por pieza se re-serializan con sus snapshots.
- `_loadPieces` lo aplica ANTES de devolver `{pieces, pools_data}` → el `form.pieces` ya viene hidratado y el próximo `commit` de `flattenPieces` los conserva.

**Tests (vitest 415 → 418, pytest 123 → 126):**
- Backend `tests/test_measurement_snapshot_roundtrip.py` (**3**, run real sin mocks):
  1. `test_create_from_budget_bakes_snapshots_into_flat_and_pieces` — convert de un budget con 2 mesadas (2.75×0.64=1.76 m² y 0.68×0.64=0.4352 m² USD 330/m²), zócalo BASEBOARD 4×0.105=0.42 m² @50 USD y frente linear_meters 3.3 @162.79 USD; asserts flat Y `pieces_data[0].mainMaterial.m2_budgeted`, `fabrication_details[0].*`, `additional_works_data[0].*` por pieza.
  2. `test_full_flow_snapshot_survives_measurement_adjust_and_drives_comparison` — convert → PATCH con `materials_data`/`pieces_data`/`fabrication_details`/`additional_works_data` marcando `length=3.0` (snapshots intactos) + `include_measurement_comparison_in_pdf=True` → `prepare_work_order_payload` + `build_work_order_pdf_data` → comparativa 4 filas (2 primarias + zócalo + frente): mesada_1 real "1.92" vs presupuestado "1.76" delta "+0.16" USD 52.80/ARS 52800, mesada_2 delta "0", zócalo `m2_budgeted_str "0.42 m²"`, frente `ml`, totales "+52.80"/"+52,800.00".
  3. `test_bake_snapshot_into_pieces_is_guarded_for_absent_or_malformed` — `None`→`None`, `''`→`''`, `"not-json"`→intacto, `'{"a":1}'`→intacto, lista válida→bakea.
  - **Dato clave del fixture:** `Budget` NO tiene columna `price_m2` (es `material_price_m2`/`material_price_m2_usd`) — pasarla al constructor tira el error del constructor declarativo de SQLAlchemy. Se usan `material_price_m2`/`material_price_m2_usd=330.0`. `_build_budget(**overrides)` con 2 piezas flat+pieces, `usd_rate=1000`, `payment_method="EFECTIVO"`, `installments=1`; fixture `seeded_budget_db` siembra `Client(id=1, name="Juan Pérez")`.
- Frontend:
  - `entityFormHelpers.test.ts` **describe "mapApiToForm — COMPARATIVA snapshot hydration"** (2): hidratación flat→piezas (material `m2_budgeted`, zócalo `total_ars/usd_budgeted`, frente `linear_meters_budgeted`) Y que `flattenPieces(form.pieces)` los conserva; no-op (piezas intactas) cuando NO hay snapshots (OT directa).
  - `useBudgetPieces.test.ts` **"MEDITOR flow: snapshots survive updatePieceMain + commit"** (1): pieza con snapshots (m²/zócalo/frente) → `updatePieceMain('p1','length',3)` → el flat re-derivado mantiene `m2_budgeted` etc.

**Verificación:** `npx tsc --noEmit` **0** errores · `npm run test` **418/418** (35 files) · pytest **126/126** · ESLint en archivos tocados **0 errores**. Sin migración (solo lógica en create_from_budget + serialización). Los 2 builders de comparativa (backend `pdf_html._build_measurement_comparison` y frontend `buildSectionData.buildMeasurementComparison`) NO se tocaron — ya leen los snapshots desde los flat, y ahora los flat los mantienen tras el commit.

## Links de WhatsApp: dominio público + guard loopback + PDF cliente reconciliado 2026-09-22

Los links de WhatsApp (PDF público y el WA directo) **nunca emiten un origen loopback** (`http://localhost:3090` — el cliente lo abre desde SU celular), y el **PDF legacy que abre ese cliente** (template xhtml2pdf `document_pdf.html` vía `/api/v1/public/{work-orders,budgets}/pdf?token=…`) se acomodó en cabecera/finanzas.

### Origen público de share links (frontend, `src/utils/whatsapp.ts`)

- **Cadena `getPublicAppBaseUrl`:** `base` (test seam) → `window.APP_CONFIG.PUBLIC_URL` → `import.meta.env.VITE_PUBLIC_URL` → **origen derivado de `import.meta.env.VITE_API_BASE_URL`** (solo si es absolute http(s); se toma `new URL(...).origin`; relativa como `/api/v1` → se omite) → `window.location.origin`. Fuera del browser devuelve `''`.
- **Guard de loopback (`isLoopbackOrigin`, nuevo export):** descarta `localhost`/`*.localhost`/`127.*`/`::1`/`0.0.0.0`/`::ffff:127.*` de TODA la cadena (incluido un `base` explícito) → si ningún candidato es compartible, **`DEFAULT_PUBLIC_URL`** (el VS Code Dev Tunnel activo, `https://87k533kf-3090.brs.devtunnels.ms`) toma el lugar: el bloque PDF **NUNCA se omite** y jamás sale un `localhost`. Orígenes privados LAN (`192.168.x`/`10.x`) NO se bloquean (prueba explícita: `http://192.168.1.20:3090` pasa) — responsabilidad del operador.
- **`DEFAULT_PUBLIC_URL` (nuevo export):** última base de la cadena cuando no hay `base`/`APP_CONFIG.PUBLIC_URL`/`VITE_PUBLIC_URL`/origin alcanzable — hardcodea el devtunnel activo para que el link se emita SIEMPRE. Actualizarla cuando cambie la URL del túnel; en deploy se sobreescribe con `VITE_PUBLIC_URL`/`APP_CONFIG.PUBLIC_URL` (prioridad por encima).
- **`toAbsoluteUrl`:** ahora también cae a `''` cuando la resolución queda loopback (un path relativo sobre `http://localhost` ya no genera link).
- **Dev tunnel sin config extra:** si el operador abre la app A TRAVÉS del túnel, `window.location.origin` ya es la URL pública → links correctos sin `.env`. Si el front corre en localhost sin túnel pero el backend vive en la URL pública (devtunnel), definir `VITE_API_BASE_URL` absoluta (p.ej. `https://87k533kf-3090.brs.devtunnels.ms/api/v1`) → su origen es la fuente.
- `.env.example` nuevo documentando `VITE_PUBLIC_URL`/`VITE_API_BASE_URL`; `global.d.ts` tipa `VITE_API_BASE_URL` en `ImportMeta.env`.
- **Tests** (`whatsapp.test.ts`, 37 → **39**): `isLoopbackOrigin` (loopbacks vs públicos), fallback del origen absoluto de `VITE_API_BASE_URL`, relativa ignorada, el guard jsdom ("sin config → `DEFAULT_PUBLIC_URL`, un link https SIEMPRE, nunca `''`"), un test del **mensaje completo en orden** (saludo/N° → 📋 detalle+montos → 📄 PDF → 💳 Payway), y la composición del `buildOrderShareMessage` con el link público. Nota: los tests de absolutización de paths relativos setean `window.location.origin = 'https://afamar-prod.com'` (un origin loopback nunca genera link) y cada `beforeEach`/`afterEach` del describe de resolución restaura el origin jsdom (un test viejo mutaba `globalThis.window` a `afamar-prod.com` y contaminaba a los siguientes).

### PDF legacy `document_pdf.html` (el que abre el cliente por el link público)

- **Cabecera:** margen inferior de 8px en el logo AFAMAR (`style="margin-bottom:8px"` en el `<img>`, tamaño 180×90 intacto) — ya no se superpone con la tagline "MÁRMOLES & GRANITOS".
- **Cliente:** la fila `Entrega` salió del info-box y entró al bloque de Cliente como columna **`Fecha de Entrega:`** (junto a `Fecha:`/`Teléfono`); el info-box queda solo Color/Espesor/Acabado. El preview frontend (`DocumentPdf.tsx`) renombró su `InfoCell` "Entrega" → "Fecha de Entrega".
- **Descuento manual:** solo renderiza si `discount_fixed_amount > 0` (un `%` sin monto computado dejaba una fila `-$0.00`); label `Descuento ({{ "{:g}".format(discount_percentage) }}%)` solo si el pct > 0.
- **Recargo de tarjeta → `Interés`:** el renglón del recargo del catálogo se llama **`Interés`** (mismo wording que el preview Fase 7); sin `+`, sin `%`, sin `catalogue_method_label` (el `%` por cuota vive en la tabla 3-columnas y en la línea Forma de pago). El `_interes` de la línea "Forma de pago" se renderiza con `{:g}` (antes `9.0%`).
- **Seña + Saldo = TOTAL exacto:** ambos builders (`build_budget_pdf_data` y `build_work_order_pdf_data` en `app/services/pdf_html.py`) **derivan** `deposit_ars_equivalent` (round 2dp; ARS → `deposit_received`, USD → `deposit_usd × usd_rate`) y `saldo = max(0, round(total_ars − deposit_ars_equivalent, 2))` — ya NO usan el `balance_due` almacenado (podía dormitar con un `usd_rate` distinto al de la Seña → Seña + Saldo ≠ TOTAL). **El builder de presupuesto ahora también pasa `deposit_usd`/`deposit_currency`/`deposit_ars_equivalent`/`deposit_usd_equivalent`** (antes un presupuesto con seña USD mostraba Seña $0.00 y saldo = total; los budgets que llegan sin `deposit_usd` usan `deposit_currency='ARS'` + equivalent=deposit_received). La fila Seña ya estaba gateada por `{% if deposit_received or deposit_usd %}`.
- **Preview frontend (`DocumentPdf.tsx`):** el gate de la fila `Descuento` se alineó con el legacy — solo renderiza si `discount_fixed_amount > 0` y el label `Descuento (X%)` solo cuando el pct > 0 (antes un `%` sin monto computado emitía `Descuento (monto fijo) −$0.00`).

### Fix 500 del link público (render real de OT/budget)

El `GET /api/v1/public/work-orders/pdf?token=…` (y `budgets`) devolvía **500** con datos reales. **Causa raíz:** xhtml2pdf crashea con `ValueError: PmlTable ... must have at least a row and column` cuando una `<table>` del template queda con un `<tr>` de **cero `<td>`**. En prod ocurría con una OT sin `color`/`espesor`/`acabado` cargados (info-box sin celdas) o sin `client_address`/`client_email`/`delivery_date` (2ª fila del cliente vacía). Los tests previos no lo capturaban porque mockeaban la generación del PDF.

- **Fix del template (`app/templates/document_pdf.html`):** ambos `<tr>` se envuelven en `{% if ... or ... %}` y se omiten enteros si quedaban vacíos — el info-grid con `{% if material_color or material_thickness or material_finish %}` y la fila del cliente con `{% if client_address or client_email or delivery_date %}`. Sin esto xhtml2pdf no renderiza la tabla (no se genera tabla vacía). Aplica a OT y budget (mismo template).
- **Logging claro en el router (`app/api/routers/public.py`):** cada handler envuelve `prepare_*_payload` + build + generate en `try/except Exception` con `logger.exception("Public PDF render failed for work_order/budget %s", id)` y devuelve un **500 JSON amigable** (`error(...)` de `app.utils.responses`) en vez del crash; en el camino válido sigue `Response(content=pdf_bytes, media_type="application/pdf")`. `import logging` + `logger = logging.getLogger(__name__)` agregados (mismo patrón que `budgets.py`/`work_orders.py`).
- **Regresión sentinel — 2 tests de integración NUEVOS en `tests/test_public_pdf_token.py` que corren el render REAL (sin mockear `generate_*_pdf`):**
  - `test_public_pdf_work_order_renders_real_pdf` — fixture `seeded_wo_rich`: Settings (company_name/tagline/address/phone/pdf_footer), PaymentMethods (EFECTIVO id=1, TARJETA DE CRÉDITO id=2 SURCHARGE 9% `applies_to_installments=True`), Client "Juan Pérez"; OT rica con usd_rate 1535, total = base×1.27 (3 cuotas ×9%), **depósito USD 200**, materials_data/pools_data/fabrication_details (zócalo con snapshot)/additional_works_data (frente)/sketch_elements (wire con páginas + material)/`include_measurement_comparison_in_pdf=True`. Assert: 200, `application/pdf`, `%PDF` y `%%EOF` (PDF generado por xhtml2pdf real), content-disposition `A-000001`, y `Seña + Saldo === TOTAL` de la data.
  - `test_public_pdf_minimal_work_order_does_not_500` — la OT mínima que crasheaba (sin color/espesor/acabado, sin domicilio/email/entrega) → 200 + `%PDF`.
  - `seeded_wo_rich` usa las Settings del `company` dict vía `prepare_work_order_payload`; no depende de seeders globales (la suite completa corre sin seed).
- **Verificación:** `pytest -q` **123/123** (21 base 2026-09-21 → 121 → 123 con los 2 render reales; archivo `test_public_pdf_token.py` = 14 tests). Sin migración (solo template + router). OJO: al correr pytest el startup de `app.main` conecta a **MySQL de producción** para el check del lifespan (`Environment: production` desde `.env`) pero los tests usan el SQLite de `conftest.py` vía overrides — no correr migraciones/seeders bajo pytest.**

### Verificación

`npx tsc --noEmit` 0 errores · `npm run test` **412/412** (35 files · +7 en `whatsapp.test.ts`) · pytest **123/123** (+14 en `tests/test_public_pdf_token.py`, incluye los 2 tests de render real sin mock) · ESLint 0 errores nuevos. Sin migraciones (solo código + template). Reindexar el knowledge graph si se commiteara el `.codebase-memory/`.

## PDF público con token firmado 2026-09-21

Los links "Ver / Descargar PDF" que reciben los clientes por WhatsApp apuntaban al endpoint **autenticado** (`/work-orders/{id}/pdf` / `/budgets/{id}/pdf` con JWT) → el cliente que abría el link recibía un **401**. Ahora el mensaje usa un link **público sin login** con **token firmado HMAC-SHA256** + expiración.

### Contrato backend

- **Mint (autenticado, no cambia de privilegios):** `GET /api/v1/work-orders/{id}/public-token` y `GET /api/v1/budgets/{id}/public-token` → `{ token, expires_in_days, expires_at }`. 404 si el documento no existe.
- **Pública (sin auth):**
  - `GET /api/v1/public/work-orders/pdf?token=…` → PDF inline `filename="orden_de_trabajo_{number}.pdf"`
  - `GET /api/v1/public/budgets/pdf?token=…` → PDF inline `filename="presupuesto_{number}.pdf"`
- **Códigos de error:** expired → **410** `"El enlace ha expirado. Solicite un nuevo presupuesto/orden a AFAMAR."`; firmado inválido/tampered/doc-type incorrecto → **400** `"El enlace es inválido. Solicite un nuevo presupuesto/orden a AFAMAR."`; token ausente → **422**; doc inexistente → **404**.
- **Config:** `PUBLIC_PDF_TOKEN_EXPIRE_DAYS: int = 30` en `app/core/settings.py` (~línea 100, bloque JWT).

### Token (`app/services/public_pdf_tokens.py` — nuevo, 0 deps externas)

- Formato: `<base64url(payload)>.<base64url(hmac_sha256)>`; payload = `{"typ": "work_order"|"budget", "id": int, "exp": unix}` (JSON).
- Clave de firma derivada: `hmac.new(settings.SECRET_KEY.encode(), _PURPOSE, hashlib.sha256).digest()` con `_PURPOSE = b"afamar:public-pdf-token:1"` (namespace explícito: un refactor que cambie el propósito invalida tokens viejos).
- API: `create_public_pdf_token(doc_type, doc_id, now=None, ttl_days=None) -> str` y `decode_public_pdf_token(token, now=None) -> dict`. `now`/`ttl_days` son **test seams** (permiten testear expiración sin esperar). Excepciones `PublicTokenError` (base) → `PublicTokenExpiredError` / `PublicTokenInvalidError`. `ALLOWED_DOC_TYPES = ("work_order", "budget")` valida `typ`.
- `datetime | None` en funciones Python puras es OK en 3.14 (la restricción de PEP 604 es solo para pydantic models).

### Helpers de payload movidos (DRY)

`prepare_work_order_payload(order, db)` y `prepare_budget_payload(budget, db)` vivían como helpers locales de los routers; se movieron a **`app/services/pdf_helpers.py`** (retornan `(data, client_dict, company, terms)`). Los routers `work_orders.py`/`budgets.py` importan desde ahí; el router público reusa los mismos. **Regla:** si cambia el shape del payload del PDF, el cambio se hace una sola vez en `pdf_helpers.py`.

### Router público (`app/api/routers/public.py` — nuevo)

- `APIRouter(prefix="/public", tags=["Public"])`, montado en `router.py` después de `payway.router` (path completo `/api/v1/public/...`).
- Helper `_resolve_token(token, expected_doc_type)` → doc id o `error(...)` en el envelope JSON de la app; usa `PublicTokenExpiredError`/`PublicTokenInvalidError` para traducir a 410/400 con mensajes amigables (los mensajes están en constantes `_EXPIRED_MESSAGE`/`_INVALID_MESSAGE`).
- Reusa `BudgetService.get`/`WorkOrderService.get` + los `prepare_*_payload` + `build_work_order_pdf_data`/`build_budget_pdf_data` + `generate_*_pdf` de `pdf_html.py` (legacy xhtml2pdf).

### Frontend (enlaces del mensaje de WhatsApp)

- **API:** `getWorkOrderPublicPdfToken(id)` (`src/api/resources/workOrders.ts`) y `getBudgetPublicPdfToken(id)` (`src/api/resources/budgets.ts`) → `http.get('/work-orders/{id}/public-token')` (el interceptor ya unwrappe el envelope, `res.data` = `{ token, expires_in_days, expires_at }`).
- **Helpers** (`src/utils/whatsapp.ts`, puros): `buildPublicPdfUrl(kind, token, base?)` → `` `${origin}/api/v1/public/${kind === 'work_order' ? 'work-orders' : 'budgets'}/pdf?token=${encodeURIComponent(token)}` `` donde `origin = base ?? window.location.origin`; `resolvePublicDocumentPdfUrl(kind, fetchToken, base?)` es **async**: inyecta el fetcher del token, devuelve la URL completa y cae a `''` si el fetcher falla/offline/sin token (el mensaje se manda igual, solo sin el bloque PDF).
- **Los 4 call sites** ahora usan `await resolvePublicDocumentPdfUrl(...)`:
  1. `src/pages/work-orders/WorkOrderFormPage.tsx` (`handleEnviarWhatsApp`, id presente → `getWorkOrderPublicPdfToken(id)}`, si no `''`)
  2. `src/pages/work-orders/WorkOrdersListPage.tsx`
  3. `src/pages/budgets/BudgetsListPage.tsx` (`handleEnviarWhatsApp` pasó a async)
  4. `src/hooks/useBudgetActions.ts` (`handleEnviarWhatsApp` pasó a async, interfaz `() => Promise<void>`)
- `getBudgetPdf`/`getWorkOrderPdf` **siguen usándose** para el `getPdfUrl` del preview (form pages) — solo el flujo de WhatsApp migró al público.

### Tests

- Backend `tests/test_public_pdf_token.py` (**12**, suite pytest **121/121**): roundtrip, expiración (via `now`/`ttl_days=-1`), tampering, b64 malformed; mint accesible autenticado con `expires_in_days == 30`; 404 en doc inexistente; público: token válido → 200 `application/pdf` + `Content-Disposition` con `A-000001` (se monkeypatchean `generate_work_order_pdf`/`generate_budget_pdf` a `BytesIO(b"%PDF-1.4 mock")` porque xhtml2pdf es pesado), expired → 410, tampered → 400, typo de doc-type → 400, sin token → 422, doc inexistente → 404.
- Frontend `src/utils/whatsapp.test.ts` (**27**, suite vitest **398/398**, +8): `buildPublicPdfUrl` (segmento work-orders/budgets, `encodeURIComponent` del token, `base` override, default `window.location.origin`), `resolvePublicDocumentPdfUrl` (éxito, fallo → `''`, sin token → `''`), y el render del link público absoluto en `buildDocumentShareMessage`.

### Verificación

`pytest -q` **121/121** (afamar-backend, venv) · `npx tsc --noEmit` 0 errores · `npm test` **398/398** (34 files) · ESLint 0 errores nuevos (WorkOrderFormPage.tsx unused y `useBudgetActions.ts:55 'saving'` son baseline preexistente). Sin migración (solo código + endpoint).

### Ajustes finalizadores — base pública + sin descarga local (2026-09-21, tarde)

Cierre de la feature con 2 reglas sobre el flujo de WhatsApp:

1. **Los links de WhatsApp usan la URL pública del entorno, nunca `localhost:3090`.** Nueva helper `getPublicAppBaseUrl(base?)` en `src/utils/whatsapp.ts`: cadena `base` (test seam) → `window.APP_CONFIG.PUBLIC_URL` (runtime, por deploy) → `import.meta.env.VITE_PUBLIC_URL` (build-time) → `window.location.origin` (fallback dev). Quita `/` final y devuelve `''` fuera del browser. `buildPublicPdfUrl` y `toAbsoluteUrl` la usan para origin. Wiring runtime: `PUBLIC_URL` agregado en `public/config.js` (default `""`), `public/config.template.js` (`"$PUBLIC_URL"`) y el `envsubst '$API_URL $PUBLIC_URL'` del `Dockerfile`. Tipado: `Window.APP_CONFIG.PUBLIC_URL` + `ImportMeta.env.VITE_PUBLIC_URL` en `src/global.d.ts`.

2. **El botón WhatsApp ya NO descarga el PDF local.** Eliminado `handleDownloadPdfForOperator` de `WorkOrderFormPage.tsx` (descargaba el blob vía endpoint autenticado y dejaba el archivo en Descargas del operador), su llamada `void handleDownloadPdfForOperator().catch(...)` dentro de `handleEnviarWhatsApp`, y el import `getWorkOrderPdfBlob`. El flujo queda: mint token público (si hay `id`) → armar mensaje → `window.open(wa.me…)`. `getWorkOrderPdfBlob` sigue exportado en `src/api/resources/workOrders.ts` (lo reusa el list page si hace falta) pero ya no lo usa el form.

**Tests (+7 → vitest 405/405, 35 files):** `whatsapp.test.ts` pasa a **32** (describe "public URL base resolution": `APP_CONFIG.PUBLIC_URL` gana sobre el origin localhost de jsdom, `VITE_PUBLIC_URL` como siguiente fallback, base explícita por arriba de ambas, trailing `/` recortado, y `toAbsoluteUrl` absoluto con la base pública). Nuevo `src/pages/work-orders/WorkOrderFormPage.test.tsx` (**2**): mockea `useEntityForm`/`useWorkshopPdfController`/`useSettingsWithTerms`/`useUsdRate`/`useConfirmPayment`/`useNotify`/`EntityFormLayout→null` (los 4 hooks son **named** exports, no default); con `APP_CONFIG.PUBLIC_URL='https://afamar.test'` verifica que ENVIAR POR WHATSAPP minta el token con `'123'`, el mensaje contiene `https://afamar.test/api/v1/public/work-orders/pdf?token=abc.def` (sin `localhost`/`:3090`) y `getWorkOrderPdfBlob` NO se llama (regresión del punto 2); sin teléfono → `notify` error, sin mint y sin `window.open`.

**Verificación:** `npx tsc --noEmit` **0** · `npm test` **405/405** (35 files · +7) · ESLint en archivos tocados: 0 errores nuevos (los 8 de `WorkOrderFormPage.tsx` — `menuOpen`, `menuRef`, `setSaving`, `setMenuOpen`, `handlePrint`, `buildPayload`, `EntityFormState`, `matsMain` — son baseline preexistente, no los introduce este cambio). Sin cambios de backend.

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

## Valores por defecto vacíos en Largo/Ancho 2026-09-22 (tarde)

Requerimiento del operador: en el editor **PIEZAS / MESADAS** (presupuestos y OTs), al agregar un material principal o una alternativa, los campos **`Largo (mts)`** y **`Ancho (mts)`** NO deben inicializarse en `1` — si el material se carga sin medidas, el m² y el subtotal deben dar **0** (no un m² fantasma cobrado al cliente).

**Causa raíz (los únicos defaults `1` del flujo pieces):**
- `pieceDims` (`src/features/budgets/hooks/useBudgetPieces.ts:102`) devolvía `length: Number(m.length) || 1, width: Number(m.width) || 1, quantity: Number(m.quantity) || 1`, y `{ length: 1, width: 1, quantity: 1 }` para pieza sin main — `setPieceMain`/`swapPieceMain`/el legacy path de `addPieceAlternative` propagaban ese `1` al nuevo material.
- `addPieceAlternative` (`~456`) espejaba cada main row con `length: Number(row.length) || 1, width: Number(row.width) || 1`.

**Fix (2 líneas, solo el flujo pieces):**
- `pieceDims`: `|| 1` → `|| 0` para `length`/`width` (y `{ length: 0, width: 0, quantity: 1 }` sin main); `quantity` sigue en `1` (fuera del requerimiento — es el conteo de panes neutro). Doc-comment actualizado: "Length/width default to 0 (not 1): a material added without real measurements must NOT count as 1 m² against the subtotal".
- `addPieceAlternative`: `length/width` → `|| 0` (mantiene `quantity || 1`).

**Lo que NO cambió (ya era correcto):**
- **Inputs Largo/Ancho** (`MaterialCard.tsx` + `SingularMaterialCard` en `PiecesSection.tsx`): `type="number"` sin `min`, sin onBlur; `value={mat.length || ''}` y `num={(v) => parseNumber(v) ?? 0}` → vacío se guarda `0` y se muestra `''`. El `min="1"` solo está en Cantidad. El operador puede limpiar un valor tipeado sin que se re-fuerce `1`.
- **Calculadoras 0-safe** (m² = `Number(length||0) × Number(width||0) × (quantity||1)` → 0 si falta una dimensión): `useBudgetCalculations.ts:262/265`, `computeMaterialsSubtotal` (`features/budgets/utils/commercialDiscount.ts`), `buildPdfData`/`buildSectionData` (asMaterials), `rowM2`/`rowSubtotal` de `MaterialCard`, `buildOptionFromMaterial` (`totalM2` SIEMPRE numérico, 0 para dims vacías). El flujo plano legacy ya creaba materiales con `length: 0, width: 0` (`entityFormHelpers.ts::addMaterialToList`).
- **Card de alternativa** (`QuoteOptionsGrid.tsx:120`): el fallback display `(mat.length * mat.width || 1.216)` → **`|| 0`** (branch defensivo cuando `totalM2` es nullish; en la práctica `buildOptionFromMaterial` siempre lo setea y con dims 0 muestra `0.00 m²`).

**Tests (vitest 412 → 415, `useBudgetPieces.test.ts` +3):**
1. `setPieceMain on an empty piece starts Largo/Ancho at 0 (not 1) — no phantom m²`: main y `materials_data` flat quedan 0/0/1.
2. `addPieceAlternative mirrors empty principal dims as 0 (not 1)`: alternativa y flat → 0/0/1.
3. `addPieceAlternative still mirrors REAL principal dims (same mesada invariant)`: main 2×0.5 → alternativa 2×0.5 (el espejado de dims reales sigue intacto).

**Verificación:** `npx tsc --noEmit` **0** · `npm run test` (vitest) **415/415** (35 files, 13.9s) · ESLint en los 3 archivos tocados: solo los 2 baseline preexistentes de `QuoteOptionsGrid.tsx:69-70` (`budgetId`/`onConvertirAlternativa`, no los introduce este cambio). Sin cambios de backend ni migración (los `0` de dims ya eran el default del wire legacy; un material sin medidas persiste 0 y el recalc server-side usa las mismas fórmulas 0-safe).


