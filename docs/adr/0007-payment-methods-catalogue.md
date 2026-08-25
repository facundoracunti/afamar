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
