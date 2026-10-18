from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# ============================================================
# Permission
# ============================================================
class PermissionBase(BaseModel):
    name: str
    codename: str

class PermissionCreate(PermissionBase):
    pass

class PermissionUpdate(PermissionBase):
    pass

class PermissionRead(PermissionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============================================================
# Role
# ============================================================
class RoleBase(BaseModel):
    name: str

class RoleCreate(RoleBase):
    permission_ids: Optional[list[int]] = []

class RoleUpdate(RoleBase):
    permission_ids: Optional[list[int]] = []

class RoleRead(RoleBase):
    id: int
    permissions: list[PermissionRead] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============================================================
# User
# ============================================================
class UserBase(BaseModel):
    first_name: str
    last_name: str
    display_name: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False
class UserCreate(BaseModel):
    personal_number: str  # Nur für Eingabe beim Anlegen, wird nie zurückgegeben
    first_name: str
    last_name: str
    display_name: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False
    hashed_password: Optional[str] = None  # Nur für Admin
    # Vorgabe für das Arbeitswerk (DEC-070) – kein Pflichtfeld
    default_plant_id: Optional[int] = None

class UserUpdate(BaseModel):
    personal_number: Optional[str] = None  # Nur für Bearbeitung, wird nie zurückgegeben
    first_name: str
    last_name: str
    display_name: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False
    hashed_password: Optional[str] = None
    default_plant_id: Optional[int] = None

class UserRead(BaseModel):
    id: int
    first_name: str
    last_name: str
    display_name: Optional[str] = None
    is_active: bool
    is_admin: bool
    # Arbeitswerk-Vorgabe und – vom Server aufgelöst – das **aktuelle** Arbeitswerk.
    # `plant_id` ist das, was der Werksumschalter anzeigt (Header `X-Plant-Id`,
    # sonst `default_plant_id`, sonst das erste Werk) – siehe `/auth/me`.
    default_plant_id: Optional[int] = None
    plant_id: Optional[int] = None
    plant_name: Optional[str] = None
    plant_color: Optional[str] = None
    default_plant: Optional["PlantRead"] = None
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


# Import am Ende, damit `PlantRead` oben genutzt werden kann, ohne den
# Modulbaum zyklisch zu machen (master_data importiert user nicht).
from .master_data import PlantRead  # noqa: E402  isort:skip

UserRead.model_rebuild()