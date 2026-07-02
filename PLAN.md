# AFAMAR — Plan de Refactor Integral

> Documento vivo. Roadmap del refactor de **inglesización + BEM/CSS Modules**
> con separación de responsabilidades. Estructura basada en el proyecto de
> referencia `D:\projects\PERSONAL\afamar-project`.

---

## 1. Estado del proyecto (rama `refactor`)

### 1.1 Completado ✅

| Hito | Detalle |
|------|---------|
| **Carpetas renombradas** | `backend/` → `afamar-backend/`, `frontend/` → `afamar-frontend/` |
| **Backend en inglés** | 15 models, 15 schemas, 12 repos, 17 services, 19 routers |
| **API path** | Todos los routers montados bajo `/api/v1` en `app/api/routers/router.py` |
| **Auth backend** | JWT con `Depends(get_current_user)` en routers admin. `POST /api/v1/auth/login` |
| **Alembic** | Migración `initial_schema` autogenerada. `app/main.py` corre `alembic upgrade head` en lifespan |
| **Frontend infra** | `tsconfig.json` con `@/`, `@features/`, `@shared/`, `@assets/`. `vite.config.ts` con proxy `/api` |
| **Frontend services** | 13 services con paths English + aliases backward-compat |
| **Frontend pages** | 20 pages en carpetas English (`clients/`, `budgets/`, `work-orders/`, etc.) |
| **BEM modules** | 18/18 pages con `.module.css` (todas las pages, incluyendo 4 form pages) |
| **App.tsx** | Rutas `/admin/*` con redirects backward-compat desde paths en español |
| **Types en inglés** | 9 English files + 8 Spanish aliases re-exportando desde `types/index.ts` |
| **Reference data seed** | `scripts/seed_reference_data.py` — 5 tablas, idempotente, flags `--only`/`--force` |
| **src/api/ consolidado** | `src/services/`, `src/shared/`, `src/app/`, `components/Layout/`, `components/ProtectedRoute/` eliminados. `src/api/resources/` con 12 domain files |
| **Sidebar mejorada** | Sin auto-open/auto-close. Botón hamburguesa. Content shift con sidebar |
| **Croquis "Borrar último"** | Siempre visible, deshabilitado cuando no hay elementos |
| **PDF templates movidos** | `app/templates/templates/` → `app/templates/` |
| **Pytest conftest arreglado** | Imports actualizados a nueva estructura |
| **Build verde** | `tsc --noEmit && vite build` → 0 errores |
| **Carpetas viejas** | `backend/` y `frontend/` borradas. `app/routers/`, `app/schemas/schemas/`, `app/repositories/repositories/`, `app/utils/utils/` eliminados |
| **Git** | Rama `refactor` con 6 commits (2 locales sin pushear) |

### 1.2 Pendiente ⏳

| # | Tarea | Esfuerzo |
|---|-------|----------|
| 1 | ~~Migrar 4 form pages a BEM (BudgetForm, WorkOrderForm, ClientForm, MaterialForm)~~ ✅ | — |
| 2 | ~~Renombrar types a inglés (`Cliente`→`Client`, etc.) manteniendo aliases~~ ✅ | — |
| 3 | ~~Extraer subcomponentes de `BudgetForm`/`WorkOrderForm` (6 cada uno)~~ ✅ | — |
| 4 | ~~Crear seed de reference data (`budget_statuses`, `work_order_statuses`, `payment_methods`, etc.)~~ ✅ | — |
| 5 | ~~Migrar pages sin BEM module (OnlineBudgets, Measurements, Configuration)~~ ✅ | — |
| 6 | Tests E2E con Playwright | ~2-3 h |
| 7 | ~~Eliminar legacy folders (si quedan archivos en `pages/<spanish-name>/`)~~ ✅ | — |
| 8 | ~~Eliminar aliases Spanish en services (mantener solo English)~~ ✅ | — |
| 9 | Eliminar `useEntityForm.ts` legacy y dividir en composables | ~2 h |
| 10 | Migrar a TanStack Query en pages (hooks ya en `src/api/hooks.ts`) | ~2-3 h |

---

## 2. Convenciones de Naming

### 2.1 Entidades de dominio

