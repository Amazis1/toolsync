from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.services.auth_service import AuthService
from app.utils.database import get_db

# OAuth2-Schema – zentral definiert, damit es überall wiederverwendet werden kann.
# auto_error=False: Wir behandeln fehlende Tokens selbst und werfen eine saubere 401.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Liest den JWT, dekodiert ihn und lädt den Benutzer aus der Datenbank.

    - Wirft 401 bei fehlendem oder ungültigem Token.
    - Wirft 401, wenn der Benutzer nicht (mehr) existiert.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nicht authentifiziert",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        personal_number = payload.get("sub")
        if not personal_number:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ungültiger Token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger Token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    service = AuthService(db)
    user = await service.get_user_by_personal_number(personal_number)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Benutzer nicht gefunden",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user