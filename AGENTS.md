# AGENTS.md

> **Estado:** Rama `development` con work sin commitear. Fases 1-5.9 completadas. Dashboard cards rediseñadas. `noImplicitAny: true` habilitado.
> `tsc --noEmit` 0 errores · `vite build` ~11s, gzip ~880 KB · vitest 65/65 · pytest 14/14.

## Reglas de operación

- **Git es manual**: NO commitear, NO pushear, NO crear PR — **solo cuando el usuario lo pida explícitamente**. Modificar archivos está permitido; versionarlos no.
- **Inspeccionar antes de versionar**: si el usuario pide commit/PR, antes de stagear revisar `git status`, `git diff` y `git log --oneline -10`; stagear solo los archivos intencionalmente modificados; nunca commitear secretos.
- **Mensajes concisos**: usar el estilo del repo. Si no hay convención clara, mensajes cortos en inglés o español describiendo el "qué" en lugar del "cómo".
- **Cero PRs automáticos**: aunque el usuario diga "todo listo", NO crear el PR — esperar a que el usuario lo pida.

## Stack

- **Backend:** Python 3.14 + FastAPI 0.139 + SQLAlchemy 2.0 + MySQL (swappable SQLite via `DATABASE_URL`)
- **Frontend:** Vite 6 + React 18 + TypeScript 5.7 + CSS Modules (BEM) + Axios + TanStack Query
- **DB Migrations:** Alembic
- **Auth:** JWT (python-jose HS256) + passlib bcrypt==4.1.3
- **PDF:** `@react-pdf/renderer` (frontend, primary) + xhtml2pdf/Jinja2 (legacy backend)
- **Tests:** pytest (backend), vitest (frontend), Playwright (E2E)

## Project structure

