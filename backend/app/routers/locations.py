from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import List

from app.dependencies.permissions import require_admin, require_active
from app.models.user import User
from app.utils.database import get_db
from ..schemas.storage import (
    CabinetCreate,
    CabinetUpdate,
    CabinetRead,
    DrawerCreate,
    DrawerUpdate,
    DrawerRead,
    PositionCreate,
    PositionRead,
    PositionMoveRequest,
    PlaceToolRequest,
    ReleaseToolRequest,
    ToolLiteRead,
)
from ..schemas.master_data import PlantCreate, PlantUpdate, PlantRead
from ..models.master_data import Plant
from ..models.storage import Cabinet, Drawer, Position
from ..services.location_service import LocationService

router = APIRouter()


# --------------------------------------------------------------
# PLANT – Admin-CRUD
# --------------------------------------------------------------
@router.get("/plants", response_model=List[PlantRead])
async def get_plants(
    db: AsyncSession = Depends(get_db),
):
    """Alle Werke (Plant) für Dropdowns."""
    result = await db.execute(select(Plant).order_by(Plant.name))
    return result.scalars().all()


@router.post("/plants", response_model=PlantRead, status_code=201)
async def create_plant(
    data: PlantCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Werk anlegen (nur Admin)."""
    existing = await db.execute(select(Plant).where(Plant.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Werk existiert bereits")
    plant = Plant(name=data.name)
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    return plant


@router.put("/plants/{id}", response_model=PlantRead)
async def update_plant(
    id: int,
    data: PlantUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Werk umbenennen (nur Admin)."""
    plant = await db.get(Plant, id)
    if not plant:
        raise HTTPException(status_code=404, detail="Werk nicht gefunden")
    if data.name != plant.name:
        existing = await db.execute(select(Plant).where(Plant.name == data.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Werk existiert bereits")
    plant.name = data.name
    await db.commit()
    await db.refresh(plant)
    return plant


@router.delete("/plants/{id}", status_code=204)
async def delete_plant(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Werk löschen (nur Admin)."""
    plant = await db.get(Plant, id)
    if not plant:
        raise HTTPException(status_code=404, detail="Werk nicht gefunden")
    await db.delete(plant)
    await db.commit()
    return None


# --------------------------------------------------------------
# CABINET – Admin-CRUD + Lesen
# --------------------------------------------------------------
@router.get("/cabinets", response_model=List[CabinetRead])
async def get_cabinets(
    plant_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = LocationService(db)
    return await service.get_cabinets(plant_id)


@router.post("/cabinets", response_model=CabinetRead, status_code=201)
async def create_cabinet(
    data: CabinetCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Schrank anlegen (nur Admin)."""
    existing = await db.execute(
        select(Cabinet).where(
            Cabinet.plant_id == data.plant_id, Cabinet.name == data.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Schrank existiert bereits in diesem Werk"
        )
    cabinet = Cabinet(name=data.name, plant_id=data.plant_id)
    db.add(cabinet)
    await db.commit()
    await db.refresh(cabinet)
    return cabinet


@router.put("/cabinets/{id}", response_model=CabinetRead)
async def update_cabinet(
    id: int,
    data: CabinetUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Schrank bearbeiten (nur Admin)."""
    cabinet = await db.get(Cabinet, id)
    if not cabinet:
        raise HTTPException(status_code=404, detail="Schrank nicht gefunden")
    if data.name != cabinet.name or data.plant_id != cabinet.plant_id:
        existing = await db.execute(
            select(Cabinet).where(
                Cabinet.plant_id == data.plant_id, Cabinet.name == data.name
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400, detail="Schrank existiert bereits in diesem Werk"
            )
    cabinet.name = data.name
    cabinet.plant_id = data.plant_id
    await db.commit()
    await db.refresh(cabinet)
    return cabinet


class ReleaseResult(BaseModel):
    released_tools: int


@router.delete("/cabinets/{id}", response_model=ReleaseResult)
async def delete_cabinet(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Schrank löschen (nur Admin).

    Eingelagerte Werkzeuge werden NICHT gelöscht, sondern freigegeben
    und landen in der Werkzeug-Ablage (position_id = NULL).
    """
    service = LocationService(db)
    try:
        released = await service.delete_cabinet(id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return ReleaseResult(released_tools=released)


# --------------------------------------------------------------
# DRAWER – Admin-CRUD + Lesen
# --------------------------------------------------------------
@router.get("/drawers", response_model=List[DrawerRead])
async def get_drawers(
    cabinet_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = LocationService(db)
    return await service.get_drawers(cabinet_id)


@router.post("/drawers", response_model=DrawerRead, status_code=201)
async def create_drawer(
    data: DrawerCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Schublade anlegen (nur Admin) – erzeugt Plätze automatisch."""
    existing = await db.execute(
        select(Drawer).where(
            Drawer.cabinet_id == data.cabinet_id, Drawer.name == data.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Schublade existiert bereits in diesem Schrank"
        )
    drawer = Drawer(
        name=data.name, cols=data.cols, rows=data.rows, cabinet_id=data.cabinet_id
    )
    db.add(drawer)
    await db.flush()
    counter = 1
    for x in range(1, data.cols + 1):
        for y in range(1, data.rows + 1):
            pos_name = str(counter).zfill(2)
            db.add(Position(name=pos_name, x=x, y=y, drawer_id=drawer.id))
            counter += 1
    await db.commit()

    # WICHTIG: Nach dem Commit sind die Attribute abgelaufen. Die Response
    # enthält 'positions', daher die Beziehung explizit eager laden –
    # sonst kommt es beim Serialisieren zu einem Lazy-Load im Sync-Kontext
    # (MissingGreenlet) und die Anfrage schlägt trotz erfolgreichem Commit fehl.
    result = await db.execute(
        select(Drawer)
        .where(Drawer.id == drawer.id)
        .options(selectinload(Drawer.positions).selectinload(Position.tool))
    )
    return result.scalar_one()


@router.put("/drawers/{id}", response_model=DrawerRead)
async def update_drawer(
    id: int,
    data: DrawerUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Schublade bearbeiten (nur Admin)."""
    drawer = await db.get(Drawer, id)
    if not drawer:
        raise HTTPException(status_code=404, detail="Schublade nicht gefunden")
    if data.name != drawer.name or data.cabinet_id != drawer.cabinet_id:
        existing = await db.execute(
            select(Drawer).where(
                Drawer.cabinet_id == data.cabinet_id, Drawer.name == data.name
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400, detail="Schublade existiert bereits in diesem Schrank"
            )
    drawer.name = data.name
    drawer.cabinet_id = data.cabinet_id
    drawer.cols = data.cols
    drawer.rows = data.rows
    drawer_id = drawer.id
    await db.commit()

    # Siehe create_drawer: 'positions' eager laden, sonst Lazy-Load im Sync-Kontext.
    result = await db.execute(
        select(Drawer)
        .where(Drawer.id == drawer_id)
        .options(selectinload(Drawer.positions).selectinload(Position.tool))
    )
    return result.scalar_one()


@router.delete("/drawers/{id}", response_model=ReleaseResult)
async def delete_drawer(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Schublade löschen (nur Admin).

    Eingelagerte Werkzeuge werden NICHT gelöscht, sondern freigegeben
    und landen in der Werkzeug-Ablage (position_id = NULL).
    """
    service = LocationService(db)
    try:
        released = await service.delete_drawer(id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return ReleaseResult(released_tools=released)


# --------------------------------------------------------------
# POSITION – Admin-CRUD + Lesen
# --------------------------------------------------------------
@router.get("/positions", response_model=List[PositionRead])
async def get_positions(
    drawer_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = LocationService(db)
    return await service.get_positions(drawer_id)


class PositionContext(BaseModel):
    """Aufloesung Position -> Schublade -> Schrank (fuer die Formular-Vorbelegung)."""

    position_id: int
    position_name: str
    drawer_id: int
    drawer_name: str
    cabinet_id: int
    cabinet_name: str
    plant_id: int


@router.get("/positions/{position_id}/context", response_model=PositionContext)
async def get_position_context(
    position_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Zu einem Platz den zugehoerigen Schrank/Schublade ermitteln.

    Wird beim Bearbeiten genutzt, um Schrank -> Schublade -> Platz
    vorauszuwaehlen.
    """
    result = await db.execute(
        select(Position, Drawer, Cabinet)
        .join(Drawer, Position.drawer_id == Drawer.id)
        .join(Cabinet, Drawer.cabinet_id == Cabinet.id)
        .where(Position.id == position_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Platz nicht gefunden")
    position, drawer, cabinet = row
    return PositionContext(
        position_id=position.id,
        position_name=position.name,
        drawer_id=drawer.id,
        drawer_name=drawer.name,
        cabinet_id=cabinet.id,
        cabinet_name=cabinet.name,
        plant_id=cabinet.plant_id,
    )


@router.post("/positions", response_model=PositionRead, status_code=201)
async def create_position(
    data: PositionCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Platz anlegen (nur Admin)."""
    existing = await db.execute(
        select(Position).where(
            Position.drawer_id == data.drawer_id, Position.name == data.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Platz existiert bereits in dieser Schublade"
        )
    position = Position(name=data.name, x=data.x, y=data.y, drawer_id=data.drawer_id)
    db.add(position)
    await db.commit()
    await db.refresh(position)
    return position


@router.post("/positions/move", response_model=List[PositionRead])
async def move_position(
    data: PositionMoveRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Verschiebe-Aktion (move / swap / insert_at).

    - move:      belegtes Fach auf einen freien Platz verschieben.
    - swap:      zwei belegte Plätze tauschen.
    - insert_at: Werkzeug von außen auf einem belegten Platz einreihen
                 (Shift nur innerhalb der Ziel-Schublade).
    """
    service = LocationService(db)
    try:
        if data.action == "move":
            positions = await service.move_position(
                data.source_position_id,
                data.target_position_id,
                admin_user.id,
            )
        elif data.action == "swap":
            positions = await service.swap_positions(
                data.source_position_id,
                data.target_position_id,
                admin_user.id,
            )
        elif data.action == "insert_at":
            positions = await service.insert_at_position(
                data.source_position_id,
                data.target_position_id,
                admin_user.id,
            )
        else:
            raise ValueError(f"Unbekannte Aktion: {data.action}")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return positions


@router.get("/tray", response_model=List[ToolLiteRead])
async def get_tray_tools(
    plant_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Alle nicht eingelagerten Werkzeuge eines Werks (Werkzeug-Ablage).

    Enthält Werkzeuge mit position_id = NULL sowie korrigierte
    Werkzeuge, deren Platz nicht mehr existiert.
    """
    service = LocationService(db)
    return await service.get_tray_tools(plant_id)


@router.post("/positions/place-tool", response_model=List[PositionRead])
async def place_tool_at_position(
    data: PlaceToolRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Ablage-Werkzeug auf einen Platz legen.

    Freier Platz: einfaches Ablegen.
    Belegter Platz: Einreihen (Shift); blockiert, wenn der letzte Platz
    belegt ist, damit kein Werkzeug verloren geht.
    """
    service = LocationService(db)
    try:
        return await service.place_tool_at_position(
            data.tool_id,
            data.target_position_id,
            admin_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/positions/release-tool", response_model=List[PositionRead])
async def release_tool_from_position(
    data: ReleaseToolRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Werkzeug vom Platz nehmen und in die Ablage legen."""
    service = LocationService(db)
    try:
        return await service.release_tool_from_position(
            data.position_id,
            admin_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/positions/{id}", status_code=204)
async def delete_position(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Platz löschen (nur Admin).

    Ein belegter Platz kann nicht gelöscht werden.
    """
    position = await db.get(Position, id)
    if not position:
        raise HTTPException(status_code=404, detail="Platz nicht gefunden")
    if position.tool_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Platz ist belegt und kann nicht gelöscht werden.",
        )
    await db.delete(position)
    await db.commit()
    return None


# --------------------------------------------------------------
# SCHRANK-MATRIX – Kompletter Schrank mit Schubladen + Plätzen
# --------------------------------------------------------------
class DrawerMatrix(BaseModel):
    name: str
    cols: int
    rows: int


class CabinetMatrixCreate(BaseModel):
    name: str
    plant_id: int
    drawers: List[DrawerMatrix]


@router.post("/cabinets/matrix", response_model=CabinetRead, status_code=201)
async def create_cabinet_matrix(
    data: CabinetMatrixCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Schrank als komplette Matrix anlegen – erzeugt Schubladen und Plätze automatisch."""
    existing = await db.execute(
        select(Cabinet).where(
            Cabinet.plant_id == data.plant_id, Cabinet.name == data.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400, detail="Schrank existiert bereits in diesem Werk"
        )

    cabinet = Cabinet(name=data.name, plant_id=data.plant_id)
    db.add(cabinet)
    await db.flush()  # cabinet.id vergeben

    for d in data.drawers:
        existing_drawer = await db.execute(
            select(Drawer).where(Drawer.cabinet_id == cabinet.id, Drawer.name == d.name)
        )
        if existing_drawer.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Schublade {d.name} existiert bereits im Schrank {data.name}",
            )
        drawer = Drawer(name=d.name, cols=d.cols, rows=d.rows, cabinet_id=cabinet.id)
        db.add(drawer)
        await db.flush()
        counter = 1
        for x in range(1, d.cols + 1):
            for y in range(1, d.rows + 1):
                pos_name = str(counter).zfill(2)
                db.add(Position(name=pos_name, x=x, y=y, drawer_id=drawer.id))
                counter += 1

    await db.commit()
    await db.refresh(cabinet)
    return cabinet
