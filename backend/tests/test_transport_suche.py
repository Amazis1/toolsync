"""Suche und „nur meine" in der Auftragsliste (DEC-090).

Die Suche fand vorher nur **Auftrags-Nr.** und **Reference**. Damit war
„welcher Auftrag hatte dieses Werkzeug?" und „was hat Frau Maier verschickt?"
nicht zu beantworten – beides sind Alltagsfragen der Logistik. Geprüft wird hier
der **Service** (`list_orders`), weil dort die Bedingung gebaut wird:

* Werkzeug-ID über die Positionen (`ANY` – kein Auftrag erscheint doppelt),
* Personen: angelegt, verschickt, je Werkzeug bestätigt,
* Info-Text des Auftrags,
* `mine_user_id` = nur die eigenen Aufträge.

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_transport_suche.py -q
"""

from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.base import Base
from app.models.enums import ToolCategory, ToolStatus, TransportStatus
from app.models.master_data import Plant, ToolType
from app.models.tool import Tool
from app.models.transport import TransportItem, TransportOrder
from app.models.user import User
from app.services.transport_service import TransportService

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
    """Zwei Werke, zwei Personen, drei Werkzeuge und drei Aufträge."""
    werk1 = Plant(name="Werk 1", color="#0f766e")
    werk2 = Plant(name="Werk 2", color="#4338ca")
    typ = ToolType(name="01 Rund")
    db.add_all([werk1, werk2, typ])
    await db.flush()

    anna = User(
        personal_number="2277", first_name="Anna", last_name="Ausleiherin",
        is_active=True, is_admin=False,
    )
    bernd = User(
        personal_number="3311", first_name="Bernd", last_name="Bestaetiger",
        is_active=True, is_admin=False,
    )
    db.add_all([anna, bernd])
    await db.flush()

    def werkzeug(code):
        return Tool(
            tool_id=code, category=ToolCategory.STEMPEL, status=ToolStatus.IN_TRANSIT,
            is_storage=False, allow_duplicate_id=False, measure_a="8,20",
            plant_id=werk1.id, tool_type_id=typ.id,
        )

    stempel = werkzeug("01025000")
    matrize = werkzeug("01026000")
    db.add_all([stempel, matrize])
    await db.flush()

    jetzt = datetime.now(timezone.utc)
    erster = TransportOrder(
        order_number="AUF-100", reference="SAP-77", info="Eilauftrag Prüfstand",
        status=TransportStatus.SENT, from_plant_id=werk1.id, to_plant_id=werk2.id,
        created_by_id=anna.id, sent_by_id=anna.id, sent_at=jetzt,
    )
    zweiter = TransportOrder(
        order_number="AUF-200", status=TransportStatus.RECEIVED,
        from_plant_id=werk1.id, to_plant_id=werk2.id,
        created_by_id=bernd.id, sent_by_id=bernd.id, sent_at=jetzt, closed_at=jetzt,
    )
    db.add_all([erster, zweiter])
    await db.flush()

    db.add_all(
        [
            TransportItem(order_id=erster.id, tool_id=stempel.id),
            TransportItem(order_id=erster.id, tool_id=matrize.id),
            TransportItem(
                order_id=zweiter.id, tool_id=matrize.id,
                received_at=jetzt, received_by_id=anna.id,
            ),
        ]
    )
    await db.commit()
    return werk1, anna, bernd


async def test_suche_findet_werkzeug_id_info_und_personen(session):
    werk1, anna, _bernd = await aufbau(session)
    service = TransportService(session)

    async def nummern(q):
        auftraege, _gesamt = await service.list_orders(werk1.id, q=q)
        return sorted(auftrag.order_number for auftrag in auftraege)

    # Werkzeug-ID über die Positionen – **beide** Aufträge enthalten 01026000.
    assert await nummern("01026000") == ["AUF-100", "AUF-200"]
    # Nur der erste Auftrag enthält 01025000.
    assert await nummern("01025000") == ["AUF-100"]
    # Info-Text.
    assert await nummern("Prüfstand") == ["AUF-100"]
    # Reference und Auftrags-Nr. (wie bisher).
    assert await nummern("SAP-77") == ["AUF-100"]
    assert await nummern("AUF-200") == ["AUF-200"]
    # Personen: Anna hat AUF-100 angelegt und verschickt und hat AUF-200 bestätigt.
    assert await nummern("Anna") == ["AUF-100", "AUF-200"]
    # Bernd hat AUF-200 angelegt und verschickt.
    assert await nummern("Bernd") == ["AUF-200"]
    # Nachname funktioniert genauso.
    assert await nummern("Ausleiherin") == ["AUF-100", "AUF-200"]
    # Nichts gefunden ist eine leere Liste, kein Fehler.
    assert await nummern("gibtesnicht") == []


async def test_werkzeug_treffer_erzeugt_keine_doppelten_zeilen(session):
    """`ANY` statt JOIN: ein Auftrag mit zwei Treffern erscheint **einmal**."""
    werk1, _anna, _bernd = await aufbau(session)
    service = TransportService(session)

    # Beide Werkzeuge des ersten Auftrags passen auf „0102".
    auftraege, gesamt = await service.list_orders(werk1.id, q="0102")
    nummern = [auftrag.order_number for auftrag in auftraege]
    assert nummern.count("AUF-100") == 1
    assert gesamt == len(nummern)


async def test_nur_meine_auftraege(session):
    werk1, anna, bernd = await aufbau(session)
    service = TransportService(session)

    meine, _ = await service.list_orders(werk1.id, mine_user_id=anna.id)
    assert [auftrag.order_number for auftrag in meine] == ["AUF-100"]

    seine, _ = await service.list_orders(werk1.id, mine_user_id=bernd.id)
    assert [auftrag.order_number for auftrag in seine] == ["AUF-200"]

    alle, _ = await service.list_orders(werk1.id)
    assert len(alle) == 2
