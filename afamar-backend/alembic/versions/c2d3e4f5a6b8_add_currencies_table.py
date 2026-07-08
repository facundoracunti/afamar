"""add currencies catalogue + FK on materials and pool_stock

Revision ID: c2d3e4f5a6b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-08 17:30:00.000000

Adds the `currencies` reference table (ARS / USD as initial seeds) and
migrates the `currency: String` column on `materials` and the legacy
`price` + `price_usd` pair on `pool_stock` to a single `currency_id`
FK on each.

`materials` keeps both `base_price` and `price_usd` columns — the
`currency` FK tells the service which one is the canonical price
(ARS → `base_price`, USD → `price_usd`). The other column is the
reference conversion so the totals block can show both columns
without re-computing.

`pool_stock` drops the `price_usd` column entirely (the FK + single
`price` column is enough — the consumer converts with `usd_rate` at
display time).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2d3e4f5a6b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Catalogue
    op.create_table(
        'currencies',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(length=5), nullable=False, unique=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('symbol', sa.String(length=10), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    )
    op.create_index('ix_currencies_id', 'currencies', ['id'])
    op.create_index('ix_currencies_code', 'currencies', ['code'], unique=True)

    # Seed the two currencies AFAMAR uses today. Adding a new currency
    # from here on is a single INSERT (no migration required if
    # `is_active` and the FK chain allows it).
    op.execute(
        "INSERT INTO currencies (code, name, symbol, is_active, sort_order) VALUES "
        "('ARS', 'Peso Argentino', '$', 1, 0), "
        "('USD', 'Dólar Estadounidense', 'USD', 1, 1)"
    )

    # 2. Add the `currency_id` column to `materials` (nullable first
    # so the backfill can run without a constraint).
    with op.batch_alter_table('materials') as batch:
        batch.add_column(sa.Column('currency_id', sa.Integer(), nullable=True))
        batch.create_foreign_key(
            'fk_materials_currency_id_currencies',
            'currencies',
            ['currency_id'], ['id'],
            ondelete='RESTRICT',
        )

    # Backfill: every existing material has a `currency: String`
    # column. Translate the string into the matching FK id.
    op.execute(
        "UPDATE materials AS m "
        "JOIN currencies AS c ON c.code = UPPER(m.currency) "
        "SET m.currency_id = c.id"
    )

    # If there are rows that don't match (shouldn't be, but defensive),
    # assign them the ARS default. Then enforce NOT NULL.
    op.execute(
        "UPDATE materials SET currency_id = (SELECT id FROM currencies "
        "WHERE code = 'ARS' LIMIT 1) WHERE currency_id IS NULL"
    )

    with op.batch_alter_table('materials') as batch:
        batch.alter_column('currency_id', nullable=False)

    # Drop the legacy `currency` string column. The wire format still
    # accepts the string (the service translates it on save), so the
    # Pydantic schemas don't need to change.
    with op.batch_alter_table('materials') as batch:
        batch.drop_column('currency')

    # 3. Same treatment for `pool_stock`. `pool_stock` doesn't have a
    # `currency` string column, so the backfill is "use USD if
    # `price_usd > 0` and `price = 0`, otherwise ARS". Existing
    # rows with both prices populated are treated as ARS (the
    # operator can re-attribute later if needed).
    with op.batch_alter_table('pool_stock') as batch:
        batch.add_column(sa.Column('currency_id', sa.Integer(), nullable=True))
        batch.create_foreign_key(
            'fk_pool_stock_currency_id_currencies',
            'currencies',
            ['currency_id'], ['id'],
            ondelete='RESTRICT',
        )

    op.execute(
        "UPDATE pool_stock AS p "
        "JOIN currencies AS c ON c.code = "
        "  CASE WHEN p.price_usd > 0 AND p.price = 0 THEN 'USD' ELSE 'ARS' END "
        "SET p.currency_id = c.id"
    )

    op.execute(
        "UPDATE pool_stock SET currency_id = (SELECT id FROM currencies "
        "WHERE code = 'ARS' LIMIT 1) WHERE currency_id IS NULL"
    )

    with op.batch_alter_table('pool_stock') as batch:
        batch.alter_column('currency_id', nullable=False)

    # Drop the legacy `price_usd` column — the single `price` column
    # now lives in the currency of the FK.
    with op.batch_alter_table('pool_stock') as batch:
        batch.drop_column('price_usd')


def downgrade() -> None:
    # Reverse: re-add the string columns, blank them out, drop the FKs,
    # drop the catalogue. Best-effort — data already lost the explicit
    # "which price was which currency" mapping.
    with op.batch_alter_table('pool_stock') as batch:
        batch.add_column(sa.Column('price_usd', sa.Float(), nullable=True))
    op.execute("UPDATE pool_stock SET price_usd = 0")
    with op.batch_alter_table('pool_stock') as batch:
        batch.drop_constraint('fk_pool_stock_currency_id_currencies', type_='foreignkey')
        batch.drop_column('currency_id')

    with op.batch_alter_table('materials') as batch:
        batch.add_column(sa.Column('currency', sa.String(length=5), nullable=True))
    op.execute("UPDATE materials SET currency = 'ARS'")
    with op.batch_alter_table('materials') as batch:
        batch.drop_constraint('fk_materials_currency_id_currencies', type_='foreignkey')
        batch.drop_column('currency_id')

    op.drop_index('ix_currencies_code', table_name='currencies')
    op.drop_index('ix_currencies_id', table_name='currencies')
    op.drop_table('currencies')
