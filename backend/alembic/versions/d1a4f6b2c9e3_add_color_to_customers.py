"""Add color to customers

Revision ID: d1a4f6b2c9e3
Revises: c7d9e2f3a1b8
Create Date: 2026-08-16 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1a4f6b2c9e3'
down_revision: Union[str, None] = 'c7d9e2f3a1b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Optionale Kundenfarbe (Hex-Code, #RRGGBB) am Kunden ergänzen.

    Batch-Modus für SQLite/Postgres-Kompatibilität.
    """
    with op.batch_alter_table('customers') as batch_op:
        batch_op.add_column(sa.Column('color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    """Rückgängig machen: die Farbe wieder entfernen."""
    with op.batch_alter_table('customers') as batch_op:
        batch_op.drop_column('color')