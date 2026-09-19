from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..models.enums import MovementType, MovementStatus


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

    class Config:
        from_attributes = True
