from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, TypeVar, Generic, Type
from ..models.base import Base

ModelType = TypeVar("ModelType", bound=Base)

class CRUDBase(Generic[ModelType]):
    def __init__(self, db: AsyncSession):
        self.db = db
        self.model: Type[ModelType] = self.__class__.model

    async def get(self, id: int) -> Optional[ModelType]:
        query = select(self.model).where(self.model.id == id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        query = select(self.model).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def create(self, obj_in) -> ModelType:
        db_obj = self.model(**obj_in.dict())
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def update(self, id: int, obj_in) -> Optional[ModelType]:
        db_obj = await self.get(id)
        if not db_obj:
            return None
        # Pydantic-Model oder Dict unterstützen
        if hasattr(obj_in, 'dict'):
            obj_data = obj_in.dict(exclude_unset=True)
        else:
            obj_data = dict(obj_in)
        # Feldwerte übernehmen (None = nicht ändern)
        for key, value in obj_data.items():
            if key == 'personal_number' and value in (None, ''):
                continue  # Personalnummer nicht ändern
            if value is not None:
                setattr(db_obj, key, value)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete(self, id: int) -> None:
        db_obj = await self.get(id)
        if db_obj:
            await self.db.delete(db_obj)
            await self.db.commit()