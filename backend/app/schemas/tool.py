from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import List, Optional
from ..models.enums import ToolCategory, ToolStatus
from .master_data import CoatingRead, CustomerRead, MachineRead, PlantRead, ToolTypeRead


# ============================================================
# Tool
# ============================================================
class ToolBase(BaseModel):
    # Freiwillig: Stempel brauchen die ID, Abstreifer und Matrize nicht
    # (DEC-055). Die Pflicht für Stempel prüft der Service – dort gilt die
    # Regel für Anlegen UND Bearbeiten an einer Stelle.
    tool_id: Optional[str] = None
    category: ToolCategory
    status: Optional[ToolStatus] = None
    is_storage: bool = False
    allow_duplicate_id: bool = False
    measure_a: Optional[str] = None
    measure_b: Optional[str] = None
    description: Optional[str] = None
    plant_id: int
    tool_type_id: int
    # Beschichtung des Stempels (Stammdaten „Stempel-Beschichtung"). Freiwillig;
    # None = keine Beschichtung eingetragen. Gilt fachlich nur für Stempel –
    # die Auswahl dafür ist im Formular an die Kategorie gebunden.
    coating_id: Optional[int] = None
    position_id: Optional[int] = None
    machine_id: Optional[int] = None
    customer_id: Optional[int] = None

    @field_validator("tool_id")
    @classmethod
    def _normalize_tool_id(cls, value: Optional[str]) -> Optional[str]:
        """Leerraum abschneiden; ein leeres Feld bedeutet „ohne ID" (None).

        Ohne diese Umwandlung käme aus dem Formular ein leerer String an: er
        gälte als gepflegte ID und alle ID-losen Werkzeuge stünden als
        Dublette zueinander.
        """
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ToolCreate(ToolBase):
    pass


class ToolUpdate(ToolBase):
    pass


class ToolRead(ToolBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # GLOBALER Favorit (nicht pro Benutzer). Bewusst nur in ToolRead und nicht
    # in ToolBase: gesetzt wird er ausschließlich über PUT /{id}/favorite, damit
    # ein normales Bearbeiten (PUT /{id}) die Markierung nicht zurücksetzt.
    is_favorite: bool = False
    # Lagerplatz-Code wie "01-A-25"; None bedeutet Ablage (kein fester Platz).
    position_code: Optional[str] = None
    # Aktueller Ort (DEC-071): NULL = am Heimatwerk. Die Logistik arbeitet damit,
    # die Liste zeigt bei Abweichung „Heimat W1 · aktuell W2".
    current_plant_id: Optional[int] = None
    current_plant: Optional[PlantRead] = None
    # Gibt es zu **dieser Werkzeug-ID** ein Datenblatt mit hinterlegter Datei?
    # (DEC-065 Punkt 10 / DEC-068) Die Werkzeugliste zeigt dafür ein Symbol neben
    # dem Aktionsmenü; ohne Datenblatt bleibt der Platz leer. Geprüft wird die
    # **Datei im Ordner**, nicht nur die Spalte `pdf_path` – sonst führte das
    # Symbol ins Leere. Die Suche läuft in einer Abfrage für die ganze Seite
    # (`ToolService._tool_ids_with_data_sheet`).
    has_data_sheet: bool = False
    # Für die Listenansicht direkt mitgelieferte Beziehungen
    plant: Optional[PlantRead] = None
    tool_type: Optional[ToolTypeRead] = None
    # Beschichtung samt Name („MultiDur TiCN"), damit die Oberfläche den Namen
    # nicht aus einer zweiten Liste nachschlagen muss.
    coating: Optional[CoatingRead] = None
    customer: Optional[CustomerRead] = None
    machine: Optional[MachineRead] = None

    class Config:
        from_attributes = True


class ToolFavoriteUpdate(BaseModel):
    """Favoriten-Markierung setzen (global für alle Benutzer)."""

    is_favorite: bool


class ToolPage(BaseModel):
    """Antwort der Werkzeugliste: Seitendaten plus Gesamtzahl.

    Ohne `total` ließe sich keine Pagination bauen — der Benutzer wüsste nicht,
    wie viele Seiten es gibt, und die Oberfläche könnte nicht „1–25 von 342"
    anzeigen.
    """

    items: List[ToolRead]
    total: int
    skip: int
    limit: int
