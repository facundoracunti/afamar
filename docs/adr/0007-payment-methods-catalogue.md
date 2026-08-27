# ADR 0007 — Catálogo de `payment_methods` + recargo de interés incremental

**Estado:** Aceptado · **Fecha:** 2026-08-24

## Contexto

Antes de este cambio, la regla de recargo por tarjeta de crédito vivía
hardcodeada en el form de presupuesto:

- `value=5`, `is_percentage=True`, `applies_to_installments=True`
- 1-2 cuotas → 0% (suprimido), 3+ cuotas → `value × N` (5%, 10%, 15%…)

Esto traía tres problemas:

1. **El catálogo de métodos de pago no existía** — los métodos se
   identificaban por el string `payment_method` (snapshot), sin FK a
   una tabla de configuración. Cambiar la regla requería tocar el
   form.
2. **La regla no se aplicaba en el PDF legacy** (backend,
   `pdf_html.py` + `document_pdf.html`) — el cliente veía el total
   final sin saber cuánto recargo se le había aplicado.
3. **El "1-2 cuotas → 0%" era arbitrario** y distinto del cálculo del
   banco real, donde el interés aplica desde la primera cuota.

## Decisión

### 1. Catálogo `payment_methods`

Agregar la tabla de catálogo con estas columnas (migración Alembic
`b3c4d5e6f7a9`):

- `id`, `name` (estable, snapshot), `label` (visible)
- `type` (`NONE` | `DISCOUNT` | `SURCHARGE`)
- `value` (float — porcentaje o monto fijo según `is_percentage`)
- `is_percentage` (bool)
- `applies_to_installments` (bool)
- `is_active`, `sort_order`, `created_at`, `updated_at`

4 métodos seeded (`scripts/seeders/payment_methods.py`):
`EFECTIVO`, `TRANSFERENCIA BANCARIA`, `TARJETA DE DÉBITO`, `TARJETA DE
CRÉDITO` (los 3 primeros con `type=NONE`; el último con
`type=SURCHARGE`, `value=9`, `is_percentage=True`,
`applies_to_installments=True`).

Migración de los 6 nombres legacy en inglés (`CASH`, `TRANSFER`,
`CREDIT_CARD`, `DEBIT_CARD`, `CHECK`, `MIXED`) preservando id y
borrando los no usados.

CRUD completo en `/admin/configuration/payment-methods` con
`PaymentMethodsTable` + `PaymentMethodForm`.

### 2. Regla del recargo de tarjeta (lineal por cuota)

Para una tarjeta con `value=9` (porcentaje por cuota) y N cuotas,
el recargo total es `N × value%` aplicado al base, y el total con
recargo se divide **uniformemente** en N cuotas iguales:

```
total = base × (1 + N × value/100)
cuota = total / N  (todas iguales)
```

…donde `base` es el subtotal + traslado − descuento manual. La
columna "Interés" de la tabla de detalle muestra el % por cuota
(`value`, no `N × value`); el agregado `N × value%` aparece en la
línea "Recargo (X%)" del PDF.

Ejemplo concreto (base = 900.000, value = 9, N = 3):

- recargo = 3 × 9% = 27%
- total = 900.000 × 1.27 = **1.143.000**
- cada cuota = 1.143.000 / 3 = **381.000** (3 filas idénticas)

La tabla de detalle se ve así:

| Cuota # | Interés | Monto     |
|---------|---------|-----------|
| 1       | 9%      | 381.000   |
| 2       | 9%      | 381.000   |
| 3       | 9%      | 381.000   |

Se eligió esta fórmula (recargo **lineal** sobre el total, dividido
uniforme) porque refleja cómo el banco realmente cobra: el interés
se aplica N veces sobre el total y el cliente paga N cuotas iguales.
El cliente ve el impacto total (27%) en la línea "Recargo" y el
detalle por cuota en la tabla 3-columnas.

### 3. Mismo cálculo en 4 lugares

Para que el form, el PDF preview, el PDF legacy y la OT persistida
muestren el mismo `total`, el mismo `recargo` y la misma tabla de
cuotas, los 4 lugares implementan la misma fórmula:

| Lugar | Función | Archivo |
|---|---|---|
| Hook del form (ARS+USD, live) | `applyPaymentMethodToTotals` + `computeInstallmentDetail` | `afamar-frontend/src/hooks/useBudgetCalculations.ts` |
| PDF preview del form (ARS+USD) | bloque inline | `afamar-frontend/src/utils/pdf/buildPdfData.ts` |
| Recalc server-side de OT | bloque inline | `afamar-backend/app/services/work_order.py` (`_recalculate_totals_from_items`) |
| PDF legacy (xhtml2pdf) | `_resolve_catalogue_adjustment` | `afamar-backend/app/services/pdf_html.py` |

Tocar uno implica tocar los otros. Los tests los alinean:
`useBudgetCalculations.test.tsx`, `buildPdfData.test.ts`,
`test_work_order_recalc.py`, `test_pdf_catalogue_adjustment.py`.

### 4. Snapshot en DB del detalle de cuotas

