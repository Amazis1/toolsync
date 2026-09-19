from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.dependencies.permissions import require_active, require_admin
from app.models.user import User
from app.utils.database import get_db
from ..schemas.user import UserCreate, UserUpdate, UserRead
from ..services.user_service import UserService

router = APIRouter()

@router.get("/", response_model=List[UserRead])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = UserService(db)
    return await service.get_users(skip=skip, limit=limit)

@router.get("/{id}", response_model=UserRead)
async def get_user(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    service = UserService(db)
    user = await service.get_user(id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/", response_model=UserRead, status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    service = UserService(db)
    try:
        return await service.create_user(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{id}", response_model=UserRead)
async def update_user(
    id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    service = UserService(db)
    user = await service.update_user(id, data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/{id}", status_code=204)
async def delete_user(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    service = UserService(db)
    await service.delete_user(id)
    return None
    service = UserService(db)
    await service.delete_user(id)
    return None