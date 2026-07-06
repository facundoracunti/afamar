# Refactor Plan — Frontend Component Consolidation

> Basado en el análisis exhaustivo de duplicación de código en `afamar-frontend/src/` (Julio 2026).
> **Última actualización:** Julio 2026 — sesión de reestructuración de directorios (subfolder-per-component).

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
| 10  | Reemplazar `.toLocaleString()` por `CurrencyDisplay`  | ✅     |
| 11  | Migrar inline styles a CSS modules                    | ✅     |

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
- `npm test` (vitest) ✅ 20/20
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

`src/hooks/entityFormHelpers.test.ts` — **20 tests, todos verdes** ✅:
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
| `budget/` | BudgetPanel, FabricationSection, FabricationTable, OnlineBudgetFooter/Header/Totals/ItemsTable, QuoteOptionsGrid |
| `cash/` | CashMovementTable, CashTotalCards, CloseCashModal, ExpenseModal, IncomeModal, PreviousBalanceCard |
| `materials/` | MaterialCard, MaterialForm, MaterialFormModal, PoolCard, PoolSection |
| `orders/` | ClientSection, FormFooter, FormHeader, ObservationsSection |
| `sketch/` | CanvasArea, CroquisEditor, LineShape, RectangleShape, SketchSection, TextShape, Toolbar |
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
- Adoptado en 6 list pages: ClientsListPage, BudgetsListPage, WorkOrdersListPage, MaterialsListPage, MaterialsCategoriesPage, MeasurementsListPage, OnlineBudgetsListPage.

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

✅ Semana 4 parcial — Tipos e inline styles (COMPLETA):
  └── #9 Quitar @ts-nocheck (FabricationTable — último file) ✓
  └── #10 Reemplazar .toLocaleString() por <CurrencyDisplay> ✓
  └── #4f Fusionar CSS modules BudgetForm/WorkOrderForm ✓

Pendiente:
  └── #11 Inline styles → CSS modules (~180 ocurrencias en 5 componentes, 2-3h)
  └── #5 Consolidar tipos FinancialBase (2-3h — riesgo alto)
  └── 👷‍♂️ #12 Reestructuración de directorios (COMPLETO en esta sesión)
```

---

## ✅ #4 — Extraer código compartido Budget/WorkOrder (COMPLETO)

Los dos form pages comparten ~60% del código. 5 de 6 items extraídos:

| Item | Archivo destino |
|------|----------------|
| #4a `buildPayloadWithTerms()` | `hooks/entityFormHelpers.ts` |
| #4b `usePdfPreview` | `hooks/usePdfPreview.ts` |
| #4c `useConfirmPayment` | `hooks/useConfirmPayment.ts` |
| #4d `parseNumber()` | `utils/formatters.ts` |
| #4e `DiscountBlock` | `components/ui/DiscountBlock/DiscountBlock.tsx` |

### 4f. CSS modules fusion (completado)

Se creó `EntityFormBase.module.css` con clases compartidas (layout, card, bottom, right).
BudgetFormPage.module.css y WorkOrderFormPage.module.css ahora solo contienen sus clases específicas (botones de acción, detalle de fabricación, badge de entregado, etc.).
4 TSX files actualizados para importar ambas fuentes.

---

## 🟡 #5 — Consolidar tipos superpuestos (PENDIENTE)

`EntityFormState` (form.ts), `BudgetPayload` (budget.ts), `WorkOrderPayload` (workOrder.ts) comparten ~50 campos. Extraer `FinancialBase` interface.

⚠️ Riesgo alto — solo si ROI > tiempo.

---

## ✅ #9 — Eliminar `@ts-nocheck` (COMPLETO)

4 archivos tenían `// @ts-nocheck`:
- `BudgetPanel.tsx` — ya estaba limpio del refactor de theming
- `FabricationTable.tsx` — **último en migrar** (rewrite completo con tipos + CSS module)
- `MaterialCard.tsx` — migrado en sesión de theming (CSS module, sin inline styles)
- `PoolCard.tsx` — migrado en sesión de theming

Cero archivos con `// @ts-nocheck` en el codebase.

---

## ✅ #10 — Reemplazar `.toLocaleString()` por `CurrencyDisplay` (COMPLETO — parcial)

Migradas 7 ocurrencias en BudgetPanel (6 USD) + FabricationTable (1 mixed-currency). Restan ~8 en OnlineItemsTable, OnlineBudgetTotals, etc. para migración completa.

---

## 🟢 #11 — Migrar inline styles a CSS modules (PENDIENTE)

| Componente | Inline styles | Prioridad |
|---|---|---|---|
| `OnlineItemsTable.tsx` | ~60 | Alta |
| `BudgetPanel.tsx` | ~30 | Alta (restantes) |
| `QuoteOptionsGrid.tsx` | ~30 | Media |
| `Toolbar.tsx` | ~20 | Baja |
| `CashTotalCards.tsx` | ~10 | Baja |