Migración `d5e6f7a8b9c0` agrega `installment_detail_ars` y
`installment_detail_usd` (TEXT, JSON-encoded) a `budgets` y
`work_orders`. El recalc del WO los serializa con `json.dumps` antes
de persistir. El frontend los envía en `buildPayload` (también para
budgets, que no pasan por el recalc).

Por qué: el preview del list page (donde el form hook no corre)
necesita poder renderizar la tabla de cuotas sin re-derivar del
catálogo vivo (que puede haber cambiado su `value`).

### 5. `usePdfPreviewController` recibe el catálogo

Antes: el controller llamaba a `buildPdfData` sin `paymentMethods`,
así que la regla del recargo no se aplicaba y la tabla salía vacía.
Ahora acepta `paymentMethods?: PaymentMethod[]` y los propaga. Los
list pages los cargan con la misma TanStack Query key del form
(`PAYMENT_METHODS_KEY`) — una sola fetch compartida.

## Consecuencias

**Positivas:**

- Configurar la regla de tarjeta es un UPDATE de una fila del
  catálogo (`/admin/configuration/payment-methods`). No requiere
  redeploy ni tocar el form.
- El PDF legacy (descarga + email) ahora muestra el recargo y la
  tabla de cuotas — el cliente ve exactamente lo mismo que el form.
- El catálogo sobrevive renames de la fila (el `name` es snapshot
  estable en `budgets.payment_method` y `work_orders.payment_method`).

**Trade-offs:**

- 4 implementaciones del mismo cálculo = drift potencial. Mitigado
  con tests cruzados en cada lugar. **Riesgo:** si se cambia la
  fórmula hay que tocar los 4 + actualizar los 4 tests.
- Persistir el detalle de cuotas en la DB ocupa ~150-200 bytes por
  fila (3-12 rows JSON). Aceptable; el form ya tiene que
  serializarlo igual para el payload.
- El catálogo es **global** (no por cliente/proveedor). Si en el
  futuro se necesitan reglas distintas por contexto (ej. cliente
  mayorista con descuento), hay que pasar a una tabla
  `client_payment_methods` (m:n). No es una urgencia.

## Implementación

- Migraciones: `b3c4d5e6f7a9` (catalog), `d5e6f7a8b9c0` (snapshot)
- Backend: `app/api/routers/payment_methods.py`, `app/services/payment_method.py`,
  `app/repositories/payment_method.py`, `app/schemas/payment_method.py`,
  `scripts/seeders/payment_methods.py`.
- Frontend: `src/types/paymentMethod.ts`,
  `src/api/resources/paymentMethods.ts`,
  `src/components/configuration/PaymentMethods*/`,
  `src/pages/configuration/PaymentMethods/`.
- Hooks: `useBudgetCalculations`, `useFormReferences`,
  `usePdfPreviewController`.

## Alternativas consideradas

- **Mantener la regla hardcodeada en el form con un toggle
  configurable por presupuesto.** Descartado: no escala, requiere
  editar el form cada vez que cambia la regla del banco.
- **Calcular el recargo en el backend y devolverlo al frontend como
  parte del response.** Descartado: rompe la regla "el form es la
  fuente de verdad" y agrega latencia (un round-trip extra) para
  algo que el form ya puede calcular.
- **Una sola implementación compartida (librería Python + TS).**
  Descartado: el costo de mantener una lib sincronizada es mayor
  que el de mantener 4 implementaciones testeadas.

## Updates post-commit

Pequeños ajustes y fixes que se aplican sobre la decisión original
sin cambiar la arquitectura. Se documentan acá para mantener la ADR
como single source of truth.

### 2026-08-24 — Schema fix: exponer `payment_method_id` en GETs/PUTs

`BudgetBase` / `WorkOrderBase` (de donde heredan los `*Response`)
originalmente solo exponían `payment_method` (string legacy) e
`installments`, no `payment_method_id` (FK al catálogo). Eso
bloqueaba la pre-selección del dropdown en el form al editar un
presupuesto/OT existente (el `<select>` del form usa `value={pm.id}`
y matchea contra la FK). Además `BudgetUpdate` / `WorkOrderUpdate`
no aceptaban el campo en PUTs, así que el bulk update de
SQLAlchemy no tocaba la columna.

**Fix:** agregar `payment_method_id: int | None = None` a
`BudgetBase`, `WorkOrderBase`, `BudgetUpdate`, `WorkOrderUpdate`.
La columna ya existía en la DB desde la migración `b3c4d5e6f7a9`,
no requirió nueva migración.

### 2026-08-26 — WorkOrderService.update: `TypeError` en PATCH con line items

`_recalculate_totals_from_items` está definida como
`def _recalculate_totals_from_items(db: Session, data: dict)`. En
`WorkOrderService.create` se llama bien
(`_recalculate_totals_from_items(self.repo.db, data)`), pero en
`WorkOrderService.update` se llamaba mal:
`_recalculate_totals_from_items(merged)`. `merged` se pasaba como
`db` y `data` quedaba faltando → `TypeError: missing 1 required
positional argument: 'data'` → 500 al cliente.

