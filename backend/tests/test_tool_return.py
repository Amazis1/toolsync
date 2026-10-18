"""Rückgabe eines Werkzeugs an eine Person (DEC-078, TASK-025a).

Geprüft wird der **Service** (`ReturnService`), weil dort die Regeln liegen:

* Rückgabe setzt das Werkzeug auf `available` und schreibt **eine** Bewegung.
* Die Bewegung trägt den ausführenden Benutzer (`user_id`) und das Arbeitswerk
  (`plant_id`) – nicht mehr die Personalnummer als Klartext in der Notiz.
* Ausgangsort ist der Heimatplatz (`03-C-02`) bzw. „Ablage"; Rückgabeort ist das
  Arbeitswerk.
* Nur ausgeliehene Werkzeuge sind rückgabefähig (sonst HTTP 400 im Router).
* `list_active_loans` liefert genau die ausgeliehenen Werkzeuge des Werks mit
  Ausleiher und Platz – die Grundlage der Rückgabe-Liste.

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_tool_return.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, ToolType
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.models.user import User
from app.models.movement import ToolMovement
from app.models.enums import MovementType, MovementStatus, ToolCategory, ToolStatus
from app.services.movement_service import MovementService
from app.services.return_service import ReturnService
from app.schemas.movement import ToolMovementCreate

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


async def aufbau(db, mit_platz=True):
    """Werk mit Schrank/Schublade/Platz, Werkzeugtyp, Benutzer und einem Werkzeug."""
    werk = Plant(name="Werk 1", color="#0f766e")
    typ = ToolType(name="01 Rund")
    db.add_all([werk, typ])
    await db.flush()

    platz_id = None
    if mit_platz:
        schrank = Cabinet(name="03", plant_id=werk.id)
        db.add(schrank)
        await db.flush()
        schublade = Drawer(name="C", cols=5, rows=1, cabinet_id=schrank.id)
        db.add(schublade)
        await db.flush()
        platz = Position(name="02", x=2, y=1, drawer_id=schublade.id)
        db.add(platz)
        await db.flush()
        platz_id = platz.id

    benutzer = User(
        personal_number="2277", first_name="Anna", last_name="Ausleiherin",
        is_active=True, is_admin=False,
    )
    db.add(benutzer)
    await db.flush()

    werkzeug = Tool(
        tool_id="01020002", category=ToolCategory.STEMPEL, status=ToolStatus.LENT,
        is_storage=False, allow_duplicate_id=False, measure_a="8,20",
        plant_id=werk.id, tool_type_id=typ.id, position_id=platz_id,
    )
    db.add(werkzeug)
    await db.commit()
    await db.refresh(werkzeug)
    return {"werk": werk, "benutzer": benutzer, "werkzeug": werkzeug, "platz_id": platz_id}


async def bewegungen(db):
    return list((await db.execute(select(ToolMovement).order_by(ToolMovement.id))).scalars().all())


class TestRueckgabe:
    async def test_setzt_verfuegbar_und_schreibt_eine_bewegung(self, session):
        ctx = await aufbau(session)
        service = ReturnService(session)

        werkzeug = await service.return_tool(
            ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id, note="Zustand in Ordnung"
        )

        assert werkzeug.status == ToolStatus.AVAILABLE
        alle = await bewegungen(session)
        assert len(alle) == 1
        bewegung = alle[0]
        assert bewegung.movement_type == MovementType.RETURN
        assert bewegung.status == MovementStatus.COMPLETED
        assert bewegung.tool_id == ctx["werkzeug"].id

    async def test_bewegung_traegt_benutzer_und_arbeitswerk(self, session):
        ctx = await aufbau(session)
        await ReturnService(session).return_tool(
            ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id
        )
        bewegung = (await bewegungen(session))[0]
        # Nicht mehr die Personalnummer als Klartext, sondern echte Bezüge
        assert bewegung.user_id == ctx["benutzer"].id
        assert bewegung.plant_id == ctx["werk"].id
        assert bewegung.user_display_name == "Anna Ausleiherin"

    async def test_ausgangsort_ist_der_heimatplatz(self, session):
        ctx = await aufbau(session)
        await ReturnService(session).return_tool(
            ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id
        )
        bewegung = (await bewegungen(session))[0]
        assert bewegung.from_location == "03-C-02", "Heimatplatz als Ausgangsort"
        assert bewegung.to_location == "Werk 1", "Rückgabeort ist das Arbeitswerk"

    async def test_werkzeug_ohne_platz_kommt_aus_der_ablage(self, session):
        ctx = await aufbau(session, mit_platz=False)
        werkzeug = await ReturnService(session).return_tool(
            ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id
        )
        bewegung = (await bewegungen(session))[0]
        assert bewegung.from_location == "Ablage"
        assert werkzeug.position_id is None, "ohne Heimatplatz bleibt das Werkzeug in der Ablage"

    async def test_notiz_ist_freiwillig(self, session):
        ctx = await aufbau(session)
        await ReturnService(session).return_tool(
            ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id
        )
        assert (await bewegungen(session))[0].note is None

    async def test_nicht_ausgeliehen_ist_ein_fehler(self, session):
        ctx = await aufbau(session)
        ctx["werkzeug"].status = ToolStatus.AVAILABLE
        await session.commit()
        with pytest.raises(ValueError) as fehler:
            await ReturnService(session).return_tool(
                ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id
            )
        assert "nicht ausgeliehen" in str(fehler.value)
        assert await bewegungen(session) == [], "kein Eintrag bei abgelehnter Rückgabe"

    async def test_unbekanntes_werkzeug_ist_ein_fehler(self, session):
        await aufbau(session)
        with pytest.raises(ValueError) as fehler:
            await ReturnService(session).return_tool(9999, None, None)
        assert "existiert nicht" in str(fehler.value)


class TestAusleihListe:
    async def test_listet_nur_ausgeliehene_werkzeuge_des_werks(self, session):
        ctx = await aufbau(session)
        zweites = Plant(name="Werk 2", color="#4338ca")
        session.add(zweites)
        await session.flush()
        session.add(
            Tool(
                tool_id="01020003", category=ToolCategory.STEMPEL,
                status=ToolStatus.AVAILABLE, is_storage=False, allow_duplicate_id=False,
                measure_a="8,20", plant_id=ctx["werk"].id,
                tool_type_id=ctx["werkzeug"].tool_type_id,
            )
        )
        await session.commit()

        liste = await ReturnService(session).list_active_loans(plant_id=ctx["werk"].id)
        assert [eintrag.tool_code for eintrag in liste] == ["01020002"]
        assert liste[0].user_id is None, "Ausleiher kommt aus der lend-Bewegung"
        assert liste[0].position_code == "03-C-02"

    async def test_ausleiher_kommt_aus_der_ausleih_bewegung(self, session):
        ctx = await aufbau(session)
        # Ausleihe über den MovementService (setzt lent + Bewegung mit Benutzer)
        ctx["werkzeug"].status = ToolStatus.AVAILABLE
        await session.commit()
        await MovementService(session).create_movement(
            ToolMovementCreate(
                movement_type=MovementType.LEND,
                tool_id=ctx["werkzeug"].id,
                user_id=ctx["benutzer"].id,
                note="Personalnummer: 2277",
            ),
            plant_id=ctx["werk"].id,
        )

        liste = await ReturnService(session).list_active_loans(plant_id=ctx["werk"].id)
        assert len(liste) == 1
        assert liste[0].user_id == ctx["benutzer"].id
        assert liste[0].user_display_name == "Anna Ausleiherin"
        assert liste[0].lent_at is not None

    async def test_rueckgabe_raeumt_die_liste(self, session):
        ctx = await aufbau(session)
        service = ReturnService(session)
        assert len(await service.list_active_loans(plant_id=ctx["werk"].id)) == 1
        await service.return_tool(ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id)
        assert await service.list_active_loans(plant_id=ctx["werk"].id) == []


class TestAusleiheMitArbeitswerk:
    async def test_ausleihe_schreibt_das_arbeitswerk(self, session):
        """`create_movement(..., plant_id=…)` hält das Werk an der Bewegung fest."""
        ctx = await aufbau(session)
        ctx["werkzeug"].status = ToolStatus.AVAILABLE
        await session.commit()
        bewegung = await MovementService(session).create_movement(
            ToolMovementCreate(
                movement_type=MovementType.LEND,
                tool_id=ctx["werkzeug"].id,
                user_id=ctx["benutzer"].id,
            ),
            plant_id=ctx["werk"].id,
        )
        assert bewegung.plant_id == ctx["werk"].id
        assert bewegung.user_id == ctx["benutzer"].id


class TestAusleiheOhneStatus:
    """„Ohne Status = verfügbar" (DEC-080).

    Der Bestand aus dem Altsystem führt keinen Status. Vorher hat die Ausleihe
    diese Werkzeuge mit „ist nicht verfügbar (aktueller Status: unbekannt)"
    abgewiesen – ein leeres Feld ist aber keine Sperre, sondern „nichts
    Abweichendes bekannt".
    """

    async def test_werkzeug_ohne_status_laesst_sich_ausleihen(self, session):
        ctx = await aufbau(session)
        ctx["werkzeug"].status = None
        await session.commit()

        bewegung = await MovementService(session).create_movement(
            ToolMovementCreate(
                movement_type=MovementType.LEND,
                tool_id=ctx["werkzeug"].id,
                user_id=ctx["benutzer"].id,
            ),
            plant_id=ctx["werk"].id,
        )
        assert bewegung.movement_type == MovementType.LEND
        assert ctx["werkzeug"].status == ToolStatus.LENT, "danach ist es ausgeliehen"

    async def test_defektes_werkzeug_bleibt_gesperrt(self, session):
        """Ein **gesetzter** abweichender Zustand sperrt weiterhin."""
        ctx = await aufbau(session)
        ctx["werkzeug"].status = ToolStatus.DEFECTIVE
        await session.commit()

        with pytest.raises(ValueError) as fehler:
            await MovementService(session).create_movement(
                ToolMovementCreate(
                    movement_type=MovementType.LEND,
                    tool_id=ctx["werkzeug"].id,
                    user_id=ctx["benutzer"].id,
                ),
                plant_id=ctx["werk"].id,
            )
        assert "nicht verfügbar" in str(fehler.value)
        assert "defective" in str(fehler.value)

    async def test_ausgeliehen_ohne_status_geht_zurueck(self, session):
        """Die Rückgabe braucht `lent` – das setzt die Ausleihe selbst."""
        ctx = await aufbau(session)
        ctx["werkzeug"].status = None
        await session.commit()

        service = MovementService(session)
        await service.create_movement(
            ToolMovementCreate(
                movement_type=MovementType.LEND,
                tool_id=ctx["werkzeug"].id,
                user_id=ctx["benutzer"].id,
            ),
            plant_id=ctx["werk"].id,
        )
        werkzeug = await ReturnService(session).return_tool(
            ctx["werkzeug"].id, ctx["benutzer"].id, ctx["werk"].id
        )
        assert werkzeug.status == ToolStatus.AVAILABLE
