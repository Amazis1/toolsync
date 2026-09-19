"""Pydantic-Schemata für die Lagerplatz-Verwaltung (Schrank/Schublade/Platz)."""

from pydantic import BaseModel
from datetime import datetime
from typing import Literal, Optional

from ..models.enums import ToolStatus


class CabinetBase(BaseModel):
    name: str
    plant_id: int


class CabinetCreate(CabinetBase):
    pass


class CabinetUpdate(CabinetBase):
    pass


class CabinetRead(CabinetBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DrawerBase(BaseModel):
    name: str  # Buchstabe z. B. "A"
    cols: int = 5  # Anzahl X
    rows: int = 2  # Anzahl Y
    cabinet_id: int


class DrawerCreate(DrawerBase):
    pass


class DrawerUpdate(DrawerBase):
    pass


class DrawerRead(DrawerBase):
    id: int
    positions: list["PositionRead"] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Tool-Light-Infos für Positionen (Anzeige: Werkzeug-ID + Tooltip + Status)
class ToolLiteRead(BaseModel):
    id: int
    tool_id: str
    description: Optional[str] = None
    status: Optional[ToolStatus] = None

    class Config:
        from_attributes = True


class PositionBase(BaseModel):
    name: str  # Platznummer z. B. "01"
    x: int = 1
    y: int = 1
    drawer_id: int
    tool_id: Optional[int] = None


class PositionCreate(PositionBase):
    pass


# Neue Schubladen-Logik: move, swap oder insert_at.
MoveAction = Literal["move", "swap", "insert_at"]


class PositionMoveRequest(BaseModel):
    source_position_id: int
    target_position_id: int
    action: MoveAction


class PlaceToolRequest(BaseModel):
    """Ablage-Werkzeug auf einen Platz legen/einreihen."""

    tool_id: int
    target_position_id: int


class ReleaseToolRequest(BaseModel):
    """Belegten Platz freigeben, Werkzeug wandert in die Ablage."""

    position_id: int


class PositionRead(PositionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Tool-Infos für die Anzeige (Platz zeigt Werkzeug-ID + Tooltip mit Beschreibung)
    tool: Optional[ToolLiteRead] = None

    class Config:
        from_attributes = True


# Forward-Referenz für DrawerRead
DrawerRead.model_rebuild()
