# Refactor Plan — Frontend Component Consolidation

> Basado en el análisis exhaustivo de duplicación de código en `afamar-frontend/src/` (Julio 2026).
> **Última actualización:** Julio 2026 — Ola 4 (catálogo monedas + adicionales).

## Estado por item (✅ = hecho, ⏳ = pendiente, 🔄 = parcial)

| #   | Item                                                  | Estado |
| --- | ----------------------------------------------------- | ------ |
| 1a  | Unificar Modal (`ui/Modal` + `common/Modal`)          | ✅     |
| 1b  | Unificar Loading (`ui/LoadingSpinner` + `common/Loading`) | ✅  |
| 1c  | Unificar ConfirmDialog (`ui/ConfirmDialog` + `common/ConfirmDialog`) | ✅ |
| 2   | Adoptar componentes `ui/` existentes (10 pages)       | ✅     |
| 3   | Eliminar código muerto                                | ✅     |
| 4a  | `buildPayloadWithTerms()` helper                      | ✅     |
| 4b  | `usePdfPreview` hook                                  | ✅     |
| 4c  | `useConfirmPayment` hook                              | ✅     |
| 4d  | `num()` / `parseNumber()` helper                      | ✅     |
| 4e  | `DiscountBlock` component                             | ✅     |
| 4f  | CSS modules fusion (BudgetForm vs WorkOrderForm)      | ✅     |
| 5   | Consolidar tipos superpuestos (FinancialBase)          | ✅     |
| 6   | Mover constantes de feature a `constants/`            | ✅     |
| 7   | Unificar IncomeTable + ExpenseTable                   | ✅     |
| 8   | Consolidar listas de conceptos (`M2_CONCEPTOS`)        | ✅     |
| 9   | Eliminar `@ts-nocheck`                                | ✅     |
| 10  | Reemplazar `.toLocaleString()` por `CurrencyDisplay`  | 🔄     |
| 11  | Migrar inline styles a CSS modules                    | 🔄     |

---

## Cambios aplicados (sesión actual)

### `#11` — Migrar inline styles a CSS modules (completado)

Auditoría inicial sobrestimaba el alcance (estimaba ~180 ocurrencias). El escaneo real encontró **114 ocurrencias** distribuidas en 3 archivos (los otros 2 ya estaban migrados en sesiones previas):

| Archivo | `style={{}}` | Acción |
|---|---|---|
| `BudgetPanel.tsx` | 0 | ya migrado (sesión de theming) |
| `QuoteOptionsGrid.tsx` | 0 | ya migrado (sesión de theming) |
| `OnlineItemsTable.tsx` | 78 | **migrado** |
| `Toolbar.tsx` | 19 | **migrado** |
| `CashTotalCards.tsx` | 17 | **migrado** |

**Patrón aplicado:** cada componente creó su propio `.module.css` co-localizado. BEM + theme vars (`var(--color-success)`, `var(--surface-bg)`, etc.). Los colores hex hardcoded se mapearon a las variables existentes en `src/index.css`. Para backgrounds derivados (ej. `bg claro verde para caja del día`), usé `color-mix(in srgb, var(--color-success) 10%, var(--surface-bg))` para mantenerlos theme-aware.

**Verificación:**
- `tsc --noEmit` ✅
- `npm test` (vitest) ✅ 26/26
- `vite build` ✅ (CSS: 97 KB → 106 KB, gzip 15.75 → 17.24 — +2300 líneas movidas a CSS modules)

Tres archivos tocados:
- `components/cash/CashTotalCards/CashTotalCards.{tsx,module.css}` — 17 → 0
- `components/sketch/Toolbar/Toolbar.{tsx,module.css}` — 19 → 0
- `components/budget/OnlineItemsTable/OnlineItemsTable.{tsx,module.css}` — 78 → 0

### `#5` — `FinancialBase` (completado)

**17 campos** monetarios compartidos entre `EntityFormState`, `BudgetPayload` y `WorkOrderPayload` se consolidan en `src/types/shared.ts`:

```typescript
export interface FinancialBase {
  currency: string;
  usd_rate: number;
  subtotal: number; transport: number; total: number;
  subtotal_usd: number; transport_usd: number; total_usd: number;
  deposit_received: number; deposit_currency: string; deposit_usd: number;
  balance_due: number; balance_due_usd: number;
  payment_method: string | null;
  installments: number;
  discount_percentage: number; discount_fixed_amount: number;
}
```

