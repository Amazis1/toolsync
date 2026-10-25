"""Kennzahlen des Arbeitswerks (DEC-089).

Alle Zählungen sind **eine** Abfrage je Kennzahl auf der Datenbank (`COUNT`),
nicht „Liste laden und in Python zählen" – die rechte Spalte wird auf jedem
Bildschirm angezeigt.

Zwei Sonderfälle sind bewusst hier erklärt:

* **„verfügbar" heißt auch „kein Status"** (DEC-080). Ein Werkzeug ohne Status
  gilt als verfügbar; `status IS NULL` zählt deshalb mit.
* **„läuft zu lange"** wird in Python gerechnet, nicht in SQL: `created_at` legt
  SQLite ohne Zeitzone ab, `sent_at` mit Offset. Ein String-Vergleich beider
  Formate (`func.coalesce(...) < grenze`) wäre dort falsch. Es geht auch nicht um
  eine Liste, sondern nur um die **offenen** Aufträge – die sind klein.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_sheet import DataSheet
from app.models.enums import ToolStatus, TransportStatus
from app.models.serial_article import SerialArticle
from app.models.spare_part import SparePart
from app.models.tool import Tool
from app.models.transport import TransportOrder
from app.schemas.stats import StatsOverview

#: Offene Zustände eines Auftrags (dieselbe Menge wie in DEC-072 Punkt 5).
OFFEN = (TransportStatus.DRAFT, TransportStatus.SENT, TransportStatus.PARTLY_RECEIVED)
#: „Unterwegs" im Sinne der Kachel (verschickt oder teilweise angekommen).
UNTERWEGS = (TransportStatus.SENT, TransportStatus.PARTLY_RECEIVED)
#: Ab so vielen Tagen gilt ein offener Auftrag als „läuft zu lange".
LANGE_TAGE = 7


class StatsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _zahl(self, tabelle, *bedingungen) -> int:
        """`SELECT COUNT(*) FROM tabelle WHERE …`.

        Die Tabelle wird **ausdrücklich** übergeben: `select_from` muss dieselbe
        Tabelle sein, aus der die Bedingungen stammen – sonst entsteht ein
        kartesisches Produkt (`SELECT count(*) FROM tools WHERE transport_orders…`),
        das SQLAlchemy zu Recht anmahnt und das falsche Zahlen liefert.
        """
        ergebnis = await self.db.execute(
            select(func.count()).select_from(tabelle).where(*bedingungen)
        )
        return int(ergebnis.scalar_one())

    async def overview(self, plant_id: int) -> StatsOverview:
        # --- Werkzeuge ---------------------------------------------------
        werkzeuge = Tool.plant_id == plant_id
        verfuegbar = or_(Tool.status == ToolStatus.AVAILABLE, Tool.status.is_(None))
        tools_total = await self._zahl(Tool, werkzeuge)
        tools_available = await self._zahl(Tool, werkzeuge, verfuegbar)
        tools_lent = await self._zahl(Tool, werkzeuge, Tool.status == ToolStatus.LENT)
        tools_in_transit = await self._zahl(
            Tool, werkzeuge, Tool.status == ToolStatus.IN_TRANSIT
        )
        tools_storage = await self._zahl(Tool, werkzeuge, Tool.is_storage.is_(True))

        # --- Stammdaten ---------------------------------------------------
        serial_articles = await self._zahl(SerialArticle, SerialArticle.plant_id == plant_id)
        data_sheets = await self._zahl(
            DataSheet, or_(DataSheet.plant_id == plant_id, DataSheet.plant_id.is_(None))
        )
        spare_parts = await self._zahl(SparePart, SparePart.plant_id == plant_id)

        # --- Logistik ------------------------------------------------------
        beteiligt = or_(
            TransportOrder.from_plant_id == plant_id,
            TransportOrder.to_plant_id == plant_id,
        )
        orders_open = await self._zahl(
            TransportOrder, beteiligt, TransportOrder.status.in_(OFFEN)
        )
        orders_draft = await self._zahl(
            TransportOrder, beteiligt, TransportOrder.status == TransportStatus.DRAFT
        )
        orders_sent = await self._zahl(
            TransportOrder, beteiligt, TransportOrder.status.in_(UNTERWEGS)
        )
        orders_incoming_open = await self._zahl(
            TransportOrder,
            TransportOrder.to_plant_id == plant_id,
            TransportOrder.status.in_(UNTERWEGS),
        )

        # Nur ausgehend – für die Filter-Karten über der Auftragsliste.
        ausgehend = TransportOrder.from_plant_id == plant_id
        orders_out_open = await self._zahl(
            TransportOrder, ausgehend, TransportOrder.status.in_(OFFEN)
        )
        orders_out_draft = await self._zahl(
            TransportOrder, ausgehend, TransportOrder.status == TransportStatus.DRAFT
        )
        orders_out_sent = await self._zahl(
            TransportOrder, ausgehend, TransportOrder.status.in_(UNTERWEGS)
        )

        # „läuft zu lange": offene Aufträge, deren Versand (sonst Anlage) zu lange
        # zurückliegt – in Python gerechnet, siehe Modulkopf.
        offene = await self.db.execute(
            select(
                TransportOrder.sent_at,
                TransportOrder.created_at,
                TransportOrder.from_plant_id,
            ).where(beteiligt, TransportOrder.status.in_(OFFEN))
        )
        grenze = datetime.now(timezone.utc) - timedelta(days=LANGE_TAGE)
        orders_old = 0
        orders_out_old = 0
        for sent_at, created_at, from_plant_id in offene.all():
            zeitpunkt = sent_at or created_at
            if zeitpunkt is None:
                continue
            if zeitpunkt.tzinfo is None:
                zeitpunkt = zeitpunkt.replace(tzinfo=timezone.utc)
            if zeitpunkt < grenze:
                orders_old += 1
                if from_plant_id == plant_id:
                    orders_out_old += 1

        return StatsOverview(
            tools_total=tools_total,
            tools_available=tools_available,
            tools_lent=tools_lent,
            tools_in_transit=tools_in_transit,
            tools_storage=tools_storage,
            serial_articles=serial_articles,
            data_sheets=data_sheets,
            spare_parts=spare_parts,
            orders_open=orders_open,
            orders_draft=orders_draft,
            orders_sent=orders_sent,
            orders_incoming_open=orders_incoming_open,
            orders_old=orders_old,
            orders_out_open=orders_out_open,
            orders_out_draft=orders_out_draft,
            orders_out_sent=orders_out_sent,
            orders_out_old=orders_out_old,
        )
