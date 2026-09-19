from sqlalchemy import select, and_, func
from typing import Optional, List
from ..models.tool import Tool
from ..models.enums import ToolCategory
from .base import CRUDBase


class CRUDTool(CRUDBase):
    model = Tool

    async def get_multi(
        self,
        tool_id: Optional[str] = None,
        category: Optional[ToolCategory] = None,
        plant_id: Optional[int] = None,
        is_storage: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Tool]:
        query = select(self.model)
        if tool_id:
            query = query.where(self.model.tool_id.ilike(f"%{tool_id}%"))
        if category:
            query = query.where(self.model.category == category)
        if plant_id:
            query = query.where(self.model.plant_id == plant_id)
        if is_storage is not None:
            query = query.where(self.model.is_storage == is_storage)
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_tool_id(
        self,
        tool_id: str,
        category: ToolCategory,
        plant_id: int,
        is_storage: bool = False,
        exclude_id: Optional[int] = None,
    ) -> Optional[Tool]:
        """Sucht ein Werkzeug anhand seiner fachlichen ID.

        is_storage trennt normale Werkzeuge von Lager/Ersatz (eigener ID-Bereich).
        exclude_id blendet das eigene Werkzeug beim Bearbeiten aus.
        """
        conditions = [
            self.model.tool_id == tool_id,
            self.model.category == category,
            self.model.plant_id == plant_id,
            self.model.is_storage == is_storage,
        ]
        if exclude_id is not None:
            conditions.append(self.model.id != exclude_id)
        query = select(self.model).where(and_(*conditions))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def count_by_tool_id(
        self,
        tool_id: str,
        category: ToolCategory,
        plant_id: int,
        is_storage: bool = False,
        exclude_id: Optional[int] = None,
    ) -> int:
        """Anzahl vorhandener Werkzeuge mit dieser fachlichen ID.

        Fuer Lager/Ersatz (is_storage=True) sind Mehrfach-IDs erlaubt -
        die Anzahl zeigt, als wievieltes Exemplar ein neues angelegt wird.
        exclude_id blendet das eigene Werkzeug beim Bearbeiten aus.
        """
        conditions = [
            self.model.tool_id == tool_id,
            self.model.category == category,
            self.model.plant_id == plant_id,
            self.model.is_storage == is_storage,
        ]
        if exclude_id is not None:
            conditions.append(self.model.id != exclude_id)
        query = select(func.count()).select_from(self.model).where(and_(*conditions))
        result = await self.db.execute(query)
        return int(result.scalar_one())
