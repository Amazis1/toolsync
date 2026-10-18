"""Alembic: Werkzeug-Logistik (DEC-072)

Revision ID: d7a1c4f93e26
Revises: c5e9f2b71d84
Create Date: 2026-10-11 13:00:00.000000

Zwei neue Tabellen und eine Spalte:

* `transport_orders` – ein Auftrag = eine Richtung (von Werk → an Werk). Der
  Rückweg ist ein eigener Auftrag mit `parent_order_id`.
* `transport_items` – je Werkzeug eine Zeile; der **Empfang** wird pro Zeile
  bestätigt (`received_at`, `received_by_id`, `received_plant_id`). Der
  Heimatplatz zum Versandzeitpunkt wird mitgeschrieben (`home_position_id`,
  `home_position_code`) – ein späterer Umbau der Matrix zerstört den Nachweis nicht.
* `tool_movements.transport_id` – verbindet Verlauf und Auftrag.

**Idempotent, mit Absicht – und objektweise geprüft:** Beim App-Start läuft
`Base.metadata.create_all`; je nach Reihenfolge kann eine Tabelle schon stehen,
während ein Index oder die Spalte fehlt (oder umgekehrt). Deshalb prüft jede
Anweisung **einzeln**, ob ihr Ziel schon existiert. Dieselbe Bauart wie
`e7d1b9c34a52` und `b3d7e1a95c42`. Bestehende Daten werden nicht angefasst.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7a1c4f93e26'
down_revision: Union[str, None] = 'c5e9f2b71d84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ORDERS = 'transport_orders'
ITEMS = 'transport_items'


def _tabellen() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _spalten(table: str) -> set:
    return {spalte['name'] for spalte in sa.inspect(op.get_bind()).get_columns(table)}


def _indizes(table: str) -> set:
    if table not in _tabellen():
        return set()
    return {index['name'] for index in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    if ORDERS not in _tabellen():
        op.create_table(
            ORDERS,
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('order_number', sa.String(length=50), nullable=False),
            sa.Column('reference', sa.String(length=100), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False),
            sa.Column('info', sa.Text(), nullable=True),
            sa.Column('from_plant_id', sa.Integer(), nullable=False),
            sa.Column('to_plant_id', sa.Integer(), nullable=False),
            sa.Column('parent_order_id', sa.Integer(), nullable=True),
            sa.Column('created_by_id', sa.Integer(), nullable=True),
            sa.Column('created_plant_id', sa.Integer(), nullable=True),
            sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('sent_by_id', sa.Integer(), nullable=True),
            sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['from_plant_id'], ['plants.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['to_plant_id'], ['plants.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['parent_order_id'], [ORDERS + '.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['created_plant_id'], ['plants.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['sent_by_id'], ['users.id'], ondelete='SET NULL'),
        )

    if ITEMS not in _tabellen():
        op.create_table(
            ITEMS,
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('order_id', sa.Integer(), nullable=False),
            sa.Column('tool_id', sa.Integer(), nullable=False),
            sa.Column('home_position_id', sa.Integer(), nullable=True),
            sa.Column('home_position_code', sa.String(length=50), nullable=True),
            sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('received_by_id', sa.Integer(), nullable=True),
            sa.Column('received_plant_id', sa.Integer(), nullable=True),
            sa.Column('note', sa.String(length=500), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['order_id'], [ORDERS + '.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['tool_id'], ['tools.id'], ondelete='RESTRICT'),
            sa.ForeignKeyConstraint(['home_position_id'], ['positions.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['received_by_id'], ['users.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['received_plant_id'], ['plants.id'], ondelete='SET NULL'),
        )

    if 'ix_transport_orders_order_number' not in _indizes(ORDERS):
        op.create_index('ix_transport_orders_order_number', ORDERS, ['order_number'])
    if 'ix_transport_orders_status' not in _indizes(ORDERS):
        op.create_index('ix_transport_orders_status', ORDERS, ['status'])
    if 'ix_transport_items_order_id' not in _indizes(ITEMS):
        op.create_index('ix_transport_items_order_id', ITEMS, ['order_id'])
    if 'ix_transport_items_tool_id' not in _indizes(ITEMS):
        op.create_index('ix_transport_items_tool_id', ITEMS, ['tool_id'])

    if 'transport_id' not in _spalten('tool_movements'):
        with op.batch_alter_table('tool_movements') as batch:
            batch.add_column(sa.Column('transport_id', sa.Integer(), nullable=True))
            batch.create_foreign_key(
                'fk_tool_movements_transport_id', ORDERS, ['transport_id'], ['id'],
                ondelete='SET NULL',
            )


def downgrade() -> None:
    if 'transport_id' in _spalten('tool_movements'):
        with op.batch_alter_table('tool_movements') as batch:
            batch.drop_constraint('fk_tool_movements_transport_id', type_='foreignkey')
            batch.drop_column('transport_id')

    for name in ('ix_transport_items_tool_id', 'ix_transport_items_order_id'):
        if name in _indizes(ITEMS):
            op.drop_index(name, table_name=ITEMS)
    for name in ('ix_transport_orders_status', 'ix_transport_orders_order_number'):
        if name in _indizes(ORDERS):
            op.drop_index(name, table_name=ORDERS)

    if ITEMS in _tabellen():
        op.drop_table(ITEMS)
    if ORDERS in _tabellen():
        op.drop_table(ORDERS)
