# AGENTS.md

> **Estado:** Rama `development`. Fases 1-6.11 completadas. Feature: dashboard modales.
> `tsc --noEmit` 0 errores · `vite build` ~14s, gzip ~770 KB (chunks principales) · vitest 123/123 · pytest 14/14.

## Reglas de operación

- **Git es manual**: NO commitear, NO pushear, NO crear PR — **solo cuando el usuario lo pida explícitamente**. Modificar archivos está permitido; versionarlos no.
- **Inspeccionar antes de versionar**: si el usuario pide commit/PR, antes de stagear revisar `git status`, `git diff` y `git log --oneline -10`; stagear solo los archivos intencionalmente modificados; nunca commitear secretos.
- **Mensajes concisos**: usar el estilo del repo. Si no hay convención clara, mensajes cortos en inglés o español describiendo el "qué" en lugar del "cómo".
- **Cero PRs automáticos**: aunque el usuario diga "todo listo", NO crear el PR — esperar a que el usuario lo pida.

## Stack

- **Backend:** Python 3.14 + FastAPI 0.139 + SQLAlchemy 2.0 + MySQL (swappable SQLite via `DATABASE_URL`)
- **Frontend:** Vite 6 + React 18 + TypeScript 5.9 + CSS Modules (BEM) + Axios + TanStack Query
- **DB Migrations:** Alembic
- **Auth:** JWT (python-jose HS256) + passlib bcrypt==4.1.3
- **PDF:** `@react-pdf/renderer` (frontend, primary) + xhtml2pdf/Jinja2 (legacy backend, solo para `/api/v1/{budgets,work-orders}/{id}/pdf` download + email background)
- **Modales:** `components/ui/Modal` con focus trap + escape + portal; las páginas reales se embeben en modales desde el dashboard (ver "Dashboard modales" abajo)
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
    core/          — settings (pydantic — includes DEFAULT_USD_RATE,
                      PRODUCT_PHOTOS_DIR, MATERIALS_DIR, LOGOS_DIR,
                      MAX_UPLOAD_FILE_SIZE, MAX_UPLOAD_DIMENSION
                      + properties `product_photos_abs_dir` / `materials_abs_dir` / `logos_abs_dir`),
                      exceptions (NotFoundError, ConflictError, ValidationError)
    db/            — base, session, database
    models/        — client, budget, work_order, material,
                     pool_stock, measurement, daily_cash, setting, price_history,
                     product_photo, reference, user, option,
                     currency, client_address, additional_work
    schemas/       — Pydantic (Create/Update/Response separados) +
                      CurrencyCodeMixin (shared currency resolution)
    services/      — lógica de negocio (auth, budget, work_order, etc.)
                     + pdf_helpers.py (load_settings, has_terms, split_or_default,
                       build_company_and_terms — shared between budgets/wo routers)
                     + stock_helpers.py (deduct_pool_stock, restore_pool_stock)
                     + base.py (BaseService[T] generic CRUD base)
    repositories/  — SQLAlchemy puro (12 repos) con joinedload eager loading
    utils/         — currency (resolve_currency_id), client_helpers (lookup-or-create),
                     logger, responses, pagination, numbering
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
    index.css      — reset CSS + design tokens (CSS vars: brand, sidebar, topbar,
                     surface, text, input, borders) + Tailwind palette
                     (--tw-green-600, --tw-red-500, --tw-blue-800, etc.)
                     + light theme override via [data-theme="light"]
    global.d.ts    — declare global { Window.APP_CONFIG }
    css-modules.d.ts — *.module.css + *.jpg/*.png/*.svg/*.webp/*.jpeg
    api/
      http.ts      — Axios instance (baseURL: /api/v1) + interceptors
                     (envelope unwrap + 401 redirect + error normalization)
      resources/   — 12+ domain files (budgets, clients, cash, etc.)
      hooks.ts     — TanStack Query hooks (useList, useGet, useCreate, etc.)
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
      reports/     (ReportsPage [lazy-loads ReportsCharts])
      online-budgets/ (OnlineBudgetsListPage, OnlineBudgetFormPage)
      additional-works/ (AdditionalWorksPage [→AdditionalWorksTable, AdditionalWorkForm])
    components/      — reutilizables (todos English)ui/          — primitivas (Button, Modal, StatusBadge, ListPage, etc.)
      common/      — Loading, ConfirmDialog, PdfPreviewModal,
                     ClientHistoryCard, WorkOrdersTable,
                     AdditionalWorksTable, AdditionalWorkForm,
                     MeasurementPhotoGrid, LinearMetersInput
      measurements/ — MeasurementsTable (NEW)
      home/         — HeroCarousel (NEW)
      entity/      — EntityFormFinancial, EntityFormSpecs, EntityFormClient
                     + EntityFormLayout (shared form body — used by both
                       BudgetFormPage and WorkOrderFormPage; slots:
                       beforeLayout, observations, terms, alternativasGrid,
                       discountBlock, extraDialogs, specsCardClassName)
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
                     useFormReferences (TanStack Query with staleTime: 5min
                       for reference data — clients, materials, pools, settings),
                     usePdfPreviewController (shared PDF preview state — used by
                       BudgetsListPage and WorkOrdersListPage),
                     entityFormHelpers.ts (re-export hub + addMaterialToList/addPoolToList),
                     entityFormConstants.ts (M2_CONCEPTS, CUTOUT_DETAILS, DEFAULT_FINANCIALS, INITIAL_FORM),
                     entityFormFinancial.ts (buildFinancialPayload, mapFinancialToForm),
                     entityFormSerialization.ts (buildPayload, mapApiToForm, sketch flatten/unflatten)
    constants/     — PAYMENT_METHODS, BANK_INFO, EXPENSE_TYPES, FOLDER_STATUS_MAP, status.ts (STATUS_META)
    types/         — 17+ files en inglés (EntityFormState en snake_case English)
    utils/         — translate, formatters,
                     error.ts (parseApiError — unified error message extraction),
                     pdf/buildPdfData.ts (orchestrator + re-exports),
                     pdf/pdfTypes.ts (all PDF interfaces),
                     pdf/pdfHelpers.ts (formatting/parsing utils),
                     pdf/buildSectionData.ts (row builders + section bucketing),
                     pdf/SketchImageExtractor,
                      frentePricing, additionalWorkParse, additionalWorkCalc, materialGroups, math.ts (round2)
  tsconfig.json    — path aliases (@/ → src/, @assets/ → src/assets/)
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
- **CSS tokens:** `src/index.css` define design tokens como custom properties (e.g. `--color-danger`, `--tw-green-600`, `--tw-red-100`). Usar `var(--token)` en módulos en lugar de hex hardcoded. Tabla column widths se especifican con `nth-child` rules en el CSS module del componente, no inline `style={{ width: N }}`.
- **Path aliases:** `@/` y `@assets/`. Configurados en `tsconfig.json` + `vite.config.ts`. Los aliases `@features/*` y `@shared/*` fueron eliminados en 6.3.
- **English naming (carpetas/componentes/hooks/funciones/constantes/CSS classes):** todo renombrado. Excepción: `EntityFormState` campos internos (snake_case English que matchean el backend).
- **TypeScript strict:** habilitado. `tsc --noEmit` antes de `vite build`.
- **Naming TSX:** PascalCase componentes, camelCase hooks/utils, UPPER_SNAKE_CASE constantes.
- **Repository pattern:** acceso a DB via `repositories/*.py`. Transacciones en services.
- **Service layer:** lógica de negocio en `services/*.py`. Routers solo orquestan request/response. Services heredan de `BaseService[T]` para CRUD genérico.
- **Pydantic v2:** schemas separados Base/Create/Update/Response. `ConfigDict(from_attributes=True)`. `CurrencyCodeMixin` para resolver código de moneda.
- **SQLAlchemy 2.0:** `Mapped[T]` + `mapped_column()`. No usar `relationship` lazy sin `joinedload`. `with_for_update()` en stock mutations.
- **Routers delgados:** ≤ 5 líneas de lógica. Todo en services.
- **Excepciones de dominio:** `NotFoundError`, `ConflictError`, `ValidationError` en `core/exceptions.py` (heredan de `HTTPException`, manejadas globalmente en `main.py`).
- **Error handling (frontend):** usar `parseApiError(err, fallback?)` de `src/utils/error.ts` en lugar de extraer `err.response.data.detail` inline. Silent `.catch(() => {})` reemplazados con `console.warn`/`console.error`. Promises fire-and-forget con `void promise.catch(() => {...})` para explicitar la seguridad.
- **TanStack Query:** usar `useQuery`/`useList`/`useGet` con `staleTime: 5 * 60 * 1000` para reference data (clients, materials, pools, settings). Mutation state via `queryClient.setQueryData` / `invalidateQueries`. Query keys exportadas como `const`s desde el hook.
- **PDF generation:** `utils/pdf/buildPdfData.ts` (orchestrator) + `pdfTypes.ts` + `pdfHelpers.ts` + `buildSectionData.ts` + `DocumentPdf.tsx` (frontend, `@react-pdf/renderer`). Recharts (en `ReportsCharts.tsx`) está code-split vía `React.lazy()` — solo se descarga al abrir tab de Ventas/Materiales. Legacy: `pdf_html.py` (xhtml2pdf + Jinja2).
- **Code splitting:** usar `React.lazy(() => import('./Component'))` para deps pesadas (recharts, PDFs). Wrap en `<Suspense fallback={<LoadingSpinner />}>`.
- **Numbering:** `P-000001` (budgets), `A-000001` (work_orders). Compartido en `utils/numbering.py`.
- **Status enums:** English en DB (`MEASUREMENT`, `WORKSHOP`, etc.), Spanish en UI via `t(key)` en `utils/translate.ts`.
- **React keys:** siempre usar IDs estables del data (`m.id`, `slide.title`, `d.concept + '|' + d.detail`, `s.label`, `img.slice(0, 32)`). Nunca `key={i}`.
- **Client data flow:** Budget/WorkOrder stores only `client_id` (FK) + optional `delivery_address_id` (FK → `client_addresses`). No snapshot columns. `from_orm_with_client()` resolves `client_*` fields from live `Client` row at serialization time. If `delivery_address_id` is set, `client_address` is overridden with the matching `ClientAddress.address`. `delivery_address_id` is patchable on update (both `BudgetUpdate` and `WorkOrderUpdate` include the field). Conversion paths (`create_from_budget`, `convert_alternative_to_work_order`) copy `delivery_address_id` from the source budget.

## Dashboard modales

`src/pages/dashboard/DashboardPage.tsx` — cada card abre un modal con el contenido real embebido, en vez de navegar a la URL. Las rutas del aside siguen intactas (mismo `path` que antes).

**Mapeo card → modal:**

| Card | Modal renderiza |
|---|---|
| CAJA | `<CashDailyPage />` |
| NUEVO PRESUPUESTO | `<BudgetForm onSuccess={closeModal} onCancel={closeModal} />` |
| NUEVA ORDEN | `<WorkOrderForm onSuccess={closeModal} onCancel={closeModal} />` |
| ORDENES EN MEDICION / TALLER | `<WorkOrdersListPage />` (filtro manual) |
| ORDENES TERMINADAS P/ ENVIO | `<WorkOrdersListPage initialStatus="DELIVERED" />` |
| STOCK DE PILETAS | `<PoolStockPage />` |
| MATERIALES | `<MaterialsListPage />` |
| TRABAJOS ADICIONALES | `<AdditionalWorksPage />` |
| CATEGORIAS | `<MaterialsCategoriesPage />` |
| CALCULADORA | `<CalculatorPage />` |

**Implementación:**
- State local: `useState<ModalKind | null>(null)` — un solo modal abierto a la vez
- `React.lazy(() => import('../path/Page'))` para cada page — comparte chunk con la route definition en `App.tsx`, no duplica descarga
- Un solo `<Suspense fallback={<LoadingSpinner />}>` envuelve los 10 modales
- `Modal` (de `components/ui/Modal`) provee focus trap, escape y portal; el `width` se ajusta por card (1200-1400px)

**Drill-down behavior:** cuando el usuario hace click en algo dentro de la lista (ej. "Nuevo material" desde el modal de Materiales), la página llama `useNavigate('/admin/materials/new')` → cambia la route → `DashboardPage` desmonta → `MaterialFormPage` renderiza full-page. El modal desaparece naturalmente (cleanup del `useEffect` del `Modal` restaura `body.overflow`).

## Form callbacks (modal reuse pattern)

Para que `BudgetForm` y `WorkOrderForm` funcionen dentro de un modal sin perder la integración con `useNavigate`, ambos aceptan props opcionales:

```ts
interface BudgetFormProps {
  /** Reemplaza `navigate(services.listPath)` post submit/delete. */
  onSuccess?: () => void;
  /** Reemplaza `navigate(services.listPath)` al cancelar. */
  onCancel?: () => void;
}
export default function BudgetForm(props: BudgetFormProps = {}) { ... }
```

**Page mode** (default): si no se pasan props, el form usa `navigate` como antes. `App.tsx` sigue importando el default export sin cambios.

**Modal mode:** el caller pasa `onSuccess={closeModal}`. Internamente:
- `useEntityForm` recibe `onAfterAction?: () => void` → reenvía a `useFormActions`
- `useFormActions.handleSubmit` / `handleDelete` llaman `onAfterAction()` si existe, si no `navigate(listPath)` (page mode)

**Pieza clave en `useFormActions.ts`:**
```ts
if (onAfterAction) onAfterAction();
else navigate(services.listPath);
```

`WorkOrderForm` además usa `onAfterAction` para invalidar el cache de `['work-orders']` antes de cerrar el modal (antes lo hacía el wrapper de `handleSubmit`).

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

## EntityFormLayout (shared form body)

`src/components/entity/EntityFormLayout.tsx` — extrae el ~80% del JSX compartido entre `BudgetFormPage` y `WorkOrderFormPage`. Las diferencias por página se manejan vía props/slots:

- `beforeLayout` — slot para secciones extra antes del grid (WO: `WorkOrderFormStatus` + `WorkOrderFormSnapshot` envueltos en `__card-section`)
- `observations` — slot para el wrapper de observaciones (`BudgetFormObservations` o `WorkOrderFormObservations`)
- `terms` — array configurable con título/items/onChange por card (Budget: sin terms; WO: entrega + garantía)
- `alternativasGrid` — `QuoteOptionsGrid` o `AlternativeBudgetGrid`
- `discountBlock` — slot opcional (solo WO)
- `extraDialogs` — slot para ConfirmDialogs adicionales (Budget: convertir a OT + alternativa)
- `specsCardClassName` — className custom para `EntityFormSpecs` (WO agrega `specs-card`)
- `fabricationShowMeasurementComparison` / `fabricationMaterialsData` — props extra para `FabricationSection` (solo WO)
- `prefix` — prefijo CSS (`'budget-form__'` o `'work-order-form__'`) para los class names de los cards

El header (FormHeader con botones de status/approve/convert/WhatsApp) queda en cada página porque es demasiado diferente para abstraer.

## Frontend unit tests (vitest)

**Setup:** `vitest@1.6.1` + `@testing-library/react@16.3.2` + `@testing-library/jest-dom@6.9.1`. Environment `jsdom`. `tsc --noEmit` debe estar limpio antes de `vitest run` (archivos `.test.tsx` para JSX, `.test.ts` para lógica pura).

**Ubicación:** co-localizado junto al módulo testeado (`src/hooks/useX.test.ts`, `src/utils/pdf/buildPdfData.test.ts`, `src/components/X/X.test.tsx`).

**Estrategia:**
- **Hooks** (pure logic): `renderHook` con `useState` real para capturar el resultado de `useEffect`/`useMemo`. Para hooks que usan TanStack Query, wrap con `QueryClientProvider` y `QueryClient` con `retry: false`.
- **Render:** `render(<Component />)` + `screen.getByText/Role/Title` para asserts. Wrap con `MemoryRouter` si el componente usa `useNavigate`.
- **Errores/silencios:** los tests deben validar que los errores se surfacean al caller, no que se swallean silenciosamente.

**Coverage actual (123 tests, 11 archivos):**
- `src/hooks/useConfirmPayment.test.tsx` — 5 tests (id undefined, flip ambos sentidos, error no swallow, query keys distintos)
- `src/hooks/useBudgetQuoteCalculations.test.ts` — 10 tests (breakdown, materials split, sumatorias, useMemo)
- `src/hooks/useBudgetCalculations.test.tsx` — 9 tests (totals, descuentos, recargo cuotas, alternativa override, deposit, USD=0)
- `src/utils/pdf/buildPdfData.test.ts` — 16 tests (routing, descuentos, recargo, terms override, edge cases)
- `src/pages/budgets/BudgetTable.test.tsx` — 10 tests (render, empty, Aprobar/Rechazar, A OT, callbacks)
- `src/components/common/WorkOrdersTable/WorkOrdersTable.test.tsx` — 12 tests (render, status buttons, terminal "—", callbacks)
- `src/components/ui/StatusBadge/StatusBadge.test.tsx` — 2 tests
- `src/hooks/entityFormHelpers.test.ts` — 26 tests (FinancialBase round-trip, payload serialization)
- `src/hooks/useAdditionalWorkSelection.test.ts` — 11 tests
- `src/utils/frentePricing.test.ts` — 17 tests
- `src/utils/materialGroups.test.ts` — 5 tests

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
npx vitest --run           # unit tests (123/123)
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

## Upload paths (Settings)

Constantes de upload centralizadas en `app/core/settings.py` (Pydantic):

```python
PRODUCT_PHOTOS_DIR: str = "uploads/product_photos"
MATERIALS_DIR: str = "uploads/materials"
LOGOS_DIR: str = "uploads"
MAX_UPLOAD_FILE_SIZE: int = 30 * 1024 * 1024  # 30 MB
MAX_UPLOAD_DIMENSION: int = 1920
```

Properties que resuelven la ruta absoluta (relativa a `BASE_DIR = afamar-backend/`):
- `settings.product_photos_abs_dir` → `Path` (usado por `services/product_photo.py`)
- `settings.materials_abs_dir` → `Path` (usado por `api/routers/materials.py`)
- `settings.logos_abs_dir` → `Path` (usado por `api/routers/settings.py` para logo upload)

## Schema legacy

- **`online_budgets`** — tabla dropeada via migración `11e4cc1657da`. Sin código activo.
- **`BudgetAdicional`** legacy table — preservada como read-only. `BudgetService.create/update` ya no escriben filas nuevas (el `create` aún acepta la lista legacy en el input por compat y la convierte on-the-fly a `additional_works_data` JSON). `work_order.py:convert_alternative_to_work_order` la lee para propagar a la OT nueva. Drop completo requiere migración one-time.
- **`app/services/pdf.py` (740 LOC, reportlab)** — eliminado (6.11). 100% sin imports, superseded por `pdf_html.py` (xhtml2pdf) para downloads/email y `@react-pdf/renderer` para preview. `reportlab` se mantiene en requirements.txt (lo usa `pdf_html.py` para el footer de páginas).
