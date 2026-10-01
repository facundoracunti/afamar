# ADR 0009 — Modularización de archivos monolíticos (orchestrator thin + módulos enfocados)

**Estado:** Aceptado · **Fecha:** 2026-10-01

## Contexto

Tres archivos del sistema pasaron la barrera de los 400 LOC y estaban
acercándose a los 500+ con bloques de lógica de dominios mezclados
(CRUD + cálculo comercial + conversión + cash booking + snapshots en el
mismo archivo):

| Archivo | LOC |
|---|---|
| `afamar-backend/app/services/work_order.py` | **1262** |
| `afamar-frontend/src/hooks/useBudgetCalculations.ts` | **417** |
| `afamar-frontend/src/hooks/entityFormSerialization.ts` | **472** |

(`pdf_html.py` 1179 LOC quedó fuera por costo/beneficio — cada builder
mide 200-350 LOC razonablemente aislados; queda como siguiente target.)

Síntomas: tests lentos de localizar (un cambio en la lógica de cash
booking tocaba el mismo archivo que el CRUD), merge conflicts frecuentes
cuando dos features tocaban el mismo módulo, y unit tests forzados a
mockear dependencias no relacionadas (un test de `update()` tenía que
parsear `materials_data` JSON solo para llegar a la lógica que quería).

## Decisión

**Ningún archivo nuevo de los features `payments` / `work_order` /
`entityForm` debe pasar de 400 LOC.** Cuando uno crece, se parte en un
**orchestrator fino** (`__init__.py` / `X.tsx` con solo queries/JSX +
delegación) + módulos enfocados por dominio. Patrón aplicado:

### Backend (package)

```
app/services/work_order/
├── __init__.py     # WorkOrderService class (orquestador)
├── helpers.py      # utilidades pequeñas (sketch mirror, deposit nativo, ...)
├── cash.py         # cash-movement booking con idempotencia
├── recalc.py       # recompute server-side de totales + installment_detail
├── snapshots.py    # bake de measurement snapshots en pieces
└── conversion.py   # payload building para budget→WO
```

- `__init__.py` mantiene `class WorkOrderService` con queries
  (`get_all`/`get_by_id`/etc.) + mutaciones que **delegan** a helpers.
- Cada módulo de foco expone funciones públicas con docstring y un
  único concern.
- **`__init__.py` re-exporta los nombres legacy con prefijo `_`** (ej.
  `_create_cash_movement_on_deposit = create_cash_movement_on_deposit`)
  para que los tests viejos (`test_cash_movement_usd`,
  `test_work_order_cash`, etc.) sigan importando sin cambios.

### Frontend

```
src/hooks/
├── useBudgetCalculations.ts        # orchestrator (effect + derivaciones)
├── calculations/paymentMethod.ts   # funciones puras (sin React)
├── entityFormSerialization.ts      # orchestrator (buildPayload + mapApiToForm)
└── entityForm/
    ├── sketch.ts                   # wire format de croquis
    └── piecesHydration.ts          # bake de snapshot presupuestado
```

- **`hooks/calculations/`** guarda funciones puras de cálculo (sin React
  imports) — el PDF builder (`utils/pdf/buildPdfData.ts`) y los tests
  unitarios las reusan sin coupling.
- **`hooks/entityForm/`** guarda los helpers específicos del form
  (sketch, piecesHydration). El orchestrator `entityFormSerialization.ts`
  re-exporta el API público para mantener compat.
- Los helpers `applyPaymentMethodToTotals`, `computeInstallmentDetail`,
  `resolvePaymentMethod`, `linearInstallmentRatio` también se
  re-exportan desde `useBudgetCalculations.ts` (los tests viejos los
  importaban desde ahí).

### Reglas estrictas

1. **Sin cambios de comportamiento / tests / strings** — el refactor es
   puramente estructural. Los mismos tests pasan en los mismos counts
   (verificado: `pytest 164/164`, `vitest 506/506` antes y después).
