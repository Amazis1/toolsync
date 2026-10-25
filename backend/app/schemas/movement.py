from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from ..models.enums import MovementType, MovementStatus
from .master_data import PlantRead


# ============================================================
# ToolMovement
# ============================================================
class ToolMovementBase(BaseModel):
    movement_type: MovementType
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    status: MovementStatus = MovementStatus.OPEN
    note: Optional[str] = None
    tool_id: int
    user_id: Optional[int] = None


class ToolMovementCreate(ToolMovementBase):
    pass


class ToolMovementUpdate(ToolMovementBase):
    pass


class ToolMovementRead(ToolMovementBase):
    id: int
    timestamp: datetime
    # Lesbare Infos für den Verlauf (werden über Beziehungen mitgeladen)
    tool_code: Optional[str] = None  # z. B. "1075000" (tool.tool_id)
    tool_description: Optional[str] = None  # tool.description
    user_display_name: Optional[str] = None  # Vorname + Nachname des Users
    # Arbeitswerk, in dem gehandelt wurde (DEC-070). NULL bei Altdaten.
    plant_id: Optional[int] = None
    plant: Optional[PlantRead] = None

    class Config:
        from_attributes = True


# ============================================================
# Rückgabe eines Werkzeugs (DEC-078)
# ============================================================
class ToolReturnRequest(BaseModel):
    """Rückgabe: Werkzeug kommt aus einer Ausleihe zurück.

    `note` ist freiwillig (z. B. „Zustand in Ordnung"). Der **Ausleiher** wird
    nicht aus dem Body übernommen, sondern ist der angemeldete Benutzer; das
    **Arbeitswerk** kommt aus dem Header `X-Plant-Id`.
    """

    note: Optional[str] = None


class ActiveLoan(BaseModel):
    """Eine laufende Ausleihe – Grundlage der Rückgabe-Liste im Frontend."""

    movement_id: int
    tool_id: int
    tool_code: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    measure_a: Optional[str] = None
    position_code: Optional[str] = None
    lent_at: Optional[datetime] = None
    user_id: Optional[int] = None
    user_display_name: Optional[str] = None
    note: Optional[str] = None


class MovementPage(BaseModel):
    """Eine Seite Verlauf (DEC-094).

    „Historie" braucht Seiten und eine Gesamtzahl – die alte Liste lieferte nur
    Zeilen ohne `total`, damit war weder „1–50 von 320" noch „weiter" möglich.
    """

    items: List[ToolMovementRead]
    total: int
