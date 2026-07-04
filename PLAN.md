# Refactor Plan — Frontend Component Consolidation

> Basado en el análisis exhaustivo de duplicación de código en `afamar-frontend/src/` (Julio 2026).
> **Última actualización:** Julio 2026 — sesiones de "Mejorar ui/ primitives" y "Adopt primitives en 10 pages".

## Estado por item (✅ = hecho, ⏳ = pendiente, 🔄 = parcial)

| #   | Item                                                  | Estado |
| --- | ----------------------------------------------------- | ------ |
| 1a  | Unificar Modal (`ui/Modal` + `common/Modal`)          | ✅     |
| 1b  | Unificar Loading (`ui/LoadingSpinner` + `common/Loading`) | ✅  |
| 1c  | Unificar ConfirmDialog (`ui/ConfirmDialog` + `common/ConfirmDialog`) | ✅ |
| 2   | Adoptar componentes `ui/` existentes (10 pages)       | ✅     |
| 3   | Eliminar código muerto                                | ✅     |
| 4a  | `buildPayloadWithTerms()` helper                      | ⏳     |
| 4b  | `usePdfPreview` hook                                  | ⏳     |
| 4c  | `useConfirmPayment` hook                              | ⏳     |
| 4d  | `num()` / `parseNumber()` helper                      | ⏳     |
| 4e  | `DiscountBlock` component                             | ⏳     |
| 4f  | CSS modules fusion (BudgetForm vs WorkOrderForm)      | ⏳     |
| 5   | Consolidar tipos superpuestos (FinancialBase)          | ⏳     |
| 6   | Mover constantes de feature a `constants/`            | ✅     |
| 7   | Unificar IncomeTable + ExpenseTable                   | ✅     |
| 8   | Consolidar listas de conceptos (`M2_CONCEPTS`)        | ✅     |
| 9   | Eliminar `@ts-nocheck`                                | ⏳     |
| 10  | Reemplazar `.toLocaleString()` por `CurrencyDisplay`  | ⏳     |
| 11  | Migrar inline styles a CSS modules                    | ⏳     |

---

## Cambios aplicados (sesión actual)

### `#1a/b/c` — Unificación de primitives

**Modal** (`common/Modal.tsx` eliminado)
- API unificada en `ui/Modal.tsx`: `{ isOpen, onClose, title?, children, width? }` (default 600px).
- Portal + body-overflow lock + Escape handler.
- Title bar opcional (cuando hay `title?: string`); sin title, X flotante.
- CSS Module: header con título + close button, body con padding.
- Consumidores migrados (6):
  - `features/cash/IncomeModal.tsx`
  - `features/cash/ExpenseModal.tsx`
  - `features/cash/CloseCashModal.tsx`
  - `features/orders/ClientSection.tsx`
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

**`components/features/cash/cashUtils.ts` eliminado.**
3 consumers actualizados: IncomeModal, ExpenseModal, IncomeTable (los 3 ahora en `CashMovementTable`).

### `#7` — `CashMovementTable`

**Nuevo componente** `components/features/cash/CashMovementTable.tsx` + `.module.css`:
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
Semana 3 — Extracciones en BudgetForm/WorkOrderForm:
  └── #4d num() helper en formatters.ts (15 min)
  └── #4a buildPayloadWithTerms() helper (30 min)
  └── #4e DiscountBlock component (30 min)
  └── #4b usePdfPreview hook (45 min)
  └── #4c useConfirmPayment hook (30 min)

Semana 4 — Tipos e inline styles:
  └── #9 Quitar @ts-nocheck de 4 files (1h)
  └── #5 Consolidar tipos FinancialBase (2-3h — riesgo alto)
  └── #10 Reemplazar .toLocaleString() por <CurrencyDisplay> (1h)

Semana 5+ — Cleanup final:
  └── #4f Fusionar CSS modules de BudgetForm/WorkOrderForm (1h)
  └── #11 Inline styles → CSS modules (~240 ocurrencias en 7 componentes, 3-4h)
```

---

## 🔴 #4 — Extraer código compartido Budget/WorkOrder (PENDIENTE)

Los dos form pages comparten ~60% del código.

### 4a. `buildPayloadWithTerms()` — mover a `entityFormHelpers`

```typescript
// entityFormHelpers.ts
export function buildPayloadWithTerms(form, terms) {
  return {
    ...buildPayload(form),
    delivery_terms_override: JSON.stringify(terms.filter(t => t.trim())),
  };
}
```

### 4b. `usePdfPreview` hook

Hook para previsualizar PDF (DRY entre BudgetFormPage y WorkOrderFormPage).

### 4c. `useConfirmPayment` hook

Centraliza la lógica de marcar balance como pagado/no pagado.

### 4d. `parseNumber()` helper

```typescript
// utils/formatters.ts
export const parseNumber = (v) => v === '' ? null : parseFloat(v);
```

### 4e. `DiscountBlock` component

JSX idéntico en BudgetForm y WorkOrderForm (~35 líneas) → extraer.

### 4f. CSS modules fusion

`BudgetFormPage.module.css` y `WorkOrderFormPage.module.css` son ~90% idénticos.

---

## 🟡 #5 — Consolidar tipos superpuestos (PENDIENTE)

`EntityFormState` (form.ts), `BudgetPayload` (budget.ts), `WorkOrderPayload` (workOrder.ts) comparten ~50 campos. Extraer `FinancialBase` interface.

⚠️ Riesgo alto — solo si ROI > tiempo.

---

## 🟢 #9 — Eliminar `@ts-nocheck` (PENDIENTE)

4 archivos con `// @ts-nocheck`:
- `BudgetPanel.tsx`
- `FabricationTable.tsx`
- `MaterialCard.tsx`
- `PoolCard.tsx`

Causa común: `Record<string, unknown>` + castings. Tipar props correctamente.

---

## 🟢 #10 — Reemplazar `.toLocaleString()` por `CurrencyDisplay` (PENDIENTE)

Afecta ~15 ocurrencias en BudgetPanel, OnlineItemsTable, OnlineBudgetTotals, etc.

---

## 🟢 #11 — Migrar inline styles a CSS modules (PENDIENTE)

| Componente | Inline styles | Prioridad |
|---|---|---|
| `OnlineItemsTable.tsx` | ~60 | Alta |
| `BudgetPanel.tsx` | ~50 | Alta |
| `QuoteOptionsGrid.tsx` | ~30 | Media |
| `MaterialCard.tsx` | ~20 | Baja |
| `PoolCard.tsx` | ~12 | Baja |
| `Toolbar.tsx` | ~20 | Baja |
| `CashTotalCards.tsx` | ~10 | Baja |
