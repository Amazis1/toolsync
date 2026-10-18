"""Aktives Arbeitswerk eines Requests (DEC-070).

Das Arbeitswerk ist **kein Stammdatenfeld am Benutzer**, sondern der Kontext, in dem
er gerade arbeitet: Das Personal rotiert zwischen den Werken, die Wahl gilt pro
Benutzer **und** Rechner und ist jederzeit änderbar. Deshalb bringt das Frontend die
Wahl als Header `X-Plant-Id` mit; das Backend prüft sie und löst sie auf.

Reihenfolge:
1. Header `X-Plant-Id` – muss ein existierendes Werk sein, sonst **HTTP 400**
   (kein stiller Rückfall; ein unbekanntes Werk wäre ein Fehler im Client).
2. `users.default_plant_id` – Vorgabe aus dem Benutzerkonto.
3. Das erste Werk der Datenbank – damit die App auch ohne gepflegte Vorgabe läuft.

Das Arbeitswerk **filtert nichts**: Die bestehenden Werk-Filter in den Listen bleiben
bedienbar. Es belegt Formulare vor und bezeugt, wer für welches Werk gehandelt hat.
"""

from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.master_data import Plant
from app.models.user import User
from app.utils.database import get_db
from app.dependencies.permissions import require_active


async def get_active_plant(
    x_plant_id: Optional[str] = Header(default=None, alias="X-Plant-Id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
) -> Plant:
    """Das Arbeitswerk dieses Requests – aufgelöst und geprüft."""
    if x_plant_id not in (None, ""):
        try:
            plant_id = int(x_plant_id)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ungültiges Arbeitswerk im Header: {x_plant_id!r}",
            ) from None
        plant = await db.get(Plant, plant_id)
        if plant is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Arbeitswerk {plant_id} existiert nicht.",
            )
        return plant

    if current_user.default_plant_id is not None:
        plant = await db.get(Plant, current_user.default_plant_id)
        if plant is not None:
            return plant

    result = await db.execute(select(Plant).order_by(Plant.id).limit(1))
    plant = result.scalar_one_or_none()
    if plant is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Es ist kein Werk angelegt – bitte zuerst ein Werk in den Stammdaten erstellen.",
        )
    return plant


async def resolve_active_plant_id(db: AsyncSession, user: User) -> int:
    """Dasselbe ohne Header – für Antworten, die nur die Kennung brauchen
    (z. B. `/auth/me`). Hier gilt: Vorgabe aus dem Konto, sonst erstes Werk."""
    if user.default_plant_id is not None:
        plant = await db.get(Plant, user.default_plant_id)
        if plant is not None:
            return plant.id
    result = await db.execute(select(Plant).order_by(Plant.id).limit(1))
    plant = result.scalar_one_or_none()
    if plant is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Es ist kein Werk angelegt – bitte zuerst ein Werk in den Stammdaten erstellen.",
        )
    return plant.id
