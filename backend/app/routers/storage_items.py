from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.permissions import require_active
from app.models.user import User
from app.utils.database import get_db
from ..schemas.storage_item import StorageItemCreate, StorageItemRead, StorageItemUpdate
from ..services.storage_item_service import StorageItemService

router = APIRouter()


@router.get("/", response_model=List[StorageItemRead])
async def get_storage_items(
    search: Optional[str] = Query(
        default=None, description="Suche über Lager-ID, Name, Artikelnummer"
    ),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = StorageItemService(db)
    return await service.get_all(search=search, skip=skip, limit=limit)


@router.get("/{item_id}", response_model=StorageItemRead)
async def get_storage_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = StorageItemService(db)
    item = await service.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Lagerobjekt nicht gefunden")
    return item


@router.post("/", response_model=StorageItemRead, status_code=201)
async def create_storage_item(
    data: StorageItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = StorageItemService(db)
    try:
        return await service.create(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{item_id}", response_model=StorageItemRead)
async def update_storage_item(
    item_id: int,
    data: StorageItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = StorageItemService(db)
    try:
        item = await service.update(item_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not item:
        raise HTTPException(status_code=404, detail="Lagerobjekt nicht gefunden")
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_storage_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = StorageItemService(db)
    await service.delete(item_id)
    return None
