"""add client_addresses table + delivery_address_id on budgets/work_orders

Revision ID: a1c2b3d4e5f7
Revises: 20878d9185cb
Create Date: 2026-07-08 12:00:00.000000

Adds a 1-N `client_addresses` table so a client (typically an architect)
can have several delivery addresses for different project sites, plus a
nullable `delivery_address_id` FK on `budgets` and `work_orders` that
points to the address the customer picked for that document.

Backfills `client_addresses` from any non-empty `clients.address` so the
existing single-address clients keep their data — the new default row is
the source of truth from now on, but `clients.address` is kept as a
shadow column for backward compat (still populated when creating new
clients via the legacy `ClientBase.address`).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c2b3d4e5f7'
down_revision: Union[str, None] = '20878d9185cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1) New table.
    op.create_table(
        'client_addresses',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('client_id', sa.Integer(), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('label', sa.String(length=50), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    )

    # 2) Backfill: one default row per client that has a non-empty address.
    #    Uses the `updated_at`/`created_at` defaults from the column so the
    #    row timestamps match existing clients.
    bind.execute(
        sa.text(
            """
            INSERT INTO client_addresses (client_id, address, label, is_default, created_at, updated_at)
            SELECT id, address, 'Principal', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            FROM clients
            WHERE address IS NOT NULL AND TRIM(address) != ''
            """
        )
    )

    # 3) delivery_address_id on budgets + work_orders (nullable so old
    #    rows and rows that don't care about the per-doc address still
    #    work without any backfill).
    with op.batch_alter_table('budgets') as batch:
        batch.add_column(sa.Column('delivery_address_id', sa.Integer(), nullable=True))
        batch.create_foreign_key(
            'fk_budgets_delivery_address_id_client_addresses',
            'client_addresses',
            ['delivery_address_id'], ['id'],
            ondelete='SET NULL',
        )
    with op.batch_alter_table('work_orders') as batch:
        batch.add_column(sa.Column('delivery_address_id', sa.Integer(), nullable=True))
        batch.create_foreign_key(
            'fk_work_orders_delivery_address_id_client_addresses',
            'client_addresses',
            ['delivery_address_id'], ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    with op.batch_alter_table('work_orders') as batch:
        batch.drop_constraint('fk_work_orders_delivery_address_id_client_addresses', type_='foreignkey')
        batch.drop_column('delivery_address_id')
    with op.batch_alter_table('budgets') as batch:
        batch.drop_constraint('fk_budgets_delivery_address_id_client_addresses', type_='foreignkey')
        batch.drop_column('delivery_address_id')
    op.drop_table('client_addresses')
