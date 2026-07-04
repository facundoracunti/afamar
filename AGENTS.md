# AGENTS.md

> **Estado:** Rama `refactor` con commits pendientes: logo PNG upload, PDF preview backend, sidebar colapsable, configuration page refactor, **rename completo a inglés**, **client select dropdown + new client modal**, **stock deduction fixes**, **dead code cleanup**, **`default_usd_rate` setting**, **layout fixes**.
> Ver `PLAN.md` para el roadmap completo de migración.

## Stock deduction & dead-code cleanup (sesión actual)

### TanStack Query migration — PLAN.md #10 ✅ (round 2)

Segunda vuelta: migré las 4 páginas restantes que aún usaban `useState`+`useEffect` para fetching. Ahora **TODAS** las páginas con fetching usan TanStack Query (`useList`/`useGet`/`useCreate`/`useUpdate`/`useDelete` de `src/api/hooks.ts`).

| Page | Antes | Después |
|---|---|---|
| `ClientFormPage.tsx` | `useState<loading>` + `useEffect` que llama `getClient` + setState cliente/historial | `useGet(['client', id], async () => (await getClient(id)).data, !!id)` + `useEffect` que sincroniza cache → local state |
| `MeasurementFormPage.tsx` | `useState<loading>` + `useEffect` que llama `getMeasurement` + setState form | `useGet<Measurement>(['measurement', id], ..., !!id)` |
| `OnlineBudgetFormPage.tsx` | 5 `useEffect` para materials/pools/next#/onlineBudget + setState locales | `useList<Material>` + `useList<Pool>` + `useGet<nextNumber>` + `useGet<OnlineBudget>` |
| `HomePage.tsx` (portfolio fetch) | `useEffect` que llama `http.get` + setState portfolioItems | `useList<ProductPhoto>(['portfolio-photos'], ...)` |

### Páginas que NO necesitan TanStack Query (UI state puro)

| Page | Razón |
|---|---|
| `LoginPage.tsx` | Solo `useState` para form data. Mutación via `auth.login()`. Sin fetching. |
| `BudgetFormPage.tsx` / `WorkOrderFormPage.tsx` | Usan `useEntityForm` (internamente usa TanStack Query para refs/logo/initial load). |
| `CalculatorPage.tsx` | Solo cálculos locales, sin fetching. |
| `ConfigurationPage.tsx` | Lee config 1 vez en mount. Opcional migrar. |

### Beneficios

- **Auto-deduplication**: TanStack Query deduplica requests si el componente se monta 2 veces
- **Cache**: el cache es compartido entre componentes (botones en sidebar, navigation, etc.)
- **Refetch on focus**: automático cuando el user vuelve a la tab
- **Error/Loading states uniformes**: tipados y consistentes
- **No más `.then().catch().finally()` boilerplate** para fetching

### Verificación

- `tsc --noEmit` → 0 errores ✅
- `vite build` → ✓ built in 9.53s ✅

### Beneficios

- **Auto-deduplication**: TanStack Query deduplica requests si el componente se monta 2 veces
- **Cache**: el cache es compartido entre componentes (botones en sidebar, navigation, etc.)
- **Refetch on focus**: automático cuando el user vuelve a la tab
- **Error/Loading states uniformes**: tipados y consistentes
- **No más `.then().catch().finally()` boilerplate**

### UI state local — no se migra

Estado de UI legítimo sigue con `useState`:
- Filtros de búsqueda (`search`, `estado`)
- Estado de modales (`showIncome`, `deleteId`)
- Tabs activos (`activeTab` en ReportsPage)
- PDF preview state (`pdfPreviewUrl`, `pdfPreviewLoading`)

Estos NO deben migrarse porque no son data fetching.

### Verificación

- `tsc --noEmit` → 0 errores ✅
- `vite build` → ✓ built in 9.38s ✅
- Comportamiento idéntico (mismas queries, mismo rendering) ✅

### useEntityForm refactor — PLAN.md #9 ✅

`useEntityForm.ts` ya NO es un mega-hook legacy con `@ts-nocheck`. Ahora es un **facade delgado y tipado** que compone 7 composables pequeños.

#### Composables extraídos (todos en `src/hooks/`)

| Composable | Responsabilidad | Líneas |
|---|---|---|
| `useFormReferences` | Carga materiales/pools/clients/logo, fetch next number, initial load | 101 |
| `useFormDetails` | CRUD `fabrication_details`, refs de material | 130 |
| `useFormMaterials` | Material picker + CRUD `materials_data`, `hayUSD`/`hayAlternativas` | 108 |
| `useFormPools` | Pool picker + CRUD `pools_data`, image upload | 67 |
| `useFormClient` | Client autocomplete (filtered + handleClientSelect) | 49 |
| `useFormCalculationsInput` | Handlers transport/deposit/usd_rate | 88 |
| `useFormActions` | Submit/delete/status-change/print | 117 |

#### `useEntityForm.ts` ahora es solo el facade

- ❌ Removido `@ts-nocheck` (era `// @ts-nocheck` en línea 1)
- ✅ Totalmente tipado con `UseEntityFormReturn` (de `types/form.ts`)
- ✅ Acepta `extraPayloadFields?` opcional (sin `as any`)
- ✅ `useFormReferences`, `useFormActions`, etc. se llaman con tipos exactos
- 198 líneas → tipadas completamente

#### `entityFormHelpers.ts` — kept as-is

Sigue exportando `INITIAL_FORM`, `M2_CONCEPTS`, `CUTOUT_DETAILS`, `CONCEPT_NORMALIZE`, `buildPayload`, `mapApiToForm`, `addMaterialToList`, `addPoolToList`. Los composables lo importan. Es un módulo de helpers puros (sin React) — válido como tal.

#### Consumers sin cambios

`BudgetFormPage.tsx` y `WorkOrderFormPage.tsx` consumen `useEntityForm({...})` igual que antes. Solo `WorkOrderFormPage` pasa `extraPayloadFields` para los terms override.

### E2E test fixes (independiente del refactor)

