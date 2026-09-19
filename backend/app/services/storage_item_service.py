from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.crud_storage_item import CRUDStorageItem
from ..models.storage_item import StorageItem
from ..schemas.storage_item import StorageItemCreate, StorageItemUpdate


class StorageItemService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDStorageItem(db)

    async def get_all(
        self,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[StorageItem]:
        return await self.crud.get_multi(search=search, skip=skip, limit=limit)

    async def get(self, id: int) -> Optional[StorageItem]:
        return await self.crud.get(id)

    async def create(self, data: StorageItemCreate) -> StorageItem:
        await self._ensure_unique_storage_id(data.storage_id, data.allow_duplicate_id)
        return await self.crud.create(obj_in=data)

    async def update(self, id: int, data: StorageItemUpdate) -> Optional[StorageItem]:
        item = await self.crud.get(id)
        if item is None:
            return None
        await self._ensure_unique_storage_id(
            data.storage_id, data.allow_duplicate_id, exclude_id=id
        )
        return await self.crud.update(id=id, obj_in=data)

    async def delete(self, id: int) -> None:
        await self.crud.delete(id)

    async def _ensure_unique_storage_id(
        self,
        storage_id: str,
        allow_duplicate: bool,
        exclude_id: Optional[int] = None,
    ) -> None:
        """Fachliche Regel: Ohne „Gleiche ID mehrfach zulassen“ darf eine
        storage_id nur einmal existieren.

        Wirft ValueError, wenn die ID bereits vergeben ist.
        """
        if allow_duplicate:
            return
        existing = await self.crud.get_by_storage_id(storage_id, exclude_id=exclude_id)
        if existing:
            raise ValueError(
                f"Die Lager-ID {storage_id} existiert bereits. "
                "Für weitere Exemplare „Gleiche ID mehrfach zulassen“ aktivieren."
            )
