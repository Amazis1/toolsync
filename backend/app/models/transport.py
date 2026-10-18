"""Werkzeug-Logistik zwischen Werken (DEC-072).

Ein **Auftrag** ist eine Richtung: von einem Werk zu einem anderen. Der Rückweg ist
ein eigener Auftrag, der über `parent_order_id` auf den Hin-Auftrag zeigt – damit ist
die Spiegelung zwischen den Werken derselbe Vorgang und keine zweite Logik.

Regeln, die dieses Modell trägt:

* **Heimatplatz bleibt** (DEC-071): Ein Transport ändert weder `tools.plant_id` noch
  `tools.position_id`. Der Platz ist reserviert, solange das Werkzeug unterwegs ist.
* **Aktueller Ort** ändert sich erst beim **bestätigten Empfang**
  (`tools.current_plant_id`), nicht beim Verschicken.
* **`home_position_code`** hält den Heimatplatz **zum Versandzeitpunkt** fest – ein
  späterer Umbau der Matrix zerstört damit den Nachweis nicht.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Enum as SQLAlchemyEnum, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, AuditMixin
from .enums import TransportStatus
from .master_data import Plant
from .tool import Tool
from .user import User


class TransportOrder(Base, AuditMixin):
    __tablename__ = "transport_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Freitext (Auftrag/SAP-Nr.), führend in Liste und Suche – keine Validierung
    order_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[TransportStatus] = mapped_column(
        SQLAlchemyEnum(TransportStatus, native_enum=False, length=20),
        nullable=False,
        default=TransportStatus.DRAFT,
    )
    info: Mapped[str | None] = mapped_column(Text, nullable=True)

    from_plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="RESTRICT"), nullable=False
    )
    to_plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="RESTRICT"), nullable=False
    )
    # Rück-Auftrag → Hin-Auftrag (DEC-072 Punkt 1)
    parent_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("transport_orders.id", ondelete="SET NULL"), nullable=True
    )

    # Nachweis: wer hat angelegt/verschickt – und aus welchem Arbeitswerk (DEC-070)
    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plants.id", ondelete="SET NULL"), nullable=True
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    from_plant: Mapped[Plant] = relationship(foreign_keys=[from_plant_id], lazy="joined")
    to_plant: Mapped[Plant] = relationship(foreign_keys=[to_plant_id], lazy="joined")
    created_by: Mapped["User | None"] = relationship(
        foreign_keys=[created_by_id], lazy="joined"
    )
    sent_by: Mapped["User | None"] = relationship(
        foreign_keys=[sent_by_id], lazy="joined"
    )
    # Arbeitswerk, aus dem der Auftrag angelegt wurde (Nachweis, DEC-070)
    created_plant: Mapped[Plant | None] = relationship(
        foreign_keys=[created_plant_id], lazy="joined"
    )
    items: Mapped[list["TransportItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def is_open(self) -> bool:
        return self.status in (
            TransportStatus.DRAFT,
            TransportStatus.SENT,
            TransportStatus.PARTLY_RECEIVED,
        )


class TransportItem(Base, AuditMixin):
    __tablename__ = "transport_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("transport_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_id: Mapped[int] = mapped_column(
        ForeignKey("tools.id", ondelete="RESTRICT"), nullable=False
    )
    # Heimatplatz zum Versandzeitpunkt (Nachweis, DEC-071/072)
    home_position_id: Mapped[int | None] = mapped_column(
        ForeignKey("positions.id", ondelete="SET NULL"), nullable=True
    )
    home_position_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Empfang je Werkzeug (nicht je Auftrag): dann funktioniert auch „eine Kiste fehlt"
    received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    received_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    received_plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plants.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    order: Mapped[TransportOrder] = relationship(back_populates="items")
    tool: Mapped[Tool] = relationship(lazy="joined")
    received_by: Mapped["User | None"] = relationship(
        foreign_keys=[received_by_id], lazy="joined"
    )
    received_plant: Mapped[Plant | None] = relationship(
        foreign_keys=[received_plant_id], lazy="joined"
    )

    @property
    def is_received(self) -> bool:
        return self.received_at is not None
