"""Ersatzteile: `spare_parts` anlegen, `storage_items` entfernen

Revision ID: a8f4c2d6e130
Revises: b6f2c8d41a77
Create Date: 2026-10-04 12:00:00.000000

DEC-064 löst die Doppelmodellierung von Lager/Ersatz auf:

- **Ersatzwerkzeuge** bleiben `tools` mit `is_storage = true` (DEC-052) und
  stehen in der Werkzeugliste.
- **Ersatzteile** bekommen die neue Tabelle `spare_parts`: Identität ist die
  **Artikelnummer** (Pflicht), dazu Werk (Pflicht), Menge und Einheit,
  optionale Maschine und ein Lagerort als Freitext.
- Die alte Tabelle `storage_items` entfällt. Sie enthielt **0 Zeilen**
  (gemessen in `backend/toolsync.db`), es geht also kein Bestand verloren.

`spare_parts` erhält – anders als `storage_items` – eine **echte Revision**:
die alte Tabelle entstand nur über `Base.metadata.create_all` beim App-Start
und fehlte in einer frisch migrierten Datenbank.

Das Entfernen von `storage_items` ist gegen die Abwesenheit der Tabelle
abgesichert: auf einer frisch migrierten Datenbank gibt es sie nicht, und ein
bedingungsloses `DROP TABLE` würde dort mit einem Fehler abbrechen.

**Idempotent, mit Absicht:** In diesem Projekt läuft beim App-Start
`Base.metadata.create_all` (`app/main.py`, `lifespan`). Eine Tabelle kann deshalb
**schon existieren**, bevor die Revision überhaupt ausgeführt wird – ein blankes
`op.create_table` bricht dann mit „table spare_parts already exists" ab. Die
Revision legt Tabelle und Index daher nur an, wenn sie fehlen.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8f4c2d6e130'
down_revision: Union[str, None] = 'b6f2c8d41a77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_names() -> set:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _index_names(table: str) -> set:
    return {entry['name'] for entry in sa.inspect(op.get_bind()).get_indexes(table)}


def upgrade() -> None:
    """`spare_parts` anlegen und die abgelöste `storage_items` entfernen."""
    existing = _table_names()

    if 'spare_parts' not in existing:
        op.create_table(
            'spare_parts',
            sa.Column('id', sa.Integer(), nullable=False),
            # Identität des Teils – darf mehrfach vorkommen (Lagerorte, Chargen).
            sa.Column('article_number', sa.String(length=100), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=True),
            sa.Column('type', sa.String(length=100), nullable=True),
            # Werk ist Pflicht (DEC-064 Punkt 5) – RESTRICT wie bei `serial_articles`.
            sa.Column('plant_id', sa.Integer(), nullable=False),
            # Mengenbestand als Spalte (Anforderung 8); Default 1 für Bestandszeilen.
            sa.Column(
                'quantity', sa.Integer(), nullable=False, server_default=sa.text('1')
            ),
            sa.Column('unit', sa.String(length=20), nullable=True),
            sa.Column('machine_id', sa.Integer(), nullable=True),
            # Freitext „Regal B3 / Fach 2" – kein Matrix-Platz (DEC-048 bleibt Werkzeugen).
            sa.Column('storage_place', sa.String(length=50), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
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
                name='fk_spare_parts_plant_id_plants',
                ondelete='RESTRICT',
            ),
            sa.ForeignKeyConstraint(
                ['machine_id'],
                ['machines.id'],
                name='fk_spare_parts_machine_id_machines',
                ondelete='SET NULL',
            ),
            sa.PrimaryKeyConstraint('id', name='pk_spare_parts'),
        )

    if 'ix_spare_parts_article_number' not in _index_names('spare_parts'):
        op.create_index(
            'ix_spare_parts_article_number', 'spare_parts', ['article_number']
        )

    # Abgelöste Tabelle entfernen – nur, wenn sie existiert. Auf einer frisch
    # migrierten Datenbank wurde sie nie angelegt (sie kam aus `create_all`).
    if 'storage_items' in _table_names():
        op.drop_table('storage_items')


def downgrade() -> None:
    """Rückgängig machen: `spare_parts` entfernen, `storage_items` wiederherstellen.

    Die alte Tabelle wird mit ihren ursprünglichen Spalten neu angelegt
    (`docs/07-stock-replacement.md`, Variante B). Die Daten der gelöschten
    Tabelle sind nicht wiederherstellbar – sie waren beim Upgrade leer.
    """
    if 'storage_items' not in _table_names():
        op.create_table(
            'storage_items',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('storage_id', sa.String(length=50), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('type', sa.String(length=100), nullable=True),
            sa.Column('article_number', sa.String(length=100), nullable=True),
            # Bewusst FK-los, wie im ursprünglichen Modell.
            sa.Column('machine_id', sa.Integer(), nullable=True),
            sa.Column('location_id', sa.Integer(), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column(
                'allow_duplicate_id',
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
            sa.PrimaryKeyConstraint('id', name='pk_storage_items'),
        )
        op.create_index(
            'ix_storage_items_storage_id', 'storage_items', ['storage_id']
        )

    if 'spare_parts' in _table_names():
        if 'ix_spare_parts_article_number' in _index_names('spare_parts'):
            op.drop_index('ix_spare_parts_article_number', table_name='spare_parts')
        op.drop_table('spare_parts')