2. **Compat backward** — nombres con prefijo `_` (legacy module-level
   functions) se re-exportan desde el orchestrator del package para
   no romper imports viejos.
3. **Funciones puras → `hooks/calculations/`** para que PDF builders +
   hooks las reusen sin coupling.
4. **Replicar el patrón de `buildPdfData.ts`** (`*.totals.ts` /
   `*.helpers.ts` / `*.alternatives.ts` / `*.types.ts`) cuando se ataque
   el próximo monolito (`pdf_html.py` 1179 LOC).
5. **El orchestrator nunca debe contener lógica pesada** — solo queries,
   validaciones de input, y llamadas a los módulos de foco.

## Consecuencias

### Positivas

- **Cohesión alta**: cada módulo tiene un solo concern. Un test de
  `create_cash_movement_on_deposit` no necesita parsear `materials_data`
  JSON.
- **Merge-friendly**: dos features tocando `work_order.py` (ej. cash
  booking + reverse payment) ya no colisionan en el mismo archivo.
- **Onboarding**: un dev nuevo abre `__init__.py` (400 LOC) y ve la
  orquestación; los helpers detallados viven en módulos chicos con
  docstrings de un solo concern.
- **Test isolation**: los tests de `recalc.py` no necesitan el setup de
  `BudgetService` para correr; los tests de `cash.py` no necesitan el
  recalc.

### Negativas / costos

- **Más archivos en el árbol** (6 archivos en `work_order/` vs 1 antes).
  Mitigado con docstrings de módulo que documentan la responsabilidad
  única.
- **Imports cross-module**: `recalc.py` importa `helpers.py` para
  `FAB_M2_CONCEPTS`; `snapshots.py` también. Aceptable — son
  dependencies explícitas.
- **Indirección**: el lector tiene que seguir `__init__.py → recalc.py`
  para entender el flujo. Mitigado con el docstring de `__init__.py`
  que mapea cada método público al módulo que implementa.

## Estado de aplicación

| Archivo | Antes | Después |
|---|---|---|
| `app/services/work_order.py` | 1262 LOC | 6 módulos (1377 LOC totales; +115 por docstrings + cross-module imports) |
| `src/hooks/useBudgetCalculations.ts` | 417 LOC | 273 LOC + `hooks/calculations/paymentMethod.ts` (162 LOC) |
| `src/hooks/entityFormSerialization.ts` | 472 LOC | 248 LOC + `hooks/entityForm/sketch.ts` (152) + `hooks/entityForm/piecesHydration.ts` (144) |
| `src/features/payments/PaymentModal.tsx` (sesión previa) | 745 LOC | orchestrator + 7 subcomponentes |
| `src/features/payments/hooks/usePaymentAction.ts` (sesión previa) | 380 LOC | solo-hook + utils/helpers |

## Próximo target (cuando haya bandwidth)

- **`app/services/pdf_html.py`** (1179 LOC): split a `app/services/pdf/`
  con `budget_data.py` / `work_order_data.py` / `comparison.py` /
  `catalogue.py` / `sketch.py`. Patrón: un módulo por builder público
  (`build_budget_pdf_data` / `build_work_order_pdf_data` /
  `build_workshop_pdf_data`), cada uno con sus helpers internos
  privados (`_build_materials_pdf`, `_build_measurement_comparison`,
  etc.).
- **`src/components/sketch/hooks/useSketchState.ts`** (463 LOC) —
  candidato si crece más; ya tiene sub-hooks (`useSketchElements`,
  etc.) pero están en el mismo archivo.
- **`src/utils/whatsapp.ts`** (347 LOC) — utilidades puras + helpers
  de URL; candidato si crece.

## Verificación

- `pytest 164/164` ✓
- `vitest 506/506` ✓
- `tsc --noEmit` 0 errores ✓
- ESLint sin errores nuevos introducidos por el refactor ✓
