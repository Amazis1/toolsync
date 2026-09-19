from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.dependencies.permissions import require_active, require_admin
from app.models.user import User
from app.utils.database import get_db
from ..schemas.tool import ToolCreate, ToolUpdate, ToolRead
from ..schemas.master_data import ToolTypeCreate, ToolTypeUpdate, ToolTypeRead
from ..models.master_data import ToolType
from ..models.enums import ToolCategory
from ..services.tool_service import ToolService

router = APIRouter()


@router.get("/types", response_model=List[ToolTypeRead])
async def get_tool_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Alle Werkzeugtypen für Dropdowns (Name enthält Typ-Code + Bezeichnung)."""
    result = await db.execute(select(ToolType).order_by(ToolType.name))
    return result.scalars().all()


@router.post("/types", response_model=ToolTypeRead, status_code=201)
async def create_tool_type(
    data: ToolTypeCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Werkzeugtyp anlegen (nur Admin).

    Die Bezeichnung enthält Typ-Code + Name als zusammenhängenden String,
    z. B. "01 Rund". Rückgabe 400, wenn der Name bereits existiert.
    """
    result = await db.execute(select(ToolType).where(ToolType.name == data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Werkzeugtyp existiert bereits")
    tool_type = ToolType(name=data.name)
    db.add(tool_type)
    await db.commit()
    await db.refresh(tool_type)
    return tool_type


@router.put("/types/{id}", response_model=ToolTypeRead)
async def update_tool_type(
    id: int,
    data: ToolTypeUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Werkzeugtyp umbenennen (nur Admin).

    Prüft auf Namenskonflikte, damit die Namensspalte eindeutig bleibt.
    """
    tool_type = await db.get(ToolType, id)
    if not tool_type:
        raise HTTPException(status_code=404, detail="Werkzeugtyp nicht gefunden")

    if data.name and data.name != tool_type.name:
        result = await db.execute(select(ToolType).where(ToolType.name == data.name))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Werkzeugtyp existiert bereits")

    tool_type.name = data.name
    await db.commit()
    await db.refresh(tool_type)
    return tool_type


@router.delete("/types/{id}", status_code=204)
async def delete_tool_type(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Werkzeugtyp löschen (nur Admin).

    Löscht den Werkzeugtyp und entkoppelt zugeordnete Werkzeuge (SET NULL).
    """
    tool_type = await db.get(ToolType, id)
    if not tool_type:
        raise HTTPException(status_code=404, detail="Werkzeugtyp nicht gefunden")
    await db.delete(tool_type)
    await db.commit()
    return None


@router.get("/", response_model=List[ToolRead])
async def get_tools(
    tool_id: Optional[str] = None,
    category: Optional[str] = None,
    plant_id: Optional[int] = None,
    is_storage: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = ToolService(db)
    return await service.get_tools(
        tool_id=tool_id,
        category=category,
        plant_id=plant_id,
        is_storage=is_storage,
        skip=skip,
        limit=limit,
    )


@router.get("/check-id")
async def check_tool_id(
    tool_id: str,
    category: ToolCategory,
    plant_id: int,
    is_storage: bool = False,
    exclude_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Live-Pruefung der Werkzeug-ID fuer das Anlegeformular.

    WICHTIG: Diese Route muss VOR "/{id}" stehen, sonst wird "check-id"
    als id interpretiert und die Anfrage schlaegt mit 422 fehl.

    exclude_id: beim Bearbeiten die eigene Werkzeug-ID ausnehmen.
    """
    service = ToolService(db)
    return await service.check_tool_id(
        tool_id, category, plant_id, is_storage, exclude_id=exclude_id
    )


@router.get("/{id}", response_model=ToolRead)
async def get_tool(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = ToolService(db)
    tool = await service.get_tool(id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.post("/", response_model=ToolRead, status_code=201)
async def create_tool(
    data: ToolCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = ToolService(db)
    try:
        return await service.create_tool(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{id}", response_model=ToolRead)
async def update_tool(
    id: int,
    data: ToolUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = ToolService(db)
    try:
        tool = await service.update_tool(id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool


@router.delete("/{id}", status_code=204)
async def delete_tool(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    service = ToolService(db)
    await service.delete_tool(id)
    return None
