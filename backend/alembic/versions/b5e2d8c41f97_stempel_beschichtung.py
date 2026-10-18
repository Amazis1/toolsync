"""Stempel-Beschichtung: `coatings` + `tools.coating_id`

Revision ID: b5e2d8c41f97
Revises: d7a1c4f93e26
Create Date: 2026-10-05 09:00:00.000000

Stempel tragen eine **Beschichtung** unter der Dachmarke **MultiDur**. Die
Auswahl ist Stammdaten-pflegbar (Admin-Panel → Stammdaten → „Stempel-
Beschichtung"), ausgewählt wird sie im Anlege-/Bearbeitungs-Formular des
Werkzeugs neben „Lager/Ersatz".

Inhalt:

1. Neue Tabelle `coatings` – nur der Name („MultiDur TiCN"). Eine eigene
   Marken-Tabelle wäre bei **einer** Dachmarke eine leere Spalte in jeder Zeile.
2. `tools.coating_id` – freiwillig, `SET NULL`: eine gelöschte Beschichtung
   nimmt keinen Stempel mit (dieselbe Regel wie bei `machines`/`customers`).
3. **Startdaten** – die drei Beschichtungen der Dachmarke plus „Standard" für
   den unbeschichteten Stempel. Eingefügt wird nur, solange die Tabelle leer
   ist; eine gepflegte Liste bleibt unangetastet.

**Idempotent, mit Absicht:** Beim App-Start läuft `Base.metadata.create_all`
(`app/main.py`, `lifespan`) – Tabelle und Spalte können also schon existieren,
bevor diese Revision läuft. Beide Schritte prüfen deshalb zuerst, was fehlt;
`op.batch_alter_table` baut die `tools`-Tabelle für den Fremdschlüssel neu auf
(SQLite kann Constraints nicht nachträglich ändern).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5e2d8c41f97'
down_revision: Union[str, None] = 'd7a1c4f93e26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Startdaten: die Dachmarke MultiDur und „Standard" (ohne besondere Beschichtung).
# Reihenfolge = die Reihenfolge im Gespräch mit dem Inhaber; sortiert wird in der
# Oberfläche ohnehin nach Namen.
DEFAULT_COATINGS = (
    'MultiDur TiCN',
    'MultiDur Performance',
    'MultiDur Alu',
    'Standard',
)

FK_NAME = 'fk_tools_coating_id_coatings'
IX_NAME = 'ix_tools_coating_id'


def _inspect():
    return sa.inspect(op.get_bind())


def _table_names() -> set:
    return set(_inspect().get_table_names())


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


def _seed_defaults() -> None:
    """Startdaten setzen – nur, solange noch keine Beschichtung gepflegt ist."""
    bind = op.get_bind()
    vorhanden = bind.execute(sa.text('SELECT COUNT(*) FROM coatings')).scalar() or 0
    if vorhanden:
        return
    for name in DEFAULT_COATINGS:
        bind.execute(
            sa.text('INSERT INTO coatings (name) VALUES (:name)'), {'name': name}
        )


def upgrade() -> None:
    """`coatings` anlegen, Startdaten setzen, `tools.coating_id` ergänzen."""
    if 'coatings' not in _table_names():
        op.create_table(
            'coatings',
            sa.Column('id', sa.Integer(), nullable=False),
            # Vollständiger Name inkl. Dachmarke, z. B. "MultiDur TiCN".
            sa.Column('name', sa.String(length=100), nullable=False),
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
            sa.PrimaryKeyConstraint('id', name='pk_coatings'),
            sa.UniqueConstraint('name', name='uq_coatings_name'),
        )

    _seed_defaults()

    has_column = 'coating_id' in _column_names('tools')
    has_fk = FK_NAME in _fk_names('tools')

    if not has_column or not has_fk:
        with op.batch_alter_table('tools') as batch_op:
            if not has_column:
                batch_op.add_column(sa.Column('coating_id', sa.Integer(), nullable=True))
            if not has_fk:
                batch_op.create_foreign_key(
                    FK_NAME, 'coatings', ['coating_id'], ['id'], ondelete='SET NULL'
                )

    if IX_NAME not in _index_names('tools'):
        op.create_index(IX_NAME, 'tools', ['coating_id'])


def downgrade() -> None:
    """Rückgängig machen: Beschichtung am Werkzeug und Tabelle entfernen.

    Die Zuordnungen (`tools.coating_id`) gehen dabei verloren – die Werkzeuge
    selbst bleiben unverändert.
    """
    if IX_NAME in _index_names('tools'):
        op.drop_index(IX_NAME, table_name='tools')

    if 'coating_id' in _column_names('tools'):
        with op.batch_alter_table('tools') as batch_op:
            batch_op.drop_column('coating_id')

    if 'coatings' in _table_names():
        op.drop_table('coatings')
