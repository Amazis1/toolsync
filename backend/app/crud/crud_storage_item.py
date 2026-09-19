from typing import List, Optional

from sqlalchemy import or_, select

from ..models.storage_item import StorageItem
from .base import CRUDBase


class CRUDStorageItem(CRUDBase):
    model = StorageItem

    async def get_multi(
        self,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[StorageItem]:
        query = select(self.model).order_by(self.model.storage_id)
        if search and search.strip():
            q = search.strip()
            query = query.where(
                or_(
                    self.model.storage_id.ilike(f"%{q}%"),
                    self.model.name.ilike(f"%{q}%"),
                    self.model.article_number.ilike(f"%{q}%"),
                )
            )
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_storage_id(
        self, storage_id: str, exclude_id: Optional[int] = None
    ) -> List[StorageItem]:
        query = select(self.model).where(self.model.storage_id == storage_id)
        if exclude_id is not None:
            query = query.where(self.model.id != exclude_id)
        result = await self.db.execute(query)
        return result.scalars().all()
