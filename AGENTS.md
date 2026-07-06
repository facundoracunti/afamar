# AGENTS.md

> **Estado:** Rama `development` con commits sin pushear: work descrito debajo. Sesiones previas acumuladas en `refactor`: logo PNG upload, PDF preview backend, sidebar colapsable, configuration page refactor, **rename completo a inglés**, **client select dropdown + new client modal**, **stock deduction fixes**, **dead code cleanup**, **`default_usd_rate` setting**, **layout fixes**, **dark/light theme system**, **USD auto-fill from dolarapi.com**, **PdfPreviewModal theme fix**, **Modal/Loading/ConfirmDialog unificados**, **`ui/` primitives mejoradas + adoptadas en 10 pages**, **`IncomeTable`+`ExpenseTable` → `CashMovementTable`**, **`M2_CONCEPTS` derivado**, **`constants/index.ts` refactorizado**, **material photo backend + foto modal editar + lightbox**, **client typeahead (search-by-approx) sin refresh del form**, **client delete 409 conflict + notify error**, **`Presupuestos` column en `/admin/clients` + fix `Ordenes`/`Última orden` que mostraban `0`/`-`**, **`GET /clients/{id}` devuelve history aggregates + listas**, **card `Presupuestos asociados` en ClientFormPage**, **`ClientFormPage` layout 2×2 grid (form + historial / presupuestos + órdenes)**, **bug client no cargaba al editar budget/WO (snapshot backend + resolver fallback frontend)**, **`MaterialCard` theme-aware (CSS module, BEM, sin inline styles, vars de tema)**, **`PoolCard` theme-aware (mismo patrón)**, **fix CRUD presupuestos/órdenes (USD auto-fill, alternative→PENDING, REJECTED→PENDING, pagos, error notif, alternatIva→APPROVED, conversion ARS↔USD, paginator server-side)**, **decimales USD (max 2) en QuoteOptionsGrid**, **breakdown principals + traducción conceptos en `DETALLE DE FABRICACIÓN Y ACCESORIOS COMUNES`**, **croquis round-trip con geometría preservada (`flattenSketchElements` + `unflattenSketchElements`)**, **toast error/success/info opacos con texto blanco**, **`alert()` legacy reemplazado por `onError` callback → `useNotify`**, **doble notify fix (handleSubmit retorna `Promise<boolean>`)**, **extract shared code (Semana 3 PLAN.md)**: parseNumber(), uildPayloadWithTerms(), DiscountBlock, usePdfPreview, useConfirmPayment; **Semana 4**: @ts-nocheck eliminado de FabricationTable, CurrencyDisplay adoptado, **CSS modules fusion (BudgetForm+WorkOrderForm → EntityFormBase)**; **fix mediciones client data (snake_case sync)**; **sesión actual**: **drop snapshot_* columns + `client_id` FK en mediciones (FK-only pattern)**, **PDF rendering movido al frontend con `@react-pdf/renderer`** (DocumentPdf + buildPdfData + CroquisImageExtractor + useSettingsWithTerms), **`ClientInfoCard` componente** (read-only display, BEM CSS module), **`ClientInfoCard` adoptado en measurement form + conditional en budget/WO forms** (read-only si tiene cliente, typeahead si no), **split `WorkOrderFormBasic` → `WorkOrderFormClient` + `WorkOrderFormStatus`** (separación visual correcta + spacing consistente), **status hardcodeado → `orderStatuses` + `t()`** (single source of truth), **bank info en PDF cuando `payment_method === 'TRANSFERENCIA BANCARIA'`** (ALIAS + BANCO lines, constantes en `constants/index.ts`).
> Ver `PLAN.md` para el roadmap completo de migración.

## Reglas de operación

- **Git es manual**: NO commitear, NO pushear, NO crear PR, NO hacer `git add`, `git commit`, `git push`, `git merge`, `git rebase`, `git reset`, ni modificar la historia — **solo cuando el usuario lo pida explícitamente**. Modificar archivos está permitido; versionarlos no.
- **Inspeccionar antes de versionar**: si el usuario pide commit/PR, antes de stagear revisar `git status`, `git diff` y `git log --oneline -10`; stagear solo los archivos intencionalmente modificados; nunca commitear secretos.
- **Mensajes concisos**: usar el estilo del repo. Si no hay convención clara, mensajes cortos en inglés o español describiendo el "qué" en lugar del "cómo".
- **Cero PRs automáticos**: aunque el usuario diga "todo listo", NO crear el PR — esperar a que el usuario lo pida.


## Material photo + Client typeahead (sesión actual)

### Material photo (upload + edit modal + foto lightbox) ✅

**Backend**
- `app/models/material.py`: `photo: Mapped[str]` agregado a `Material`.
- `app/schemas/material.py`: `MaterialBase.photo: str | None` agregado (heredado por `MaterialCreate`/`MaterialUpdate`/`MaterialResponse`).
- `app/api/routers/materials.py`:
  - `POST /api/v1/materials/{material_id}/upload-foto` — recibe `multipart/form-data` con campo `file`, normaliza a PNG con Pillow, persiste en `backend/uploads/materials/{id}_{uuid8}.png`, escribe `material.photo = "/uploads/materials/{file}"`. Sobreescribe cualquier versión anterior (mismo ID, distinta extensión).
  - `DELETE /api/v1/materials/{material_id}/foto` — borra archivo del disco + limpia `material.photo`.
- Migración Alembic `248a1a9b051b_add_material_photo_column.py` (aplicada): solo `op.add_column('materials', sa.Column('photo', sa.String(500), nullable=True))`. Detección aditiva manual — el autogenerate intentó alterar `price_history.date`/`created_at`, lo cual fue removido.
- `app/main.py` ya tiene `app.mount("/uploads", StaticFiles(...))` — sirve los PNGs en `/uploads/materials/{file}`.

