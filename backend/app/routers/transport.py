"""Werkzeug-Logistik zwischen Werken (DEC-072).

Alle Endpunkte arbeiten mit dem **Arbeitswerk** aus dem Header `X-Plant-Id`
(`get_active_plant`): „mein Ausgang" ist `from_plant_id = Arbeitswerk`, „mein
Eingang" ist `to_plant_id = Arbeitswerk`. Es gibt keine Admin-Sonderrechte – Anlegen,
Verschicken und Bestätigen sind Tagesgeschäft (DEC-072 Punkt 7).

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/orders` | Liste (Richtung, Status, Suche, Pagination) |
| POST | `/orders` | Auftrag anlegen (Entwurf) |
| GET | `/orders/{id}` | Detail mit Zeilen |
| PUT | `/orders/{id}` | Entwurf ändern |
| POST | `/orders/{id}/send` | „unterwegs melden" |
| POST | `/orders/{id}/cancel` | Entwurf stornieren |
| POST | `/orders/{id}/receive` | Empfang (alle oder `item_ids`) |
| POST | `/orders/{id}/return` | Rück-Auftrag anlegen |
| GET | `/candidates` | Werkzeuge für die Auswahl (mit Sperrgrund) |
| GET | `/away` | „Wo ist was": unterwegs oder ausgeliehen |
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.permissions import require_active
from app.dependencies.plant import get_active_plant
from app.models.enums import TransportStatus
from app.models.master_data import Plant
from app.models.user import User
from app.schemas.transport import (
    AwayTool,
    BorrowedTool,
    TransportCandidate,
    TransportOrderCreate,
    TransportOrderRead,
    TransportPage,
    TransportReceiveRequest,
    TransportReturnRequest,
)
from app.services.transport_service import TransportService
from app.utils.database import get_db

router = APIRouter()


def _fehler(error: ValueError) -> HTTPException:
    return HTTPException(status_code=400, detail=str(error))


@router.get("/orders", response_model=TransportPage)
async def list_orders(
    direction: Literal["out", "in", "both"] = "both",
    status: Optional[str] = Query(
        default=None,
        description="Kommagetrennt: draft, sent, partly_received, received, cancelled",
    ),
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    statusliste: List[TransportStatus] = []
    if status:
        for wert in status.split(","):
            wert = wert.strip()
            if not wert:
                continue
            try:
                statusliste.append(TransportStatus(wert))
            except ValueError:
                raise HTTPException(status_code=422, detail=f"Unbekannter Status: {wert}")
    service = TransportService(db)
    orders, gesamt = await service.list_orders(
        plant_id=plant.id,
        direction=direction,
        statuses=statusliste or None,
        q=q,
        skip=skip,
        limit=limit,
    )
    return TransportPage(
        items=[service.to_read(order, plant.id) for order in orders],
        total=gesamt,
    )


@router.post("/orders", response_model=TransportOrderRead, status_code=201)
async def create_order(
    data: TransportOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    service = TransportService(db)
    try:
        order = await service.create_order(data, current_user.id, plant.id)
    except ValueError as e:
        raise _fehler(e)
    return service.to_read(order, plant.id)


@router.get("/orders/{order_id}", response_model=TransportOrderRead)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    service = TransportService(db)
    order = await service.get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden.")
    return service.to_read(order, plant.id)


@router.put("/orders/{order_id}", response_model=TransportOrderRead)
async def update_order(
    order_id: int,
    data: TransportOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    service = TransportService(db)
    try:
        order = await service.update_order(order_id, data, plant.id)
    except ValueError as e:
        raise _fehler(e)
    return service.to_read(order, plant.id)


@router.post("/orders/{order_id}/send", response_model=TransportOrderRead)
async def send_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    service = TransportService(db)
    try:
        order = await service.send_order(order_id, current_user.id, plant.id)
    except ValueError as e:
        raise _fehler(e)
    return service.to_read(order, plant.id)


@router.post("/orders/{order_id}/cancel", response_model=TransportOrderRead)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    service = TransportService(db)
    try:
        order = await service.cancel_order(order_id, plant.id)
    except ValueError as e:
        raise _fehler(e)
    return service.to_read(order, plant.id)


@router.post("/orders/{order_id}/receive", response_model=TransportOrderRead)
async def receive_order(
    order_id: int,
    data: Optional[TransportReceiveRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """Empfang bestätigen. Ohne `item_ids` gilt es allen offenen Zeilen."""
    service = TransportService(db)
    try:
        order = await service.receive_order(
            order_id,
            item_ids=(data.item_ids if data else None),
            user_id=current_user.id,
            plant_id=plant.id,
            note=(data.note if data else None),
        )
    except ValueError as e:
        raise _fehler(e)
    return service.to_read(order, plant.id)


@router.post("/orders/{order_id}/return", response_model=TransportOrderRead, status_code=201)
async def return_order(
    order_id: int,
    data: Optional[TransportReturnRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """Rück-Auftrag erzeugen (eigener Auftrag mit Bezug auf den Hinweg)."""
    service = TransportService(db)
    try:
        order = await service.return_order(
            order_id,
            tool_ids=(data.tool_ids if data else None),
            user_id=current_user.id,
            plant_id=plant.id,
            info=(data.info if data else None),
        )
    except ValueError as e:
        raise _fehler(e)
    return service.to_read(order, plant.id)


@router.get("/candidates", response_model=List[TransportCandidate])
async def candidates(
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """Werkzeuge für die Auswahl – alle Werke, mit Sperrgrund je Zeile."""
    return await TransportService(db).candidates(plant.id, q)


@router.get("/borrowed", response_model=List[BorrowedTool])
async def borrowed_tools(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """Werkzeuge aus anderen Werken, die **hier** liegen (DEC-081).

    Grundlage des Fensters „Werkzeug zurück": Das Werk, das sie hat, schickt sie
    an ihr Heimatwerk zurück.
    """
    return await TransportService(db).borrowed_tools(plant.id)


@router.get("/away", response_model=List[AwayTool])
async def away_tools(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
    plant: Plant = Depends(get_active_plant),
):
    """„Wo ist was" (DEC-077): nur unterwegs oder ausgeliehen."""
    return await TransportService(db).away_tools()
