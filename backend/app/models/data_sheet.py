from sqlalchemy import ForeignKey, String, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, AuditMixin
from .master_data import Machine, Plant  # noqa: F401  (Beziehungen)


class DataSheet(Base, AuditMixin):
    """Datenblatt – die Einstellwerte eines **Werkzeugs** für eine **Maschine** (DEC-065).

    Abgrenzung zum Serienartikel (`SerialArticle`), der genauso ein PDF ist:

    | | Serienartikel | Datenblatt |
    |---|---|---|
    | Beantwortet | **was** braucht der Auftrag | **wie** wird das Werkzeug eingerichtet |
    | Kennung | Artikelnummer (eindeutig) | **Werkzeug-ID** (empfohlen, nicht Pflicht) |
    | Zuordnung | Werk, Kunde, Maschine | Werk (**freiwillig**, DEC-085), Maschine |
    | Fachbereich | `docs/06-serial-articles.md` | `docs/20-datenblatt.md` |

    Wichtig – **keine** Fremdschlüsselbindung an `tools.id`: eine Werkzeug-ID darf
    laut DEC-052 mehrfach existieren (mehrere Exemplare) und laut DEC-055 leer
    sein. Ein Datenblatt gilt für die **ID**, also für alle Exemplare; wird ein
    Werkzeug gelöscht, bleibt das Dokument auffindbar.
    """

    __tablename__ = "data_sheets"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Die Werkzeug-ID als **Text** – empfohlen, aber nicht Pflicht (DEC-055:
    # Abstreifer und Matrize dürfen ohne ID existieren) und nicht eindeutig
    # (DEC-052: mehrere Exemplare derselben ID).
    tool_id: Mapped[str | None] = mapped_column(String(50), index=True, nullable=True)

    # Werk ist **freiwillig** (DEC-085): Ohne Werk gilt das Datenblatt für **alle**
    # Werke – eine allgemeine Info (Bedienungsanleitung, Prozesshinweis) gehört
    # keinem Werk allein. Mit Werk ist es der bisherige Fall.
    plant_id: Mapped[int | None] = mapped_column(
        ForeignKey("plants.id", ondelete="RESTRICT"), nullable=True
    )
    # Die Maschine, für die die Einstellwerte gelten (freiwillig).
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True
    )

    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relativer Pfad innerhalb der Ablage, z. B.
    # "uploads/data_sheets/7/plan.pdf". Der Ordner ist nach der **Datensatz-ID**
    # benannt: die Werkzeug-ID ist weder eindeutig noch Pflicht und taugt
    # deshalb nicht als Ordnername (docs/20-datenblatt.md §6).
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Favorit wie in der Werkzeug- und Serienartikel-Liste: **global**, nicht pro
    # Benutzer (DEC-063). Die Spalte kommt bewusst sofort mit, damit für die
    # Listenoptik später keine zweite Migration nötig ist (DEC-065 Punkt 11).
    is_favorite: Mapped[bool] = mapped_column(
        nullable=False, default=False, server_default=false()
    )

    # joined eager loading: Werk und Maschine stehen als Spalten in der Liste.
    plant: Mapped[Plant] = relationship(lazy="joined")
    machine: Mapped[Machine | None] = relationship(lazy="joined")

    @property
    def has_pdf(self) -> bool:
        """Ist ein Datenblatt hinterlegt? (Der Pfad bleibt intern.)"""
        return bool(self.pdf_path)

    def __repr__(self) -> str:
        return f"<DataSheet(id={self.id}, tool_id={self.tool_id})>"
