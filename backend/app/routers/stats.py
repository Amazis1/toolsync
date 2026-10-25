"""Kennzahlen für die rechte Spalte (DEC-089).

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/stats/overview` | Zahlen des Arbeitswerks für die Karten der rechten Spalte |

Die Zahlen gelten für das **Arbeitswerk** aus `X-Plant-Id` (dieselbe Regel wie in
der Werkzeugliste und der Logistik). Lesen darf jeder aktive Benutzer – die Karten
zeigen nichts, was nicht ohnehin in den Listen steht.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.permissions import require_active
from app.dependencies.plant import get_active_plant
from app.models.master_data import Plant
from app.models.user import User
from app.schemas.stats import StatsOverview
from app.services.stats_service import StatsService
from app.utils.database import get_db

router = APIRouter()


@router.get("/overview", response_model=StatsOverview)
async def overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
) -> StatsOverview:
    return await StatsService(db).overview(plant.id)