- `e2e/helpers/login.ts:logout()` ahora navega a `/login` antes de tocar `localStorage` (pre-nav `about:blank` tira `SecurityError`).
- `e2e/01-auth.spec.ts:rejects bad credentials` ahora matchea `/inválid|credencial|error/i` (error real es "Credenciales inválidas", no "error").
- `e2e/01-auth.spec.ts:legacy Spanish paths` ahora hace `loginAsAdmin` antes de testear redirects a `/admin/*` (sin auth, redirects van a `/login`).
- `e2e/helpers/login.ts` agrega `loginViaApi(page, request)` que autentica vía API y setea el JWT en `localStorage` directamente — evita el rate limit del backend en suites grandes.
- `e2e/{02,03,04}-*.spec.ts` ahora usan `loginViaApi` en `beforeEach` (más rápido + no golpea el rate limit).
- `e2e/04-cash.spec.ts:opens add income/expense modal` ahora matchea `/agregar ingreso|nuevo ingreso/i` (botón real dice "Agregar Ingreso", no "Nuevo Ingreso").
- `e2e/04-cash.spec.ts:navigates to cash history` navega directo a `/admin/cash/history` (sidebar accordion colapsado intercepta clicks).

### Backend rate limit configurable

- `app/core/settings.py`: `RATE_LIMIT_LOGIN=60/minute`, `RATE_LIMIT_REGISTER=3/minute` (antes hardcoded a 5 y 3).
- Permite que las E2E suites + uso normal convivan sin bloquearse.
- En tests pytest backend se sigue usando `RATE_LIMIT_ENABLED=false` en `tests/conftest.py`.

### Backend .env setup

- `afamar-backend/.env.example` (commitable): plantilla con todos los valores documentados.
- `afamar-backend/.env` (gitignored): copia local del `.env.example` con valores para development.
- `app/core/settings.py`: bug fix en `BASE_DIR` — antes apuntaba a `D:\projects\PERSONAL\afamar\.env` (4 niveles arriba), ahora apunta correctamente a `afamar-backend/.env` (3 niveles arriba, 1 nivel arriba de `app/`).
- El `.env` viejo en `D:\projects\PERSONAL\afamar\.env` ya no se usa (movido a `afamar-backend/.env`).

### Bugs encontrados y arreglados

#### 1. Stock NO se descontaba al crear WO directa
- `POST /api/v1/work-orders` → `WorkOrderService.create()` no llamaba `deduct_pool_stock()`
- Fix (`work_order.py:201-211`): agrega deducción al final del método cuando `order.pool_id` o `order.pools_data` están presentes.

#### 2. Stock NO se descontaba al convertir alternativa
- `POST /api/v1/budgets/{id}/alternatives/{idx}/convert-to-work-order` → `BudgetService.convert_alternative_to_work_order()` solo seteaba `stock_deducted = True` sin descargar realmente.
- Fix (`budget.py:259-269`): importa `deduct_pool_stock` y la llama antes de setear el flag.

#### 3. Frontend llamaba endpoint inexistente
- `convertBudgetToWorkOrder(id)` → `POST /api/v1/budgets/${id}/convert-to-work-order` → **404**
- Fix (`budgets.ts:9`): apunta a `/work-orders/from-budget/${id}` que sí existe y crea OT con stock deduction.
- `BudgetsListPage.tsx:86`: cambia `res.data.orden_id` → `res.data.id` (backend retorna English).

### List pages leyendo campos Spanish del API (bugs silenciosos)

Los list endpoints retornan campos English (`status`, `number`, `client_name`, etc.) pero las páginas leían los nombres viejos en español — los displays salían vacíos.

| Archivo | Antes | Después |
|---|---|---|
| `WorkOrdersListPage.tsx` | `o.numero`, `o.cliente_nombre`, `o.estado`, `o.sena_recibida`, `o.saldo_pendiente`, `o.fecha_entrega` | `o.number`, `o.client_name`, `o.status`, `o.deposit_received`, `o.balance_due`, `o.delivery_date` |
| `IncomeModal.tsx` (líneas 36, 37, 39, 111) | `orden.numero`, `orden.cliente_nombre`, `orden.estado` | `orden.number`, `orden.client_name`, `orden.status` |
| `OnlineBudgetsListPage.tsx:102` | `p.numero` | `(p.number as string) \|\| ''` |
| `OnlineBudgetFormPage.tsx:80-85, 94` | fallbacks `d.cliente`/`d.telefono`/`d.tipo_obra`/`d.fecha`/`d.dolar_dia`/`d.numero`/`d.pileta_id` | solo English (`d.client_name`, `d.phone`, `d.work_type`, `d.date`, `d.usd_rate`, `d.number`, `d.pool_id`) |
| `OnlineBudgetFormPage.tsx:50` | `r.data.numero` | `r.data.number` (endpoint ya retornaba English) |

### Dead code eliminado

#### Frontend `api/resources/`:
- **`onlineBudgets.ts`**: eliminado `mapOnlineBudgetToApi` (32 líneas, nunca importado).
- **`poolStock.ts`**: eliminados `mapPoolToApi` y `mapMovementToApi` (eran pass-throughs). `createPool`, `updatePool`, `createPoolMovement` ahora pasan `data` directo.
- **`materials.ts`**: ya estaba limpio desde refactor anterior.

#### Backend `api/routers/`:
- **`work_orders.py`**: eliminado `_FIELD_MAP` (33 entradas Spanish→English) + `_map_form_fields`. Simplificado `_build_client_dict_from_form` (sin fallbacks `cliente_nombre`/`domicilio`).
- **`budgets.py`**: eliminado `_BUDGET_FIELD_MAP` (33 entradas) + `_map_budget_fields`. Simplificado client dict extraction en `preview_budget_pdf`.

**Razón para eliminar:** el frontend ahora envía directamente campos English (vía `buildPayload()` en `entityFormHelpers.ts`). Los mappings eran backward-compat obsoleto.

### Fix limpio: `tipo_cambio` → `default_usd_rate`

