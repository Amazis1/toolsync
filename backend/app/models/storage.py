from sqlalchemy import ForeignKey, String, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, AuditMixin

class Cabinet(Base, AuditMixin):
    __tablename__ = "cabinets"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), nullable=False)
    plant: Mapped["Plant"] = relationship(back_populates="cabinets")
    drawers: Mapped[list["Drawer"]] = relationship(back_populates="cabinet", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("plant_id", "name"),)

class Drawer(Base, AuditMixin):
    __tablename__ = "drawers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # Buchstabe z. B. "C"
    cols: Mapped[int] = mapped_column(Integer, nullable=False, default=5)  # Breite (X)
    rows: Mapped[int] = mapped_column(Integer, nullable=False, default=2)  # Tiefe (Y)
    cabinet_id: Mapped[int] = mapped_column(ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False)
    cabinet: Mapped["Cabinet"] = relationship(back_populates="drawers")
    positions: Mapped[list["Position"]] = relationship(back_populates="drawer", cascade="all, delete-orphan")
    __table_args__ = (UniqueConstraint("cabinet_id", "name"),)

class Position(Base, AuditMixin):
    __tablename__ = "positions"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)  # Platznummer z. B. "01"
    x: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    y: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    drawer_id: Mapped[int] = mapped_column(ForeignKey("drawers.id", ondelete="CASCADE"), nullable=False)
    drawer: Mapped["Drawer"] = relationship(back_populates="positions")
    tool_id: Mapped[int | None] = mapped_column(ForeignKey("tools.id", ondelete="SET NULL"), nullable=True)
    tool: Mapped["Tool | None"] = relationship(foreign_keys=[tool_id])
    __table_args__ = (UniqueConstraint("drawer_id", "name"),)