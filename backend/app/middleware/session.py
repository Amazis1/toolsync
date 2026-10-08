"""Rollierende Sitzung: verlaengert den JWT bei Aktivitaet.

Jede authentifizierte Anfrage gilt als Aktivitaet. Ist der Token gueltig,
wird ein frischer Token mit voller Laufzeit ausgestellt und im Antwort-Header
mitgegeben. Ohne Aktivitaet laeuft der Token nach
`jwt_access_token_expire_minutes` ab - dann liefert die Auth-Dependency 401.
"""

from datetime import datetime, timezone

from fastapi import Request
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import create_access_token

# Antwort-Header, die das Frontend auswertet.
NEW_TOKEN_HEADER = "X-New-Token"
TOKEN_EXPIRES_HEADER = "X-Token-Expires-At"


async def sliding_session_middleware(request: Request, call_next):
    response = await call_next(request)

    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return response

    token = auth[7:].strip()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        # Ungueltig oder abgelaufen -> die Dependency liefert gleich 401.
        # Hier nichts anhaengen, sonst wuerde ein toter Token "erneuert".
        return response

    sub = payload.get("sub")
    if not sub:
        return response

    # Gueltige Anfrage = Aktivitaet -> neue volle Laufzeit.
    refreshed = create_access_token(
        {"sub": sub, "is_admin": bool(payload.get("is_admin"))}
    )
    response.headers[NEW_TOKEN_HEADER] = refreshed
    response.headers[TOKEN_EXPIRES_HEADER] = str(
        int(
            datetime.now(timezone.utc).timestamp()
            + settings.jwt_access_token_expire_minutes * 60
        )
    )
    return response