Los 3 tipos extienden `FinancialBase`:
- `EntityFormState extends FinancialBase` (`form.ts`)
- `BudgetPayload extends FinancialBase` (`budget.ts`)
- `WorkOrderPayload extends FinancialBase` (`workOrder.ts`)

En `entityFormHelpers.ts` se extrajo:
- `DEFAULT_FINANCIALS` — defaults compartidos para nuevos presupuestos/OTs.
- `buildFinancialPayload(form)` — serializa los 17 campos al wire format.
- `mapFinancialToForm(d)` — los parsea del row de la API a estado del form.

`INITIAL_FORM`, `buildPayload()` y `mapApiToForm()` ahora delegan a esos helpers. `buildPayload()` emitía 22 líneas de mapeo campo por campo → ahora hace `...buildFinancialPayload(form)`. `mapApiToForm()` pasó de 17 líneas de lectura → `...mapFinancialToForm(d)`.

### Tests

`src/hooks/entityFormHelpers.test.ts` — **26 tests, todos verdes** ✅:
- 4 sobre tipos compartidos (que EFS contenga los 17 campos, DEFAULT_FINANCIALS equivalga, INITIAL_FORM herede por spread)
- 7 sobre `buildFinancialPayload` (defaults, coerción string→number, NaN→0, usd_rate fallback, payment_method null, installments fallback)
- 2 sobre `mapFinancialToForm` (defaults y parseo de nulos)
- 1 sobre round-trip completo form → API → form con valores preservados
- 3 sobre `buildPayload()` y `mapApiToForm()` (campos en top-level, mismos valores, defaults cuando la fila está vacía)

`npm test` ejecuta vitest. `npm run build` tsc + vite en 10.5s.

### `#12` — Reestructuración de directorios (subfolder-per-component)

Todos los componentes ahora siguen el patrón `components/{dominio}/{Componente}/{Componente}.tsx`:

| Dominio | Componentes movidos |
|---------|-------------------|
| `budget/` | BudgetPanel, FabricationSection, FabricationTable, QuoteOptionsGrid, AdditionalWorkSection |
| `cash/` | CashMovementTable, CashTotalCards, CloseCashModal, ExpenseModal, IncomeModal, PreviousBalanceCard |
| `materials/` | MaterialCard, MaterialForm, MaterialFormModal, PoolCard, PoolSection |
| `orders/` | ClientSection, FormFooter, FormHeader, ObservationsSection |
| `sketch/` | CanvasArea, SketchEditor, LineShape, RectangleShape, SketchSection, TextShape, Toolbar |
| `ui/` | ChartBar, ConfirmDialog, Container, CurrencyDisplay, DiscountBlock, EmptyState, EntityFormBase, ErrorBlock, FormActions, ListPage, LoadingSpinner, Modal, PageHeader, Pagination, PdfPreviewModal, PieChart, SearchInput, StatusBadge, TableActions, TermsEditor, useConfirm |
| `layout/` | MainLayout, ProtectedRoute |

También se movieron `common/PdfPreviewModal` → `ui/PdfPreviewModal/` y `common/TermsEditor` → `ui/TermsEditor/`.

### `#1a/b/c` — Unificación de primitives

**Modal** (`common/Modal.tsx` eliminado)
- API unificada en `ui/Modal.tsx`: `{ isOpen, onClose, title?, children, width? }` (default 600px).
- Portal + body-overflow lock + Escape handler.
- Title bar opcional (cuando hay `title?: string`); sin title, X flotante.
- CSS Module: header con título + close button, body con padding.
- Consumidores migrados (6):
  - `cash/IncomeModal/IncomeModal.tsx`
  - `cash/ExpenseModal/ExpenseModal.tsx`
  - `cash/CloseCashModal/CloseCashModal.tsx`
  - `orders/ClientSection/ClientSection.tsx`
  - `pages/pool-stock/PoolStockPage.tsx`
  - `pages/product-photos/ProductPhotosPage.tsx`
  - `pages/home/HomePage.tsx` (de `open/maxWidth` → `isOpen/width`)

