from sqlalchemy import Boolean, Integer, String, Text

from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, AuditMixin


class StorageItem(Base, AuditMixin):
    """Lager-/Ersatzobjekt im Bereich „Lager/Ersatz“.

    Fachlicher Hintergrund:
    - Task 08.4 spezifiziert StorageItem als eigene Entität mit eigenem
      /api/storage-Backend (Suchleiste, Liste, CRUD, Toggle „doppelte IDs“).
    - docs/14-architecture.md (DEC-035/036/037) sieht Lager-/Ersatzobjekte
      dagegen als Tool mit is_storage=True vor.

    Diese Tabelle folgt der Task-Vorgabe. Ob StorageItem langfristig
    eigenständig bleibt oder in Tool (is_storage=True) aufgeht, ist eine
    offene Architekturfrage – siehe docs/07-stock-replacement.md.
    """

    __tablename__ = "storage_items"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Fachliche Lager-/Ersatz-ID – darf bei allow_duplicate_id mehrfach vorkommen
    storage_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Typ/Kategorie, z. B. „Stempel“, „Abstreifer“, „Matrize“ (freies Feld)
    type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    article_number: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Optionale Referenzen auf Stammdaten (Maschine, Lagerort) – bewusst ohne
    # ForeignKey-Constraint, damit Objekte auch ohne Stammdatensatz existieren.
    machine_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # True = gleiche storage_id darf mehrfach existieren (Mehrfachobjekte)
    allow_duplicate_id: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    def __repr__(self) -> str:
        return f"<StorageItem(id={self.id}, storage_id={self.storage_id})>"
