from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
import re


def normalize_color(value: Optional[str]) -> Optional[str]:
    """Farbwert prüfen: `#RRGGBB` (oder Kurzform `#RGB`), leer = keine Farbe.

    Wird von Werken, Kunden und Maschinen gemeinsam benutzt – ein falscher Wert
    soll nicht erst im Browser auffallen.
    """
    if value is None:
        return None
    wert = value.strip()
    if not wert:
        return None
    if not re.fullmatch(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})", wert):
        raise ValueError("Farbe muss ein Hex-Wert wie #0f766e sein.")
    return wert.lower()


# ============================================================
# Plant
# ============================================================
class PlantBase(BaseModel):
    name: str
    # Werkfarbe (DEC-076): färbt Knöpfe, aktiven Reiter und Tabellenzeilen des
    # Arbeitswerks. None = Primärfarbe #0f766e.
    color: Optional[str] = None

    @field_validator("color")
    @classmethod
    def _pruefe_farbe(cls, wert: Optional[str]) -> Optional[str]:
        return normalize_color(wert)


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
    # Optionale Farbe aus den Stammdaten (#RRGGBB) – die Listen zeigen daraus
    # einen Farbpunkt neben dem Maschinennamen, wie beim Kunden.
    color: Optional[str] = None


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


# ============================================================
# Coating (Stempel-Beschichtung, Dachmarke MultiDur)
# ============================================================
class CoatingBase(BaseModel):
    # Vollständiger Name inkl. Dachmarke, z. B. "MultiDur TiCN" oder "Standard"
    name: str


class CoatingCreate(CoatingBase):
    pass


class CoatingUpdate(CoatingBase):
    pass


class CoatingRead(CoatingBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
