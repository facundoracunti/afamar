# AGENTS.md

> **Estado:** Rama `development`. Última sesión 2026-08-27: **arranque confiable** — fix de migraciones para MySQL (`existing_type` en `alter_column`), sync de seeders con el catálogo de producción (dedup) y log de readiness. Ver "Fixes de arranque + seeders sync 2026-08-27" y ADR 0008 abajo.
> `tsc --noEmit` 0 errores · `vite build` ~22s, gzip ~497 KB · vitest **191/191** · pytest **45/45** · playwright **108/108**. Reindex de codebase-memory realizado (commit de esta sesión).
>
> **Índice del conocimiento (codebase-memory):** **reindexado** el 2026-08-27 junto con el commit de esta sesión. ADR de arquitectura persistido en el índice (`manage_adr`) + ADR de decisión commiteado en `docs/adr/0008-database-migrations-and-seeder-sync.md`. El ADR de Fase 7 sigue en `docs/adr/0007-payment-methods-catalogue.md`.

## Índice del conocimiento (codebase-memory)

- **Reindexado (2026-08-27):** `index_repository(repo_path=D:\projects\PERSONAL\afamar, name=afamar, mode=full, persistence=true)` → **4003 nodos / 14073 aristas**. Artefacto `.codebase-memory/graph.db.zst` commiteado en el commit de esta sesión. Incluye Fase 7 (payment methods) + fixes UX + arranque/migraciones/seeders.
- **ADR de arquitectura (índice):** `manage_adr(project="afamar")` persiste PURPOSE/STACK/ARCHITECTURE/PATTERNS/TRADEOFFS/PHILOSOPHY (poblado el 2026-08-27). Para decisiones por-cambio (numbered ADRs) ver `docs/adr/0007-payment-methods-catalogue.md` y `docs/adr/0008-database-migrations-and-seeder-sync.md`.
- **ADR 0008 (arranque + seeders, 2026-08-27):** toda `alter_column`/`batch.alter_column` debe llevar `existing_type` explícito (MySQL lo exige, SQLite lo omite). `_run_seeders()` devuelve resúmenes `name: +N ~N /N` y el lifespan loguea `AFAMAR initialization OK — ready to serve requests`. Seeders sincronizados con producción (dedup): materials **64**, pool_stock **68**, additional_works **13**.
- **ADR 0007 (Form, hot-path, invariantes):** contrato "el form es la fuente de verdad" (form ↔ PDF ↔ DB), hot-path de `BaseRepository.add`/`save` y `createResource.get`, el facade `useEntityForm`, los invariantes de `useBudgetCalculations` (deps deben incluir `additional_works_data`, `paymentMethodsDepsJson`, `form.installments`), `useBudgetActions.handleSubmit` con `e.preventDefault()`, los helpers `swapMaterialGroupToList` + `repointSwapReferences`, y los 4 lugares que aplican la regla del recargo de tarjeta (deben mantenerse en sync).
- **Hotspots confirmados (reindex 2026-08-27):** backend `BaseRepository.add` (32 callers, #2) / `save` (25); frontend `createResource.get` (74, #1 global), `parseApiError` (29), `LoadingSpinner` (25), `loginViaApi` (21), `createResource.update` (19), `useNotify` (19). Tras Fase 7, sumar `useBudgetCalculations.applyPaymentMethodToTotals` (4 callsites nuevos) y `paymentMethodRepository.get_by_name` (CRUD del catálogo).
- **Complejidad alta:** `usePlateCalculator` (bin-packing, loop_depth 4, cyclomatic 13), `pdf_html._sketch_to_png_base64_list` (loop_depth 3, cyclomatic 25), `WorkOrderService.update` (cyclomatic 12), `_recalculate_totals_from_items` (cyclomatic ~12 con alternativa + catálogo).
- **Clusters de-facto:** frontend core UI (102, cohesión 0.79), forms orchestration (74, 0.81), `parseApiError`+`useBudgetActions`+`buildPayload`+`useFormActions` (65, 0.81), budget/quote/fabrication/sketch (54, 0.88). Sin dependencia circular entre `app/` y `src/`.

## Reglas de operación

- **Git es manual**: NO commitear, NO pushear, NO crear PR — **solo cuando el usuario lo pida explícitamente**.
- **Inspeccionar antes de versionar**: si el usuario pide commit/PR, antes de stagear revisar `git status` + `git diff` + `git log --oneline -10`; stagear solo los archivos intencionalmente modificados; nunca commitear secretos.
- **Mensajes concisos**: estilo del repo. Si no hay convención clara, mensajes cortos en inglés o español.
- **Cero PRs automáticos**: aunque el usuario diga "todo listo", NO crear el PR.

## Stack

- **Backend:** Python 3.14 + FastAPI 0.139 + SQLAlchemy 2.0 + MySQL (swappable SQLite via `DATABASE_URL`).
- **Frontend:** Vite 6 + React 18 + TypeScript 5.9 + CSS Modules (BEM) + Axios + TanStack Query.
- **DB Migrations:** Alembic. **Auth:** JWT (HS256) + passlib bcrypt==4.1.3.
- **PDF:** `@react-pdf/renderer` (frontend, primary) + xhtml2pdf/Jinja2 (legacy backend, solo para `/api/v1/{budgets,work-orders}/{id}/pdf` download + email background).
- **Modales:** `components/ui/Modal` con focus trap + escape + portal; las páginas reales se embeben en modales desde el dashboard (ver "Dashboard modales").
- **Tests:** pytest (backend), vitest (frontend), Playwright (E2E).

## Project structure (paths críticos)

Para el árbol completo usar `Get-ChildItem -Recurse`. Lo crítico:

**Backend (`afamar-backend/`):**
- `app/main.py` — entrypoint, lifespan: Alembic upgrade + seed admin.
- `app/api/routers/` — 20 routers: auth, clients, client_addresses, budgets, work_orders, materials, pool_stock, measurements, daily_cash, dashboard, settings, reports, search, options, references, product_photos, whatsapp, additional-works, **payment_methods** (dedicado, removido del genérico `references.py` en Fase 7).
- `app/core/` — settings (Pydantic, includes DEFAULT_USD_RATE, PRODUCT_PHOTOS_DIR, MATERIALS_DIR, LOGOS_DIR, MAX_UPLOAD_FILE_SIZE, MAX_UPLOAD_DIMENSION + properties `*_abs_dir`), exceptions (NotFoundError, ConflictError, ValidationError).
- `app/models/` — ORM (incluye **payment_method** con FK desde budget/work_order; cols extra `type`/`value`/`is_percentage`/`applies_to_installments` desde migración `b3c4d5e6f7a9`).
- `app/schemas/` — Pydantic Create/Update/Response separados + CurrencyCodeMixin. **Agregar `payment_method_id` a Base/Update** (Fase 7 fix) para que GETs lo expongan y PUTs lo acepten.
- `app/services/` — base.py (BaseService[T] generic CRUD) + auth, budget, work_order, **payment_method** (CRUD + validación), pdf_helpers, stock_helpers, pdf_html (legacy xhtml2pdf).
- `app/repositories/` — 12 repos SQLAlchemy con joinedload eager loading.
- `app/utils/` — currency, client_helpers, logger, responses, pagination, numbering.
- `app/templates/` — budget_pdf.html, work_order_pdf.html (Jinja2, legacy).
- `alembic/versions/` — **`b3c4d5e6f7a9`** = catalog payment_methods con 4 cols; **`d5e6f7a8b9c0`** = installment_detail_ars/usd en budgets/work_orders.
- `scripts/seeders/` — base.py, **payment_methods.py** (Fase 7), additional_works.py, material_colors, …

**Frontend (`afamar-frontend/src/`):**
- `api/` — http.ts (Axios con envelope unwrap + 401 redirect) + resources/ (13+ domain files, **paymentMethods.ts** en Fase 7) + hooks.ts (TanStack Query hooks).
- `pages/` — English names, *.module.css co-localizado. Módulos: auth, home, dashboard, clients, budgets, work-orders, materials, pool-stock, measurements, cash, calculator, **configuration (Datos AFAMAR + PaymentMethods en tabs)**, reports, online-budgets, additional-works.
- `components/`:
  - `ui/` — primitivas (Button, Modal, StatusBadge, ListPage).
  - `entity/` — EntityFormFinancial, EntityFormSpecs, EntityFormClient + **EntityFormLayout** (shared form body, usado por BudgetFormPage y WorkOrderFormPage; slots: beforeLayout, observations, terms, alternativasGrid, discountBlock, extraDialogs, specsCardClassName, fabricationShowMeasurementComparison, fabricationMaterialsData, prefix).
  - `budget/` — **BudgetPanel** (orchestrator) + **BudgetCurrencyColumn** (ARS/USD) + **BudgetLineItems** (CONCEPTO/SUBTOTAL list; `DetailRow` con `displayValue`/`arsEquivalent`) + **BudgetPaymentSection** (payment block + tabla 3-columnas de cuotas) + BudgetPanelContext, OnlineBudgetHeader, FabricationTable, QuoteOptionsGrid, OnlineItemsTable, AdditionalWorkSection, AdditionalWorkCard, AdditionalMaterial.
  - `configuration/` — **PaymentMethodsTable** + **PaymentMethodForm** (Fase 7) + PaymentMethods (page, montado desde ConfigurationPage tab).
  - Otros: `common/` (Loading, ConfirmDialog, PdfPreviewModal, ClientHistoryCard, WorkOrdersTable, AdditionalWorksTable, AdditionalWorkForm, MeasurementPhotoGrid, LinearMetersInput), `cash/`, `materials/`, `pool-stock/`, `orders/` (ClientSection, ClientTypeahead, AddressPicker, NewClientModal, ClientInfoCard, ApprovalSection, ObservationsSection, FormHeader, FormFooter), `sketch/`, `signature/`, `calculator/` (PorcelainTileCalculator + PorcelainCalculatorSection embebida en Presupuesto/OT, full + wizard modes), `measurements/`, `home/`.
- `hooks/` — **useEntityForm** (facade → 7 composables), **useBudgetCalculations** (hook central del recargo: applyPaymentMethodToTotals + incrementalInterestRatio + computeInstallmentDetail; deps incluyen paymentMethodsDepsJson), usePdfPreview, useConfirmPayment, useAdditionalWorkSelection, useBudgetActions (acepta `paymentMethods?` post-Fase 7), useBudgetQuoteCalculations, useClientAddresses, usePlateCalculator (bin-packing), useFormReferences (TanStack Query con staleTime: 5min; exporta **PAYMENT_METHODS_KEY**), usePdfPreviewController (shared PDF preview state; acepta `paymentMethods?` y los propaga a buildPdfData), entityFormHelpers (re-export hub + swap helpers), entityFormConstants, entityFormFinancial (buildFinancialPayload, mapFinancialToForm), entityFormSerialization (buildPayload + mapApiToForm).
- `constants/` — PAYMENT_METHODS, BANK_INFO, EXPENSE_TYPES, FOLDER_STATUS_MAP, status.ts (STATUS_META).
- `types/` — 18+ files (EntityFormState snake_case English; **paymentMethod.ts** con PaymentMethod + PaymentMethodType + PaymentMethodCreate).
- `utils/` — translate, formatters, error.ts (parseApiError), pdf/buildPdfData.ts (orchestrator) + pdfTypes.ts + pdfHelpers.ts + buildSectionData.ts + SketchImageExtractor, frentePricing, additionalWorkParse, additionalWorkCalc, materialGroups, math.ts (round2).
- `tsconfig.json`, `vite.config.ts` — path aliases `@/` y `@assets/`; proxy /api → http://localhost:3090.

## Key conventions

- **BEM + CSS Modules:** cada page tiene `X.module.css` co-localizado. `import styles from './X.module.css'; const s = styles as unknown as Record<string, string>; // <div className={s['x__title']}>`.
- **CSS tokens:** `src/index.css` define design tokens como custom properties (`--color-danger`, `--tw-green-600`, etc.). Usar `var(--token)` en lugar de hex hardcoded. Tabla column widths con `nth-child` rules en el CSS module del componente, no inline `style={{ width: N }}`.
- **Path aliases:** `@/` y `@assets/`. (Los aliases `@features/*` y `@shared/*` fueron eliminados en 6.3.)
- **English naming** (carpetas/componentes/hooks/funciones/constantes/CSS classes): todo renombrado. Excepción: `EntityFormState` campos snake_case English matcheando backend.
- **TypeScript strict** + `tsc --noEmit` antes de `vite build`. Naming: PascalCase componentes, camelCase hooks/utils, UPPER_SNAKE_CASE constantes.
- **Repository pattern** (backend): SQLAlchemy puro. Transacciones en services. **Service layer**: lógica en `services/*.py`, routers ≤ 5 líneas.
- **Pydantic v2:** schemas Base/Create/Update/Response separados. `ConfigDict(from_attributes=True)`. `CurrencyCodeMixin` para resolver código de moneda.
- **SQLAlchemy 2.0:** `Mapped[T]` + `mapped_column()`. No usar `relationship` lazy sin `joinedload`. `with_for_update()` en stock mutations.
- **Excepciones de dominio:** `NotFoundError`, `ConflictError`, `ValidationError` en `core/exceptions.py` (heredan de `HTTPException`, manejadas globalmente en `main.py`).
- **Error handling (frontend):** usar `parseApiError(err, fallback?)` de `src/utils/error.ts`. Silent `.catch(() => {})` reemplazados con `console.warn`/`console.error`. Promises fire-and-forget con `void promise.catch(() => {...})`.
- **TanStack Query:** `useQuery`/`useList`/`useGet` con `staleTime: 5 * 60 * 1000` para reference data. Mutation state via `setQueryData` / `invalidateQueries`. Query keys exportadas como `const`s desde el hook.
- **PDF generation:** `utils/pdf/buildPdfData.ts` (orchestrator) + `pdfTypes.ts` + `pdfHelpers.ts` + `buildSectionData.ts` + `DocumentPdf.tsx` (`@react-pdf/renderer`). Recharts code-split via `React.lazy()`. Legacy: `pdf_html.py` (xhtml2pdf + Jinja2).
- **Code splitting:** `React.lazy(() => import('./Component'))` para deps pesadas. Wrap en `<Suspense fallback={<LoadingSpinner />}>`.
- **Numbering:** `P-000001` (budgets), `A-000001` (work_orders). Compartido en `utils/numbering.py`.
- **Status enums:** English en DB (`MEASUREMENT`, `WORKSHOP`, …), Spanish en UI via `t(key)` en `utils/translate.ts`.
- **React keys:** siempre IDs estables del data (`m.id`, `slide.title`, `d.concept + '|' + d.detail`, `s.label`, `img.slice(0, 32)`). Nunca `key={i}`.
- **Client data flow:** Budget/WorkOrder stores only `client_id` (FK) + optional `delivery_address_id` (FK → `client_addresses`). No snapshot columns. `from_orm_with_client()` resolves `client_*` from live `Client` row. If `delivery_address_id` is set, `client_address` is overridden with the matching `ClientAddress.address`. `delivery_address_id` is patchable on update. Conversion paths copy it from the source budget.
- **Submit button pattern:** `useFormActions.handleSubmit` MUST call `e.preventDefault()` (else `<button type="submit">` triggers a native form GET that aborts the in-flight PUT). Mirror el mismo `e?.preventDefault()` en cualquier router sibling.
- **Totals effect deps:** `useBudgetCalculations` deps array must include `JSON.stringify(...)` for EVERY form slice it reads (incl. `additional_works_data`, `paymentMethodsDepsJson`, `form.installments`), else SUBTOTAL/TOTAL/SALDO PENDIENTE van stale y no matchean el PDF. Extract cada `JSON.stringify(...)` a una variable local stable antes del `useEffect`.
- **Material swap helpers:** `swapMaterialGroupToList` (identity swap in `materials_data`) + `repointSwapReferences(form, oldNames, newName)` (renames `pools_data[].material`, `fabrication_details[].material`, `additional_works_data[].materialName`/`material_name` — honoring `__ALT__:` alternative prefix; preserves `POOL_MATERIAL_GLOBAL`, empty links, and unknown additional-work fields). Both consumed together por `useFormMaterials.swapMaterialGroup` via un solo functional `setForm`.
- **Derived UI lists, no local mirrors:** `selections`, `materials_list`, etc. deben derivarse en cada render desde el form slice padre (parse JSON on read), no mirror en `useState` local sincronizado via `useEffect`. El viejo `useAdditionalWorkSelection` tenía un local mirror con `JSON.stringify` bailout que se desincronizaba.
- **E2E auth:** always `loginViaApi(page, request)` from `e2e/helpers/login.ts` to avoid the 5/min `/auth/login` rate-limit of `loginAsAdmin`.

## Dashboard modales

`src/pages/dashboard/DashboardPage.tsx` — cada card abre un modal con el contenido real embebido, en vez de navegar a la URL. Las rutas del aside siguen intactas.

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

**Implementación:** `useState<ModalKind | null>(null)` (un solo modal abierto a la vez). `React.lazy(() => import('../path/Page'))` para cada page (comparte chunk con la route). Un solo `<Suspense fallback={<LoadingSpinner />}>` envuelve los 10 modales. `Modal` provee focus trap, escape y portal; el `width` se ajusta por card (1200-1400px). **Drill-down:** el `useNavigate` desmonta el dashboard y el modal desaparece naturalmente (cleanup del `useEffect` del `Modal` restaura `body.overflow`).

## Form callbacks (modal reuse pattern)

Para que `BudgetForm` y `WorkOrderForm` funcionen dentro de un modal sin perder la integración con `useNavigate`, ambos aceptan props opcionales:

```ts
interface BudgetFormProps {
  onSuccess?: () => void;  // reemplaza navigate(services.listPath) post submit/delete
  onCancel?: () => void;   // reemplaza navigate(services.listPath) al cancelar
}
export default function BudgetForm(props: BudgetFormProps = {}) { ... }
```

**Page mode** (default): si no se pasan props, el form usa `navigate` como antes.
**Modal mode:** el caller pasa `onSuccess={closeModal}`. Internamente: `useEntityForm` recibe `onAfterAction?: () => void` → reenvía a `useFormActions`. Pieza clave: `if (onAfterAction) onAfterAction(); else navigate(services.listPath);` en `useFormActions.handleSubmit` / `handleDelete`. `WorkOrderForm` además usa `onAfterAction` para invalidar el cache de `['work-orders']` antes de cerrar el modal.

## EntityFormState (form state)

`EntityFormState` en `src/types/form.ts` — snake_case English matcheando el backend:
- **Client:** `client_name`, `client_phone`, `client_address`, `client_email`, `delivery_address_id`.
- **Financial:** 17 campos de `FinancialBase` (currency, usd_rate, subtotal, transport, total, etc.).
- **Payment (Fase 7):** `payment_method: string | null` (snapshot estable, sobrevive renames del catálogo) + **`payment_method_id: number | null`** (FK al catálogo `payment_methods` — fuente de verdad; expuesto en GETs/PUTs tras el fix de esta sesión) + `installments: number` + `installment_detail_ars?: InstallmentDetailRow[]` + `installment_detail_usd?: InstallmentDetailRow[]` (form-only, recalculados por `useBudgetCalculations`, serializados por `buildPayload` a JSON string para el backend).
- **Specs:** `material`, `material_price_m2`, `color`, `thickness`, `finish`, `bacha`, `anafe`, `pool_id`, `pool_price`, `pool_currency`, `pool_image`.
- **Items:** `materials_data`, `pools_data`, `fabrication_details`, `additional_works_data`, `sketch_elements`.
- **Dates:** `date`, `delivery_date`, `signed_at`.
- **Notes:** `notes`, `design_observations`, `important_observations`.
- **Terms:** `budget_terms`, `warranty_terms`, `delivery_terms`.
- **Misc:** `number`, `status`, `digital_signature`, `work_order_number`.

`InstallmentDetailRow` = `{ cuota: number, interes: number, monto: number }` — 3-columnas de la tabla del recargo. `interes` es el porcentaje **por cuota** (`value` del catálogo, NO `N × value`). `monto` es la cuota uniforme (`(base × (1 + N × value/100)) / N`). Las N filas son idénticas en `interes` y `monto`.

`buildPayload(form)` → passthrough snake_case + JSON.stringify arrays + date serialization.
`mapApiToForm(d)` → passthrough inverso.

## useEntityForm (facade)

`src/hooks/useEntityForm.ts` — facade delgado que compone 7 composables:
- `useFormReferences` — carga materials/pools/clients/**paymentMethods**/logo, fetch next number, initial load, `updateClientAddresses`. `PAYMENT_METHODS_KEY = ['payment-methods', 'reference']` se reusa desde los list pages.
- `useFormDetails` — CRUD `fabrication_details`, refs de material.
- `useFormMaterials` — Material picker + CRUD `materials_data`.
- `useFormPools` — Pool picker + CRUD `pools_data`.
- `useFormClient` — Client typeahead (filtered + handleClientSelect).
- `useFormCalculationsInput` — Handlers transport/deposit/usd_rate.
- `useFormActions` — Submit/delete/status-change/print.

Acepta `extraPayloadFields?: () => Partial<Record<string, unknown>>` para inyecciones per-page. Solo `WorkOrderFormPage` lo usa.

## EntityFormLayout (shared form body)

`src/components/entity/EntityFormLayout.tsx` — extrae el ~80% del JSX compartido entre `BudgetFormPage` y `WorkOrderFormPage`. Slots: `beforeLayout`, `observations`, `terms` (array configurable), `alternativasGrid` (`QuoteOptionsGrid` o `AlternativeBudgetGrid`), `discountBlock` (solo WO), `extraDialogs`, `specsCardClassName`, `fabricationShowMeasurementComparison` / `fabricationMaterialsData` (solo WO), `prefix` (CSS class prefix).

El header (`FormHeader` con status/approve/convert/WhatsApp) queda en cada página porque es demasiado diferente para abstraer.

**Calculadora de porcelanato embebida:** `PorcelainCalculatorSection` se renderiza en dos lugares según el mode:
- **full mode** → zona inferior (`${prefix}bottom`), junto a `SketchSection`. Colapsada por defecto (toggle "Activar…").
- **wizard mode** → paso dedicado `Calculadora de porcelanato` en `EntityFormWizard`, después de "Diseño y plano". Arranca **abierta por defecto** (`defaultOpen`); ofrece "Ocultar…" para plegar.

El handler `addPorcelainDetail` se construye desde `state.update` y `state.form`. En `readOnly` la sección no se renderiza. El label del botón se deriva del `prefix`: `"Agregar al presupuesto"` / `"Agregar a la orden"`. La moneda sigue `modoUSD` del form.

## Frontend unit tests (vitest)

**Setup:** `vitest@1.6.1` + `@testing-library/react@16.3.2` + `@testing-library/jest-dom@6.9.1`. Environment `jsdom`. `tsc --noEmit` debe estar limpio antes de `vitest run` (archivos `.test.tsx` para JSX, `.test.ts` para lógica pura). Co-localizado junto al módulo testeado.

**Estrategia:** hooks (pure logic) usan `renderHook` con `useState` real. Para hooks con TanStack Query, wrap con `QueryClientProvider` + `QueryClient` con `retry: false`. Render usa `screen.getByText/Role/Title`. Wrap con `MemoryRouter` si el componente usa `useNavigate`. Los tests deben validar que los errores se surfacean al caller, no que se swallean silenciosamente.

**Coverage actual (191 tests, 16 archivos):**
- `src/hooks/useConfirmPayment.test.tsx` — 5
- `src/hooks/useBudgetQuoteCalculations.test.ts` — 10
- `src/hooks/useBudgetCalculations.test.tsx` — 22 (totals, descuentos, **recargo cuota 1=9%/2=13.5%/3=18% con `incrementalInterestRatio`**, alternativa override, deposit, USD=0/+27%, additional_works_data re-pointing deps, **detalle de cuotas con interes incremental**)
- `src/utils/pdf/buildPdfData.test.ts` — 25 (routing, descuentos, recargo, **catalogue_installment_detail con interes incremental**, terms override, edge cases)
- `src/pages/budgets/BudgetTable.test.tsx` — 10
- `src/components/common/WorkOrdersTable/WorkOrdersTable.test.tsx` — 12
- `src/components/ui/StatusBadge/StatusBadge.test.tsx` — 2
- `src/components/entity/EntityFormWizard.test.tsx` — 2
- `src/components/measurements/PendingMeasurementCards/PendingMeasurementCards.test.tsx` — 2
- `src/hooks/entityFormHelpers.test.ts` — 40 (FinancialBase round-trip, payload serialization, `swapMaterialGroupToList` + `repointSwapReferences` swap helpers)
- `src/hooks/useAdditionalWorkSelection.test.ts` — 15
- `src/components/budget/BudgetPanel/BudgetLineItems.test.tsx` — 10 (renders one line per additional work, omits zero subtotals, **[GLOBAL] markers**, **alt-linked items hidden**, **USD item shows real peso equivalent** — agregado en esta sesión)
- `src/utils/frentePricing.test.ts` — 19
- `src/utils/materialGroups.test.ts` — 5
- `src/utils/porcelainCalculator.test.ts` — 10
- `src/components/budget/BudgetPanel/BudgetPanel.test.tsx` — 2

**Backend (45 tests):**
- `tests/test_work_order_recalc.py` — 5 (recalc server-side: 1 cuota = 9%, 3 cuotas = 18%, additional_works, alt override, manual discount antes de catalogue).
- `tests/test_work_order_update.py` — 6 (suite nueva 2026-08-26: regression del `TypeError` en PATCH con `materials_data` en MEDICION, PATCH + payment_method_id + 3 cuotas, PATCH + discount_percentage, PATCH + status flip, PATCH sin line-items (no recalc), PATCH + deposit).
- `tests/test_pdf_catalogue_adjustment.py` — 7 (`_resolve_catalogue_adjustment`: NONE/3-cuotas/1-cuota/2-cuotas/percentage-discount/fixed-discount/name-fallback/manual+manual).
- Resto: smoke + integración pre-existentes.

## Client address selection

**Two code paths:**
1. **`ClientSection`** (`components/orders/ClientSection/`) — when NO client is selected yet (typeahead mode). Renders typeahead + address picker dropdown + Domicilio input. Picker shows when client has >1 address; includes inline "add new address" input + button. Sets both `delivery_address_id` and `client_address`.
2. **`BudgetFormClient` / `WorkOrderFormClient`** — when client IS already selected (read-only mode). Renders `ClientInfoCard` + address picker row. Picker shows `<select>` (when >1 address) or readonly input (1 address) + "Nueva dirección" input + `+` button. Sets both `delivery_address_id` and `client_address`.

**Key behavior:** Selecting an address sets `delivery_address_id` (FK) + updates `client_address` (text). Deselecting (picking "Principal") resets `delivery_address_id` to null + resets `client_address` to `client.address`. Manually editing the Domicilio input resets `delivery_address_id` to null. Adding a new address inline calls `createClientAddress` API, appends to local `clientes` state via `onAddressAdded` → `updateClientAddresses`, and auto-selects the new address. Backend `from_orm_with_client()` resolves the override: if `delivery_address_id` is set, replaces `client_address` with the matching `ClientAddress.address` text. `delivery_address_id` is persisted on create AND update. Conversion paths copy it from source budget. PDF reads `form.client_address` directly. WhatsApp does NOT use client address (only phone + name).

## Payment Methods (Fase 7) + Fixes sobre Fase 7

Catálogo de métodos de pago en `/admin/configuration/payment-methods`. Sustituye la regla hardcodeada de tarjeta que vivía en el form.

**Modelo (`payment_methods` row):** `id`, `name` (estable, snapshot — sobrevive renames), `label` (visible), `is_active`, `sort_order`, `type` (`NONE` | `DISCOUNT` | `SURCHARGE`), `value` (float), `is_percentage` (bool), `applies_to_installments` (bool — si es `true`, escala con la cantidad de cuotas).

**4 métodos seeded** (`scripts/seeders/payment_methods.py`): `EFECTIVO`, `TRANSFERENCIA BANCARIA`, `TARJETA DE DÉBITO` (todos `type=NONE, value=0`) y `TARJETA DE CRÉDITO` (`type=SURCHARGE, value=9, is_percentage=true, applies_to_installments=true`). Idempotente. Migra los 6 legacy English names (`CASH`, `TRANSFER`, `CREDIT_CARD`, `DEBIT_CARD`, `CHECK`, `MIXED`) preservando id.

**Regla de cálculo (recargo lineal por cuota):**
```
total = base × (1 + N × value/100)
cuota = total / N  (todas uniformes)
```
Para 1 cuota colapsa a 9% flat. Para 2 cuotas, 18% (2 × 9%). Para 3 cuotas, 27% (3 × 9%). El recargo total (`N × value%`) se aplica al **total** y se divide en N cuotas iguales. La tabla 3-columnas muestra cada cuota con su `monto` (uniforme) y la columna "Interés" muestra el `value` por cuota (no el acumulado). El agregado `N × value%` aparece en la línea "Recargo (X%)" del PDF.

**Ejemplo concreto (base = 900.000, value = 9, N = 3):**
- recargo = 3 × 9% = 27%
- total = 900.000 × 1.27 = **1.143.000**
- cada cuota = 1.143.000 / 3 = **381.000** (3 filas idénticas)

**Por qué la cuota 1 ya carga interés** (vs la regla vieja `1-2 cuotas → 0%`): así es como el banco realmente cobra.

**Mismo cálculo en 4 lugares** (cualquier cambio toca los 4 + sus tests):
1. `afamar-frontend/src/hooks/useBudgetCalculations.ts` — `applyPaymentMethodToTotals` + `computeInstallmentDetail` (form hook, ARS+USD, live).
2. `afamar-frontend/src/utils/pdf/buildPdfData.ts` — bloque inline (PDF preview del form). **Recibe `paymentMethods` también en el path del form** (no solo del controller) — ver Fix #6.
3. `afamar-backend/app/services/work_order.py` — bloque inline en `_recalculate_totals_from_items` (recalc server-side de OT).
4. `afamar-backend/app/services/pdf_html.py` — `_resolve_catalogue_adjustment` (PDF legacy).

**Persistencia del detalle de cuotas** (migración Alembic `d5e6f7a8b9c0`): `installment_detail_ars` / `installment_detail_usd` (TEXT, JSON) en `budgets` y `work_orders`. El recalc del WO las serializa con `json.dumps` antes de persistir; el frontend las envía en `buildPayload` y las restaura en `mapApiToForm`. Sin este snapshot, el PDF del list page (donde el form hook no corre) no puede renderizar la tabla 3-columnas.

**UI en el form** (`BudgetPaymentSection`): `<select>` "Forma de pago" poblado dinámicamente con el catálogo. **Pre-selección al editar:** el GET retorna `payment_method_id` (FK) desde `mapFinancialToForm`, y el select usa `value={form.payment_method_id ?? form.payment_method ?? ''}` para matchear las options (que tienen `value={pm.id}`). Si `applies_to_installments=true`, segundo `<select>` "N cuotas" con label `9%`, `18%`, `27%`... (calcula `c × value%`). Tabla 3-columnas (Cuota # / Interés / Monto) con `BudgetPanel.module.css` (`budget-panel__installment-table*`).

**UI en el PDF** (`DocumentPdf.tsx` + `document_pdf.html`):
- **Renglón del recargo** (totals block): dice **"Interés:"** + monto (no "Recargo (X%)" — el X=18 era el promedio y confundía con el 27% de la última cuota de la tabla). El porcentaje correcto está en la tabla.
- **Renglón "Forma de pago"**: "TARJETA DE CRÉDITO (N cuotas con X% de interés por cuota)" donde X es `catalogue_installment_detail[0].interes` (la base por cuota, ej. 9%), no el promedio.
- Tabla 3-columnas con header slate-100 + rows slate-200. Mismo formato en el PDF legacy.

**Configuración del interés:** se edita desde `/admin/configuration/payment-methods` → "TARJETA DE CRÉDITO" → campo "Interés por cuota (%)". El change se refleja en el form y el PDF sin redeploy (catálogo con TanStack Query, 5 min `staleTime`, re-fetcheado al invalidar `PAYMENT_METHODS_KEY`).

**Sidebar entry:** "Métodos de Pago" en el accordion CONFIGURACIÓN (entre "Datos de AFAMAR" y "Fotos de productos"). `ConfigurationPage` consolidado en `pages/configuration/ConfigurationPage.tsx` (el wrapper `DatosAfamarTab.tsx` original fue movido a `.trash/`).

**Hot-spot para próximos cambios:** la fórmula vive en 4 lugares. Si aparece un nuevo tipo (ej. "descuento progresivo por tramo de cuotas"): agregar campo al modelo `PaymentMethod` (con migración), implementar la nueva rama en los 4 lugares, actualizar los 4 tests con el caso nuevo, documentar en el ADR.

### Fixes sobre Fase 7 (esta sesión)

1. **`BudgetLineItems.tsx` `DetailRow` — bug del parámetro mal nombrado `arsTotal`.** El parámetro se llamaba `arsTotal` pero guardaba el valor en la **moneda nativa** (no en ARS). Para ítems en USD, la línea "≈" formateaba ese mismo USD con símbolo `$`, mostrando el mismo número con $ en vez del equivalente real en pesos. Renombrado: `arsTotal` → `displayValue` (valor nativo para el pill) + nuevo `arsEquivalent` (valor real en ARS, usado para la conversión de ítems USD). Actualizado el early return para chequear `displayValue` así ítems USD con `dd=0` siguen apareciendo.

2. **`BudgetLineItems.tsx` + `BudgetPanel.module.css` — color del renglón "≈" para ítems USD.** Antes siempre verde (`budget-panel__detail-value-usd`). Ahora para ítems USD se agrega el modificador `--light` (color `var(--text-primary)`) así el renglón no compite visualmente con el pill verde del valor nativo. ARS sigue verde. `usdRefClass` ahora condicional sobre `nativeCurrency`.

3. **`BudgetLineItems.tsx` — decimales de la conversión a USD.** Antes usaba `decimals: 0` ("$ 152.760" sin centavos). Ahora `decimals: 2` ("$ 152.760,00") para matchear la conversión de ítems ARS (que ya usaba 2 decimales). Ejemplo: USD 100 × rate 1000 = "≈ $ 100.000,00".

4. **`DocumentPdf.tsx` — renombre "Recargo" → "Interés" en el totals block del PDF.** El renglón decía "Recargo (18%) + $ 669.197,00" — el 18% era el promedio (avg(9, 18, 27) = 18) y confundía con el 27% de la última cuota de la tabla. Ahora dice "Interés: $ 669.197,00" (sin el % y sin el +).

5. **`DocumentPdf.tsx` — interés por cuota (no promedio) en la línea "Forma de pago".** Antes: "(3 cuotas con 18% de interés)". Ahora: "(3 cuotas con 9% de interés por cuota)" usando `catalogue_installment_detail[0].interes` (la base por cuota del catálogo).

6. **`useBudgetActions.ts` + `BudgetFormPage.tsx` + `WorkOrderFormPage.tsx` — catálogo no llegaba al `buildPdfData` del form.** El `handleSketchImagesReady` del form (vía `useBudgetActions` e inline en `WorkOrderFormPage`) no pasaba `paymentMethods` a `buildPdfData`, así que el PDF del Presupuesto (vía "VISTA PREVIA PDF" en el form) mostraba el "Forma de pago" sin la tabla de cuotas. Mismo bug que el `usePdfPreviewController` del list page ya tenía resuelto. **Fix:** `useBudgetActions` ahora acepta `paymentMethods?: PaymentMethod[]` y lo pasa a `buildPdfData`; `BudgetFormPage` se lo pasa desde `useEntityForm` (ya lo tenía). Para `WorkOrderFormPage` (que arma el PDF inline, no via hook), se agrega `paymentMethods` al `buildPdfData` directamente. Después de este fix, ambos paths (form y list page) muestran la tabla 3-columnas en el PDF.

7. **Backend — `payment_method_id` no se exponía en GETs ni se aceptaba en PUTs.** El `BudgetResponse` / `WorkOrderResponse` heredaban de `BudgetBase` / `WorkOrderBase` que solo tenían `payment_method` (string legacy) y `installments`, sin `payment_method_id` (FK). El `mapFinancialToForm` del front lo mapeaba, pero el backend nunca lo retornaba, así que el select del form (que usa `value={pm.id}`) no podía pre-seleccionar el método al editar un presupuesto/OT existente. Además, `BudgetUpdate` / `WorkOrderUpdate` no aceptaban `payment_method_id` en PUT, así que el bulk update de SQLAlchemy no tocaba la columna. **Fix:** agregar `payment_method_id: int | None = None` a `BudgetBase`, `WorkOrderBase`, `BudgetUpdate`, `WorkOrderUpdate`. La columna ya existía en la DB (migración `b3c4d5e6f7a9`), no se requirió migración nueva.

### Hotspot adicional post-Fase 7

- **`BudgetLineItems.DetailRow`** (4 callsites: fabrication, materials, pools, additional). Cualquier cambio de layout/color/formato del CONCEPTO/SUBTOTAL list toca los 4 callsites en el mismo archivo (no hay helper compartido). Patrón: cada call site computa `displayValue` (nativo) + `arsEquivalent` (ARS) + `usdTotal` (USD) y los pasa a `DetailRow`. Si se agrega un nuevo tipo de ítem (ej. mano de obra), replicar el patrón.

### Updates post-Fase 7 — infra (2026-08-26)

Bugs descubiertos mientras se escribía la capa de tests. Todos arreglados, todos con test que los cubre (ver "Capa de tests 2026-08-26" abajo).

1. **`WorkOrderService.update` → `TypeError` en PATCH con line items.** El path "presupuesto → OT → editar m² en MEDICION → Guardar" (el más común del día a día) reventaba con 500 porque la llamada al helper `_recalculate_totals_from_items(merged)` omitía el `self.repo.db` (`merged` se pasaba como `db` y `data` quedaba faltando). En `create` la llamada estaba bien, en `update` se coló un copy-paste roto. **Fix 1 línea:** `app/services/work_order.py:782` ahora pasa los 2 args. Cubierto por `test_work_order_update.py::test_update_with_materials_data_does_not_500`.

2. **`WorkOrderService.update` → `installment_detail_ars/usd` no persistido en PATCH parcial.** Mismo archivo. El "mirror step" de `update()` solo copiaba 8 keys de vuelta a `data` después del recalc (`subtotal, total, balance_due, …`) pero NO `installment_detail_ars/usd`. Así que un PATCH parcial (ej. solo `materials_data` con tarjeta 3 cuotas) borraba la tabla 3-columnas del snapshot. **Fix:** agregar las 2 keys a la lista del mirror step (`work_order.py:785-794`). Cubierto por `test_update_with_materials_data_and_payment_method`.

3. **`MaterialCategoryRepository.create` → `IntegrityError` no capturada, 500 en vez de 409.** El nombre de categoría es `unique=True`. Un POST con duplicado levantaba `IntegrityError` que subía sin handler y devolvía **500 Internal Server Error** en vez del **409 Conflict** esperado. Se reproducía cada vez que la suite E2E corría más de una vez en la misma DB (UNIQUE random del test chocaba con un leftover). **Fix:** `try/except IntegrityError` en `app/repositories/material.py:22-33` con `db.rollback()` + `raise ConflictError`. Mismo patrón se aplicaría a cualquier otra columna unique que no capture el error (auditar antes de agregar uniques).

4. **`e2e/global-setup.ts` → nombres de recursos incorrectos, 404 silencioso, datos se acumulan entre suites.** El `TABLES_TO_CLEAR` tenía `'material-categories'`, `'material-colors'`, `'material-thicknesses'` (singular, flat), pero el backend los sirve como `materials/categories`, `materials/colors`, `materials/thicknesses` (nested plural) en `app/api/routers/materials.py`. El GET contra la URL plana tiraba 404, que el helper `truncateAll` loguea con `console.warn` y sigue (best-effort) → las tablas categoría/color/espesor **nunca** se borraban. Consecuencia: ~40 categorías "Create category e2e-cat-xxxx" de corridas previas. Los tests 2 (edits) y 3 (deletes) de `05b-categories.spec.ts` fallaban por colisión de UNIQUE, que a su vez exponía el bug #3 de arriba. **Fix:** renombrar las 3 entradas en `global-setup.ts` a las URLs correctas, con comentario explicando el motivo para que no se revierta sin querer. (Los demás nombres del array — `budgets`, `work_orders`, `measurements`, `daily-cash`, `cash-movements`, `client-addresses`, `clients`, `pool-stock-movements`, `pool-stock`, `materials`, `price-history`, `additional-works`, `product-photos`, `reference-data`, `options` — sí matchean endpoints existentes y funcionan; el bug era solo en los 3 sub-recursos de materials.)

5. **Tests E2E de `05b-categories.spec.ts` asumían case preservado en `name`.** `CapitalizeNameMixin` (`app/schemas/material.py`) normaliza `name` con `v.strip().capitalize()` (legítimo — los seeds canónicos son "Cuarzos", "Granitos", "Mármoles", "Sinterizados", "General"). Los tests asumían `"Edit Category E2E-CAT-xxxx"` se guardaba tal cual; 3 asserts fallaban (comparación exacta en API GET, `toHaveValue(originalName)` en el modal de edit, `text.includes(originalName)` en el loop de búsqueda). **Fix:** cambiar los `name` a formato ya-title-case (`"Create category ${UNIQUE.toLowerCase()}"`) para que sobrevivan el `capitalize()`. No se tocó el comportamiento del backend — la app real sigue capitalizando.

## Fixes de arranque + seeders sync 2026-08-27

Sesión de **arranque confiable** (ver ADR `docs/adr/0008-database-migrations-and-seeder-sync.md`).

1. **Migraciones MySQL: `alter_column` sin `existing_type`.** `alembic upgrade head` fallaba en MySQL porque dos migraciones usaban `op.alter_column`/`batch.alter_column` sin `existing_type` (argumento obligatorio en MySQL, omitido en SQLite). El fallback `command.stamp(head)` de `run_migrations()` enmascaraba el fallo (marcaba la DB "en head" con el schema a medias), lo que rompía los seeders. **Fix:** agregar `existing_type` en `c2d3e4f5a6b8_add_currencies_table.py` (`sa.Integer()` en `materials.currency_id`/`pool_stock.currency_id`) y en `33eba7752f2d_rename_adicionales_to_additional_works.py` (`sa.Text()` en los 4 renames + `import sqlalchemy as sa`). **Regla:** toda `alter_column`/`batch.alter_column` lleva `existing_type` explícito.

2. **Seeders sincronizados con producción (dedup).** El catálogo local estaba desactualizado respecto a la DB real. Se replicó producción **deduplicada** (una fila canónica por ítem lógico, sin duplicados por capitalización ni nombres con encoding corrupto): materials **64** (antes 60, +4), pool_stock **68** (antes 48, +20), additional_works **13** (antes 7, +6). Los seeders ya son idempotentes; re-seedear no duplica ni pisa precios manuales.

3. **Log de readiness.** `_run_seeders()` captura cada `SeedResult` y devuelve resúmenes `name: +N ~N /N`; el lifespan loguea `Seeders done:` + `AFAMAR initialization OK — ready to serve requests` + Frontend URL. Ya no termina en silencio tras `seeders.users: Created admin user 'admin'` (el cual parecía un cuelgue).

4. **Testing:** resúmenes verificados (todo skipped contra `afamar-project` poblado), pytest **45/45**, app recargada sirve HTTP 200 en `:3095`.

## Capa de tests 2026-08-26

Sesión dedicada a automatizar lo más posible los flujos manuales. Resultado: **suite unificada `npm run test:all`** que corre todo encadenado (pytest + vitest + playwright), más un **E2E del flujo cotidiano completo** y 6 unit tests nuevos del path `WorkOrderService.update`.

**Comando único:**

```bash
# en afamar-frontend/
npm run test:all    # 45 pytest + 191 vitest + 108 E2E encadenados (~4-5 min)
```

`test:unit` corre solo pytest + vitest (sin E2E, ~30s). `test:e2e` corre solo playwright (~3-4 min). No hay hooks pre-commit ni pre-push por regla del proyecto — el operador decide cuándo correr la suite.

**E2E del flujo cotidiano** (`e2e/work-orders/17-full-daily-flow.spec.ts`):

Recorre el día completo del operador en 7 pasos, end-to-end contra backend + UI reales:

1. Seed `seedDailyBudget` (cliente + 2 materiales [main + alternativo] + pileta + trasforo + zócalos + TARJETA 3 cuotas) via API.
2. Abre el presupuesto, verifica totales (SUBTOTALES, TOTAL ARS, SALDO PENDIENTE, Forma de pago).
3. Aprueba desde el listado (`/admin/budgets?estado=ALL`, columna Flujo).
4. Click "A OT" → "Convertir" → navega a la OT en MEDICION.
5. **Edita el `length` de un material en la OT + click Guardar** → este paso es la regresión sentinel del bug #1 de arriba (pre-fix: 500; post-fix: 200 + `materials_data` persistido + `total > 0`).
6. Avanza la OT MEASUREMENT → WORKSHOP → FINISHED → DELIVERED desde la columna "Avanzar estado" del listado (verifica via API cada step, no matchea el label traducido).
7. PDF preview desde el listado + download endpoint (`%PDF` magic + `%%EOF` trailer).

Captura 7 screenshots por sector (`shot-cross-daily-*`) que se embeben en el `test_report.html` del reporter custom. ~13s cuando corre solo, incluido en la suite completa de ~4 min.

**Unit tests nuevos** (`tests/test_work_order_update.py`):

6 tests del path `WorkOrderService.update` end-to-end contra SQLite in-memory (no solo del `_recalculate_totals_from_items` aislado, que ya tenía cobertura):

| Test | Cubre |
|---|---|
| `test_update_with_materials_data_does_not_500` | **Regression sentinel del bug #1** |
| `test_update_with_materials_data_and_payment_method` | Sentinel del bug #2 (installment_detail persiste en PATCH) |
| `test_update_with_materials_data_and_discount_percentage` | Manual discount + recalc en el mismo PATCH |
| `test_update_advances_status_measurement_to_workshop` | Edit m² + flip status en el mismo PATCH (operador real hace esto) |
| `test_update_with_no_line_item_keys_skips_recalc` | PATCH de metadata puro (notas) no recalcula |
| `test_update_deposit_persists_and_creates_cash_movement` | Seña se persiste en MEDICION |

**Patrón de los fixtures** (`fresh_db`): pre-seeda los 4 payment methods + 1 cliente + 1 WO en MEDICION (status PENDING al setUp). Cada test modifica el WO via `service.update(1, {...})` y assertea el resultado + re-GET a la DB. Reutiliza el patrón de `test_work_order_recalc.py::pm_session`.

**Por qué unit del `update()` y no solo del helper aislado:** el helper `_recalculate_totals_from_items` ya tenía 5 tests (en `test_work_order_recalc.py`). El bug #1 NO estaba en el helper — estaba en el call site (`WorkOrderService.update` línea 782). El helper funcionaba bien aislado; el bug era que `update()` no le pasaba bien los args. Test del `update()` end-to-end es lo que lo hubiera cazado.

**Cobertura resultante:**

| Capa | Antes | Después | Delta |
|---|---|---|---|
| pytest (backend) | 39 | 45 | +6 (`test_work_order_update.py`) |
| vitest (frontend) | 191 | 191 | =0 (no se tocaron) |
| playwright (E2E) | ~60 | 108 | +48 (17-full-daily-flow.spec.ts + categorías arregladas que ahora pasan) |
| **TOTAL** | **~290** | **344** | **+54** |

**Decisiones de scope que NO se tomaron (a propósito):**

- No se hicieron E2E para flujos satellite (caja diaria, métodos de pago, comparativa de medición, conversor de moneda). Son importantes pero más aislados. Si querés automatizarlos, decime cuál primero y armo el spec.
- No se llevó la cobertura E2E a 100% (cada feature × cada edge case). La cobertura del flujo cotidiano es **alta en los journeys críticos** (los que más te rompen), no exhaustiva. E2E 100% = frágil y caro de mantener, los bugs lógicos se siguen cazando con unit.
- No se agregó pre-commit / pre-push hook (la regla del proyecto es "git es manual").

## DB Maintenance Scripts

`afamar-backend/scripts/`. Run con el venv Python del proyecto.

```bash
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py             # dry-run
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix       # fix automático
.\venv\Scripts\python.exe scripts/fix_corrupt_work_orders.py --fix --interactive

# Docker
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py
docker exec afamar-backend python scripts/fix_corrupt_work_orders.py --fix
```

Checks: JSON column corruption, FK orphans (client_id, delivery_address_id, budget_id), Pydantic serialization errors.

## E2E Tests (Playwright)

- **Stack:** `@playwright/test@1.61.1` + Chromium.
- **Estructura por módulo** (espejo de `src/pages/`): `afamar-frontend/e2e/{auth,clients,budgets,work-orders,materials,pool-stock,additional-works,measurements,calculator,cash,reports,configuration,product-photos,dashboard,smoke,edge-cases}/`. Helpers compartidos en `e2e/helpers/`.
- **Prefijo numérico** (00, 01, 02…) define el orden de corrida. Sub-features usan sufijo letra (02b, 05b).
- **Config:** `playwright.config.ts` — `webServer` auto-arranca backend (uvicorn 3095) + frontend (vite 3090). `workers: 1`, `fullyParallel: false`, `retries: 0 local / 2 CI`.
- **Gap post-Fase 7 (ver `PLAN.md` P3):** el sub-directorio `configuration/` cubre Datos de AFAMAR pero **no tiene E2E del CRUD de Métodos de Pago** ni del flujo "elegir Tarjeta de crédito + 3 cuotas y ver el recargo/tabla en el PDF preview". Tests unitarios (`useBudgetCalculations`, `buildPdfData`) y backend (`test_work_order_recalc`, `test_pdf_catalogue_adjustment`) cubren la fórmula, pero un E2E de smoke del flujo completo es la pieza que falta.
- **E2E del flujo cotidiano (2026-08-26):** `e2e/work-orders/17-full-daily-flow.spec.ts` recorre presupuesto "full" → aprobar (desde el listado) → convertir a OT → cambiar m² en MEDICION (regresión del bug 500) → MEASUREMENT → WORKSHOP → FINISHED → DELIVERED (vía columna "Avanzar estado" del listado) → PDF preview + download. **Regresión sentinel** del path más común del día. ~13s. Ver `Capa de tests 2026-08-26` abajo para más detalle.
- **Login:** siempre `loginViaApi(page, request)` de `helpers/login.ts` (evita el rate-limit de `/auth/login` 5/min del `loginAsAdmin`).
- **Datos únicos:** `const UNIQUE = \`E2E-${Math.random().toString(36).slice(2, 7)}\`;` por test. Cleanup best-effort.
- **Cleanup global (global-setup.ts):** el `TABLES_TO_CLEAR` lista los endpoints a truncar antes de la suite. Importante: los sub-recursos de `materials` van nested (`materials/categories`, `materials/colors`, `materials/thicknesses`), no flat — el helper loguea warn y sigue si el endpoint tira 404, así que un nombre mal escrito **silenciosamente no borra nada** y los datos se acumulan entre suites (ver bugs en "Updates post-Fase 7 — infra").
- **Scripts:** `npm run test:e2e` (headless), `npm run test:e2e:ui` (Playwright UI), `npm run test:e2e:debug`, `npm run test:unit` (pytest + vitest, sin E2E), `npm run test:all` (unit + E2E encadenado).

## Commands

```bash
# Backend (puerto 3095)
cd afamar-backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 3095
python seed_admin.py
alembic upgrade head
pytest                                # 45/45

# Frontend (puerto 3090)
cd afamar-frontend
npm install
npm run dev
npm run build                         # tsc --noEmit && vite build
npm run lint
npm test                              # 191/191 (vitest)
npm run test:e2e                      # 108/108 (playwright)
npm run test:unit                     # pytest + vitest
npm run test:all                      # unit + E2E encadenado (~4-5 min)
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

Properties que resuelven la ruta absoluta (relativa a `BASE_DIR = afamar-backend/`): `settings.product_photos_abs_dir`, `settings.materials_abs_dir`, `settings.logos_abs_dir` (todos → `Path`).

## Schema legacy

- **`online_budgets`** — tabla dropeada via migración `11e4cc1657da`. Sin código activo.
- **`BudgetAdicional`** legacy table — preservada como read-only. `BudgetService.create/update` ya no escriben filas nuevas (el `create` aún acepta la lista legacy en el input por compat y la convierte on-the-fly a `additional_works_data` JSON). `work_order.py:convert_alternative_to_work_order` la lee para propagar a la OT nueva. Drop completo requiere migración one-time.
- **`app/services/pdf.py` (740 LOC, reportlab)** — eliminado (6.11). 100% sin imports, superseded por `pdf_html.py` (xhtml2pdf) para downloads/email y `@react-pdf/renderer` para preview. `reportlab` se mantiene en requirements.txt (lo usa `pdf_html.py` para el footer de páginas).
