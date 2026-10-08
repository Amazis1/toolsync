from sqlalchemy import ForeignKey, String, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, AuditMixin
from .master_data import Customer, Machine, Plant  # noqa: F401  (Beziehungen)


class SerialArticle(Base, AuditMixin):
    """PDF-basierter Einrichteplan – ein eigener Fachbereich.

    Serienartikel haben **keine** Beziehung zu Werkzeugen (DEC-056): sie tragen
    ihre eigene Artikelnummer und werden über Werk, Kunde und Maschine gefunden.
    Der Inhalt des Plans (Programmname, Bearbeitungszeit, Hübe, Material,
    Werkzeug-IDs) bleibt im PDF und wird nicht in Spalten zerlegt
    (`docs/01-requirements.md` 6.2/6.3).
    """

    __tablename__ = "serial_articles"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Eigene Nummer des Einrichteplans (z. B. "01075000") – NICHT die
    # Werkzeug-ID. Sie benennt zugleich den Artikelordner (DEC-057).
    article_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    # Kurze Bezeichnung des Plans; die ausführliche Erklärung steht in description.
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relativer Pfad innerhalb der Ablage, z. B.
    # "uploads/serial_articles/01075000/plan.pdf" (DEC-057).
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Favorit ist wie beim Werkzeug bewusst GLOBAL und nicht pro Benutzer: die
    # Markierung beschreibt den Plan („den brauchen wir ständig"), nicht das
    # Konto – in der Werkstatt arbeiten mehrere Personen an denselben Geräten
    # (DEC-063).
    is_favorite: Mapped[bool] = mapped_column(
        nullable=False, default=False, server_default=false()
    )

    # Stammdaten statt Freitext (DEC-056): Werk ist Pflicht, Kunde und Maschine
    # sind freiwillig. Wird ein Kunde oder eine Maschine gelöscht, wird nur das
    # Feld geleert (SET NULL) – der Plan bleibt bestehen.
    plant_id: Mapped[int] = mapped_column(
        ForeignKey("plants.id", ondelete="RESTRICT"), nullable=False
    )
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True
    )

    # joined eager loading: Werk, Kunde und Maschine stehen als Spalten in der
    # Liste. Alles sind n:1-Beziehungen – es entstehen keine doppelten Zeilen,
    # aber ohne das käme pro Listenzeile eine eigene Abfrage dazu.
    plant: Mapped[Plant] = relationship(lazy="joined")
    customer: Mapped[Customer | None] = relationship(lazy="joined")
    machine: Mapped[Machine | None] = relationship(lazy="joined")

    @property
    def has_pdf(self) -> bool:
        """Ist ein Einrichteplan hinterlegt? (Der Pfad bleibt intern.)"""
        return bool(self.pdf_path)

    def __repr__(self) -> str:
        return f"<SerialArticle(id={self.id}, article_number={self.article_number})>"
