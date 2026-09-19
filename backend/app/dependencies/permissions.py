from fastapi import Depends, HTTPException, status

from app.models.user import User

from .auth import get_current_user


async def require_active(user: User = Depends(get_current_user)) -> User:
    """Stellt sicher, dass der Benutzer aktiv ist.

    - Dient als Basis für alle geschützten Endpunkte.
    - Wirft 403, wenn der Benutzer deaktiviert wurde.
    """
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Benutzerkonto ist deaktiviert",
        )
    return user


async def require_admin(user: User = Depends(require_active)) -> User:
    """Stellt sicher, dass der Benutzer Administrator ist.

    - Baut auf require_active auf (Admin muss auch aktiv sein).
    - Wirft 403, wenn der Benutzer kein Admin ist.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator-Rechte erforderlich",
        )
    return user