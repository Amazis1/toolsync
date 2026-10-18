from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.plant import resolve_active_plant_id
from app.models.master_data import Plant
from app.models.user import User
from app.schemas.auth import LoginRequest, AdminLoginRequest, TokenResponse
from app.schemas.user import UserRead
from app.services.auth_service import AuthService
from app.utils.database import get_db

router = APIRouter()


async def _user_read(
    db: AsyncSession, user: User, x_plant_id: Optional[str] = None
) -> UserRead:
    """Antwort für Login und `/me` – inklusive aufgelöstem Arbeitswerk (DEC-070).

    Reihenfolge: Header `X-Plant-Id` (Wahl im Browser) → `users.default_plant_id` →
    erstes Werk. Ein **unbekanntes** Werk im Header ist ein Fehler (400) und kein
    stiller Rückfall: sonst arbeitet jemand unwissentlich im falschen Werk.
    """
    werk: Optional[Plant] = None
    if x_plant_id not in (None, ""):
        try:
            werk_id = int(x_plant_id)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ungültiges Arbeitswerk im Header: {x_plant_id!r}",
            ) from None
        werk = await db.get(Plant, werk_id)
        if werk is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Arbeitswerk {werk_id} existiert nicht.",
            )
    else:
        werk = await db.get(Plant, await resolve_active_plant_id(db, user))

    daten = UserRead.model_validate(user)
    if werk is not None:
        daten.plant_id = werk.id
        daten.plant_name = werk.name
        daten.plant_color = werk.color
    return daten


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
        user=await _user_read(db, user),
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
        user=await _user_read(db, user),
    )


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_plant_id: Optional[str] = Header(default=None, alias="X-Plant-Id"),
):
    """Der angemeldete Benutzer **und** sein aktuelles Arbeitswerk.

    `plant_id`, `plant_name` und `plant_color` sind das aufgelöste Arbeitswerk
    (DEC-070); das Frontend setzt daraus Werkfarbe und Umschalter. `default_plant_id`
    bleibt die Vorgabe aus dem Konto.
    """
    return await _user_read(db, current_user, x_plant_id)