```
afamar-backend/    — FastAPI app
  app/
    main.py        — entrypoint, lifespan runs Alembic upgrade + seed admin
    api/
      dependencies.py  — get_db, get_current_user
      routers/         — auth, clients, client_addresses, budgets,
                          additional_works, work_orders, materials, pool_stock,
                          measurements, daily_cash, dashboard, settings,
                          reports, search, options, references,
                          product_photos, whatsapp, additional-works (19 routers)
    core/          — settings (pydantic), exceptions
    db/            — base, session, database
    models/        — client, budget, work_order, material,
                     pool_stock, measurement, daily_cash, setting, price_history,
                     product_photo, reference, user, option,
                     currency, client_address, additional_work
    schemas/       — Pydantic (Create/Update/Response separados)
    services/      — lógica de negocio (auth, budget, work_order, etc.)
    repositories/  — SQLAlchemy puro (12 repos)
    utils/         — logger, responses, pagination, numbering
    templates/     — budget_pdf.html, work_order_pdf.html (Jinja2, legacy)
  tests/           — pytest con conftest.py (SQLite file-based fixtures)
  alembic/         — migrations
  scripts/seed.py  — datos iniciales
  uploads/         — user uploads
  requirements.txt, alembic.ini, Dockerfile, pyproject.toml

afamar-frontend/   — Vite + React + TS
  src/
    main.tsx       — React entrypoint
    App.tsx        — BrowserRouter + Routes (React.lazy code-split, /admin/* + ProtectedRoute)
    index.css      — reset CSS + design tokens (CSS vars) + legacy classes
    global.d.ts    — declare global { Window.APP_CONFIG }
    css-modules.d.ts — *.module.css + *.jpg/*.png/*.svg/*.webp/*.jpeg
    api/
      http.ts      — Axios instance (baseURL: /api/v1) + interceptors
      client.ts    — api = re-export hub from resources/
      resources/   — 12+ domain files (budgets, clients, cash, etc.)
      hooks.ts     — TanStack Query hooks (useList, useGet, etc.)
    pages/         — one folder per module (English names), all with *.module.css
      auth/        (LoginPage)
      home/        (HomePage)
      dashboard/   (DashboardPage)
      clients/     (ClientsListPage, ClientFormPage)
      budgets/     (BudgetsListPage [→BudgetTable], BudgetFormPage [→useBudgetActions, useBudgetQuoteCalculations])
      work-orders/ (WorkOrdersListPage [→WorkOrdersTable], WorkOrderFormPage)
      materials/   (MaterialsListPage, MaterialFormPage)
      pool-stock/  (PoolStockPage)
      measurements/ (MeasurementsListPage, MeasurementFormPage [→MeasurementPhotoGrid])
      cash/        (CashDailyPage, CashHistoryPage)
      calculator/  (CalculatorPage)
      configuration/ (ConfigurationPage)
      reports/     (ReportsPage)
      online-budgets/ (OnlineBudgetsListPage, OnlineBudgetFormPage)
      additional-works/ (AdditionalWorksPage [→AdditionalWorksTable, AdditionalWorkForm])
    components/      — reutilizables (todos English)
      ui/          — primitivas (Button, Modal, StatusBadge, ListPage, etc.)
      common/      — Loading, ConfirmDialog, PdfPreviewModal,
                     ClientHistoryCard, WorkOrdersTable,
                     AdditionalWorksTable, AdditionalWorkForm,
                     MeasurementPhotoGrid, LinearMetersInput
      measurements/ — MeasurementsTable (NEW)
      home/         — HeroCarousel (NEW)
      entity/      — EntityFormFinancial, EntityFormSpecs, EntityFormClient
                     (unified wrappers shared by Budget + WorkOrder forms)
      cash/        — IncomeModal, ExpenseModal, CashTotalCards, etc.
      budget/      — BudgetPanel (orchestrator), BudgetCurrencyColumn (ARS/USD column),
                     BudgetPaymentSection (payment block), BudgetPanelContext (context provider),
                     OnlineBudgetHeader, FabricationTable,
                     QuoteOptionsGrid, OnlineItemsTable, AdditionalWorkSection,
                     AdditionalWorkCard, AdditionalMaterial
      materials/   — MaterialCard, MaterialForm, MaterialFormModal, MaterialPhotoUploader, PoolCard, PoolSection
      pool-stock/  — PoolFormModal, PoolMovementsModal
      orders/      — ClientSection (orchestrator), ClientTypeahead, AddressPicker,
                     NewClientModal, ClientInfoCard,
                     ApprovalSection, ObservationsSection, FormHeader, FormFooter
      sketch/      — SketchEditor, Toolbar, useSketchState (CanvasArea, SketchPreviewLayer,
                     LineShape, RectangleShape, TextShape)
      signature/   — SignatureCanvas
    layouts/       — MainLayout + MainLayout.module.css (sidebar BEM)
    components/layout/MainLayout/ — MainLayout (orchestrator), Sidebar.tsx (accordion nav), Topbar.tsx (profile/date/title)
    context/       — AuthContext, NotificationContext, ThemeContext
    hooks/         — useEntityForm (facade → 7 composables),
                     useBudgetCalculations, usePdfPreview, useConfirmPayment,
                     useAdditionalWorkSelection, useBudgetActions,
                     useBudgetQuoteCalculations, useClientAddresses,
                     usePlateCalculator (bin-packing algorithm),
                     entityFormHelpers.ts (re-export hub + addMaterialToList/addPoolToList),
                     entityFormConstants.ts (M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS, INITIAL_FORM),
                     entityFormFinancial.ts (buildFinancialPayload, mapFinancialToForm),
                     entityFormSerialization.ts (buildPayload, mapApiToForm, sketch flatten/unflatten)
    constants/     — PAYMENT_METHODS, BANK_INFO, EXPENSE_TYPES, FOLDER_STATUS_MAP, status.ts (STATUS_META)
    types/         — 17+ files en inglés (EntityFormState en snake_case English)
    utils/         — translate, formatters,
                     pdf/buildPdfData.ts (orchestrator + re-exports),
                     pdf/pdfTypes.ts (all PDF interfaces),
                     pdf/pdfHelpers.ts (formatting/parsing utils),
                     pdf/buildSectionData.ts (row builders + section bucketing),
                     pdf/SketchImageExtractor,
                      frentePricing, additionalWorkParse, additionalWorkCalc, materialGroups, math.ts (round2)
  tsconfig.json    — path aliases (@/, @features/, @shared/, @assets/)
  vite.config.ts   — proxy /api → http://localhost:3090
  eslint.config.js, vitest.config.ts, Dockerfile, nginx.conf
```

