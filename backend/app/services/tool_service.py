"""Tool-Service: Business-Logik für Werkzeuge inkl. Lagerplatz-Synchronisierung."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from ..models.tool import Tool
from ..models.storage import Position
from ..models.enums import ToolCategory
from ..crud.crud_tool import CRUDTool


class ToolService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDTool(db)

    async def get_tools(
        self,
        tool_id: Optional[str] = None,
        category: Optional[ToolCategory] = None,
        plant_id: Optional[int] = None,
        is_storage: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Tool]:
        return await self.crud.get_multi(
            tool_id=tool_id,
            category=category,
            plant_id=plant_id,
            is_storage=is_storage,
            skip=skip,
            limit=limit,
        )

    async def get_tool(self, tool_id: int) -> Optional[Tool]:
        return await self.crud.get(tool_id)

    async def check_tool_id(
        self,
        tool_id: str,
        category: ToolCategory,
        plant_id: int,
        is_storage: bool = False,
        exclude_id: Optional[int] = None,
    ) -> dict:
        """Live-Pruefung der Werkzeug-ID (fuer das Anlegeformular).

        Normale Werkzeuge: ID muss in Werk + Kategorie eindeutig sein.
        Lager/Ersatz (is_storage=True): Mehrfach-IDs sind ausdruecklich
        erlaubt - die Anzahl zeigt, als wievieltes Exemplar angelegt wird.
        """
        count = await self.crud.count_by_tool_id(
            tool_id, category, plant_id, is_storage, exclude_id=exclude_id
        )

        if is_storage:
            if count == 0:
                message = "ID ist frei - wird als 1. Exemplar angelegt."
            else:
                message = (
                    f"ID existiert bereits {count}x - "
                    f"wird als {count + 1}. Exemplar angelegt."
                )
            return {
                "available": True,
                "existing_count": count,
                "message": message,
            }

        if count > 0:
            return {
                "available": False,
                "existing_count": count,
                "message": f"Werkzeug-ID {tool_id} ist in diesem Werk bereits vergeben.",
            }
        return {
            "available": True,
            "existing_count": 0,
            "message": "Werkzeug-ID ist frei.",
        }

    async def create_tool(self, data) -> Tool:
        # is_storage muss mitgegeben werden, sonst wird immer gegen die
        # normalen Werkzeuge geprueft und Lager/Ersatz laeuft ins Leere.
        existing = await self.crud.get_by_tool_id(
            data.tool_id, data.category, data.plant_id, data.is_storage
        )
        if existing and not data.allow_duplicate_id:
            raise ValueError(f"Werkzeug-ID {data.tool_id} existiert bereits!")

        # Wenn ein Platz angegeben ist, prüfen ob er frei ist
        if data.position_id:
            position = await self._get_position(data.position_id)
            if not position:
                raise ValueError("Angegebener Platz existiert nicht.")
            if position.tool_id is not None:
                raise ValueError(f"Platz {position.name} ist bereits belegt.")

        tool = await self.crud.create(data)

        # Position-Tool-Sync: tool_id an der Position setzen
        if data.position_id:
            await self._set_position_tool(data.position_id, tool.id)

        return tool

    async def update_tool(self, tool_id: int, data) -> Tool:
        old_tool = await self.crud.get(tool_id)
        if not old_tool:
            return None

        # Duplikat-Pruefung auch beim Bearbeiten - das eigene Werkzeug
        # wird ueber exclude_id ausgenommen, sonst blockiert es sich selbst.
        existing = await self.crud.get_by_tool_id(
            data.tool_id,
            data.category,
            data.plant_id,
            data.is_storage,
            exclude_id=tool_id,
        )
        if existing and not data.allow_duplicate_id:
            raise ValueError(f"Werkzeug-ID {data.tool_id} existiert bereits!")

        old_position_id = old_tool.position_id
        # position_id: Optional[int]; getattr liefert None sowohl für
        # "nicht gesetzt" als auch für "explizit None". Über hasattr
        # prüfen wir, ob der Aufrufer das Feld bewusst gesendet hat.
        if hasattr(data, "position_id"):
            new_position_id = data.position_id
        else:
            new_position_id = old_position_id

        # Neuer Platz: existiert er und ist er frei?
        if new_position_id and new_position_id != old_position_id:
            position = await self._get_position(new_position_id)
            if not position:
                raise ValueError("Angegebener Platz existiert nicht.")
            if position.tool_id is not None:
                raise ValueError(f"Platz {position.name} ist bereits belegt.")

        tool = await self.crud.update(tool_id, data)
        if not tool:
            return None

        # CRUDBase.update überspringt None-Werte. Für position_id = None
        # (Werkzeug in die Ablage legen) explizit nachziehen.
        if new_position_id is None and tool.position_id is not None:
            tool.position_id = None
            await self.db.commit()
            await self.db.refresh(tool)

        # Alten Platz freigeben, wenn sich die Position geändert hat
        if old_position_id and old_position_id != new_position_id:
            await self._release_position(old_position_id)

        # Neuen Platz belegen (None = Ablage, nichts zu belegen)
        if new_position_id:
            await self._set_position_tool(new_position_id, tool.id)

        return tool

    async def delete_tool(self, tool_id: int) -> None:
        tool = await self.crud.get(tool_id)
        if tool and tool.position_id:
            await self._release_position(tool.position_id)
        await self.crud.delete(tool_id)

    # ---------------------------------------------------------
    # Hilfsfunktionen für die Platz-Synchronisierung
    # ---------------------------------------------------------
    async def _get_position(self, position_id: int) -> Optional[Position]:
        result = await self.db.execute(
            select(Position).where(Position.id == position_id)
        )
        return result.scalar_one_or_none()

    async def _set_position_tool(self, position_id: int, tool_id: int) -> None:
        position = await self._get_position(position_id)
        if position:
            position.tool_id = tool_id
            await self.db.commit()

    async def _release_position(self, position_id: int) -> None:
        position = await self._get_position(position_id)
        if position:
            position.tool_id = None
            await self.db.commit()
