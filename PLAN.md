# AFAMAR — Project Status & Roadmap

> Documento vivo. Estado actual del proyecto + roadmap de mejoras pendientes.
> Rama principal: `main`. Rama de refactor: `refactor` (mantenida como historial).

---

## 1. Estado del proyecto

### 1.1 Completado ✅

#### Backend (`afamar-backend/`)

| Hito | Detalle |
|------|---------|
| **Stack** | Python 3.14 + FastAPI 0.139 + SQLAlchemy 2.0 + SQLite (swappable to MySQL) |
| **Auth** | JWT HS256 + passlib bcrypt==4.1.3 |
| **Modelos en inglés** | 15 SQLAlchemy models (`Client`, `Budget`, `WorkOrder`, `PoolStock`, etc.) |
| **Schemas en inglés** | Pydantic v2 con `Base/Create/Update/Response` separados |
| **Routers (15)** | `auth`, `clients`, `budgets`, `online_budgets`, `work_orders`, `materials`, `pool_stock`, `measurements`, `daily_cash`, `settings`, `reports`, `search`, `options`, `references`, `product_photos`, `whatsapp` |
| **Repository pattern** | 12 repositories con SQLAlchemy puro |
| **Service layer** | Lógica de negocio en `services/*.py`. Routers ≤5 líneas de orquestación |
| **API path** | Todos los routers bajo `/api/v1` (en `app/api/routers/router.py`) |
| **Migrations** | Alembic. `app/main.py` corre `alembic upgrade head` en lifespan startup |
| **Reference data seed** | `scripts/seed_reference_data.py` — 5 tablas, idempotente con `--only`/`--force` |

#### Frontend (`afamar-frontend/`)

| Hito | Detalle |
|------|---------|
| **Stack** | Vite 6 + React 18 + TypeScript 5.7 + CSS Modules (BEM) + Axios |
| **Naming 100% inglés** | Carpetas, archivos, componentes, hooks, funciones, constantes, tipos, CSS classes |
| **Path aliases** | `@/`, `@features/`, `@shared/`, `@assets/` (configurados en tsconfig + vite) |
| **BEM + CSS Modules** | 18/18 pages con `*.module.css` (incluyendo las 4 form pages) |
| **API resources** | `src/api/resources/` con 12 domain files, sin field-mapping legacy (English native) |
| **TanStack Query** | `src/api/hooks.ts` con `useList`/`useGet`/`useCreate`/`useUpdate`/`useDelete`. 18/20 pages lo usan (UI state local con `useState`) |
| **Forms** | `BudgetForm`/`WorkOrderForm` extraídos en 6 subcomponentes cada uno |
| **Componentes** | `components/{ui,common,cash,budget,materials,orders,sketch,signature,ErrorBoundary}/` |
| **Auth flow** | `AuthContext` + ProtectedRoute + JWT en localStorage |
| **Reference data** | Consumida vía `/api/v1/references/*` (no hardcoded) |
| **Legacy redirects** | `/presupuestos`, `/ordenes`, `/stock-piletas`, etc. → `/admin/*` (English) |
| **E2E tests** | Playwright + Chromium. 4 specs, 16 tests en `e2e/` |
| **Build verde** | `tsc --noEmit && vite build` → 0 errores |

#### Bugs encontrados y arreglados en el último ciclo

| Bug | Fix |
|-----|-----|
| Stock NO se descontaba al crear WO directa | `WorkOrderService.create()` ahora llama `deduct_pool_stock()` |
| Stock NO se descontaba al convertir alternativa | `BudgetService.convert_alternative_to_work_order()` ahora llama `deduct_pool_stock()` |
| Frontend llamaba endpoint inexistente (`/budgets/{id}/convert-to-work-order` → 404) | `convertBudgetToWorkOrder` apunta a `/work-orders/from-budget/{id}` |
| List pages leían campos Spanish del API (`o.numero`, `o.estado`, etc.) | Cambiados a English (`o.number`, `o.status`, etc.) |
| `tipo_cambio` (legacy) leía key inexistente en `/settings` | Nuevo key `default_usd_rate` agregado a `DEFAULT_KEYS` |
| Duplicate "APROBACIÓN DEL CLIENTE" en `/admin/budgets/new` | Eliminado duplicado en `BudgetFormPage.tsx` |
| Padding inconsistente entre páginas | `main-layout__page-content` es la única fuente (36px) |
| `useEntityForm.ts` tenía `@ts-nocheck` | Removido. Ahora es facade tipado que compone 7 composables |
| `EntityFormState` ya estaba en inglés | Audit completado. PLAN.md §10 estaba desactualizado |

### 1.2 Pendiente / Roadmap