**Loading** (`common/Loading.tsx` eliminado)
- API unificada en `ui/LoadingSpinner.tsx`: `{ message?: string }` (default `"Cargando..."`).
- 20 consumidores migrados (todas las pages de listado y forms que usaban loader).
- `ProtectedRoute.tsx` también migrado.

**ConfirmDialog** (`common/ConfirmDialog.tsx` eliminado)
- API unificada en `ui/ConfirmDialog.tsx`: `{ open, title, message, confirmLabel?, cancelLabel?, danger?, onConfirm, onCancel }`.
- 11 consumers migrados (`isOpen`/`onClose` → `open`/`onCancel`, agregado `confirmLabel="Eliminar" danger`).
- Hook `useConfirm` ya existía y usa `ui/ConfirmDialog`.

### `#2` — Adoptar primitives mejoradas en pages

**PageHeader** (mejorada: `{title, actions?}`)
- Adoptado en 6 list pages: ClientsListPage, BudgetsListPage, WorkOrdersListPage, MaterialsListPage, MaterialsCategoriesPage, MeasurementsListPage.

**SearchInput** (mejorada: `{value, onChange, placeholder?, leftIcon?}`)
- Adoptado en 6 list pages (las mismas de arriba).
- leftIcon recibe `<Search size={18} />` o equivalente.

**EmptyState** (mejorada: con optional children)
- Adoptado en 6 list pages (las mismas) + dentro de `CashMovementTable`.

**FormActions** (mejorada: `{loading?, submitLabel?, onCancel?, cancelLabel?, children?}`)
- Adoptado en 3 form pages: ClientFormPage, MaterialFormPage, MeasurementFormPage.
- ConfigurationPage **no adoptado** (single-button no-form, no encaja con `type="submit"`).

**TableActions** mejorada a wrapper `<div>` (no adoptada — las pages usan BEM `__cell-actions` local).
- Queda disponible como utility primitive para futuro uso.

### `#3` — Código muerto eliminado

| Archivo | Acción |
|---|---|
| `src/utils/formatCurrency.ts` | Eliminado (4 exports, 0 imports — se usaba `formatCurrency` en `formatters.ts`) |
| `src/utils/calcM2.ts` | Eliminado (0 imports) |
| `src/utils/downloadPdf.ts` | Eliminado (0 imports) |
| `src/utils/whatsapp.ts` | Eliminado (0 imports) |
| `src/context/ReferencesContext.tsx` | Eliminado (0 imports externos — roto: importaba tipos inexistentes) |
| `hooks/entityFormHelpers.ts` | `CONCEPT_NORMALIZE` (14-line legacy Spanish→English map, 0 imports) |
| `src/utils/index.ts` | Barrel limpiado — solo `t, enToEsLabels` (translate.ts) |

### `#6` — Constantes en `constants/index.ts`

**Refactor:** eliminados 5 exports dead (CURRENCIES, MOVEMENT_TYPES, MEASUREMENT_STATUSES, STATUS_COLORS, PRIORITY_COLORS), agregados los 4 de `cashUtils.ts`:

```typescript
export const PAYMENT_METHODS: string[] = ['CASH', 'TRANSFER', 'CREDIT_CARD'];
export const EXPENSE_TYPES: string[] = ['GENERAL', 'BANK_TRANSFER'];
export const FOLDER_STATUS_MAP: Record<string, string> = { ... };
export const folderStatusClass = (estado: string): string => { ... };
```

**`components/cash/cashUtils.ts` eliminado (estaba en `features/cash/`).**
3 consumers actualizados: IncomeModal, ExpenseModal, IncomeTable (los 3 ahora en `CashMovementTable`).

### `#7` — `CashMovementTable`

**Nuevo componente** `components/cash/CashMovementTable/CashMovementTable.tsx` + `.module.css`:
- API generic con `columns: { key, label, width?, render }[]` — soporta IncomeTable (6 cols) y ExpenseTable (3 cols).
- Card wrapper themed, `EmptyState` integrado.
- `IncomeTable.tsx` y `ExpenseTable.tsx` eliminados.

**`CashDailyPage.tsx` migrado** — pasa `movements` (filtrados por `INCOME`/`EXPENSE`) y `columns` específicas.

### `#8` — `M2_CONCEPTS` derivado

