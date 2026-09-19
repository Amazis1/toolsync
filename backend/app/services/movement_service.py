from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from ..models.movement import ToolMovement
from ..models.tool import Tool
from ..models.user import User
from ..models.enums import MovementType, MovementStatus, ToolStatus
from ..crud.crud_movement import CRUDMovement
from ..crud.crud_tool import CRUDTool
from ..schemas.movement import ToolMovementCreate


class MovementService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDMovement(db)
        self.tool_crud = CRUDTool(db)

    async def get_movements(
        self,
        tool_id: Optional[int] = None,
        user_id: Optional[int] = None,
        plant_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ToolMovement]:
        """Bewegungen mit Filtern abrufen."""
        return await self.crud.get_multi(
            tool_id=tool_id,
            user_id=user_id,
            plant_id=plant_id,
            skip=skip,
            limit=limit,
        )

    async def create_movement(self, data: ToolMovementCreate) -> ToolMovement:
        """Neue Bewegung erfassen.

        Fachliche Regeln:
        - lend:              Werkzeug muss vorhanden und 'available' sein,
                             danach wird der Werkzeug-Status auf 'lent' gesetzt.
        - return:            Werkzeug muss vorhanden und 'lent' sein,
                             danach wird der Werkzeug-Status auf 'available' gesetzt.
        - transfer/relocate: Werkzeug-Status bleibt unverändert.
        - status_change:     Neuer Status wird vorerst über 'note' übergeben (TODO).

        Technik:
        - Werkzeug-Update und Movement-Create werden atomar gespeichert
          (einmaliges db.commit() am Ende, dadurch ist beides eine Transaktion).
        - CRUDBase.create() wird hier bewusst NICHT verwendet, weil es bereits
          selbst committet (das würde zu doppelten Commits führen).
        """
        # Werkzeug laden – muss existieren
        tool = await self.tool_crud.get(data.tool_id)
        if not tool:
            raise ValueError(f"Werkzeug mit ID {data.tool_id} existiert nicht!")

        # TODO: user_id aus dem JWT-Token holen, sobald die Authentifizierung
        # vollständig implementiert ist. Aktuell wird user_id aus dem Body übernommen.
        movement_dict = data.model_dump()
        movement_dict["status"] = MovementStatus.COMPLETED

        # TODO: from_location automatisch aus dem Werkzeug befüllen (z. B.
        # storage_location.name), sobald die Beziehung sicher geladen wird.
        # Aktuell bleibt from_location optional aus dem Request-Body.

        # Werkzeug-Status je nach Bewegungstyp anpassen
        if data.movement_type == MovementType.LEND:
            if tool.status != ToolStatus.AVAILABLE:
                current = tool.status.value if tool.status else "unbekannt"
                raise ValueError(
                    f"Werkzeug {tool.tool_id} ist nicht verfügbar "
                    f"(aktueller Status: {current})."
                )
            tool.status = ToolStatus.LENT

        elif data.movement_type == MovementType.RETURN:
            if tool.status != ToolStatus.LENT:
                current = tool.status.value if tool.status else "unbekannt"
                raise ValueError(
                    f"Werkzeug {tool.tool_id} hat nicht den Status 'lent' "
                    f"(aktueller Status: {current}) und kann nicht zurückgegeben werden."
                )
            tool.status = ToolStatus.AVAILABLE

        elif data.movement_type in (MovementType.TRANSFER, MovementType.RELOCATE):
            # Umbuchung / Standortwechsel: Status bleibt unverändert
            pass

        elif data.movement_type == MovementType.STATUS_CHANGE:
            # TODO: Fachlich sauber wäre ein explizites Feld "new_status".
            # Vorerst wird der neue Status über das Feld 'note' übergeben –
            # aber nur, wenn der Text einem gültigen ToolStatus entspricht.
            if data.note:
                try:
                    tool.status = ToolStatus(data.note.strip())
                except ValueError:
                    # Kein gültiger ToolStatus in der Note -> Status bleibt unverändert.
                    pass

        # Bewegung erstellen (ohne CRUDBase.create, damit kein doppelter Commit erfolgt)
        movement = ToolMovement(**movement_dict)
        self.db.add(movement)

        # Einmalig committen: Tool-Status und Bewegung werden atomar gespeichert
        await self.db.commit()
        await self.db.refresh(tool)
        await self.db.refresh(movement)

    async def get_movement(self, movement_id: int) -> Optional[ToolMovement]:
        return await self.crud.get(movement_id)
