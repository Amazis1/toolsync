"""Tests für die rollierende Sitzung (app/middleware/session.py).

Die Middleware hängt bei einer gültigen authentifizierten Anfrage einen
frischen Token in den Antwort-Header. Bei fehlendem oder ungültigem Token
passiert nichts.

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_session_middleware.py -q
"""

import pytest
from starlette.requests import Request
from starlette.responses import Response

from jose import jwt

from app.core.config import settings
from app.core.security import create_access_token
from app.middleware.session import (
    NEW_TOKEN_HEADER,
    TOKEN_EXPIRES_HEADER,
    sliding_session_middleware,
)


def _make_request(token: str | None) -> Request:
    headers = []
    if token is not None:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/tools/",
        "headers": headers,
    }
    return Request(scope)


async def _call_next_ok(request: Request) -> Response:
    return Response(status_code=200)


@pytest.mark.asyncio
async def test_valid_token_gets_renewed_header():
    """Eine gültige Anfrage bekommt einen frischen Token im Header."""
    token = create_access_token({"sub": "1001", "is_admin": False})
    response = await sliding_session_middleware(_make_request(token), _call_next_ok)

    fresh = response.headers.get(NEW_TOKEN_HEADER)
    assert fresh is not None, "Gueltige Anfrage muss einen neuen Token erhalten"

    # Der neue Token ist gültig und traegt denselben Benutzer.
    payload = jwt.decode(
        fresh, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    assert payload["sub"] == "1001"

    # Ablaufzeitpunkt wird mitgeliefert.
    assert response.headers.get(TOKEN_EXPIRES_HEADER) is not None


@pytest.mark.asyncio
async def test_missing_token_gets_no_renewal():
    """Ohne Bearer-Header wird nichts angehaengt."""
    response = await sliding_session_middleware(_make_request(None), _call_next_ok)
    assert response.headers.get(NEW_TOKEN_HEADER) is None


@pytest.mark.asyncio
async def test_invalid_token_gets_no_renewal():
    """Ein ungueltiger Token darf nicht 'erneuert' werden."""
    response = await sliding_session_middleware(
        _make_request("not-a-valid-jwt"), _call_next_ok
    )
    assert response.headers.get(NEW_TOKEN_HEADER) is None