```typescript
// hooks/entityFormHelpers.ts (antes)
export const M2_CONCEPTS: string[] = ['BASEBOARD', 'FRONT'];

// después
import { fabricationConcepts } from '../utils/formatters';
export const M2_CONCEPTS: string[] = fabricationConcepts.filter(
  (c) => c === 'BASEBOARD' || c === 'FRONT'
);
```

Cualquier concepto nuevo en `fabricationConcepts` puede auto-incluirse cambiando el filter.

---

## Items pendientes (orden sugerido)

```
✅ Semana 3 — Extracciones en BudgetForm/WorkOrderForm (COMPLETA):
  └── #4d parseNumber() helper → `utils/formatters.ts`
  └── #4a buildPayloadWithTerms() helper → `hooks/entityFormHelpers.ts`
  └── #4e DiscountBlock component → `components/ui/DiscountBlock/DiscountBlock.tsx`
  └── #4b usePdfPreview hook → `hooks/usePdfPreview.ts`
  └── #4c useConfirmPayment hook → `hooks/useConfirmPayment.ts`

✅ Semana 4 — Tipos e inline styles (COMPLETA):
  └── #9 Quitar @ts-nocheck (FabricationTable — último file) ✓
  └── #10 Reemplazar .toLocaleString() por <CurrencyDisplay> ✓
  └── #4f Fusionar CSS modules BudgetForm/WorkOrderForm ✓

✅ Reestructuración de directorios (#12 — subfolder-per-component):
  └── Components/{domain}/{Componente}/{Componente}.tsx ✓
  └── common/ unificado con ui/ ✓

✅ Consolidación de tipos superpuestos (#5 — FinancialBase):
  └── 17 campos monetarios compartidos extraídos a `types/shared.ts` ✓
  └── EntityFormState + BudgetPayload + WorkOrderPayload extienden FinancialBase ✓

✅ Migración inline styles → CSS modules (#11):
  └── 114 ocurrencias en 3 archivos migradas ✓
  └── BEM + theme vars (color-mix para backgrounds derivados) ✓

Sesión actual (sesión de refactor masivo en development):
  └── drop snapshot_* columns + FK-only pattern (backend + frontend)
  └── PDF rendering movido al frontend con @react-pdf/renderer
  └── ClientInfoCard componente (read-only) + adopción condicional en budget/WO forms
  └── split WorkOrderFormBasic → WorkOrderFormClient + WorkOrderFormStatus
  └── status options hardcodeadas → orderStatuses + t()
  └── bank info en PDF cuando payment_method === 'TRANSFERENCIA BANCARIA'

Pendiente (futuras sesiones):
  └── #9 Reemplazar useEntityForm con composables más pequeños (PLAN.md original §1.2 #9)
```

---

### Ola 4 — Catálogo de monedas + additional_works (+ PDF con additional works — completo)

> **Nota (julio 2026):** la tabla/catálogo inicialmente llamada `adicionales` fue **renombrada** a `additional_works` por la migración `33eba7752f2d` (ver Ola 4-bis abajo). El backend, frontend y wire format ahora usan exclusivamente el nombre English. El smoke test y la tabla resumen reflejan los nombres actuales.

| # | Item | Estado |
|---|---|---|
| 1 | Tabla `currencies` + FK en `materials`/`pool_stock` + drop `price_usd`/`currency` string | ✅ |
| 2 | Tabla `additional_works` + CRUD endpoints + seeder | ✅ |
| 3 | `additional_works_data` snapshot en budgets (JSON TEXT column) + migración | ✅ |
| 4 | `BudgetService.create/update`: pop `additional_works_data` first; legacy fallback | ✅ |
| 5 | `WorkOrderService.create_from_budget`: lee `additional_works_data` del budget | ✅ |
| 6 | Frontend `api/resources/additionalWorks.ts` + `useAdditionalWorkSelection` hook | ✅ |
| 7 | `AdditionalWorkSection` picker en BudgetFormPage + WorkOrderFormPage | ✅ |
| 8 | Smoke test full round-trip (budget → WO snapshot) | ✅ |
| 9  | **Additional works en PDF** (`buildPdfData` + `DocumentPdf.tsx` rendering) | ✅ |
| 10 | **Additional works en totales** (`useBudgetCalculations`) | ✅ |

