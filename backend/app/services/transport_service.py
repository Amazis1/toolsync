"""Werkzeug-Logistik zwischen Werken (DEC-072).

Der Service ist die **eine** Stelle, die Transportaufträge schreibt. Jede Operation
läuft in **einer** Transaktion: Auftrag, Zeilen, Werkzeug-Zustand/-Ort und Verlauf
werden gemeinsam bestätigt oder gar nicht – es gibt keinen Zwischenstand, in dem ein
Werkzeug „unterwegs" ist, ohne dass ein Auftrag es führt.

Fachliche Regeln (docs/21 §5, DEC-072):

* Verschickt werden darf nur, was **verfügbar** ist, **im Arbeitswerk liegt** und in
  **keinem offenen Auftrag** steht.
* Ein Auftrag ist **eine Richtung**; der Rückweg ist ein eigener Auftrag mit
  `parent_order_id`.
* Stornieren geht **nur im Entwurf** – ein verschickter Auftrag wird über den Rückweg
  aufgelöst.
* Beim Verschicken bleibt `position_id`/`plant_id` unangetastet (Heimatplatz bleibt
  reserviert); erst der **bestätigte Empfang** setzt `current_plant_id`.
* Empfang wird **pro Zeile** bestätigt, „alles angekommen" ist die Abkürzung dafür.
"""

from datetime import datetime, timezone
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.enums import (
    OPEN_TRANSPORT_STATUSES,
    SHIPPED_TRANSPORT_STATUSES,
    MovementStatus,
    MovementType,
    ToolStatus,
    TransportStatus,
)
from ..models.master_data import Plant
from ..models.movement import ToolMovement
from ..models.storage import Cabinet, Drawer, Position
from ..models.tool import Tool
from ..models.transport import TransportItem, TransportOrder
from ..models.user import User
from ..schemas.master_data import PlantRead
from ..schemas.transport import (
    AwayTool,
    BorrowedTool,
    TransportCandidate,
    TransportItemRead,
    TransportOrderCreate,
    TransportOrderRead,
)


def _namenssuche(muster: str):
    """Bedingung „eine Person passt zum Suchbegriff" (Vor- oder Nachname)."""
    return or_(
        User.first_name.ilike(muster),
        User.last_name.ilike(muster),
        (User.first_name + " " + User.last_name).ilike(muster),
    )


def _suchbedingung(q: str):
    """Was der Suchbegriff in der Auftragsliste findet (DEC-090).

    Vorher nur **Auftrags-Nr.** und **Reference** – damit war „welcher Auftrag
    hatte dieses Werkzeug?" und „was hat Frau Maier verschickt?" nicht zu
    beantworten. Jetzt:

    * Auftrags-Nr., Reference, **Info** des Auftrags,
    * **Werkzeug-ID** über die Positionen (`ANY`, keine doppelten Zeilen),
    * **Personen**: angelegt, verschickt, je Werkzeug bestätigt.
    """
    muster = f"%{q.strip()}%"
    return or_(
        TransportOrder.order_number.ilike(muster),
        TransportOrder.reference.ilike(muster),
        TransportOrder.info.ilike(muster),
        TransportOrder.items.any(TransportItem.tool.has(Tool.tool_id.ilike(muster))),
        TransportOrder.created_by.has(_namenssuche(muster)),
        TransportOrder.sent_by.has(_namenssuche(muster)),
        TransportOrder.items.any(TransportItem.received_by.has(_namenssuche(muster))),
    )


class TransportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ==================================================================
    # Hilfen
    # ==================================================================
    async def _position_codes(self, position_ids: Sequence[int | None]) -> dict[int, str]:
        """Platz-Codes (`03-C-02`) für viele Positionen in einer Abfrage."""
        ids = [pid for pid in position_ids if pid is not None]
        if not ids:
            return {}
        zeilen = (
            await self.db.execute(
                select(Position.id, Position.name, Drawer.name, Cabinet.name)
                .join(Drawer, Position.drawer_id == Drawer.id)
                .join(Cabinet, Drawer.cabinet_id == Cabinet.id)
                .where(Position.id.in_(ids))
            )
        ).all()
        return {
            pid: f"{schrank or '??'}-{schublade or '??'}-{platz or '??'}"
            for pid, platz, schublade, schrank in zeilen
        }

    async def _plant(self, plant_id: int | None) -> Optional[Plant]:
        if plant_id is None:
            return None
        return await self.db.get(Plant, plant_id)

    async def _open_order_of_tool(
        self, tool_id: int, exclude_order_id: Optional[int] = None
    ) -> Optional[TransportOrder]:
        """Offener Auftrag dieses Werkzeugs (Entwurf, unterwegs oder teilweise da).

        `exclude_order_id` blendet den Auftrag aus, um den es gerade geht – ein
        **teilweise** empfangener Auftrag ist selbst noch offen und würde seine
        eigenen, schon angekommenen Werkzeuge sonst blockieren (Rückweg, DEC-072).
        """
        bedingungen = [
            TransportItem.tool_id == tool_id,
            TransportOrder.status.in_(OPEN_TRANSPORT_STATUSES),
        ]
        if exclude_order_id is not None:
            bedingungen.append(TransportOrder.id != exclude_order_id)
        return (
            await self.db.execute(
                select(TransportOrder)
                .join(TransportItem, TransportItem.order_id == TransportOrder.id)
                .where(*bedingungen)
                .limit(1)
            )
        ).scalar_one_or_none()

    @staticmethod
    def _place(tool: Tool) -> int:
        """Wo das Werkzeug **jetzt** liegt (Heimatwerk, wenn kein anderer Ort gesetzt)."""
        return tool.current_plant_id if tool.current_plant_id is not None else tool.plant_id

    async def _blocked_reason(self, tool: Tool, plant_id: int) -> Optional[str]:
        """Warum ist dieses Werkzeug **nicht** wählbar? `None` = wählbar."""
        if tool.status == ToolStatus.LENT:
            return "ausgeliehen an eine Person"
        if tool.status == ToolStatus.DEFECTIVE:
            return "defekt"
        if tool.status == ToolStatus.MAINTENANCE:
            return "in Wartung"
        offen = await self._open_order_of_tool(tool.id)
        if offen is not None:
            return (
                f"unterwegs ({offen.order_number})"
                if tool.status == ToolStatus.IN_TRANSIT
                else f"bereits im Auftrag {offen.order_number}"
            )
        if tool.status == ToolStatus.IN_TRANSIT:
            return "unterwegs"
        if self._place(tool) != plant_id:
            ziel = await self._plant(self._place(tool))
            return f"liegt in {ziel.name if ziel else 'einem anderen Werk'}"
        return None

    @staticmethod
    def _person(user) -> Optional[str]:
        """Anzeigename eines Benutzers (Anzeigename, sonst Vor-/Nachname)."""
        if user is None:
            return None
        if getattr(user, "display_name", None):
            return user.display_name
        name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        return name or None

    # ==================================================================
    # Lesen
    # ==================================================================
    async def candidates(self, plant_id: int, q: str | None = None) -> List[TransportCandidate]:
        """Werkzeuge **des Arbeitswerks** – Grundlage der Auswahl.

        Was hier nicht liegt, fehlt in der Liste: Ein Werkzeug aus einem anderen
        Werk lässt sich ohnehin nicht verschicken, und eine Zeile, die man nicht
        anhaken kann, ist nur Ballast (Entscheidung des Inhabers nach der ersten
        Sichtprüfung, DEC-081). Werkzeuge **im eigenen Werk**, die gerade nicht
        dürfen (ausgeliehen, defekt, schon in einem Auftrag), bleiben sichtbar und
        nennen ihren Grund – da ist die Frage „warum geht das nicht?" berechtigt.
        """
        query = (
            select(Tool)
            .options(
                selectinload(Tool.plant),
                selectinload(Tool.current_plant),
                selectinload(Tool.tool_type),
            )
            .order_by(Tool.tool_id)
        )
        if q:
            muster = f"%{q.strip()}%"
            query = query.where(
                or_(
                    Tool.tool_id.ilike(muster),
                    Tool.description.ilike(muster),
                    Tool.measure_a.ilike(muster),
                )
            )
        werkzeuge = list((await self.db.execute(query)).scalars().all())
        codes = await self._position_codes([t.position_id for t in werkzeuge])

        ergebnis: List[TransportCandidate] = []
        for tool in werkzeuge:
            # Fremdes Werk: gar nicht erst anbieten (auch nicht als gesperrte Zeile).
            if self._place(tool) != plant_id:
                continue
            offen = await self._open_order_of_tool(tool.id)
            ergebnis.append(
                TransportCandidate(
                    tool_id=tool.id,
                    tool_code=tool.tool_id,
                    description=tool.description,
                    category=tool.category.value if tool.category else None,
                    tool_type=tool.tool_type.name if tool.tool_type else None,
                    measure_a=tool.measure_a,
                    status=tool.status.value if tool.status else None,
                    home_plant=PlantRead.model_validate(tool.plant) if tool.plant else None,
                    current_plant=(
                        PlantRead.model_validate(tool.current_plant)
                        if tool.current_plant
                        else None
                    ),
                    home_position_code=codes.get(tool.position_id) or "Ablage",
                    open_order_number=offen.order_number if offen else None,
                    blocked=await self._blocked_reason(tool, plant_id),
                )
            )
        return ergebnis

    async def away_tools(self) -> List[AwayTool]:
        """„Wo ist was" (DEC-077): nur ausgeliehene und unterwegs befindliche Werkzeuge."""
        query = (
            select(Tool)
            .where(Tool.status.in_((ToolStatus.LENT, ToolStatus.IN_TRANSIT)))
            .options(
                selectinload(Tool.plant),
                selectinload(Tool.current_plant),
                selectinload(Tool.tool_type),
            )
            .order_by(Tool.tool_id)
        )
        werkzeuge = list((await self.db.execute(query)).scalars().all())
        if not werkzeuge:
            return []
        codes = await self._position_codes([t.position_id for t in werkzeuge])

        # Ausleiher: die letzte `lend`-Bewegung je Werkzeug
        ausleihen: dict[int, ToolMovement] = {}
        ids = [t.id for t in werkzeuge if t.status == ToolStatus.LENT]
        if ids:
            bewegungen = (
                await self.db.execute(
                    select(ToolMovement)
                    .where(
                        ToolMovement.tool_id.in_(ids),
                        ToolMovement.movement_type == MovementType.LEND,
                    )
                    .options(selectinload(ToolMovement.user))
                    .order_by(ToolMovement.timestamp.desc(), ToolMovement.id.desc())
                )
            ).scalars().all()
            for bewegung in bewegungen:
                ausleihen.setdefault(bewegung.tool_id, bewegung)

        ergebnis: List[AwayTool] = []
        for tool in werkzeuge:
            offen = await self._open_order_of_tool(tool.id)
            bewegung = ausleihen.get(tool.id)
            ergebnis.append(
                AwayTool(
                    tool_id=tool.id,
                    tool_code=tool.tool_id,
                    description=tool.description,
                    category=tool.category.value if tool.category else None,
                    tool_type=tool.tool_type.name if tool.tool_type else None,
                    measure_a=tool.measure_a,
                    status=tool.status.value if tool.status else None,
                    home_plant=PlantRead.model_validate(tool.plant) if tool.plant else None,
                    home_position_code=codes.get(tool.position_id) or "Ablage",
                    current_plant=(
                        PlantRead.model_validate(tool.current_plant)
                        if tool.current_plant
                        else None
                    ),
                    lent_to=self._person(bewegung.user) if bewegung else None,
                    transport_id=offen.id if offen else None,
                    transport_number=offen.order_number if offen else None,
                    target_plant=(
                        PlantRead.model_validate(offen.to_plant)
                        if offen and offen.to_plant
                        else None
                    ),
                )
            )
        return ergebnis

    async def borrowed_tools(self, plant_id: int) -> List[BorrowedTool]:
        """Werkzeuge, die **hier** liegen, aber einem anderen Werk gehören.

        Grundlage des Fensters „Werkzeug zurück" (DEC-081): Das Werk, das die
        Werkzeuge hat, schickt sie an ihr Heimatwerk zurück. Das ist der Weg, den
        der Inhaber erwartet – niemand soll den alten Auftrag suchen müssen, mit
        dem die Werkzeuge einmal kamen.
        """
        query = (
            select(Tool)
            .where(
                Tool.current_plant_id == plant_id,
                Tool.plant_id != plant_id,
                # Unterwegs und ausgeliehen sind **nicht mehr hier**: ein
                # verschicktes Werkzeug bleibt bis zum Empfang am alten Ort
                # (`current_plant_id`), liegt aber nicht mehr im Regal.
                or_(
                    Tool.status.is_(None),
                    Tool.status.notin_((ToolStatus.IN_TRANSIT, ToolStatus.LENT)),
                ),
            )
            .options(
                selectinload(Tool.plant),
                selectinload(Tool.current_plant),
                selectinload(Tool.tool_type),
            )
            .order_by(Tool.tool_id)
        )
        werkzeuge = list((await self.db.execute(query)).scalars().all())
        if not werkzeuge:
            return []
        codes = await self._position_codes([t.position_id for t in werkzeuge])

        # Wann und womit sie kamen: der letzte **bestätigte** Empfang je Werkzeug.
        ids = [t.id for t in werkzeuge]
        angekommen: dict[int, TransportItem] = {}
        zeilen = (
            await self.db.execute(
                select(TransportItem)
                .where(
                    TransportItem.tool_id.in_(ids),
                    TransportItem.received_at.isnot(None),
                )
                .options(selectinload(TransportItem.order))
                .order_by(TransportItem.received_at.desc(), TransportItem.id.desc())
            )
        ).scalars().all()
        for zeile in zeilen:
            angekommen.setdefault(zeile.tool_id, zeile)

        ergebnis: List[BorrowedTool] = []
        for tool in werkzeuge:
            zeile = angekommen.get(tool.id)
            ergebnis.append(
                BorrowedTool(
                    tool_id=tool.id,
                    tool_code=tool.tool_id,
                    description=tool.description,
                    category=tool.category.value if tool.category else None,
                    tool_type=tool.tool_type.name if tool.tool_type else None,
                    measure_a=tool.measure_a,
                    status=tool.status.value if tool.status else None,
                    home_plant=PlantRead.model_validate(tool.plant) if tool.plant else None,
                    home_position_code=codes.get(tool.position_id) or "Ablage",
                    arrived_at=zeile.received_at if zeile else None,
                    arrived_with=(
                        zeile.order.order_number
                        if zeile and getattr(zeile, "order", None)
                        else None
                    ),
                )
            )
        return ergebnis

    async def get_order(self, order_id: int) -> Optional[TransportOrder]:
        """Auftrag mit Zeilen – **frisch aus der Datenbank**, auch nach einem Commit.

        `populate_existing` ist hier Pflicht, nicht Kür: die Schreibwege setzen
        `sent_by_id`/`received_by_id` und lesen den Auftrag danach erneut. Ohne das
        Überschreiben bliebe die vorher geladene (leere) Beziehung im Objekt hängen und
        die Antwort meldete „verschickt von: –" (Session läuft mit
        `expire_on_commit=False`).
        """
        return (
            await self.db.execute(
                select(TransportOrder)
                .where(TransportOrder.id == order_id)
                .options(
                    selectinload(TransportOrder.items).selectinload(TransportItem.tool),
                    selectinload(TransportOrder.items).selectinload(TransportItem.received_by),
                    selectinload(TransportOrder.items).selectinload(TransportItem.received_plant),
                    selectinload(TransportOrder.sent_by),
                    selectinload(TransportOrder.created_by),
                )
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()

    def to_read(
        self, order: TransportOrder, plant_id: Optional[int] = None
    ) -> TransportOrderRead:
        """Auftrag in die Antwortform bringen (Zeilen, Zähler, Richtung)."""
        items = [
            TransportItemRead(
                id=item.id,
                tool_id=item.tool_id,
                tool_code=item.tool.tool_id if item.tool else None,
                description=item.tool.description if item.tool else None,
                category=(
                    item.tool.category.value if item.tool and item.tool.category else None
                ),
                tool_type=(
                    item.tool.tool_type.name
                    if item.tool and getattr(item.tool, "tool_type", None)
                    else None
                ),
                measure_a=item.tool.measure_a if item.tool else None,
                tool_status=(
                    item.tool.status.value if item.tool and item.tool.status else None
                ),
                home_plant=(
                    PlantRead.model_validate(item.tool.plant)
                    if item.tool and item.tool.plant
                    else None
                ),
                home_position_code=item.home_position_code,
                received_at=item.received_at,
                received_by_name=self._person(item.received_by),
                received_plant=(
                    PlantRead.model_validate(item.received_plant)
                    if item.received_plant
                    else None
                ),
                note=item.note,
            )
            for item in order.items
        ]
        empfangen = sum(1 for item in order.items if item.received_at is not None)
        richtung = None
        if plant_id is not None:
            if order.from_plant_id == plant_id:
                richtung = "out"
            elif order.to_plant_id == plant_id:
                richtung = "in"
        return TransportOrderRead(
            id=order.id,
            order_number=order.order_number,
            reference=order.reference,
            status=order.status,
            info=order.info,
            from_plant=(
                PlantRead.model_validate(order.from_plant) if order.from_plant else None
            ),
            to_plant=PlantRead.model_validate(order.to_plant) if order.to_plant else None,
            parent_order_id=order.parent_order_id,
            created_at=order.created_at,
            created_by_name=self._person(order.created_by),
            created_plant=(
                PlantRead.model_validate(order.created_plant)
                if order.created_plant
                else None
            ),
            sent_at=order.sent_at,
            sent_by_name=self._person(order.sent_by),
            closed_at=order.closed_at,
            items=items,
            item_count=len(order.items),
            received_count=empfangen,
            direction=richtung,
        )

    async def list_orders(
        self,
        plant_id: int,
        direction: str = "both",
        statuses: Optional[Sequence[TransportStatus]] = None,
        q: Optional[str] = None,
        mine_user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[TransportOrder], int]:
        """Aufträge des Arbeitswerks – „ausgehend" und/oder „eingehend"."""
        bedingungen = []
        if direction == "out":
            bedingungen.append(TransportOrder.from_plant_id == plant_id)
        elif direction == "in":
            bedingungen.append(TransportOrder.to_plant_id == plant_id)
        else:
            bedingungen.append(
                or_(
                    TransportOrder.from_plant_id == plant_id,
                    TransportOrder.to_plant_id == plant_id,
                )
            )
        if statuses:
            bedingungen.append(TransportOrder.status.in_(statuses))
        # „nur meine": von mir angelegt (DEC-090). Ein Parameter, kein
        # Namensvergleich im Frontend – Namen sind nicht eindeutig.
        if mine_user_id is not None:
            bedingungen.append(TransportOrder.created_by_id == mine_user_id)
        if q:
            bedingungen.append(_suchbedingung(q))

        query = (
            select(TransportOrder)
            .where(*bedingungen)
            .options(selectinload(TransportOrder.items))
            .order_by(TransportOrder.created_at.desc(), TransportOrder.id.desc())
            .offset(skip)
            .limit(limit)
        )
        orders = list((await self.db.execute(query)).scalars().all())
        gesamt = (
            await self.db.execute(
                select(func.count()).select_from(TransportOrder).where(*bedingungen)
            )
        ).scalar_one()
        return orders, int(gesamt)

    # ==================================================================
    # Schreiben
    # ==================================================================
    async def _pruefe_werkzeuge(
        self, tool_ids: Sequence[int], plant_id: int, exclude_order_id: Optional[int] = None
    ) -> List[Tool]:
        """Werkzeuge laden und prüfen – alle oder keines."""
        ids = list(tool_ids)
        if not ids:
            return []
        if len(set(ids)) != len(ids):
            raise ValueError("Ein Werkzeug steht mehrfach im Auftrag.")

        werkzeuge = list(
            (
                await self.db.execute(
                    select(Tool).where(Tool.id.in_(ids)).options(selectinload(Tool.plant))
                )
            )
            .scalars()
            .all()
        )
        gefunden = {tool.id: tool for tool in werkzeuge}
        for tool_id in ids:
            if tool_id not in gefunden:
                raise ValueError(f"Werkzeug {tool_id} existiert nicht.")

        for tool in werkzeuge:
            name = tool.tool_id or "ohne ID"
            if tool.status == ToolStatus.LENT:
                raise ValueError(
                    f"Werkzeug {name} ist ausgeliehen und kann nicht verschickt werden."
                )
            if tool.status in (ToolStatus.DEFECTIVE, ToolStatus.MAINTENANCE):
                zustand = "defekt" if tool.status == ToolStatus.DEFECTIVE else "in Wartung"
                raise ValueError(f"Werkzeug {name} ist {zustand} und kann nicht verschickt werden.")
            if self._place(tool) != plant_id:
                ziel = await self._plant(self._place(tool))
                raise ValueError(
                    f"Werkzeug {name} liegt in {ziel.name if ziel else 'einem anderen Werk'} – "
                    "nur Werkzeuge aus dem Arbeitswerk lassen sich verschicken."
                )
            offen = await self._open_order_of_tool(tool.id)
            if offen is not None and offen.id != exclude_order_id:
                raise ValueError(
                    f"Werkzeug {name} steht bereits im Auftrag {offen.order_number}."
                )
        return werkzeuge

    def _movement(
        self,
        tool_id: int,
        order: TransportOrder,
        von: str,
        nach: str,
        user_id: Optional[int],
        plant_id: int,
        note: str,
    ) -> ToolMovement:
        """Bewegung für den Verlauf – mit Auftragsbezug und Arbeitswerk."""
        return ToolMovement(
            movement_type=MovementType.TRANSFER,
            from_location=von,
            to_location=nach,
            status=MovementStatus.COMPLETED,
            note=note,
            tool_id=tool_id,
            user_id=user_id,
            plant_id=plant_id,
            transport_id=order.id,
        )

    async def create_order(
        self,
        data: TransportOrderCreate,
        user_id: Optional[int],
        plant_id: int,
    ) -> TransportOrder:
        """Auftrag anlegen – als Entwurf. Belegt die Werkzeuge (kein Zweitauftrag)."""
        if data.to_plant_id == plant_id:
            raise ValueError("Absender und Empfänger sind dasselbe Werk.")
        if await self.db.get(Plant, data.to_plant_id) is None:
            raise ValueError("Das Empfängerwerk existiert nicht.")

        werkzeuge = await self._pruefe_werkzeuge(
            [eintrag.tool_id for eintrag in data.items], plant_id
        )
        codes = await self._position_codes([tool.position_id for tool in werkzeuge])

        order = TransportOrder(
            order_number=data.order_number,
            reference=(data.reference or None),
            status=TransportStatus.DRAFT,
            info=(data.info or None),
            from_plant_id=plant_id,
            to_plant_id=data.to_plant_id,
            created_by_id=user_id,
            created_plant_id=plant_id,
        )
        self.db.add(order)
        await self.db.flush()

        by_id = {tool.id: tool for tool in werkzeuge}
        for eintrag in data.items:
            tool = by_id[eintrag.tool_id]
            self.db.add(
                TransportItem(
                    order_id=order.id,
                    tool_id=tool.id,
                    home_position_id=tool.position_id,
                    home_position_code=codes.get(tool.position_id, "Ablage"),
                    note=(eintrag.note or None),
                )
            )

        await self.db.commit()
        return await self.get_order(order.id)

    async def update_order(
        self,
        order_id: int,
        data: TransportOrderCreate,
        plant_id: int,
    ) -> TransportOrder:
        """Kopf und Zeilen eines **Entwurfs** ändern."""
        order = await self.get_order(order_id)
        if order is None:
            raise ValueError("Auftrag nicht gefunden.")
        if order.status != TransportStatus.DRAFT:
            raise ValueError("Nur ein Entwurf lässt sich ändern.")
        if order.from_plant_id != plant_id:
            raise ValueError("Nur das Absenderwerk darf den Auftrag ändern.")
        if data.to_plant_id == plant_id:
            raise ValueError("Absender und Empfänger sind dasselbe Werk.")

        werkzeuge = await self._pruefe_werkzeuge(
            [eintrag.tool_id for eintrag in data.items], plant_id, exclude_order_id=order.id
        )
        codes = await self._position_codes([tool.position_id for tool in werkzeuge])

        order.order_number = data.order_number
        order.reference = data.reference or None
        order.to_plant_id = data.to_plant_id
        order.info = data.info or None
        order.items.clear()
        await self.db.flush()

        by_id = {tool.id: tool for tool in werkzeuge}
        for eintrag in data.items:
            tool = by_id[eintrag.tool_id]
            order.items.append(
                TransportItem(
                    tool_id=tool.id,
                    home_position_id=tool.position_id,
                    home_position_code=codes.get(tool.position_id, "Ablage"),
                    note=(eintrag.note or None),
                )
            )
        await self.db.commit()
        return await self.get_order(order.id)

    async def send_order(
        self, order_id: int, user_id: Optional[int], plant_id: int
    ) -> TransportOrder:
        """„Unterwegs melden": Werkzeuge werden `in_transit`, der Heimatplatz bleibt."""
        order = await self.get_order(order_id)
        if order is None:
            raise ValueError("Auftrag nicht gefunden.")
        if order.status != TransportStatus.DRAFT:
            raise ValueError("Nur ein Entwurf kann verschickt werden.")
        if order.from_plant_id != plant_id:
            raise ValueError("Nur das Absenderwerk darf verschicken.")
        if not order.items:
            raise ValueError("Der Auftrag hat keine Werkzeuge.")

        werkzeuge = await self._pruefe_werkzeuge(
            [item.tool_id for item in order.items], plant_id, exclude_order_id=order.id
        )
        von = order.from_plant.name if order.from_plant else "?"
        nach = order.to_plant.name if order.to_plant else "?"

        for tool in werkzeuge:
            tool.status = ToolStatus.IN_TRANSIT
            self.db.add(
                self._movement(tool.id, order, von, nach, user_id, plant_id, "Transport raus")
            )

        order.status = TransportStatus.SENT
        order.sent_at = datetime.now(timezone.utc)
        order.sent_by_id = user_id

        await self.db.commit()
        return await self.get_order(order.id)

    async def cancel_order(self, order_id: int, plant_id: int) -> TransportOrder:
        """Entwurf stornieren – gibt die Werkzeuge wieder frei."""
        order = await self.get_order(order_id)
        if order is None:
            raise ValueError("Auftrag nicht gefunden.")
        if order.status != TransportStatus.DRAFT:
            raise ValueError(
                "Nur ein Entwurf lässt sich stornieren – ein verschickter Auftrag wird "
                "über den Rückweg aufgelöst."
            )
        if order.from_plant_id != plant_id:
            raise ValueError("Nur das Absenderwerk darf stornieren.")
        order.status = TransportStatus.CANCELLED
        await self.db.commit()
        return await self.get_order(order.id)

    async def receive_order(
        self,
        order_id: int,
        item_ids: Optional[List[int]],
        user_id: Optional[int],
        plant_id: int,
        note: Optional[str] = None,
    ) -> TransportOrder:
        """Empfang bestätigen – je Zeile oder für alle offenen Zeilen."""
        order = await self.get_order(order_id)
        if order is None:
            raise ValueError("Auftrag nicht gefunden.")
        if order.status not in SHIPPED_TRANSPORT_STATUSES:
            raise ValueError("Dieser Auftrag ist nicht unterwegs.")
        if order.to_plant_id != plant_id:
            raise ValueError("Nur das Empfängerwerk darf den Empfang bestätigen.")

        offen = [item for item in order.items if item.received_at is None]
        if not offen:
            raise ValueError("Es ist schon alles bestätigt.")

        if item_ids:
            auswahl = [item for item in offen if item.id in set(item_ids)]
            if not auswahl:
                raise ValueError("Keine der gewählten Zeilen ist noch offen.")
        else:
            auswahl = offen

        von = order.from_plant.name if order.from_plant else "?"
        nach = order.to_plant.name if order.to_plant else "?"
        jetzt = datetime.now(timezone.utc)

        for item in auswahl:
            item.received_at = jetzt
            item.received_by_id = user_id
            item.received_plant_id = plant_id
            if note:
                item.note = note
            tool = await self.db.get(Tool, item.tool_id)
            if tool is None:
                raise ValueError(f"Werkzeug {item.tool_id} existiert nicht mehr.")
            tool.status = ToolStatus.AVAILABLE
            # Heimatwerk = Zielwerk → wieder am Heimatplatz; sonst liegt es jetzt dort
            tool.current_plant_id = (
                None if order.to_plant_id == tool.plant_id else order.to_plant_id
            )
            self.db.add(
                self._movement(tool.id, order, von, nach, user_id, plant_id, "Transport an")
            )

        if all(item.received_at is not None for item in order.items):
            order.status = TransportStatus.RECEIVED
            order.closed_at = jetzt
        else:
            order.status = TransportStatus.PARTLY_RECEIVED

        await self.db.commit()
        return await self.get_order(order.id)

    async def return_order(
        self,
        order_id: int,
        tool_ids: Optional[List[int]],
        user_id: Optional[int],
        plant_id: int,
        info: Optional[str] = None,
    ) -> TransportOrder:
        """Rück-Auftrag anlegen: eigener Auftrag mit `parent_order_id` auf den Hinweg."""
        order = await self.get_order(order_id)
        if order is None:
            raise ValueError("Auftrag nicht gefunden.")
        if order.status not in (TransportStatus.RECEIVED, TransportStatus.PARTLY_RECEIVED):
            raise ValueError(
                "Erst wenn Werkzeuge angekommen sind, lässt sich ein Rück-Auftrag anlegen."
            )
        if order.to_plant_id != plant_id:
            raise ValueError("Nur das Werk, das die Werkzeuge hat, schickt sie zurück.")
        if order.parent_order_id is not None:
            raise ValueError("Das ist bereits ein Rück-Auftrag.")

        empfangene = [item for item in order.items if item.received_at is not None]
        if not empfangene:
            raise ValueError("Kein angekommenes Werkzeug im Auftrag.")
        if tool_ids:
            gewaehlt = [item for item in empfangene if item.tool_id in set(tool_ids)]
        else:
            gewaehlt = empfangene
        if not gewaehlt:
            raise ValueError("Kein angekommenes Werkzeug ausgewählt.")

        for item in gewaehlt:
            offen = await self._open_order_of_tool(item.tool_id, exclude_order_id=order.id)
            if offen is not None:
                tool = await self.db.get(Tool, item.tool_id)
                raise ValueError(
                    f"Werkzeug {tool.tool_id if tool else item.tool_id} steht bereits im "
                    f"Auftrag {offen.order_number}."
                )

        rueck = TransportOrder(
            order_number=f"{order.order_number}-R",
            reference=f"Rück: {order.reference}" if order.reference else "Rückweg",
            status=TransportStatus.DRAFT,
            info=info or f"Rückweg zu {order.order_number}",
            from_plant_id=order.to_plant_id,
            to_plant_id=order.from_plant_id,
            parent_order_id=order.id,
            created_by_id=user_id,
            created_plant_id=plant_id,
        )
        self.db.add(rueck)
        await self.db.flush()
        for item in gewaehlt:
            self.db.add(
                TransportItem(
                    order_id=rueck.id,
                    tool_id=item.tool_id,
                    home_position_id=item.home_position_id,
                    home_position_code=item.home_position_code,
                    note="Rückweg",
                )
            )
        await self.db.commit()
        return await self.get_order(rueck.id)