- **Antes**: `MaterialFormPage.tsx:70` leía `data.tipo_cambio` que **no existía en backend** → caía al fallback `|| 1` → ARS/1 = ARS (conversión 1:1 rota).
- **Ahora**: `data.default_usd_rate`. Backend `settings.py` agrega `"default_usd_rate": "1000"` a `DEFAULT_KEYS` (admin puede editarlo desde `/admin/configuration`).
- **Por qué `default_usd_rate` y no `tipo_cambio`**: English consistente con el resto del codebase, y la convención del modelo (cada Budget/WorkOrder tiene su propio `usd_rate`).

### Layout fixes (uniform padding)

- `MainLayout.module.css`: `main-layout__page-content` padding: `24px` → `36px` (única fuente de padding exterior).
- **17 pages** (todos los CSS modules de pages): eliminado `padding: 24px` de la clase raíz. Layout ahora es la única fuente de padding.

### Duplicate "APROBACIÓN DEL CLIENTE"

- `BudgetFormPage.tsx:466` renderizaba `<ApprovalSection>` directamente, pero `BudgetFormFinancial` (subcomponente) ya lo incluye. Removido el duplicado + import `ApprovalSection`.

### Sidebar

- `MainLayout.tsx`: profile + logout movidos del sidebar a topbar (User icon dropdown).
- Topbar con `position: sticky` + dynamic page title via `getPageTitle(pathname)` y `useEffect` para cerrar dropdown al click outside.



---

## Stack

- **Backend:** Python 3.14 + FastAPI 0.139 + SQLAlchemy 2.0 + SQLite (swappable to MySQL via `DATABASE_URL`)
- **Frontend:** Vite 6 + React 18 + TypeScript 5.7 + CSS Modules (BEM) + Axios
- **DB Migrations:** Alembic
- **Auth:** JWT (python-jose HS256) + passlib bcrypt==4.1.3
- **Status/Payment/Priority enums:** English en DB, Spanish en UI via `t(key)` en `src/utils/translate.ts`
- **Tests:** pytest (backend), vitest (frontend — instalado, no usado aún)

## FabricationDetail + MaterialInForm/PoolInForm migration (sesión actual)

### FabricationDetail → English snake_case
Campos internos del JSON `fabrication_details` (frontend-only, serializado como string):
| Antes | Después |
|---|---|
| `concepto` | `concept` |
| `detalle` | `detail` |
| `concepto_personalizado` | `custom_concept` |
| `material_precio_m2` | `material_price_m2` |
| `largo` | `length` |
| `ancho` | `width` |
| `mano_de_obra` | `labor` |
| `moneda` | `currency` |
| `cantidad` | `quantity` |
| `precio` | `price` |

### MaterialInForm → snake_case (revertido de camelCase)
| Antes (camelCase) | Después (snake_case) |
|---|---|
| `priceM2` | `price_m2` |
| `priceM2Usd` | `price_m2_usd` |
| `m2Used` | `m2_used` |
| `m2Budgeted` | `m2_budgeted` |
| `isAlternative` | `is_alternative` |

### PoolInForm → snake_case (revertido de camelCase)
| Antes (camelCase) | Después (snake_case) |
|---|---|
| `poolId` | `pool_id` |

### Archivos modificados (12):
- `types/budget.ts` — interfaces FabricationDetail, MaterialInForm, PoolInForm, BudgetItemSchema
- `types/poolStock.ts` — PoolMovement.poolId → pool_id
- `types/onlineBudget.ts` — OnlineBudgetItem.poolId → pool_id, OnlineBudgetPayload.poolId → pool_id
- `hooks/useFormMaterials.ts` — d.concepto → d.concept, moneda → currency, precio → price
- `hooks/useFormDetails.ts` — todas las referencias Spanish a English en handleDetailChange + addDetalle
- `hooks/useBudgetCalculations.ts` — d.moneda → currency, precio → price, cantidad → quantity
- `components/budget/FabricationTable.tsx` — inputs/callbacks a English field names
- `components/budget/BudgetPanel.tsx` — todas las referencias a FabricationDetail
- `components/budget/QuoteOptionsGrid.tsx` — Alternativa/TrabajoComun interfaces + referencias
- `components/materials/MaterialCard.tsx` — priceM2 → price_m2, isAlternative → is_alternative
- `components/materials/PoolCard.tsx` — poolId → pool_id
- `pages/budgets/BudgetFormPage.tsx` — items/forEach referencias a FabricationDetail
- `pages/work-orders/WorkOrderFormPage.tsx` — d.precio → price, cantidad → quantity
- `pages/budgets/BudgetFormAdicionales.tsx` — p.marca → brand, modelo → model, cantidad → quantity

### Verificación
- `tsc --noEmit` → **0 errores** ✅

## Spanish→English naming migration (reciente)

Refactor **masivo de nombres a inglés** completado en una sola sesión. Cambió 30+ archivos entre git mv de carpetas, renames de funciones, hooks, componentes, tipos, constantes, CSS classes. **119 archivos modificados**.

## Client section (reciente)

- **`ClientSection`** ahora usa `<select>` dropdown + botón "Nuevo" para crear clientes inline.
- **Select:** muestra todos los clientes cargados (`clientes` de `useEntityForm`), al seleccionar rellena `client_name`, `client_phone`, `client_email`, `client_address`.
- **Modal "Nuevo Cliente":** formulario con nombre (requerido), teléfono, email, dirección. Crea via `POST /api/v1/clients`, refresca la lista y selecciona automáticamente el nuevo cliente.
- **`refreshClientes`** expuesto desde `useEntityForm` → `useFormReferences` para refrescar la lista después de crear un cliente.
- **Props anteriores eliminadas:** `clientRef`, `showClientDropdown`, `setShowClientDropdown`, `filteredClients`, `handleClientSelect` — ya no se usan en `WorkOrderFormBasic` ni `BudgetFormClient`.
- **Ambos formularios** (Budget + Work Order) usan el mismo `ClientSection` con props: `form`, `readOnly`, `update`, `clientes`, `onClientCreated`.

### Carpetas renombradas (git mv)