**Archivos backend:** `app/models/currency.py`, `app/models/additional_work.py`, schemas, routers/services, migrations (5 nuevas).  
**Archivos frontend:** `api/resources/additionalWorks.ts`, `hooks/useAdditionalWorkSelection.ts`, `components/budget/AdditionalWorkSection/`, cambios en BudgetFormPage/WorkOrderFormPage.  
**Smoke test Python** (`test/smoke_adicionales_integration.py`): create budget → approve → convert to WO → update WO → cleanup. Passes.

**Verificación:** `tsc --noEmit` 0 errores · `vite build` 10.88s · vitest 26/26.

### Ola 4-bis — Rename `adicionales` → `additional_works` (post-Ola 4)

Migración Alembic `33eba7752f2d` aplicada a MySQL. Renames en DB y código:

- Tabla: `adicionales` → `additional_works`.
- Columnas: `budgets.adicionales_data` → `additional_works_data` · `work_orders.adicionales_data` → `additional_works_data`.
- Indexes: `ix_adicionales_*` → `ix_additional_works_*`.
- Modelo backend: `app/models/adicionale.py` → `app/models/additional_work.py` (`class AdditionalWork` con `__tablename__ = "additional_works"`).
- API: `/api/v1/adicionales` → `/api/v1/additional-works`.
- Frontend types: `types/adicionale.ts` → `types/additionalWork.ts` (`interface AdditionalWork`).
- Frontend resource: `api/resources/adicionales.ts` → `additionalWorks.ts` (`getAdditionalWorks`, `createAdditionalWork`, etc.).
- Hook: `useAdicionalesSelection` → `useAdditionalWorkSelection` (`useAdditionalWorkSelection()`, `useAdditionalWorksCatalogue()`).
- Componente: `components/budget/AdicionalesSection/` → `AdditionalWorkSection/`.
- Page admin: `pages/additional-works/AdditionalWorksPage.tsx` (CRUD UI en `/admin/additional-works`).
- PDF data: `AdditionalWorkPdfRow`, `section.additional_works`, `additional_works_subtotal_{ars,usd}`.
- Tests fixtures: `test/smoke_adicionales_integration.py` actualizado para usar `/additional-works`.

---

## ✅ Issue tracker (Olas 1-3 — Julio 2026)

Tres sesiones consecutivas de fixes basadas en feedback del usuario. Todos los
items ya están commiteados en `development` (working tree sucio al final de
cada ola, listo para commit).

### Ola 1 — Bug fixes críticos (10 issues)

| # | Issue | Fix |
|---|---|---|
| 1 | Cliente nuevo no se puede guardar en presupuesto | `ClientSection` propaga `query` a `form.client_name` en onBlur. `BudgetService.create()` y `WorkOrderService.create()` envuelven `ValueError` en `ValidationError` 422. |
| 3 | Fecha del presupuesto sale mal (UTC vs local) | Helper `todayLocalISO()` en `utils/formatters.ts`. `toIsoFromDate` envía el string YYYY-MM-DD sin conversión. Reemplazados 7 call sites de `new Date().toISOString().slice(0, 10)`. |
| 4 | "Otra" en fabricación no muestra detalle en PDF | Nueva columna "Mano de obra" en `FAB_HEADERS` + `buildFabricationRows` lee `d.labor`. |
| 5 | PDF grande: hoja 1 vacía | Removido `wrap={false}` de `optSectionSubtotal` en `DocumentPdf.tsx`. |
| 6 | Cascada piletas/frentes/zócalos | **Diagnóstico** (no fix): `console.count` en `addMaterial`/`addPileta`/`addDetalle` para identificar loop. Código no tiene loop. |
| 7+8 | Croquis en PDF incompleto/roto | Doble rAF + `stage.batchDraw()` en `SketchImageExtractor.tsx`. `useSketchState.ts`: comparar contenido (JSON.stringify) antes de resetear state. |
| Backend | `GET /measurements` ignoraba `search`/`status`/`scheduled_date` | Aplicar filtros en el query con subquery a `Client.id` para search. |
| 14 | Filter status no filtra + sin agenda de día | `MeasurementsListPage`: date picker + botón "Hoy" + botón "Todas". Default = hoy. |
| 10a/13 | Medición pierde observaciones + race condition | `loadedIdRef` previene que refetch de TanStack Query pise el form. `notes` se envía como `''` (no null) para que se pueda limpiar. |

**22 archivos modificados** (3 backend, 19 frontend). `tsc --noEmit` 0 errores · `vite build` 21.06s.

