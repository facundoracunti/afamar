# PLAN.md — Tareas pendientes

> **Estado:** rama `development`. **65 archivos modificados/agregados sin versionar** (50 `M` + 15 `??`) — incluye Fase 7 (catálogo `payment_methods` con regla de **interés incremental por cuota**) + 4 fixes de UX de esta sesión. Las features de presupuestos/OTs anteriores (Fases 1-6.11) también siguen sin commitear. Este archivo lista **solo lo que falta** — no el trabajo ya hecho.
>
> **Última actualización:** 2026-08-24.

---

## Bloqueante

### B1. Commit + push del feature de Payment Methods + fixes de UX
**Por qué:** 65 archivos modificados/agregados sin versionar. El usuario lo hace manualmente (regla de la casa: no commit/push desde el assistant — `git add .` + mensaje corto + `git push`).

**Alcance de esta tanda:**
- **Fase 7 (Payment Methods):** migración `b3c4d5e6f7a9` (catalog con 4 cols) + `d5e6f7a8b9c0` (installment_detail_ars/usd en `budgets`/`work_orders`), modelos, schemas, repository, service, router dedicado en `/api/v1/payment-methods`, seeder idempotente (4 métodos en español), `_resolve_catalogue_adjustment` en `pdf_html.py`, recalc en `_recalculate_totals_from_items`, hook `useBudgetCalculations` con `incrementalInterestRatio` + `computeInstallmentDetail`, `BudgetPaymentSection` con tabla 3-columnas, `DocumentPdf` con la misma tabla, `usePdfPreviewController` recibiendo el catálogo, `buildPayload` + `mapApiToForm` serializando `installment_detail_*`, `PaymentMethodsTable` + `PaymentMethodForm` + `PaymentMethods` page, `types/paymentMethod.ts`, `api/resources/paymentMethods.ts`. Tests: `test_work_order_recalc.py` + `test_pdf_catalogue_adjustment.py` (backend) + `useBudgetCalculations.test.tsx` + `buildPdfData.test.ts` (frontend).
- **Fixes UX de esta sesión (sobre Fase 7):**
  - `BudgetLineItems` (`DetailRow`): la conversión en USD ahora muestra el equivalente real en pesos (antes mostraba el mismo USD con `$`, un bug de naming del parámetro `arsTotal` que en realidad guardaba el valor nativo). Renombrado `arsTotal` → `displayValue`, agregado `arsEquivalent`.
  - `BudgetLineItems` + `BudgetPanel.module.css`: la línea "≈" en ítems USD es blanca (no verde) para no competir con el pill verde del valor nativo; ARS sigue verde.
  - `BudgetLineItems`: la conversión a USD ahora muestra 2 decimales (`$ 152.760,00` en lugar de `$ 152.760`) para matchear con la conversión de ítems ARS.
  - `DocumentPdf`: el renglón "Recargo (X%)" del PDF ahora dice "Interés:" sin porcentaje (el porcentaje correcto por cuota está en la tabla 3-columnas de abajo).
  - `DocumentPdf`: la línea "Forma de pago: TARJETA DE CRÉDITO (3 cuotas con 18% de interés)" ahora dice "(3 cuotas con 9% de interés por cuota)" usando `catalogue_installment_detail[0].interes` (la base por cuota), no el promedio.
  - **Backend schema fix:** `BudgetBase`/`WorkOrderBase` ahora exponen `payment_method_id` en GETs (antes solo `payment_method` legacy, así que el select del form no podía pre-seleccionar el método al editar un presupuesto existente). `BudgetUpdate`/`WorkOrderUpdate` también lo aceptan en PUTs.

**Acción:** Usuario corre `git add .` + mensaje corto + `git push` cuando quiera. **Recordatorio de la regla:** `git add .` simple por default; stage selectivo solo si `git status` muestra basura que no debería commitearse.

---

## Pendiente (no bloqueante para el feature)

### P1. Reindexar codebase-memory
**Estado:** el MCP `codebase-memory` sigue caído (el CLI `mavis` local tira `Cannot find module '…\MiniMax Code\resources\resources\daemon\cli.js'`). El artefacto `.codebase-memory/graph.db.zst` tiene 3820 nodos / 13518 aristas del commit `a06c1569` (Fase 6.11), o sea **muy desactualizado** — no incluye ni la Fase 7 ni los fixes de UX de esta sesión.

