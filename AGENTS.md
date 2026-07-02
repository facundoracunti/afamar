# AGENTS.md

> **Estado:** Rama `refactor` con 6 commits (2 locales sin pushear). El proyecto
> está en inglés, con estructura BEM/CSS Modules, `/api/v1` y path aliases.
> Ver `PLAN.md` para el roadmap completo de migración.

---

## Stack

- **Backend:** Python 3.14 + FastAPI 0.139 + SQLAlchemy 2.0 + SQLite (swappable to MySQL via `DATABASE_URL`)
- **Frontend:** Vite 6 + React 18 + TypeScript 5.7 + CSS Modules (BEM) + Axios
- **DB Migrations:** Alembic
- **Auth:** JWT (python-jose HS256) + passlib bcrypt==4.1.3
- **Status/Payment/Priority enums:** English en DB, Spanish en UI via `t(key)` en `src/utils/translate.ts`
- **Tests:** pytest (backend), vitest (frontend — instalado, no usado aún)

## Cash module (reciente: Spanish→English field names)

- **Root cause:** `/api/v1/cash/daily?date=...` → backend espera `?query_date=...`. Fix: `date`→`query_date` in `cash.ts`.
- **Request/Response fields:** todo el módulo caja (`CashDailyPage`, `CashHistoryPage`, `IngresoModal`, `EgresoModal`, `IngresosTable`, `EgresosTable`, `cajaUtils`) migrado de Spanish a English para coincidir con schemas backend.
- **Values:** `FORMAS_PAGO` ahora `['CASH','TRANSFER','CREDIT_CARD']`, `TIPOS_EGRESO` ahora `['GENERAL','BANK_TRANSFER']`, movement types `'INCOME'`/`'EXPENSE'`.
- **`closeDailyCash`:** body `{ date, notes }` (antes `{ date, observations }`).
- **Movement create:** body `{ date, type, amount, description, payment_method, ... }` (antes `{ fecha, tipo, monto, concepto, forma_pago, ... }`).

## Status enums (English values, en DB)

- **Budgets:** `PENDING`, `ONLINE`, `APPROVED`, `REJECTED`, `CONVERTED_TO_OT`
- **WorkOrders:** `MEASUREMENT`, `WORKSHOP`, `FINISHED`, `DELIVERED`, `CANCELLED`
- **Measurements:** `PENDING`, `DONE`, `CANCELLED`
- **Priorities:** `LOW`, `NORMAL`, `HIGH`, `URGENT`
- **Payment methods:** `CASH`, `TRANSFER`, `CREDIT_CARD`, `DEBIT_CARD`, `CHECK`, `MIXED`
- **Movement types:** `INCOME`, `EXPENSE`, `BANK_TRANSFER`

UI usa `t('PENDING')` → `"Pendiente"` via `src/utils/translate.ts`.

## Project structure

