# Refactor Plan — Frontend Audit 2026

> **Última actualización:** Julio 2026 — Fase 1.1–1.4, 2.1–2.4, 3.1–3.3, 4.2–4.4, 5.1–5.9 completadas.

---

## Ronda 2 — Auditoría profunda

### Fase 5.1 — TypeScript strict: `noImplicitAny`

- ✅ `noImplicitAny: true` en tsconfig.json
- ✅ 21 errores corregidos (5 archivos: completedWorks stubs, WorkOrderFormSnapshot return type, test object literals)
- `strictNullChecks`, `noImplicitThis`, etc. van en fases futuras

### Fase 5.2 — Dependencias muertas

- ✅ `html2canvas`, `jspdf`, `@types/jspdf`, `react-beautiful-dnd` eliminados (25 packages, cero imports en src/)

### Fase 5.3 — ConfirmDialog accessibility

- ✅ `role="dialog"` + `aria-modal="true"` + `aria-labelledby` en ConfirmDialog
- ✅ `useFocusTrap` hook creado — focus trapping en Modal y ConfirmDialog
- ✅ Escape key handler en ConfirmDialog

### Fase 5.4 — React.memo en componentes de lista

- ✅ WorkOrdersTable, AdditionalWorksTable, MeasurementsTable, MaterialCard, PoolCard wrapped in React.memo

### Fase 5.5 — Lazy-load de componentes pesados

- ✅ PdfPreviewModal + SketchImageExtractor → React.lazy() en 4 pages
- SketchImageExtractor chunk: 1,804 KB → 1.97 KB (PDF library loaded on demand)

### Fase 5.6 — Dedup BudgetForm/WorkOrderForm

- ✅ `useConfirmPayment` hook extraído (lógica tarjeta→depósito eliminada de useBudgetActions + WorkOrderFormPage)
- ✅ `createAddressAddedHandler` utility extraído (handler idéntico en ambas pages)

### Fase 5.7 — ConfigurationPage → TanStack Query

- ✅ `useGet(['settings'])` reemplaza raw `useEffect` + `axios.get` — comparte cache con `useSettingsWithTerms`
- ✅ `console.error` eliminado de ConfigurationPage

### Fase 5.8 — Limpieza menor

- ✅ 2 `console.error` eliminados (usePdfPreview, useFormReferences)
- ✅ 4 `.catch` vacíos revisados — todos son fallbacks intencionales, se mantienen

### Fase 5.9 — Vitest: jsdom environment

- ✅ `environment: 'jsdom'` en vitest.config.ts
- ✅ `@testing-library/react` + `@testing-library/jest-dom` instalados
- ✅ StatusBadge.test.tsx reescrito con 2 tests reales (antes era stub vacío)

---

## Fases anteriores (completadas)

### Fase 4.1 — Inline styles → CSS modules

- CashDailyPage: ✅ `.cash__page-header-title`, `.cash__date-input`, `.cash__controls-btn`, `.cash__icon-inline`, `.cash__movements-grid`, `.cash__badge`, `.cash__print-footer-block`
- CashHistoryPage: ✅ `.cash-history__icon-inline`
- NO action — la mayoría son anchos de columna dinámicos, background images, o valores calculados que NO pueden pasarse a CSS

### Fase 3.4 — Context optimization

- `useSettings`: **no necesario** — TanStack Query ya cachea

---

## Completado

| Fase | Item |
|---|---|
| 1.1 | 13 splits de pages/components |
| 1.2 | StatusBadge (STATUS_META), PdfPreviewModal (no action needed) |
| 1.3 | buildPdfData.ts (4 archivos), entityFormHelpers.ts (4 archivos) |
| 1.4 | React.lazy() en App.tsx |
| 2.1 | EntityFormFinancial, EntityFormSpecs, EntityFormClient fusionados |
| 2.2 | useAdditionalWorkSelection (334→241L) + additionalWorkCalc.ts |
| 2.3 | round2 → utils/math.ts |
| 2.4 | STATUS_META, PAYMENT_METHODS, M2_CONCEPTS centralizados |
| 3.1 | AuthContext useMemo, StatusBadge React.memo |
| 3.2 | BudgetPanelContext (18 props → 3 grupos) + 10 archivos muertos eliminados |
| 3.3 | EntityFormState materials_data/pools_data tipados |
| 4.2 | .modal-overlay, .modal, @keyframes spin eliminados de index.css |
| 4.3 | aria-expanded Sidebar, aria-live notifications, role="dialog" Modal |
| 4.4 | STATUS_META lookup + t() para labels |
