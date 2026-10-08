"""Maschinenfarbe

Revision ID: e7d1b9c34a52
Revises: c4b9e7a15f28
Create Date: 2026-10-04 17:00:00.000000

Maschinen bekommen dieselbe optionale Farbe wie Kunden (`customers.color`,
Revision `d1a4f6b2c9e3`): Die Listen zeigen daraus einen Farbpunkt neben dem
Maschinennamen, damit Maschinen auf einen Blick unterscheidbar sind – Kunden und
Maschinen werden damit gleich behandelt.

`String(7)` = `#RRGGBB`. Nullable: ohne Farbe wird kein Punkt gezeigt; die
Stammdatenpflege im Admin-Panel hat dafür ein Kontrollkästchen „Keine Farbe".

**Idempotent, mit Absicht:** Beim App-Start läuft `Base.metadata.create_all`
(`app/main.py`, `lifespan`) – auf einer Datenbank, die `machines` bereits mit
dieser Spalte angelegt hat, bricht ein blankes `add_column` ab.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7d1b9c34a52'
down_revision: Union[str, None] = 'c4b9e7a15f28'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table: str) -> set:
    return {entry['name'] for entry in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    """`machines.color` ergänzen (Batch-Modus für SQLite)."""
    if 'color' in _column_names('machines'):
        return
    with op.batch_alter_table('machines') as batch_op:
        batch_op.add_column(sa.Column('color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    """Rückgängig machen: Maschinenfarbe entfernen."""
    if 'color' not in _column_names('machines'):
        return
    with op.batch_alter_table('machines') as batch_op:
        batch_op.drop_column('color')
