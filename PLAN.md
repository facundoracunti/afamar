# AFAMAR — Plan de Refactor Integral

> Documento vivo. Define la estructura destino, convenciones y fases de migración
> para convertir el proyecto actual en una base **prolija, escalable y consistente**:
> nombres en **inglés**, **separación de responsabilidades** estricta y
> **CSS BEM + CSS Modules** en el frontend.
>
> **Proyecto de referencia:** `D:\projects\PERSONAL\afamar-project` — versión
> madura del mismo dominio, con la arquitectura final ya implementada y validada.
> Se reutilizan configs, patrones y archivos completos.

---

## 1. Objetivos

| # | Objetivo | Métrica de éxito |
|---|----------|------------------|
| 1 | Nombres en inglés consistentes (backend y frontend) | 0 archivos/carpetas en español en `afamar-backend/app/**` y `afamar-frontend/src/**` |
| 2 | Separación de responsabilidades por capas | Routers ≤ 5 líneas de lógica · Services no acceden a FastAPI · Repositories sólo SQLAlchemy |
| 3 | CSS con BEM + CSS Modules | 1 `*.module.css` co-localizado por componente/página · 0 `style={...}` inline con propiedades reales |
| 4 | Path aliases | `@/`, `@features/`, `@shared/`, `@assets/` funcionando en TS y Vite |
| 5 | Tipado estricto end-to-end | 0 `any` · `tsc --noEmit` 0 errores |
| 6 | Build verde | `npm run build` 0 errores · `uvicorn app.main:app` arranca sin warnings |
| 7 | Tests básicos | `pytest` pasa con suite mínima (auth + smoke) |
| 8 | Auth unificada | `Depends(get_current_user)` en routers admin; login funcional |

---

## 2. Convenciones de Naming (Español → Inglés)

### 2.1 Entidades de dominio (alineadas con `afamar-project`)

| Español actual | Inglés destino | Notas |
|----------------|----------------|-------|
| `Cliente` | `Client` | |
| `Presupuesto` | `Budget` | "Budget" en lugar de "Quote" (alineado con referencia) |
| `PresupuestoItem` | `BudgetItem` | |
| `PresupuestoAdicional` | `BudgetAdicional` | |
| `PresupuestoOnline` | `OnlineBudget` | |
| `OrdenTrabajo` | `WorkOrder` | |
| `Material` | `Material` | sin cambios |
| `StockPileta` | `PoolStock` | "Pileta" = pileta/lavamanos → "Pool" en argot marmolero |
| `MovimientoPileta` | `StockMovement` | genérico |
| `Medicion` | `Measurement` | |
| `CajaDiaria` | `DailyCash` | |
| `MovimientoCaja` | `CashMovement` | |
| `Configuracion` | `Setting` | app config key-value |
| `PriceHistory` | `PriceHistory` | sin cambios |
| `TrabajoRealizado` | (no migra — fuera de scope) | — |
| `User` | `User` | sin cambios |
| `Croquis` (UI) | `Sketch` | croquis del mármol |
| `Firma` (canvas) | `Signature` | |
| `Material` extras | `MaterialCategory` · `MaterialColor` · `MaterialThickness` | tablas de referencia nuevas |

### 2.2 Endpoints REST (paths)

| Antes (Spanish) | Después (English) |
|-----------------|-------------------|
| `/api/clientes` | `/api/v1/clients` |
| `/api/presupuestos` | `/api/v1/budgets` |
| `/api/presupuestos-online` | `/api/v1/online-budgets` |
| `/api/ordenes-trabajo` | `/api/v1/work-orders` |
| `/api/materiales` | `/api/v1/materials` |
| `/api/stock-piletas` | `/api/v1/pool-stock` |
| `/api/mediciones` | `/api/v1/measurements` |
| `/api/caja` | `/api/v1/cash` |
| `/api/configuracion` | `/api/v1/settings` |
| `/api/trabajos-realizados` | (no migra) | — |
| `/api/reportes` | `/api/v1/reports` |
| `/api/auth` | `/api/v1/auth` | sin cambios |
| (nuevo) | `/api/v1/references/{resource}` | estados, prioridades, formas de pago |
| (nuevo) | `/api/v1/search` | búsqueda global |
| (nuevo) | `/api/v1/options` | app options |
| (nuevo) | `/api/v1/product-photos` | galería |
| `/api/health` | `/health` (sin prefijo) | root-level |

> **Decisión:** se adopta el prefijo `/api/v1/` para versionado, alineado con
> la referencia. Health endpoints quedan en root para k8s/docker healthchecks.

### 2.3 Frontend routes (con `new` en lugar de `nuevo`)

| Antes | Después |
|-------|---------|
| `/admin/clientes` | `/admin/clients` |
| `/admin/presupuestos` | `/admin/budgets` |
| `/admin/presupuestos-online` | `/admin/online-budgets` |
| `/admin/ordenes` | `/admin/work-orders` |
| `/admin/ordenes/nuevo` | `/admin/work-orders/new` |
| `/admin/ordenes/:id` | `/admin/work-orders/:id/edit` |
| `/admin/materiales` | `/admin/materials` |
| `/admin/stock-piletas` | `/admin/pool-stock` |
| `/admin/mediciones` | `/admin/measurements` |
| `/admin/caja/diaria` | `/admin/cash` |
| `/admin/caja/historial` | `/admin/cash/history` |
| `/admin/configuracion` | `/admin/settings` |
| `/admin/reportes` | `/admin/reports` |
| (nuevo) | `/admin/product-photos` |

### 2.4 Estados y enums (alineados con referencia)

| Antes (Spanish) | Después (English, en DB) |
|----------------|--------------------------|
| `PENDIENTE` | `PENDING` |
| `ENVIADO` | (eliminar — implícito por `status_id`) |
| `APROBADO` | `APPROVED` |
| `RECHAZADO` | `REJECTED` |
| `CONVERTIDO A OT` | `CONVERTED_TO_OT` |
| `MEDICION` | `MEASUREMENT` |
| `TALLER` | `WORKSHOP` |
| `TERMINADA` | `FINISHED` |
| `ENTREGADA` | `DELIVERED` |
| `CANCELADO` | `CANCELLED` |
| `BAJA` | `LOW` |
| `NORMAL` | `NORMAL` |
| `ALTA` | `HIGH` |
| `URGENTE` | `URGENT` |
| `EFECTIVO` | `CASH` |
| `TRANSFERENCIA` | `TRANSFER` |
| `TARJETA DE CRÉDITO` | `CREDIT_CARD` |
| `TARJETA DE DÉBITO` | `DEBIT_CARD` |
| `CHEQUE` | `CHECK` |
| `MIXTO` | `MIXED` |
| `INGRESO` | `INCOME` |
| `EGRESO` | `EXPENSE` |
| `REALIZADA` (medición) | `DONE` |

> **Patrón i18n:** la DB almacena valores en inglés. El frontend los muestra
> en español vía `t(key)` de `utils/translate.ts`. Las tablas de referencia
> (`budget_statuses`, `work_order_statuses`, `payment_methods`, etc.)
> almacenan `name` (inglés, clave única) y `label` (display en español).

### 2.5 Variables y funciones

| Antes (Spanish) | Después (English) |
|-----------------|-------------------|
| `obtenerPresupuesto` | `getBudget` |
| `crearPresupuesto` | `createBudget` |
| `convertirPresupuestoAOrden` | `convertBudgetToWorkOrder` |
| `numeroPresupuesto` | `budgetNumber` |
| `clienteId` | `clientId` |
| `dolarDelDia` | `usdRate` |
| `senaRecibida` | `depositReceived` |
| `saldoPendiente` | `balanceDue` |
| `saldoPagado` | `balancePaid` |
| `fechaEntrega` | `deliveryDate` |
| `listaClientes` | `clientList` / `clients` |
| `stockPiletaId` | `poolStockId` |
| `cantidad` | `quantity` |
| `categoria` | `category` |

---

## 3. Convenciones CSS (BEM + CSS Modules)

