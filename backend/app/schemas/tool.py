from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from ..models.enums import ToolCategory, ToolStatus
from .master_data import CustomerRead, PlantRead, ToolTypeRead


# ============================================================
# Tool
# ============================================================
class ToolBase(BaseModel):
    tool_id: str
    category: ToolCategory
    status: Optional[ToolStatus] = None
    is_storage: bool = False
    allow_duplicate_id: bool = False
    measure_a: Optional[str] = None
    measure_b: Optional[str] = None
    description: Optional[str] = None
    plant_id: int
    tool_type_id: int
    position_id: Optional[int] = None
    machine_id: Optional[int] = None
    customer_id: Optional[int] = None


class ToolCreate(ToolBase):
    pass


class ToolUpdate(ToolBase):
    pass


class ToolRead(ToolBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Für die Listenansicht direkt mitgelieferte Beziehungen
    plant: Optional[PlantRead] = None
    tool_type: Optional[ToolTypeRead] = None
    customer: Optional[CustomerRead] = None

    class Config:
        from_attributes = True
