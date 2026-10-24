"""add Budget.options_data — multi-option (multi-escenario) budgets

Fase 1 of the "Opciones / Escenarios Independientes" migration
(2026-10-01). **Additive only — no data migration.**

Context: until now a budget had ONE implicit configuration (`pieces_data`,
where each piece carries its own `alternativeMaterials`). Customers now
want several INDEPENDENT quote options side by side (Opción 1 with one
granite + one sink, Opción 2 with another granite full, etc.), and expect
the operator to pick the winning one before converting to a work order.

This migration only adds the storage. Nothing reads it yet, and nothing
breaks:

1. `options_data` is a nullable TEXT column holding a JSON array of
   `BudgetOption[]`. NULL / '' / '[]' keeps the legacy behaviour, and
   the runtime fallback (`budget_options.resolve_budget_options`)
   synthesises a single "Opción Única" option from `pieces_data` when the
   column is empty — so old budgets need NO backfill.

2. The per-option shape deliberately REUSES the existing
   `pieces_data` payload (`BudgetPiece[]`) as its `pieces` member, plus
   the option's own totals. That keeps the wire format identical to what
   the frontend already sends for `pieces_data`, so Phase 2 can reuse
   `flatten_pieces` / `buildPieces` / the PDF builders unchanged.

Wire format (Phase 2+):

```json
[
  {
    "id": "opt-1",
    "name": "Opción 1",
    "is_selected": false,
    "pieces": [ /* same shape as Budget.pieces_data */ ],
    "subtotal_ars": 1250000.0,
    "subtotal_usd": 1250.0
  }
]
```

Fase 1 deliberately does NOT persist `subtotal_*` (no backfill, no
recalculation): the values are computed by the Phase 2 calculator. The
fields are declared so the contract is stable.

Idempotent: guarded by an information_schema check, so re-running is a
no-op instead of failing with `Duplicate column name`. Additive / safe.

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-10-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k1l2m3n4o5p6"
down_revision: Union[str, None] = "j0k1l2m3n4o5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Returns True if `column_name` already exists on `table_name`."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return any(col["name"] == column_name for col in inspector.get_columns(table_name))


def upgrade() -> None:
    if not _column_exists("budgets", "options_data"):
        op.add_column(
            "budgets",
            sa.Column(
                "options_data",
                sa.Text(),
                nullable=True,
            ),
        )


def downgrade() -> None:
    # Guarded so a downgrade on a DB that never got the column is a no-op
    # rather than a crash.
    if _column_exists("budgets", "options_data"):
        op.drop_column("budgets", "options_data")