El path "convertir presupuesto → OT → abrir en MEDICION → editar
m² de un material → Guardar" (el más común del día a día) reventaba
siempre en el PATCH. El bug se coló porque el helper se invoca
solo cuando el PATCH trae `materials_data` / `fabrication_details` /
`pools_data` / `payment_method` / `installments` / etc., y
probablemente se probó solo con PUTs que no tocaban líneas.

**Fix:** 1 línea en `app/services/work_order.py:782`:
`_recalculate_totals_from_items(self.repo.db, merged)`. Cubierto
por `tests/test_work_order_update.py::test_update_with_materials_data_does_not_500`.

### 2026-08-26 — installment_detail_ars/usd no persistido en PATCH parcial

Mismo archivo, bug #2 encontrado mientras escribía el test del
fix de arriba. En `WorkOrderService.update`, después de
`_recalculate_totals_from_items(self.repo.db, merged)`, el "mirror
step" solo copiaba 8 keys de vuelta a `data`:
`subtotal, subtotal_usd, total, total_usd, balance_due,
balance_due_usd, deposit_received, deposit_usd`. Pero el helper
también recalcula `installment_detail_ars/usd` — esas 2 keys
**no** se copiaban, así que el `repo.update` no las persistía.

Consecuencia: un PATCH parcial (ej. solo `materials_data` con
medición editada en una OT con tarjeta 3 cuotas) borraba la tabla
3-columnas de cuotas del snapshot, aunque el cálculo en memoria
estuviera bien. La tabla solo reaparecía en el siguiente PATCH
completo que volviera a mandar las keys.

**Fix:** agregar `installment_detail_ars, installment_detail_usd`
a la lista del mirror step (`work_order.py:785-794`). El
`create` ya estaba bien (data y merged son el mismo dict en ese
path). Cubierto por
`test_work_order_update.py::test_update_with_materials_data_and_payment_method`.

### 2026-08-26 — MaterialCategoryRepository: IntegrityError → 500 en vez de 409

`MaterialCategoryRepository.create` instanciaba `MaterialCategory`
y llamaba a `save` sin capturar `IntegrityError`. La unique
constraint en `name` (columna `unique=True, nullable=False`) hace
que un POST con un nombre duplicado levante `IntegrityError`, que
subía sin handler al global de FastAPI y se devolvía como **500
Internal Server Error** en vez del **409 Conflict** esperado.

El bug se reproducía cada vez que la suite E2E corría más de una
vez en la misma DB: el `UNIQUE` random del test chocaba con un
leftover de la corrida anterior y el POST tiraba 500.

**Fix:** `try/except IntegrityError` en
`app/repositories/material.py:22-33`, con `db.rollback()` y
`raise ConflictError(f"Category '{name}' already exists")`. Mismo
patrón se aplicaría a cualquier otra columna unique que
actualmente no capture el error.

### 2026-08-26 — `global-setup.ts`: nombres de recursos incorrectos, 404 silencioso

El `TABLES_TO_CLEAR` del global-setup tenía `'material-categories'`,
`'material-colors'`, `'material-thicknesses'` (singular, flat).
Pero el backend los sirve como `materials/categories`,
`materials/colors`, `materials/thicknesses` (nested plural) en
`app/api/routers/materials.py`. El GET contra la URL plana tira
**404 Not Found**, que el helper `truncateAll` loguea con
`console.warn` y sigue (best-effort cleanup) → las tablas
categoría/color/espesor NUNCA se borraban entre suites.

Consecuencia: en la suite actual se acumulaban ~40 categorías
"Create category e2e-cat-xxxx" de corridas previas. Cuando el
test 2 (edits) intentaba crear la suya con el mismo sufijo
random (sufijo colisionaba con uno previo), el POST tiraba 500
por el bug de IntegrityError de arriba. Los dos bugs se
encadenaron.

**Fix:** renombrar las 3 entradas en `e2e/global-setup.ts` a
`'materials/categories'`, `'materials/colors'`,
`'materials/thicknesses'`. Comentario explicando el motivo
para que no se revierta sin querer.

### 2026-08-26 — Tests E2E de categorías: case-sensitivity vs `CapitalizeNameMixin`

`CapitalizeNameMixin` (en `app/schemas/material.py`) normaliza
`name` con `v.strip().capitalize()`. Esto baja todas las letras
a minúscula menos la primera — comportamiento intencional y
consistente con los seeds canónicos ("Cuarzos", "Granitos",
"Mármoles", "Sinterizados", "General").

Los tests E2E de `05b-categories.spec.ts` asumían case preservado
("Edit Category E2E-CAT-xxxx" se guardaba como "Edit category
e2e-cat-xxxx"). Tres asserts fallaban:
- `c.name === name` en el GET post-POST
- `nameInput.toHaveValue(originalName)` al abrir el modal de edit
- `text.includes(originalName)` en el loop de búsqueda de la fila

**Fix:** cambiar los `name` a formato ya-title-case
(`"Create category ${UNIQUE.toLowerCase()}"`) para que sobrevivan
el `capitalize()`. Cambio quirúrgico en los 3 tests. **No se
tocó el comportamiento del backend** — la app real sigue
capitalizando las categorías como antes.
