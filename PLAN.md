# Refactor Plan — Frontend Audit 2026

> **Última actualización:** Julio 2026 — Fase 1.1–1.4, 2.1–2.2, 3.1–3.3, 3.2, 4.2–4.4 completadas.

---

## Fase 4.1 — Inline styles → CSS modules

- CashDailyPage: ✅ `.cash__page-header-title`, `.cash__date-input`, `.cash__controls-btn`, `.cash__icon-inline`, `.cash__movements-grid`, `.cash__badge`, `.cash__print-footer-block`
- CashHistoryPage: ✅ `.cash-history__icon-inline`
- CalculatorPage, BudgetTable, ClientsListPage, etc.: ❌ NO action — la mayoría son anchos de columna dinámicos, background images, o valores calculados que NO pueden pasarse a CSS
- NO tocar: Konva canvas `<Stage>`, valores dinámicos

---

## Fase 3.4 — Context optimization

- `useSettings`: **no necesario** — TanStack Query ya cachea y múltiples páginas comparten el fetch

---

## Orden recomendado

```
4.1: Inline styles (baja prioridad — mucho churn, poco impacto)
3.4: Omitido (useSettings ya cacheado)
```

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
