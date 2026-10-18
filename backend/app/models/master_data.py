from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, AuditMixin


class Plant(Base, AuditMixin):
    __tablename__ = "plants"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Werkfarbe als Hex-Code (DEC-076). Dieselbe Idee wie `Customer.color` und
    # `Machine.color`: Die Farbe des Arbeitswerks färbt Knöpfe, aktiven Reiter und
    # Tabellenzeilen – beim Werkswechsel weiß man sofort, in welchem Werk man ist.
    # Ohne Farbe gilt die Primärfarbe `#0f766e`; pflegbar im Admin-Panel.
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    machines: Mapped[list["Machine"]] = relationship(back_populates="plant")
    cabinets: Mapped[list["Cabinet"]] = relationship(back_populates="plant")
    # `tools` hat seit DEC-071 zwei Fremdschlüssel auf plants (Heimatwerk und
    # aktueller Ort) – deshalb muss das Heimatwerk hier ausdrücklich genannt werden.
    tools: Mapped[list["Tool"]] = relationship(
        back_populates="plant", foreign_keys="Tool.plant_id"
    )


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
    # Optionale Maschinenfarbe als Hex-Code, z. B. "#0f766e" (String(7) = #RRGGBB).
    # Dieselbe Idee wie `Customer.color`: die Liste zeigt den Farbpunkt aus den
    # Stammdaten, damit Maschinen auf einen Blick unterscheidbar sind.
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
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


class Coating(Base, AuditMixin):
    """Stempel-Beschichtung – gepflegt im Admin-Panel (Stammdaten).

    Die Beschichtungen laufen unter der **Dachmarke MultiDur**; gepflegt wird
    jeweils der vollständige Name („MultiDur TiCN"). Bewusst nur ein Name und
    keine Marken-Tabelle: solange es **eine** Dachmarke gibt, wäre eine zweite
    Ebene eine leere Spalte in jeder Zeile. „Standard" steht für den Stempel
    ohne besondere Beschichtung – der ist im Anlege-Formular vorausgewählt.
    """

    __tablename__ = "coatings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    tools: Mapped[list["Tool"]] = relationship(back_populates="coating")