**Verificación backend** (script Python con urllib):
- Login → `POST /materials/124/upload-foto` con PNG 1×1 → 200, retorna `{path: "/uploads/materials/124_cdae9628.png"}`, archivo creado en `D:\...\uploads\materials\`.
- `GET /uploads/materials/...` → 200, 70 bytes.
- `DELETE /materials/124/foto` → 204.
- `GET /materials/124` → `photo: None` después del delete.

**Frontend**
- `api/resources/materials.ts`:
  - `uploadMaterialPhoto(id, file)` — `FormData` + `Content-Type: undefined` (para que axios ponga el `multipart` boundary).
  - `deleteMaterialPhoto(id)` — `DELETE /materials/{id}/foto` (204 No Content).
- `components/features/materials/MaterialForm.tsx` (nuevo, ~340 líneas): todo el form extraído del `MaterialFormPage` original. Acepta `{ materialId?, onSaved?, onCancel? }`. Auto-fetch material, categorías, `default_usd_rate`. Maneja upload + delete de foto. CSS module propio: `MaterialForm.module.css`.
- `components/features/materials/MaterialFormModal.tsx` (nuevo): wrappea `MaterialForm` en un `ui/Modal`. `title={materialId ? 'Editar Material' : 'Nuevo Material'}`, `width="760px"`. Pasa `onSaved={onClose}` y `onCancel={onClose}` para que el cierre del modal reemplace el navigate-back.
- `pages/materials/MaterialFormPage.tsx`: ahora es solo un wrapper con título `<h1>` que pasa `materialId={id}` a `<MaterialForm>`. La ruta `/admin/materials/:id` sigue funcionando igual.
- `pages/materials/MaterialsListPage.tsx`:
  - Botón "+ Nuevo Material" ahora abre `<MaterialFormModal>` (estado `createOpen`) en vez de navegar.
  - Botón Edit (en cada row) abre `<MaterialFormModal>` con `materialId={editId}`.
  - Nueva columna **"Foto"** (60px, primera columna) con:
    - Thumbnail botón (`<button>` con `<img>`) si `m.photo` está cargada → abre **lightbox modal** con la imagen full-size.
    - Icono `<ImageIcon>` muted en celda dashed-border si no hay foto.
- `pages/materials/MaterialsListPage.module.css`: agregadas `.materials__thumb-btn` (hover scale + border-color), `.materials__thumb` (`object-fit: cover` 44×44), `.materials__thumb-empty` (placeholder dashed).
- Lightbox modal: `ui/Modal` `width="800px"`, `<img>` con `max-height: 70vh; object-fit: contain`.

**Garantía clave:** el form **NO se resetea** cuando se sube/quita foto. Solo se actualiza `existingFoto` local state. La invalidación de `['materials']` query key está solo en el `handleSubmit`.

### Client typeahead (search-by-approximation) ✅

**Problema:** antes el selector de cliente en `/admin/budgets/new` y `/admin/work-orders/new` era un `<select>` nativo con TODOS los clientes. Con 500+ clientes scrollear era horrible. Además, al crear un cliente nuevo se llamaba a `refreshClientes()` (refetch completo) que re-renderizaba el form shell.

**Solución:**
- `components/features/orders/ClientSection.tsx`:
  - **Typeahead custom** reemplaza al `<select>`:
    - `<input>` con placeholder "Buscar cliente por nombre, teléfono o dirección...".
    - Filtrado `useMemo`: `clientes.filter(c => c.name|phone|address.includes(q))` case-insensitive. Si el input está vacío, muestra los primeros 30 clientes.
    - Dropdown flotante (`position: absolute`, `max-height: 280px`, scroll) con cada item mostrando **nombre + (teléfono · email · dirección)**.
    - Click en item → `update('client_name', ...)` etc. + `setQuery('')` + `setOpen(false)`.
  - **Botón "✕"** para limpiar el cliente seleccionado (visible cuando hay cliente activo o query no vacía, posicionado absolute dentro del input).
  - **Inline "+ Crear cliente 'X'"** aparece al final del dropdown cuando hay texto en el input sin matches → abre el modal pre-llenando el nombre con lo que escribió el usuario.
  - Botón **"+ Nuevo"** al lado del input (igual que antes).
  - Modal `<Modal title="Nuevo Cliente">` (no inline `<h2>` como antes) con `<form>` y campos nombre (required, autoFocus), teléfono, email, dirección.
- `hooks/useFormReferences.ts`: reemplaza `refreshClientes` por `addOrRefreshClientes(newClient?: Client)`:
  - Con Client: prepend a la lista local sin refetch (`setClientes(prev => [newClient, ...prev])` con dedupe por `id`).
  - Sin args: fallback al `fetchClientes()` (full refetch) para compatibilidad.
- `hooks/useEntityForm.ts`: reexportado como `addOrRefreshClientes` en lugar de `refreshClientes`.
- `types/form.ts`: `UseEntityFormReturn.addOrRefreshClientes: (newClient?: Client) => void` (param tipado `Client` para evitar `Record<string, unknown>` cast).
- `pages/budgets/BudgetFormClient.tsx` + `pages/work-orders/WorkOrderFormBasic.tsx`: prop type `onClientCreated: (newClient: Client) => void` (antes era `() => void`).
- `pages/budgets/BudgetFormPage.tsx` + `pages/work-orders/WorkOrderFormPage.tsx`: destructuring `addOrRefreshClientes` (en vez de `refreshClientes`) y pasarlo a `<BudgetFormClient onClientCreated={addOrRefreshClientes} ... />`.

**Garantía clave:** al crear un cliente nuevo desde el modal, los datos **ya cargados** del budget/WO (material, color, espesor, items, total, observaciones, etc.) **NO se refrescan**. Solo se prepend el cliente nuevo a la lista del dropdown. Los `update('client_name', created.name)`, `update('client_phone', ...)` etc. sí se ejecutan — pero son los datos del cliente recién creado, intencionalmente.

**Bug fix (synthetic submit bubble a través del portal):**
El `<form onSubmit={handleCreateClient}>` del modal se renderiza via `createPortal` a `document.body`, pero el sistema de synthetic events de React sigue propagando el `submit` a través del árbol de React — no del DOM. Sin fix, al hacer click en "Crear Cliente" también se disparaba `handleSubmit` del `<form>` padre del BudgetFormPage/WorkOrderFormPage, que hacía `POST /budgets` + `navigate('/admin/budgets')` y sacaba al usuario de la sección. Verificado con Playwright: `POST clients [201]` seguido de `POST budgets [500]` (sin el fix). Solución: `e.stopPropagation()` después de `e.preventDefault()` en `handleCreateClient` — el submit queda confinado al modal.

**Verificación:** `tsc --noEmit` 0 errores · `vite build` 9.66s · gzip 367 KB.

---

## Clients module (sesión actual)

### Client delete: 409 conflict + notify error ✅

**Backend** (`afamar-backend/app/services/client.py:48-62` + `api/routers/clients.py:62-78`):
- `ClientService.count_dependent_records(client_id)` cuenta presupuestos/órdenes vinculadas (2 queries, una por tabla).
- `DELETE /api/v1/clients/{id}` ahora chequea antes de borrar. Si hay presupuestos/órdenes vinculadas → `raise ConflictError(...)` (HTTP 409) con mensaje descriptivo en español: `"No se puede eliminar el cliente porque tiene X presupuestos asociado(s) y Y orden(es) de trabajo asociada(s). Eliminá o reasigná esos registros primero."` Singular/plural correctos vía branches.
- Antes: MySQL devolvía 500 por FK constraint sin mensaje útil.

**Frontend** (`afamar-frontend/src/pages/clients/ClientsListPage.tsx`):
- `handleDelete` ahora envuelve `deleteMutation.mutateAsync(deleteId)` en `try/catch`:
  - éxito → `notify('Cliente eliminado correctamente', 'success')` + cierra el modal
  - error → `notify((err as Error).message, 'error')` + deja el modal abierto (user puede revisar y cancelar)
- Antes: `await mutateAsync()` sin catch → unhandled promise rejection → toast nunca aparecía.

### `/admin/clients` — agregar columna "Presupuestos" + fix Ordenes/Última orden ✅

**Backend** (`afamar-backend/app/services/client.py:31-86`):
- Nuevo método `ClientService.list_with_stats(skip, limit)` retorna `[{...cliente, total_budgets, total_orders, last_order_number}]` usando 3 queries agregadas (GROUP BY para presups, GROUP BY para OTs, ORDER BY para `last_order_number`). Costo constante independiente del page size — sin N+1.
- `GET /api/v1/clients` usa este método y arma la `Page` a mano para mantener `pagination`.

**Frontend** (`afamar-frontend/src/pages/clients/ClientsListPage.tsx`):
- `LocalClient` interface renombrada a snake_case: `total_budgets?`, `total_orders?`, `last_order_number?`. Ya matchean el backend directo (sin mapping).
- Nueva columna **"Presupuestos"** (badge naranja `badge-pending`).
- Columnas existentes "Ordenes" y "Ultima orden" ahora muestran datos reales (antes siempre `0`/`-` porque el backend no las populaba).
- `colSpan` del empty state 9 → 10.

### `GET /api/v1/clients/{id}` — respuesta unificada con historial ✅

**Backend** (`afamar-backend/app/services/client.py:25-30` + `api/routers/clients.py:28-34`):
- Nuevo método `ClientService.get_with_history(client_id)` que reutiliza `repo.get_history(client_id)` para combinar los datos básicos del cliente + agregados + listas recientes (orders/budgets) en un solo round-trip.
- `GET /api/v1/clients/{id}` ahora retorna `{...cliente, total_budgets, total_orders, last_order_number, orders, budgets}`.
- El endpoint `GET /clients/{id}/history` sigue funcionando para backward-compat.

### ClientFormPage: card "Presupuestos asociados" ✅

**CSS** (`afamar-frontend/src/pages/clients/ClientFormPage.module.css`):
- Renombré clases específicas de órdenes a genéricas: `__orders/__order*` → `__items-list/__item*`. Misma estructura ahora sirve para presupuestos y órdenes.
- Nueva clase `__item-empty` para estados vacíos.

**JSX** (`afamar-frontend/src/pages/clients/ClientFormPage.tsx:46-56`):
- `historial` ahora incluye `budgets` además de `orders` (snapshot del backend).
- Nueva card **"Presupuestos asociados"** debajo de "Órdenes asociadas". Cada item: número (P-XXXXXX) + StatusBadge + total formateado + flecha → click navega a `/admin/budgets/{id}`.
- Cada card se renderiza condicionalmente: solo si tiene items (oculta cuando no hay).

### ClientFormPage: layout 2×2 grid ✅

**Estructura nueva** (`afamar-frontend/src/pages/clients/ClientFormPage.tsx` + `.module.css`):
```
Row 1 (mismo alto): [Datos del cliente]  [Historial del cliente]
Row 2 (mismo alto): [Presupuestos asoc.] [Órdenes asoc.]
```

**CSS**:
- `.client-form__layout` ahora es `flex-direction: column` con dos filas.
- `.client-form__row` es `grid` de 2 columnas (`1fr 1fr`) con `align-items: stretch` → celdas de cada fila comparten altura automáticamente.
- `.client-form__col` (flex wrapper) + `.client-form__card--fill` (`flex: 1`) hacen que la card llene la celda.
- `@media (max-width: 900px)` colapsa a una columna en pantallas chicas.
- Renombré la antigua `__row` (form-row de 2 cols dentro del form) a `__form-row` para no chocar con el nuevo `__row` de grid.

**JSX**:
- Quité el `style={{ marginTop: 16 }}` inline — el `gap: 16px` del grid se encarga.
- Las cards de "Órdenes" y "Presupuestos" ahora se renderizan **siempre** (incluso vacías) mostrando `"Sin presupuestos asociadas."` / `"Sin órdenes asociadas."` para mantener simetría visual.
- En `/admin/clients/new` (create mode) solo se muestra "Datos del cliente" (sin historial/budgets/ordenes).

**Verificación Playwright:**

| Página | Row 1 (px) | Row 2 (px) |
|---|---|---|
| `/admin/clients/1` (Gonzalo) | 404 / 404 | 270 / 270 |
| `/admin/clients/2` (Test, 0 OT) | simétrico + empty msg | simétrico |
| `/admin/clients/new` | solo "Datos del cliente" | (no aplica) |

### Client no carga al editar budget/WO existente ✅

**Bug**: `GET /work-orders/{id}` y `GET /budgets/{id}` retornaban `client_name=""` y `snapshot_*=null` (nunca se populaban). Resultado: al editar un budget/WO existente, el campo "Cliente" aparecía vacío aunque el cliente existiera.

**Dos problemas concatenados:**

1. **Backend nunca populaba `snapshot_*`**: `BudgetService.create()` y `WorkOrderService.create()` resolvían el `client_id` pero **nunca copiaban** los datos del cliente a `snapshot_name/phone/email/address`. Todas las filas en DB tenían esos campos NULL.

2. **Frontend `mapApiToForm` leía `d.client_name` (que el backend ni siquiera expone)**: la DB no tiene `client_name` column en budgets/work_orders — solo `client_id` + `snapshot_*`.

**Fix backend** (`afamar-backend/app/services/budget.py:91-99` + `work_order.py:191-199`):
- En `BudgetService.create()` y `WorkOrderService.create()`, después de resolver `client_id`, se consulta el `Client` y se populan `snapshot_name/snapshot_phone/snapshot_email/snapshot_address`. A partir de ahora toda budget/WO nueva queda con snapshot válido.

**Fix frontend** (`afamar-frontend/src/hooks/useFormReferences.ts`):
- Refactor del `useEffect` a `async/await`: ahora se cargan **`clientes` antes** de la entidad, para que el fallback pueda usarlos.
- Nueva helper `resolveClientFields(data, clientes)`:
  1. Si `snapshot_name` existe → lo usa (snapshot histórico)
  2. Si es null y hay `client_id` → busca el cliente en `clientes` por id (legacy rows)
  3. Reescribe los campos `client_name/client_phone/client_email/client_address` en el payload resuelto antes de pasar a `mapApiToForm`.

**Verificación curl:**
```
POST /budgets {client_id: 2}    → snapshot_name="Test", snapshot_phone="123" ✅
POST /work-orders {client_id: 1} → snapshot_name="Gonzalo Gonzalez", snapshot_phone="2215715177" … ✅
```

**Verificación Playwright (registros legacy, snapshot=null):**
- `/admin/work-orders/4`: Cliente=`Gonzalo Gonzalez`, Tel=`2215715177`, Email=`gg161087@gmail.com`, Domicilio=`calle 54 1160 La Plata` ✅
- `/admin/budgets/2`: Cliente=`Test`, Tel=`123` ✅

### MaterialCard theming (CSS module, BEM, theme-aware) ✅

**Antes**: `MaterialCard.tsx` tenía `// @ts-nocheck` y todas las clases inline con colores hardcoded (`#fff`, `#e2e8f0`, `#1a202c`, etc.) que no respondían al dark/light theme.