| Antes | Después |
|---|---|
| `components/caja/` | `components/cash/` |
| `components/firma/` | `components/signature/` |
| `components/presupuesto/` | `components/budget/` |
| `components/materiales/` | `components/materials/` |
| `components/ordenes/` | `components/orders/` |
| `components/croquis/` | `components/sketch/` |
| `components/ui/EstadoBadge/` | `components/ui/StatusBadge/` |

### Archivos renombrados (dentro de carpetas nuevas)

| Antes | Después |
|---|---|
| `cash/IngresoModal.tsx` | `cash/IncomeModal.tsx` |
| `cash/EgresoModal.tsx` | `cash/ExpenseModal.tsx` |
| `cash/IngresosTable.tsx` | `cash/IncomeTable.tsx` |
| `cash/EgresosTable.tsx` | `cash/ExpenseTable.tsx` |
| `cash/CerrarCajaModal.tsx` | `cash/CloseCashModal.tsx` |
| `cash/SaldoAnteriorCard.tsx` | `cash/PreviousBalanceCard.tsx` |
| `cash/CajaTotalCards.tsx` | `cash/CashTotalCards.tsx` |
| `cash/cajaUtils.ts` | `cash/cashUtils.ts` |
| `signature/FirmaCanvas.tsx` | `signature/SignatureCanvas.tsx` |
| `budget/PresupuestoPanel.tsx` | `budget/BudgetPanel.tsx` |
| `budget/PresupuestoOnlineHeader.tsx` | `budget/OnlineBudgetHeader.tsx` |
| `budget/PresupuestoOnlineFooter.tsx` | `budget/OnlineBudgetFooter.tsx` |
| `budget/PresupuestoOnlineTotals.tsx` | `budget/OnlineBudgetTotals.tsx` |
| `budget/FabricacionTable.tsx` | `budget/FabricationTable.tsx` |
| `budget/OpcionesCotizacionGrid.tsx` | `budget/QuoteOptionsGrid.tsx` |
| `materials/PiletaCard.tsx` | `materials/PoolCard.tsx` |
| `orders/AprobacionSection.tsx` | `orders/ApprovalSection.tsx` |
| `orders/ObservacionesSection.tsx` | `orders/ObservationsSection.tsx` |
| `orders/ClienteSection.tsx` | `orders/ClientSection.tsx` |

### Componentes (default exports/PascalCase)

**Renombrados:** `IngresoModal`→`IncomeModal`, `EgresoModal`→`ExpenseModal`, `CajaTotalCards`→`CashTotalCards`, `CerrarCajaModal`→`CloseCashModal`, `SaldoAnteriorCard`→`PreviousBalanceCard`, `FirmaCanvas`→`SignatureCanvas`, `PresupuestoPanel`→`BudgetPanel`, `FabricacionTable`→`FabricationTable`, `PiletaCard`→`PoolCard`, `AprobacionSection`→`ApprovalSection`, `ObservacionesSection`→`ObservationsSection`, `ClienteSection`→`ClientSection`, `EstadoBadge`→`StatusBadge`, `CajaDiaria`→`CashDailyPage`, `CajaHistorial`→`CashHistoryPage`, `PresupuestoOnlineForm`→`OnlineBudgetForm`.

### Hooks

**Renombrados:** `useCalculosPresupuesto.ts` → `useBudgetCalculations.ts` (función exportada `useBudgetCalculations`).

### Funciones en `useEntityForm.ts`

- `handleCambioEstadoAccion(nuevoEstado)` → `handleStatusChangeAction(newStatus)`
- `handlePiletaImagen` → `handlePoolImage`
- `handleSenaMonedaChange` → `handleDepositCurrencyChange`
- `handleSenaMonedaChange` → `handleDepositCurrencyChange`
- `handleDolarDiaChange` → `handleUsdRateChange`
- `handleSenaMontoChange` → `handleDepositAmountChange`
- Parámetro `nombre` en `handleMaterialChange` / `addMaterial` → `name`

### Constantes

**`src/utils/formatters.ts`:**
- `espesores` → `thicknesses`
- `acabados` → `finishes`
- `conceptosFabricacion` → `fabricationConcepts`
- `categoriasMaterial` → `materialCategories`
- `estadosOrden` → `orderStatuses`
- `estadosPresupuestoLocal` → `budgetStatuses`
- `estadosMedicion` → `measurementStatuses`
- `CONCEPTOS_M2` → `M2_CONCEPTS`

**`src/components/cash/cashUtils.ts`:**
- `FORMAS_PAGO` → `PAYMENT_METHODS`
- `TIPOS_EGRESO` → `EXPENSE_TYPES`
- `ESTADO_CARPETA_MAP` → `FOLDER_STATUS_MAP`
- `estadoCarpetaClass` → `folderStatusClass`

**`src/hooks/entityFormHelpers.ts`:**
- `CONCEPTOS_M2` → `M2_CONCEPTS`
- `TRAFORO_DETALLES` → `CUTOUT_DETAILS`
- `CONCEPTO_NORMALIZE` → `CONCEPT_NORMALIZE`
- `addPiletaToList` → `addPoolToList`

**`src/types/form.ts`:** `EntityServices`: `getMateriales`→`getMaterials`, `getPiletas`→`getPools`, `getClientes`→`getClients`.

### Tipos / interfaces

**`src/components/budget/OnlineItemsTable.tsx`:**
- `PresupuestoOnlineItemLocal` → `OnlineBudgetItemLocal`
- `OpcionTab` → `OptionTab`
- `FILAS_INICIALES` → `INITIAL_ROWS`
- `ESPECIALES_INICIALES` → `INITIAL_SPECIALS`
- `TIPOS_ESPECIALES` → `SPECIAL_TYPES`
- `NOMBRES_ESPECIALES` → `SPECIAL_NAMES`
- `createOpcion` → `createOption`