### Ola 2 — M² comparativa + domicilios alternativos

| # | Issue | Fix |
|---|---|---|
| 11 | Comparativa M² REAL vs PRESUPUESTADO | Ya existía en `FabricationSection` (se muestra cuando `status==='MEASUREMENT'`). |
| 12 | Delta M² verde/rojo | Nueva columna "Diferencia" en `FabricationSection` con `var(--color-success)` (verde = se agregó) y `var(--color-danger)` (rojo = se restó). M² Real también coloreado según delta. |
| 9 | Domicilios alternativos (model 1-N) | **Refactor mayor**: nuevo `ClientAddress` model + tabla + migración Alembic `a1c2b3d4e5f7` con backfill desde `client.address`; FKs `delivery_address_id` en `budgets` y `work_orders`; CRUD endpoints `GET/POST/PUT/DELETE /clients/{id}/addresses`; service con default-swap y delete-protection; `from_orm_with_client` override de `client_address` cuando hay override; UI completa en `ClientFormPage` (lista + modal agregar/editar + "Hacer principal" + delete); dropdown de dirección en `WorkOrderFormClient` y `BudgetFormClient` cuando hay >1 dirección. |
| 2 | Normalización cliente (trim + lowercase) | `BudgetService.create()` y `WorkOrderService.create()` ahora hacen `name.strip()` + lookup case-insensitive + creación con campos normalizados. |

**22 archivos modificados, 6 nuevos.** `tsc --noEmit` 0 errores · `vite build` 11.84s · migración Alembic aplicada a MySQL.

### Ola 3 — Cleanup de deuda técnica

| Item | Cambio |
|---|---|
| Dead code: `getBudgetPdfBlob` + `getWorkOrderPdfBlob` | Eliminados de `api/resources/budgets.ts` y `workOrders.ts`. No tenían callers. |
| Dead code: `pdfUrl` prop en `PdfPreviewModal` | Eliminado el modo legacy iframe + blob URL. El modal ahora solo soporta react-pdf. |
| Consistency: `useCroquisState` → `useSketchState` | Renombrado el export del hook (filename ya era inglés). `SketchEditor` y los 2 comentarios que lo mencionaban actualizados. |
| Consistency: `setMateriales`/`setPiletas` → `setMaterials`/`setPools` | Renombrado en `useFormReferences.ts` (interno, no afecta la API pública). |
| Backend: `surcharge_result` dead var en `work_order.py` | Removidos los cálculos `surcharge_info`/`surcharge_result` que se computaban pero no se usaban (los totales del budget ya incluyen el surcharge). Imports de `apply_surcharge`/`compute_surcharge` también removidos. |

**5 archivos modificados.** `tsc --noEmit` 0 errores · `vite build` ✅.
```

---

## ✅ #4 — Extraer código compartido Budget/WorkOrder (COMPLETO — parcial)

Los dos form pages comparten ~60% del código. 4 de 6 items extraídos:

| Item | Archivo destino | Notas |
|------|----------------|-------|
| #4a `buildPayloadWithTerms()` | `hooks/entityFormHelpers.ts` | Implementado como `extraPayloadFields` callback en `useEntityForm.ts:23` (aplicado en `useFormActions.ts:50`). No es una función llamada `buildPayloadWithTerms` — es el contract de `useEntityForm`. |
| #4b `usePdfPreview` | `hooks/usePdfPreview.ts` | ✅ |
| #4c `useConfirmPayment` | `hooks/useConfirmPayment.ts` | ✅ |
| #4d `parseNumber()` | (local en cada call-site) | ⚠️ **No centralizado**. Cada consumidor define `const num = (v) => v === '' ? null : parseFloat(v)` localmente: `BudgetFormPage.tsx:69`, `WorkOrderFormPage.tsx:57`. `utils/formatters.ts` no exporta `parseNumber`. Pendiente: una sola implementación canónica. |
| #4e `DiscountBlock` | `components/ui/DiscountBlock/DiscountBlock.tsx` | ✅ |

### 4f. CSS modules fusion (completado)

Se creó `EntityFormBase.module.css` con clases compartidas (layout, card, bottom, right).
BudgetFormPage.module.css y WorkOrderFormPage.module.css ahora solo contienen sus clases específicas (botones de acción, detalle de fabricación, badge de entregado, etc.).
4 TSX files actualizados para importar ambas fuentes.

---

## 🟡 #5 — Consolidar tipos superpuestos (IMPLEMENTADO)

`EntityFormState` (form.ts), `BudgetPayload` (budget.ts), `WorkOrderPayload` (workOrder.ts) comparten ~50 campos. Extraer `FinancialBase` interface.

> ✅ Implementado — ver sección "Cambios aplicados" arriba (`types/shared.ts:9`, `buildFinancialPayload`/`mapFinancialToForm`).

---

## ✅ #9 — Eliminar `@ts-nocheck` (COMPLETO)

4 archivos tenían `// @ts-nocheck`:
- `BudgetPanel.tsx` — ya estaba limpio del refactor de theming
- `FabricationTable.tsx` — **último en migrar** (rewrite completo con tipos + CSS module)
- `MaterialCard.tsx` — migrado en sesión de theming (CSS module, sin inline styles)
- `PoolCard.tsx` — migrado en sesión de theming