**Después** (`afamar-frontend/src/components/features/materials/MaterialCard.tsx` + `.module.css`):
- Nuevo `MaterialCard.module.css` con BEM completo:
  ```
  .material-card                          block (bg, border, shadow, radius)
  .material-card__header                  flex row
  .material-card__title-group             wraps name + category badge
  .material-card__title                   material name (uppercase)
  .material-card__category                badge pill
  .material-card__actions                 alt checkbox + remove button
  .material-card__alt-label               "Alternativa" checkbox wrapper
  .material-card__alt-checkbox            the checkbox
  .material-card__remove                  × delete button
  .material-card__fields                  2-col grid
  .material-card__field                   single field cell
  .material-card__label                   field caption
  .material-card__input                   shared input style (compact)
  .material-card__price                   displayed price (ARS)
  .material-card__price--usd              modifier: USD color
  .material-card__footer                  bottom row
  .material-card__m2                      m² label
  .material-card__m2-value                m² number (info color)
  .material-card__subtotal                the dollar figure
  ```
- Removí `// @ts-nocheck`. `mat` prop ahora tipado como `MaterialInForm` (de `types/budget.ts`).
- Mapeé todos los colores hardcoded a theme vars:
  - `#fff` → `var(--surface-bg)`
  - `#e2e8f0` → `var(--border-color)`
  - `rgba(0,0,0,0.05)` → `var(--shadow-color)`
  - `#1a202c` → `var(--text-primary)`
  - `#718096` → `var(--text-muted)`
  - `#edf2f7` → `var(--surface-alt-bg)`
  - `#4a5568` → `var(--text-secondary)`
  - `#e53e3e` → `var(--color-danger)` + hover `var(--color-danger-hover)`
  - `#059669` → `var(--color-success)`
  - `#f7fafc` → `var(--surface-alt-bg)`
  - `#2b6cb0` → `var(--color-info)`
  - `#2f855a` → `var(--color-success)`