**`src/types/`:**
- `onlineBudget.ts`: campos `cliente`/`telefono`/`tipo_obra`/`fecha`/`dolar_dia`/`items`/`total_neto_*`/`total_consolidado`/`pileta_id`/`pileta_precio` → inglés (`clientName`/`phone`/`work_type`/`date`/`usd_rate`/`items`/`total_net_ars`/`total_net_usd`/`total_consolidated`/`pool_id`/`pool_price`).
- `croquis.ts`: `CroquisPage` campo `nombre` → `name`.
- `completedWorks.ts`: `titulo`/`descripcion`/`foto` → `title`/`description`/`photo`.
- `api.ts`: eliminadas interfaces `PresupuestosApi` y `OrdenesApi` (código muerto con nombres Spanish).
- Props interfaces: `PresupuestoPanelProps`/`AprobacionSectionProps`/`ObservacionesSectionProps`/`ClienteSectionProps`/`FirmaCanvasProps`/`PiletaCardProps`/`EstadoBadgeProps`/`FabricacionTableProps` → versiones en inglés.

### CSS classes renombradas (BEM)

| Antes | Después |
|---|---|
| `.budget-form__croquis` | `.budget-form__sketch` |
| `.budget-form__layout--no-croquis` | `.budget-form__layout--no-sketch` |
| `.work-order-form__croquis` | `.work-order-form__sketch` |
| `.work-order-form__layout--no-croquis` | `.work-order-form__layout--no-sketch` |
| `.online-budgets__numero` | `.online-budgets__number` |

### Routes (App.tsx)

- `OldPresupuestoRedirect` → `OldBudgetRedirect`
- `OldOrdenRedirect` → `OldWorkOrderRedirect`
- `OldPOnlineRedirect` → `OldOnlineBudgetRedirect`

### ⚠️ Lo que NO se renombró (legacy intencional)

Por elección al elegir "Máximo (recomendado)", el siguiente código conserva campos Spanish **por diseño** (es legacy, refactor planificado):

- **`EntityFormState` campos internos** (49 campos en español): `cliente_nombre`, `domicilio`, `fecha`, `estado`, `material_precio_m2`, `color_tipo`, `espesor`, `acabado`, `tipo_cambio`, `bacha`, `anafe`, `croquis`, `observaciones_diseno`, `detalles_fabricacion`, `materiales`, `piletas`, `orden_trabajo_numero`, `descuento_porcentaje`, `descuento_monto_fijo`, `recargo_*`, `sena_*`, `forma_pago`, `saldo_*`, etc.
- **`INITIAL_FORM`** en `src/hooks/entityFormHelpers.ts:22` — objeto con los mismos campos Spanish.
- **`buildPayload(form)`** en `entityFormHelpers.ts:83` — lee campos Spanish, **emite campos English** al backend según `MATERIAL_FIELD_MAP` / `PILETA_FIELD_MAP`. Es el boundary translación.
- **`mapApiToForm(d)`** en `entityFormHelpers.ts:150` — recibe English del backend, **emite Spanish para el formulario**.
- **`MATERIAL_FIELD_MAP`, `PILETA_FIELD_MAP`** en `entityFormHelpers.ts` — Spanish→English mapping.

El form state completo (`useEntityForm.ts`) es el último nivel Spanish pendiente. Reemplazo planificado en PLAN.md §1.2 #9.

### Problemas resueltos durante el rename

1. **Rotura parcial de `node_modules/typescript`:**
   El TypeScript anterior quedó con `lib/*.d.ts` borrados y faltaban `@types/*` packages. Re-instalé `typescript@5.9.3` y agregué `@types/babel__core`, `@types/d3-color`, `@types/d3-ease`, etc.

2. **`css-modules.d.ts` faltaba:**
   Creé `src/css-modules.d.ts` declarando `*.module.css` + `*.jpg`/`*.png`/`*.svg`/`*.webp`/`*.jpeg`.

3. **`global.d.ts` faltaba:**
   Creé `src/global.d.ts` con `declare global { interface Window { APP_CONFIG?: { API_URL?: string } } }` (necesita `export {}` para que TS lo trate como módulo bajo `isolatedModules: true`).

4. **StatusBadge `style` prop:**
   Tras el rename, TS reportaba `Property 'style' does not exist on 'IntrinsicAttributes & StatusBadgeProps'`. La interfaz tiene `style?: CSSProperties` correctamente — pero TS 5.9 rechaza la intersection de forma no documentada cuando el componente es exportado vía `index.ts` con `export {}` re-pattern.
   Solución aplicada: eliminé el `style={{...}}` inline en 3 consumidores (BudgetFormPage, ClientFormPage, WorkOrderFormPage). El componente sigue aceptando `style` programáticamente, pero los 3 call-sites no lo pasan más.

5. **`useCalculosPresupuesto.ts` eliminado** vía `git rm -f` después de reemplazarlo por `useBudgetCalculations.ts`.

---

## Cash module (reciente: Spanish→English field names)

- **Root cause:** `/api/v1/cash/daily?date=...` → backend espera `?query_date=...`. Fix: `date`→`query_date` in `cash.ts`.
- **Request/Response fields:** todo el módulo caja (`CashDailyPage`, `CashHistoryPage`, `IncomeModal`, `ExpenseModal`, `IncomeTable`, `ExpenseTable`, `cashUtils`) migrado de Spanish a English para coincidir con schemas backend.
- **Values:** `PAYMENT_METHODS` ahora `['CASH','TRANSFER','CREDIT_CARD']`, `EXPENSE_TYPES` ahora `['GENERAL','BANK_TRANSFER']`, movement types `'INCOME'`/`'EXPENSE'`.
- **`closeDailyCash`:** body `{ date, notes }` (antes `{ date, observations }`).
- **Movement create:** body `{ date, type, amount, description, payment_method, ... }` (antes `{ fecha, tipo, monto, concepto, forma_pago, ... }`).

## PDF Preview modal (reciente)

