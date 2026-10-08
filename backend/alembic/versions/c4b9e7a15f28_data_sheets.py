"""Datenblätter: `data_sheets` anlegen

Revision ID: c4b9e7a15f28
Revises: a8f4c2d6e130
Create Date: 2026-10-04 16:00:00.000000

DEC-065: Ein **Datenblatt** ist ein PDF mit den Einstellwerten eines Werkzeugs
für eine Maschine – der Zwilling des Serienartikels („was braucht der Auftrag"
gegen „wie wird das Werkzeug eingerichtet").

Neu ist die Tabelle `data_sheets`:

- `tool_id` ist die **Werkzeug-ID als Text** – empfohlen, aber **nicht Pflicht**
  (DEC-055) und **nicht eindeutig** (DEC-052: mehrere Exemplare). Deshalb
  bewusst **kein** Fremdschlüssel auf `tools.id`: das Datenblatt gilt für die ID,
  nicht für ein Exemplar.
- Werk ist Pflicht (`RESTRICT`), die Maschine ist optional (`SET NULL`).
- `is_favorite` kommt sofort mit (globale Markierung wie DEC-063), damit für die
  Listenoptik keine zweite Revision nötig wird.

**Idempotent, mit Absicht:** Beim App-Start läuft `Base.metadata.create_all`
(`app/main.py`, `lifespan`). Eine Tabelle kann deshalb schon existieren, bevor
die Revision ausgeführt wird – ein blankes `op.create_table` bricht dann mit
„table data_sheets already exists" ab.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4b9e7a15f28'
down_revision: Union[str, None] = 'a8f4c2d6e130'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _index_names(table: str) -> set:
    return {entry['name'] for entry in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    """`data_sheets` anlegen (Datenblätter je Werkzeug-ID und Maschine)."""
    if 'data_sheets' not in _table_names():
        op.create_table(
            'data_sheets',
            sa.Column('id', sa.Integer(), nullable=False),
            # Werkzeug-ID als Text: empfohlen, nicht Pflicht, nicht eindeutig.
            sa.Column('tool_id', sa.String(length=50), nullable=True),
            # Werk ist Pflicht – ohne Werk ist das Datenblatt nicht auffindbar.
            sa.Column('plant_id', sa.Integer(), nullable=False),
            sa.Column('machine_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(length=200), nullable=True),
            sa.Column('description', sa.String(length=500), nullable=True),
            # Relativer Pfad des ersten Datenblatts (Ordnername = Datensatz-ID).
            sa.Column('pdf_path', sa.String(length=500), nullable=True),
            sa.Column(
                'is_favorite',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column(
                'created_at',
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                'updated_at',
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(
                ['plant_id'],
                ['plants.id'],
                name='fk_data_sheets_plant_id_plants',
                ondelete='RESTRICT',
            ),
            sa.ForeignKeyConstraint(
                ['machine_id'],
                ['machines.id'],
                name='fk_data_sheets_machine_id_machines',
                ondelete='SET NULL',
            ),
            sa.PrimaryKeyConstraint('id', name='pk_data_sheets'),
        )

    if 'ix_data_sheets_tool_id' not in _index_names('data_sheets'):
        op.create_index('ix_data_sheets_tool_id', 'data_sheets', ['tool_id'])


def downgrade() -> None:
    """Rückgängig machen: `data_sheets` entfernen (die Dateiablage bleibt liegen)."""
    if 'data_sheets' in _table_names():
        if 'ix_data_sheets_tool_id' in _index_names('data_sheets'):
            op.drop_index('ix_data_sheets_tool_id', table_name='data_sheets')
        op.drop_table('data_sheets')
