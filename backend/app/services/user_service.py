from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from ..models.user import User
from ..crud.crud_user import CRUDUser
from ..core.security import get_password_hash, verify_password

class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDUser(db)

    async def get_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        return await self.crud.get_multi(skip=skip, limit=limit)

    async def get_user(self, user_id: int) -> Optional[User]:
        return await self.crud.get(user_id)

    async def get_user_by_personal_number(self, personal_number: str) -> Optional[User]:
        return await self.crud.get_by_personal_number(personal_number)

    async def create_user(self, data) -> User:
        existing = await self.crud.get_by_personal_number(data.personal_number)
        if existing:
            raise ValueError(f"Personalnummer {data.personal_number} existiert bereits!")
        if data.hashed_password:
            data.hashed_password = get_password_hash(data.hashed_password)
        return await self.crud.create(data)

    async def update_user(self, user_id: int, data) -> User:
        # Leere Personalnummer ignorieren (wird nicht geändert)
        if hasattr(data, 'personal_number') and data.personal_number in (None, ''):
            data.personal_number = None
        if data.hashed_password:
            data.hashed_password = get_password_hash(data.hashed_password)
        return await self.crud.update(user_id, data)

    async def delete_user(self, user_id: int) -> None:
        await self.crud.delete(user_id)

    async def authenticate_user(self, personal_number: str, password: str) -> Optional[User]:
        user = await self.crud.get_by_personal_number(personal_number)
        if not user or not user.hashed_password:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user