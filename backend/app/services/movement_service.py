from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from typing import List, Optional, Tuple
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

    async def history(
        self,
        *,
        arten: Optional[List[MovementType]] = None,
        q: Optional[str] = None,
        von: Optional[datetime] = None,
        bis: Optional[datetime] = None,
        plant_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[ToolMovement], int]:
        """Verlauf mit Filtern und Gesamtzahl (DEC-094).

        Gefiltert wird über **alle** Angaben einer Zeile: Vorgang, Werkzeug-ID,
        Beschreibung, Person, Ort (von/nach) und Notiz. Die Gesamtzahl kommt aus
        einer eigenen `COUNT`-Abfrage mit denselben Bedingungen – sonst könnte die
        Seite nicht sagen, wie viel es insgesamt ist.
        """
        bedingungen = []
        if arten:
            bedingungen.append(ToolMovement.movement_type.in_(arten))
        if plant_id is not None:
            # Arbeitswerk, in dem gehandelt wurde (DEC-070). Altdaten ohne
            # `plant_id` bleiben bei „alle Werke" sichtbar.
            bedingungen.append(ToolMovement.plant_id == plant_id)
        if von is not None:
            bedingungen.append(ToolMovement.timestamp >= von)
        if bis is not None:
            bedingungen.append(ToolMovement.timestamp < bis)
        if q:
            muster = f"%{q.strip()}%"
            bedingungen.append(
                or_(
                    Tool.tool_id.ilike(muster),
                    Tool.description.ilike(muster),
                    ToolMovement.note.ilike(muster),
                    ToolMovement.from_location.ilike(muster),
                    ToolMovement.to_location.ilike(muster),
                    ToolMovement.user.has(
                        or_(
                            User.first_name.ilike(muster),
                            User.last_name.ilike(muster),
                            (User.first_name + " " + User.last_name).ilike(muster),
                        )
                    ),
                )
            )

        query = (
            select(ToolMovement)
            .join(ToolMovement.tool)
            .where(*bedingungen)
            .options(selectinload(ToolMovement.tool), selectinload(ToolMovement.user))
            .order_by(ToolMovement.timestamp.desc(), ToolMovement.id.desc())
            .offset(skip)
            .limit(limit)
        )
        zeilen = list((await self.db.execute(query)).scalars().all())
        gesamt = (
            await self.db.execute(
                select(func.count())
                .select_from(ToolMovement)
                .join(ToolMovement.tool)
                .where(*bedingungen)
            )
        ).scalar_one()
        return zeilen, int(gesamt)

    async def create_movement(
        self, data: ToolMovementCreate, plant_id: Optional[int] = None
    ) -> ToolMovement:
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
        - `plant_id` ist das Arbeitswerk aus dem Header (DEC-070) und wandert in
          die Bewegung – damit ist „wer hat für welches Werk gehandelt" belegt.
        """
        # Werkzeug laden – muss existieren
        tool = await self.tool_crud.get(data.tool_id)
        if not tool:
            raise ValueError(f"Werkzeug mit ID {data.tool_id} existiert nicht!")

        # Der Benutzer kommt aus dem Token (Router setzt ihn), das Arbeitswerk aus
        # dem Header. Beides gehört in die Bewegung, nicht als Klartext in die Notiz.
        movement_dict = data.model_dump()
        movement_dict["status"] = MovementStatus.COMPLETED
        movement_dict["plant_id"] = plant_id

        # TODO: from_location automatisch aus dem Werkzeug befüllen (z. B.
        # storage_location.name), sobald die Beziehung sicher geladen wird.
        # Aktuell bleibt from_location optional aus dem Request-Body.

        # Werkzeug-Status je nach Bewegungstyp anpassen
        if data.movement_type == MovementType.LEND:
            # **Ohne Status = verfügbar** (DEC-080): Der Bestand aus dem Altsystem
            # hat keinen gepflegten Status (14 von 16 Werkzeugen). Ein leeres Feld
            # heißt „nichts Abweichendes bekannt" – also darf das Werkzeug raus.
            # Nur ein *gesetzter* abweichender Zustand sperrt die Ausleihe:
            # ausgeliehen, unterwegs, defekt, in Wartung.
            if tool.status not in (None, ToolStatus.AVAILABLE):
                current = tool.status.value if tool.status else "unbekannt"
                raise ValueError(
                    f"Werkzeug {tool.tool_id or 'ohne ID'} ist nicht verfügbar "
                    f"(aktueller Status: {current})."
                )
            tool.status = ToolStatus.LENT

        elif data.movement_type == MovementType.RETURN:
            if tool.status != ToolStatus.LENT:
                current = tool.status.value if tool.status else "unbekannt"
                raise ValueError(
                    f"Werkzeug {tool.tool_id or 'ohne ID'} hat nicht den Status 'lent' "
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

        # **Frisch geladen** zurückgeben: `tool_code`/`tool_description` kommen aus
        # `movement.tool`, und nach dem Commit ist die Beziehung abgelaufen. Ein
        # Nachladen im Antwort-Aufbau würde außerhalb des async-Kontexts laufen
        # (MissingGreenlet). Die Liste lädt `tool`/`user` ausdrücklich mit.
        geladen = await self.crud.get_multi(tool_id=data.tool_id, skip=0, limit=1)
        if geladen:
            return geladen[0]
        return movement

    async def get_movement(self, movement_id: int) -> Optional[ToolMovement]:
        return await self.crud.get(movement_id)
