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

---

## 10. Plan de Migración Frontend: Inglés Completo (Nueva Fase)

> **Contexto**: El frontend aún usa nombres en español en: tipos de formulario (`EntityFormState` 56 campos), hook legacy `useEntityForm` (394 líneas, @ts-nocheck), 4 API resources con field mappings español→inglés, 7 componentes caja, 6 componentes presupuesto, 4 componentes órdenes, y constantes hardcoded. El backend y API ya son 100% inglés.

### 10.1 Resumen de Impacto

| Métrica | Valor |
|---------|-------|
| Archivos a modificar | ~45 archivos .ts/.tsx |
| Líneas de código afectadas | ~2,500+ |
| Tipos/interfaces core | 8 archivos principales |
| Composables a crear | 8 nuevos hooks |
| Componentes a renombrar | 17 componentes |
| APIs a limpiar | 4 resources (eliminar mappings) |

### 10.2 Tabla de Cambios Principales

| Categoría | Español (Actual) | Inglés (Objetivo) | Archivos Clave |
|-----------|------------------|-------------------|----------------|
| **Form State** | `cliente_nombre`, `material_precio_m2`, `detalles_fabricacion`, `pileta_id`, `sena_recibida`, `forma_pago`, `dolar_dia`, `descuento_porcentaje` | `clientName`, `materialPriceM2`, `fabricationDetails`, `poolId`, `depositReceived`, `paymentMethod`, `usdRate`, `discountPercentage` | `types/form.ts`, `types/budget.ts`, `types/workOrder.ts` |
| **Hook Legacy** | `useEntityForm` (394 líneas) | **Eliminar** → 8 composables | `hooks/useEntityForm.ts`, `hooks/entityFormHelpers.ts` |
| **API Mappings** | `mapWorkOrderToApi` (117 líneas), `mapClientToApi`, `mapMaterialToApi`, `mapPoolToApi` | **Eliminar** (backend ya inglés) | `api/resources/workOrders.ts`, `clients.ts`, `materials.ts`, `poolStock.ts` |
| **Componentes Caja** | `CajaTotalCards`, `IngresosTable`, `EgresosTable`, `IngresoModal`, `EgresoModal`, `CerrarCajaModal`, `SaldoAnteriorCard` | `CashTotalCards`, `IncomesTable`, `ExpensesTable`, `IncomeModal`, `ExpenseModal`, `CloseCashModal`, `PreviousBalanceCard` | `components/caja/*.tsx` |
| **Componentes Órdenes** | `AprobacionSection`, `ObservacionesSection` | `ApprovalSection`, `ObservationsSection` | `components/ordenes/*.tsx` |
| **Componentes Presupuesto** | `PresupuestoPanel`, `PresupuestoOnlineHeader/Footer/Totals`, `OpcionesCotizacionGrid` | `BudgetPanel`, `OnlineBudgetHeader/Footer/Totals`, `QuoteOptionsGrid` | `components/presupuesto/*.tsx` |
| **UI Primitivas** | `EstadoBadge` | `StatusBadge` (ya existe duplicado) | `components/ui/EstadoBadge/` |
| **Constants** | `estadosMedicion`, `categoriasMaterial`, `conceptosFabricacion` | Desde `/api/v1/references/*` | `utils/formatters.ts` |

### 10.3 Riesgos Críticos

| # | Riesgo | Mitigación |
|---|--------|------------|
| 1 | **useEntityForm es núcleo de BudgetForm + WorkOrderForm** (12 subcomponentes) | Tests E2E ANTES de tocar código (Paso 1) |
| 2 | **Field mappings en 4 API resources** deben sincronizarse con backend | Eliminar mappings solo tras confirmar backend inglés |
| 3 | **Tipos derivados** (`FabricationDetail`, `MaterialInForm`, `PoolInForm`) propagan cambios | Migrar tipos base PRIMERO (Paso 2) |
| 4 | **Props drilling**: 18-22 props por subcomponente | Nuevos composables encapsulan lógica (Paso 3) |
| 5 | **Sin tests unitarios/E2E** actualmente | Playwright E2E obligatorio antes de FASE 2 |

### 10.4 Estrategia: Orden de Dependencias

```
┌─────────────────────────────────────────────────────────────┐
│  PASO 1: Tipos Base en Inglés                               │
│  types/form.ts, budget.ts, workOrder.ts, measurement.ts,    │
│  cash.ts → campos internos en inglés + aliases deprecated   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 2: Composables Nuevos                                 │
│  useFormState, useFormCalculations, useFormMaterials,       │
│  useFormClient, useFormCroquis, useFormActions,             │
│  useFormPdf, useEntityForm (facade composer)                │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 3: API Resources - Eliminar Mappings                  │
│  workOrders.ts, clients.ts, materials.ts, poolStock.ts      │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 4: Sub-componentes BudgetForm (6)                     │
│  Client, Specs, Items, Adicionales, Financial, Observations │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 5: Sub-componentes WorkOrderForm (6)                  │
│  Basic, Specs, ItemsGrid, Financial, Observations, Snapshot │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 6: Pages Principales                                  │
│  BudgetFormPage, WorkOrderFormPage, ClientFormPage,         │
│  MeasurementFormPage, MaterialFormPage                      │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 7: Componentes Caja/Órdenes/Presupuesto               │
│  17 componentes → rename + props en inglés                  │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 8: Limpieza Final                                     │
│  Eliminar 8 alias types/*, formatters.ts, types/index.ts    │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PASO 9: Verificación                                       │
│  tsc --noEmit && vite build + E2E tests + Smoke manual      │
└─────────────────────────────────────────────────────────────┘
```

### 10.5 Estimación Total: ~20-25 horas

| Fase | Horas | Riesgo |
|------|-------|--------|
| Tipos + Composables (Pasos 1-2) | 5-7 | 🔴 Core |
| API Resources (Paso 3) | 1-2 | 🟡 Sync backend |
| Formularios Budget/WorkOrder (Pasos 4-6) | 5-8 | 🔴 Mayor superficie |
| Componentes varios (Paso 7) | 2-3 | 🟡 Renombrado masivo |
| Limpieza + Verificación (Pasos 8-9) | 1-2 | 🟢 Bajo |

### 10.6 Criterios de Aceptación (Definition of Done)

- [ ] `npm run typecheck` → 0 errores TypeScript
- [ ] `npm run build` → Compilación exitosa
- [ ] Tests E2E Playwright → 6/6 pasando
- [ ] Smoke test manual: Login → Cliente → Presupuesto → Convertir a OT → Caja diaria → Cerrar caja → PDF Preview
- [ ] No quedan imports de `useEntityForm` legacy
- [ ] No quedan field mappings español→inglés en `api/resources/*.ts`
- [ ] No quedan tipos Spanish en `types/index.ts` exports
- [ ] Componentes caja/ordenes/presupuesto renombrados a inglés
- [ ] Constantes hardcoded movidas a `/references` API

---

## 10.7 Plan Detallado Paso a Paso