### 3.1 Reglas BEM (alineadas con la referencia)

```
.block                          → bloque independiente (PascalCase-friendly)
.block__element                 → elemento del bloque
.block--modifier                → variante del bloque
.block__element--modifier       → variante del elemento
```

**Reglas duras (heredadas de la referencia):**
- **Nunca** anidar más allá de `__element` (no `__element__subelement`).
- **Nunca** selectores de etiqueta, IDs, ni universales (`*`).
- **Nunca** selectores globales en `index.css` salvo `:root` y `body`.
- Modificadores representan **estados/variantes**, no propiedades nuevas.

### 3.2 Co-localización de estilos (pattern de la referencia)

```
components/ui/Button/
  ├── Button.tsx
  └── Button.module.css

pages/Budgets/
  ├── Budgets.tsx
  ├── Budgets.module.css
  ├── BudgetForm.tsx
  ├── BudgetForm.module.css
  ├── BudgetFormClient.tsx
  ├── BudgetFormItems.tsx
  └── ...
```

> La referencia **no usa index.ts** (sin barrel exports) — los imports van
> directos: `import { Button } from "@/components/ui/Button/Button"`.

### 3.3 Variables globales (`src/index.css`)

Consolidar en un solo `index.css` con reset + tokens. La referencia lo hace así:

```css
/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Design tokens */
:root {
  --color-primary: #1a1a2e;
  --color-danger: #dc2626;
  --color-success: #27ae60;
  --color-text: #333;
  --color-border: #ccc;
  --color-bg: #f5f5f5;
  /* ...radii, shadows, spacing... */
}

body { font-family: "Inter", system-ui, ...; }
a { color: inherit; }
table { border-spacing: 0; }
```

> **Decisión:** se conserva la paleta del proyecto actual (rojo `#b91c1c`)
> pero se reorganiza como design tokens.

### 3.4 Convención de nombres de clase

```css
/* Budgets.module.css */
.budgets {
  display: grid;
  gap: 1rem;
}

.budgets__header {
  display: flex;
  justify-content: space-between;
}

.budgets__title {
  font-size: 1.5rem;
  font-weight: 700;
}

.budgets__actions {
  display: flex;
  gap: 0.5rem;
}

.budgets--empty {
  opacity: 0.6;
}

.budgets__row--highlighted {
  background: var(--color-warning-bg);
}
```

```tsx
// Budgets.tsx
import styles from "./Budgets.module.css";

<div className={styles.budgets}>
  <header className={styles["budgets__header"]}>
    <h1 className={styles.budgets__title}>Presupuestos</h1>
  </header>
</div>
```

### 3.5 StatusBadge con modificador BEM (pattern de la referencia)

```css
/* StatusBadge.module.css */
.badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge--PENDING { background: #fef3c7; color: #92400e; }
.badge--APPROVED { background: #d1fae5; color: #065f46; }
.badge--REJECTED { background: #fee2e2; color: #991b1b; }
.badge--CONVERTED_TO_OT { background: #ede9fe; color: #5b21b6; }
.badge--MEASUREMENT { background: #fef3c7; color: #92400e; }
.badge--WORKSHOP { background: #dbeafe; color: #1e40af; }
.badge--FINISHED { background: #d1fae5; color: #065f46; }
.badge--DELIVERED { background: #cffafe; color: #155e75; }
```

