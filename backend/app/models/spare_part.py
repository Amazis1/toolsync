from sqlalchemy import ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, AuditMixin
from .master_data import Machine, Plant  # noqa: F401  (Beziehungen)
from .storage import Position  # noqa: F401  (Beziehung Position ↔ Ersatzteil)


class SparePart(Base, AuditMixin):
    """Ersatzteil im eigenen Bereich „Ersatzteile" (DEC-064).

    Fachlicher Hintergrund – die Abgrenzung zum Werkzeug:

    - **Ersatzwerkzeug** (Ersatzstempel, Ersatzmatrize) ist ein `Tool` mit
      `is_storage = True` und steht in der Werkzeugliste (DEC-052, unverändert).
    - **Ersatzteil** (Dichtung, Sensor, Normteil) ist dieser Datensatz: es hat
      **keine** Werkzeug-ID, sondern eine **Artikelnummer** als Identität, keinen
      Status, keine Ausleihe und keinen Matrix-Platz.

    Diese Tabelle löst `storage_items` ab (`docs/07-stock-replacement.md`,
    `docs/13-decisions.md` → DEC-064). Gründe für die Neuanlage statt einer
    Erweiterung: `storage_items` verlangte eine `storage_id`, die es fachlich
    nicht gibt, hatte FK-lose Verweise auf Stammdaten und besaß keine
    Alembic-Revision.
    """

    __tablename__ = "spare_parts"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Identität des Teils. Sie darf **mehrfach** vorkommen (mehrere Lagerorte,
    # mehrere Chargen) – das ist bei Ersatzteilen der Normalfall, deshalb gibt es
    # bewusst kein `allow_duplicate_id` (DEC-064 Punkt 8).
    article_number: Mapped[str] = mapped_column(
        String(100), index=True, nullable=False
    )

    # Bezeichnung und Art des Teils (freiwillig).
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Werk ist **Pflicht**: ohne Werk ist nicht bestimmbar, in welchem Werk ein
    # Teil an welchem Platz liegt (DEC-064 Punkt 5). Ein gelöschtes Werk mit
    # Ersatzteilen wird durch RESTRICT blockiert.
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="RESTRICT"), nullable=False
    )

    # Mengenbestand als **Spalte** (Anforderung 8): eine Zeile je Artikel und
    # Lagerort, nicht eine Zeile je Stück. Ersatzteile sind nicht ausleihbar –
    # die Begründung „eine Zeile je Exemplar" (DEC-052) gilt nur für Werkzeuge.
    # `quantity = 0` bedeutet „aufgebraucht" und ist ausdrücklich erlaubt.
    quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Maschine, zu der das Teil gehört (freiwillig) – wie beim Serienartikel.
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True
    )

    # Lagerort als **Freitext** (z. B. „Regal B3 / Fach 2"). Der Freitext bleibt
    # erhalten – zusätzlich kann ein **konkreter Platz aus der Werkzeug-Matrix**
    # gewählt werden (unten). Beides ist freiwillig und unabhängig.
    storage_place: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Konkreter Platz aus der Werkzeug-Matrix. Der Platz gilt damit als **belegt**:
    # die Matrix zeigt das Ersatzteil, Werkzeuge können dort nicht mehr abgelegt
    # werden, und der Platz ist für andere Ersatzteile gesperrt (Anforderung 7.2).
    # `SET NULL`: wird die Lagerstruktur gelöscht, verliert das Teil nur den Platz
    # (wie das Werkzeug, DEC-050) – der Datensatz bleibt bestehen.
    position_id: Mapped[int | None] = mapped_column(
        ForeignKey("positions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    position: Mapped["Position | None"] = relationship(
        "Position", back_populates="spare_part"
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # joined eager loading: Werk und Maschine stehen als Spalten in der Liste.
    # Beides sind n:1-Beziehungen – es entstehen keine doppelten Zeilen, aber
    # ohne das käme pro Listenzeile eine eigene Abfrage dazu.
    plant: Mapped[Plant] = relationship(lazy="joined")
    machine: Mapped[Machine | None] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"<SparePart(id={self.id}, article_number={self.article_number})>"
