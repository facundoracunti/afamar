# Refactor Plan — Code Quality 2026

> **Estado:** Rama `development`. Fases 1–6.11 completadas (calidad de código, tests, performance, CSS, dead code, config).
> Refactor de calidad cerrado. Nuevas features se trackingan en AGENTS.md.

---

## Fuera de scope (evaluados, no requeridos)

Items que se evaluaron durante las fases 6.x y se descartaron con justificación:

- **`paginate()` con `SELECT COUNT(*)`** (6.2) — aceptable para el volumen actual; cache del count no aporta.
- **`noUncheckedIndexedAccess` en tsconfig** (6.3) — descartado, genera ~200 falsos positivos con CSS modules.
- **Test de submit flow en BudgetFormPage** (6.8) — fuera de scope; código estable, alto costo vs valor.
- **Configurar `@testing-library/user-event`** (6.8) — `fireEvent` cubre los flujos actuales.

---

## Pendiente menor (backlog)

- Evaluar migrar `pdf_html.py` (legacy xhtml2pdf) a usar el PDF generado por frontend para email/download. Hoy coexisten dos paths: `pdf_html.py` para `/api/v1/budgets/{id}/pdf` + email background, y `@react-pdf/renderer` para preview en el form. Unificarlos eliminaría ~555 LOC de backend.
- Evaluar drop completo de tabla `budget_adicionales` (read-only hoy) con migración one-time que backfille `additional_works_data` desde las filas legacy.