Cada paso describe archivos a modificar, cambios específicos y el estado esperado post-paso.

### 🔷 PASO 1: Migrar tipos base Spanish→English (3 archivos)

**Objetivo:** `client.ts`, `material.ts`, `poolStock.ts` deben tener campos en inglés para que el frontend hable el mismo idioma que la API. Sin esto, cualquier cambio posterior arrastra nombres Spanish.

#### 1A. `types/client.ts` — Renombrar campos

| Actual | API espera | Nuevo nombre |
|--------|-----------|--------------|
| `nombre` | `name` | `name` |
| `telefono` | `phone` | `phone` |
| `direccion` | `address` | `address` |
| `observaciones` | `notes` | `notes` |

Cambios:
- `Client`: `nombre→name`, `telefono→phone`, `direccion→address`, `observaciones→notes`
- `ClientFormData`: mismo rename
- `ClientHistory`: `total_presupuestos→total_budgets`, `total_ordenes→total_orders`, `total_comprado→total_purchased`, `ultima_orden→last_order_number`
- `ClientHistory.ordenes` array: `numero→number`

#### 1B. `types/material.ts` — Renombrar campos

| Actual | API espera | Nuevo nombre |
|--------|-----------|--------------|
| `nombre` | `name` | `name` |
| `categoria` | `category_id` | `categoryId` |
| `espesor_disponible` | `available_thickness` | `availableThickness` |
| `precio_m2` | `base_price` | `basePrice` |
| `precio_m2_usd` | `price_usd` | `priceUsd` |
| `moneda` | `currency` | `currency` |
| `proveedor` | `supplier` | `supplier` |
| `stock_disponible` | `stock_available` | `stockAvailable` |
| `observaciones` | `notes` | `notes` |

#### 1C. `types/poolStock.ts` — Renombrar campos

| Actual | API espera | Nuevo nombre |
|--------|-----------|--------------|
| `marca` | `brand` | `brand` |
| `modelo` | `model` | `model` |
| `descripcion` | `description` | `description` |
| `material` | `material` | `material` (optional, keep) |
| `cantidad` | `quantity` | `quantity` |
| `precio` | `price` | `price` |
| `precio_usd` | `price_usd` | `priceUsd` |
| `pileta_id` | `pool_id` | `poolId` |
| `tipo` | `type` | `type` |

#### 1D. Eliminar Spanish alias files (9 archivos)

Una vez que todos los tipos base están en inglés, los 9 alias files en `types/` ya no tienen sentido:
- `caja.ts`, `cliente.ts`, `configuracion.ts`, `medicion.ts`, `orden.ts`, `presupuesto.ts`, `presupuestoOnline.ts`, `stockPileta.ts`, `trabajoRealizado.ts`

Se eliminan. También se limpia `types/index.ts` para que solo exporte nombres English.

#### 1E. Actualizar imports en todo el codebase

Los siguientes archivos importan tipos Spanish y deben actualizarse:

| Archivo | Import actual | Nuevo import |
|---------|--------------|--------------|
| `hooks/useEntityForm.ts` | `Cliente`, `MaterialEnForm`, `PiletaEnForm`, `StockPileta` | `Client`, `MaterialInForm`, `PoolInForm`, `Pool` |
| `hooks/entityFormHelpers.ts` | `MaterialEnForm`, `PiletaEnForm`, `StockPileta`, `Material` | `MaterialInForm`, `PoolInForm`, `Pool`, `Material` |
| `pages/budgets/BudgetFormPage.tsx` | `PresupuestoPayload`, `MaterialEnForm`, `EntityFormState`, `EntityServices` | `BudgetPayload`, `MaterialInForm` |
| `pages/work-orders/WorkOrderFormPage.tsx` | `OrdenTrabajoPayload`, `EntityFormState`, `EntityServices`, `MaterialEnForm` | `WorkOrderPayload` |
| `components/presupuesto/OnlineItemsTable.tsx` | `StockPileta` | `Pool` |
| ... y todos los que usen los 9 alias eliminados |

**Total: ~15-20 archivos con cambios de import.**

---

### 🔷 PASO 2: Descomponer useEntityForm en 8 composables

**Objetivo:** Eliminar el monolito `useEntityForm.ts` (394 líneas, `@ts-nocheck`) y reemplazarlo por hooks pequeños y tipados que usen exclusivamente campos English.

#### 2A. Crear `hooks/useFormState.ts`

Hook base que maneja el estado del formulario.

```ts
// Estado inicial con campos English
const INITIAL_FORM_EN: EntityFormState = {
  number: '',
  clientName: '', clientPhone: '', address: '', email: '',
  date: new Date().toISOString().slice(0, 10),
  status: '',
  material: '', materialPriceM2: 0, color: '', thickness: '', finish: '', exchangeRate: 1,
  sink: '', cooktop: '',
  sketch: [],
  designObservations: '',
  fabricationDetails: [],
  poolId: '', poolImage: '', poolPrice: 0, poolCurrency: 'ARS',
  subtotal: 0, transport: 0, transportUsd: 0, total: 0,
  depositReceived: 0, depositCurrency: 'ARS', balanceDue: 0,
  paymentMethod: '', installments: 1, balancePaid: false, balancePaidAt: '',
  usdRate: 1000,
  subtotalUsd: 0, totalUsd: 0, depositUsd: 0, balanceDueUsd: 0,
  deliveryDate: '',
  clientSignature: null, approvedAt: '',
  notes: '', importantObservations: '',
  budgetedDetails: [],
  materials: [],
  pools: [],
  workOrderNumber: null,
  discountPercentage: 0, discountFixedAmount: 0,
  surchargeArs: 0, surchargeUsd: 0, surchargePct: 0,
};
```

Funciones:
- `useFormState(entityType, defaultEstado, id, services)` → `{ form, setForm, loading, saving, setSaving, readOnly, isEdit }`
- `update(field: keyof EntityFormState, value: unknown)` → mutación segura
- `resetForm()` → vuelve a INITIAL_FORM_EN
- `loadEntity(id)` → GET del backend + mapeo a campos English
- Carga referencias: `materiales`, `piletas`, `clientes`, `logoUrl`, `clientesFiltrados`

#### 2B. Crear `hooks/useFormCalculations.ts`

Lógica de cálculos financieros (extraída de PresupuestoPanel + useEntityForm).

```ts
export function useFormCalculations(form: EntityFormState, setForm: Dispatch<SetStateAction<EntityFormState>>) {
  const calculateTotals = () => { ... }; // recalculate subtotal, transport, total, usd variants
  const handleTransportChange = (value: string, source: 'ars' | 'usd') => { ... };
  const handleDepositCurrencyChange = (moneda: string) => { ... };
  const handleDepositAmountChange = (value: string) => { ... };
  const handleUsdRateChange = (value: string) => { ... };
  const getMaterialM2 = (mat: MaterialInForm): number => { ... };
  const getFabricationTotal = (): number => { ... };
}
```

#### 2C. Crear `hooks/useFormMaterials.ts`

