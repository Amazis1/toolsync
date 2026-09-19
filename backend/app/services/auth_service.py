from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Tuple
from ..models.user import User
from ..crud.crud_user import CRUDUser
from ..core.security import verify_password, create_access_token


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDUser(db)

    async def login_user(
        self, personal_number: str
    ) -> Tuple[Optional[User], Optional[str]]:
        user = await self.crud.get_by_personal_number(personal_number)
        if not user or not user.is_active:
            return None, None
        # Admin-Konten duerfen NICHT ueber den passwortlosen Benutzer-Login.
        if user.is_admin:
            return None, None
        token = create_access_token({"sub": personal_number, "is_admin": user.is_admin})
        return user, token

    async def login_admin(
        self, personal_number: str, password: str
    ) -> Tuple[Optional[User], Optional[str]]:
        user = await self.crud.get_by_personal_number(personal_number)
        if not user or not user.is_active or not user.is_admin:
            return None, None
        if not verify_password(password, user.hashed_password):
            return None, None
        token = create_access_token({"sub": personal_number, "is_admin": True})
        return user, token

    async def get_user_by_personal_number(self, personal_number: str) -> Optional[User]:
        return await self.crud.get_by_personal_number(personal_number)
