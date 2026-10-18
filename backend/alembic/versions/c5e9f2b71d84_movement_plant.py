"""Arbeitswerk an der Bewegung (DEC-070 / DEC-078)

Revision ID: c5e9f2b71d84
Revises: b3d7e1a95c42
Create Date: 2026-10-11 12:00:00.000000

`tool_movements.plant_id` hält fest, **in welchem Werk** eine Bewegung ausgeführt
wurde (Ausleihe, Rückgabe, Umbuchung). Damit ist Anforderung 9/10 vollständig
auswertbar: „welcher Benutzer, welches Werkzeug, welches Werk, wann".

**Idempotent, mit Absicht:** Beim App-Start läuft `Base.metadata.create_all` –
auf einer Datenbank, die die Spalte schon hat, bricht ein blankes `add_column` ab.
Dieselbe Bauart wie `e7d1b9c34a52` (Maschinenfarbe) und `b3d7e1a95c42` (Arbeitswerk).

**Bestandsdaten:** bleiben NULL. Für Altdaten gilt deren `from_location` als
Nachweis; die Spalte wird nicht nachträglich erfunden.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5e9f2b71d84'
down_revision: Union[str, None] = 'b3d7e1a95c42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set:
    return {spalte['name'] for spalte in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    """`tool_movements.plant_id` ergänzen (Batch-Modus für SQLite)."""
    if 'plant_id' in _columns('tool_movements'):
        return
    with op.batch_alter_table('tool_movements') as batch:
        batch.add_column(sa.Column('plant_id', sa.Integer(), nullable=True))
        batch.create_foreign_key(
            'fk_tool_movements_plant_id', 'plants', ['plant_id'], ['id'],
            ondelete='SET NULL',
        )
        batch.create_index('ix_tool_movements_plant_id', ['plant_id'])


def downgrade() -> None:
    """Rückgängig: Spalte samt Fremdschlüssel und Index entfernen."""
    if 'plant_id' not in _columns('tool_movements'):
        return
    with op.batch_alter_table('tool_movements') as batch:
        batch.drop_index('ix_tool_movements_plant_id')
        batch.drop_constraint('fk_tool_movements_plant_id', type_='foreignkey')
        batch.drop_column('plant_id')