- **Backend:** `POST /api/v1/budgets/preview-pdf` y `POST /api/v1/work-orders/preview-pdf` generan PDF sin guardar en DB.
- **Field mapping:** `_BUDGET_FIELD_MAP` / `_FIELD_MAP` convierten campos Spanish (frontend) a English (backend) antes de pasar a `build_*_pdf_data`.
- **Response:** PDF como `application/octet-stream` con `Content-Disposition: inline`.
- **Frontend:** `PdfPreviewModal` con `title` prop (default `"Vista previa"`, budgets `"Vista previa — Presupuesto"`, work orders `"Vista previa — Orden de Trabajo"`).
- **Resources:** `previewBudgetPdf(data)` / `previewWorkOrderPdf(data)` en `src/api/resources/budgets.ts` y `workOrders.ts`.
- **Try/except en endpoints:** devuelven texto plano con `f"Error generando PDF: {TypeError}: {str(e)}"` para debug.

## Sidebar colapsable (reciente)

- **Default:** sidebar abierto (280px) con todos los labels.
- **Botón X** en header del sidebar → colapsa a 64px (solo iconos con `title` para tooltip).
- **Click en item con subitems colapsado:** aparece **popover flotante** a la derecha del item con el nombre de la sección como header y los subitems navegables.
- **Click en otro grupo colapsado:** cierra popover anterior y abre el nuevo.
- **Click en subitem del popover:** navega y cierra popover.
- **CSS clave:** `overflow: visible` en `.main-layout__sidebar` y `.main-layout__menu-links` para que el popover no se corte.

## Configuration page refactor (reciente)