| Español (legacy) | Inglés (actual) | Tabla DB |
|------------------|----------------|----------|
| `Cliente` | `Client` | `clients` |
| `Presupuesto` | `Budget` | `budgets` |
| `PresupuestoItem` | `BudgetItem` | `budget_items` |
| `PresupuestoAdicional` | `BudgetAdicional` | `budget_adicionales` |
| `PresupuestoOnline` | `OnlineBudget` | `online_budgets` |
| `OrdenTrabajo` | `WorkOrder` | `work_orders` |
| `Material` | `Material` | `materials` |
| `StockPileta` | `PoolStock` | `pool_stock` |
| `MovimientoPileta` | `StockMovement` | `stock_movements` |
| `Medicion` | `Measurement` | `measurements` |
| `CajaDiaria` | `DailyCash` | `daily_cash` |
| `MovimientoCaja` | `CashMovement` | `cash_movements` |
| `Configuracion` | `Setting` | `settings` |
| `PriceHistory` | `PriceHistory` | `price_history` |
| `User` | `User` | `users` |

### 2.2 Endpoints REST

| Path | Descripción |
|------|-------------|
| `POST /api/v1/auth/login` | Login (público) |
| `GET /api/v1/clients` | Listar clientes |
| `GET /api/v1/clients/{id}` | Cliente por id |
| `GET /api/v1/clients/{id}/history` | Historial del cliente |
| `GET /api/v1/budgets` | Listar presupuestos |
| `GET /api/v1/budgets/unified` | Local + online unificados |
| `GET /api/v1/budgets/next-number` | Próximo número `P-XXXXXX` |
| `POST /api/v1/budgets/{id}/convert-to-work-order` | Convertir a OT |
| `GET /api/v1/work-orders` | Listar órdenes |
| `GET /api/v1/work-orders/next-number` | Próximo número `A-XXXXXX` |
| `GET /api/v1/online-budgets` | Listar presupuestos online |
| `GET /api/v1/pool-stock` | Listar piletas en stock |
| `GET /api/v1/materials` | Listar materiales |
| `GET /api/v1/measurements` | Listar mediciones |
| `GET /api/v1/cash/daily` | Caja diaria |
| `GET /api/v1/cash/history` | Historial de cajas cerradas |
| `GET /api/v1/settings` | Configuración (key-value) |
| `GET /api/v1/reports/budgets` | Reporte de presupuestos |
| `GET /api/v1/reports/monthly-sales` | Ventas mensuales |
| `GET /api/v1/references/budget-statuses` | Status de presupuestos (dinámico) |
| `GET /health` | Health check (root, sin prefijo) |
| `GET /health/ready` | Health check con DB check |

### 2.3 Rutas frontend

| Path | Descripción |
|------|-------------|
| `/` | Landing público (PublicPage) |
| `/login` | Login (LoginPage) |
| `/admin` | Dashboard |
| `/admin/clients` · `/admin/clients/new` · `/admin/clients/:id` | Clientes |
| `/admin/budgets` · `/admin/budgets/new` · `/admin/budgets/:id` | Presupuestos local |
| `/admin/online-budgets` · `/admin/online-budgets/new` · `/admin/online-budgets/:id` | Online |
| `/admin/work-orders` · `/admin/work-orders/new` · `/admin/work-orders/:id` | Órdenes |
| `/admin/materials` · `/admin/materials/new` · `/admin/materials/:id` | Materiales |
| `/admin/pool-stock` | Stock de piletas |
| `/admin/measurements` · `/admin/measurements/new` · `/admin/measurements/:id` | Mediciones |
| `/admin/cash` · `/admin/cash/history` | Caja diaria |
| `/admin/configuration` | Configuración |
| `/admin/reports` | Reportes |
| `/admin/calculator` | Calculadora de placa |
| `/admin/product-photos` | Galería de fotos |

### 2.4 Estados y enums (DB en inglés, UI en español via `t()`)

| DB value | UI label |
|----------|----------|
| `PENDING` | Pendiente |
| `ONLINE` | Online |
| `APPROVED` | Aprobado |
| `REJECTED` | Rechazado |
| `CONVERTED_TO_OT` | Concretado |
| `MEASUREMENT` | Medición |
| `WORKSHOP` | Taller |
| `FINISHED` | Terminado |
| `DELIVERED` | Entregado |
| `CANCELLED` | Cancelado |
| `DONE` | Realizado |
| `LOW` | Baja |
| `NORMAL` | Normal |
| `HIGH` | Alta |
| `URGENT` | Urgente |
| `CASH` | Efectivo |
| `TRANSFER` | Transferencia |
| `CREDIT_CARD` | Tarjeta de Crédito |
| `DEBIT_CARD` | Tarjeta de Débito |
| `CHECK` | Cheque |
| `MIXED` | Mixto |
| `INCOME` | Ingreso |
| `EXPENSE` | Egreso |
| `BANK_TRANSFER` | Transf. Banco |

