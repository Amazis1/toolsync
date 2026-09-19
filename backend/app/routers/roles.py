from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.dependencies.permissions import require_admin
from app.models.user import User, Role, Permission
from app.utils.database import get_db
from app.schemas.user import (
    RoleCreate,
    RoleUpdate,
    RoleRead,
    PermissionCreate,
    PermissionUpdate,
    PermissionRead,
)

router = APIRouter()


def _raise_bad_request(detail: str):
    raise HTTPException(status_code=400, detail=detail)


async def _role_with_permissions(db: AsyncSession, role_id: int) -> Role | None:
    """Rolle inkl. Berechtigungen laden (für async-sichere Serialisierung)."""
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    )
    return result.scalar_one_or_none()


# --------------------------------------------------------------
# PERMISSIONS
# --------------------------------------------------------------
@router.get("/permissions", response_model=List[PermissionRead])
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Alle Berechtigungen auflisten (nur Admin)."""
    query = select(Permission).order_by(Permission.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/permissions", response_model=PermissionRead, status_code=201)
async def create_permission(
    data: PermissionCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Berechtigung anlegen (nur Admin)."""
    existing_by_name = await db.execute(
        select(Permission).where(Permission.name == data.name)
    )
    if existing_by_name.scalar_one_or_none():
        _raise_bad_request("Berechtigungsname existiert bereits")

    existing_by_codename = await db.execute(
        select(Permission).where(Permission.codename == data.codename)
    )
    if existing_by_codename.scalar_one_or_none():
        _raise_bad_request("Berechtigungscode existiert bereits")

    permission = Permission(name=data.name, codename=data.codename)
    db.add(permission)
    await db.commit()
    await db.refresh(permission)
    return permission


@router.put("/permissions/{id}", response_model=PermissionRead)
async def update_permission(
    id: int,
    data: PermissionUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Berechtigung bearbeiten (nur Admin)."""
    permission = await db.get(Permission, id)
    if not permission:
        raise HTTPException(status_code=404, detail="Berechtigung nicht gefunden")

    if data.name != permission.name:
        existing_by_name = await db.execute(
            select(Permission).where(Permission.name == data.name)
        )
        if existing_by_name.scalar_one_or_none():
            _raise_bad_request("Berechtigungsname existiert bereits")

    if data.codename != permission.codename:
        existing_by_codename = await db.execute(
            select(Permission).where(Permission.codename == data.codename)
        )
        if existing_by_codename.scalar_one_or_none():
            _raise_bad_request("Berechtigungscode existiert bereits")

    permission.name = data.name
    permission.codename = data.codename
    await db.commit()
    await db.refresh(permission)
    return permission


@router.delete("/permissions/{id}", status_code=204)
async def delete_permission(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Berechtigung löschen (nur Admin)."""
    permission = await db.get(Permission, id)
    if not permission:
        raise HTTPException(status_code=404, detail="Berechtigung nicht gefunden")
    await db.delete(permission)
    await db.commit()
    return None


# --------------------------------------------------------------
# ROLES
# --------------------------------------------------------------
@router.get("/", response_model=List[RoleRead])
async def get_roles(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Alle Rollen auflisten (nur Admin)."""
    query = select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=RoleRead, status_code=201)
async def create_role(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Rolle anlegen und Berechtigungen zuweisen (nur Admin)."""
    existing = await db.execute(select(Role).where(Role.name == data.name))
    if existing.scalar_one_or_none():
        _raise_bad_request("Rolle existiert bereits")

    role = Role(name=data.name)
    permission_ids = data.permission_ids or []
    if permission_ids:
        result = await db.execute(
            select(Permission).where(Permission.id.in_(permission_ids))
        )
        role.permissions = list(result.scalars().all())

    db.add(role)
    await db.commit()

    # Nach dem Commit inkl. Berechtigungen neu laden, damit die
    # Response async-sicher vollständig serialisiert werden kann.
    role_full = await _role_with_permissions(db, role.id)
    return role_full


@router.get("/{id}", response_model=RoleRead)
async def get_role(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Rolle inkl. Berechtigungen abrufen (nur Admin)."""
    role = await _role_with_permissions(db, id)
    if not role:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    return role


@router.put("/{id}", response_model=RoleRead)
async def update_role(
    id: int,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Rolle umbenennen und Berechtigungen neu zuweisen (nur Admin)."""
    role = await db.get(Role, id)
    if not role:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")

    if data.name != role.name:
        existing = await db.execute(select(Role).where(Role.name == data.name))
        if existing.scalar_one_or_none():
            _raise_bad_request("Rolle existiert bereits")

    role.name = data.name
    permission_ids = data.permission_ids or []
    result = await db.execute(
        select(Permission).where(Permission.id.in_(permission_ids))
    )
    role.permissions = list(result.scalars().all())

    await db.commit()

    role_full = await _role_with_permissions(db, role.id)
    return role_full


@router.delete("/{id}", status_code=204)
async def delete_role(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Rolle löschen (nur Admin)."""
    role = await db.get(Role, id)
    if not role:
        raise HTTPException(status_code=404, detail="Rolle nicht gefunden")
    await db.delete(role)
    await db.commit()
    return None