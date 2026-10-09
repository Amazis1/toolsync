"""Ersatzteile: Geschäftslogik (DEC-064).

Ersatzteile sind **Bestand**, keine Leihobjekte: es gibt keine Dateien, keine
Ablage, keinen Status und keine Bewegungen. Der Service prüft deshalb nur die
Pflichtangaben und die Stammdaten – und stellt sicher, dass ein gelöschtes Werk
oder eine gelöschte Maschine nicht als Fremdschlüsselfehler (HTTP 500) aus der
Datenbank zurückkommt, sondern als verständliche Meldung.
"""

from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.crud_spare_part import (
    CRUDSparePart,
    SparePartSortKey,
    SparePartSortOrder,
)
from ..models.master_data import Machine, Plant
from ..models.spare_part import SparePart
from ..models.storage import Cabinet, Drawer, Position
from ..schemas.spare_part import SparePartCreate, SparePartUpdate


class SparePartService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDSparePart(db)

    async def get(self, id: int) -> Optional[SparePart]:
        return await self.crud.get(id)

    async def get_all(
        self,
        search: Optional[str] = None,
        plant_id: Optional[int] = None,
        machine_id: Optional[int] = None,
        type: Optional[str] = None,
        favorites_only: bool = False,
        sort: SparePartSortKey = "article_number",
        order: SparePartSortOrder = "asc",
        skip: int = 0,
        limit: int = 25,
    ) -> Tuple[List[SparePart], int]:
        return await self.crud.get_multi(
            search=search,
            plant_id=plant_id,
            machine_id=machine_id,
            type=type,
            favorites_only=favorites_only,
            sort=sort,
            order=order,
            skip=skip,
            limit=limit,
        )

    async def set_favorite(
        self, id: int, is_favorite: bool
    ) -> Optional[SparePart]:
        """Favoriten-Markierung setzen (global, DEC-063)."""
        return await self.crud.set_favorite(id, is_favorite)

    async def count_by_article_number(
        self, article_number: str, exclude_id: Optional[int] = None
    ) -> int:
        return await self.crud.count_by_article_number(article_number, exclude_id)

    async def position_codes(self, position_ids: Set[int]) -> Dict[int, str]:
        """Platz-Codes („01-A-25") für mehrere Plätze – **eine** Abfrage.

        Für die Liste: ohne diese Bündelung käme pro Zeile eine eigene Abfrage
        (Schrank, Schublade, Platz). Unbekannte Plätze fehlen im Ergebnis.
        """
        if not position_ids:
            return {}
        query = (
            select(Position.id, Position.name, Drawer.name, Cabinet.name)
            .join(Drawer, Position.drawer_id == Drawer.id)
            .join(Cabinet, Drawer.cabinet_id == Cabinet.id)
            .where(Position.id.in_(position_ids))
        )
        rows = await self.db.execute(query)
        return {
            position_id: f"{cabinet_name or '??'}-{drawer_name or '??'}-{position_name}"
            for position_id, position_name, drawer_name, cabinet_name in rows
        }

    async def create(self, data: SparePartCreate) -> SparePart:
        await self._assert_master_data(data.plant_id, data.machine_id)
        await self._assert_position(data.plant_id, data.position_id)
        return await self.crud.create_part(data)

    async def update(
        self, id: int, data: SparePartUpdate
    ) -> Optional[SparePart]:
        part = await self.crud.get(id)
        if part is None:
            return None
        await self._assert_master_data(data.plant_id, data.machine_id)
        await self._assert_position(data.plant_id, data.position_id, exclude_id=id)
        values = {
            "article_number": data.article_number,
            "name": data.name,
            "type": data.type,
            "plant_id": data.plant_id,
            "quantity": data.quantity,
            "unit": data.unit,
            "machine_id": data.machine_id,
            "storage_place": data.storage_place,
            "position_id": data.position_id,
            "description": data.description,
        }
        return await self.crud.apply_update(part, values)

    async def delete(self, id: int) -> bool:
        """Ersatzteil löschen. False, wenn es den Datensatz nicht gibt.

        Es hängt nichts an einem Ersatzteil – keine Dateien, keine Bewegungen –,
        deshalb genügt das Entfernen der Zeile.
        """
        part = await self.crud.get(id)
        if part is None:
            return False
        await self.db.delete(part)
        await self.db.commit()
        return True

    async def _assert_master_data(
        self, plant_id: Optional[int], machine_id: Optional[int]
    ) -> None:
        """Werk muss existieren; die Maschine, wenn sie angegeben ist.

        Ohne diese Prüfung käme bei einer gelöschten Maschine ein
        Fremdschlüsselfehler aus der Datenbank als HTTP 500 zurück.
        """
        if plant_id is None:
            raise ValueError("Bitte ein Werk auswählen.")

        plant = await self.db.get(Plant, plant_id)
        if plant is None:
            raise ValueError("Das gewählte Werk gibt es nicht mehr. Lade die Seite neu.")

        if machine_id is not None:
            machine = await self.db.get(Machine, machine_id)
            if machine is None:
                raise ValueError(
                    "Die gewählte Maschine gibt es nicht mehr. Lade die Seite neu."
                )

    async def _assert_position(
        self,
        plant_id: Optional[int],
        position_id: Optional[int],
        exclude_id: Optional[int] = None,
    ) -> None:
        """Ein Matrix-Platz muss existieren, zum Werk passen und **frei** sein.

        Frei heißt: kein Werkzeug darauf (`positions.tool_id`) und kein anderes
        Ersatzteil. Damit gilt dieselbe Regel wie bei Werkzeugen – ein Platz darf
        nicht doppelt belegt sein (Anforderung 7.2, DEC-064).
        """
        if position_id is None:
            return

        position = await self.db.get(Position, position_id)
        if position is None:
            raise ValueError(
                "Den gewählten Lagerplatz gibt es nicht mehr. Lade die Seite neu."
            )

        # Werk prüfen: Platz → Schublade → Schrank → Werk. Ohne diese Prüfung
        # könnte ein Ersatzteil im Werk 1 auf einem Platz im Werk 2 liegen.
        drawer = await self.db.get(Drawer, position.drawer_id)
        cabinet = await self.db.get(Cabinet, drawer.cabinet_id) if drawer else None
        if cabinet is None or cabinet.plant_id != plant_id:
            raise ValueError("Der gewählte Lagerplatz gehört zu einem anderen Werk.")

        if position.tool_id is not None:
            raise ValueError(f"Platz {position.name} ist mit einem Werkzeug belegt.")

        belegt = await self.crud.count_by_position(position_id, exclude_id)
        if belegt > 0:
            raise ValueError(
                f"Platz {position.name} ist bereits mit einem Ersatzteil belegt."
            )