**Por qué importa:** las queries de impacto (`callers of useBudgetCalculations`, `buildPdfData`, `_recalculate_totals_from_items`, etc.) en el grafo viejo devuelven resultados desfasados.

**Cuándo se puede hacer:** cuando el MCP vuelva a estar conectado o se arregle el CLI. **Comando** (ver `AGENTS.md` §"Índice del conocimiento"):
```
index_repository(
  repo_path=D:\projects\PERSONAL\afamar,
  name=afamar,
  mode=full,
  persistence=true
)
```
Después `git add -f .codebase-memory/graph.db.zst` para commitear el índice.

### P2. ADR de arquitectura
**Estado:** el `manage_adr` del MCP tampoco está accesible. **Pero** la ADR de Fase 7 ya está commiteada en `docs/adr/0007-payment-methods-catalogue.md` y refleja bien la decisión de arquitectura (catálogo manda, regla incremental, 4 implementaciones sincronizadas, snapshot en DB). Los fixes de UX de esta sesión no cambian la arquitectura — son cosméticos / claridad de labels.

**No-op para esta ADR.** Si en el futuro aparece un nuevo ADR-worthy (ej: D1 se cierra, se elige una nueva estrategia), crear `0008-…`.

### P3. Tests E2E del flujo de Payment Methods
**Por qué:** los E2E existentes (`afamar-frontend/e2e/configuration/`) cubren la página de Datos de AFAMAR pero no la nueva sub-página de Métodos de Pago. Tampoco hay un E2E del flujo "elegir Tarjeta de crédito + 3 cuotas en el form de presupuesto y verificar el recargo/tabla en el PDF preview".

**Costo:** bajo si se reutiliza el patrón de `e2e/configuration/`. ~30-45 min.

**Prioridad:** media. Sirve para detectar regresiones del recargo o del CRUD del catálogo.

### P4. Script de backfill para presupuestos/OTs viejos
**Por qué:** los presupuestos/OTs creados antes de la migración `d5e6f7a8b9c0` (installment_detail) tienen `installment_detail_ars` / `installment_detail_usd = NULL` en la DB. El PDF los recalcula on-read con el catálogo así que no es bloqueante para la UI, pero si querés un reporte histórico que dependa del snapshot, hay que backfillear.

**Cómo:** un script `scripts/backfill_installment_details.py` que recorra los rows con `payment_method='TARJETA DE CRÉDITO'` (o cualquier SURCHARGE con installments > 1), llame a `_recalculate_totals_from_items` (o un helper equivalente) y haga UPDATE.

**Prioridad:** baja. Solo si aparece un reporte que lo necesite.

---

## Deuda técnica conocida (no la introducimos nosotros)

### D1. Asimetría de recalc entre Budget y WorkOrder
`WorkOrderService.create/update` llama a `_recalculate_totals_from_items` para derivar `subtotal`/`total`/`balance_due` desde los items (safety net para paths que bypasean el form). `BudgetService` no — confía en los valores que vienen del frontend.

**Por qué existe:** el `Budget` históricamente se calculaba 100% en el frontend y la API solo persistía. La OT se migró al recalc server-side como safety net porque hay paths de creación (conversión budget→OT, importadores) que llegan sin `total`.

**Impacto:** si un budget se importa con items pero sin totales (ej. importador legacy), queda con $0 hasta que el form lo recargue. Raro en la práctica.

**Fix:** extraer `_recalculate_totals_from_items` a un helper reutilizable + llamarlo desde `BudgetService.create/update`. ~1 hora + tests.

**Prioridad:** baja.

---

## Cómo usar este archivo

- Cada item tiene un **estado** (bloqueante / pendiente / deuda) y un **comando o path** para resolverlo.
- Cuando un item se cierra, **borrar el bloque** correspondiente (no marcar como done — el historial queda en `git log`).
- Si aparece un nuevo item, agregarlo al bloque que corresponda.