Manejo de materiales en el formulario.

```ts
export function useFormMaterials(form: EntityFormState, setForm: ..., materiales: Material[]) {
  const addMaterial = (name: string) => { ... }; // busca en materiales[], crea MaterialInForm con campos English
  const removeMaterial = (idx: number) => { ... };
  const updateMaterial = (idx: number, field: string, value: unknown) => { ... };
  const getMainMaterials = () => MaterialInForm[];
  const getAlternativeMaterials = () => MaterialInForm[];
}
```

**Importante:** `addMaterial` debe crear objetos con campos English:
```ts
{
  name: mat.name, category: mat.categoryId || '', color: mat.color || '',
  priceM2: mat.basePrice || 0, priceM2Usd: mat.priceUsd || 0,
  currency: mat.currency || 'ARS', quantity: 1,
  m2Used: 0, m2Budgeted: 0, length: 0, width: 0, isAlternative: false,
}
```

#### 2D. Crear `hooks/useFormPools.ts`

Análogo a useFormMaterials pero para piletas.

```ts
export function useFormPools(form: EntityFormState, setForm: ..., pools: Pool[]) {
  const addPool = (poolId: string) => { ... };
  const removePool = (idx: number) => { ... };
  const updatePool = (idx: number, field: string, value: unknown) => { ... };
}
```

`addPool` crea objetos:
```ts
{
  poolId: pt.id, brand: pt.brand, model: pt.model,
  price: pt.price || 0, currency: 'ARS', image: '', quantity: 1,
}
```

#### 2E. Crear `hooks/useFormClient.ts`

```ts
export function useFormClient(clients: Client[], form, update) {
  const handleClientSelect = (c: Record<string, unknown>) => { ... };
  // setea: clientName=c.name, clientPhone=c.phone, address=c.address, email=c.email
}
```

#### 2F. Crear `hooks/useFormCroquis.ts`

```ts
export function useFormCroquis(form, setForm) {
  const [showCroquis, setShowCroquis] = useState(true);
  const toggleCroquis = () => setShowCroquis(v => !v);
}
```

#### 2G. Crear `hooks/useFormActions.ts`

```ts
export function useFormActions(entityType, services, form, buildPayload, id, navigate) {
  const handleSubmit = async (e?: React.FormEvent) => { ... };
  const handleDelete = async () => { ... };
  const handlePrint = () => { ... };
  const handleStatusChange = async (newStatus: string) => { ... };
}
```

#### 2H. Crear `hooks/useFormPdf.ts`

```ts
export function useFormPdf() {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const previewPdf = async (buildPayload, previewFn) => { ... };
  const closePdfPreview = () => { ... };
}
```

#### 2I. Facade: Crear `hooks/useBudgetForm.ts` y `hooks/useWorkOrderForm.ts`

Componen los 8 hooks anteriores en una API unificada (lo que antes hacía `useEntityForm`):

```ts
export function useBudgetForm(id, navigate) {
  const state = useFormState('presupuesto', 'PENDING', id, presupuestoServices);
  const calculations = useFormCalculations(state.form, state.setForm);
  const materials = useFormMaterials(state.form, state.setForm, state.materiales);
  const pools = useFormPools(state.form, state.setForm, state.piletas);
  const client = useFormClient(state.clientes, state.form, state.update);
  const croquis = useFormCroquis(state.form, state.setForm);
  const actions = useFormActions('presupuesto', presupuestoServices, state.form, buildPayload, id, navigate);
  const pdf = useFormPdf();

  const buildPayload = () => ({ ... }); // direct English→English, SIN mapping

  return {
    form: state.form, loading: state.loading, saving: state.saving,
    materiales: state.materiales, piletas: state.piletas,
    ...calculations, ...materials, ...pools, ...client, ...croquis, ...actions, ...pdf,
  };
}
```

#### 2J. Eliminar `hooks/useEntityForm.ts` y `hooks/entityFormHelpers.ts`

**Precondición:** BudgetFormPage, WorkOrderFormPage, y todos los subcomponentes deben usar los nuevos hooks.

`entityFormHelpers.ts` se reemplaza por:
- `INITIAL_FORM` → dentro de `useFormState.ts`
- `buildPayload` → dentro de `useBudgetForm.ts` / `useWorkOrderForm.ts`
- `mapApiToForm` → dentro de `useFormState.ts`
- `addMaterialToList` → dentro de `useFormMaterials.ts`
- `addPiletaToList` → dentro de `useFormPools.ts`

---

### 🔷 PASO 3: Eliminar Mappings en API Resources (4 archivos)

**Objetivo:** Los 4 resources con field mappings español→inglés deben eliminarlos porque ahora el frontend usa campos English todo el tiempo.

#### 3A. `api/resources/clients.ts`

```ts
// ANTES
export function mapClientToApi(data: Record<string, unknown>): Record<string, unknown> {
  return {
    name: data.nombre,
    phone: data.telefono,
    address: data.direccion,
    notes: data.observaciones,
  };
}
// DESPUÉS — ELIMINAR mapClientToApi

export const getClients = (params?) => http.get('/clients', { params });
export const getClient = (id) => http.get(`/clients/${id}`);
export const createClient = (data) => http.post('/clients', data);
export const updateClient = (id, data) => http.put(`/clients/${id}`, data);
export const deleteClient = (id) => http.delete(`/clients/${id}`);
```

#### 3B. `api/resources/materials.ts`

Eliminar `mapMaterialToApi`. Los endpoints ya reciben directamente `name`, `category_id`, `base_price`, etc.

#### 3C. `api/resources/poolStock.ts`

Eliminar `mapPoolToApi` y `mapMovementToApi`. Los endpoints ya reciben `brand`, `model`, `quantity`, `price`, `type`, etc.

#### 3D. `api/resources/workOrders.ts`

Eliminar `mapWorkOrderToApi`, `WO_FIELD_MAP`, `WO_NESTED_MAPS`, `mapWorkOrderStatusValue`.

Work orders ahora reciben datos English directo. El `previewWorkOrderPdf` debe pasar el payload sin mapear.

#### 3E. `api/resources/budgets.ts`

Ya no tiene `mapBudgetToApi` (nunca existió), pero tiene `mapBudgetStatusToApi`. Verificar si se usa y si se puede reemplazar por valores English directos (el hook `useFormState` ya maneja estados English).

---

### 🔷 PASO 4: Sub-componentes BudgetForm — Migrar a campos English (6 archivos)

Cada subcomponente accede a `form.campo_espanol` y debe migrar a `form.campoIngles`.

#### 4A. `pages/budgets/BudgetFormClient.tsx`

Wrapper que pasa props a `ClienteSection`. Se reemplaza por pase directo con nombres English:
- `form.clientName` en vez de `form.cliente_nombre`
- `form.clientPhone` en vez de `form.cliente_telefono_orden`
- `form.address` en vez de `form.domicilio`

#### 4B. `pages/budgets/BudgetFormSpecs.tsx`

