"""Remove StorageLocation, add grid (cols/rows) to Drawer, x/y to Position, position_id to Tool

Revision ID: c7d9e2f3a1b8
Revises: b2e8c1a4d9f7
Create Date: 2026-08-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d9e2f3a1b8'
down_revision: Union[str, None] = 'b2e8c1a4d9f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Lagerplatz-Hierarchie vereinfachen (Batch-Modus für SQLite).

    WICHTIG: Zuerst die alte FK-Abhängigkeit von `tools -> storage_locations`
    entfernen, DANN die Tabelle storage_locations droppen.
    """

    # 1) Drawer: cols + rows hinzufügen
    with op.batch_alter_table('drawers') as batch_op:
        batch_op.add_column(sa.Column('cols', sa.Integer(), nullable=False, server_default='5'))
        batch_op.add_column(sa.Column('rows', sa.Integer(), nullable=False, server_default='2'))

    # 2) Position: x, y, tool_id hinzufügen + FK
    with op.batch_alter_table('positions') as batch_op:
        batch_op.add_column(sa.Column('x', sa.Integer(), nullable=False, server_default='1'))
        batch_op.add_column(sa.Column('y', sa.Integer(), nullable=False, server_default='1'))
        batch_op.add_column(sa.Column('tool_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_positions_tool_id_tools', 'tools', ['tool_id'], ['id'], ondelete='SET NULL'
        )

    # 3) Tool: position_id hinzufügen + FK
    with op.batch_alter_table('tools') as batch_op:
        batch_op.add_column(sa.Column('position_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_tools_position_id_positions', 'positions', ['position_id'], ['id'], ondelete='SET NULL'
        )

    # 4) Tool: alte storage_location_id-FK/-Spalte entfernen (VOR dem Droppen!)
    with op.batch_alter_table('tools') as batch_op:
        batch_op.drop_constraint('uq_tools_storage_location_id', type_='unique')
        batch_op.drop_constraint('fk_tools_storage_location_id_storage_locations', type_='foreignkey')
        batch_op.drop_column('storage_location_id')

    # 5) StorageLocation-Tabelle entfernen (jetzt ohne FK-Abhängigkeit)
    op.drop_table('storage_locations')


def downgrade() -> None:
    """Rückgängig machen (wenn nötig)."""

    # 1) StorageLocation-Tabelle neu anlegen (zuerst, vor FK)
    op.create_table(
        'storage_locations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('position_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['position_id'], ['positions.id'], name=op.f('fk_storage_locations_position_id_positions'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_storage_locations')),
        sa.UniqueConstraint('position_id', name=op.f('uq_storage_locations_position_id')),
    )

    # 2) Tools: position_id entfernen, storage_location_id wieder herstellen
    with op.batch_alter_table('tools') as batch_op:
        batch_op.drop_constraint('fk_tools_position_id_positions', type_='foreignkey')
        batch_op.drop_column('position_id')
        batch_op.add_column(sa.Column('storage_location_id', sa.Integer(), nullable=True))
        batch_op.create_unique_constraint('uq_tools_storage_location_id', ['storage_location_id'])
        batch_op.create_foreign_key(
            'fk_tools_storage_location_id_storage_locations',
            'storage_locations', ['storage_location_id'], ['id'], ondelete='SET NULL'
        )

    # 3) Position: tool_id FK + x/y entfernen
    with op.batch_alter_table('positions') as batch_op:
        batch_op.drop_constraint('fk_positions_tool_id_tools', type_='foreignkey')
        batch_op.drop_column('tool_id')
        batch_op.drop_column('y')
        batch_op.drop_column('x')

    # 4) Drawer: cols/rows entfernen
    with op.batch_alter_table('drawers') as batch_op:
        batch_op.drop_column('rows')
        batch_op.drop_column('cols')
