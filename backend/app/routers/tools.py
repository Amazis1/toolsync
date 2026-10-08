from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.dependencies.permissions import require_active, require_admin
from app.models.user import User
from app.utils.database import get_db
from ..crud.crud_tool import ToolSortKey, ToolSortOrder
from ..schemas.tool import (
    ToolCreate,
    ToolFavoriteUpdate,
    ToolPage,
    ToolRead,
    ToolUpdate,
)
from ..schemas.master_data import ToolTypeCreate, ToolTypeUpdate, ToolTypeRead
from ..models.master_data import ToolType
from ..models.enums import ToolCategory, ToolStatus
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


@router.get("/", response_model=ToolPage)
async def get_tools(
    q: Optional[str] = Query(
        None,
        description="Freitextsuche über Werkzeug-ID, Bezeichnung, Werkzeugtyp und Werk.",
    ),
    category: Optional[List[ToolCategory]] = Query(
        None, description="Kategorien; mehrfach angebbar."
    ),
    status: Optional[List[ToolStatus]] = Query(
        None, description="Status; mehrfach angebbar."
    ),
    plant_id: Optional[int] = Query(None, description="Werk."),
    tool_type_id: Optional[int] = Query(None, description="Werkzeugtyp."),
    is_storage: Optional[bool] = Query(
        None, description="true = nur Lager/Ersatz, false = nur normale Werkzeuge."
    ),
    has_place: Optional[bool] = Query(
        None, description="true = nur mit Lagerplatz, false = nur Ablage."
    ),
    favorites_only: bool = Query(False, description="Nur Favoriten."),
    sort: ToolSortKey = Query("tool_id", description="Sortierspalte."),
    order: ToolSortOrder = Query("asc", description="Sortierrichtung."),
    skip: int = Query(0, ge=0, description="Übersprungene Datensätze (Offset)."),
    limit: int = Query(
        25,
        ge=1,
        le=200,
        description="Seitengröße. Der Deckel verhindert, dass eine Anfrage die ganze Tabelle zieht.",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Gefilterte, sortierte und seitenweise Werkzeugliste samt Gesamtzahl.

    Filter, Sortierung und Ausschnitt passieren in der Datenbank. `sort` und
    `order` werden über Literal-Typen geprüft: ein unbekannter Spaltenname
    ergibt HTTP 422 statt einer Abfrage mit beliebigem Spaltennamen.
    """
    service = ToolService(db)
    return await service.get_tools(
        q=q,
        categories=category,
        statuses=status,
        plant_id=plant_id,
        tool_type_id=tool_type_id,
        is_storage=is_storage,
        has_place=has_place,
        favorites_only=favorites_only,
        sort=sort,
        order=order,
        skip=skip,
        limit=limit,
    )


@router.put("/{id}/favorite", response_model=ToolRead)
async def set_tool_favorite(
    id: int,
    data: ToolFavoriteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Favoriten-Markierung setzen (global, für alle Benutzer sichtbar).

    Bewusst ein eigener Endpunkt: das Bearbeiten eines Werkzeugs (PUT /{id})
    darf die Markierung nicht zurücksetzen. Kein Admin-Recht nötig - im
    Gegensatz zum Löschen ändert ein Favorit nichts am Bestand.
    """
    service = ToolService(db)
    tool = await service.set_favorite(id, data.is_favorite)
    if not tool:
        raise HTTPException(status_code=404, detail="Werkzeug nicht gefunden")
    return await service.get_tool_read(id)


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
    # get_tool_read liefert zusätzlich den Lagerplatz-Code ("01-A-25" / Ablage).
    tool = await service.get_tool_read(id)
    if not tool:
        raise HTTPException(status_code=404, detail="Werkzeug nicht gefunden")
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
        raise HTTPException(status_code=404, detail="Werkzeug nicht gefunden")
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