(No leído, pero esperado): migrar `material_precio_m2`→`materialPriceM2`, `color_tipo`→`color`, `espesor`→`thickness`, `acabado`→`finish`, `bacha`→`sink`, `anafe`→`cooktop`, `observaciones_diseno`→`designObservations`.

#### 4C. `pages/budgets/BudgetFormItems.tsx`

(No leído): migrar `detalles_fabricacion`→`fabricationDetails`, conceptos fabricación.

#### 4D. `pages/budgets/BudgetFormAdicionales.tsx`

(No leído): migrar `pileta_id`→`poolId`, `pileta_precio`→`poolPrice`, `pileta_moneda`→`poolCurrency`.

#### 4E. `pages/budgets/BudgetFormFinancial.tsx`

Wrapper de PresupuestoPanel. Migrar props:
- `handleTrasladoChange`→`handleTransportChange`
- `handleSenaMonedaChange`→`handleDepositCurrencyChange`
- `handleSenaMontoChange`→`handleDepositAmountChange`
- `handleDolarDiaChange`→`handleUsdRateChange`

#### 4F. `pages/budgets/BudgetFormObservations.tsx`

(No leído): migrar `observaciones`→`notes`, `observaciones_importantes`→`importantObservations`.

---

### 🔷 PASO 5: Sub-componentes WorkOrderForm — Migrar a campos English (6 archivos)

#### 5A. `pages/work-orders/WorkOrderFormBasic.tsx`

(No leído): mismo patrón que BudgetFormClient.

#### 5B. `pages/work-orders/WorkOrderFormSpecs.tsx`

(No leído): mismo patrón que BudgetFormSpecs.

#### 5C. `pages/work-orders/WorkOrderFormItemsGrid.tsx`

(No leído): mismo patrón que BudgetFormItems.

#### 5D. `pages/work-orders/WorkOrderFormFinancial.tsx`

(No leído): wrapper de PresupuestoPanel. Mismos cambios que 4E.

#### 5E. `pages/work-orders/WorkOrderFormObservations.tsx`

(No leído): mismo patrón que 4F.

#### 5F. `pages/work-orders/WorkOrderFormSnapshot.tsx`

(No leído, snapshot es un campo `Record<string, unknown>`). Verificar que no tenga campos Spanish hardcoded.

---

### 🔷 PASO 6: Pages Principales (5 archivos)

#### 6A. `pages/budgets/BudgetFormPage.tsx`

Migrar accesos a `form.*`:
| Actual | Nuevo |
|--------|-------|
| `form.numero` | `form.number` |
| `form.cliente_nombre` | `form.clientName` |
| `form.cliente_telefono_orden` | `form.clientPhone` |
| `form.estado` | `form.status` |
| `form.forma_pago` | `form.paymentMethod` |
| `form.dolar_dia` | `form.usdRate` |
| `form.detalles_fabricacion` | `form.fabricationDetails` |
| `form.piletas` | `form.pools` |
| `form.materiales` | `form.materials` |
| `form.saldo_pagado` | `form.balancePaid` |
| `form.sena_recibida` | `form.depositReceived` |
| `form.sena_moneda` | `form.depositCurrency` |
| `form.saldo_pendiente` | `form.balanceDue` |
| `form.sena_usd` | `form.depositUsd` |
| `form.saldo_pendiente_usd` | `form.balanceDueUsd` |
| `form.fecha_pago_saldo` | `form.balancePaidAt` |
| `form.fecha_entrega` | `form.deliveryDate` |
| `form.croquis` | `form.sketch` |
| `form.descuento_porcentaje` | `form.discountPercentage` |
| `form.descuento_monto_fijo` | `form.discountFixedAmount` |
| `form.traslado` | `form.transport` |
| `form.total` | `form.total` (keep) |
| `form.total_usd` | `form.totalUsd` |
| `form.subtotal` | `form.subtotal` (keep) |
| `form.subtotal_usd` | `form.subtotalUsd` |
| `form.traslado_usd` | `form.transportUsd` |
| `form.recargo_pct` | `form.surchargePct` |
| `form.recargo_ars` | `form.surchargeArs` |
| `form.recargo_usd` | `form.surchargeUsd` |
| `form.cuotas` | `form.installments` |
| `form.firma_cliente` | `form.clientSignature` |
| `form.fecha_aprobacion` | `form.approvedAt` |
| `form.observaciones` | `form.notes` |
| `form.observaciones_importantes` | `form.importantObservations` |
| `form.detalles_presupuestados` | `form.budgetedDetails` |
| `form.pileta_id` | `form.poolId` |
| `form.pileta_precio` | `form.poolPrice` |
| `form.pileta_moneda` | `form.poolCurrency` |
| `form.pileta_imagen` | `form.poolImage` |
| `form.domicilio` | `form.address` |
| `form.email` | `form.email` (keep) |
| `form.fecha` | `form.date` |
| `form.orden_trabajo_numero` | `form.workOrderNumber` |

Cambiar handlers:
- `update('fecha', ...)` → `update('date', ...)`
- `update('cliente_nombre', ...)` → `update('clientName', ...)`
- `update('firma_cliente', ...)` → `update('clientSignature', ...)` (en AprobacionSection)
- `update('fecha_aprobacion', ...)` → `update('approvedAt', ...)`

Cambiar payload:
```ts
// ANTES
const payload: Record<string, unknown> = {
  saldo_pagado: nuevo,
  fecha_pago_saldo: nuevo ? hoy : null,
  sena_recibida: Number(form.total),
  sena_moneda: 'ARS',
  saldo_pendiente: 0,
};

// DESPUÉS
const payload: Record<string, unknown> = {
  balancePaid: nuevo,
  balancePaidAt: nuevo ? hoy : null,
  depositReceived: Number(form.total),
  depositCurrency: 'ARS',
  balanceDue: 0,
};
```

#### 6B. `pages/work-orders/WorkOrderFormPage.tsx`

Mismos cambios que 6A + migrar estados:
- `form.estado === 'MEDICION'` → `form.status === 'MEASUREMENT'`
- `'TALLER'` → `'WORKSHOP'`
- `'TERMINADA'` → `'FINISHED'`
- `'ENTREGADA'` → `'DELIVERED'`

#### 6C. `pages/clients/ClientFormPage.tsx`

(No leído): migrar `nombre→name`, `telefono→phone`, `direccion→address`, `observaciones→notes`.

#### 6D. `pages/materials/MaterialFormPage.tsx`

(No leído): migrar `nombre→name`, `categoria→categoryId`, `espesor_disponible→availableThickness`, `precio_m2→basePrice`, `precio_m2_usd→priceUsd`, `moneda→currency`, `proveedor→supplier`, `stock_disponible→stockAvailable`, `observaciones→notes`.

#### 6E. `pages/measurements/MeasurementFormPage.tsx`

(No leído): migrar si tiene campos Spanish.

---

### 🔷 PASO 7: Componentes Caja/Órdenes/Presupuesto (17 componentes)

