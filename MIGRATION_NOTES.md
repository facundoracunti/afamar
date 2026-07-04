# Migración Spanish → English en Frontend

> Documentación de lo analizado antes de continuar con la migración.

---

## Estado actual: campos que YA coinciden con el backend (NO cambiar)

Los siguientes campos ya están en snake_case y coinciden exactamente con los schemas/models del backend:

### EntityFormState (types/form.ts)

| Campo Frontend | Campo Backend | Estado |
|---|---|---|
| `client_name` | `client_name` | ✅ OK |
| `client_phone` | `client_phone` | ✅ OK |
| `client_address` | `client_address` | ✅ OK |
| `client_email` | `client_email` | ✅ OK |
| `number` | `number` | ✅ OK |
| `date` | `date` | ✅ OK |
| `status` | `status` | ✅ OK |
| `material` | `material` | ✅ OK |
| `material_price_m2` | `material_price_m2` | ✅ OK |
| `color` | `color` | ✅ OK |
| `thickness` | `thickness` | ✅ OK |
| `finish` | `finish` | ✅ OK |
| `bacha` | `bacha` | ✅ OK (palabra española pero coincide con backend) |
| `anafe` | `anafe` | ✅ OK (palabra española pero coincide con backend) |
| `pool_id` | `pool_id` | ✅ OK |
| `pool_price` | `pool_price` | ✅ OK |
| `pool_currency` | `pool_currency` | ✅ OK |
| `pool_image` | `pool_image` | ✅ OK |
| `currency` | `currency` | ✅ OK |
| `usd_rate` | `usd_rate` | ✅ OK |
| `subtotal` | `subtotal` | ✅ OK |
| `transport` | `transport` | ✅ OK |
| `total` | `total` | ✅ OK |
| `subtotal_usd` | `subtotal_usd` | ✅ OK |
| `transport_usd` | `transport_usd` | ✅ OK |
| `total_usd` | `total_usd` | ✅ OK |
| `deposit_received` | `deposit_received` | ✅ OK |
| `deposit_currency` | `deposit_currency` | ✅ OK |
| `deposit_usd` | `deposit_usd` | ✅ OK |
| `balance_due` | `balance_due` | ✅ OK |
| `balance_due_usd` | `balance_due_usd` | ✅ OK |
| `balance_paid` | `balance_paid` | ✅ OK |
| `balance_paid_at` | `balance_paid_at` | ✅ OK |
| `payment_method` | `payment_method` | ✅ OK |
| `installments` | `installments` | ✅ OK |
| `discount_percentage` | `discount_percentage` | ✅ OK |
| `discount_fixed_amount` | `discount_fixed_amount` | ✅ OK |
| `delivery_date` | `delivery_date` | ✅ OK |
| `digital_signature` | `digital_signature` | ✅ OK |
| `signed_at` | `signed_at` | ✅ OK |
| `notes` | `notes` | ✅ OK |
| `design_observations` | `design_observations` | ✅ OK |
| `important_observations` | `important_observations` | ✅ OK |
| `fabrication_details` | `fabrication_details` | ✅ OK (JSON text column) |
| `materials_data` | `materials_data` | ✅ OK (JSON text column) |
| `pools_data` | `pools_data` | ✅ OK (JSON text column) |
| `sketch_elements` | `sketch_elements` | ✅ OK (JSON text column) |

### MaterialInForm (types/budget.ts)

| Campo Frontend | Campo Backend | Estado |
|---|---|---|
| `price_m2` | N/A (anidado en JSON) | ✅ OK snake_case |
| `price_m2_usd` | N/A (anidado en JSON) | ✅ OK snake_case |
| `m2_used` | N/A (anidado en JSON) | ✅ OK snake_case |
| `m2_budgeted` | N/A (anidado en JSON) | ✅ OK snake_case |
| `is_alternative` | N/A (anidado en JSON) | ✅ OK snake_case |

### PoolInForm (types/budget.ts)

| Campo Frontend | Campo Backend | Estado |
|---|---|---|
| `pool_id` | N/A (anidado en JSON) | ✅ OK snake_case |

### Client, Material, Pool types

Todos ya están en inglés: `types/client.ts`, `types/material.ts`, `types/poolStock.ts`.

---

## Campos REALMENTE en español (solo anidados en fabrication_details JSON)

El backend guarda `fabrication_details` como un **JSON string en una columna TEXT**. El backend NO parsea los campos individuales del JSON — solo los almacena y los devuelve como string. Por eso los campos internos pueden tener cualquier nombre sin romper el backend.

Estos son los campos que SÍ están en español dentro del JSON:

