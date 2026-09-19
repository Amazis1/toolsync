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

class UserUpdate(BaseModel):
    personal_number: Optional[str] = None  # Nur für Bearbeitung, wird nie zurückgegeben
    first_name: str
    last_name: str
    display_name: Optional[str] = None
    is_active: bool = True
    is_admin: bool = False
    hashed_password: Optional[str] = None

class UserRead(BaseModel):
    id: int
    first_name: str
    last_name: str
    display_name: Optional[str] = None
    is_active: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True