#### 7A. Renombrar componentes de `components/caja/`

| Actual | Nuevo nombre | Archivo |
|--------|-------------|---------|
| `CajaTotalCards` | `CashTotalCards` | `CashTotalCards.tsx` |
| `IngresosTable` | `IncomesTable` | `IncomesTable.tsx` |
| `EgresosTable` | `ExpensesTable` | `ExpensesTable.tsx` |
| `IngresoModal` | `IncomeModal` | `IncomeModal.tsx` |
| `EgresoModal` | `ExpenseModal` | `ExpenseModal.tsx` |
| `CerrarCajaModal` | `CloseCashModal` | `CloseCashModal.tsx` |
| `SaldoAnteriorCard` | `PreviousBalanceCard` | `PreviousBalanceCard.tsx` |

Los nombres de archivo cambian, los exports dentro también.

#### 7B. Migrar campos English en `IncomeModal.tsx` (ex IngresoModal)

Estado interno:
| Actual | Nuevo |
|--------|-------|
| `monto` | `amount` |
| `forma_pago` | `paymentMethod` |
| `estado_carpeta` | `folderStatus` |
| `orden_numero` | `orderNumber` |
| `cliente_nombre` | `clientName` |
| `orden_id` | `orderId` |
| `orden_total` | `orderTotal` |

El submit ya envía English (`type: 'INCOME'`, `paymentMethod`, etc.), pero el estado interno debe migrarse para consistencia y para que el reset form funcione correctamente.

#### 7C. Migrar campos English en `ExpenseModal.tsx` (ex EgresoModal)

| Actual | Nuevo |
|--------|-------|
| `concepto` | `description` |
| `monto` | `amount` |
| `tipo_egreso` | `expenseType` |

#### 7D. Migrar `cajaUtils.ts`

- `ESTADO_CARPETA_MAP` ya usa keys English. Renombrar variable a `FOLDER_STATUS_MAP`.
- Asegurar que estén todos los status de WorkOrder: `MEASUREMENT`, `WORKSHOP`, `FINISHED`, `DELIVERED`, `CANCELLED`.

#### 7E. Renombrar componentes de `components/ordenes/`

| Actual | Nuevo nombre | Archivo |
|--------|-------------|---------|
| `AprobacionSection` | `ApprovalSection` | `ApprovalSection.tsx` |
| `ObservacionesSection` | `ObservationsSection` | `ObservationsSection.tsx` |
| `ClienteSection` | `ClientSection` | `ClientSection.tsx` |

#### 7F. Migrar campos English en `ApprovalSection.tsx` (ex AprobacionSection)

| Actual | Nuevo |
|--------|-------|
| `firma_cliente` | `clientSignature` |
| `fecha_aprobacion` | `approvedAt` |

#### 7G. Migrar campos English en `ObservationsSection.tsx`

| Actual | Nuevo |
|--------|-------|
| `observaciones_importantes` | `importantObservations` |

#### 7H. Migrar `ClienteSection.tsx` → `ClientSection.tsx`

| Actual | Nuevo |
|--------|-------|
| `form.fecha` | `form.date` |
| `form.cliente_nombre` | `form.clientName` |
| `form.cliente_telefono_orden` | `form.clientPhone` |
| `form.email` | `form.email` (keep) |
| `form.domicilio` | `form.address` |
| `update('fecha', ...)` | `update('date', ...)` |
| `update('cliente_nombre', ...)` | `update('clientName', ...)` |
| `update('cliente_telefono_orden', ...)` | `update('clientPhone', ...)` |
| `update('domicilio', ...)` | `update('address', ...)` |

#### 7I. Renombrar componentes de `components/presupuesto/`

| Actual | Nuevo nombre | Archivo |
|--------|-------------|---------|
| `PresupuestoPanel` | `BudgetPanel` | `BudgetPanel.tsx` |
| `PresupuestoOnlineHeader` | `OnlineBudgetHeader` | `OnlineBudgetHeader.tsx` |
| `PresupuestoOnlineFooter` | `OnlineBudgetFooter` | `OnlineBudgetFooter.tsx` |
| `PresupuestoOnlineTotals` | `OnlineBudgetTotals` | `OnlineBudgetTotals.tsx` |
| `OpcionesCotizacionGrid` | `QuoteOptionsGrid` | `QuoteOptionsGrid.tsx` |
| `FabricacionTable` | `FabricationTable` | `FabricationTable.tsx` |
| `OnlineItemsTable` | `OnlineItemsTable` | keep |

#### 7J. Migrar `BudgetPanel.tsx` (ex PresupuestoPanel)

Este es el componente más grande (348 líneas, `@ts-nocheck`). Migrar todos los accesos a `form.*`:

| Actual | Nuevo |
|--------|-------|
| `form.dolar_dia` | `form.usdRate` |
| `form.detalles_fabricacion` | `form.fabricationDetails` |
| `form.materiales` | `form.materials` |
| `form.piletas` | `form.pools` |
| `form.traslado` | `form.transport` |
| `form.traslado_usd` | `form.transportUsd` |
| `form.sena_recibida` | `form.depositReceived` |
| `form.sena_moneda` | `form.depositCurrency` |
| `form.saldo_pendiente` | `form.balanceDue` |
| `form.forma_pago` | `form.paymentMethod` |
| `form.fecha_entrega` | `form.deliveryDate` |
| `form.descuento_porcentaje` | `form.discountPercentage` |
| `form.descuento_monto_fijo` | `form.discountFixedAmount` |
| `form.saldo_pagado` | `form.balancePaid` |
| `form.fecha_pago_saldo` | `form.balancePaidAt` |
| `form.cuotas` | `form.installments` |
| `form.recargo_ars` | `form.surchargeArs` |
| `form.recargo_pct` | `form.surchargePct` |
| `form.total` | `form.total` (keep) |
| `form.total_usd` | `form.totalUsd` |
| `form.sena_usd` | `form.depositUsd` |
| `form.saldo_pendiente_usd` | `form.balanceDueUsd` |
| `form.subtotal_usd` | `form.subtotalUsd` |

Accesos a items anidados:
- `m.concepto` → `m.concept` (dentro de fabricationDetails)
- `m.detalle` → `m.detail`
- `m.material` → `m.material` (keep)
- `m.precio` → `m.price`
- `m.cantidad` → `m.quantity`
- `m.moneda` → `m.currency`
- `m.largo` → `m.length`
- `m.ancho` → `m.width`
- `m.m2` → `m.m2` (keep)
- `m.nombre` → `m.name` (MaterialInForm)
- `m.precio_m2` → `m.priceM2` (MaterialInForm)
- `m.precio_m2_usd` → `m.priceM2Usd` (MaterialInForm)
- `m.es_alternativa` → `m.isAlternative` (MaterialInForm)
- `m.marca` → `m.brand` (PoolInForm)
- `m.modelo` → `m.model` (PoolInForm)

#### 7K. Migrar `Formas de pago` en BudgetPanel de Spanish a English