- Factoricé `formatPrice` y `formatSubtotal` (lógica repetida).
- Bonus: agregué `aria-label="Eliminar material"` al botón ×.
- Bonus: `accident-color: var(--color-primary)` en el checkbox para que el ✓ use el color del tema.

**Fix types en call sites** (`BudgetFormSpecs.tsx:43` + `WorkOrderFormSpecs.tsx:39`):
- `mat={mat as unknown as Record<string, unknown>}` → `mat={mat as unknown as import('../../types/budget').MaterialInForm}` para satisfacer la nueva prop tipada.

**Verificación Playwright (computed styles):**

| Propiedad | Dark | Light |
|---|---|---|
| card.bg | `rgb(15, 23, 42)` (slate-900) | `rgb(255, 255, 255)` |
| card.border | `rgb(51, 65, 85)` (slate-700) | `rgb(231, 224, 208)` (sepia) |
| title.color | `rgb(241, 245, 249)` (slate-100) | `rgb(28, 25, 23)` (slate-900) |
| footer.bg | `rgb(30, 41, 59)` (slate-800) | `rgb(245, 240, 232)` (warm beige) |

Las 4 propiedades cambian entre modos → theme-aware ✅ · sin `style="background:..."` inline.

**PoolCard** (`components/features/materials/PoolCard.tsx`) **aún tiene inline styles hardcoded** — fuera de scope de este ticket pero seguiría el mismo patrón cuando se migre.

