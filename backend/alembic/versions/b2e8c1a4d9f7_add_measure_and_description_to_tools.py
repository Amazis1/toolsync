"""Add measure_a, measure_b, description to tools

Revision ID: b2e8c1a4d9f7
Revises: f5b7b5192461
Create Date: 2026-08-15 02:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2e8c1a4d9f7'
down_revision: Union[str, None] = 'f5b7b5192461'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Maß A, Maß B und Beschreibung am Werkzeug ergänzen (TASK-005)."""
    op.add_column('tools', sa.Column('measure_a', sa.String(length=20), nullable=True))
    op.add_column('tools', sa.Column('measure_b', sa.String(length=20), nullable=True))
    op.add_column('tools', sa.Column('description', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Rückgängig machen: die drei Spalten wieder entfernen."""
    op.drop_column('tools', 'description')
    op.drop_column('tools', 'measure_b')
    op.drop_column('tools', 'measure_a')
