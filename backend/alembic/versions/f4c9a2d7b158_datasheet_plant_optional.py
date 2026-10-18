"""Alembic: Datenblatt ohne Werk (DEC-085)

Revision ID: f4c9a2d7b158
Revises: b5e2d8c41f97
Create Date: 2026-10-18 21:40:00.000000

Ein Datenblatt galt bisher immer für **ein** Werk (`data_sheets.plant_id NOT NULL`).
Allgemeine Informationen (Bedienungsanleitung, Prozesshinweis) betreffen aber alle
Werke. Deshalb wird das Feld **freiwillig**: `NULL` bedeutet „gilt für alle Werke".

**Bestandsdaten bleiben unangetastet** – vorhandene Zeilen behalten ihr Werk. Nur
die Spalte wird nullable; es wird nichts geschrieben.

**Idempotent, mit Absicht:** Beim App-Start läuft `Base.metadata.create_all`; die
Spalte kann also schon nullable sein. Geprüft wird deshalb zuerst (`nullable`), und
`op.batch_alter_table` baut die Tabelle für SQLite um.

**Rückweg:** Beim Zurücknehmen wird `NOT NULL` wiederhergestellt. Gäbe es zu diesem
Zeitpunkt Zeilen ohne Werk, schlüge das fehl – deshalb bekommen sie vorher das
**erste** Werk zugeordnet (dokumentiert, nichts geht verloren).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4c9a2d7b158'
down_revision: Union[str, None] = 'b5e2d8c41f97'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _spalte() -> dict:
    for spalte in sa.inspect(op.get_bind()).get_columns('data_sheets'):
        if spalte['name'] == 'plant_id':
            return spalte
    return {}


def upgrade() -> None:
    spalte = _spalte()
    if spalte and spalte.get('nullable'):
        return  # schon freiwillig
    with op.batch_alter_table('data_sheets') as batch:
        batch.alter_column(
            'plant_id', existing_type=sa.Integer(), nullable=True
        )


def downgrade() -> None:
    # Ohne Werk geht es nicht zurück: solche Zeilen bekommen das erste Werk.
    verbindung = op.get_bind()
    ohne_werk = verbindung.execute(
        sa.text("SELECT COUNT(*) FROM data_sheets WHERE plant_id IS NULL")
    ).scalar_one()
    if ohne_werk:
        erstes = verbindung.execute(
            sa.text("SELECT id FROM plants ORDER BY id LIMIT 1")
        ).scalar_one_or_none()
        if erstes is not None:
            verbindung.execute(
                sa.text("UPDATE data_sheets SET plant_id = :werk WHERE plant_id IS NULL"),
                {"werk": erstes},
            )

    spalte = _spalte()
    if spalte and not spalte.get('nullable'):
        return
    with op.batch_alter_table('data_sheets') as batch:
        batch.alter_column(
            'plant_id', existing_type=sa.Integer(), nullable=False
        )
