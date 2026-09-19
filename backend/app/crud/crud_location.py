from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from ..models.storage import Cabinet, Drawer, Position
from .base import CRUDBase

class CRUDCabinet(CRUDBase):
    model = Cabinet

    async def get_by_plant(self, plant_id: int) -> List[Cabinet]:
        query = select(self.model).where(self.model.plant_id == plant_id)
        result = await self.db.execute(query)
        return result.scalars().all()

class CRUDDrawer(CRUDBase):
    model = Drawer

    async def get_by_cabinet(self, cabinet_id: int) -> List[Drawer]:
        query = (
            select(self.model)
            .where(self.model.cabinet_id == cabinet_id)
            .options(selectinload(Drawer.positions).selectinload(Position.tool))
        )
        result = await self.db.execute(query)
        return result.scalars().all()

class CRUDPosition(CRUDBase):
    model = Position

    async def get_by_drawer(self, drawer_id: int) -> List[Position]:
        query = (
            select(self.model)
            .where(self.model.drawer_id == drawer_id)
            .options(selectinload(Position.tool))
        )
        result = await self.db.execute(query)
        return result.scalars().all()