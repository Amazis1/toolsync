from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.models.user import User
from app.utils.database import get_db
from app.schemas.auth import LoginRequest, AdminLoginRequest, TokenResponse
from app.schemas.user import UserRead
from app.services.auth_service import AuthService
router = APIRouter()
@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    user, token = await service.login_user(request.personal_number)
    if not user or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültige Personalnummer",
        )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )

@router.post("/admin/login", response_model=TokenResponse)
async def admin_login(
    request: AdminLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    user, token = await service.login_admin(request.personal_number, request.password)
    if not user or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültige Personalnummer oder Passwort",
        )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )

@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Liefert den aktuell angemeldeten Benutzer."""
    return current_user