```
afamar-backend/    — FastAPI app
  app/
    main.py        — entrypoint, lifespan runs Alembic upgrade + seed admin
    api/
      dependencies.py  — get_db, get_current_user
      routers/         — auth, clients, budgets, online_budgets, work_orders,
                          materials, pool_stock, measurements, daily_cash,
                          settings, reports, search, options, references,
                          product_photos, whatsapp (15 routers)
    core/          — settings (pydantic), exceptions
    db/            — base, session, database
    models/        — client, budget, work_order, material, online_budget,
                     pool_stock, measurement, daily_cash, setting, price_history,
                     product_photo, reference, user, option
    schemas/       — Pydantic (Create/Update/Response separados)
    services/      — lógica de negocio (auth, budget, work_order, etc.)
    repositories/  — SQLAlchemy puro (12 repos)
    utils/         — logger, responses, pagination, numbering
    templates/     — budget_pdf.html, work_order_pdf.html (Jinja2)
  tests/           — pytest con conftest.py (SQLite file-based fixtures)
  alembic/         — migrations (initial_schema autogenerada)
  scripts/seed.py  — datos iniciales
  uploads/         — user uploads
  requirements.txt, alembic.ini, Dockerfile, pyproject.toml

afamar-frontend/   — Vite + React + TS
  src/
    main.tsx       — React entrypoint
    App.tsx        — BrowserRouter + Routes (con /admin/* + ProtectedRoute)
    index.css      — reset CSS + design tokens (CSS vars) + legacy classes
    api/
      http.ts      — Axios instance (baseURL: /api/v1) + interceptors
      client.ts    — api = re-export hub from resources/
      resources/   — 12 domain files (budgets, clients, cash, etc.)
      hooks.ts     — TanStack Query hooks (useList, useGet, etc.)
    pages/         — one folder per module (English names), all with *.module.css
      auth/        (LoginPage)
      home/        (HomePage)
      dashboard/   (DashboardPage)
      clients/     (ClientsListPage, ClientFormPage)
      budgets/     (BudgetsListPage, BudgetFormPage)
      work-orders/ (WorkOrdersListPage, WorkOrderFormPage)
      materials/   (MaterialsListPage, MaterialFormPage)
      pool-stock/  (PoolStockPage)
      measurements/ (MeasurementsListPage, MeasurementFormPage)
      cash/        (CashDailyPage, CashHistoryPage)
      calculator/  (CalculatorPage)
      configuration/ (ConfigurationPage)
      reports/     (ReportsPage)
      online-budgets/ (OnlineBudgetsListPage, OnlineBudgetFormPage)
    components/    — reutilizables
      ui/          — primitivas (Button, Modal, StatusBadge, ListPage, etc.)
      croquis/     — CroquisEditor, Toolbar, useCroquisState
      caja/        — IngresoModal
      presupuesto/ — PresupuestoPanel
      ErrorBoundary/
    layouts/       — MainLayout + MainLayout.module.css (sidebar BEM)
    context/       — AuthContext, NotificationContext, ReferencesContext
    hooks/         — useEntityForm (legacy, @ts-nocheck), custom hooks
    constants/     — CURRENCIES, STATUS_COLORS, PRIORITY_COLORS
    types/         — 17 files (9 English + 8 Spanish aliases)
    utils/         — formatCurrency, translate, calcM2, downloadPdf, whatsapp
  tsconfig.json    — path aliases (@/, @features/, @shared/, @assets/)
  vite.config.ts   — proxy /api → http://localhost:8000
  eslint.config.js, vitest.config.ts, Dockerfile, nginx.conf
```

## Auth system

- **Endpoints públicos:** `POST /api/v1/auth/login`, `GET /api/v1/product-photos*`, `GET /api/v1/references/*`, `GET /api/v1/online-budgets` (POST público).
- **Endpoints protegidos:** todos los demás routers admin usan `Depends(get_current_user)`.
- **JWT:** token en `Authorization: Bearer <token>`. Almacenado en `localStorage` como `auth_token`.
- **Admin seed:** `python seed_admin.py` crea `admin` / `admin123` si no existe.
- **Reference data seed:** `python scripts/seed_reference_data.py` carga `budget_statuses`, `work_order_statuses`, `payment_methods`, `priority_levels` y `finish_types` con labels en español. Idempotente. Flags: `--only <tabla>` y `--force` (actualiza labels existentes).
- **Reference endpoints:** `GET /api/v1/references/{resource}` (público) devuelve listas ordenadas. Resources: `budget-statuses`, `work-order-statuses`, `payment-methods`, `priority-levels`, `finish-types`. CRUD protegido con `get_current_user`.
- **Frontend:** `AuthContext` en `src/context/AuthContext.tsx`. Hook `useAuth()` para consumir.
- **Response envelope:** `{ success: true, data: T, error: null, pagination? }`. `http.ts` extrae `data` automáticamente.

## Key conventions

- **BEM + CSS Modules:** cada page tiene `X.module.css` co-localizado. Patrón de import:
  ```ts
  import styles from './X.module.css';
  const s = styles as unknown as Record<string, string>;
  // <div className={s['x__title']}>
  ```