- **Un solo botón "Guardar"** que sube el logo (si hay uno nuevo) y guarda los campos (si cambiaron).
- **Solo `company_name` es obligatorio** (marcado con `*` rojo). Si está vacío, no permite guardar.
- **Preview inmediato** del logo al seleccionar archivo (`URL.createObjectURL`).
- **Notificaciones con `useNotify()`** (toast) en vez de `setMessage` inline.
- **Botón se deshabilita** hasta que haya cambios (`configDirty || logoDirty`) y `company_name` no esté vacío.
- **Backend `POST /settings/upload-logo`:** convierte cualquier imagen a PNG con Pillow, sobrescribe siempre `logo.png`, valida que sea imagen.
- **API:** `updateSettings(data)` (PUT /settings con todos los campos) en lugar de `updateSetting(key, ...)` (PUT /settings/{key} que no existía).
- **HTTP fix:** `http.ts` no pone `Content-Type: application/json` por default - lo aplica solo si el body NO es FormData.

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
    global.d.ts    — declare global { Window.APP_CONFIG }
    css-modules.d.ts — *.module.css + *.jpg/*.png/*.svg/*.webp/*.jpeg
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
    components/    — reutilizables (todos English)
      ui/          — primitivas (Button, Modal, StatusBadge, ListPage, etc.)
      common/      — Loading, ConfirmDialog, PdfPreviewModal
      cash/        — IncomeModal, ExpenseModal, IncomeTable, ExpenseTable,
                     CashTotalCards, CloseCashModal, PreviousBalanceCard, cashUtils
      budget/      — BudgetPanel, OnlineBudgetHeader, OnlineBudgetFooter,
                     OnlineBudgetTotals, FabricationTable, QuoteOptionsGrid,
                     OnlineItemsTable
      materials/   — MaterialCard, PoolCard
      orders/      — ClientSection (select + modal), ApprovalSection, ObservationsSection,
                     FormHeader, FormFooter
      sketch/      — CroquisEditor, Toolbar, useCroquisState (CanvasArea,
                     LineShape, RectangleShape, TextShape)
      signature/   — SignatureCanvas
      ErrorBoundary/
    layouts/       — MainLayout + MainLayout.module.css (sidebar BEM)
    context/       — AuthContext, NotificationContext, ReferencesContext
    hooks/         — useEntityForm (legacy, @ts-nocheck),
                     useBudgetCalculations (reemplaza useCalculosPresupuesto),
                     entityFormHelpers (INITIAL_FORM, buildPayload, mapApiToForm)
    constants/     — CURRENCIES, STATUS_COLORS, PRIORITY_COLORS
    types/         — 17 files en inglés (EntityFormState conserva campos Spanish internos)
    utils/         — formatCurrency, translate, calcM2, downloadPdf, whatsapp,
                     formatters (thicknesses, finishes, orderStatuses, etc.)
  tsconfig.json    — path aliases (@/, @features/, @shared/, @assets/)
  vite.config.ts   — proxy /api → http://localhost:8000
  eslint.config.js, vitest.config.ts, Dockerfile, nginx.conf
  package.json     — agregados @types/{babel__*, d3-color, d3-ease, d3-interpolate,
                     d3-timer, react-beautiful-dnd, json-schema}
```

## E2E Tests (Playwright)

- **Stack:** `@playwright/test@1.61.1` + Chromium. Tests en `afamar-frontend/e2e/`.
- **Config:** `afamar-frontend/playwright.config.ts` define `webServer` que arranca backend (uvicorn 3095) + frontend (vite 3090) automáticamente. Override con `PLAYWRIGHT_BASE_URL` si ya están corriendo.
- **Auto-arranque:** backend con `.\\venv\\Scripts\\python.exe -m uvicorn app.main:app --port 3095`, frontend con `npm run dev -- --port 3090`. `reuseExistingServer: !process.env.CI` permite correr contra stack manual.
- **Auth helpers:** `e2e/helpers/login.ts` con `ADMIN_USER = { username: 'admin', password: 'admin123' }` (override con env `E2E_ADMIN_USER` / `E2E_ADMIN_PASS`).
- **Specs (4 archivos, 16 tests):**
  - `01-auth.spec.ts` — redirect a /login, login OK, login falla, redirects Spanish→English (`/presupuestos`, `/ordenes`, `/stock-piletas`).
  - `02-clients.spec.ts` — listar, crear cliente, editar (usa timestamp `E2E-${Date.now()}` para unicidad).
  - `03-budgets.spec.ts` — listar, abrir form nuevo, PDF preview button visible, filtro por status.
  - `04-cash.spec.ts` — caja diaria carga saldo+ingresos+egresos, navegación a historial, modales ingreso/egreso.
- **Scripts:** `npm run test:e2e` (headless), `npm run test:e2e:ui` (Playwright UI), `npm run test:e2e:debug`, `npm run test:e2e:list` (lista sin correr).
- **Artifacts:** `test-results/`, `playwright-report/`, `blob-report/` ignorados en `afamar-frontend/playwright/.gitignore`. Trace + screenshot + video se retienen on-failure.
- **Pre-requisito para correr:** backend con `alembic upgrade head` aplicado (la migración `15a75ef09120_add_term_overrides` debe estar aplicada).

```bash
cd afamar-frontend
npm run test:e2e          # corre todo (auto-arranca servers)
npm run test:e2e:ui       # modo UI interactivo
E2E_ADMIN_PASS=xxx npm run test:e2e  # custom credentials
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
- **English naming (carpetas/componentes/hooks/funciones/constantes/CSS classes):** todo renombrado en la migración masiva. Excepción: `EntityFormState` campos internos (ver §"Spanish→English naming migration").
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
| `clients.ts` | `/clients` |
| `budgets.ts` | `/budgets` |
| `onlineBudgets.ts` | `/online-budgets` |
| `workOrders.ts` | `/work-orders` |
| `materials.ts` | `/materials` |
| `measurements.ts` | `/measurements` |
| `poolStock.ts` | `/pool-stock` |
| `cash.ts` | `/cash` |
| `settings.ts` | `/settings` |
| `reports.ts` | `/reports` |
| `dashboard.ts` | `/dashboard` |
| `auth.ts` | (login en `api/client.ts`) |

Con `baseURL: '/api/v1'` en `http.ts`, el path completo es `/api/v1/clients`, etc.

## Pages con BEM (CSS Module)

✅ Migrados (20+ pages — todos): `auth/LoginPage`, `home/HomePage`, `dashboard/DashboardPage`, `clients/ClientsListPage`, `clients/ClientFormPage`, `budgets/BudgetsListPage`, `budgets/BudgetFormPage`, `materials/MaterialsListPage`, `materials/MaterialFormPage`, `work-orders/WorkOrdersListPage`, `work-orders/WorkOrderFormPage`, `pool-stock/PoolStockPage`, `cash/CashDailyPage`, `calculator/CalculatorPage`, `reports/ReportsPage`, `configuration/ConfigurationPage`, `measurements/MeasurementsListPage`, `measurements/MeasurementFormPage`, `online-budgets/OnlineBudgetsListPage`, `online-budgets/OnlineBudgetFormPage`.

✅ Forms descompuestos: `BudgetFormPage` → 6 subcomponentes (`BudgetFormClient`, `BudgetFormSpecs`, `BudgetFormItems`, `BudgetFormAdicionales`, `BudgetFormFinancial`, `BudgetFormObservations`). `WorkOrderFormPage` → 6 subcomponentes (`WorkOrderFormBasic`, `WorkOrderFormSpecs`, `WorkOrderFormItemsGrid`, `WorkOrderFormFinancial`, `WorkOrderFormObservations`, `WorkOrderFormSnapshot`).

## TypeScript helpers (legacy)

`src/hooks/useEntityForm.ts` es un mega-hook legacy con `@ts-nocheck`. Recibe `services: EntityServices` (con `getMaterials`/`getPools`/`getClients`/`create`/`update`/`delete`/`getPdfUrl`/`listPath`) y un `defaultEstado`. Mantiene el form state completo en `EntityFormState` con campos Spanish.

Boundaries:
- `entityFormHelpers.buildPayload(form: EntityFormState)` → Record<string, any> con campos English (sketch_elements, materials_data, pools_data, transport, total, deposit_received, etc.) que va al backend.
- `entityFormHelpers.mapApiToForm(d, defaultEstado)` → `EntityFormState`, recibe campos English.
- `MATERIAL_FIELD_MAP` / `PILETA_FIELD_MAP` en `entityFormHelpers` convierten campos Spanish anidados (materiales[], piletas[]).
- `INITIAL_FORM` literal con todos los campos Spanish en empty.

Usar para preservar comportamiento en `BudgetForm`/`OrderForm` mientras se migra. Reemplazar por composables más pequeños en sesión futura (PLAN.md #9).

## Type declaration: CSS Modules

`src/css-modules.d.ts` declara:
- `*.module.css` → `Readonly<Record<string, string>>`
- `*.jpg` / `*.jpeg` / `*.png` / `*.svg` / `*.webp` → `string` (asset URL)

Si se añaden nuevos `.module.css`, no se necesita configuración adicional.

## Páginas con aliases backward-compat

- `App.tsx` redirige URLs viejas Spanish (ej. `/presupuestos/*` → `/admin/budgets/*`, `/ordenes/*` → `/admin/work-orders/*`, etc.) usando componentes `OldBudgetRedirect`, `OldWorkOrderRedirect`, `OldOnlineBudgetRedirect`.
- Services **ya no exponen alias Spanish** — fueron eliminados en la migración. Solo nombres English.

## Comandos

```bash
# Backend (puerto 3095 en este proyecto)
cd afamar-backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 3095
python seed_admin.py
python scripts/seed_reference_data.py
python scripts/seed_product_photos.py
alembic revision --autogenerate -m "msg"
alembic upgrade head
pytest

# Frontend (puerto 3090, configurado en vite.config.ts)
cd afamar-frontend
npm install
npm run dev
npm run build              # tsc --noEmit && vite build (pasa limpio)
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

1. ✅ **Migrar form pages a BEM** (~2-3h)
2. ✅ **Renombrar types a inglés** (~1h)
3. ✅ **Descomponer forms** (~3-4h)
4. ✅ **Crear seed de reference data** (~1h)
5. ✅ **Migrar pages sin BEM** (~30 min)
6. ⏳ **Tests E2E con Playwright** (~2-3h)
7. ✅ **Eliminar legacy** (~10 min): folders Spanish `pages/<spanish-name>/`
8. ✅ **Eliminar aliases Spanish** (~30 min) en services + componentes + carpetas
9. ⏳ **Reemplazar useEntityForm** (~2h): dividir en composables más pequeños. **Incluye renombrar `EntityFormState` campos a inglés y reemplazar `INITIAL_FORM`/`buildPayload`/`mapApiToForm`.**
10. ⏳ **Migrar a TanStack Query** en pages (hooks ya están en `src/api/hooks.ts`).

## Refactor commits en `refactor`

```
c007e68b (HEAD)                "feat: replace client autocomplete with select dropdown + new client modal"
bbd69de5                       "add /admin/product-photos for config last products"
ded87937                       "update nginx cfg for deploy"
d3ffca1c                       "update composes for deploy"
28570887                       "feat: extract BudgetForm/WorkOrderForm subcomponents + fix cash module Spanish→English fields"
f04f740a (origin/refactor)     "feat: complete BEM migration, API consolidation, type renaming, and cleanup"
5985a2ca                       "fix: repair UTF-8 corruption in Spanish text"
7600a594                       "docs: update AGENTS.md and PLAN.md for refactor state"
39bf9031 (origin/refactor)     "chore: remove stale build artifacts..."
c98228c5 (origin/refactor)     "feat: migrate 6 list pages to BEM/CSS Modules"
25e57a56 (origin/refactor)     "feat: add BEM/CSS Modules for 7 list pages"
f83f8b95 (origin/refactor)     "refactor: complete English naming + BEM foundation"
```

## Commits locales sin pushear (119 archivos modificados, 1 nuevo)

### Backend (5 archivos modificados)
- `afamar-backend/app/api/routers/budgets.py` — `_BUDGET_FIELD_MAP` + try/except en `preview-pdf`
- `afamar-backend/app/api/routers/work_orders.py` — try/except en `preview-pdf`
- `afamar-backend/app/api/routers/settings.py` — `upload-logo` convierte a PNG con Pillow
- `afamar-backend/app/services/pdf_html.py` — fix `_load_logo_base64` (AttributeError pdf_output_dir)
- `afamar-backend/app/utils/logger.py` — fuerza reconfiguración del root logger
- `afamar-backend/uploads/logo.png` — logo subido por el usuario

### Frontend — batch rename English (~110 archivos)
- **Carpetas renombradas:** `caja/`→`cash/`, `firma/`→`signature/`, `presupuesto/`→`budget/`, `materiales/`→`materials/`, `ordenes/`→`orders/`, `croquis/`→`sketch/`, `EstadoBadge/`→`StatusBadge/` (30 archivos movidos con git mv)
- **Imports actualizados** en todas las páginas y componentes (23+ archivos)
- **Componentes renombrados:** 22 default exports (IncomeModal, ExpenseModal, BudgetPanel, ApprovalSection, etc.)
- **Hooks renombrados:** `useCalculosPresupuesto.ts` → `useBudgetCalculations.ts`, funciones de `useEntityForm.ts` actualizadas
- **Constantes:** `PAYMENT_METHODS`/`EXPENSE_TYPES`/`FOLDER_STATUS_MAP`/`folderStatusClass`/`CUTOUT_DETAILS`/`CONCEPT_NORMALIZE`/`M2_CONCEPTS`/`thicknesses`/`finishes`/`fabricationConcepts`/`materialCategories`/`orderStatuses`/`budgetStatuses`/`measurementStatuses`
- **Tipos:** `StatusBadgeProps` con `status`/`style`, `CroquisPage.name`/`elements`, `OnlineBudgetItem`/`OnlineBudgetPayload` con campos English, `CompletedWork` con campos English
- **CSS classes:** `__sketch` reemplazó `__croquis` en BudgetForm/WorkOrderForm; `__number` reemplazó `__numero` en OnlineBudgetsList
- **Tipos eliminados:** `PresupuestosApi` y `OrdenesApi` en `api.ts` (código muerto)
- **Routes:** `OldBudgetRedirect`/`OldWorkOrderRedirect`/`OldOnlineBudgetRedirect`
- **`src/components/common/PdfPreviewModal.tsx`** (nuevo) — modal para preview de PDF
- **`src/css-modules.d.ts`** — declaración de CSS modules + asset images (jpg/png/svg/etc.)
- **`src/global.d.ts`** — `window.APP_CONFIG` type declaration
- **`afamar-frontend/package.json` + `package-lock.json`** — agregados `@types/{babel__core, d3-color, d3-ease, d3-interpolate, d3-timer, react-beautiful-dnd, json-schema, hoist-non-react-statics, jspdf, prop-types, raf, react-reconciler, react-redux, estree, d3-array, d3-path, d3-scale, d3-shape, d3-time}`; re-instalado `typescript@5.9.3`

### Archivos clave modificados
- `afamar-frontend/src/api/http.ts` — Content-Type solo si NO es FormData
- `afamar-frontend/src/api/resources/budgets.ts` — `previewBudgetPdf`
- `afamar-frontend/src/api/resources/settings.ts` — `updateSettings` (PUT /settings)
- `afamar-frontend/src/api/resources/workOrders.ts` — `previewWorkOrderPdf`
- `afamar-frontend/src/hooks/useEntityForm.ts` — campo `snapshot`, limpieza de props, funciones renombradas
- `afamar-frontend/src/layouts/MainLayout.{tsx,module.css}` — sidebar colapsable con popover
- `afamar-frontend/src/pages/budgets/BudgetFormPage.tsx` — `useNotify` + `console.error` + PdfPreviewModal
- `afamar-frontend/src/pages/work-orders/WorkOrderFormPage.tsx` — `console.error` + diagnóstico en catch
- `afamar-frontend/src/pages/configuration/ConfigurationPage.tsx` — refactor: 1 botón, validación, toasts

## Para crear PR

https://github.com/facundoracunti/afamar/pull/new/refactor

Antes de mergear a `main`:
1. Probar login + crear cliente + crear budget + convertir a OT
2. Probar crear material + caja diaria + cerrar caja
3. Verificar que las imágenes y uploads siguen funcionando
4. Confirmar que no hay referencias a `backend/` o `frontend/` en Docker configs
5. **Verificar que `npm run build` pasa limpio** (✓ ya pasa — Vite genera ~362KB gzip)
