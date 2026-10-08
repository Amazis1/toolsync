"""Favoriten für Serienartikel

Revision ID: b6f2c8d41a77
Revises: a7c3e19f4b21
Create Date: 2026-10-06 12:00:00.000000

Die Serienartikel-Liste bekommt dieselbe Favoriten-Markierung wie die
Werkzeugliste: ein **globaler** Stern (nicht pro Benutzer) mit Filter „Nur
Favoriten" (DEC-063). Die Spalte ist nicht nullable und wird mit `false`
vorbelegt, damit bestehende Zeilen sofort gültig sind.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6f2c8d41a77'
down_revision: Union[str, None] = 'a7c3e19f4b21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """`serial_articles.is_favorite` ergänzen (Batch-Modus für SQLite)."""
    with op.batch_alter_table('serial_articles') as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_favorite',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    """Rückgängig machen: Favoriten-Markierung der Serienartikel entfernen."""
    with op.batch_alter_table('serial_articles') as batch_op:
        batch_op.drop_column('is_favorite')
