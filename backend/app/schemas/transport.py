"""Schemas der Werkzeug-Logistik (DEC-072).

Ein Auftrag besteht aus **Kopf** (Nummer, Werke, Info) und **Zeilen** (Werkzeuge).
Der Empfang wird je Zeile bestätigt – deshalb trägt jede Zeile ihre eigenen
Empfangsdaten (`received_at`, `received_by`, `received_plant`).
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from ..models.enums import TransportStatus
from .master_data import PlantRead


# ============================================================
# Anlegen / Bearbeiten
# ============================================================
class TransportItemCreate(BaseModel):
    """Ein Werkzeug im Auftrag – nur die interne Werkzeug-ID."""

    tool_id: int
    note: Optional[str] = None


class TransportOrderCreate(BaseModel):
    order_number: str = Field(min_length=1, max_length=50)
    reference: Optional[str] = Field(default=None, max_length=100)
    to_plant_id: int
    info: Optional[str] = None
    items: List[TransportItemCreate] = Field(default_factory=list)

    @field_validator("order_number")
    @classmethod
    def _nummer_trimmen(cls, wert: str) -> str:
        sauber = wert.strip()
        if not sauber:
            raise ValueError("Die Auftrags-Nr. darf nicht leer sein.")
        return sauber


class TransportReceiveRequest(BaseModel):
    """Empfang bestätigen. Ohne `item_ids` gilt der Empfang **allen** offenen Zeilen."""

    item_ids: Optional[List[int]] = None
    note: Optional[str] = None


class TransportReturnRequest(BaseModel):
    """Rück-Auftrag anlegen. Ohne `tool_ids` gehen **alle** bereits empfangenen Werkzeuge zurück."""

    tool_ids: Optional[List[int]] = None
    info: Optional[str] = None


# ============================================================
# Lesen
# ============================================================
class TransportItemRead(BaseModel):
    id: int
    tool_id: int
    # Anzeige-Daten des Werkzeugs (über die Beziehung geladen)
    tool_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tool_type: Optional[str] = None
    measure_a: Optional[str] = None
    tool_status: Optional[str] = None
    home_plant: Optional[PlantRead] = None
    home_position_code: Optional[str] = None
    received_at: Optional[datetime] = None
    received_by_name: Optional[str] = None
    received_plant: Optional[PlantRead] = None
    note: Optional[str] = None

    class Config:
        from_attributes = True


class TransportOrderRead(BaseModel):
    id: int
    order_number: str
    reference: Optional[str] = None
    status: TransportStatus
    info: Optional[str] = None
    from_plant: Optional[PlantRead] = None
    to_plant: Optional[PlantRead] = None
    parent_order_id: Optional[int] = None
    created_at: datetime
    created_by_name: Optional[str] = None
    created_plant: Optional[PlantRead] = None
    sent_at: Optional[datetime] = None
    sent_by_name: Optional[str] = None
    closed_at: Optional[datetime] = None
    items: List[TransportItemRead] = Field(default_factory=list)

    # Zählwerte für die Liste (spart Rechnen im Frontend)
    item_count: int = 0
    received_count: int = 0
    # „in" = für das Arbeitswerk eingehend, „out" = ausgehend (DEC-072 Punkt 9)
    direction: Optional[str] = None

    class Config:
        from_attributes = True


class TransportPage(BaseModel):
    items: List[TransportOrderRead]
    total: int


class TransportCandidate(BaseModel):
    """Ein Werkzeug für die Auswahl im Auftragsfenster.

    `blocked` ist **null**, wenn das Werkzeug wählbar ist; sonst der Grund im
    Klartext („an Personalnr. 2277 ausgeliehen", „liegt in Werk 2", …).
    """

    tool_id: int
    tool_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tool_type: Optional[str] = None
    measure_a: Optional[str] = None
    status: Optional[str] = None
    home_plant: Optional[PlantRead] = None
    current_plant: Optional[PlantRead] = None
    home_position_code: Optional[str] = None
    open_order_number: Optional[str] = None
    blocked: Optional[str] = None


class AwayTool(BaseModel):
    """„Wo ist was": nur Werkzeuge, die nicht am Platz liegen (DEC-077)."""

    tool_id: int
    tool_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tool_type: Optional[str] = None
    measure_a: Optional[str] = None
    status: Optional[str] = None
    home_plant: Optional[PlantRead] = None
    home_position_code: Optional[str] = None
    current_plant: Optional[PlantRead] = None
    # „Seit wann" (DEC-093): Zeitpunkt der Ausleihe bzw. des Versands. Damit lässt
    # sich beantworten, was zu lange draußen ist – vorher stand hier nur
    # „ausgeliehen", aber nicht seit wann.
    since: Optional[datetime] = None
    # Bei Ausleihe der Ausleiher, bei Transport der offene Auftrag
    lent_to: Optional[str] = None
    transport_id: Optional[int] = None
    transport_number: Optional[str] = None
    target_plant: Optional[PlantRead] = None


class BorrowedTool(BaseModel):
    """Ein Werkzeug, das **hier** liegt, aber einem anderen Werk gehört (DEC-081).

    Grundlage des Fensters „Werkzeug zurück": Das Werk, das die Werkzeuge hat,
    schickt sie an ihr Heimatwerk zurück – ohne dass jemand den alten Auftrag
    suchen muss.
    """

    tool_id: int
    tool_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tool_type: Optional[str] = None
    measure_a: Optional[str] = None
    status: Optional[str] = None
    # Heimatwerk (dorthin geht es zurück)
    home_plant: Optional[PlantRead] = None
    home_position_code: Optional[str] = None
    # Wann es hier angekommen ist (letzter bestätigter Empfang)
    arrived_at: Optional[datetime] = None
    # Auftrag, mit dem es kam – nur zur Information
    arrived_with: Optional[str] = None