```tsx
// ANTES
<option value="EFECTIVO">EFECTIVO</option>
<option value="TRANSFERENCIA BANCARIA">TRANSFERENCIA BANCARIA</option>
<option value="TARJETA DE DÉBITO">TARJETA DE DÉBITO</option>
<option value="TARJETA DE CRÉDITO">TARJETA DE CRÉDITO</option>

// DESPUÉS
<option value="CASH">Efectivo</option>
<option value="TRANSFER">Transferencia</option>
<option value="DEBIT_CARD">Tarjeta de Débito</option>
<option value="CREDIT_CARD">Tarjeta de Crédito</option>
```

También en BudgetFormPage:
```ts
// ANTES
if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.forma_pago)) {
// DESPUÉS
if (['CREDIT_CARD', 'DEBIT_CARD'].includes(form.paymentMethod)) {
```

Y:
```ts
// ANTES
if (form.forma_pago === 'EFECTIVO') {
// DESPUÉS
if (form.paymentMethod === 'CASH') {
```

#### 7L. Migrar `EstadoBadge` → `StatusBadge`

El componente ya existe en `components/ui/EstadoBadge/`. Se renombra a `StatusBadge`:
- Archivo: `StatusBadge.tsx`
- Props: `estado` → `status`
- Se actualizan todos los imports (BudgetFormPage, WorkOrderFormPage, etc.)
- El folder `EstadoBadge/` se elimina o renombra a `StatusBadge/`

---

### 🔷 PASO 8: Limpieza Final

#### 8A. Eliminar alias types (9 archivos)

Una vez que ningún archivo importa de:
- `types/caja.ts`, `types/cliente.ts`, `types/configuracion.ts`, `types/medicion.ts`
- `types/orden.ts`, `types/presupuesto.ts`, `types/presupuestoOnline.ts`
- `types/stockPileta.ts`, `types/trabajoRealizado.ts`

Se eliminan físicamente.

#### 8B. Limpiar `types/index.ts`

Eliminar re-exports Spanish. Queda solo English.

#### 8C. Migrar `utils/formatters.ts`

Reemplazar constantes hardcoded por llamadas a API:
```ts
// ANTES
export const estadosOrden: string[] = ['MEDICION', 'TALLER', 'TERMINADA', 'ENTREGADA'];

// DESPUÉS — quitar. Obtener de:
fetch('/api/v1/references/work-order-statuses')
```

Decisión: dejar `formatCurrency`, `formatDate`, `formatInputDate` y `CONCEPTOS_M2` y `conceptosFabricacion` si no hay un endpoint de referencias para ellos. Los arrays de estados se obtienen dinámicamente.

#### 8D. Migrar `utils/translate.ts`

Completar entradas faltantes:
```ts
'TRANSFER': 'Transferencia',
'DEBIT_CARD': 'Tarjeta de Débito',
'CHECK': 'Cheque',
'MIXED': 'Mixto',
'EXPENSE': 'Egreso',
'INCOME': 'Ingreso',
'GENERAL': 'General',
'BANK_TRANSFER': 'Transferencia',
```

#### 8E. Migrar `BudgetFormPage.tsx` handlers que usan status string

```ts
// ANTES
if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.forma_pago)) {
  aprobado.sena_recibida = Number(form.total);
  aprobado.saldo_pendiente = 0;
  aprobado.saldo_pagado = true;
}

// DESPUÉS
if (['CREDIT_CARD', 'DEBIT_CARD'].includes(form.paymentMethod)) {
  aprobado.depositReceived = Number(form.total);
  aprobado.balanceDue = 0;
  aprobado.balancePaid = true;
}
```

---

### 🔷 PASO 9: Verificación

#### 9A. TypeScript check
```bash
cd afamar-frontend
npx tsc --noEmit
```

Resolver todos los errores de tipado.

#### 9B. Build
```bash
npm run build
```

#### 9C. E2E tests
```bash
npx playwright test
```

#### 9D. Smoke test manual
1. Login → ok
2. Crear cliente → ok
3. Crear presupuesto con todos los campos → ok
4. Vista previa PDF → ok
5. Convertir a OT → ok
6. Caja diaria → agregar ingreso y egreso → ok
7. Cerrar caja → ok
8. Verificar que no hay errores de "campo no encontrado" en consola

---

## 10.8 Mapa de Flujo de Datos (Antes vs. Después)

### ANTES (con mappings)

```
Form (Spanish fields)
  → entityFormHelpers.buildPayload()   ← mapea Spanish→English keys
  → api/resources/workOrders.ts        ← WO_FIELD_MAP re-mapea
  → API endpoint (/api/v1/work-orders) ← recibe English

API response (English)
  → api/resources/workOrders.ts        ← sin mapeo inverso? 
  → entityFormHelpers.mapApiToForm()   ← mapea English→Spanish keys
  → Form (Spanish fields)              ← vuelve a Spanish
```

**Problema:** Doble mapping, inconsistencias, el payload que viaja no es directamente lo que la API espera.

### DESPUÉS (directo)

```
Form (English fields)
  → useBudgetForm.buildPayload()       ← pase directo (spread)
  → API endpoint (/api/v1/work-orders) ← recibe English exacto

API response (English)
  → useFormState.loadEntity()          ← pase directo
  → Form (English fields)              ← mismo idioma
```

**Beneficio:** Un solo formato en toda la cadena. Tipado fuerte de TypeScript valida contra los schemas de la API.

---

## 10.9 Tabla de Referencia Rápida: Form → API

