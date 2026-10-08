"""Serienartikel: Stammdaten statt Dokumentenarchiv (DEC-056, DEC-057)

Revision ID: a7c3e19f4b21
Revises: c1d5f7a2e903
Create Date: 2026-10-06 10:00:00.000000

Ein Serienartikel war bisher ein Dokument ohne jeden Bezug: nur Artikelnummer,
Beschreibung und PDF-Pfad. Damit war ein Plan ausschließlich über die Nummer
auffindbar. Diese Migration ergänzt die Angaben, über die gesucht wird:

- `name`       – kurze Bezeichnung des Plans
- `plant_id`   – Werk (Pflicht, RESTRICT: ein Werk mit Plänen bleibt erhalten)
- `customer_id`– Kunde (freiwillig, SET NULL)
- `machine_id` – Maschine (freiwillig, SET NULL)

`extra_metadata` (freies JSON, nie befüllt und nie angezeigt) entfällt mit
dieser Revision (DEC-056 Punkt 11).

Bestehende Zeilen bekommen das erste vorhandene Werk zugeordnet, damit
`plant_id` Pflicht werden kann. Gibt es Zeilen, aber kein Werk, bricht die
Migration bewusst ab: dann muss zuerst ein Werk angelegt (oder ein Plan gelöscht)
werden. Die PDF-Ablage selbst wird nicht angefasst – vorhandene Dateien bleiben
liegen und werden weiterhin über ihren gespeicherten Pfad ausgeliefert
(DEC-057 gilt für neue und umbenannte Artikel).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c3e19f4b21'
down_revision: Union[str, None] = 'c1d5f7a2e903'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Stammdatenfelder ergänzen, `extra_metadata` entfernen."""
    with op.batch_alter_table('serial_articles') as batch_op:
        batch_op.add_column(sa.Column('name', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('plant_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('customer_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('machine_id', sa.Integer(), nullable=True))
        batch_op.drop_column('extra_metadata')

    # Bestehende Pläne dem ersten Werk zuordnen (ohne Zeilen folgenlos).
    op.execute(
        'UPDATE serial_articles SET plant_id = (SELECT MIN(id) FROM plants) '
        'WHERE plant_id IS NULL'
    )

    # Erst nach dem Auffüllen Pflicht – und mit den Fremdschlüsseln, die im
    # Modell stehen (Namen folgen der Naming-Convention aus models/base.py).
    with op.batch_alter_table('serial_articles') as batch_op:
        batch_op.alter_column('plant_id', existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key(
            'fk_serial_articles_plant_id_plants',
            'plants',
            ['plant_id'],
            ['id'],
            ondelete='RESTRICT',
        )
        batch_op.create_foreign_key(
            'fk_serial_articles_customer_id_customers',
            'customers',
            ['customer_id'],
            ['id'],
            ondelete='SET NULL',
        )
        batch_op.create_foreign_key(
            'fk_serial_articles_machine_id_machines',
            'machines',
            ['machine_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    """Rückgängig machen: Stammdatenfelder wieder entfernen.

    Achtung: Kunde, Maschine, Werk und Name gehen dabei verloren. `plant_id` war
    Pflicht – die Zuordnung steckt danach wieder ausschließlich im PDF.
    """
    with op.batch_alter_table('serial_articles') as batch_op:
        batch_op.drop_constraint('fk_serial_articles_machine_id_machines', type_='foreignkey')
        batch_op.drop_constraint('fk_serial_articles_customer_id_customers', type_='foreignkey')
        batch_op.drop_constraint('fk_serial_articles_plant_id_plants', type_='foreignkey')
        batch_op.drop_column('machine_id')
        batch_op.drop_column('customer_id')
        batch_op.drop_column('plant_id')
        batch_op.drop_column('name')
        batch_op.add_column(sa.Column('extra_metadata', sa.JSON(), nullable=True))