## Key conventions

- **BEM + CSS Modules:** cada page tiene `X.module.css` co-localizado. Patrón de import:
  ```ts
  import styles from './X.module.css';
  const s = styles as unknown as Record<string, string>;
  // <div className={s['x__title']}>
  ```
- **Path aliases:** `@/`, `@features/`, `@shared/`, `@assets/`. Configurados en `tsconfig.json` + `vite.config.ts`.
- **English naming (carpetas/componentes/hooks/funciones/constantes/CSS classes):** todo renombrado. Excepción: `EntityFormState` campos internos (snake_case English que matchean el backend).
- **TypeScript strict:** habilitado. `tsc --noEmit` antes de `vite build`.
- **Naming TSX:** PascalCase componentes, camelCase hooks/utils, UPPER_SNAKE_CASE constantes.
- **Repository pattern:** acceso a DB via `repositories/*.py`. Transacciones en services.
- **Service layer:** lógica de negocio en `services/*.py`. Routers solo orquestan request/response.
- **Pydantic v2:** schemas separados Base/Create/Update/Response. `ConfigDict(from_attributes=True)`.
- **SQLAlchemy 2.0:** `Mapped[T]` + `mapped_column()`. No usar `relationship` lazy sin `joinedload`.
- **Routers delgados:** ≤ 5 líneas de lógica. Todo en services.
- **Excepciones de dominio:** `NotFoundError`, `ConflictError`, `ValidationError` en `core/exceptions.py`.
- **PDF generation:** `utils/pdf/buildPdfData.ts` (orchestrator) + `pdfTypes.ts` + `pdfHelpers.ts` + `buildSectionData.ts` + `DocumentPdf.tsx` (frontend, `@react-pdf/renderer`). Legacy: `pdf_html.py` (xhtml2pdf + Jinja2).
- **Numbering:** `P-000001` (budgets), `A-000001` (work_orders). Compartido en `utils/numbering.py`.
- **Status enums:** English en DB (`MEASUREMENT`, `WORKSHOP`, etc.), Spanish en UI via `t(key)` en `utils/translate.ts`.
- **Client data flow:** Budget/WorkOrder stores only `client_id` (FK) + optional `delivery_address_id` (FK → `client_addresses`). No snapshot columns. `from_orm_with_client()` resolves `client_*` fields from live `Client` row at serialization time. If `delivery_address_id` is set, `client_address` is overridden with the matching `ClientAddress.address`. `delivery_address_id` is patchable on update (both `BudgetUpdate` and `WorkOrderUpdate` include the field). Conversion paths (`create_from_budget`, `convert_alternative_to_work_order`) copy `delivery_address_id` from the source budget.

## EntityFormState (form state)

`EntityFormState` en `src/types/form.ts` — campos snake_case English que matchean el backend:
- Client: `client_name`, `client_phone`, `client_address`, `client_email`, `delivery_address_id`
- Financial: 17 campos de `FinancialBase` (currency, usd_rate, subtotal, transport, total, etc.)
- Specs: `material`, `material_price_m2`, `color`, `thickness`, `finish`, `bacha`, `anafe`, `pool_id`, `pool_price`, `pool_currency`, `pool_image`
- Items: `materials_data`, `pools_data`, `fabrication_details`, `additional_works_data`, `sketch_elements`
- Dates: `date`, `delivery_date`, `signed_at`
- Notes: `notes`, `design_observations`, `important_observations`
- Terms: `budget_terms`, `warranty_terms`, `delivery_terms`
- Misc: `number`, `status`, `digital_signature`, `work_order_number`

`buildPayload(form)` → passthrough snake_case → snake_case + JSON.stringify arrays + date serialization.
`mapApiToForm(d)` → passthrough inverso, snake_case → snake_case.

## useEntityForm (facade)