| Campo Form (English) | API Budget | API WorkOrder | API Client | API Material | API PoolStock |
|---|---|---|---|---|---|
| `clientName` | `client_name` | `client_name` | `name` | — | — |
| `clientPhone` | `client_phone` | `client_phone` | `phone` | — | — |
| `address` | `client_address` | `client_address` | `address` | — | — |
| `email` | `client_email` | `client_email` | `email` | — | — |
| `date` | `date` | `date` | — | — | — |
| `status` | `status` | `status` | — | — | — |
| `material` | `material` | `material` | — | `name` | — |
| `materialPriceM2` | `material_price_m2` | `material_price_m2` | — | `base_price` | — |
| `color` | `color` | `color` | — | `color` | — |
| `thickness` | `thickness` | `thickness` | — | `available_thickness` | — |
| `finish` | `finish` | `finish` | — | — | — |
| `exchangeRate` / `usdRate` | `usd_rate` | `usd_rate` | — | — | — |
| `sink` | `bacha` | `bacha` | — | — | — |
| `cooktop` | `anafe` | `anafe` | — | — | — |
| `sketch` | `sketch_elements` | — | — | — | — |
| `designObservations` | `design_observations` | `design_observations` | — | — | — |
| `fabricationDetails` | `fabrication_details` | `fabrication_details` | — | — | — |
| `poolId` | `pool_id` | `pool_id` | — | — | — |
| `poolImage` | `pool_image` | `pool_image` | — | — | — |
| `poolPrice` | `pool_price` | `pool_price` | — | — | `price` |
| `poolCurrency` | `pool_currency` | `pool_currency` | — | — | — |
| `materials` | `materials_data` | `materials_data` | — | — | — |
| `pools` | `pools_data` | `pools_data` | — | — | — |
| `subtotal` | `subtotal` | `subtotal` | — | — | — |
| `transport` | `transport` | `transport` | — | — | — |
| `total` | `total` | `total` | — | — | — |
| `depositReceived` | `deposit_received` | `deposit_received` | — | — | — |
| `depositCurrency` | `deposit_currency` | `deposit_currency` | — | — | — |
| `balanceDue` | `balance_due` | `balance_due` | — | — | — |
| `paymentMethod` | `payment_method` | `payment_method` | — | — | — |
| `installments` | `installments` | `installments` | — | — | — |
| `balancePaid` | `balance_paid` | `balance_paid` | — | — | — |
| `balancePaidAt` | `balance_paid_at` | `balance_paid_at` | — | — | — |
| `subtotalUsd` | `subtotal_usd` | `subtotal_usd` | — | — | — |
| `transportUsd` | `transport_usd` | `transport_usd` | — | — | — |
| `totalUsd` | `total_usd` | `total_usd` | — | — | — |
| `depositUsd` | `deposit_usd` | `deposit_usd` | — | — | — |
| `balanceDueUsd` | `balance_due_usd` | `balance_due_usd` | — | — | — |
| `deliveryDate` | `delivery_date` | `delivery_date` | — | — | — |
| `clientSignature` | `digital_signature` | `digital_signature` | — | — | — |
| `approvedAt` | `signed_at` | `signed_at` | — | — | — |
| `notes` | `notes` | `notes` | `notes` | `notes` | — |
| `importantObservations` | `important_observations` | `important_observations` | — | — | — |
| `discountPercentage` | `discount_percentage` | `discount_percentage` | — | — | — |
| `discountFixedAmount` | `discount_fixed_amount` | `discount_fixed_amount` | — | — | — |
| `surchargeArs` | — | — | — | — | — |
| `surchargeUsd` | — | — | — | — | — |
| `surchargePct` | — | — | — | — | — |
| `brand` (Pool) | — | — | — | — | `brand` |
| `model` (Pool) | — | — | — | — | `model` |
| `quantity` (Pool/Material) | — | — | — | `stock_available` | `quantity` |
| `basePrice` (Material) | — | — | — | `base_price` | — |
| `priceUsd` (Material) | — | — | — | `price_usd` | — |
| `supplier` (Material) | — | — | — | `supplier` | — |
| `stockAvailable` (Material) | — | — | — | `stock_available` | — |
| `categoryId` (Material) | — | — | — | `category_id` | — |
| `availableThickness` (Material) | — | — | — | `available_thickness` | — |

---

## 10.10 Estrategia de Testing

### E2E Playwright (antes de empezar)

```ts
// tests/budget-flow.spec.ts
test('crear presupuesto con todos los campos', async () => {
  // Login
  // Llenar: cliente, material, medidas, croquis, financial
  // Guardar
  // Verificar que en el listado aparece
});

test('convertir presupuesto a OT', async () => {
  // Crear presupuesto → Aprobar → Convertir a OT
  // Verificar OT creada con mismos datos
});

test('caja diaria - agregar ingreso y egreso', async () => {
  // Navegar a caja
  // Agregar ingreso vinculado a OT
  // Agregar egreso
  // Verificar totales
});
```

### Test por paso

Cada paso debe verificar que `npm run build` no rompe. Usar `npx tsc --noEmit` como gate.

---

## 10.11 Checklist de Archivos por Paso

| Paso | Archivos | Archivos |
|------|----------|----------|
| **1A** | `types/client.ts` | 1 |
| **1B** | `types/material.ts` | 1 |
| **1C** | `types/poolStock.ts` | 1 |
| **1D** | `types/caja.ts`, `cliente.ts`, `configuracion.ts`, `medicion.ts`, `orden.ts`, `presupuesto.ts`, `presupuestoOnline.ts`, `stockPileta.ts`, `trabajoRealizado.ts`, `index.ts` | 10 |
| **1E** | ~20 archivos con imports | 20 |
| **2A-2I** | `hooks/useFormState.ts`, `useFormCalculations.ts`, `useFormMaterials.ts`, `useFormPools.ts`, `useFormClient.ts`, `useFormCroquis.ts`, `useFormActions.ts`, `useFormPdf.ts`, `useBudgetForm.ts`, `useWorkOrderForm.ts` | 10 (nuevos) |
| **2J** | `hooks/useEntityForm.ts`, `hooks/entityFormHelpers.ts` | 2 (eliminar) |
| **3A-3E** | `api/resources/clients.ts`, `materials.ts`, `poolStock.ts`, `workOrders.ts`, `budgets.ts` | 5 |
| **4A-4F** | `pages/budgets/BudgetFormClient.tsx`, `BudgetFormSpecs.tsx`, `BudgetFormItems.tsx`, `BudgetFormAdicionales.tsx`, `BudgetFormFinancial.tsx`, `BudgetFormObservations.tsx` | 6 |
| **5A-5F** | `pages/work-orders/WorkOrderFormBasic.tsx`, `WorkOrderFormSpecs.tsx`, `WorkOrderFormItemsGrid.tsx`, `WorkOrderFormFinancial.tsx`, `WorkOrderFormObservations.tsx`, `WorkOrderFormSnapshot.tsx` | 6 |
| **6A-6E** | `pages/budgets/BudgetFormPage.tsx`, `pages/work-orders/WorkOrderFormPage.tsx`, `pages/clients/ClientFormPage.tsx`, `pages/materials/MaterialFormPage.tsx`, `pages/measurements/MeasurementFormPage.tsx` | 5 |
| **7A** | `components/caja/CashTotalCards.tsx`, `IncomesTable.tsx`, `ExpensesTable.tsx`, `IncomeModal.tsx`, `ExpenseModal.tsx`, `CloseCashModal.tsx`, `PreviousBalanceCard.tsx` | 7 (renombrar) |
| **7B-7C** | `IncomeModal.tsx`, `ExpenseModal.tsx` (migrar internal state) | 2 |
| **7D** | `cajaUtils.ts` | 1 |
| **7E** | `components/ordenes/ApprovalSection.tsx`, `ObservationsSection.tsx`, `ClientSection.tsx` | 3 (renombrar) |
| **7F-7H** | Migrar props en los 3 | 3 |
| **7I** | `components/presupuesto/BudgetPanel.tsx`, `OnlineBudgetHeader.tsx`, `OnlineBudgetFooter.tsx`, `OnlineBudgetTotals.tsx`, `QuoteOptionsGrid.tsx`, `FabricationTable.tsx` | 6 (renombrar) |
| **7J** | `BudgetPanel.tsx` (migrar ~50 accesos a form.*) | 1 |
| **7K** | Formas de pago en BudgetPanel + BudgetFormPage | 2 |
| **7L** | `components/ui/StatusBadge.tsx`, imports | ~5 |
| **8A-8E** | Limpieza final | ~15 |