- **Path aliases:** `@/`, `@features/`, `@shared/`, `@assets/`. Configurados en `tsconfig.json` + `vite.config.ts`.
- **English naming:** entidades, endpoints, rutas, archivos, funciones. UI labels en español via `t()`.
- **TypeScript strict:** habilitado. `tsc --noEmit` antes de `vite build`.
- **Naming TSX:** PascalCase componentes, camelCase hooks/utils, UPPER_SNAKE_CASE constantes.
- **Imports order:** externos → types → services/hooks/utils → components → styles.
- **Repository pattern:** acceso a DB via `repositories/*.py`. Transacciones en services.
- **Service layer:** lógica de negocio en `services/*.py`. Routers solo orquestan request/response.
- **Pydantic v2:** schemas separados Base/Create/Update/Response. `ConfigDict(from_attributes=True)`.
- **SQLAlchemy 2.0:** `Mapped[T]` + `mapped_column()`. No usar `relationship` lazy.
- **Routers delgados:** ≤ 5 líneas de lógica. Todo en services.
- **Excepciones de dominio:** `NotFoundError`, `ConflictError`, `ValidationError` en `core/exceptions.py`. Mapeadas a HTTP por el cliente (frontend).
- **PDF generation:** `pdf_html.py` (primary, xhtml2pdf + Jinja2) y `pdf.py` (legacy, reportlab).
- **Numbering:** `P-000001` (budgets), `A-000001` (work_orders). Compartido en `utils/numbering.py`.
- **Plantillas PDF Jinja2:** `templates/budget_pdf.html`, `templates/work_order_pdf.html`.

## Database

- **Default:** SQLite `afamar.db` (auto-creada en startup)
- **Producción:** MySQL via `DATABASE_URL` (formato `mysql+pymysql://user:pass@host/db`)
- **Migrations:** Alembic. `main.py` corre `alembic upgrade head` en lifespan startup.
- **Generar nueva migración:** `alembic revision --autogenerate -m "descripcion"`. Revisar antes de commitear.
- **Reference data:** tablas `budget_statuses`, `work_order_statuses`, `payment_methods`, `priority_levels`, `finish_types` (FK columns en budgets/work_orders).

## Services (frontend)

| Service | Path backend |
|---------|--------------|
| `clientes.ts` | `/clients` |
| `presupuestos.ts` | `/budgets` |
| `presupuestosOnline.ts` | `/online-budgets` |
| `ordenes.ts` | `/work-orders` |
| `materiales.ts` | `/materials` |
| `mediciones.ts` | `/measurements` |
| `stockPiletas.ts` | `/pool-stock` |
| `caja.ts` | `/cash` |
| `configuracion.ts` | `/settings` |
| `reportes.ts` | `/reports` |
| `dashboard.ts` | `/dashboard` |
| `auth.ts` | (login en `api/client.ts`) |
| `presupuestosOnline.ts` | `/online-budgets` |

Con `baseURL: '/api/v1'` en `http.ts`, el path completo es `/api/v1/clients`, etc.

## Pages con BEM (CSS Module)

✅ Migrados (18 pages — todos): `auth/LoginPage`, `home/HomePage`, `dashboard/DashboardPage`, `clients/ClientsListPage`, `clients/ClientFormPage`, `budgets/BudgetsListPage`, `budgets/BudgetFormPage`, `materials/MaterialsListPage`, `materials/MaterialFormPage`, `work-orders/WorkOrdersListPage`, `work-orders/WorkOrderFormPage`, `pool-stock/PoolStockPage`, `cash/CashDailyPage`, `calculator/CalculatorPage`, `reports/ReportsPage`, `configuration/ConfigurationPage`, `measurements/MeasurementsListPage`, `measurements/MeasurementFormPage`, `online-budgets/OnlineBudgetsListPage`, `online-budgets/OnlineBudgetFormPage`

✅ Forms descompuestos: `BudgetFormPage` → 6 subcomponentes (`BudgetFormClient`, `BudgetFormSpecs`, `BudgetFormItems`, `BudgetFormAdicionales`, `BudgetFormFinancial`, `BudgetFormObservations`). `WorkOrderFormPage` → 6 subcomponentes (`WorkOrderFormBasic`, `WorkOrderFormSpecs`, `WorkOrderFormItemsGrid`, `WorkOrderFormFinancial`, `WorkOrderFormObservations`, `WorkOrderFormSnapshot`).

## TypeScript helpers (legacy)

`src/hooks/useEntityForm.ts` es un mega-hook legacy con `@ts-nocheck`. Usar para preservar comportamiento en `BudgetForm`/`OrderForm` mientras se migra. Reemplazar por composables más pequeños en sesión futura.

## Type declaration: CSS Modules

`src/css-modules.d.ts` declara `*.module.css` como `Readonly<Record<string, string>>`. Si se añaden nuevos `.module.css`, no se necesita configuración adicional.

## Páginas con aliases backward-compat