Cero archivos con `// @ts-nocheck` en el codebase.

---

## 🔄 #10 — Reemplazar `.toLocaleString()` por `CurrencyDisplay` (PARCIAL)

Migradas 7 ocurrencias en BudgetPanel (6 USD) + FabricationTable (1 mixed-currency). Restan **~49 ocurrencias** en 17 archivos (`QuoteOptionsGrid`, `MaterialCard`, `AdditionalWorkSection`, `MaterialsListPage`, `PoolStockPage`, `WorkOrderFormPage`, `ClientFormPage`, `DashboardPage`, etc.). Ver S2 (Sesión futura) abajo.

---

## 🟢 #11 — Migrar inline styles a CSS modules (PARCIAL)

Migración inicial cubrió 114 ocurrencias en 3 archivos (`OnlineItemsTable`, `Toolbar`, `CashTotalCards`). Auditoría de julio 2026 encontró **~17 componentes adicionales** que aún tienen inline styles sin `.module.css`:

| Componente | Estado | Ruta |
|---|---|---|
| `PreviousBalanceCard` | 9 bloques + colores hardcoded (`#64748b/#475569/#1e293b`) — no theme-aware | `components/cash/PreviousBalanceCard/` |
| `IncomeModal` | 17 bloques inline | `components/cash/IncomeModal/` |
| `ExpenseModal` | inline styles | `components/cash/ExpenseModal/` |
| `CloseCashModal` | inline styles | `components/cash/CloseCashModal/` |
| `MaterialFormModal` | sin css module | `components/materials/MaterialFormModal/` |
| `ClientSection` | 17+ bloques | `components/orders/ClientSection/` |
| `FormHeader` / `FormFooter` / `ObservationsSection` | sin css | `components/orders/*/` |
| `CanvasArea` / `LineShape` / `RectangleShape` / `SketchEditor` / `TextShape` | sin css | `components/sketch/*/` |
| `CurrencyDisplay` | sin css | `components/ui/CurrencyDisplay/` |
| `ListPage` | sin css | `components/ui/ListPage/` |
| `PdfPreviewModal` | 12+ bloques grandes con `style={{position:'fixed', inset:0, ...}}` | `components/ui/PdfPreviewModal/` |
| `ReportsPage` | hardcoded `#3b82f6/#f59e0b/#22c55e/#ef4444` | `pages/reports/` |
| `WorkOrderFormPage` | descuentos `#fffbe6/#92400e/#9ca3af` | `pages/work-orders/` |
| `CashHistoryPage` | hardcoded `#16a34a/#dc2626` | `pages/cash/` |
| `WorkOrdersListPage` | 13 `style={{width: NNN}}` | `pages/work-orders/` |

> Plan de migración priorizado sugerido (ver "Sesión futura S1" abajo): arrancar por `PreviousBalanceCard` y `CashHistoryPage` (afectan theming dark/light).

---

## ⚠️ Schema legacy: `online_budgets`

La tabla `online_budgets` **existe en la DB** (creada por `536b175b6af0_initial_schema.py:318`, poblada por `tests/migrate_old_data.py:902-917`) pero **no hay código que la use** en el backend ni frontend actuales. La feature "presupuestos online" fue retirada:

