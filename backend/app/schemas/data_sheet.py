from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .master_data import MachineRead, PlantRead


class DataSheetBase(BaseModel):
    """Angaben, über die ein Datenblatt gefunden wird (DEC-065).

    Pflicht ist nur das **Werk**; Werkzeug-ID, Maschine, Name und Beschreibung
    sind freiwillig. Es gibt **keine** Artikelnummer und **keinen** Kunden –
    Einstellwerte gelten für Werkzeug und Maschine, nicht für einen Auftraggeber.
    """

    # Die Werkzeug-ID als Text, nicht als Fremdschlüssel (DEC-052/055).
    tool_id: Optional[str] = None
    plant_id: int
    machine_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None

    @field_validator("tool_id")
    @classmethod
    def _clean_tool_id(cls, value: Optional[str]) -> Optional[str]:
        """Leerraum abschneiden; leer bedeutet „ohne Werkzeug-ID" (nicht "").

        Anders als die Artikelnummer des Serienartikels ist die Werkzeug-ID
        **kein** Pflichtfeld: Abstreifer und Matrize dürfen laut DEC-055 ohne ID
        existieren, ein Datenblatt für sie muss trotzdem möglich sein.
        """
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("name", "description")
    @classmethod
    def _clean_optional_text(cls, value: Optional[str]) -> Optional[str]:
        """Leere Felder bedeuten „nicht gepflegt" (None), nicht ""."""
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class DataSheetCreate(DataSheetBase):
    pass


class DataSheetUpdate(DataSheetBase):
    """Vollständige Änderung eines Datenblatts (Werte kommen aus dem Formular)."""


class DataSheetFileRead(BaseModel):
    """Eine Datei im Ordner des Datensatzes.

    `plan` = Datenblatt (`plan.pdf`, `plan-2.pdf` …), `image` = Bild
    (`bild-1.jpg` …). Beide liegen im selben Ordner; es gibt bewusst keine
    eigenen Datenbankspalten dafür.
    """

    name: str
    size: int
    kind: Literal["plan", "image"] = "plan"


class DataSheetRead(DataSheetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # `pdf_path` bleibt intern; die Oberfläche arbeitet mit `has_pdf` und der
    # Dateiliste `plans` – wie beim Serienartikel (DEC-062).
    has_pdf: bool = False
    # GLOBALER Favorit (nicht pro Benutzer), gesetzt über `PUT /{id}/favorite`.
    is_favorite: bool = False
    # Datenblätter (`plan.pdf`, `plan-2.pdf` …), nach Nummer sortiert.
    plans: List[DataSheetFileRead] = Field(default_factory=list)
    # Bilder zum Datenblatt (`bild-1.jpg` …), nach der Zahl im Namen sortiert.
    images: List[DataSheetFileRead] = Field(default_factory=list)
    # Für die Listenansicht mitgelieferte Stammdaten (Werk ist Pflicht).
    plant: Optional[PlantRead] = None
    machine: Optional[MachineRead] = None

    class Config:
        from_attributes = True


class DataSheetPage(BaseModel):
    """Antwort der Liste: Seitendaten plus Gesamtzahl (`total`)."""

    items: List[DataSheetRead]
    total: int
    skip: int
    limit: int


class DataSheetFavoriteUpdate(BaseModel):
    """Favoriten-Markierung setzen (global für alle Benutzer, DEC-063)."""

    is_favorite: bool


class DataSheetToolIdCheck(BaseModel):
    """Antwort der Live-Prüfung „gibt es zu dieser Werkzeug-ID schon ein Datenblatt?".

    Anders als beim Serienartikel ist eine Mehrfachbelegung **kein** Fehler: es
    kann mehrere Datenblätter zu einer Werkzeug-ID geben (andere Maschine, andere
    Auflage). Deshalb gibt es hier kein `available`, nur einen Hinweis.
    """

    existing_count: int
    message: str