---

## Dark/Light theme + USD auto-fill + PdfPreviewModal theme (sesión anterior)

### Dark/Light theme system ✅
- `src/context/ThemeContext.tsx` (new): dark default, light via `data-theme="light"`, localStorage persistence
- `index.html`: inline script for FOUC prevention (sets `data-theme` before React)
- `src/index.css`: 40+ CSS vars for dark + light themes; all global utility classes (.btn, .input, .card, .table, .badges) refactored to use vars
- `MainLayout.module.css`: all hardcoded colors replaced with `var(--sidebar-*)`, `var(--topbar-*)`, `var(--text-*)`, etc.
- `MainLayout.tsx`: imports `useTheme`, adds Moon/Sun toggle in profile dropdown
- **25+ page CSS modules** refactored from 348→69 hardcoded colors (80% reduction)
- SignatureCanvas adapted to theme (background `#0f172a`/ink `#f1f5f9` in dark mode)
- Sidebar active item contrast improved (slate-700 bg + light text)
- BudgetPanel.module.css created with 11 themed classes
- OnlineItemsTable inputStyle uses `var(--input-bg)`, `var(--input-border)`, `var(--input-text)`
- TermsEditor, Modal, BudgetPanel all themed

### USD auto-fill desde dolarapi.com ✅
- `src/utils/dolarApi.ts` (new): función `fetchUsdVenta()` que pega a `https://dolarapi.com/v1/dolares/oficial` y retorna `data.venta`
- `OnlineBudgetHeader.tsx`: botón "Actualizar" al lado del input "DOLAR DEL DIA" en `/admin/online-budgets/new`

### PdfPreviewModal dark mode fix ✅
- Reemplazados colores hardcodeados (`#fff`, `#e5e7eb`, `#f3f4f6`, `#6b7280`, `#9ca3af`) por CSS vars (`var(--surface-bg)`, `var(--border-color)`, `var(--surface-alt-bg)`, `var(--text-muted)`)

## Stock deduction & dead-code cleanup (sesión anterior)

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

## Commits locales sin pushear

### Sesión actual: drop snapshot_* columns + FK-only pattern + PDF al frontend + ClientInfoCard + bank info

#### A) Backend — drop `snapshot_*` columns + `client_id` FK en mediciones (FK-only pattern)

**Migraciones Alembic (ambas sin aplicar, `alembic upgrade head` requerido):**
- `f2f33071224f_drop_snapshot_columns.py` — borra `snapshot_name / snapshot_phone / snapshot_email / snapshot_address` de `budgets` y `work_orders`. Downgrade restaura las 8 columnas.
- `20878d9185cb_add_client_id_to_measurements_drop_.py` (filename truncado, pendiente renombrar antes de commit) — agrega `client_id: int | None` con FK a `clients.id` (`ondelete='SET NULL'`) + index a `measurements`, y borra los legacy `client_name / client_phone / client_address` text columns. Downgrade restaura los 3 campos.

**Modelos (`app/models/*.py`):**
- `budget.py` y `work_order.py` — removidas las 4 columnas `snapshot_*`.
- `measurement.py` — removidas 3 text columns; agregadas `client_id: int | None` (FK) + `client` / `work_order` relationships.
- `client.py` — agregada `measurements = relationship("Measurement", back_populates="client")`.
- `work_order.py` — agregada `measurement = relationship("Measurement", back_populates="work_order", uselist=False)`.

**Schemas (`app/schemas/*.py`):**
- `BudgetResponse` y `WorkOrderResponse` — removidos `snapshot_*` de Base/Update. `from_orm_with_snapshot` renombrado a `from_orm_with_client`, implementación reducida de ~80 líneas a 3 (`model_validate(orm).model_dump()` + overwrite `client_*` desde `orm.client`).
- `MeasurementResponse` — removidos `client_name/phone/address` de Base/Update; agregados `client_id: int | None` a Base; **re-agregados** `client_name/phone/email/address` (optional) en Response, populados por `from_orm_with_client` JOIN. `email` es nuevo.

**Services (`app/services/*.py`):**
- `budget.py:create()` y `work_order.py:create()` — quitado el bloque que populaba `client.snapshot_*` (ya no hay columna). `_create_cash_movement_on_deposit` ahora lee `client.name` desde `budget.client` / `order.client` en vez de `snapshot_name`.
- `online_budget.py` — quitado `"snapshot_name": online_budget.client_name or ""` del convert-to-WO payload.
- `pdf.py` (reportlab legacy) — removidos fallbacks `or budget_data.get("snapshot_name", "")`; client fields vienen exclusivamente de `client_data` dict.

**Routers (`app/api/routers/*.py`):**
- `budgets.py` — **eliminado** `POST /budgets/preview-pdf` (~50 líneas, frontend ahora genera PDFs). `GET /budgets` search ahora hace `Client.name.ilike` (sin `snapshot_name`).
- `work_orders.py` — **eliminado** `POST /work-orders/preview-pdf` (~50 líneas). `_prepare_work_order_payload` lee client data desde `order.client` (live).
- `measurements.py` — `GET /measurements` ahora acepta `search` + `status` query params (nuevo). Serializa via `from_orm_with_client`.
- `whatsapp.py` — `order.snapshot_phone` → `order.client.phone`, mismo para name.

**Repositories (`app/repositories/*.py`):**
- `budget.py` y `work_order.py` search methods — drop `snapshot_name.ilike(...)` clause, agregan `outerjoin(Client) + Client.name.ilike(...)`.

#### B) Frontend — PDF rendering al frontend con `@react-pdf/renderer`

**Dependencia nueva (`package.json`):**
- `@react-pdf/renderer@^4.5.1` + transitivas (`@noble/ciphers`, `@noble/hashes`, `@react-pdf/fns`, etc.). ~25 nuevas entradas en `package-lock.json`.

