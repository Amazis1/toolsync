"""Favoriten für Ersatzteile

Revision ID: a1c4e8f2b903
Revises: f2a6c8d15b74
Create Date: 2026-10-08 12:00:00.000000

Die Ersatzteil-Liste bekommt dieselbe Favoriten-Markierung wie Werkzeuge,
Serienartikel und Datenblätter: ein **globaler** Stern (nicht pro Benutzer) mit
Filter „Nur Favoriten" (DEC-063). Die Spalte ist nicht nullable und wird mit
`false` vorbelegt, damit bestehende Zeilen sofort gültig sind.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e8f2b903'
down_revision: Union[str, None] = 'f2a6c8d15b74'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """`spare_parts.is_favorite` ergänzen (Batch-Modus für SQLite)."""
    with op.batch_alter_table('spare_parts') as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_favorite',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    """Rückgängig machen: Favoriten-Markierung der Ersatzteile entfernen."""
    with op.batch_alter_table('spare_parts') as batch_op:
        batch_op.drop_column('is_favorite')
