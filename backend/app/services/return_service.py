"""Rückgabe eines Werkzeugs an eine Person (DEC-078, ersetzt den offenen Punkt TASK-025a).

Vorher gab es **keine** Rückgabe in der Oberfläche: Ein ausgeliehenes Werkzeug blieb
für immer auf `lent` (docs/08 §7). Diese Datei schließt die Lücke:

* `return_tool(tool_id, user_id, plant_id, note)` – eine **Transaktion**: Werkzeug auf
  `available`, Bewegung mit Ausgangsort (Heimatplatz oder „Ablage"), Rückgabeort
  (Arbeitswerk) und dem **angemeldeten Benutzer** als Ausführendem.
* `list_active_loans(plant_id)` – die laufenden Ausleihen mit Werkzeug, Platz und
  Ausleiher (für die Rückgabe-Liste; ein Werkzeug wird **einzeln** zurückgegeben).

Der Ausleiher wird nicht mehr als Klartext-Personalnummer in die Notiz geschrieben
(siehe `docs/08` §7): die Bewegung trägt `user_id` und `plant_id` – damit ist
„welcher Benutzer, welches Werk" auswertbar (Anforderung 9/10).
"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.enums import MovementStatus, MovementType, ToolStatus
from ..models.movement import ToolMovement
from ..models.storage import Cabinet, Drawer, Position
from ..models.tool import Tool
from ..schemas.movement import ActiveLoan


class ReturnService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Rückgabe
    # ------------------------------------------------------------------
    async def return_tool(
        self,
        tool_id: int,
        user_id: Optional[int],
        plant_id: Optional[int],
        note: Optional[str] = None,
    ) -> Tool:
        """Werkzeug zurücknehmen. Werkzeug-Status und Verlauf in **einer** Transaktion."""
        tool = await self.db.get(Tool, tool_id)
        if tool is None:
            raise ValueError(f"Werkzeug {tool_id} existiert nicht.")
        if tool.status != ToolStatus.LENT:
            aktuell = tool.status.value if tool.status else "kein Status"
            name = tool.tool_id or "ohne ID"
            raise ValueError(
                f"Werkzeug {name} ist nicht ausgeliehen (aktueller Status: {aktuell}) "
                "und kann nicht zurückgegeben werden."
            )

        from_code = await self._position_code(tool)
        to_code = await self._plant_name(plant_id) if plant_id else "Ablage"

        tool.status = ToolStatus.AVAILABLE

        bewegung = ToolMovement(
            movement_type=MovementType.RETURN,
            from_location=from_code,
            to_location=to_code,
            status=MovementStatus.COMPLETED,
            note=(note or "").strip() or None,
            tool_id=tool.id,
            user_id=user_id,
            plant_id=plant_id,
        )
        self.db.add(bewegung)

        await self.db.commit()
        await self.db.refresh(tool)
        return tool

    # ------------------------------------------------------------------
    # Laufende Ausleihen
    # ------------------------------------------------------------------
    async def list_active_loans(self, plant_id: Optional[int] = None) -> List[ActiveLoan]:
        """Alle Werkzeuge mit Status `lent`, samt Platz und Ausleiher.

        Grundlage ist die **letzte** `lend`-Bewegung je Werkzeug: sie nennt den
        Ausleiher (`user_id`) und die Personalnummer, falls sie früher als Text
        in der Notiz stand. Werkzeuge ohne Ausleih-Bewegung erscheinen ohne
        Ausleiher – der Status ist maßgeblich, nicht die Historie.
        """
        query = (
            select(Tool)
            .where(Tool.status == ToolStatus.LENT)
            .options(selectinload(Tool.plant))
            .order_by(Tool.tool_id)
        )
        if plant_id is not None:
            query = query.where(Tool.plant_id == plant_id)
        werkzeuge = list((await self.db.execute(query)).scalars().all())
        if not werkzeuge:
            return []

        ids = [t.id for t in werkzeuge]
        bewegungen = list(
            (
                await self.db.execute(
                    select(ToolMovement)
                    .where(
                        ToolMovement.tool_id.in_(ids),
                        ToolMovement.movement_type == MovementType.LEND,
                    )
                    .options(selectinload(ToolMovement.user))
                    .order_by(ToolMovement.timestamp.desc(), ToolMovement.id.desc())
                )
            )
            .scalars()
            .all()
        )
        letzte: dict[int, ToolMovement] = {}
        for bewegung in bewegungen:
            letzte.setdefault(bewegung.tool_id, bewegung)

        ergebnis: List[ActiveLoan] = []
        for tool in werkzeuge:
            bewegung = letzte.get(tool.id)
            ergebnis.append(
                ActiveLoan(
                    movement_id=bewegung.id if bewegung else 0,
                    tool_id=tool.id,
                    tool_code=tool.tool_id,
                    description=tool.description,
                    category=tool.category.value if tool.category else None,
                    measure_a=tool.measure_a,
                    position_code=await self._position_code(tool),
                    lent_at=bewegung.timestamp if bewegung else None,
                    user_id=bewegung.user_id if bewegung else None,
                    user_display_name=bewegung.user_display_name if bewegung else None,
                    note=bewegung.note if bewegung else None,
                )
            )
        return ergebnis

    # ------------------------------------------------------------------
    # Hilfen
    # ------------------------------------------------------------------
    async def _position_code(self, tool: Tool) -> str:
        """Platz-Code wie `03-C-02`; ohne Platz `Ablage`."""
        if tool.position_id is None:
            return "Ablage"
        position = await self.db.get(Position, tool.position_id)
        if position is None:
            return "Ablage"
        drawer = await self.db.get(Drawer, position.drawer_id)
        if drawer is None:
            return position.name or "Ablage"
        cabinet = await self.db.get(Cabinet, drawer.cabinet_id)
        cabinet_name = cabinet.name if cabinet else "??"
        return f"{cabinet_name}-{drawer.name}-{position.name}"

    async def _plant_name(self, plant_id: int) -> str:
        from ..models.master_data import Plant

        plant = await self.db.get(Plant, plant_id)
        return plant.name if plant else "Arbeitswerk"
