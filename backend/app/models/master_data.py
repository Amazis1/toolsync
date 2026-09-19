from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, AuditMixin


class Plant(Base, AuditMixin):
    __tablename__ = "plants"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    machines: Mapped[list["Machine"]] = relationship(back_populates="plant")
    cabinets: Mapped[list["Cabinet"]] = relationship(back_populates="plant")
    tools: Mapped[list["Tool"]] = relationship(back_populates="plant")


class Customer(Base, AuditMixin):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Optionale Kundenfarbe als Hex-Code, z. B. "#0f766e" (String(7) = #RRGGBB)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)


class Machine(Base, AuditMixin):
    __tablename__ = "machines"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plants.id", ondelete="SET NULL"), nullable=True
    )
    plant: Mapped["Plant | None"] = relationship(back_populates="machines")
    tools: Mapped[list["Tool"]] = relationship(back_populates="machine")


class ToolType(Base, AuditMixin):
    __tablename__ = "tool_types"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    tools: Mapped[list["Tool"]] = relationship(back_populates="tool_type")