| # | Tarea | Prioridad |
|---|-------|-----------|
| 1 | Hacer merge de la rama `refactor` a `main` | 🟥 Alta |
| 2 | E2E: varios tests fallan por estado entre specs (state pollution). Refactor a `beforeEach` con `context.clearCookies()` o `request.post('/auth/login')` para setear token sin navegar | 🟧 Media |
| 3 | TanStack Query: todas las pages ya migradas. `ConfigurationPage` opcional | 🟨 Baja |
| 4 | Documentar API pública en OpenAPI/Swagger (FastAPI ya lo genera en `/docs`) | 🟨 Baja |
| 5 | Considerar renombrar campos `bacha`/`anafe` → `sink`/`cooktop` (requiere migration DB) | 🟦 Baja |
| 6 | CI/CD con GitHub Actions (lint + build + E2E) | 🟦 Baja |

---

## 2. Convenciones de Naming (post-refactor)

### 2.1 Entidades de dominio (DB en inglés, UI en español via `t()`)

| Modelo DB | Tabla | Español (UI) |
|-----------|-------|--------------|
| `Client` | `clients` | Cliente |
| `Budget` | `budgets` | Presupuesto |
| `WorkOrder` | `work_orders` | Orden de Trabajo |
| `Material` | `materials` | Material |
| `PoolStock` | `pool_stock` | Pileta |
| `StockMovement` | `stock_movements` | Movimiento de Pileta |
| `Measurement` | `measurements` | Medición |
| `DailyCash` | `daily_cash` | Caja Diaria |
| `CashMovement` | `cash_movements` | Movimiento de Caja |
| `Setting` | `settings` | Configuración |
| `OnlineBudget` | `online_budgets` | Presupuesto Online |
| `User` | `users` | Usuario |

### 2.2 Estados y enums

**DB:** English (`PENDING`, `MEASUREMENT`, `WORKSHOP`, `FINISHED`, `CANCELLED`, etc.)
**UI:** Spanish via `t(key)` en `src/utils/translate.ts`

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
| `LOW` / `NORMAL` / `HIGH` / `URGENT` | Baja / Normal / Alta / Urgente |
| `CASH` / `TRANSFER` / `CREDIT_CARD` / `DEBIT_CARD` / `CHECK` / `MIXED` | Efectivo / Transferencia / Tarjeta de Crédito / Tarjeta de Débito / Cheque / Mixto |
| `INCOME` / `EXPENSE` / `BANK_TRANSFER` | Ingreso / Egreso / Transf. Banco |

### 2.3 Endpoints REST principales

```
POST   /api/v1/auth/login
GET    /api/v1/clients
GET    /api/v1/clients/{id}/history
POST   /api/v1/clients
GET    /api/v1/budgets
GET    /api/v1/budgets/unified
POST   /api/v1/budgets
GET    /api/v1/budgets/{id}
PUT    /api/v1/budgets/{id}
POST   /api/v1/budgets/{id}/alternatives/{idx}/convert-to-work-order
POST   /api/v1/work-orders
POST   /api/v1/work-orders/from-budget/{budget_id}    # deducts pool stock
POST   /api/v1/work-orders/{id}/send-email
GET    /api/v1/work-orders/{id}/pdf
POST   /api/v1/online-budgets
GET    /api/v1/pool-stock
POST   /api/v1/pool-stock/{pool_id}/movements
GET    /api/v1/materials
POST   /api/v1/measurements
GET    /api/v1/cash/daily
GET    /api/v1/cash/history
POST   /api/v1/cash/daily/close
GET    /api/v1/settings
POST   /api/v1/settings/upload-logo
GET    /api/v1/reports/budgets
GET    /api/v1/reports/monthly-sales
GET    /api/v1/references/{resource}
```

---

## 3. Convenciones CSS (BEM + CSS Modules)

```
.block                          → bloque independiente
.block__element                 → elemento del bloque
.block--modifier                → variante del bloque
.block__element--modifier       → variante del elemento
```

**Reglas duras:**
- Nunca anidar más allá de `__element`
- Nunca selectores de etiqueta, IDs, ni universales
- Modificadores representan estados/variantes

```ts
// Patrón de uso
import styles from './XPage.module.css';
const s = styles as unknown as Record<string, string>;
<div className={s['x__title']}>Título</div>
```

**Padding exterior:** única fuente es `.main-layout__page-content` (36px). Pages no definen padding en la clase raíz.

---

## 4. Arquitectura

### Backend

```
afamar-backend/app/
├── main.py                    # FastAPI app + lifespan + middleware
├── api/
│   ├── dependencies.py        # get_db, get_current_user
│   └── routers/               # 15 routers
├── core/                      # Configuración + excepciones
├── db/                        # engine, SessionLocal, get_db
├── models/                    # 15 SQLAlchemy models (inglés)
├── schemas/                   # Pydantic (Base/Create/Update/Response)
├── repositories/              # 12 SQLAlchemy repos
├── services/                  # Lógica de negocio
├── utils/                     # logger, responses, pagination, numbering
└── templates/                 # Jinja2 (budget_pdf.html, work_order_pdf.html)
```

