from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Set

from ..models.storage import Cabinet, Drawer, Position
from ..models.tool import Tool
from ..models.movement import ToolMovement
from ..models.enums import MovementType, MovementStatus
from ..crud.crud_location import CRUDCabinet, CRUDDrawer, CRUDPosition


class LocationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.cabinet_crud = CRUDCabinet(db)
        self.drawer_crud = CRUDDrawer(db)
        self.position_crud = CRUDPosition(db)

    # ------------------------------------------------------------------
    # Lesen
    # ------------------------------------------------------------------
    async def get_cabinets(self, plant_id: int) -> List[Cabinet]:
        return await self.cabinet_crud.get_by_plant(plant_id)

    async def get_drawers(self, cabinet_id: int) -> List[Drawer]:
        return await self.drawer_crud.get_by_cabinet(cabinet_id)

    async def get_positions(self, drawer_id: int) -> List[Position]:
        return await self.position_crud.get_by_drawer(drawer_id)

    # ------------------------------------------------------------------
    # Verschiebe-Operationen (move / swap / insert_at)
    # ------------------------------------------------------------------
    async def move_position(
        self,
        source_position_id: int,
        target_position_id: int,
        user_id: int | None = None,
    ) -> List[Position]:
        """Belegtes Fach verschieben auf einen freien Platz.

        - Quelle muss belegt sein.
        - Ziel muss frei sein.
        - Quelle und Ziel dürfen in unterschiedlichen Schubladen liegen.
        """
        if source_position_id == target_position_id:
            raise ValueError("Quelle und Ziel sind identisch.")

        source = await self.position_crud.get(source_position_id)
        target = await self.position_crud.get(target_position_id)
        if not source or not target:
            raise ValueError("Quelle oder Ziel existiert nicht.")
        if source.tool_id is None:
            raise ValueError("Die Quelle ist nicht belegt.")
        if target.tool_id is not None:
            raise ValueError(
                "Das Ziel ist belegt. Bitte die Aktion als 'Tausch' ausführen."
            )

        tool = await self.db.get(Tool, source.tool_id)
        if tool is None:
            raise ValueError(f"Werkzeug {source.tool_id} existiert nicht.")

        from_code = await self._position_code(source)
        to_code = await self._position_code(target)

        target.tool_id = source.tool_id
        source.tool_id = None
        tool.position_id = target.id

        self._add_movement(tool.id, from_code, to_code, user_id, "move")

        await self.db.commit()
        return await self._get_positions_for_drawer_ids(
            {source.drawer_id, target.drawer_id}
        )

    async def swap_positions(
        self,
        source_position_id: int,
        target_position_id: int,
        user_id: int | None = None,
    ) -> List[Position]:
        """Zwei belegte Plätze tauschen – nur diese zwei Werkzeuge.

        - Beide Plätze müssen belegt sein.
        - Quelle und Ziel dürfen in unterschiedlichen Schubladen liegen.
        """
        if source_position_id == target_position_id:
            raise ValueError("Quelle und Ziel sind identisch.")

        source = await self.position_crud.get(source_position_id)
        target = await self.position_crud.get(target_position_id)
        if not source or not target:
            raise ValueError("Quelle oder Ziel existiert nicht.")
        if source.tool_id is None:
            raise ValueError("Die Quelle ist nicht belegt.")
        if target.tool_id is None:
            raise ValueError(
                "Das Ziel ist nicht belegt. Bitte die Aktion als 'Verschieben' ausführen."
            )

        source_tool = await self.db.get(Tool, source.tool_id)
        target_tool = await self.db.get(Tool, target.tool_id)
        if source_tool is None or target_tool is None:
            raise ValueError("Mindestens ein Werkzeug existiert nicht.")

        source_code = await self._position_code(source)
        target_code = await self._position_code(target)
        source.tool_id, target.tool_id = target.tool_id, source.tool_id
        source_tool.position_id = target.id
        target_tool.position_id = source.id
        self._add_movement(source_tool.id, source_code, target_code, user_id, "swap")
        self._add_movement(target_tool.id, target_code, source_code, user_id, "swap")

        await self.db.commit()
        return await self._get_positions_for_drawer_ids(
            {source.drawer_id, target.drawer_id}
        )

    async def insert_at_position(
        self,
        source_position_id: int,
        target_position_id: int,
        user_id: int | None = None,
    ) -> List[Position]:
        """Ein Werkzeug von außen auf einem belegten Platz einreihen.

        - Quelle muss belegt sein.
        - Quelle muss aus einer ANDEREN Schublade kommen als das Ziel.
        - Ist das Ziel frei, verhält es sich wie ein einfacher Move.
        - Ist das Ziel belegt, rücken alle Werkzeuge ab diesem Platz
          innerhalb der Ziel-Schublade einen Platz weiter. Ist der letzte
          Platz der Ziel-Schublade belegt, wird blockiert.
        """
        if source_position_id == target_position_id:
            raise ValueError("Quelle und Ziel sind identisch.")

        source = await self.position_crud.get(source_position_id)
        target = await self.position_crud.get(target_position_id)
        if not source or not target:
            raise ValueError("Quelle oder Ziel existiert nicht.")
        if source.tool_id is None:
            raise ValueError("Die Quelle ist nicht belegt.")
        if source.drawer_id == target.drawer_id:
            raise ValueError(
                "Einreihen innerhalb derselben Schublade ist nicht möglich. "
                "Bitte 'Verschieben' oder 'Tausch' verwenden."
            )

        inserted_tool = await self.db.get(Tool, source.tool_id)
        if inserted_tool is None:
            raise ValueError(f"Werkzeug {source.tool_id} existiert nicht.")

        # Ziel frei => einfaches Move, kein Shift.
        if target.tool_id is None:
            return await self.move_position(
                source_position_id, target_position_id, user_id
            )

        target_positions = await self._get_ordered_positions(target.drawer_id)

        old_tool_ids = [p.tool_id for p in target_positions]
        new_tool_ids = list(old_tool_ids)

        target_index = next(
            i for i, p in enumerate(target_positions) if p.id == target.id
        )

        # Block, wenn der letzte Platz belegt ist.
        if new_tool_ids[-1] is not None:
            last_name = target_positions[-1].name
            raise ValueError(
                f"Einreihen nicht möglich: Der letzte Platz ({last_name}) "
                "ist belegt. Es würde ein Werkzeug verloren gehen."
            )

        # Ab Zielposition alles um eine Position nach hinten schieben.
        for i in range(len(new_tool_ids) - 1, target_index, -1):
            new_tool_ids[i] = new_tool_ids[i - 1]
        new_tool_ids[target_index] = inserted_tool.id

        old_codes = {p.id: await self._position_code(p) for p in target_positions}
        old_pos_by_tool = {
            p.tool_id: p for p in target_positions if p.tool_id is not None
        }

        source_code = await self._position_code(source)
        target_code = await self._position_code(target)

        for pos, new_tool_id in zip(target_positions, new_tool_ids):
            pos.tool_id = new_tool_id

        # Quelle in der anderen Schublade freigeben und eingereihtes Werkzeug synchronisieren.
        source.tool_id = None
        inserted_tool.position_id = target.id

        # Werkzeuge synchronisieren (ausgenommen None-Plätze).
        for pos in target_positions:
            if pos.tool_id is None:
                continue
            tool = await self.db.get(Tool, pos.tool_id)
            if tool is None:
                raise ValueError(f"Werkzeug {pos.tool_id} existiert nicht.")
            tool.position_id = pos.id

        # Historie: eingereihtes Werkzeug + jedes weitergeschobene Werkzeug.
        self._add_movement(
            inserted_tool.id, source_code, target_code, user_id, "insert_at"
        )

        for new_pos in target_positions:
            new_tool_id = new_pos.tool_id
            if new_tool_id is None or new_tool_id == inserted_tool.id:
                continue
            old_pos = old_pos_by_tool.get(new_tool_id)
            if old_pos is not None and old_pos.id != new_pos.id:
                self._add_movement(
                    new_tool_id,
                    old_codes[old_pos.id],
                    await self._position_code(new_pos),
                    user_id,
                    "insert_at shift",
                )

        await self.db.commit()
        return await self._get_positions_for_drawer_ids(
            {source.drawer_id, target.drawer_id}
        )

    # ------------------------------------------------------------------
    # Löschen ohne Werkzeug-Verlust
    # ------------------------------------------------------------------
    async def _release_tools_from_positions(self, positions: List[Position]) -> None:
        """Belegte Plätze freigeben; Werkzeuge bleiben erhalten (Abglage).

        Setzt beide Seiten der Beziehung zurück:
          - Position.tool_id -> None
          - Tool.position_id -> None
        """
        for position in positions:
            if position.tool_id is None:
                continue
            tool = await self.db.get(Tool, position.tool_id)
            if tool is not None:
                tool.position_id = None
            position.tool_id = None

    async def delete_cabinet(self, cabinet_id: int) -> int:
        """Schrank löschen, ohne eingelagerte Werkzeuge zu verlieren.

        Alle belegten Plätze werden vor dem Löschen freigegeben.
        Die Werkzeuge liegen danach in der Ablage (position_id = NULL).
        """
        result = await self.db.execute(
            select(Cabinet)
            .where(Cabinet.id == cabinet_id)
            .options(selectinload(Cabinet.drawers).selectinload(Drawer.positions))
        )
        cabinet = result.scalar_one_or_none()
        if cabinet is None:
            raise ValueError("Schrank nicht gefunden.")

        positions: List[Position] = [
            position for drawer in cabinet.drawers for position in drawer.positions
        ]
        released = sum(1 for position in positions if position.tool_id is not None)
        await self._release_tools_from_positions(positions)

        await self.db.delete(cabinet)
        await self.db.commit()
        return released

    async def delete_drawer(self, drawer_id: int) -> int:
        """Schublade löschen, ohne eingelagerte Werkzeuge zu verlieren."""
        result = await self.db.execute(
            select(Drawer)
            .where(Drawer.id == drawer_id)
            .options(selectinload(Drawer.positions))
        )
        drawer = result.scalar_one_or_none()
        if drawer is None:
            raise ValueError("Schublade nicht gefunden.")

        released = sum(
            1 for position in drawer.positions if position.tool_id is not None
        )
        await self._release_tools_from_positions(drawer.positions)

        await self.db.delete(drawer)
        await self.db.commit()
        return released

    # ------------------------------------------------------------------
    # Werkzeug-Ablage (nicht eingelagerte Werkzeuge)
    # ------------------------------------------------------------------
    async def get_tray_tools(self, plant_id: int) -> List[Tool]:
        """Alle Werkzeuge eines Werks ohne gültigen Lagerplatz.

        Werkzeuge, deren position_id auf eine nicht mehr existierende
        Position zeigt (Altdaten/Lösch-Reste), werden korrigiert und
        ebenfalls in die Ablage aufgenommen.
        """
        result = await self.db.execute(
            select(Tool).where(Tool.plant_id == plant_id).order_by(Tool.tool_id)
        )
        tools = list(result.scalars().all())

        tray: List[Tool] = []
        changed = False
        for tool in tools:
            if tool.position_id is None:
                tray.append(tool)
                continue
            position = await self.db.get(Position, tool.position_id)
            if position is None:
                tool.position_id = None
                changed = True
                tray.append(tool)
        if changed:
            await self.db.commit()
        return tray

    async def place_tool_at_position(
        self,
        tool_id: int,
        target_position_id: int,
        user_id: int | None = None,
    ) -> List[Position]:
        """Werkzeug aus der Ablage auf einen Platz legen.

        - Ziel frei -> einfaches Einlegen.
        - Ziel belegt -> Einreihen: Werkzeuge ab Ziel rücken eine
          Position weiter. Ist der letzte Platz belegt, wird blockiert.
        """
        tool = await self.db.get(Tool, tool_id)
        if tool is None:
            raise ValueError("Werkzeug existiert nicht.")
        if tool.position_id is not None:
            existing_position = await self.db.get(Position, tool.position_id)
            if existing_position is not None:
                raise ValueError("Das Werkzeug ist bereits eingelagert.")

        target = await self.position_crud.get(target_position_id)
        if target is None:
            raise ValueError("Ziel-Platz existiert nicht.")

        from_code = "Ablage"
        to_code = await self._position_code(target)

        # Ziel frei: einfach ablegen.
        if target.tool_id is None:
            target.tool_id = tool.id
            tool.position_id = target.id
            self._add_movement(tool.id, from_code, to_code, user_id, "place")
            await self.db.commit()
            return await self._get_positions_for_drawer_ids({target.drawer_id})

        # Ziel belegt: einreihen (Shift innerhalb der Ziel-Schublade).
        target_positions = await self._get_ordered_positions(target.drawer_id)
        old_tool_ids = [p.tool_id for p in target_positions]
        new_tool_ids = list(old_tool_ids)

        target_index = next(
            i for i, p in enumerate(target_positions) if p.id == target.id
        )

        if new_tool_ids[-1] is not None:
            last_name = target_positions[-1].name
            raise ValueError(
                f"Einreihen nicht möglich: Der letzte Platz ({last_name}) "
                "ist belegt. Es würde ein Werkzeug verloren gehen."
            )

        for i in range(len(new_tool_ids) - 1, target_index, -1):
            new_tool_ids[i] = new_tool_ids[i - 1]
        new_tool_ids[target_index] = tool.id

        old_codes = {p.id: await self._position_code(p) for p in target_positions}
        old_pos_by_tool = {
            p.tool_id: p for p in target_positions if p.tool_id is not None
        }

        for pos, new_tool_id in zip(target_positions, new_tool_ids):
            pos.tool_id = new_tool_id

        tool.position_id = target.id

        for pos in target_positions:
            if pos.tool_id is None:
                continue
            moved_tool = await self.db.get(Tool, pos.tool_id)
            if moved_tool is None:
                raise ValueError(f"Werkzeug {pos.tool_id} existiert nicht.")
            moved_tool.position_id = pos.id

        self._add_movement(tool.id, from_code, to_code, user_id, "insert_from_tray")

        for new_pos in target_positions:
            new_tool_id = new_pos.tool_id
            if new_tool_id is None or new_tool_id == tool.id:
                continue
            old_pos = old_pos_by_tool.get(new_tool_id)
            if old_pos is not None and old_pos.id != new_pos.id:
                self._add_movement(
                    new_tool_id,
                    old_codes[old_pos.id],
                    await self._position_code(new_pos),
                    user_id,
                    "insert_from_tray shift",
                )

        await self.db.commit()
        return await self._get_positions_for_drawer_ids({target.drawer_id})

    async def release_tool_from_position(
        self,
        position_id: int,
        user_id: int | None = None,
    ) -> List[Position]:
        """Werkzeug vom Platz nehmen und in die Ablage legen."""
        source = await self.position_crud.get(position_id)
        if source is None:
            raise ValueError("Platz existiert nicht.")
        if source.tool_id is None:
            raise ValueError("Der Platz ist nicht belegt.")

        tool = await self.db.get(Tool, source.tool_id)
        if tool is None:
            raise ValueError(f"Werkzeug {source.tool_id} existiert nicht.")

        from_code = await self._position_code(source)
        source.tool_id = None
        tool.position_id = None
        self._add_movement(tool.id, from_code, "Ablage", user_id, "release")

        await self.db.commit()
        return await self._get_positions_for_drawer_ids({source.drawer_id})

    # ------------------------------------------------------------------
    # Sortierung / Laden
    # ------------------------------------------------------------------
    async def _get_ordered_positions(self, drawer_id: int) -> List[Position]:
        query = (
            select(Position)
            .where(Position.drawer_id == drawer_id)
            .options(selectinload(Position.tool))
        )
        result = await self.db.execute(query.execution_options(populate_existing=True))
        positions = list(result.scalars().all())
        # Anzeige-Reihenfolge: unterste Reihe zuerst, in der Reihe links nach rechts.
        return sorted(positions, key=lambda p: (-p.y, p.x))

    async def _get_positions_for_drawer_ids(
        self, drawer_ids: Set[int]
    ) -> List[Position]:
        positions: List[Position] = []
        for drawer_id in drawer_ids:
            positions.extend(await self._get_ordered_positions(drawer_id))
        return positions

    async def _position_code(self, position: Position) -> str:
        """Platz-Code wie '03-C-02' erzeugen."""
        drawer = await self.db.get(Drawer, position.drawer_id)
        if drawer is None:
            return f"??-??-{position.name}"
        cabinet = await self.db.get(Cabinet, drawer.cabinet_id)
        return f"{cabinet.name if cabinet else '??'}-{drawer.name}-{position.name}"

    def _add_movement(
        self,
        tool_id: int,
        from_code: str,
        to_code: str,
        user_id: int | None,
        note: str,
    ) -> None:
        """Bewegungseintrag hinzufügen – wird mit dem zentralen Commit gespeichert."""
        self.db.add(
            ToolMovement(
                movement_type=MovementType.RELOCATE,
                from_location=from_code,
                to_location=to_code,
                status=MovementStatus.COMPLETED,
                note=note,
                tool_id=tool_id,
                user_id=user_id,
            )
        )