---

## 3. Convenciones CSS (BEM + CSS Modules)

### 3.1 Reglas BEM

```
.block                          → bloque independiente
.block__element                 → elemento del bloque
.block--modifier                → variante del bloque
.block__element--modifier       → variante del elemento
```

**Reglas duras:**
- Nunca anidar más allá de `__element` (no `__element__subelement`)
- Nunca selectores de etiqueta, IDs, ni universales
- Modificadores representan estados/variantes, no propiedades nuevas

### 3.2 CSS Modules

Cada página tiene su `X.module.css` co-localizado:

```ts
// XPage.tsx
import styles from './XPage.module.css';
const s = styles as unknown as Record<string, string>;

<div className={s['x']}>
  <h1 className={s['x__title']}>Título</h1>
  <div className={s['x__item--active']}>Item activo</div>
</div>
```

```css
/* XPage.module.css */
.x { ... }
.x__title { ... }
.x__item { ... }
.x__item--active { ... }
```

> **Tip:** usar `const s = styles as unknown as Record<string, string>` permite
> acceso dinámico con `s['x__title']` sin errores de TS por la sintaxis BEM.

### 3.3 Variables globales (`src/index.css`)

Reset CSS + design tokens (colores, fuentes, espaciado, sombras, z-index).
Las páginas NO deben tener clases con `p-`, `mb-4`, `text-center`, etc.
(Tailwind syntax fue removido en favor de CSS Modules + BEM).

### 3.4 Type declaration

`src/css-modules.d.ts` declara `*.module.css` como `Record<string, string>`.

---

## 4. Arquitectura Backend

```
afamar-backend/app/
├── main.py                    # FastAPI app + lifespan + middleware
├── api/
│   ├── dependencies.py        # get_db, get_current_user (auth)
│   └── routers/
│       ├── router.py          # agrega /api/v1 + include_router
│       ├── auth.py            # /auth (login público)
│       ├── clients.py
│       ├── budgets.py
│       ├── online_budgets.py
│       ├── work_orders.py
│       ├── materials.py
│       ├── pool_stock.py
│       ├── measurements.py
│       ├── daily_cash.py
│       ├── settings.py
│       ├── reports.py
│       ├── search.py
│       ├── options.py
│       ├── references.py
│       ├── product_photos.py
│       └── whatsapp.py
├── core/                      # Configuración + cross-cutting
│   ├── settings.py            # pydantic Settings (lee .env)
│   └── exceptions.py          # NotFoundError, ConflictError, ValidationError
├── db/
│   ├── base.py                # DeclarativeBase
│   ├── session.py             # engine, SessionLocal
│   └── database.py            # get_db, dispose_db
├── models/                    # 15 SQLAlchemy models (inglés)
├── schemas/                   # Pydantic (Create/Update/Response separados)
├── repositories/              # SQLAlchemy puro (add, save, delete, get_*)
├── services/                  # Lógica de negocio
├── utils/
│   ├── logger.py              # setup_logging + check_database
│   ├── responses.py           # success() / created() / error() envelope
│   ├── pagination.py          # paginate(query) → Page
│   └── numbering.py           # generate_budget_number / generate_work_order_number
└── templates/                 # Jinja2 (budget_pdf.html, work_order_pdf.html)
```

### Capas (regla de dependencias)

| Capa | Puede importar | NO puede |
|------|----------------|----------|
| Routers | schemas, services, api.dependencies, models (tipos) | repositories, db.session |
| Services | models, schemas, repositories, core.exceptions, utils, otros services | FastAPI, Request, Response, HTTPException |
| Repositories | models, db.session | schemas, services, FastAPI |
| Models | sqlalchemy, db.base | schemas, services, repositories |
| Schemas | pydantic, schemas.base | models, services, repositories |
| Utils | stdlib, third-party (sin DB) | models, schemas, services |

---

## 5. Arquitectura Frontend