```tsx
// StatusBadge.tsx
import { t } from "@/utils/translate";
import styles from "./StatusBadge.module.css";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.badge} ${styles[`badge--${status}`] || ""}`}>
      {t(status)}
    </span>
  );
}
```

---

## 4. Arquitectura Backend — Capas y Responsabilidades

### 4.1 Estructura destino (alineada con `afamar-project/afamar-backend`)

```
afamar-backend/
├── alembic/
│   ├── versions/
│   ├── env.py
│   └── script.py.mako
│
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI app + lifespan + middleware
│   │
│   ├── api/                             # Capa HTTP
│   │   ├── __init__.py
│   │   ├── dependencies.py              # get_db, get_current_user
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── router.py                # agrega /api/v1 + include_router
│   │       ├── auth.py
│   │       ├── clients.py
│   │       ├── budgets.py
│   │       ├── online_budgets.py
│   │       ├── work_orders.py
│   │       ├── materials.py
│   │       ├── pool_stock.py
│   │       ├── measurements.py
│   │       ├── daily_cash.py
│   │       ├── settings.py
│   │       ├── reports.py
│   │       ├── search.py
│   │       ├── options.py
│   │       ├── references.py
│   │       └── product_photos.py
│   │
│   ├── core/                            # Cross-cutting
│   │   ├── __init__.py
│   │   ├── settings.py                  # pydantic Settings
│   │   └── exceptions.py                # NotFoundError, ConflictError, ValidationError (HTTPException subclasses)
│   │
│   ├── db/                              # DB infra
│   │   ├── __init__.py
│   │   ├── base.py                      # DeclarativeBase
│   │   ├── session.py                   # engine, SessionLocal
│   │   └── database.py                  # get_db, dispose_db
│   │
│   ├── models/                          # SQLAlchemy ORM (1 archivo por entidad)
│   │   ├── __init__.py                  # re-exports
│   │   ├── client.py
│   │   ├── budget.py                    # Budget + BudgetItem + BudgetAdicional + BudgetSketchElement
│   │   ├── online_budget.py
│   │   ├── work_order.py
│   │   ├── material.py                  # Material + MaterialCategory + MaterialColor + MaterialThickness
│   │   ├── options.py                   # AppOption
│   │   ├── pool_stock.py                # PoolStock + StockMovement
│   │   ├── setting.py
│   │   ├── measurement.py
│   │   ├── daily_cash.py                # DailyCash + CashMovement
│   │   ├── price_history.py
│   │   ├── product_photo.py
│   │   ├── reference.py                 # BudgetStatus, WorkOrderStatus, PaymentMethod, PriorityLevel, FinishType
│   │   └── user.py
│   │
│   ├── schemas/                         # Pydantic
│   │   ├── __init__.py
│   │   ├── base.py                      # BaseResponse (id, created_at, updated_at)
│   │   ├── auth.py
│   │   ├── client.py
│   │   ├── budget.py
│   │   ├── online_budget.py
│   │   ├── work_order.py
│   │   ├── material.py
│   │   ├── pool_stock.py
│   │   ├── measurement.py
│   │   ├── daily_cash.py
│   │   ├── setting.py
│   │   ├── reference.py
│   │   └── product_photo.py
│   │
│   ├── repositories/                    # SQLAlchemy puro
│   │   ├── __init__.py
│   │   ├── base.py                      # BaseRepository con add/save/delete/get_*
│   │   ├── client.py
│   │   ├── budget.py
│   │   ├── online_budget.py
│   │   ├── work_order.py
│   │   ├── material.py
│   │   ├── pool_stock.py
│   │   ├── measurement.py
│   │   ├── daily_cash.py
│   │   ├── setting.py
│   │   ├── reference.py
│   │   └── product_photo.py
│   │
│   ├── services/                        # Lógica de negocio
│   │   ├── __init__.py
│   │   ├── base.py                      # BaseService genérico
│   │   ├── auth.py                      # password hash, JWT, get_user_by_id
│   │   ├── client.py
│   │   ├── budget.py
│   │   ├── budget_calculator.py         # helpers extraídos
│   │   ├── online_budget.py
│   │   ├── work_order.py
│   │   ├── material.py
│   │   ├── pool_stock.py
│   │   ├── measurement.py
│   │   ├── daily_cash.py
│   │   ├── setting.py
│   │   ├── report.py
│   │   ├── whatsapp.py
│   │   ├── email.py
│   │   ├── product_photo.py
│   │   ├── pdf.py                       # legacy (reportlab)
│   │   └── pdf_html.py                  # primary (xhtml2pdf + jinja2)
│   │
│   ├── utils/                           # Helpers puros
│   │   ├── __init__.py
│   │   ├── logger.py                    # setup_logging + check_database
│   │   ├── responses.py                 # success() / created() / error() envelope
│   │   ├── pagination.py                # paginate(query) → Page
│   │   └── numbering.py                 # generate_budget_number / generate_work_order_number
│   │
│   └── templates/                       # Jinja2 (PDFs)
│       ├── budget_pdf.html
│       └── work_order_pdf.html
│
├── tests/                              # pytest
│   ├── __init__.py
│   ├── conftest.py                      # fixtures: client, public_client, setup_db, seed_db
│   ├── test_auth.py
│   └── test_api.py
│
├── scripts/
│   └── seed.py                          # datos iniciales
│
├── uploads/                             # .gitkeep + carpetas
│   ├── .gitkeep
│   ├── logos/
│   ├── materials/
│   └── product_photos/
│
├── .env
├── .env.example
├── .gitignore
├── requirements.txt
├── alembic.ini
├── pytest.ini
├── pyproject.toml                       # ruff config
├── Dockerfile
├── README.md
└── afamar.db                            # SQLite (gitignored)
```

### 4.2 Estructura destino frontend (alineada con la referencia)

```
afamar-frontend/
├── public/
│   ├── config.js                        # generado en runtime (gitignored)
│   ├── config.template.js               # template con $API_URL
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── main.tsx                         # entry point
│   ├── App.tsx                          # BrowserRouter + lazy routes
│   ├── index.css                        # reset + design tokens
│   ├── vite-env.d.ts
│   │
│   ├── api/                             # Capa de red
│   │   ├── http.ts                      # Axios instance + interceptors
│   │   ├── client.ts                    # api = re-export from resources/index
│   │   ├── wrap.ts                      # wrap helper
│   │   └── resources/
│   │       ├── index.ts                 # api aggregator (barrel único aquí)
│   │       ├── clients.ts
│   │       ├── budgets.ts
│   │       ├── onlineBudgets.ts
│   │       ├── workOrders.ts
│   │       ├── materials.ts
│   │       ├── poolStock.ts
│   │       ├── measurements.ts
│   │       ├── cash.ts
│   │       ├── settings.ts
│   │       ├── reports.ts
│   │       ├── search.ts
│   │       ├── references.ts
│   │       ├── productPhotos.ts
│   │       └── options.ts
│   │
│   ├── types/                           # Interfaces compartidas
│   │   └── index.ts                     # Client, Budget, WorkOrder, Material, etc.
│   │
│   ├── constants/
│   │   └── index.ts                     # CURRENCIES, MOVEMENT_TYPES, STATUS_COLORS
│   │
│   ├── utils/
│   │   ├── index.ts
│   │   ├── translate.ts                 # t() — English key → Spanish label
│   │   ├── formatCurrency.ts            # formatARS, formatUSD, formatBalance, formatDate
│   │   ├── calcM2.ts                    # cálculos de m²
│   │   ├── downloadPdf.ts               # helper para abrir PDFs
│   │   └── whatsapp.ts                  # link builder
│   │
│   ├── hooks/                           # Cross-cutting hooks
│   │   ├── useDebounce.ts
│   │   ├── useApiList.ts                # legacy (mantener por compatibilidad)
│   │   └── useApiForm.ts                # legacy
│   │
│   ├── shared/                          # Código reusable sin dominio
│   │   ├── api/
│   │   │   ├── queryClient.ts           # QueryClient config
│   │   │   └── hooks.ts                 # useList, useGet, useCreate, useUpdate, useDelete
│   │   ├── context/
│   │   │   └── index.ts                 # re-exports
│   │   └── styles/                      # (vacío por ahora, placeholders)
│   │
│   ├── context/                         # React Context cross-cutting
│   │   ├── AuthContext.tsx
│   │   ├── NotificationContext.tsx
│   │   └── ReferencesContext.tsx        # carga statuses, priorities, payment methods
│   │
│   ├── app/                             # Composition root
│   │   └── providers.tsx                # QueryClient + Auth + Notification + References
│   │
│   ├── components/                      # Componentes reutilizables
│   │   ├── ErrorBoundary/
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ErrorBoundary.module.css
│   │   ├── Layout/
│   │   │   ├── Layout.tsx
│   │   │   └── Layout.module.css
│   │   ├── ProtectedRoute/
│   │   │   └── ProtectedRoute.tsx
│   │   └── ui/                          # Primitivas genéricas
│   │       ├── Button/
│   │       │   ├── Button.tsx
│   │       │   └── Button.module.css
│   │       ├── Modal/
│   │       ├── ConfirmDialog/
│   │       ├── StatusBadge/
│   │       │   ├── StatusBadge.tsx
│   │       │   └── StatusBadge.module.css
│   │       ├── ListPage/
│   │       ├── PageHeader/
│   │       ├── TableActions/
│   │       ├── FormActions/
│   │       ├── ErrorBlock/
│   │       ├── LoadingSpinner/
│   │       ├── EmptyState/
│   │       ├── Container/
│   │       ├── SearchInput/
│   │       ├── PieChart/
│   │       ├── ChartBar/
│   │       ├── useConfirm.ts
│   │       └── CurrencyDisplay/
│   │
│   ├── pages/                           # Componentes de ruta (1 carpeta por dominio)
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   └── Dashboard.module.css
│   │   ├── Login/
│   │   │   ├── Login.tsx
│   │   │   └── Login.module.css
│   │   ├── Public/
│   │   │   ├── Public.tsx
│   │   │   └── Public.module.css
│   │   ├── Budgets/
│   │   │   ├── Budgets.tsx
│   │   │   ├── Budgets.module.css
│   │   │   ├── BudgetForm.tsx           # orchestrator
│   │   │   ├── BudgetForm.module.css
│   │   │   ├── BudgetFormClient.tsx
│   │   │   ├── BudgetFormSpecs.tsx
│   │   │   ├── BudgetFormItems.tsx
│   │   │   ├── BudgetFormAdicionales.tsx
│   │   │   ├── BudgetFormFinancial.tsx
│   │   │   └── BudgetFormObservations.tsx
│   │   ├── WorkOrders/
│   │   │   ├── WorkOrders.tsx
│   │   │   ├── WorkOrders.module.css
│   │   │   ├── WorkOrderForm.tsx        # orchestrator
│   │   │   ├── WorkOrderForm.module.css
│   │   │   ├── WoFormBasic.tsx
│   │   │   ├── WoFormSpecs.tsx
│   │   │   ├── WoFormItemsGrid.tsx
│   │   │   ├── WoFormObservations.tsx
│   │   │   ├── WoFormFinancial.tsx
│   │   │   └── WoFormSnapshot.tsx
│   │   ├── Clients/
│   │   ├── Materials/
│   │   ├── MaterialConsultant/
│   │   ├── PoolStock/
│   │   ├── Measurements/
│   │   ├── OnlineBudgets/
│   │   │   ├── OnlineBudgets.tsx
│   │   │   ├── OnlineBudgetForm.tsx
│   │   │   ├── ObFormHeader.tsx
│   │   │   └── ObFormTotals.tsx
│   │   ├── Calculator/
│   │   ├── DailyCash/
│   │   │   ├── DailyCashPage.tsx
│   │   │   ├── CashHistory.tsx
│   │   │   ├── CashIncomeFormModal.tsx
│   │   │   └── CashExpenseFormModal.tsx
│   │   ├── ProductPhotos/
│   │   ├── Reports/
│   │   └── Settings/
│   │
│   ├── test/                            # Vitest setup
│   │   └── setup.ts
│   │
│   └── assets/                          # Imágenes, fonts, SVGs
│       └── (vacío por ahora)
│
├── .env
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── nginx.conf
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── Dockerfile
└── README.md
```

### 4.3 Reglas de capas

| Capa | Puede importar | NO puede |
|------|----------------|----------|
| **Routers** | schemas, services, api.dependencies, models (para tipos) | repositories, db.session |
| **Services** | models, schemas, repositories, core.exceptions, utils, otros services | FastAPI, Request, Response, HTTPException |
| **Repositories** | models, db.session | schemas, services, FastAPI |
| **Models** | sqlalchemy, db.base | schemas, services, repositories |
| **Schemas** | pydantic, schemas.base | models, services, repositories |
| **Utils** | stdlib, third-party (sin DB) | models, schemas, services |
| **Pages (frontend)** | components, hooks, services, types, utils, layouts | otros pages |
| **Components** | types básicos, utils, otros ui/ components | services, hooks de features |
| **Services (frontend)** | httpClient, types | components, hooks de UI, React |
| **Hooks** | types, utils, services | components, pages |
| **Types** | nada | services, components, hooks |
| **Utils** | nada | types, services, components, hooks |

---

## 5. Path Aliases

### 5.1 Frontend

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@features/*": ["src/features/*"],
      "@shared/*": ["src/shared/*"],
      "@assets/*": ["src/assets/*"]
    }
  }
}
```

