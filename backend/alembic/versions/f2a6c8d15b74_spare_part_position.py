"""Ersatzteile: Lagerplatz aus der Werkzeug-Matrix

Revision ID: f2a6c8d15b74
Revises: e7d1b9c34a52
Create Date: 2026-10-04 18:00:00.000000

Nachtrag zu DEC-064: Ersatzteile bekommen **zusätzlich** zum Freitext-Lagerort
einen optionalen Platz aus der Werkzeug-Matrix (`spare_parts.position_id`).

Damit gilt ein Platz als belegt, wenn `positions.tool_id` **oder** ein Ersatzteil
darauf zeigt – genau das prüfen `LocationService` und `ToolService`. Der Platz
erscheint in der Matrix als Ersatzteil und ist für Werkzeuge gesperrt
(Anforderung 7.2: ein Platz darf nicht doppelt belegt sein).

`ondelete="SET NULL"`: wird eine Schublade, ein Schrank oder ein Platz gelöscht,
verliert das Ersatzteil nur den Platz – der Datensatz bleibt (dieselbe Regel wie
bei Werkzeugen, DEC-050).

**Idempotent, mit Absicht:** Beim App-Start läuft `Base.metadata.create_all`
(`app/main.py`, `lifespan`) – eine Datenbank, die `spare_parts` bereits mit dieser
Spalte angelegt hat, darf nicht an einem doppelten `add_column` scheitern. Deshalb
werden Spalte, Fremdschlüssel und Index einzeln geprüft; die Prüfungen laufen
**vor** dem Batch-Block (im Block wird die Tabelle neu aufgebaut).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a6c8d15b74'
down_revision: Union[str, None] = 'e7d1b9c34a52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_NAME = 'fk_spare_parts_position_id_positions'
IX_NAME = 'ix_spare_parts_position_id'


def _inspect():
    return sa.inspect(op.get_bind())


def _column_names(table: str) -> set:
    return {entry['name'] for entry in _inspect().get_columns(table)}


def _index_names(table: str) -> set:
    return {entry['name'] for entry in _inspect().get_indexes(table)}


def _fk_names(table: str) -> set:
    return {
        entry.get('name')
        for entry in _inspect().get_foreign_keys(table)
        if entry.get('name')
    }


def upgrade() -> None:
    """`spare_parts.position_id` ergänzen (Batch-Modus für SQLite)."""
    has_column = 'position_id' in _column_names('spare_parts')
    has_fk = FK_NAME in _fk_names('spare_parts')

    if not has_column or not has_fk:
        # SQLite kann Constraints nicht nachträglich ändern – der Batch-Modus
        # baut die Tabelle neu auf und übernimmt die vorhandenen Constraints.
        with op.batch_alter_table('spare_parts') as batch_op:
            if not has_column:
                batch_op.add_column(sa.Column('position_id', sa.Integer(), nullable=True))
            if not has_fk:
                batch_op.create_foreign_key(
                    FK_NAME, 'positions', ['position_id'], ['id'], ondelete='SET NULL'
                )

    if IX_NAME not in _index_names('spare_parts'):
        op.create_index(IX_NAME, 'spare_parts', ['position_id'])


def downgrade() -> None:
    """Rückgängig machen: Matrix-Platz am Ersatzteil entfernen."""
    if IX_NAME in _index_names('spare_parts'):
        op.drop_index(IX_NAME, table_name='spare_parts')

    if 'position_id' in _column_names('spare_parts'):
        with op.batch_alter_table('spare_parts') as batch_op:
            batch_op.drop_column('position_id')