**Total estimado: ~95 archivos tocados** (incluyendo renombres y imports).

---

## 10.12 Mapa de Dependencias de Archivos

```
                    types/client.ts
                    types/material.ts
                    types/poolStock.ts
                         │
                         ▼
              hooks/useFormState.ts  ──── api/resources/*.ts
              hooks/useFormMaterials.ts       (sin mappings)
              hooks/useFormPools.ts
              hooks/useFormClient.ts
              hooks/useFormCalculations.ts
              hooks/useFormCroquis.ts
              hooks/useFormActions.ts
              hooks/useFormPdf.ts
                         │
              ┌──────────┴──────────┐
              ▼                    ▼
    hooks/useBudgetForm.ts   hooks/useWorkOrderForm.ts
              │                    │
              ▼                    ▼
    pages/budgets/*          pages/work-orders/*
    BudgetFormClient         WorkOrderFormBasic
    BudgetFormSpecs          WorkOrderFormSpecs
    ...                      ...
              │                    │
              └──────────┬──────────┘
                         ▼
              components/presupuesto/*
              components/ordenes/*
              components/caja/*
              components/ui/*
```

---

## 10.13 Riesgos y Contingencias por Paso

| Paso | Riesgo | Contingencia |
|------|--------|-------------|
| **1** | Renombrar tipos sin actualizar todos los imports rompe el build | Hacer rename+update imports en el mismo commit. Correr `tsc --noEmit` después de cada archivo. |
| **2** | `useEntityForm` es grande y frágil | NO refactorizar lógica mientras se extrae. Cada nuevo composable debe ser una copia textual de la lógica existente pero con nombres English. |
| **3** | Eliminar mappings puede cambiar datos que envía el frontend | Verificar con un diff de `buildPayload` antes/después. El payload debe ser idéntico en estructura (solo cambian nombres de variables internas). |
| **4-5** | Subcomponentes con props drilling | Los nuevos composables se pasan como hooks en la page, no como props. Los subcomponentes reciben solo lo que necesitan. |
| **6** | BudgetFormPage y WorkOrderFormPage son los archivos más grandes | Migrar campo por campo, no todo de una vez. Probar guardar después de cada grupo de campos. |
| **7** | PresupuestoPanel es `@ts-nocheck` y tiene lógica entremezclada con UI | Primero migrar nombres de campo, después refactorizar lógica a composables. |
| **8** | Eliminar alias puede romper imports olvidados | `grep -r "from '.*types.*'" src/` para encontrar todos los imports antes de eliminar. |
| **9** | Sin tests E2E, errores pueden pasar desapercibidos | Smoke test manual completo después de cada paso mayor. |

---

## 10.14 Orden de Commits Recomendado

| Commit | Cambios | Archivos |
|--------|---------|----------|
| 1 | `types/client.ts`, `types/material.ts`, `types/poolStock.ts` → English | 3 |
| 2 | Eliminar 9 alias files + limpiar `types/index.ts` | 10 |
| 3 | Actualizar imports en todo el codebase | ~20 |
| 4 | Nuevos composables (8 hooks) | 10 nuevos |
| 5 | BudgetFormPage + subcomponentes → English | 7 |
| 6 | WorkOrderFormPage + subcomponentes → English | 7 |
| 7 | Eliminar `useEntityForm.ts` + `entityFormHelpers.ts` | -2 |
| 8 | API Resources: eliminar mappings (4 archivos) | 5 |
| 9 | Renombrar componentes caja (7) + migrar internal state | 9 |
| 10 | Renombrar componentes ordenes (3) + migrar props | 6 |
| 11 | Renombrar componentes presupuesto (6) + migrar BudgetPanel | 7 |
| 12 | Renombrar EstadoBadge → StatusBadge | ~5 |
| 13 | Limpieza: formatters.ts, translate.ts, pages restantes | ~5 |
| 14 | Verificación: tsc --noEmit + build + E2E | 0 |

---

## 10.15 Notas Técnicas Adicionales

### El `buildPayload` en los nuevos hooks

El payload debe enviar los mismos nombres de campo que la API espera (snake_case). Esto significa que aunque el form state use camelCase (`clientName`), el buildPayload debe convertirlo a `client_name`:

```ts
// En useBudgetForm.ts / useWorkOrderForm.ts
const FORM_TO_API_MAP: Record<string, string> = {
  clientName: 'client_name',
  clientPhone: 'client_phone',
  address: 'client_address',
  // ... resto de campos
};

function buildPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    const apiKey = FORM_TO_API_MAP[key] || key; // fallback al mismo nombre
    payload[apiKey] = value;
  }
  return payload;
}
```

**Excepción:** `materials` y `pools` arrays se convierten a JSON string (`materials_data`, `pools_data`) igual que hace `buildPayload` actual.

### El `loadEntity` en useFormState

```ts
async function loadEntity(id: string) {
  const res = await services.getById(id);
  const data = res.data as Record<string, unknown>;
  // Mapeo directo API snake_case → form camelCase
  const API_TO_FORM_MAP: Record<string, string> = {
    client_name: 'clientName',
    client_phone: 'clientPhone',
    client_address: 'address',
    client_email: 'email',
    // ...
  };
  const formData: Partial<EntityFormState> = {};
  for (const [key, value] of Object.entries(data)) {
    const formKey = API_TO_FORM_MAP[key] || key;
    (formData as Record<string, unknown>)[formKey] = value;
  }
  setForm({ ...INITIAL_FORM_EN, ...formData });
}
```

### Snapshot field

El campo `snapshot` en `EntityFormState` es `Record<string, unknown>`. Se debe migrar a un objeto tipado en el futuro. Por ahora, mantener como `unknown` y pasar sin mapeo.

### Manejo de arrays anidados

Los `fabricationDetails`, `materials` y `pools` internamente usan campos anidados con nombres English. La serialización a `materials_data` (JSON string) debe usar los nombres English también:

```ts
// fabricationDetails → JSON string
fabrication_details: JSON.stringify(form.fabricationDetails.map(d => ({
  concept: d.concept,
  detail: d.detail,
  length: d.length,
  width: d.width,
  m2: d.m2,
  labor: d.labor,
  currency: d.currency,
  quantity: d.quantity,
  price: d.price,
})))
```

### Mapeo de estados

El `buildPayload` debe mapear estados English del form a English de la API (que son iguales, pero algunos pueden diferir):

```ts
// Status mapping (solo para budgets, work orders usa English directo)
const STATUS_MAP: Record<string, string> = {
  'PENDING': 'PENDING',
  'APPROVED': 'APPROVED',
  'REJECTED': 'REJECTED',
  'CONVERTED_TO_OT': 'CONVERTED_TO_OT',
};
```

En la práctica, los estados English del form YA son los mismos que la API espera. No se necesita mapping. Pero verificar que ningún código setea estados Spanish como `'PENDIENTE'` o `'MEDICION'`.
