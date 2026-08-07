# E2E Coverage Matrix

> Source of truth de que areas de la app cubre la suite E2E.
> Mantener a mano cuando se agrega/modifica una feature.

## Auditoria rapida

```bash
# PowerShell - detectar src/pages/<area> sin espejo en e2e/<area>/
$pages = Get-ChildItem -Directory -Path 'src/pages'
$e2e   = Get-ChildItem -Directory -Path 'e2e' | Select-Object -ExpandProperty Name
foreach ($p in $pages) {
  if ($e2e -contains $p.Name) { Write-Host "OK  $($p.Name)" -ForegroundColor Green }
  else                        { Write-Host "FALTA  $($p.Name)" -ForegroundColor Red }
}
```

## Mapeo spec -> area

| Spec | Area (`src/pages/...`) | Que ejercita | Project |
|---|---|---|---|
| `smoke/00-smoke.spec.ts` | (global) | Login + dashboard renderiza | chromium |
| `auth/01-auth.spec.ts` | `auth/` | Login OK, error, redirect, logout | chromium |
| `clients/02-clients.spec.ts` | `clients/` | Alta, listado, edicion, baja | chromium |
| `clients/02b-clients-addresses.spec.ts` | `clients/` | CRUD de direcciones adicionales, FK | chromium |
| `budgets/03-budgets.spec.ts` | `budgets/` | Alta, edicion, aprobacion, PDF preview | chromium |
| `budgets/04-porcelain-calculator.spec.ts` | `budgets/`, `calculator/` | Calculadora embebida en presupuesto | chromium |
| `budgets/05-material-swap.spec.ts` | `budgets/` | Swap de material alternativo en presupuesto | chromium |
| `materials/05-materials.spec.ts` | `materials/` | CRUD de materiales | chromium |
| `materials/05b-categories.spec.ts` | `materials/` | CRUD de categorias | chromium |
| `pool-stock/06-pool-stock.spec.ts` | `pool-stock/` | Stock de piletas, movimientos | chromium |
| `additional-works/07-additional-works.spec.ts` | `additional-works/` | CRUD de trabajos adicionales | chromium |
| `measurements/08-measurements.spec.ts` | `measurements/` | Medicion + fotos + comparacion | chromium |
| `calculator/09-calculator.spec.ts` | `calculator/` | Calculo de porcelanato standalone | chromium |
| `cash/10-cash.spec.ts` | `cash/` | Caja diaria, ingresos/egresos | chromium |
| `reports/11-reports.spec.ts` | `reports/` | Reportes de ventas/materiales | chromium |
| `configuration/12-configuration.spec.ts` | `configuration/` | Settings, USD rate, terminos | chromium |
| `product-photos/13-product-photos.spec.ts` | `product-photos/` | Upload de fotos por material | chromium |
| `dashboard/14-dashboard-modales.spec.ts` | `dashboard/` | Cards del dashboard abren modales | chromium |
| `edge-cases/15-edge-cases.spec.ts` | (transversal) | Validaciones, errores, FK orphans | chromium |
| `work-orders/04-work-orders.spec.ts` | `work-orders/` | Alta desde presupuesto, status changes | chromium |

## Sectores clave capturados por spec

Convencion: `testInfo.attach('shot-<area>-<sector>', { body: page.screenshot(...) })` solo en tests que pasan. El reporter agrupa por `<area>` y muestra `<sector>` como sub-grupo. Sectores reservados que se priorizan arriba: `shot-post-login`, `shot-dashboard`.

Sectores por area (ver `e2e/reporters/test-report.ts` parseShotName):
- `budgets`: `list`, `form-empty`, `form-filled`, `pdf-preview`, `error`
- `clients`: `list`, `form-empty`, `form-filled`, `address-picker`
- `dashboard`: `cards`, `modal-<card>`, `drill-down`
- `materials`: `list`, `form-empty`, `form-filled`, `categories`
- cross-feature: `shot-cross-<flujo>` (ej: `shot-cross-budget-to-work-order`)

## Areas sin cobertura

- `src/pages/home/` — no tiene spec dedicado. Se cubre parcialmente via `00-smoke` (renderiza post-login).
- `src/pages/porcelain-tile-calculator/` — submodulo cubierto via `budgets/04-porcelain-calculator` (no requiere spec propio).

## Pendiente

- `src/pages/configuration/` — falta ejercitar el editor `terms` (solo aparece en work orders).