```
afamar-frontend/src/
├── api/                       # Capa de red
│   ├── http.ts                # Axios instance + interceptors
│   ├── client.ts              # api = re-export from resources
│   ├── resources/             # 12 domain files (budgets, clients, cash, etc.)
│   └── hooks.ts               # TanStack Query hooks (useList, useGet, etc.)
├── pages/                     # Componentes de ruta (1 carpeta por dominio, todas con *.module.css)
│   ├── auth/                  (LoginPage)
│   ├── home/                  (HomePage)
│   ├── dashboard/             (DashboardPage)
│   ├── clients/               (ClientsListPage, ClientFormPage)
│   ├── budgets/               (BudgetsListPage, BudgetFormPage)
│   ├── work-orders/           (WorkOrdersListPage, WorkOrderFormPage)
│   ├── materials/             (MaterialsListPage, MaterialFormPage)
│   ├── pool-stock/            (PoolStockPage)
│   ├── measurements/          (MeasurementsListPage, MeasurementFormPage)
│   ├── cash/                  (CashDailyPage, CashHistoryPage)
│   ├── calculator/            (CalculatorPage)
│   ├── configuration/         (ConfigurationPage)
│   ├── reports/               (ReportsPage)
│   └── online-budgets/        (OnlineBudgetsListPage, OnlineBudgetFormPage)
├── components/                # Reutilizables
│   ├── ui/                    # Primitivas: Button, Modal, StatusBadge, ListPage, etc.
│   ├── croquis/               # CroquisEditor, Toolbar, useCroquisState
│   ├── caja/                  # IngresoModal
│   ├── presupuesto/           # PresupuestoPanel
│   └── ErrorBoundary/
├── layouts/                   # MainLayout + MainLayout.module.css (sidebar BEM)
├── context/                   # AuthContext, NotificationContext, ReferencesContext
├── hooks/                     # useEntityForm (legacy, @ts-nocheck), custom hooks
├── constants/                 # CURRENCIES, STATUS_COLORS, PRIORITY_COLORS
├── types/                     # 17 files (9 English + 8 Spanish aliases)
├── utils/                     # formatCurrency, translate, calcM2, downloadPdf, whatsapp
├── main.tsx
├── App.tsx                    # BrowserRouter + Routes (lazy + ProtectedRoute + AuthProvider)
└── index.css                  # reset + design tokens + legacy classes
```

