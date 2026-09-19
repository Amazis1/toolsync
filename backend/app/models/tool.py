from sqlalchemy import ForeignKey, String, Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, AuditMixin
from .enums import ToolCategory, ToolStatus


class Tool(Base, AuditMixin):
    __tablename__ = "tools"
    id: Mapped[int] = mapped_column(primary_key=True)
    tool_id: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[ToolCategory] = mapped_column(
        SQLAlchemyEnum(ToolCategory, native_enum=False, length=20), nullable=False
    )
    status: Mapped[ToolStatus | None] = mapped_column(
        SQLAlchemyEnum(ToolStatus, native_enum=False, length=20), nullable=True
    )
    is_storage: Mapped[bool] = mapped_column(nullable=False, default=False)
    allow_duplicate_id: Mapped[bool] = mapped_column(nullable=False, default=False)
    measure_a: Mapped[str | None] = mapped_column(String(20), nullable=True)
    measure_b: Mapped[str | None] = mapped_column(String(20), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="RESTRICT"), nullable=False
    )
    tool_type_id: Mapped[int] = mapped_column(
        ForeignKey("tool_types.id", ondelete="RESTRICT"), nullable=False
    )
    position_id: Mapped[int | None] = mapped_column(
        ForeignKey("positions.id", ondelete="SET NULL"), nullable=True
    )
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    # joined eager loading: plant/tool_type immer direkt mitladen (benötigt für Listenansicht)
    plant: Mapped["Plant"] = relationship(back_populates="tools", lazy="joined")
    tool_type: Mapped["ToolType"] = relationship(back_populates="tools", lazy="joined")
    machine: Mapped["Machine | None"] = relationship(back_populates="tools")
    # joined eager loading: customer wird in der Listenansicht direkt mitgeliefert (Farbe)
    customer: Mapped["Customer | None"] = relationship(lazy="joined")
    movements: Mapped[list["ToolMovement"]] = relationship(
        back_populates="tool", cascade="all, delete-orphan"
    )
