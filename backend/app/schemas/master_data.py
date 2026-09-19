from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ============================================================
# Plant
# ============================================================
class PlantBase(BaseModel):
    name: str


class PlantCreate(PlantBase):
    pass


class PlantUpdate(PlantBase):
    pass


class PlantRead(PlantBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Customer
# ============================================================
class CustomerBase(BaseModel):
    name: str
    # Optionale Kundenfarbe als Hex-Code (z. B. "#0f766e"); None = keine Farbe
    color: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(CustomerBase):
    pass


class CustomerRead(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Machine
# ============================================================
class MachineBase(BaseModel):
    name: str
    plant_id: Optional[int] = None


class MachineCreate(MachineBase):
    pass


class MachineUpdate(MachineBase):
    pass


class MachineRead(MachineBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# ToolType
# ============================================================
class ToolTypeBase(BaseModel):
    name: str  # z.B. "010 Rund" – Format: mehrstelliger Code + Bezeichnung


class ToolTypeCreate(ToolTypeBase):
    pass


class ToolTypeUpdate(ToolTypeBase):
    pass


class ToolTypeRead(ToolTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
