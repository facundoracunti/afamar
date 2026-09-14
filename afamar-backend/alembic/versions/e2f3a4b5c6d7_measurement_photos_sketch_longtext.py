"""make measurement photos/sketch columns hold large payloads

Photos are stored as base64 data-URLs inside a JSON array. A single phone
photo easily exceeds the 65 KB cap of MySQL TEXT, which truncates silently
and corrupts the stored JSON (photos "disappear" on reload). This widens
`photos_data` (and `sketch_data`, same class of payload) to LONGTEXT on
MySQL. SQLite TEXT has no size limit, so the variant is a no-op there.

Revision ID: e2f3a4b5c6d7
Revises: d7e8f9a0b1c2
Create Date: 2026-09-11
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

revision = "e2f3a4b5c6d7"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None

_LONGTEXT = sa.Text().with_variant(mysql.LONGTEXT(), "mysql")


def upgrade() -> None:
    with op.batch_alter_table("measurements") as batch_op:
        batch_op.alter_column(
            "photos_data",
            existing_type=sa.Text(),
            type_=_LONGTEXT,
            existing_nullable=True,
        )
        batch_op.alter_column(
            "sketch_data",
            existing_type=sa.Text(),
            type_=_LONGTEXT,
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("measurements") as batch_op:
        batch_op.alter_column(
            "photos_data",
            existing_type=_LONGTEXT,
            type_=sa.Text(),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "sketch_data",
            existing_type=_LONGTEXT,
            type_=sa.Text(),
            existing_nullable=True,
        )