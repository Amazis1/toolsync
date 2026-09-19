from sqlalchemy import ForeignKey, String, Enum as SQLAlchemyEnum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import MovementType, MovementStatus


class ToolMovement(Base):
    __tablename__ = "tool_movements"
    id: Mapped[int] = mapped_column(primary_key=True)
    movement_type: Mapped[MovementType] = mapped_column(
        SQLAlchemyEnum(MovementType, native_enum=False, length=20), nullable=False
    )
    from_location: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_location: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[MovementStatus] = mapped_column(
        SQLAlchemyEnum(MovementStatus, native_enum=False, length=20),
        nullable=False,
        default=MovementStatus.OPEN,
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    timestamp: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    tool_id: Mapped[int] = mapped_column(
        ForeignKey("tools.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    tool: Mapped["Tool"] = relationship(back_populates="movements")
    user: Mapped["User | None"] = relationship(back_populates="movements")

    @property
    def tool_code(self) -> str | None:
        """Lesbare Werkzeug-ID (z. B. \"1075000\") für den Verlauf."""
        return self.tool.tool_id if self.tool else None

    @property
    def tool_description(self) -> str | None:
        """Kurzbeschreibung des Werkzeugs für den Verlauf."""
        return self.tool.description if self.tool else None

    @property
    def user_display_name(self) -> str | None:
        """Vorname + Nachname des ausführenden Benutzers."""
        if not self.user:
            return None
        first = self.user.first_name or ""
        last = self.user.last_name or ""
        return f"{first} {last}".strip() or None
