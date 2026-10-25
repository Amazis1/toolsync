"""Kennzahlen der rechten Spalte (DEC-089).

Geprüft wird der **Service** (`StatsService`) – dort liegen die Definitionen der
Zahlen (was „verfügbar", „offen" und „läuft zu lange" heißt):

* „verfügbar" schließt **Werkzeuge ohne Status** ein (DEC-080),
* Datenblätter **ohne Werk** zählen in **jedem** Werk mit (DEC-085),
* die Zahlen gelten nur für das **Arbeitswerk**,
* „läuft zu lange" heißt: offen und seit mindestens 7 Tagen unterwegs (bzw. ohne
  Versand: seit dem Anlegen).

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_stats.py -q
"""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.base import Base
from app.models.data_sheet import DataSheet
from app.models.enums import ToolCategory, ToolStatus, TransportStatus
from app.models.master_data import Plant, ToolType
from app.models.serial_article import SerialArticle
from app.models.spare_part import SparePart
from app.models.tool import Tool
from app.models.transport import TransportOrder
from app.services.stats_service import StatsService

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db_session:
        yield db_session
    await engine.dispose()


async def aufbau(db):
    """Zwei Werke mit Werkzeugen, Stammdaten und Aufträgen in jedem Zustand."""
    werk1 = Plant(name="Werk 1", color="#0f766e")
    werk2 = Plant(name="Werk 2", color="#4338ca")
    typ = ToolType(name="01 Rund")
    db.add_all([werk1, werk2, typ])
    await db.flush()

    def werkzeug(code, werk, status, lager=False):
        return Tool(
            tool_id=code,
            category=ToolCategory.STEMPEL,
            status=status,
            is_storage=lager,
            allow_duplicate_id=False,
            measure_a="8,20",
            plant_id=werk.id,
            tool_type_id=typ.id,
        )

    db.add_all(
        [
            # Werk 1: 2 verfügbar (davon einer ohne Status), 1 ausgeliehen,
            # 1 unterwegs, 1 Lager/Ersatz
            werkzeug("01020001", werk1, ToolStatus.AVAILABLE),
            werkzeug("01020002", werk1, None),
            werkzeug("01020003", werk1, ToolStatus.LENT),
            werkzeug("01020004", werk1, ToolStatus.IN_TRANSIT),
            werkzeug("01020005", werk1, ToolStatus.AVAILABLE, lager=True),
            # Werk 2: ein verfügbares Werkzeug
            werkzeug("02020001", werk2, ToolStatus.AVAILABLE),
        ]
    )

    db.add_all(
        [
            SerialArticle(article_number="SA-1", plant_id=werk1.id),
            DataSheet(name="Blatt Werk 1", plant_id=werk1.id),
            DataSheet(name="Allgemeines Blatt", plant_id=None),
            SparePart(article_number="ET-1", plant_id=werk1.id, quantity=5),
        ]
    )

    jetzt = datetime.now(timezone.utc)
    db.add_all(
        [
            # Entwurf, gerade angelegt → offen, aber nicht „alt"
            TransportOrder(
                order_number="A-1",
                status=TransportStatus.DRAFT,
                from_plant_id=werk1.id,
                to_plant_id=werk2.id,
            ),
            # unterwegs seit 2 Tagen → offen, nicht alt
            TransportOrder(
                order_number="A-2",
                status=TransportStatus.SENT,
                from_plant_id=werk1.id,
                to_plant_id=werk2.id,
                sent_at=jetzt - timedelta(days=2),
            ),
            # eingehend in Werk 1, seit 10 Tagen unterwegs → offen **und** alt
            TransportOrder(
                order_number="A-3",
                status=TransportStatus.SENT,
                from_plant_id=werk2.id,
                to_plant_id=werk1.id,
                sent_at=jetzt - timedelta(days=10),
            ),
            # abgeschlossen → nicht offen
            TransportOrder(
                order_number="A-4",
                status=TransportStatus.RECEIVED,
                from_plant_id=werk1.id,
                to_plant_id=werk2.id,
                sent_at=jetzt - timedelta(days=3),
                closed_at=jetzt,
            ),
            # fremder Auftrag ohne Werk 1 → zählt in Werk 2
            TransportOrder(
                order_number="A-5",
                status=TransportStatus.PARTLY_RECEIVED,
                from_plant_id=werk2.id,
                to_plant_id=werk2.id,
                sent_at=jetzt - timedelta(days=9),
            ),
        ]
    )
    await db.commit()
    return werk1, werk2


async def test_kennzahlen_des_arbeitswerks(session):
    werk1, _werk2 = await aufbau(session)

    zahlen = await StatsService(session).overview(werk1.id)

    # Werkzeuge: 5 in Werk 1, davon **3** verfügbar: zwei mit Status AVAILABLE
    # (einer davon Lager/Ersatz) und einer ganz ohne Status (DEC-080).
    assert zahlen.tools_total == 5
    assert zahlen.tools_available == 3
    assert zahlen.tools_lent == 1
    assert zahlen.tools_in_transit == 1
    assert zahlen.tools_storage == 1

    # Stammdaten: das Datenblatt ohne Werk zählt mit (DEC-085).
    assert zahlen.serial_articles == 1
    assert zahlen.data_sheets == 2
    assert zahlen.spare_parts == 1

    # Logistik: A-1 (Entwurf), A-2 (unterwegs), A-3 (eingehend) sind offen.
    assert zahlen.orders_open == 3
    assert zahlen.orders_draft == 1
    assert zahlen.orders_sent == 2
    assert zahlen.orders_incoming_open == 1
    # „alt": nur A-3 (seit 10 Tagen unterwegs).
    assert zahlen.orders_old == 1

    # Ausgehend (die Liste im Bereich „Aufträge aus <Werk>" zeigt nur das):
    # A-1 (Entwurf), A-2 (unterwegs) – A-3 ist eingehend.
    assert zahlen.orders_out_open == 2
    assert zahlen.orders_out_draft == 1
    assert zahlen.orders_out_sent == 1
    assert zahlen.orders_out_old == 0


async def test_zahlen_gelten_nur_fuer_das_eigene_werk(session):
    _werk1, werk2 = await aufbau(session)

    zahlen = await StatsService(session).overview(werk2.id)

    assert zahlen.tools_total == 1
    assert zahlen.tools_available == 1
    # Kein Serienartikel, kein Datenblatt des Werks – aber das allgemeine Blatt.
    assert zahlen.serial_articles == 0
    assert zahlen.data_sheets == 1
    assert zahlen.spare_parts == 0
    # Offen sind A-1, A-2, A-3 und A-5 (A-4 ist abgeschlossen).
    assert zahlen.orders_open == 4
    # Eingehend zu bestätigen: A-2 (unterwegs hierher) und A-5 (teilweise da).
    assert zahlen.orders_incoming_open == 2
    # „Alt": A-3 (10 Tage) und A-5 (9 Tage).
    assert zahlen.orders_old == 2
    # Ausgehend aus Werk 2: A-3 (10 Tage alt) und A-5 (9 Tage alt).
    assert zahlen.orders_out_open == 2
    assert zahlen.orders_out_old == 2


async def test_leeres_werk_liefert_nullen(session):
    werk = Plant(name="Werk 3", color=None)
    session.add(werk)
    await session.commit()
    await session.refresh(werk)

    zahlen = await StatsService(session).overview(werk.id)

    assert zahlen.tools_total == 0
    assert zahlen.orders_open == 0
    assert zahlen.orders_old == 0
    # Das allgemeine Datenblatt zählt auch hier (DEC-085) – hier gibt es keins.
    assert zahlen.data_sheets == 0