**`vite.config.ts`:**
```ts
import path from 'path';
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@features': path.resolve(__dirname, './src/features'),
    '@shared': path.resolve(__dirname, './src/shared'),
    '@assets': path.resolve(__dirname, './src/assets'),
  },
}
```

**`vitest.config.ts`:** mismo bloque de aliases.

### 5.2 Backend

No hay path aliases en Python — se usa el paquete `app.*` y se resuelve
vía `__init__.py` + `pyproject.toml` (`[tool.setuptools.packages]`).

---

## 6. Archivos de Configuración a Copiar del Proyecto de Referencia

> Todos los siguientes archivos se copian **tal cual** desde
> `D:\projects\PERSONAL\afamar-project\afamar-backend\` y `...\afamar-frontend\`,
> ajustando sólo el `name` en `package.json` y los secrets en `.env`.

### 6.1 Backend — copiar de `afamar-project\afamar-backend\`

| Archivo destino | Origen | Notas |
|-----------------|--------|-------|
| `requirements.txt` | `afamar-project\afamar-backend\requirements.txt` | idéntico |
| `alembic.ini` | `...afamar-backend\alembic.ini` | idéntico |
| `alembic/env.py` | `...afamar-backend\alembic\env.py` | idéntico |
| `alembic/script.py.mako` | `...afamar-backend\alembic\script.py.mako` | idéntico |
| `app/main.py` | `...afamar-backend\app\main.py` | adaptar middleware chain |
| `app/core/settings.py` | `...afamar-backend\app\core\settings.py` | idéntico |
| `app/core/exceptions.py` | `...afamar-backend\app\core\exceptions.py` | idéntico |
| `app/db/base.py` | `...afamar-backend\app\db\base.py` | idéntico |
| `app/db/session.py` | `...afamar-backend\app\db\session.py` | idéntico |
| `app/db/database.py` | `...afamar-backend\app\db\database.py` | idéntico |
| `app/api/dependencies.py` | `...afamar-backend\app\api\dependencies.py` | idéntico (incluye auth) |
| `app/api/routers/router.py` | `...afamar-backend\app\api\routers\router.py` | idéntico |
| `app/api/routers/auth.py` | `...afamar-backend\app\api\routers\auth.py` | idéntico |
| `app/utils/logger.py` | `...afamar-backend\app\utils\logger.py` | idéntico |
| `app/utils/responses.py` | `...afamar-backend\app\utils\responses.py` | idéntico |
| `app/utils/pagination.py` | `...afamar-backend\app\utils\pagination.py` | idéntico |
| `app/utils/numbering.py` | `...afamar-backend\app\utils\numbering.py` | idéntico |
| `app/repositories/base.py` | `...afamar-backend\app\repositories\base.py` | idéntico |
| `app/services/base.py` | `...afamar-backend\app\services\base.py` | idéntico |
| `app/services/auth.py` | `...afamar-backend\app\services\auth.py` | idéntico |
| `tests/conftest.py` | `...afamar-backend\tests\conftest.py` | idéntico (patrón SQLite file-based) |
| `Dockerfile` | `...afamar-backend\Dockerfile` | idéntico |
| `pyproject.toml` | (crear nuevo) | config ruff + pytest |
| `.env.example` | `...afamar-project\.env.example` | idéntico |
| `.gitignore` | (crear nuevo) | python + venv + db + uploads |

### 6.2 Frontend — copiar de `afamar-project\afamar-frontend\`

| Archivo destino | Origen | Notas |
|-----------------|--------|-------|
| `vite.config.ts` | `...afamar-frontend\vite.config.ts` | idéntico |
| `vitest.config.ts` | `...afamar-frontend\vitest.config.ts` | idéntico |
| `tsconfig.json` | `...afamar-frontend\tsconfig.json` | idéntico |
| `tsconfig.node.json` | `...afamar-frontend\tsconfig.node.json` | idéntico |
| `eslint.config.js` | `...afamar-frontend\eslint.config.js` | idéntico |
| `package.json` | `...afamar-frontend\package.json` | sólo ajustar `"name"` |
| `index.html` | `...afamar-frontend\index.html` | idéntico |
| `nginx.conf` | `...afamar-frontend\nginx.conf` | idéntico |
| `Dockerfile` | `...afamar-frontend\Dockerfile` | idéntico |
| `public/config.template.js` | `...afamar-frontend\public\config.template.js` | idéntico |
| `src/main.tsx` | `...afamar-frontend\src\main.tsx` | idéntico |
| `src/index.css` | `...afamar-frontend\src\index.css` | idéntico |
| `src/api/http.ts` | `...afamar-frontend\src\api\http.ts` | idéntico |
| `src/api/wrap.ts` | `...afamar-frontend\src\api\wrap.ts` | idéntico |
| `src/api/client.ts` | `...afamar-frontend\src\api\client.ts` | idéntico (re-export desde resources) |
| `src/api/resources/*.ts` | `...afamar-frontend\src\api\resources\*` | ajustar a las nuevas entidades |
| `src/types/index.ts` | `...afamar-frontend\src\types\index.ts` | ajustar a las nuevas entidades |
| `src/constants/index.ts` | `...afamar-frontend\src\constants\index.ts` | idéntico |
| `src/utils/translate.ts` | `...afamar-frontend\src\utils\translate.ts` | idéntico |
| `src/utils/formatCurrency.ts` | `...afamar-frontend\src\utils\formatCurrency.ts` | idéntico |
| `src/shared/api/queryClient.ts` | `...afamar-frontend\src\shared\api\queryClient.ts` | idéntico |
| `src/shared/api/hooks.ts` | `...afamar-frontend\src\shared\api\hooks.ts` | idéntico |
| `src/app/providers.tsx` | `...afamar-frontend\src\app\providers.tsx` | idéntico |
| `src/context/AuthContext.tsx` | `...afamar-frontend\src\context\AuthContext.tsx` | idéntico |
| `src/context/ReferencesContext.tsx` | `...afamar-frontend\src\context\ReferencesContext.tsx` | idéntico |
| `src/components/ErrorBoundary/*` | `...afamar-frontend\src\components\ErrorBoundary\*` | idéntico |
| `src/components/ProtectedRoute/*` | `...afamar-frontend\src\components\ProtectedRoute\*` | idéntico |
| `src/components/Layout/*` | `...afamar-frontend\src\components\Layout\*` | idéntico (sidebar con grupos) |
| `src/components/ui/*` | `...afamar-frontend\src\components\ui\*` | idénticos (Button, Modal, etc.) |
| `src/test/setup.ts` | `...afamar-frontend\src\test\setup.ts` | idéntico |

### 6.3 docker-compose.yml

Copiar `D:\projects\PERSONAL\afamar-project\docker-compose.yml` y ajustar:
- Renombrar `afamar-project` → `afamar` en `image`, `container_name`, `DB_NAME`.
- El `context` cambia de `./afamar-backend` → `./afamar-backend` (sin cambio).

### 6.4 README.md

Copiar y actualizar nombres de carpeta (`afamar-backend`, `afamar-frontend`).

---

## 7. Plan de Migración por Fases

> Cada fase es **deployable de forma independiente**. La app sigue funcionando
> mientras se completa una fase. Se recomienda trabajar en una rama
> `refactor/english-naming` desde `development`.

### Fase 0 — Setup inicial (~1 sesión)

**Objetivo:** crear la nueva estructura de carpetas y copiar configs.

- [ ] Renombrar `backend/` → `afamar-backend/`.
- [ ] Renombrar `frontend/` → `afamar-frontend/`.
- [ ] Copiar configs de backend desde `afamar-project\afamar-backend\`:
  `requirements.txt`, `alembic.ini`, `app/main.py`, `app/core/{settings,exceptions}.py`,
  `app/db/{base,session,database}.py`, `app/api/dependencies.py`, `app/utils/*`,
  `app/repositories/base.py`, `app/services/base.py`, `Dockerfile`, `pyproject.toml`,
  `.env.example`, `.gitignore`.
- [ ] Copiar configs de frontend desde `afamar-project\afamar-frontend\`:
  `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`,
  `eslint.config.js`, `package.json` (ajustar name), `index.html`, `nginx.conf`,
  `Dockerfile`, `public/config.template.js`, `src/main.tsx`, `src/index.css`,
  `src/api/{http,client,wrap}.ts`, `src/types/index.ts`, `src/constants/index.ts`,
  `src/utils/{translate,formatCurrency}.ts`, `src/shared/api/*`, `src/app/providers.tsx`,
  `src/context/{Auth,References}Context.tsx`, `src/components/{ErrorBoundary,ProtectedRoute,Layout,ui}/*`,
  `src/test/setup.ts`.
- [ ] Copiar `docker-compose.yml` desde `afamar-project\` ajustando nombres.
- [ ] `npm install` en frontend.
- [ ] `pip install -r requirements.txt` en backend.
- [ ] Verificar: backend levanta en `:8000`, frontend build verde.

**Verificación:** `npm run build` 0 errores, `uvicorn app.main:app` arranca.

### Fase 1 — Backend models → English (~1 sesión)

**Objetivo:** renombrar modelos, schemas y migrar a la estructura de la referencia.

- [ ] Renombrar archivos de `app/models/` (sufijo `_model` se omite, alineado con referencia):
  - `cliente.py` → `client.py`
  - `presupuesto.py` → `budget.py` (incluir `BudgetItem`, `BudgetAdicional`, `BudgetSketchElement`)
  - `presupuesto_online.py` → `online_budget.py`
  - `orden_trabajo.py` → `work_order.py`
  - `stock_pileta.py` → `pool_stock.py` (incluir `StockMovement`)
  - `medicion.py` → `measurement.py`
  - `caja.py` → `daily_cash.py` (incluir `DailyCash`, `CashMovement`)
  - `configuracion.py` → `setting.py`
  - `trabajo_realizado.py` → (descartar, fuera de scope)
  - `material.py` → mantener + agregar `MaterialCategory`, `MaterialColor`, `MaterialThickness`
  - `price_history.py` → mantener
  - `user.py` → mantener
  - (nuevo) `options.py` — `AppOption`
  - (nuevo) `reference.py` — `BudgetStatus`, `WorkOrderStatus`, `PaymentMethod`, `PriorityLevel`, `FinishType`
  - (nuevo) `product_photo.py` — `ProductPhoto`
- [ ] Renombrar clases según §2.1.
- [ ] Renombrar columnas y enum values según §2.4.
- [ ] Adaptar `app/models/__init__.py` con todos los exports.
- [ ] Crear migración Alembic de rename: `alembic revision --autogenerate -m "rename_to_english"`.
  - Si la DB existe con datos, crear SQL de update manual (ver §10).
- [ ] Adaptar `app/schemas/` con los nuevos nombres (estructura `Base/Create/Update/Response`).
- [ ] Adaptar `app/repositories/` con sufijo omitido (alineado con referencia).

**Verificación:** `python -c "from app.models import *"` 0 errores. Health
endpoint responde 200.

### Fase 2 — Backend services + routers (~2 sesiones)

- [ ] Renombrar services a `app/services/{client,budget,online_budget,work_order,...}.py`.
- [ ] Adaptar signatures para usar `repositories.X` (sin sufijo).
- [ ] Reescribir routers siguiendo patrón de la referencia:
  ```python
  router = APIRouter(dependencies=[Depends(get_current_user)])
  @router.get("")
  def list_x(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
      service = XService(db)
      query = service.repo.db.query(service.repo.model)
      page = paginate(db, query, skip, limit)
      return success(page.items, page.pagination)
  ```
- [ ] Implementar endpoints nuevos: `references`, `search`, `options`, `product-photos`.
- [ ] Wire-up en `app/api/routers/router.py` con prefijo `/api/v1`.
- [ ] Crear `app/main.py` final con lifespan + Alembic upgrade.

**Verificación:** `curl http://localhost:8000/api/v1/clients` retorna JSON
con campos en inglés.

### Fase 3 — Frontend types + services (~1 sesión)

- [ ] Renombrar archivos de `src/services/` y `src/types/` (sin sufijo).
- [ ] Adaptar types según §2.1.
- [ ] Implementar `src/api/resources/{clients,budgets,...}.ts` (uno por entidad).
- [ ] Agregar `src/api/resources/{references,search,options,productPhotos}.ts`.
- [ ] Implementar `src/api/resources/index.ts` agregador.
- [ ] `src/api/client.ts` = `export { api } from "./resources/index"`.
- [ ] Actualizar `http.ts` con `baseURL = window.APP_CONFIG?.API_URL || '/api/v1'`.

**Verificación:** `npm run build` 0 errores. Login funciona.

### Fase 4 — Frontend pages — BEM + path aliases (~3 sesiones)

- [ ] Por cada page actual (`pages/{clientes,ordenes,...}`):
  1. Renombrar carpeta a inglés (`clients`, `work-orders`, `budgets`, etc.).
  2. Renombrar componentes (`ClientesListPage` → `Clients.tsx`).
  3. Crear co-localizado `X.module.css` con clases BEM.
  4. Migrar `style={{...}}` inline a clases BEM (excepto CSS custom properties).
  5. Actualizar imports a path aliases.
- [ ] Layout: copiar `Layout.tsx` + `Layout.module.css` desde la referencia
  (con sidebar agrupado: General / Inventario / Operaciones / Administración).
- [ ] Componentes UI: copiar cada `Button/`, `Modal/`, `ListPage/`, etc. desde
  `src/components/ui/` de la referencia.
- [ ] App.tsx: `lazy()` por route + `Providers` wrapper.
- [ ] Actualizar todos los `navigate()` con prefijo `/admin/...` y paths en inglés.

**Verificación:** `npm run build` 0 errores. App funciona end-to-end.

### Fase 5 — Tests + tooling (~1 sesión)

- [ ] Backend: copiar `tests/conftest.py` de la referencia.
- [ ] Backend: crear `tests/test_auth.py` y `tests/test_api.py` mínimos.
- [ ] Frontend: copiar `src/test/setup.ts` de la referencia.
- [ ] Backend: agregar `pytest.ini` y `pyproject.toml` (ruff).
- [ ] Frontend: agregar `vitest.config.ts` (ya copiado en fase 0).
- [ ] Configurar husky + lint-staged (opcional).

**Verificación:** `pytest` pasa. `npm run lint` 0 errores.

### Fase 6 — Verificación final

- [ ] `npm run build` → 0 errores.
- [ ] `npm run dev` → login funciona, dashboard se ve.
- [ ] `uvicorn app.main:app` → arranca, todos los endpoints responden.
- [ ] Pruebas manuales end-to-end:
  - Crear cliente → aparece en lista.
  - Crear budget → convertir a WorkOrder → ver en órdenes.
  - Crear WorkOrder → cambiar estado MEASUREMENT → WORKSHOP → FINISHED → DELIVERED.
  - Crear Material/Color/Thickness/Category.
  - Subir logo en settings → ver en PDF.
  - Crear DailyCash → agregar INCOME/EXPENSE → cerrar.
- [ ] Eliminar `__pycache__/`, `dist/`, `build/`.
- [ ] Commit + PR.

---

## 8. Migration Mapping Completo (Spanish → English)

### 8.1 Backend models

| Antes | Después | Clases |
|-------|---------|--------|
| `app/models/cliente.py` | `app/models/client.py` | `Client` |
| `app/models/presupuesto.py` | `app/models/budget.py` | `Budget`, `BudgetItem`, `BudgetAdicional`, `BudgetSketchElement` |
| `app/models/presupuesto_online.py` | `app/models/online_budget.py` | `OnlineBudget` |
| `app/models/orden_trabajo.py` | `app/models/work_order.py` | `WorkOrder` |
| `app/models/material.py` | `app/models/material.py` (+ split) | `Material`, `MaterialCategory`, `MaterialColor`, `MaterialThickness` |
| `app/models/stock_pileta.py` | `app/models/pool_stock.py` | `PoolStock`, `StockMovement` |
| `app/models/medicion.py` | `app/models/measurement.py` | `Measurement` |
| `app/models/caja.py` | `app/models/daily_cash.py` | `DailyCash`, `CashMovement` |
| `app/models/configuracion.py` | `app/models/setting.py` | `Setting` |
| `app/models/trabajo_realizado.py` | (eliminar) | — |
| `app/models/price_history.py` | `app/models/price_history.py` | `PriceHistory` |
| `app/models/user.py` | `app/models/user.py` | `User` |
| (nuevo) | `app/models/options.py` | `AppOption` |
| (nuevo) | `app/models/reference.py` | `BudgetStatus`, `WorkOrderStatus`, `PaymentMethod`, `PriorityLevel`, `FinishType` |
| (nuevo) | `app/models/product_photo.py` | `ProductPhoto` |

### 8.2 Backend schemas

| Antes | Después |
|-------|---------|
| `app/schemas/cliente.py` | `app/schemas/client.py` |
| `app/schemas/presupuesto.py` | `app/schemas/budget.py` |
| `app/schemas/presupuesto_online.py` | `app/schemas/online_budget.py` |
| `app/schemas/orden_trabajo.py` | `app/schemas/work_order.py` |
| `app/schemas/material.py` | `app/schemas/material.py` (+ nuevos) |
| `app/schemas/stock_pileta.py` | `app/schemas/pool_stock.py` |
| `app/schemas/medicion.py` | `app/schemas/measurement.py` |
| `app/schemas/caja.py` | `app/schemas/daily_cash.py` |
| `app/schemas/configuracion.py` | `app/schemas/setting.py` |
| `app/schemas/trabajo_realizado.py` | (eliminar) |
| `app/schemas/dashboard.py` | (eliminar — reemplazado por `dashboard` service) |
| (nuevo) | `app/schemas/base.py` (`BaseResponse`) |
| (nuevo) | `app/schemas/reference.py` |
| (nuevo) | `app/schemas/product_photo.py` |
| `app/schemas/auth.py` | `app/schemas/auth.py` |

### 8.3 Backend routers

| Antes | Después |
|-------|---------|
| `app/routers/auth.py` | `app/api/routers/auth.py` |
| `app/routers/clientes.py` | `app/api/routers/clients.py` |
| `app/routers/presupuestos.py` | `app/api/routers/budgets.py` |
| `app/routers/presupuestos_online.py` | `app/api/routers/online_budgets.py` |
| `app/routers/ordenes_trabajo.py` | `app/api/routers/work_orders.py` |
| `app/routers/materiales.py` | `app/api/routers/materials.py` |
| `app/routers/stock_piletas.py` | `app/api/routers/pool_stock.py` |
| `app/routers/mediciones.py` | `app/api/routers/measurements.py` |
| `app/routers/caja.py` | `app/api/routers/daily_cash.py` |
| `app/routers/configuracion.py` | `app/api/routers/settings.py` |
| `app/routers/dashboard.py` | (eliminar — usar `/api/v1/dashboard` desde root o fusionar en reports) |
| `app/routers/reportes.py` | `app/api/routers/reports.py` |
| `app/routers/depends.py` | (eliminar — fundir en `app/api/dependencies.py`) |
| `app/routers/trabajos_realizados.py` | (eliminar) |
| (nuevo) | `app/api/routers/router.py` (agregador) |
| (nuevo) | `app/api/routers/references.py` |
| (nuevo) | `app/api/routers/search.py` |
| (nuevo) | `app/api/routers/options.py` |
| (nuevo) | `app/api/routers/product_photos.py` |

### 8.4 Backend services

| Antes | Después |
|-------|---------|
| `app/services/auth_service.py` | `app/services/auth.py` |
| `app/services/cliente_service.py` | `app/services/client.py` |
| `app/services/presupuesto_service.py` | `app/services/budget.py` (+ extraer `budget_calculator.py`) |
| `app/services/presupuesto_online_service.py` | `app/services/online_budget.py` |
| `app/services/orden_trabajo_service.py` | `app/services/work_order.py` |
| `app/services/material_service.py` | `app/services/material.py` |
| `app/services/stock_pileta_service.py` | `app/services/pool_stock.py` |
| `app/services/medicion_service.py` | `app/services/measurement.py` |
| `app/services/caja_service.py` | `app/services/daily_cash.py` |
| `app/services/configuracion_service.py` | `app/services/setting.py` |
| `app/services/dashboard_service.py` | `app/services/dashboard.py` (o eliminar) |
| `app/services/reportes` (no existe) | `app/services/report.py` |
| `app/services/pdf_generator.py` | `app/services/pdf.py` (legacy) + `app/services/pdf_html.py` (primary) |
| `app/services/pdf_html_service.py` | (fundir en `pdf_html.py`) |
| `app/services/email_service.py` | `app/services/email.py` |
| `app/services/whatsapp_service.py` | `app/services/whatsapp.py` |
| `app/services/exceptions.py` | (mover a `app/core/exceptions.py`) |
| `app/services/trabajo_realizado_service.py` | (eliminar) |
| (nuevo) | `app/services/base.py` |
| (nuevo) | `app/services/product_photo.py` |

### 8.5 Backend repositories

| Antes | Después |
|-------|---------|
| `app/repositories/base.py` | `app/repositories/base.py` |
| `app/repositories/cliente.py` | `app/repositories/client.py` |
| `app/repositories/presupuesto.py` | `app/repositories/budget.py` |
| `app/repositories/presupuesto_online.py` | `app/repositories/online_budget.py` |
| `app/repositories/orden_trabajo.py` | `app/repositories/work_order.py` |
| `app/repositories/material.py` | `app/repositories/material.py` |
| `app/repositories/stock_pileta.py` | `app/repositories/pool_stock.py` |
| `app/repositories/medicion.py` | `app/repositories/measurement.py` |
| `app/repositories/caja.py` | `app/repositories/daily_cash.py` |
| `app/repositories/configuracion.py` | `app/repositories/setting.py` |
| `app/repositories/trabajo_realizado.py` | (eliminar) |
| (nuevo) | `app/repositories/reference.py` |
| (nuevo) | `app/repositories/product_photo.py` |

### 8.6 Backend core/utils/templates

| Antes | Después |
|-------|---------|
| `app/core/config.py` | `app/core/settings.py` |
| `app/core/database.py` | `app/db/session.py` + `app/db/database.py` + `app/db/base.py` (split en 3) |
| `app/core/dependencies.py` | `app/api/dependencies.py` |
| `app/utils/numeracion.py` | `app/utils/numbering.py` |
| `app/templates/orden_pdf.html` | `app/templates/work_order_pdf.html` |
| `app/templates/presupuesto_pdf.html` | `app/templates/budget_pdf.html` |
| (nuevo) | `app/utils/logger.py` |
| (nuevo) | `app/utils/responses.py` |
| (nuevo) | `app/utils/pagination.py` |
| (nuevo) | `app/core/exceptions.py` |

### 8.7 Frontend services

| Antes | Después |
|-------|---------|
| `src/services/apiClient.ts` | `src/api/http.ts` |
| `src/services/api.ts` | `src/api/client.ts` (re-export) |
| `src/services/auth.ts` | `src/api/resources/auth.ts` |
| `src/services/caja.ts` | `src/api/resources/cash.ts` |
| `src/services/clientes.ts` | `src/api/resources/clients.ts` |
| `src/services/configuracion.ts` | `src/api/resources/settings.ts` |
| `src/services/dashboard.ts` | (mover a `reports.ts` o eliminar) |
| `src/services/materiales.ts` | `src/api/resources/materials.ts` |
| `src/services/mediciones.ts` | `src/api/resources/measurements.ts` |
| `src/services/ordenes.ts` | `src/api/resources/workOrders.ts` |
| `src/services/presupuestos.ts` | `src/api/resources/budgets.ts` |
| `src/services/presupuestosOnline.ts` | `src/api/resources/onlineBudgets.ts` |
| `src/services/reportes.ts` | `src/api/resources/reports.ts` |
| `src/services/stockPiletas.ts` | `src/api/resources/poolStock.ts` |
| `src/services/trabajosRealizados.ts` | (eliminar) |
| (nuevo) | `src/api/resources/references.ts` |
| (nuevo) | `src/api/resources/search.ts` |
| (nuevo) | `src/api/resources/options.ts` |
| (nuevo) | `src/api/resources/productPhotos.ts` |
| (nuevo) | `src/api/resources/index.ts` |
| (nuevo) | `src/api/wrap.ts` |

### 8.8 Frontend types

| Antes | Después |
|-------|---------|
| `src/types/api.ts` | (consolidar en `types/index.ts`) |
| `src/types/auth.ts` | (consolidar en `types/index.ts`) |
| `src/types/caja.ts` | (consolidar) |
| `src/types/cliente.ts` | (consolidar) |
| `src/types/configuracion.ts` | (consolidar) |
| `src/types/croquis.ts` | (consolidar — renombrar `SketchElement` etc.) |
| `src/types/dashboard.ts` | (consolidar) |
| `src/types/form.ts` | (eliminar — se reemplaza por useEntityForm) |
| `src/types/material.ts` | (consolidar) |
| `src/types/medicion.ts` | (consolidar) |
| `src/types/orden.ts` | (consolidar) |
| `src/types/presupuesto.ts` | (consolidar) |
| `src/types/presupuestoOnline.ts` | (consolidar) |
| `src/types/stockPileta.ts` | (consolidar) |
| `src/types/trabajoRealizado.ts` | (eliminar) |
| `src/types/index.ts` | `src/types/index.ts` (mantiene, ahora contiene TODO) |

### 8.9 Frontend pages

| Antes | Después |
|-------|---------|
| `src/pages/DashboardPage.tsx` | `src/pages/Dashboard/Dashboard.tsx` + `Dashboard.module.css` |
| `src/pages/LoginPage.tsx` | `src/pages/Login/Login.tsx` + `Login.module.css` |
| `src/pages/PublicPage.tsx` | `src/pages/Public/Public.tsx` + `Public.module.css` |
| `src/pages/clientes/*` | `src/pages/Clients/*` |
| `src/pages/presupuestos/PresupuestosListPage.tsx` | `src/pages/Budgets/Budgets.tsx` |
| `src/pages/presupuestos/PresupuestoFormPage.tsx` | `src/pages/Budgets/BudgetForm.tsx` (+ sub-componentes) |
| `src/pages/presupuestos/PresupuestosOnlineListPage.tsx` | `src/pages/OnlineBudgets/OnlineBudgets.tsx` |
| `src/pages/presupuestos/PresupuestoOnlineFormPage.tsx` | `src/pages/OnlineBudgets/OnlineBudgetForm.tsx` |
| `src/pages/ordenes/OrdenesListPage.tsx` | `src/pages/WorkOrders/WorkOrders.tsx` |
| `src/pages/ordenes/OrdenFormPage.tsx` | `src/pages/WorkOrders/WorkOrderForm.tsx` (+ sub-componentes) |
| `src/pages/materiales/*` | `src/pages/Materials/*` (+ `MaterialConsultant/`) |
| `src/pages/stock/StockPiletasPage.tsx` | `src/pages/PoolStock/PoolStock.tsx` |
| `src/pages/mediciones/*` | `src/pages/Measurements/*` |
| `src/pages/caja/CajaDiariaPage.tsx` | `src/pages/DailyCash/DailyCashPage.tsx` |
| `src/pages/caja/CajaHistorialPage.tsx` | `src/pages/DailyCash/CashHistory.tsx` |
| `src/pages/calculadora/CalculadoraPage.tsx` | `src/pages/Calculator/Calculator.tsx` |
| `src/pages/configuracion/ConfiguracionPage.tsx` | `src/pages/Settings/Settings.tsx` |
| `src/pages/reportes/ReportesPage.tsx` | `src/pages/Reports/Reports.tsx` |
| `src/pages/trabajosRealizados/*` | (eliminar) |
| (nuevo) | `src/pages/ProductPhotos/ProductPhotos.tsx` |

### 8.10 Frontend components / hooks / contexts

| Antes | Después |
|-------|---------|
| `src/hooks/useCalculosPresupuesto.ts` | (consolidar en `useEntityForm` o eliminar) |
| `src/hooks/useEntityForm.ts` | `src/hooks/useEntityForm.ts` (mantiene) |
| `src/context/AuthContext.tsx` | `src/context/AuthContext.tsx` (mantiene) |
| `src/context/NotificationContext.tsx` | `src/context/NotificationContext.tsx` (mantiene) |
| `src/components/auth/ProtectedRoute.tsx` | `src/components/ProtectedRoute/ProtectedRoute.tsx` |
| `src/components/caja/*` | (consolidar en `pages/DailyCash/`) |
| `src/components/common/{Modal,Loading,ConfirmDialog}.tsx` | `src/components/ui/{Modal,LoadingSpinner,ConfirmDialog}/<Name>.tsx` |
| `src/components/croquis/*` | (eliminar — se reemplaza por `BudgetSketchElement` DB) |
| `src/components/firma/FirmaCanvas.tsx` | (consolidar en `BudgetForm` o `pages/_components/`) |
| `src/components/materiales/*` | (consolidar en `pages/Materials/_components/`) |
| `src/components/ordenes/*` | (consolidar en `pages/WorkOrders/_components/`) |
| `src/components/presupuesto/*` | (consolidar en `pages/Budgets/_components/`) |
| `src/components/ui/Badge.tsx` | (consolidar en `StatusBadge/`) |
| `src/components/ui/Container.tsx` | `src/components/ui/Container/Container.tsx` |
| `src/components/ui/CurrencyDisplay.tsx` | `src/components/ui/CurrencyDisplay/CurrencyDisplay.tsx` |
| `src/components/ui/ErrorBoundary.tsx` | `src/components/ErrorBoundary/ErrorBoundary.tsx` (+ `.module.css`) |
| `src/components/ui/EstadoBadge.tsx` | `src/components/ui/StatusBadge/StatusBadge.tsx` (rename) |
| `src/layouts/MainLayout.tsx` | `src/components/Layout/Layout.tsx` (move + module.css) |
| (nuevo) | `src/components/ui/Button/`, `Modal/`, `ListPage/`, `PageHeader/`, `TableActions/`, `FormActions/`, `ErrorBlock/`, `EmptyState/`, `SearchInput/`, `PieChart/`, `ChartBar/`, `useConfirm.ts` |
| (nuevo) | `src/shared/api/queryClient.ts` + `hooks.ts` |
| (nuevo) | `src/app/providers.tsx` |
| (nuevo) | `src/context/ReferencesContext.tsx` |
| (nuevo) | `src/utils/{calcM2,downloadPdf,whatsapp,index}.ts` |
| (nuevo) | `src/test/setup.ts` |
| (nuevo) | `src/assets/` (vacío por ahora) |

---

## 9. Convenciones Adicionales

### 9.1 Backend Python

- **snake_case** para archivos, funciones, variables: `client_repository.py`, `get_client()`, `client_id`.
- **PascalCase** para clases: `ClientService`, `BudgetRepository`, `NotFoundError`.
- **UPPER_SNAKE_CASE** para constantes: `DEFAULT_USD_RATE`, `MAX_INSTALLMENTS`.
- **Type hints everywhere**: `def get_client(client_id: int) -> Client | None:`.
- **No `any` (TypeScript) / No `Any` (Python)**: usar tipos específicos o `Optional[T]`.
- **Pydantic v2**: `model_config = ConfigDict(from_attributes=True)`.
- **SQLAlchemy 2.0** style: `select()`, `session.execute()`.
- **Python 3.14 compatibility**: usar `Optional[date]` en Pydantic (no `date | None`).

### 9.2 Frontend TypeScript

- **strict: true** en `tsconfig.json`.
- **Sin `any`**: usar `unknown` + narrowing o tipos específicos.
- **Sin `@ts-nocheck`**: refactorizar hasta que compile.
- **Interfaces globales en `src/types/`**, no locales.
- **Estados tipados explícitamente**: `useState<Client | null>(null)`.
- **Custom hooks retornan objeto**: `UseXxxReturn`.
- **Props con interface**: `interface ButtonProps { ... }`.
- **PascalCase** componentes: `ClientsList`, `MaterialCard`.
- **camelCase** hooks: `useEntityForm`, `useDebounce`.
- **camelCase** utils: `formatCurrency`, `validateClient`.
- **UPPER_SNAKE_CASE** constantes: `QUOTE_STATUSES`, `MATERIAL_CATEGORIES`.
- **Imports order**: externos → types → services/hooks/utils → components → styles.

### 9.3 Naming TSX files (alineado con referencia)

- Componentes: `Button.tsx` (no `ButtonComponent.tsx`).
- Hooks: `useDebounce.ts`.
- Utils: `formatCurrency.ts`.
- Tipos: `index.ts` (consolidado) o `<entity>.ts` si se separa.
- Páginas: `Budgets.tsx` (no `BudgetsPage.tsx` — el sufijo "Page" es de
  React Router, no del archivo).

---

## 10. Migración de datos existentes (DB)

Si la DB SQLite ya tiene datos con estados en español, ejecutar antes de
la migración Alembic:

```sql
-- Estados de presupuestos
UPDATE presupuestos SET estado = 'PENDING' WHERE estado = 'PENDIENTE';
UPDATE presupuestos SET estado = 'ONLINE' WHERE estado = 'ENVIADO' OR estado = 'PRESUPUESTO_ONLINE';
UPDATE presupuestos SET estado = 'APPROVED' WHERE estado = 'APROBADO';
UPDATE presupuestos SET estado = 'REJECTED' WHERE estado = 'RECHAZADO';
UPDATE presupuestos SET estado = 'CONVERTED_TO_OT' WHERE estado = 'CONVERTIDO A OT';

-- Estados de órdenes
UPDATE ordenes_trabajo SET estado = 'MEASUREMENT' WHERE estado = 'MEDICION' OR estado = 'EN MEDICIÓN';
UPDATE ordenes_trabajo SET estado = 'WORKSHOP' WHERE estado = 'TALLER' OR estado = 'EN EL TALLER';
UPDATE ordenes_trabajo SET estado = 'FINISHED' WHERE estado = 'TERMINADA';
UPDATE ordenes_trabajo SET estado = 'DELIVERED' WHERE estado = 'ENTREGADA';
UPDATE ordenes_trabajo SET estado = 'CANCELLED' WHERE estado = 'CANCELADO';

-- Forma de pago
UPDATE ordenes_trabajo SET forma_pago = 'CASH' WHERE forma_pago = 'EFECTIVO';
UPDATE ordenes_trabajo SET forma_pago = 'TRANSFER' WHERE forma_pago = 'TRANSFERENCIA';
UPDATE ordenes_trabajo SET forma_pago = 'CREDIT_CARD' WHERE forma_pago = 'TARJETA DE CRÉDITO' OR forma_pago = 'TARJETA';
UPDATE ordenes_trabajo SET forma_pago = 'DEBIT_CARD' WHERE forma_pago = 'TARJETA DE DÉBITO';
UPDATE ordenes_trabajo SET forma_pago = 'CHECK' WHERE forma_pago = 'CHEQUE';
UPDATE ordenes_trabajo SET forma_pago = 'MIXED' WHERE forma_pago = 'MIXTO';

-- Prioridad
UPDATE ordenes_trabajo SET prioridad = 'LOW' WHERE prioridad = 'BAJA';
UPDATE ordenes_trabajo SET prioridad = 'NORMAL' WHERE prioridad = 'NORMAL';
UPDATE ordenes_trabajo SET prioridad = 'HIGH' WHERE prioridad = 'ALTA';
UPDATE ordenes_trabajo SET prioridad = 'URGENT' WHERE prioridad = 'URGENTE';

-- Mediciones
UPDATE mediciones SET estado = 'PENDING' WHERE estado = 'PENDIENTE';
UPDATE mediciones SET estado = 'DONE' WHERE estado = 'REALIZADA';
UPDATE mediciones SET estado = 'CANCELLED' WHERE estado = 'CANCELADA';
```

Después:
1. `alembic revision --autogenerate -m "rename_to_english"` (puede generar
   migración vacía si los nombres de tabla no cambian).
2. `alembic stamp head` (no necesita re-ejecutar migraciones).

> **Decisión:** se prefiere **drop & recreate** la DB en desarrollo:
> ```bash
> rm afamar.db
> python -m alembic upgrade head
> python seed.py
> ```
> Para producción: backup + script de migración de datos.

---

## 11. Verificación final — Definition of Done

| Check | Comando / Acción |
|-------|------------------|
| Backend levanta sin errores | `cd afamar-backend && uvicorn app.main:app --port 8000` |
| Health endpoint | `curl http://localhost:8000/health` → 200 |
| Frontend build verde | `cd afamar-frontend && npm run build` → 0 errores |
| TypeScript strict | `npx tsc --noEmit` → 0 errores |
| ESLint limpio | `npm run lint` → 0 errores |
| 0 archivos en español | `rg -l '[áéíóúñ]' afamar-backend/app/ afamar-frontend/src/` (debería ser 0) |
| 0 `style={{...}}` inline | `rg -n 'style=\{\{' afamar-frontend/src/` → 0 (excepto custom properties) |
| Endpoints accesibles en inglés | `curl http://localhost:8000/api/v1/clients` → 200 |
| Rutas frontend en inglés | Browser → `/admin/clients` → 200 |
| Login funciona | Manual: `admin` / `admin123` |
| Crear budget → convertir a WorkOrder | Manual: end-to-end OK |
| Tests pasan | `cd afamar-backend && pytest` → 0 fails |

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Renombrar columnas rompe DB existente | DROP & RECREATE en dev; script de migración SQL en prod |
| Renombrar URLs rompe frontend en producción | Deploy coordinado: backend y frontend en la misma release |
| CSS Modules rompe clases globales | Mantener `index.css` solo con `:root` y `body`; sin clases de componente |
| `@ts-nocheck` extendido en `useEntityForm.ts` | Refactorizar tipado; o usar `// eslint-disable-next-line` solo donde sea estrictamente necesario |
| `componentes > 800 líneas` (PresupuestoForm, OrdenForm) | Refactor BEM **sin** extraer subcomponentes (es trabajo posterior) |
| Path aliases no funcionan en producción (Vite build) | Verificar `vite.config.ts` y `tsconfig.json` con el mismo `paths` |
| Tests rompen por cambios en schema | Re-correr con DB fresca; ajustar fixtures |

---

## 13. Out of scope (trabajo futuro)

- Migración de SQLite a PostgreSQL.
- Reemplazo de `useEntityForm` con composables más pequeños.
- Extracción de subcomponentes de `BudgetForm`/`WorkOrderForm` (la referencia
  YA lo hace en 6 sub-componentes cada uno — considerarlo parte de Fase 4).
- Implementación de tests E2E con Playwright.
- Caché con Redis.
- Rate limiting distribuido.
- i18n completo (actualmente solo DB keys en inglés + labels en español).
