"""Verlauf mit Filtern und Seiten (DEC-094).

Geprüft wird der **Service** (`MovementService.history`) – dort liegen die
Bedingungen der Suche und die Gesamtzahl:

* Vorgang (Ausleihe, Rückgabe, Umbuchung, Statuswechsel),
* **Suchbegriff** über Werkzeug-ID, Beschreibung, Person, Ort und Notiz
  (das konnte der Endpunkt vorher nicht),
* Zeitraum (`von`/`bis`, über den Zeitstempel der Bewegung),
* Arbeitswerk (wer gehandelt hat, DEC-070),
* Gesamtzahl für „1–50 von N".

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_movements_history.py -q
"""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.base import Base
from app.models.enums import MovementStatus, MovementType, ToolCategory, ToolStatus
from app.models.master_data import Plant, ToolType
from app.models.movement import ToolMovement
from app.models.tool import Tool
from app.models.user import User
from app.services.movement_service import MovementService

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
    """Zwei Werke, zwei Personen, zwei Werkzeuge und vier Bewegungen."""
    werk1 = Plant(name="Werk 1", color="#0f766e")
    werk2 = Plant(name="Werk 2", color="#4338ca")
    typ = ToolType(name="01 Rund")
    db.add_all([werk1, werk2, typ])
    await db.flush()

    anna = User(
        personal_number="2277",
        first_name="Anna",
        last_name="Ausleiherin",
        is_active=True,
        is_admin=False,
    )
    bernd = User(
        personal_number="3311",
        first_name="Bernd",
        last_name="Bestaetiger",
        is_active=True,
        is_admin=False,
    )
    db.add_all([anna, bernd])
    await db.flush()

    stempel = Tool(
        tool_id="01025000",
        category=ToolCategory.STEMPEL,
        status=ToolStatus.AVAILABLE,
        is_storage=False,
        allow_duplicate_id=False,
        measure_a="8,20",
        description="Stempel Prüfstand",
        plant_id=werk1.id,
        tool_type_id=typ.id,
    )
    matrize = Tool(
        tool_id="01026000",
        category=ToolCategory.MATRIZE,
        status=ToolStatus.AVAILABLE,
        is_storage=False,
        allow_duplicate_id=False,
        measure_a="9,10",
        description="Matrize Nord",
        plant_id=werk1.id,
        tool_type_id=typ.id,
    )
    db.add_all([stempel, matrize])
    await db.flush()

    jetzt = datetime.now(timezone.utc)
    db.add_all(
        [
            ToolMovement(
                movement_type=MovementType.LEND,
                status=MovementStatus.OPEN,
                tool_id=stempel.id,
                user_id=anna.id,
                plant_id=werk1.id,
                from_location="03-C-02",
                to_location="Werk 1",
                note="für Prüfstand",
                timestamp=jetzt - timedelta(days=2),
            ),
            ToolMovement(
                movement_type=MovementType.RETURN,
                status=MovementStatus.COMPLETED,
                tool_id=stempel.id,
                user_id=anna.id,
                plant_id=werk1.id,
                from_location="03-C-02",
                to_location="Werk 1",
                timestamp=jetzt - timedelta(days=1),
            ),
            ToolMovement(
                movement_type=MovementType.STATUS_CHANGE,
                status=MovementStatus.COMPLETED,
                tool_id=matrize.id,
                user_id=bernd.id,
                plant_id=werk2.id,
                note="Wartung",
                timestamp=jetzt - timedelta(days=10),
            ),
            ToolMovement(
                movement_type=MovementType.RELOCATE,
                status=MovementStatus.COMPLETED,
                tool_id=matrize.id,
                user_id=bernd.id,
                plant_id=None,  # Altdaten ohne Arbeitswerk
                from_location="01-A-01",
                to_location="02-B-03",
                timestamp=jetzt - timedelta(days=30),
            ),
        ]
    )
    await db.commit()
    return werk1, werk2, anna, bernd


async def test_verlauf_ohne_filter_mit_gesamtzahl(session):
    await aufbau(session)
    zeilen, gesamt = await MovementService(session).history()
    assert gesamt == 4
    assert len(zeilen) == 4
    # Neueste zuerst.
    assert zeilen[0].movement_type == MovementType.RETURN


async def test_suche_findet_werkzeug_person_ort_und_notiz(session):
    await aufbau(session)
    service = MovementService(session)

    async def anzahl(q):
        _zeilen, gesamt = await service.history(q=q)
        return gesamt

    assert await anzahl("01025000") == 2  # Werkzeug-ID
    assert await anzahl("Matrize") == 2  # Beschreibung
    assert await anzahl("Anna") == 2  # Vorname
    assert await anzahl("Ausleiherin") == 2  # Nachname
    assert await anzahl("Wartung") == 1  # Notiz
    assert await anzahl("02-B-03") == 1  # Zielort
    assert await anzahl("gibtesnicht") == 0


async def test_filter_nach_vorgang_werk_und_zeitraum(session):
    werk1, _werk2, anna, _bernd = await aufbau(session)
    service = MovementService(session)
    jetzt = datetime.now(timezone.utc)

    zeilen, gesamt = await service.history(arten=[MovementType.LEND])
    assert gesamt == 1 and zeilen[0].movement_type == MovementType.LEND

    _zeilen, gesamt = await service.history(plant_id=werk1.id)
    assert gesamt == 2, "nur Bewegungen im Arbeitswerk Werk 1"

    # Altdaten ohne Arbeitswerk erscheinen bei „alle Werke", aber in keinem Werk.
    _zeilen, gesamt = await service.history(plant_id=None)
    assert gesamt == 4

    _zeilen, gesamt = await service.history(von=jetzt - timedelta(days=7))
    assert gesamt == 2, "die letzten sieben Tage"

    _zeilen, gesamt = await service.history(bis=jetzt - timedelta(days=5))
    assert gesamt == 2, "älter als fünf Tage"


async def test_seiten_und_gesamtzahl(session):
    await aufbau(session)
    service = MovementService(session)
    erste, gesamt = await service.history(skip=0, limit=2)
    zweite, _ = await service.history(skip=2, limit=2)
    assert gesamt == 4
    assert len(erste) == 2 and len(zweite) == 2
    assert {z.id for z in erste}.isdisjoint({z.id for z in zweite})