**Archivos nuevos (6):**
- `src/utils/pdf/buildPdfData.ts` (440 líneas) — port TypeScript de los Python helpers `build_budget_pdf_data` / `build_work_order_pdf_data`. Exporta `buildPdfData({ form, document_type, overrides, company, globalTerms, sketchImages })` + types `PdfDocumentData`, `PdfDataRow`, `MaterialPdfRow`, `PoolPdfRow`, `CompanyInfo`, `TermsInfo`. Helpers: `fmtNum`, `fmtMoney`, `conceptToDisplay`, `parseJsonList`, `splitTerms`, `buildFabricationRows`, `buildMaterialRows`, `buildPoolRows`. Lookup tables: `CONCEPT_DISPLAY` (concept code → Spanish label), `STATUS_SUB_MAP`. Sets: `M2_CONCEPTS`, `UNIT_CONCEPTS`, `LINEAR_CONCEPTS`.
- `src/components/ui/PdfPreviewModal/DocumentPdf.tsx` (481 líneas) — `<Document>` de `@react-pdf/renderer`. **Single source of truth** para budget + work-order PDFs. Mismo layout visual que el legacy `templates/document_pdf.html` (xhtml2pdf + Jinja2) pero con texto seleccionable y flow automático entre páginas.
- `src/components/ui/PdfPreviewModal/CroquisImageExtractor.tsx` (169 líneas) — hidden off-screen Konva `<Stage>` que re-renderiza las páginas del croquis y emite PNGs base64 vía `stage.toDataURL()`. Normaliza 3 shapes distintas (editor pages, backend flat list, legacy). Llamado por los form pages y list pages antes de construir el PDF.
- `src/hooks/useSettingsWithTerms.ts` (99 líneas) — bridge entre `GET /api/v1/settings` y el PDF renderer. Carga via TanStack Query (`['settings']` cache key), split en `CompanyInfo` (header/footer) + `TermsInfo` (terms como `string[]`). Retorna `{ company, globalTerms, loading, error, reload }`. Default fallback hardcodea `AFAMAR` + `MÁRMOLES & GRANITOS` + `company_logo: '/uploads/logo.png'`.

**`PdfPreviewModal.tsx` refactor (158 líneas diff):**
- Nuevo modo react-pdf: `data: PdfDocumentData` → renderiza `<PDFViewer>` (interactivo) + `<PDFDownloadLink>` en el header (nuevo).
- Modo viejo `pdfUrl: string` (iframe) ahora es dead code en callers pero se mantiene la prop para backward compat.
- JSDoc banner al top documenta ambos modos.
- Header restructurado: title left, action group right (Download + Close buttons).
- Loading overlay con `color-mix(in srgb, var(--surface-alt-bg) 80%, transparent)`.
- New fallback state: "No se pudo generar la vista previa" cuando no hay `data` ni `pdfUrl`.

**4 call sites migrados al flujo frontend-PDF:**
- `BudgetFormPage` + `WorkOrderFormPage` (en submit / vista previa).
- `BudgetsListPage` + `WorkOrdersListPage` (botón PDF por row).

**`useFormReferences.ts` (−53 líneas):**
- Removido `resolveClientFields(data, clientes)` helper completo. Backend ahora JOIN-ea `Client` y popula `client_*` en la response, así que el frontend pasa la API response directo a `mapApiToForm` sin fallback.

**`types/measurement.ts`:**
- `Measurement` interface: `clientName/Phone/Address` (camelCase text) → `client_id: number | null` + `client_email: string | null` (nuevo, no estaba en legacy). `client_name/phone/address` marcados como `| null`.
- `MeasurementFormData`: `clientName/Phone/Address` → `clientId: number | null`.

**`types/workOrder.ts`:**
- `WorkOrderPayload` — removidos 4 `snapshot_*` fields + 2 docs comments. ⚠️ **Regresión de indentación líneas 39–41** (a corregir antes de commit).
- `WorkOrderListItem` — removidos 2 `snapshot_*` fields, agregado `client_id: number | null`. Comment actualizado ("from the related Client row").

**`api/resources/budgets.ts` y `workOrders.ts` (−2 líneas c/u):**
- Removidos `previewBudgetPdf` y `previewWorkOrderPdf` (ya no existen los endpoints backend).
- `getBudgetPdfBlob` y `getWorkOrderPdfBlob` ahora son **dead code** (a eliminar antes de commit).

**`MeasurementFormPage.tsx` rewrite (−297 líneas):**
- Form state: `{ clientName, clientPhone, clientAddress }` (text snapshot) → `{ clientId: number | null }` (FK).
- Eliminado el `<ClientSection>` typeahead de esta página. Layout nuevo 2 columnas: WO + fields (left), `<ClientInfoCard client={selectedClient} />` (right, read-only).
- Cliente ahora se selecciona **solo** via el WO dropdown (`handleWorkOrderChange` lee `wo.client_id`).
- `useEffect` ahora depende de `[measurement]` (eslint-disabled) en vez de `[measurement, clientes]`.
- Pre-select: `selectedClientId` se setea desde `measurement.client_id`.

**`MeasurementFormPage.module.css` (42 líneas diff):**
- Removido el bloque de documentación BEM al top.
- Nueva layout 2 columnas: `.measurement-form__layout` (grid `1.4fr 1fr`, gap 16px) + `.measurement-form__left` / `.measurement-form__right` (column wrappers).
- Quitado `max-width: 700px` de `.measurement-form__card`.
- `@media (max-width: 800px)` colapsa a 1 columna en mobile.
- Agregado final newline en EOF.

**`ConfigurationPage.tsx` (−4 líneas):**
- Removido `import http from '@/api/http'`. `logoSrc` simplificado: `logoPreview || companyLogo || null` (backend ahora devuelve URLs absolutas en `company_logo`).

**`BudgetsListPage.tsx` + `WorkOrdersListPage.tsx` (53 líneas diff c/u):**
- PDF preview flow: en vez de `getBudgetPdfBlob` (backend), ahora `getBudget(id)` + `buildPdfData({form, company, globalTerms, sketchImages})` + `<PdfPreviewModal data={data}>`. Single round-trip para PDFs.

#### C) Frontend — `ClientInfoCard` componente (read-only client display)

