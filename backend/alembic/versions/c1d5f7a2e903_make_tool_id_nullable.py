"""Werkzeug-ID optional machen (Abstreifer und Matrize ohne ID)

Revision ID: c1d5f7a2e903
Revises: e4c7a15b8d20
Create Date: 2026-08-20 12:00:00.000000

Stempel tragen ihre Werkzeug-ID eingraviert und werden darüber gefunden.
Abstreifer und Matrize werden über ihr Maß geführt – dort ist die ID freiwillig.
Bisher war `tools.tool_id` NOT NULL, ein leeres Feld im Formular wäre also als
leerer String gespeichert worden: von „nicht gepflegt" nicht zu unterscheiden
und für die Eindeutigkeitsprüfung eine Kollision unter allen ID-losen
Datensätzen. Deshalb: Spalte NULL-fähig, NULL = „ohne ID" (DEC-055).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d5f7a2e903'
down_revision: Union[str, None] = 'e4c7a15b8d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """`tools.tool_id` NULL-fähig machen (Batch-Modus für SQLite)."""
    with op.batch_alter_table('tools') as batch_op:
        batch_op.alter_column(
            'tool_id',
            existing_type=sa.String(length=50),
            nullable=True,
        )


def downgrade() -> None:
    """Rückgängig machen: ID wieder Pflicht.

    Achtung: Datensätze ohne ID müssen vorher gelöscht oder mit einer ID
    versehen werden – sonst scheitert die Umstellung an NOT NULL.
    """
    with op.batch_alter_table('tools') as batch_op:
        batch_op.alter_column(
            'tool_id',
            existing_type=sa.String(length=50),
            nullable=False,
        )
