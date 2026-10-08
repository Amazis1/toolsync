"""Favoriten-Markierung am Werkzeug ergänzen (global, nicht pro Benutzer)

Revision ID: e4c7a15b8d20
Revises: d1a4f6b2c9e3
Create Date: 2026-08-16 12:00:00.000000

Die Markierung gilt für alle Benutzer gemeinsam: sie beschreibt das Werkzeug
(„das brauchen wir ständig"), nicht das Konto. Deshalb eine Spalte an `tools`
statt einer Zuordnungstabelle mit `user_id`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4c7a15b8d20'
down_revision: Union[str, None] = 'd1a4f6b2c9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Spalte `is_favorite` an `tools` ergänzen (Batch-Modus für SQLite).

    `server_default=false()` sorgt dafür, dass bestehende Zeilen einen Wert
    bekommen — ohne Default bliebe die Spalte in SQLite/Postgres für alte
    Datensätze NULL und würde bei `not null` abgelehnt.

    Zusätzlich ein Index auf `tool_id`: die Werkzeug-ID ist die Standardsuche
    und die Standardsortierung der Liste.
    """
    with op.batch_alter_table('tools') as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_favorite',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
    op.create_index('ix_tools_tool_id', 'tools', ['tool_id'], unique=False)


def downgrade() -> None:
    """Rückgängig machen: Index und Spalte wieder entfernen."""
    op.drop_index('ix_tools_tool_id', table_name='tools')
    with op.batch_alter_table('tools') as batch_op:
        batch_op.drop_column('is_favorite')