### Path aliases

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@features/*` | `src/features/*` |
| `@shared/*` | `src/shared/*` |
| `@assets/*` | `src/assets/*` |

Configurados en `tsconfig.json` + `vite.config.ts` + `vitest.config.ts`.

### API base URL

```ts
// src/api/http.ts
export const API_URL = window.APP_CONFIG?.API_URL || '/api/v1';
```

- Dev: Vite proxy reenvía `/api/*` a `http://localhost:8000` (variable `API_PORT`)
- Prod: nginx reenvía `/api/*` a `backend:3095` interno
- Override via `VITE_API_URL` env o `window.APP_CONFIG.API_URL` (runtime)

---

## 6. Path de migración para próximas sesiones

### Sesión siguiente: descomposición de forms

`BudgetFormPage` → 6 subcomponentes (como la referencia):
- `BudgetFormClient.tsx` — datos del cliente + snapshot
- `BudgetFormSpecs.tsx` — material, color, espesor, frente, acabado
- `BudgetFormItems.tsx` — items de fabricación + tabs
- `BudgetFormAdicionales.tsx` — adicionales
- `BudgetFormFinancial.tsx` — pileta, totales, forma de pago
- `BudgetFormObservations.tsx` — observaciones + croquis + firma

`WorkOrderFormPage` → 6 subcomponentes:
- `WorkOrderFormBasic.tsx` — cliente + status + prioridad + fecha
- `WorkOrderFormSpecs.tsx` — material + color + espesor
- `WorkOrderFormItemsGrid.tsx` — items
- `WorkOrderFormObservations.tsx` — observaciones + croquis + firma
- `WorkOrderFormFinancial.tsx` — pileta + totales + pagos
- `WorkOrderFormSnapshot.tsx` — datos snapshot

### Sesión: tests E2E con Playwright

Crear `e2e/` con tests de:
- Login + redirect a /admin
- Crear cliente
- Crear budget + convertir a WorkOrder
- Crear material
- Registrar movimiento de caja
- Cerrar caja + ver historial

---

## 7. Comandos de desarrollo

```bash
# Backend (puerto 8000)
cd afamar-backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
python seed_admin.py              # crear admin (admin / admin123)
alembic revision --autogenerate -m "msg"   # generar migración
alembic upgrade head                       # aplicar migraciones
pytest                                    # correr tests

# Frontend (puerto 5173+)
cd afamar-frontend
npm install
npm run dev                               # dev server
npm run build                             # producción
npm run lint                              # ESLint
npm run typecheck                         # tsc --noEmit

# Crear admin si no existe
cd afamar-backend
.\venv\Scripts\python.exe seed_admin.py
```

## 8. Decisiones técnicas

- **SQLite en dev, MySQL en prod** (cambiable via `DATABASE_URL` en `.env`)
- **CORS restrictivo en prod** (`CORS_ALLOW_ORIGINS` separado por comas)
- **Auth JWT con HS256** (`SECRET_KEY` requerido en `.env`)
- **Vite proxy `/api/*` → backend:8000** en dev, nginx → backend:3095 en prod
- **Runtime config** via `window.APP_CONFIG.API_URL` (envsubst en docker CMD)
- **BEM + CSS Modules** sin Tailwind. Cada page tiene su `.module.css` co-localizado
- **Path aliases** (`@/`, `@features/`, `@shared/`, `@assets/`) en TS + Vite
- **English everywhere**: nombres de entidades, endpoints, rutas, archivos, funciones
- **i18n via DB** (English en DB, Spanish en UI via `t()`)
- **TanStack Query** disponible (shared/api/hooks) — actualmente las pages siguen con useState manual. Migrar progresivamente.
- **References data** (statuses, payment_methods, etc.) viene del backend via `/api/v1/references/{resource}`. NO hardcodear en frontend.
- **Tests infra**: SQLite file-based en `tempdir/afamar_test.db` (no `:memory:`) por thread safety. Fixture `client` override `get_current_user` con user mock.
- **PDF generation**: `xhtml2pdf` + Jinja2 templates. Primary service: `pdf_html.py`. Legacy fallback: `pdf.py`.
- **`order` reserved word**: se usa `work_orders` para la tabla, `WorkOrder` para la clase. La columna de orden se llama `priority` o `status`.
- **Python 3.14 compatibility**: usar `Optional[date]` en Pydantic (no `date | None`).
- **Pillow**: pin `Pillow>=11.1.0,<12.0` para Python 3.14 wheels.
- **Bcrypt**: pin `bcrypt==4.1.3` para passlib compat.

## 9. Migración de datos existentes (DB)

Si la DB existe con estados en español, ejecutar antes de Alembic:

```sql
UPDATE presupuestos SET estado = 'PENDING' WHERE estado = 'PENDIENTE';
UPDATE presupuestos SET estado = 'APPROVED' WHERE estado = 'APROBADO';
UPDATE presupuestos SET estado = 'REJECTED' WHERE estado = 'RECHAZADO';
UPDATE presupuestos SET estado = 'CONVERTED_TO_OT' WHERE estado = 'CONVERTIDO A OT';
UPDATE ordenes_trabajo SET estado = 'MEASUREMENT' WHERE estado IN ('MEDICION', 'EN MEDICIÓN');
UPDATE ordenes_trabajo SET estado = 'WORKSHOP' WHERE estado IN ('TALLER', 'EN EL TALLER');
UPDATE ordenes_trabajo SET estado = 'FINISHED' WHERE estado = 'TERMINADA';
UPDATE ordenes_trabajo SET estado = 'DELIVERED' WHERE estado = 'ENTREGADA';
UPDATE ordenes_trabajo SET estado = 'CANCELLED' WHERE estado = 'CANCELADO';
UPDATE ordenes_trabajo SET forma_pago = 'CASH' WHERE forma_pago = 'EFECTIVO';
UPDATE ordenes_trabajo SET forma_pago = 'TRANSFER' WHERE forma_pago = 'TRANSFERENCIA';
UPDATE ordenes_trabajo SET forma_pago = 'CREDIT_CARD' WHERE forma_pago IN ('TARJETA DE CRÉDITO', 'TARJETA');
UPDATE ordenes_trabajo SET forma_pago = 'DEBIT_CARD' WHERE forma_pago = 'TARJETA DE DÉBITO';
UPDATE ordenes_trabajo SET forma_pago = 'CHECK' WHERE forma_pago = 'CHEQUE';
UPDATE ordenes_trabajo SET forma_pago = 'MIXED' WHERE forma_pago = 'MIXTO';
UPDATE ordenes_trabajo SET prioridad = 'LOW' WHERE prioridad = 'BAJA';
UPDATE ordenes_trabajo SET prioridad = 'NORMAL' WHERE prioridad = 'NORMAL';
UPDATE ordenes_trabajo SET prioridad = 'HIGH' WHERE prioridad = 'ALTA';
UPDATE ordenes_trabajo SET prioridad = 'URGENT' WHERE prioridad = 'URGENTE';
UPDATE mediciones SET estado = 'PENDING' WHERE estado = 'PENDIENTE';
UPDATE mediciones SET estado = 'DONE' WHERE estado = 'REALIZADA';
UPDATE mediciones SET estado = 'CANCELLED' WHERE estado = 'CANCELADA';
```

Después: `alembic upgrade head` o `alembic stamp head` si la DB ya está al día.
