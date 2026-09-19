from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.dependencies.permissions import require_active
from app.models.user import User
from app.utils.database import get_db
from ..schemas.movement import ToolMovementCreate, ToolMovementRead
from ..services.movement_service import MovementService

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
):
    service = MovementService(db)
    try:
        return await service.create_movement(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
