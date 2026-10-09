from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from .master_data import MachineRead, PlantRead


class SparePartBase(BaseModel):
    """Angaben eines Ersatzteils (DEC-064).

    Pflicht sind **Artikelnummer** und **Werk**; alles andere ist freiwillig.
    Es gibt bewusst **keine** Werkzeug-ID, keinen Status und kein
    `allow_duplicate_id`: bei Ersatzteilen ist „dieselbe Nummer mehrfach" der
    Normalfall (mehrere Lagerorte, mehrere Chargen).
    """

    article_number: str
    name: Optional[str] = None
    type: Optional[str] = None
    plant_id: int
    # Mengenbestand (Anforderung 8). 0 = aufgebraucht; negativ ist unsinnig.
    quantity: int = Field(default=1, ge=0)
    unit: Optional[str] = None
    machine_id: Optional[int] = None
    storage_place: Optional[str] = None
    # Konkreter Platz aus der Werkzeug-Matrix (freiwillig, **zusätzlich** zum
    # Freitext). Der Platz gilt dann als belegt (DEC-064, Nachtrag).
    position_id: Optional[int] = None
    description: Optional[str] = None

    @field_validator("article_number")
    @classmethod
    def _clean_article_number(cls, value: str) -> str:
        """Leerraum abschneiden; eine leere Nummer ist keine Nummer.

        Die Artikelnummer ist die Identität des Teils – ein Feld mit Leerzeichen
        wäre eine gepflegte Nummer, die niemand findet.
        """
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Bitte eine Artikelnummer angeben.")
        return cleaned

    @field_validator("name", "type", "unit", "storage_place", "description")
    @classmethod
    def _clean_optional_text(cls, value: Optional[str]) -> Optional[str]:
        """Leere Felder bedeuten „nicht gepflegt" (None), nicht ""."""
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("quantity", mode="before")
    @classmethod
    def _reject_negative_quantity(cls, value):
        """Auch aus einem Formularfeld (Text) eine gültige Menge machen.

        Ohne diesen Schritt käme bei „-5" erst der Pydantic-Fehler `ge=0` – die
        Meldung soll aber in der Sprache der Oberfläche stehen.
        """
        if value is None or value == "":
            return 1
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned == "":
                return 1
            try:
                value = int(cleaned)
            except ValueError:
                raise ValueError("Die Menge muss eine ganze Zahl sein.")
        if value < 0:
            raise ValueError("Die Menge darf nicht negativ sein.")
        return value


class SparePartCreate(SparePartBase):
    pass


class SparePartUpdate(SparePartBase):
    """Vollständige Änderung eines Ersatzteils (Werte kommen aus dem Formular)."""


class SparePartRead(SparePartBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Platz-Code wie „01-A-25" (Schrank, Schublade, Platzname) für die Anzeige.
    # `None` = kein Matrix-Platz gewählt (nur Freitext oder gar nichts).
    position_code: Optional[str] = None
    # GLOBALER Favorit (nicht pro Benutzer, DEC-063). Bewusst **nur** hier und
    # nicht in `SparePartBase`: gesetzt wird er ausschliesslich ueber
    # `PUT /{id}/favorite`, damit ein normales Bearbeiten (PUT /{id}) die
    # Markierung nicht zuruecksetzt.
    is_favorite: bool = False
    # Für die Listenansicht mitgelieferte Stammdaten (Werk ist Pflicht).
    plant: Optional[PlantRead] = None
    machine: Optional[MachineRead] = None

    class Config:
        from_attributes = True


class SparePartFavoriteUpdate(BaseModel):
    """Favoriten-Markierung setzen (global für alle Benutzer, DEC-063)."""

    is_favorite: bool


class SparePartPage(BaseModel):
    """Antwort der Liste: Seitendaten plus Gesamtzahl (`total`).

    Ohne `total` gäbe es keine Blätterleiste und keinen Satz „1–25 von 133".
    """

    items: List[SparePartRead]
    total: int
    skip: int
    limit: int
