"""Arbeitswerk, Werkfarbe und aktueller Ort (DEC-070 / DEC-071 / DEC-076)

Revision ID: b3d7e1a95c42
Revises: a1c4e8f2b903
Create Date: 2026-10-11 10:00:00.000000

Drei Felder, die das Arbeitswerk tragen:

* `plants.color` (String(7), nullable) – Werkfarbe, Vorgabe **Teal `#0f766e`** für das
  erste Werk, **Indigo `#4338ca`** für das zweite. Danach im Admin-Panel pflegbar.
* `users.default_plant_id` (FK → plants, SET NULL, nullable) – Startwert für den
  Werksumschalter; kein Pflichtfeld (das Personal rotiert).
* `tools.current_plant_id` (FK → plants, SET NULL, nullable) – aktueller Ort;
  `NULL` = am Heimatwerk. Wird ausschließlich vom bestätigten Empfang geschrieben.

**Idempotent, mit Absicht:** Beim App-Start läuft `Base.metadata.create_all`
(`app/main.py`, `lifespan`) – auf einer Datenbank, die die Spalten schon hat, bricht
ein blankes `add_column` ab. Dieselbe Bauart wie `e7d1b9c34a52` (Maschinenfarbe).

**Bestandsdaten:** `tools.plant_id` bleibt das **Heimatwerk** (schon so belegt),
`current_plant_id` beginnt leer – damit liegt jedes Werkzeug „am Heimatwerk".
Die Farben werden nur gesetzt, wo noch keine steht (`IS NULL`), vorhandene Werte
werden nie überschrieben.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d7e1a95c42'
down_revision: Union[str, None] = 'a1c4e8f2b903'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Startpalette (DEC-076): erstes Werk Teal (bisheriges Primary), zweites Indigo.
PALETTE = ['#0f766e', '#4338ca', '#a16207']


def _columns(table: str) -> set:
    return {spalte['name'] for spalte in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    """`plants.color`, `users.default_plant_id`, `tools.current_plant_id` ergänzen."""
    if 'color' not in _columns('plants'):
        with op.batch_alter_table('plants') as batch:
            batch.add_column(sa.Column('color', sa.String(length=7), nullable=True))

    if 'default_plant_id' not in _columns('users'):
        with op.batch_alter_table('users') as batch:
            batch.add_column(sa.Column('default_plant_id', sa.Integer(), nullable=True))
            batch.create_foreign_key(
                'fk_users_default_plant_id', 'plants', ['default_plant_id'], ['id'],
                ondelete='SET NULL',
            )

    if 'current_plant_id' not in _columns('tools'):
        with op.batch_alter_table('tools') as batch:
            batch.add_column(sa.Column('current_plant_id', sa.Integer(), nullable=True))
            batch.create_foreign_key(
                'fk_tools_current_plant_id', 'plants', ['current_plant_id'], ['id'],
                ondelete='SET NULL',
            )
            batch.create_index('ix_tools_current_plant_id', ['current_plant_id'])

    # Werkfarben setzen – nur wo noch keine steht, in der Reihenfolge der Werke.
    verbindung = op.get_bind()
    werk_ids = [zeile[0] for zeile in verbindung.execute(
        sa.text("SELECT id FROM plants WHERE color IS NULL ORDER BY id")
    ).fetchall()]
    for position, werk_id in enumerate(werk_ids):
        farbe = PALETTE[position] if position < len(PALETTE) else '#475569'
        verbindung.execute(
            sa.text("UPDATE plants SET color = :farbe WHERE id = :id"),
            {"farbe": farbe, "id": werk_id},
        )


def downgrade() -> None:
    """Rückgängig: aktueller Ort und Vorgabewerk entfallen, Werkfarbe wird entfernt."""
    if 'current_plant_id' in _columns('tools'):
        with op.batch_alter_table('tools') as batch:
            batch.drop_index('ix_tools_current_plant_id')
            batch.drop_constraint('fk_tools_current_plant_id', type_='foreignkey')
            batch.drop_column('current_plant_id')

    if 'default_plant_id' in _columns('users'):
        with op.batch_alter_table('users') as batch:
            batch.drop_constraint('fk_users_default_plant_id', type_='foreignkey')
            batch.drop_column('default_plant_id')

    if 'color' in _columns('plants'):
        with op.batch_alter_table('plants') as batch:
            batch.drop_column('color')
