# Refactor Plan — Frontend Component Consolidation

> Basado en el análisis exhaustivo de duplicación de código en `afamar-frontend/src/` (Julio 2026).
> **Última actualización:** Julio 2026 — Dirección alternativa + cleanup.

## Estado general

**TODO COMPLETADO.** No quedan items pendientes de refactor.

Todas las sesiones anteriores (Ola 1–4, Frente/Regrueso, rename English, BEM, TanStack Query, useEntityForm refactor, inline styles → CSS modules, FinancialBase, CSS fusion, @ts-nocheck cleanup, CurrencyDisplay, directory restructuring, dead code cleanup, constants refactor, CashMovementTable, M2_CONCEPTS, shared code extraction, E2E tests, dark/light theme, PDF al frontend, ClientInfoCard, snapshot columns drop, client typeahead, material photo, client delete 409, prespupuestos stats, ClientFormPage layout, MaterialCard/PoolCard theming, sketch rename, alert→useNotify, PendingMeasurementCards, label fixes, misc renames, work_order create_from_budget fix, frente pricing, additional works en PDF) están completadas.

---

## Items pendientes (futuras sesiones)

Ninguno de refactor. Possibles mejoras futuras (no blocker):

- **`surcharge_result` dead var** en `work_order.py` — variable computada pero sin uso en `create_from_budget`. Lógica muerta, removable.
- **CRLF normalization** — 76 archivos con warnings CRLF en `git status`. Normalizar a LF antes de commit.
- **`useSketchState` export** — el filename es `useSketchState.ts` pero el export sigue siendo `useCroquisState`. Renombrar el export + actualizar consumers.
- **OT corrupta en DB** — `model_validate` falla en una OT existente. El try/except la skipea, pero hay que limpiar el dato.
- **Inline styles restantes** — ~100 ocurrencias de layout-only (width, padding, gap, margin). No afectan theme.

---

## Schema legacy

- **`online_budgets`** — tabla dropeada via migración `11e4cc1657da`. Sin código activo.

---

## Migraciones Alembic aplicadas

| Revision | Descripción |
|---|---|
| `33eba7752f2d` | Rename `adicionales` → `additional_works` |
| `38a349770781` | Tabla `pool_types` + FK en `pool_stock` |
| `b1d663f9c2bd` | `sort_order`/`is_active` en pool (luego droppeadas) |
| `b1c2d3e4f5a6` | Conceptos de fabricación español → inglés |
| `c1d2e3f4a5b6` | `price_history` columns → English |
| `d1e2f3a4b5c6` | Drop tablas/campos Spanish legacy |
| `e4f5a6b7c8d0` | Drop `is_active` de adicionales |
| `f5a6b7c8d9e1` | Drop `sort_order` de adicionales |
| `a6b7c8d9e1f2` | `additional_works_data` TEXT en budgets |
| `d3e4f5a6b7c9` | Tabla `adicionales` |
| `c2d3e4f5a6b8` | Tabla `currencies` + FK |
| `a1c2b3d4e5f7` | `client_addresses` |
| `248a1a9b051b` | `materials.photo` column |
| `f2f33071224f` | Drop `snapshot_*` columns |
| `20878d9185cb` | `client_id` FK en measurements |
| `11e4cc1657da` | Drop `online_budgets` |
| `ad4d5e6f7g8a` | Frente/regrueso support (`type`, `formula_constant`) |
| `15a75ef09120` | Term overrides en budgets/WO |