| Campo actual (Spanish) | Campo nuevo (English) | Archivos afectados |
|---|---|---|
| `concepto` | `concept` | budget.ts, FabricationTable.tsx, BudgetPanel.tsx, QuoteOptionsGrid.tsx, useFormDetails.ts, useFormMaterials.ts, useBudgetCalculations.ts, BudgetFormPage.tsx |
| `detalle` | `detail` | budget.ts, FabricationTable.tsx, BudgetPanel.tsx, useFormDetails.ts, BudgetFormPage.tsx |
| `concepto_personalizado` | `custom_concept` | budget.ts, useFormDetails.ts |
| `largo` | `length` | budget.ts, FabricationTable.tsx, BudgetPanel.tsx, useFormDetails.ts, CalculatorPage.tsx (propia interfaz) |
| `ancho` | `width` | budget.ts, FabricationTable.tsx, useFormDetails.ts, useCroquisState.ts (legacy fallback), CalculatorPage.tsx (propia interfaz) |
| `mano_de_obra` | `labor` | budget.ts, FabricationTable.tsx, useFormDetails.ts |
| `moneda` | `currency` | budget.ts, FabricationTable.tsx, BudgetPanel.tsx, useFormDetails.ts, useFormMaterials.ts, useBudgetCalculations.ts, BudgetFormPage.tsx |
| `cantidad` | `quantity` | budget.ts, FabricationTable.tsx, BudgetPanel.tsx, QuoteOptionsGrid.tsx, useFormDetails.ts, useBudgetCalculations.ts, BudgetFormPage.tsx, WorkOrderFormPage.tsx, BudgetFormAdicionales.tsx, CalculatorPage.tsx (propia interfaz) |
| `precio` | `price` | budget.ts, FabricationTable.tsx, BudgetPanel.tsx, useFormDetails.ts, useBudgetCalculations.ts, BudgetFormPage.tsx, WorkOrderFormPage.tsx |

### Campos que NO cambiar (coinciden con backend o son propios)

- `bacha` — español pero coincide con backend `bacha` column
- `anafe` — español pero coincide con backend `anafe` column
- `material_precio_m2` — snake_case, coincide con backend `material_price_m2`
- `cantidad` en `CalculatorPage.tsx` — interfaz propia `Pieza`, no relacionada con fabrication_details
- `largo`/`ancho` en `CalculatorPage.tsx` — interfaz propia `Pieza`, no relacionada con fabrication_details
- `ancho`/`alto` en `useCroquisState.ts` — fallback legacy para datos viejos de croquis, no migrar

---

## Orden de cambios recomendado

1. **Actualizar `types/budget.ts`** — renombrar campos en `FabricationDetail` (los 9 campos Spanish arriba)
2. **Actualizar `entityFormHelpers.ts`** — `buildPayload` y `mapApiToForm` mapean los campos del JSON internamente (el payload al backend sigue enviando los mismos nombres de campo en el JSON string)
3. **Actualizar hooks** — `useFormDetails.ts`, `useFormMaterials.ts`, `useBudgetCalculations.ts`
4. **Actualizar componentes** — `FabricationTable.tsx`, `BudgetPanel.tsx`, `QuoteOptionsGrid.tsx`
5. **Actualizar pages** — `BudgetFormPage.tsx`, `WorkOrderFormPage.tsx`, `WorkOrderFormItemsGrid.tsx`
6. **Descomponer `useEntityForm`** en composables más pequeños
7. **Eliminar `entityFormHelpers.ts`** distribuyendo su lógica en los composables

### Nota sobre buildPayload

`fabrication_details` se envía al backend como `JSON.stringify(details)`. Los campos internos del JSON son **solo del frontend** — el backend los almacena como string opaco. Esto significa que podemos renombrar los campos internos sin cambiar nada en el backend.

---

## Archivos que quedan pendientes de revisar

- `useFormDetails.ts` — lógica de cálculo de fabrication details (referencia `material_precio_m2`, `largo`, `ancho`, `mano_de_obra`)
- `useFormMaterials.ts` — referencia `concepto`, `moneda`, `precio`
- `useBudgetCalculations.ts` — referencia `moneda`, `precio`, `cantidad`, `price_m2`, `price_m2_usd`, `is_alternative`
- `FabricationTable.tsx` — todos los campos Spanish en UI
- `BudgetPanel.tsx` — `concepto`, `detalle`, `largo`, `cantidad`, `moneda`, `precio`
- `QuoteOptionsGrid.tsx` — `concepto`, `cantidad`
- `BudgetFormAdicionales.tsx` — `marca`, `modelo` (mismatch con tipo Pool que usa `brand`/`model`)
