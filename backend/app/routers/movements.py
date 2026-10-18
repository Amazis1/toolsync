"""Bewegungen (Verlauf) und Rückgabe an Personen (DEC-078).

`POST /` erfasst eine Bewegung; die Werkzeug-Zustände setzt der
`MovementService` (lend → lent, return → available). `POST /return/{tool_id}` ist
der **eigene Rückgabe-Weg**: Er nimmt ein einzelnes Werkzeug zurück, schreibt den
Ausführenden aus dem Token und das Arbeitswerk aus dem Header `X-Plant-Id`.
`GET /active` liefert die laufenden Ausleihen für die Rückgabe-Liste.
"""

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.dependencies.permissions import require_active
from app.dependencies.plant import get_active_plant
from app.models.master_data import Plant
from app.models.user import User
from app.schemas.movement import (
    ActiveLoan,
    ToolMovementCreate,
    ToolMovementRead,
    ToolReturnRequest,
)
from app.schemas.tool import ToolRead
from app.services.movement_service import MovementService
from app.services.return_service import ReturnService
from app.services.tool_service import ToolService
from app.utils.database import get_db

router = APIRouter()


@router.get("/", response_model=List[ToolMovementRead])
async def get_movements(
    tool_id: Optional[int] = None,
    user_id: Optional[int] = None,
    plant_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = MovementService(db)
    return await service.get_movements(
        tool_id=tool_id,
        user_id=user_id,
        plant_id=plant_id,
        skip=skip,
        limit=limit,
    )


@router.post("/", response_model=ToolMovementRead, status_code=201)
async def create_movement(
    data: ToolMovementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """Bewegung erfassen (Ausleihe, Rückgabe, Umbuchung, Statuswechsel).

    Der ausführende Benutzer kommt **aus dem Token**, das Arbeitswerk aus dem
    Header – nicht mehr aus dem Body (docs/08 §7). Ein `user_id` im Body wird
    deshalb überschrieben.
    """
    data.user_id = current_user.id
    service = MovementService(db)
    try:
        return await service.create_movement(data, plant_id=plant.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ----------------------------------------------------------------------
# Rückgabe an eine Person (DEC-078)
# ----------------------------------------------------------------------
@router.get("/active", response_model=List[ActiveLoan])
async def get_active_loans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """Laufende Ausleihen des Arbeitswerks (Werkzeuge mit Status `lent`)."""
    service = ReturnService(db)
    return await service.list_active_loans(plant_id=plant.id)


@router.post("/return/{tool_id}", response_model=ToolRead)
async def return_tool(
    tool_id: int,
    data: Optional[ToolReturnRequest] = Body(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """Ein einzelnes Werkzeug zurücknehmen.

    Werkzeug-Status (`available`), Bewegung (mit Ausgangsort, Rückgabeort und
    Benutzer) werden in **einer** Transaktion geschrieben. Ist das Werkzeug nicht
    ausgeliehen, antwortet der Server mit HTTP 400 und einer Begründung.

    Der Body ist freiwillig: ohne Body, mit `{}` oder mit `{"note": "…"}`.
    """
    service = ReturnService(db)
    try:
        tool = await service.return_tool(
            tool_id=tool_id,
            user_id=current_user.id,
            plant_id=plant.id,
            note=(data.note if data else None),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await ToolService(db).get_tool_read(tool.id)