**Archivos nuevos (2):**
- `src/components/orders/ClientInfoCard/ClientInfoCard.tsx` (39 líneas) — recibe `{ client: Client | undefined }`. Renderiza card con `<h3>Cliente</h3>` + nombre + phone (con `<Phone>` icon) + email (con `<Mail>`) + address (con `<MapPin>`). Empty state: "Seleccioná un cliente para ver sus datos."
- `src/components/orders/ClientInfoCard/ClientInfoCard.module.css` (30 líneas) — BEM classes: `__title`, `__details`, `__name`, `__field`, `__empty`. Theme-aware (var(--text-primary), var(--text-secondary), var(--text-muted)). Sin inline styles.

**Adoptado en 3 lugares:**
1. **`MeasurementFormPage.tsx`** (right column del layout 2-col) — siempre read-only, el cliente viene del WO seleccionado.
2. **`BudgetFormClient.tsx` (modificado)** — wrapper de `ClientSection` con lógica condicional:
   - Si `form.client_name` matchea un client en `clientes` → renderiza `<ClientInfoCard>` dentro de `<div className="card">`.
   - Si no matchea → renderiza el typeahead `<ClientSection>`.
3. **`pages/work-orders/WorkOrderFormClient.tsx` (nuevo, reemplaza a `WorkOrderFormBasic`)** — misma lógica condicional que `BudgetFormClient`.

#### D) Split `WorkOrderFormBasic` → `WorkOrderFormClient` + `WorkOrderFormStatus`

**Problema:** las 2 cards (cliente + status) estaban pegadas sin separación, rompiendo el ritmo vertical consistente del resto del form.

**Cambios:**
- **Eliminado:** `pages/work-orders/WorkOrderFormBasic.tsx` y `.module.css`.
- **Nuevo:** `pages/work-orders/WorkOrderFormClient.tsx` — solo el cliente (mismo patrón que `BudgetFormClient`).
- **Nuevo:** `pages/work-orders/WorkOrderFormStatus.tsx` — la card "ESTADO Y PRIORIDAD" extraída.
- **Nuevo:** `pages/work-orders/WorkOrderFormStatus.module.css` — `.work-order-form-status__grid` (BEM, sin inline styles).
- **`WorkOrderFormPage.tsx`**: importa los dos nuevos, los wrappea con `<div className={s['work-order-form__card-section']}>` para dar `margin-top: 16px` consistente con `__layout` y `__bottom`.
- **`WorkOrderFormPage.module.css`**: agregada `.work-order-form__card-section { margin-top: 16px }` con comment que aclara: "El primer card (WorkOrderFormClient) no la usa, las siguientes sí".

#### E) Status options hardcodeadas → `orderStatuses` + `t()` (single source of truth)

**Problema:** en `WorkOrderFormBasic` el `<select>` de estado tenía options hardcodeadas en español:
```jsx
<option value="MEDICION">Medición</option>
<option value="TALLER">Taller</option>
<option value="TERMINADA">Terminada</option>
<option value="ENTREGADA">Entregada</option>
<option value="CANCELADA">Cancelada</option>
```
Y peor, los **values** eran Spanish (legacy), no English como el resto del codebase (DB usa English: `MEASUREMENT`, `WORKSHOP`, `FINISHED`, `DELIVERED`, `CANCELLED`).

**Fix en `WorkOrderFormStatus.tsx`:**
```jsx
import { orderStatuses } from '../../utils/formatters';
import { t } from '../../utils/translate';
// ...
{orderStatuses.map((status) => (
  <option key={status} value={status}>{t(status)}</option>
))}
```
- Values: English (`MEASUREMENT`, etc.) — match con DB y backend.
- Display: Spanish via `t()` de `utils/translate.ts`.
- `t()` ya tenía los mappings correctos (PENDING→"Pendiente", MEASUREMENT→"Medición", etc.).

#### F) Bank info en PDF cuando `payment_method === 'TRANSFERENCIA BANCARIA'`

**Problema:** si el cliente paga por transferencia, el PDF no mostraba los datos bancarios (ALIAS/BANCO). El usuario tiene que adivinar o consultar.

**Constantes (`src/constants/index.ts`):**
- `PAYMENT_METHOD_TRANSFER = 'TRANSFERENCIA BANCARIA'` — string literal que el form guarda.
- `BANK_INFO = { alias: 'afamar', banco: 'CREDICOOP', titular: 'afamar SRL' }` — single source of truth para datos bancarios.

**Rendering (`DocumentPdf.tsx`):**
- Después de la línea "Forma de pago: TRANSFERENCIA BANCARIA (X cuotas)", si `data.payment_method === PAYMENT_METHOD_TRANSFER`, renderiza 2 líneas indentadas:
  ```
  ALIAS: afamar
  BANCO: CREDICOOP a nombre de afamar SRL
  ```
- Nuevo style `bankRow` (fontSize 8.5, marginLeft 8, color slate-700) — visualmente subordinado al paymentRow, no parece una sección nueva.
- Funciona en ambos `document_type` (presupuesto y orden de trabajo).

#### Verificación
- `tsc --noEmit` 0 errores
- `vite build` 11.05s, gzip 875.66 KB (PDF renderer agrega ~250KB)