`src/hooks/useEntityForm.ts` — facade delgado que compone 7 composables:
- `useFormReferences` — carga materials/pools/clients/logo, fetch next number, initial load, `updateClientAddresses`
- `useFormDetails` — CRUD `fabrication_details`, refs de material
- `useFormMaterials` — Material picker + CRUD `materials_data`
- `useFormPools` — Pool picker + CRUD `pools_data`
- `useFormClient` — Client typeahead (filtered + handleClientSelect)
- `useFormCalculationsInput` — Handlers transport/deposit/usd_rate
- `useFormActions` — Submit/delete/status-change/print

Acepta `extraPayloadFields?: () => Partial<Record<string, unknown>>` para inyecciones per-page (e.g. WO terms override). Solo `WorkOrderFormPage` lo usa.

## Client address selection

**Two code paths for address selection:**

1. **`ClientSection`** (`components/orders/ClientSection/`) — when NO client is selected yet (typeahead mode). Renders typeahead + address picker dropdown + Domicilio input. Address picker shows when client has >1 address; includes inline "add new address" input + button at the bottom of the dropdown. Sets both `delivery_address_id` and `client_address`.

2. **`BudgetFormClient` / `WorkOrderFormClient`** — when client IS already selected (read-only mode). Renders `ClientInfoCard` + address picker row. Picker shows `<select>` (when >1 address) or readonly input (1 address) + "Nueva dirección" input + `+` button, all in a flex row. Sets both `delivery_address_id` and `client_address`.

**Key behavior:**
- Selecting an address from the dropdown sets `delivery_address_id` (FK) + updates `client_address` (text).
- Deselecting (picking "Principal") resets `delivery_address_id` to null + resets `client_address` to `client.address`.
- Manually editing the Domicilio input resets `delivery_address_id` to null.
- Adding a new address inline calls `createClientAddress` API, appends to local `clientes` state via `onAddressAdded` → `updateClientAddresses`, and auto-selects the new address.
- Backend `from_orm_with_client()` resolves the override: if `delivery_address_id` is set, replaces `client_address` with the matching `ClientAddress.address` text.
- `delivery_address_id` is persisted on create AND update (both schemas include it). Conversion paths copy it from source budget.
- PDF reads `form.client_address` directly — no additional resolution needed.
- WhatsApp does NOT use client address (only phone + name).

## DB Maintenance Scripts

Located in `afamar-backend/scripts/`. Run with the project's venv Python.

```bash
# Diagnose corrupted work_orders (dry-run)
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py

# Fix automatically
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix

# Fix interactively (confirm each)
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix --interactive

# Docker
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py --fix
```

Checks: JSON column corruption, FK orphans (client_id, delivery_address_id, budget_id), Pydantic serialization errors.

## E2E Tests (Playwright)

- **Stack:** `@playwright/test@1.61.1` + Chromium. Tests en `afamar-frontend/e2e/`.
- **Config:** `afamar-frontend/playwright.config.ts` — `webServer` auto-arranca backend (uvicorn 3095) + frontend (vite 3090).
- **Scripts:** `npm run test:e2e` (headless), `npm run test:e2e:ui` (Playwright UI), `npm run test:e2e:debug`.

## Commands

```bash
# Backend (puerto 3095)
cd afamar-backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 3095
python seed_admin.py
alembic upgrade head
pytest

# Frontend (puerto 3090)
cd afamar-frontend
npm install
npm run dev
npm run build              # tsc --noEmit && vite build
npm run lint               # ESLint
npx vitest --run           # unit tests (63/63)
npm run test:e2e           # E2E tests
```

## Variables de entorno (afamar-backend/.env)

```ini
ENVIRONMENT=development
DATABASE_URL=sqlite:///./afamar.db
SECRET_KEY=afamar-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=168
CORS_ALLOW_ORIGINS=http://localhost:5173,http://localhost:3090
RATE_LIMIT_ENABLED=false
```

## Python 3.14 notas

- **Pydantic:** usar `Optional[date]` en vez de `date | None` (PEP 604 union falla con `eval_type_backport`).
- **Pillow:** `>=11.1.0,<12.0`.
- **bcrypt:** `==4.1.3` (passlib compat).

## Schema legacy

- **`online_budgets`** — tabla dropeada via migración `11e4cc1657da`. Sin código activo.
- **`BudgetAdicional`** legacy table — preservada pero ya no se escribe.
