from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from ..models.movement import ToolMovement
from ..models.tool import Tool
from .base import CRUDBase


class CRUDMovement(CRUDBase):
    model = ToolMovement

    async def get_multi(
        self,
        tool_id: Optional[int] = None,
        user_id: Optional[int] = None,
        plant_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ToolMovement]:
        """Bewegungen laden, neueste zuerst.

        - tool_id:  nur Bewegungen eines bestimmten Werkzeugs
        - user_id:  nur Bewegungen eines bestimmten Benutzers
        - plant_id: nur Bewegungen von Werkzeugen eines bestimmten Werks
        """
        query = (
            select(self.model)
            .options(
                selectinload(ToolMovement.tool),
                selectinload(ToolMovement.user),
            )
            .order_by(self.model.timestamp.desc(), self.model.id.desc())
        )
        if tool_id:
            query = query.where(self.model.tool_id == tool_id)
        if user_id:
            query = query.where(self.model.user_id == user_id)
        if plant_id:
            query = query.join(ToolMovement.tool).where(Tool.plant_id == plant_id)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()
