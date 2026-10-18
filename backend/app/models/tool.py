from sqlalchemy import ForeignKey, String, false, Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, AuditMixin
from .enums import ToolCategory, ToolStatus
# Für die Typprüfung (lazy="selectin" lädt zur Laufzeit trotzdem erst bei Zugriff).
from .master_data import Plant, Coating  # noqa: F401  (Modell-Registrierung, zyklische Auflösung)


class Tool(Base, AuditMixin):
    __tablename__ = "tools"
    id: Mapped[int] = mapped_column(primary_key=True)
    # Fachliche Werkzeug-ID. Bei Stempeln ist sie Pflicht (sie kommt aus SAP
    # und ist eingraviert); Abstreifer und Matrize werden über ihr Maß geführt
    # und dürfen ohne ID angelegt werden – NULL heißt „ohne ID" (DEC-055).
    tool_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
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
    # Favorit ist bewusst GLOBAL und nicht pro Benutzer: die Markierung
    # beschreibt das Werkzeug („das brauchen wir ständig"), nicht das Konto.
    # In der Werkstatt arbeiten mehrere Personen an denselben Geräten.
    is_favorite: Mapped[bool] = mapped_column(
        nullable=False, default=False, server_default=false()
    )
    # Heimatwerk: wem das Werkzeug gehört. Die Werkzeug-ID ist je Heimatwerk
    # eindeutig (DEC-052/055) – zwei Werke dürfen dieselbe ID führen. Dieses Feld
    # ändert die Logistik **nicht** (DEC-071).
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="RESTRICT"), nullable=False
    )
    # Aktueller Ort (DEC-071): NULL = das Werkzeug liegt in seinem Heimatwerk.
    # Geschrieben ausschließlich vom bestätigten Empfang eines Transports.
    current_plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plants.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tool_type_id: Mapped[int] = mapped_column(
        ForeignKey("tool_types.id", ondelete="RESTRICT"), nullable=False
    )
    # Beschichtung des Stempels (Stammdaten „Stempel-Beschichtung", Dachmarke
    # MultiDur). Freiwillig und nur für die Kategorie Stempel gedacht; das
    # Formular blendet das Feld für Abstreifer und Matrize aus. `SET NULL`, damit
    # das Löschen einer Beschichtung keinen Stempel mitnimmt.
    coating_id: Mapped[int | None] = mapped_column(
        ForeignKey("coatings.id", ondelete="SET NULL"), nullable=True
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
    plant: Mapped["Plant"] = relationship(
        back_populates="tools", lazy="joined", foreign_keys=[plant_id]
    )
    # Aktueller Ort – nur geladen, wenn ihn jemand braucht (Anzeige „Heimat W1 · aktuell W2")
    current_plant: Mapped["Plant | None"] = relationship(
        foreign_keys=[current_plant_id], lazy="selectin"
    )
    tool_type: Mapped["ToolType"] = relationship(back_populates="tools", lazy="joined")
    # joined eager loading wie bei Werkzeugtyp und Kunde: die Liste bekommt den
    # Beschichtungsnamen ohne Nachfrage je Zeile.
    coating: Mapped["Coating | None"] = relationship(
        back_populates="tools", lazy="joined"
    )
    machine: Mapped["Machine | None"] = relationship(
        back_populates="tools", lazy="joined"
    )
    # joined eager loading: customer wird in der Listenansicht direkt mitgeliefert (Farbe)
    customer: Mapped["Customer | None"] = relationship(lazy="joined")
    movements: Mapped[list["ToolMovement"]] = relationship(
        back_populates="tool", cascade="all, delete-orphan"
    )