#### ⚠️ Riesgos / cosas a revisar antes de commit
1. **Migraciones sin aplicar** — `alembic upgrade head` antes de levantar backend. Filename truncado: renombrar `20878d9185cb_add_client_id_to_measurements_drop_.py` (terminar la palabra).
2. **`WorkOrderFormPage.tsx` imports sin usar** — `CurrencyDisplay`, `SketchSection`, `StatusBadge` (a limpiar).
3. **`WorkOrderPayload` types/workOrder.ts** — regresión de indentación líneas 39–41.
4. **`getBudgetPdfBlob` y `getWorkOrderPdfBlob`** — dead code en `api/resources/*.ts` (eliminar).
5. **`pdfUrl` prop en `PdfPreviewModal`** — dead code en callers (considerar eliminar la prop, o dejarla para forward compat).
6. **Filas existentes de mediciones** — la migración `20878d9185cb` dropea `client_name/phone/address` sin backfill. Si hay mediciones con esos campos poblados, se perderán. Verificar que no hay prod data o hacer backfill antes de aplicar.
7. **PLAN.md items** — marcar nuevos como completados (#5 FinancialBase, #11 inline styles, #12 reorg, etc.).

---

### Sesión anterior: extract shared code (Semana 3 PLAN.md) + @ts-nocheck cleanup

**Semana 3 completa — extracciones BudgetForm/WorkOrderForm:**

| Item | Archivo | Cambio |
|------|---------|--------|
| #4d `parseNumber()` | `utils/formatters.ts` | Nuevo helper. BudgetFormPage (4 refs) + WorkOrderFormPage (4 refs) migrados |
| #4a `buildPayloadWithTerms()` | `hooks/entityFormHelpers.ts` | Nueva función genérica. BudgetFormPage + WorkOrderFormPage migrados |
| #4e `DiscountBlock` | `components/features/orders/DiscountBlock.tsx` + `.module.css` | Nuevo componente. BudgetPanel + WorkOrderFormPage migrados |
| #4b `usePdfPreview` | `hooks/usePdfPreview.ts` | Nuevo hook. BudgetFormPage + WorkOrderFormPage migrados |
| #4c `useConfirmPayment` | `hooks/useConfirmPayment.ts` | Nuevo hook. BudgetFormPage + WorkOrderFormPage migrados |

**Semana 4 (completa):**

| Item | Archivo | Cambio |
|------|---------|--------|
| #9 `@ts-nocheck` eliminado | `FabricationTable.tsx` | Rewrite completo — tipado `FabricationDetail[]`, CSS module, sin inline styles. Era el último file con `@ts-nocheck`. `FabricationSection.tsx` props actualizados |
| #10 `CurrencyDisplay` adoptado | `BudgetPanel.tsx` + `FabricationTable.tsx` | 6 USD + 1 mixed-currency `.toLocaleString()` → `<CurrencyDisplay>` |
| #4f CSS modules fusion | `pages/common/EntityFormBase.module.css` (nuevo) + 4 TSX files | Clases compartidas (layout, card, bottom, right) extraídas a base común. Budget+WO CSS reducidos ~50%. Sin cambios visuales |

**Verificación:** `tsc --noEmit` 0 errores · `vite build` 10.6s · 372 KB gzip.

### Sesión anterior: fix mediciones client data (snake_case sync)

**Bug:** `Measurement` type usaba camelCase (`clientName`, `clientPhone`, etc.) pero el backend retorna snake_case (`client_name`, `client_phone`, etc.). La lista y el form de mediciones no mostraban datos del cliente.

**Frontend (3 archivos modificados):**
- `afamar-frontend/src/types/measurement.ts` — `Measurement` interface cambiada a snake_case (`client_name`, `client_phone`, `client_address`, `scheduled_date`, `scheduled_time`, `notes`, `sketch_data`, `photos_data`, `created_at`, `updated_at`). `MeasurementFormData` sin cambios (camelCase, solo del form).
- `afamar-frontend/src/pages/measurements/MeasurementsListPage.tsx` — tabla ahora lee `m.client_name`, `m.client_phone`, `m.client_address`, `m.scheduled_date`, `m.scheduled_time`.
- `afamar-frontend/src/pages/measurements/MeasurementFormPage.tsx` — `useEffect` que carga medición existente ahora lee `measurement.client_name`, `measurement.notes` y hace `JSON.parse` de `sketch_data`/`photos_data` (vienen como string del backend).

**Verificación:** `tsc --noEmit` 0 errores · `npm run build` pasa limpio · API confirma campos snake_case.

### Sesión anterior 2: clients module + MaterialCard theming

**Backend (4 archivos modificados):**
- `afamar-backend/app/api/routers/clients.py` — `count_dependent_records` + `ConflictError(409)` en DELETE; usa `list_with_stats`/`get_with_history` para GET
- `afamar-backend/app/services/client.py` — nuevos métodos `list_with_stats` y `get_with_history` (single round-trip, 3 queries agregadas)
- `afamar-backend/app/services/budget.py` — `create()` ahora popula `snapshot_name/phone/email/address` del Client resuelto
- `afamar-backend/app/services/work_order.py` — mismo fix en `create()`

**Frontend (8 archivos modificados, 1 nuevo):**
- `afamar-frontend/src/components/features/orders/ClientSection.tsx` — `e.stopPropagation()` después de `preventDefault()` en `handleCreateClient` (evita synthetic submit bubble a través del portal)
- `afamar-frontend/src/components/features/materials/MaterialCard.tsx` — removí `// @ts-nocheck`, tipé con `MaterialInForm`, removí inline styles → CSS module
- `afamar-frontend/src/components/features/materials/MaterialCard.module.css` (nuevo) — BEM + theme vars
- `afamar-frontend/src/hooks/useFormReferences.ts` — refactor a `async/await`, carga clientes ANTES de la entidad, helper `resolveClientFields` con fallback a clientes list
- `afamar-frontend/src/pages/budgets/BudgetFormSpecs.tsx` — type cast fix (`MaterialInForm` en lugar de `Record<string, unknown>`)
- `afamar-frontend/src/pages/work-orders/WorkOrderFormSpecs.tsx` — mismo type cast fix
- `afamar-frontend/src/pages/clients/ClientsListPage.tsx` — `useNotify` + try/catch en `handleDelete`; nueva columna Presupuestos; `LocalClient` renombrado a snake_case
- `afamar-frontend/src/pages/clients/ClientFormPage.tsx` — card Presupuestos asociados; layout 2×2 grid; empty states en cards
- `afamar-frontend/src/pages/clients/ClientFormPage.module.css` — `__row`→`__form-row` (renombre), `__row` (grid row), `__col`, `__card--fill`, items-list genérico

### Sesiones previas en `refactor` (119 archivos modificados, 1 nuevo)

**Backend (5 archivos):**
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
5. **Verificar que `npm run build` pasa limpio** (✓ ya pasa — Vite genera ~875KB gzip con @react-pdf/renderer; 367KB sin él)
