from sqlalchemy import select
from typing import Optional
from ..models.user import User
from .base import CRUDBase

class CRUDUser(CRUDBase):
    model = User

    async def get_by_personal_number(self, personal_number: str) -> Optional[User]:
        query = select(self.model).where(self.model.personal_number == personal_number)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()