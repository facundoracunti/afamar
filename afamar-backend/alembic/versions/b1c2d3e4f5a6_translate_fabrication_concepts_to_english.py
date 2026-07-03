"""Translate fabrication_details.concepto from Spanish to English codes.

The fabrication concept codes were Spanish strings (`ZÓCALO`, `FRENTE`,
`TRAFORO DE PILETA`, ...) both in the DB and the frontend. They have been
migrated to canonical English codes (`BASEBOARD`, `FRONT`, `CUTOUT_SINK`,
...) — see `afamar-frontend/src/hooks/entityFormHelpers.ts` and
`afamar-frontend/src/utils/translate.ts`.

`fabrication_details` is a JSON-encoded list stored in a TEXT column on
both `budgets` and `work_orders`. The migration walks every row, parses
the list, and rewrites the `concepto` field for each item using the
CONCEPT_NORMALIZE table.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Spanish legacy → English canonical. Must match
# `afamar-frontend/src/hooks/entityFormHelpers.ts` `CONCEPT_NORMALIZE`.
CONCEPT_NORMALIZE: dict[str, str] = {
    "ZÓCALO": "BASEBOARD",
    "FRENTE": "FRONT",
    "LONGITUD": "LENGTH",
    "TRAFORO DE PILETA": "CUTOUT_SINK",
    "TRAFORO DE ANAFE": "CUTOUT_COOKTOP",
    "TRAFORO DE PILETA DE APOYO": "CUTOUT_DROPIN_SINK",
    "APERTURA + PEGADO PILETA": "CUTOUT_SINK",
    "APERTURA Y PEGADO DE PILETA": "CUTOUT_SINK",
    "APERTURA ANAFE": "CUTOUT_COOKTOP",
    "APERTURA DE ANAFE": "CUTOUT_COOKTOP",
    "APERTURA PILETA APOYO": "CUTOUT_DROPIN_SINK",
    "APERTURA PILETA DE APOYO": "CUTOUT_DROPIN_SINK",
    "OTRA": "OTHER",
}


def _translate_payload(raw: str | None) -> tuple[str, int]:
    """Translate `concepto` inside a JSON-encoded fabrication_details list.

    Returns the (possibly rewritten) JSON string and the number of items
    whose `concepto` was changed. Malformed JSON is returned untouched.
    """
    if not raw:
        return raw or "", 0
    try:
        import json

        data = json.loads(raw)
    except (ValueError, TypeError):
        return raw, 0
    if not isinstance(data, list):
        return raw, 0

    changed = 0
    for item in data:
        if not isinstance(item, dict):
            continue
        old = item.get("concepto")
        if isinstance(old, str) and old in CONCEPT_NORMALIZE:
            item["concepto"] = CONCEPT_NORMALIZE[old]
            changed += 1
    if changed == 0:
        return raw, 0
    return json.dumps(data, ensure_ascii=False), changed


def upgrade() -> None:
    bind = op.get_bind()
    total_changed = 0
    for table in ("budgets", "work_orders"):
        rows = bind.execute(
            text(
                f"SELECT id, fabrication_details FROM {table} "
                "WHERE fabrication_details IS NOT NULL "
                "AND fabrication_details != ''"
            )
        ).fetchall()
        for row_id, raw in rows:
            new_raw, changed = _translate_payload(raw)
            if changed:
                bind.execute(
                    text(
                        f"UPDATE {table} SET fabrication_details = :raw WHERE id = :id"
                    ),
                    {"raw": new_raw, "id": row_id},
                )
                total_changed += changed
    print(
        f"Translated {total_changed} fabrication_details.concepto values "
        f"from Spanish to English."
    )


def downgrade() -> None:
    """Reverse translation: English → Spanish."""
    inverse = {v: k for k, v in CONCEPT_NORMALIZE.items()}
    bind = op.get_bind()
    total_changed = 0
    for table in ("budgets", "work_orders"):
        rows = bind.execute(
            text(
                f"SELECT id, fabrication_details FROM {table} "
                "WHERE fabrication_details IS NOT NULL "
                "AND fabrication_details != ''"
            )
        ).fetchall()
        for row_id, raw in rows:
            try:
                import json

                data = json.loads(raw)
            except (ValueError, TypeError):
                continue
            if not isinstance(data, list):
                continue
            changed = 0
            for item in data:
                if not isinstance(item, dict):
                    continue
                old = item.get("concepto")
                if isinstance(old, str) and old in inverse:
                    item["concepto"] = inverse[old]
                    changed += 1
            if changed:
                bind.execute(
                    text(
                        f"UPDATE {table} SET fabrication_details = :raw WHERE id = :id"
                    ),
                    {"raw": json.dumps(data, ensure_ascii=False), "id": row_id},
                )
                total_changed += changed
    print(
        f"Reverted {total_changed} fabrication_details.concepto values "
        f"back to Spanish."
    )
