from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .master_data import CustomerRead, MachineRead, PlantRead


class SerialArticleBase(BaseModel):
    """Angaben, über die ein Einrichteplan gefunden wird (DEC-056).

    Pflicht sind Artikelnummer und Werk; Name, Kunde, Maschine und Beschreibung
    sind freiwillig. Kunde, Maschine und Werk sind Stammdaten aus dem
    Admin-Bereich – gespeichert wird ihre ID, nicht ein Freitext.
    """

    # Eigene Nummer des Plans (z. B. "01075000"), nicht die Werkzeug-ID.
    article_number: str
    name: Optional[str] = None
    plant_id: int
    customer_id: Optional[int] = None
    machine_id: Optional[int] = None
    description: Optional[str] = None

    @field_validator("article_number")
    @classmethod
    def _clean_article_number(cls, value: str) -> str:
        """Leerraum abschneiden; eine leere Nummer ist keine Nummer.

        Ohne das würde ein Feld mit Leerzeichen als gepflegte Nummer gelten und
        den Artikelordner zu einem unbrauchbaren Namen machen (DEC-057).
        """
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Bitte eine Artikelnummer angeben.")
        return cleaned

    @field_validator("name", "description")
    @classmethod
    def _clean_optional_text(cls, value: Optional[str]) -> Optional[str]:
        """Leere Felder bedeuten „nicht gepflegt" (None), nicht ""."""
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class SerialArticleCreate(SerialArticleBase):
    pass


class SerialArticleUpdate(SerialArticleBase):
    """Vollständige Änderung eines Artikels (Werte kommen aus dem Formular)."""


class ArticleFileRead(BaseModel):
    """Eine Datei im Artikelordner – Einrichteplan oder Bild.

    Dateien liegen im Artikelordner und werden aus dem Ordner gelesen; es gibt
    bewusst keine eigenen Datenbankspalten dafür (DEC-058, DEC-062).
    """

    name: str
    size: int
    kind: Literal["plan", "image"]


class SerialArticleRead(SerialArticleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # `pdf_path` bleibt intern; die Oberfläche arbeitet mit `has_pdf` (= erster
    # Plan vorhanden) und den Dateilisten (DEC-062).
    has_pdf: bool = False
    # GLOBALER Favorit (nicht pro Benutzer) – wie bei den Werkzeugen. Bewusst nur
    # in `SerialArticleRead`: gesetzt wird er über `PUT /{id}/favorite`, damit ein
    # normales Bearbeiten (PUT /{id}) die Markierung nicht zurücksetzt (DEC-063).
    is_favorite: bool = False
    # Einrichtepläne (`plan.pdf`, `plan-2.pdf` …), nach Nummer sortiert.
    plans: List[ArticleFileRead] = Field(default_factory=list)
    # Bilder zum Plan, aus dem Artikelordner gelesen.
    images: List[ArticleFileRead] = Field(default_factory=list)
    # Für die Listenansicht mitgelieferte Stammdaten (Werk ist Pflicht).
    plant: Optional[PlantRead] = None
    customer: Optional[CustomerRead] = None
    machine: Optional[MachineRead] = None

    class Config:
        from_attributes = True


class SerialArticlePage(BaseModel):
    """Antwort der Liste: Seitendaten plus Gesamtzahl.

    Ohne `total` gäbe es keine Blätterleiste und keinen Satz „1–25 von 133" –
    bis 100 Datensätze war das vorher unsichtbar (DEC-056 Punkt 8).
    """

    items: List[SerialArticleRead]
    total: int
    skip: int
    limit: int


class ArticleNumberCheck(BaseModel):
    """Antwort der Live-Prüfung der Artikelnummer im Formular."""

    available: bool
    existing_count: int
    message: str
    # Bei einer Dublette: welcher Datensatz die Nummer belegt (für die Meldung).
    existing_id: Optional[int] = None
    existing_label: Optional[str] = None


class SerialArticleFavoriteUpdate(BaseModel):
    """Favoriten-Markierung setzen (global für alle Benutzer, DEC-063)."""

    is_favorite: bool