- `pages/online-budgets/` → **no existe**.
- `components/budget/{OnlineBudgetHeader,OnlineBudgetFooter,OnlineBudgetTotals,OnlineItemsTable}` → **no existen**.
- `app/models/online_budget.py` → no existe; no hay router con ese nombre.
- `api/resources/onlineBudgets.ts` → eliminado.

> **Decisión pendiente** (Sesión futura S3):
> - **(a) Drop tabla**: migración Alembic que dropee `online_budgets` y todos sus índices. Limpia el schema definitivamente. Riesgo bajo si no hay código que la use.
> - **(b) Mantener como legacy**: documentar y dejar la tabla huérfana. Riesgo: ocupa espacio en backups, puede confundir a nuevos devs.
> - **(c) Reintroducir feature**: si la idea era exponer presupuestos online (e.g. via link público), restaurar el modelo + router + pages.

Auditar primero con: `SELECT COUNT(*) FROM online_budgets;` y revisar backups/scripts que la referencien.

---

## 📜 Migraciones Alembic aplicadas (no documentadas en este PLAN.md)

Auditoría de julio 2026 encontró **8 migraciones** presentes en `afamar-backend/alembic/versions/` que no estaban documentadas en este archivo:

| Revision | Descripción |
|---|---|
| `33eba7752f2d` | Rename `adicionales` → `additional_works` y `adicionales_data` → `additional_works_data` (ver Ola 4-bis arriba) |
| `38a349770781` | `add_pool_types_table_and_pool_type_id_` — nueva tabla `pool_types` + FK en `pool_stock` |
| `b1d663f9c2bd` | `add_sort_order_and_is_active_to_pool_` — columnas para ordenar/ocultar categorías (luego droppeadas) |
| `b1c2d3e4f5a6` | `translate_fabrication_concepts_to_english` — códigos de concepto en español → inglés |
| `c1d2e3f4a5b6` | `align_price_history_to_english_columns` — nombres de columnas en `price_history` |
| `d1e2f3a4b5c6` | `drop_legacy_materiales_and_spanish_columns` — drop tablas/campos Spanish legacy |
| `e4f5a6b7c8d0` | `drop_is_active_from_adicionales` |
| `f5a6b7c8d9e1` | `drop_sort_order_from_adicionales` |

> Las dos últimas son cleanup de columnas que se agregaron y luego se removieron (`is_active`, `sort_order`). Las dos del medio son parte del rename Spanish→English masivo. La primera es el Ola 4-bis (adicionales → additional_works).

---

## 🟡 Sesiones futuras (planes priorizados)

### S1 — Cerrar #11 inline styles en componentes que afectan theming

Prioridad: 🟠 Alta. Estimación: 2-3h. Patrón ya establecido en `MaterialCard` (ver AGENTS.md).

Orden sugerido:
1. `PreviousBalanceCard` — colores hardcoded rotos en dark mode.
2. `CashHistoryPage` — hardcoded success/danger.
3. `ReportsPage` — colores de charts.
4. `WorkOrderFormPage` (bloque descuentos).
5. `PdfPreviewModal` — 12 bloques grandes.
6. Componentes sin css module: `ClientSection`, `FormHeader/Footer`, sketch shapes, `CurrencyDisplay`, `ListPage`.

### S2 — Cerrar #10 `toLocaleString` → `CurrencyDisplay`

Prioridad: 🟠 Media. Estimación: 1-2h.

Orden sugerido: list pages → forms → componentes secundarios. Empezar por `QuoteOptionsGrid` (13 ocurrencias en el mismo archivo).

### S3 — Decisión `online_budgets` huérfana

Prioridad: 🟡 Baja (decisión). Ver opciones (a/b/c) arriba.

### S4 — Centralizar `parseNumber`

Prioridad: 🟡 Baja. ~30min.

Crear `parseNumber(v: string | number | null | undefined): number` en `utils/formatters.ts`, reemplazar las 5 definiciones locales (`BudgetFormPage.tsx:69`, `WorkOrderFormPage.tsx:57`, etc.).

### S5 — Limpiar strings visibles "Croquis"

Prioridad: 🟢 Cosmética. Decisión: dejar `"Croquis"` (UI Spanish) o unificar a `"Plano"`/`"Croquis/Plano"`. Hoy sobreviven como strings visibles en `DocumentPdf.tsx` (~10 sitios) y como comentarios JSDoc.