- `App.tsx` redirige `/presupuestos/*` → `/admin/budgets/*`, `/ordenes/*` → `/admin/work-orders/*`, etc.
- Services exponen tanto nombres Spanish (legacy) como English (nuevos): `getPresupuestos = getBudgets`.
- Eliminar aliases es trabajo futuro, no urgente.

## Comandos

```bash
# Backend (puerto 8000)
cd afamar-backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
python seed_admin.py
alembic revision --autogenerate -m "msg"
alembic upgrade head
pytest

# Frontend (puerto 5173, o 5174+ si 5173 ocupado)
cd afamar-frontend
npm install
npm run dev
npm run build              # tsc --noEmit && vite build
npm run lint               # ESLint
```

## Variables de entorno (afamar-backend/.env)

```ini
ENVIRONMENT=development
APP_NAME=AFAMAR API
APP_VERSION=1.0.0
DATABASE_URL=sqlite:///./afamar.db
SECRET_KEY=afamar-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=168
FRONTEND_URL=http://localhost:5173
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3090
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
LOG_LEVEL=INFO
RATE_LIMIT_ENABLED=false
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
```

## Python 3.14 notas

- **Pydantic:** usar `Optional[date]` en vez de `date | None` (PEP 604 union falla con `eval_type_backport`).
- **Pillow:** `>=11.1.0,<12.0` (Pillow 10.x no tiene cp314 wheels).
- **bcrypt:** `==4.1.3` (passlib compat). El warning `(trapped) error reading bcrypt version` es benigno.

## Trabajo futuro (PLAN.md §1.2)

1. **Migrar form pages a BEM** (~2-3h): BudgetForm, WorkOrderForm, ClientForm, MaterialForm ✅
2. **Renombrar types a inglés** (~1h): Cliente→Client, Presupuesto→Quote, etc. Mantener aliases. ✅
3. **Descomponer forms** (~3-4h): extraer 6 subcomponentes de BudgetForm y WorkOrderForm. ✅
4. **Crear seed de reference data** (~1h): statuses, payment_methods, etc. ✅
5. **Migrar pages sin BEM** (~30 min): OnlineBudgets, Measurements, Configuration. ✅
6. **Tests E2E con Playwright** (~2-3h).
7. **Eliminar legacy** (~10 min): folders `pages/<spanish-name>/` si quedan archivos. ✅
8. **Eliminar aliases Spanish** (~30 min) en services. ✅
9. **Reemplazar useEntityForm** (~2h): dividir en composables más pequeños.
10. **Migrar a TanStack Query** en pages (hooks ya están en `src/api/hooks.ts`).

## Refactor commits en `refactor`

```
5985a2ca (HEAD)                "fix: repair UTF-8 corruption in Spanish text"
7600a594                       "docs: update AGENTS.md and PLAN.md for refactor state"
c328f6a6 (origin/main)         "ultimo fix de docker"
398a0586                       "fix: reestructuración de middlewares..."
1e3d6604                       "alembic"
ced1d0ad                       "fix de login/admin"
6a922b5c                       "Refactor: Finalizada limpieza de frontend..."
7f9a6e75                       "ultimo fix"
8300ea63                       "fix de lo que rompio la ia 2"
0ff5b51c                       "login admin"
fa6c583b                       "Refactor frontend structure..."
30b7a8be                       "opencode actualiza contexto"
1e3d6604                       "alembic"
... (history)
39bf9031 (origin/refactor)     "chore: remove stale build artifacts..."
c98228c5 (origin/refactor)     "feat: migrate 6 list pages to BEM/CSS Modules"
25e57a56 (origin/refactor)     "feat: add BEM/CSS Modules for 7 list pages"
f83f8b95 (origin/refactor)     "refactor: complete English naming + BEM foundation"
f04f740a (origin/refactor)     "feat: complete BEM migration, API consolidation, type renaming, and cleanup"
```

## Commits locales sin pushear (0 — al día con origin/refactor)

## Para crear PR

https://github.com/facundoracunti/afamar/pull/new/refactor

Antes de mergear a `main`:
1. Probar login + crear cliente + crear budget + convertir a OT
2. Probar crear material + caja diaria + cerrar caja
3. Verificar que las imágenes y uploads siguen funcionando
4. Confirmar que no hay referencias a `backend/` o `frontend/` en Docker configs