**Reglas de capas:**
| Capa | Puede importar | NO puede |
|------|----------------|----------|
| Routers | schemas, services, dependencies | repositories |
| Services | models, repositories, utils, otros services | FastAPI |
| Repositories | models, db | schemas, FastAPI |

### Frontend

```
afamar-frontend/src/
├── api/
│   ├── http.ts                # Axios instance + interceptors
│   ├── resources/             # 12 domain files (English native)
│   └── hooks.ts               # TanStack Query wrappers
├── pages/                     # 20+ pages en carpetas English
│   ├── auth/ home/ dashboard/ clients/ budgets/ work-orders/
│   ├── materials/ pool-stock/ measurements/ cash/ calculator/
│   └── configuration/ reports/ online-budgets/ product-photos/
├── components/
│   ├── ui/ common/ ErrorBoundary/
│   ├── cash/ budget/ materials/ orders/ sketch/ signature/
├── layouts/                   # MainLayout + CSS Module
├── context/                   # Auth, Notification, References
├── hooks/                     # 7 useForm*.ts + useBudgetCalculations
├── constants/                 # CURRENCIES, STATUS_COLORS, PRIORITY_COLORS
├── types/                     # 17 files English
└── utils/                     # formatCurrency, translate, calcM2, downloadPdf, whatsapp
```

---

## 5. Path de migración para próximas sesiones

### Sesión siguiente: merge `refactor` → `main`

Una vez verificado:
1. Probado login + crear cliente + crear budget + convertir a OT
2. Probado crear material + caja diaria + cerrar caja
3. Tests E2E pasando (ver roadmap pendiente #2)

### Sesión: robustecer E2E tests (roadmap #2)

Varios tests fallan por estado entre specs (`loginAsAdmin` persiste entre tests, luego `beforeEach` re-login falla). Refactor:
- Usar `context.request.post('/api/v1/auth/login')` para setear token sin navegar
- O usar `test.beforeEach` para limpiar storage + cookie

### Sesión: TanStack Query opcional (roadmap #3)

- `OnlineBudgetFormPage` y `CashDailyPage` aún usan `useState`+`useEffect`
- Migrar a `useList`/`useGet` si se justifica
- Mantener UI state local con `useState` (filtros, modals, tabs)

---

## 6. Comandos de desarrollo

```bash
# Backend (puerto 3095)
cd afamar-backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 3095
python seed_admin.py                # admin / admin123
python scripts/seed_reference_data.py
python scripts/seed_product_photos.py
alembic revision --autogenerate -m "msg"
alembic upgrade head
pytest

# Frontend (puerto 3090)
cd afamar-frontend
npm install
npm run dev                           # dev server (puerto 3090)
npm run build                         # tsc --noEmit && vite build
npm run lint                          # ESLint
npm run test:e2e                      # Playwright headless
npm run test:e2e:ui                   # Playwright UI mode
```

## 7. Variables de entorno (afamar-backend/.env)

```ini
ENVIRONMENT=development
APP_NAME=AFAMAR API
APP_VERSION=1.1.0
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
```

---

## 8. Decisiones técnicas

- **SQLite en dev, MySQL en prod** (cambiable via `DATABASE_URL`)
- **Auth JWT HS256** (secret requerido en `.env`)
- **Vite proxy `/api/*` → backend:3095** en dev, nginx → backend:3095 en prod
- **Runtime config** via `window.APP_CONFIG.API_URL` (envsubst en docker CMD)
- **i18n via DB**: English en DB, Spanish en UI via `t()`
- **TanStack Query**: `shared/api/hooks` con wrappers
- **References data**: viene del backend `/api/v1/references/*`. NO hardcoded en frontend
- **Tests E2E**: SQLite file-based en `tempdir/afamar_test.db`
- **PDF generation**: `xhtml2pdf` + Jinja2 templates. Primary: `pdf_html.py`. Legacy: `pdf.py`
- **`order` reserved word**: tabla `work_orders`, clase `WorkOrder`. La columna se llama `priority`/`status`
- **Python 3.14 compat**: `Optional[date]` (no `date | None`)
- **Pillow**: `>=11.1.0,<12.0` (cp314 wheels)
- **bcrypt**: `==4.1.3` (passlib compat)
- **Stock deduction**: ocurre al crear la WO (no al crear budget). Tres paths:
  - `POST /work-orders` → `deduct_pool_stock()`
  - `POST /work-orders/from-budget/{id}` → `deduct_pool_stock()`
  - `POST /budgets/{id}/alternatives/{idx}/convert-to-work-order` → `deduct_pool_stock()`
- **Restauración de stock**: cuando la WO pasa a `CANCELLED` o se borra
