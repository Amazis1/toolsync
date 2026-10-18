"""Tests für das Arbeitswerk (DEC-070) und die Werkfarbe (DEC-076).

Das Arbeitswerk ist der Kontext eines Requests: Das Frontend schickt die Wahl des
Benutzers als Header `X-Plant-Id`, der Server prüft sie. Reihenfolge:
Header → `users.default_plant_id` → erstes Werk. Ein unbekanntes Werk ist **400**
und kein stiller Rückfall; das Arbeitswerk **filtert nichts**.

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_active_plant.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, ToolType
from app.models.tool import Tool
from app.models.movement import ToolMovement  # noqa: F401  (Modell registrieren)
from app.models.user import User
from app.models.enums import ToolCategory, ToolStatus
from app.dependencies.plant import resolve_active_plant_id, get_active_plant
from app.schemas.master_data import PlantUpdate, normalize_color
from app.schemas.tool import ToolRead
from app.services.tool_service import ToolService

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


async def _werke(db, anzahl=2):
    werke = []
    for nummer, farbe in zip(range(1, anzahl + 1), ["#0f766e", "#4338ca", "#a16207"]):
        werk = Plant(name=f"Werk {nummer}", color=farbe)
        db.add(werk)
        werke.append(werk)
    await db.commit()
    for werk in werke:
        await db.refresh(werk)
    return werke


async def _benutzer(db, default_plant_id=None, personal_number="1000"):
    benutzer = User(
        personal_number=personal_number,
        first_name="Test",
        last_name="Person",
        is_active=True,
        is_admin=False,
        default_plant_id=default_plant_id,
    )
    db.add(benutzer)
    await db.commit()
    await db.refresh(benutzer)
    return benutzer


# ----------------------------------------------------------------------
# Auflösung des Arbeitswerks
# ----------------------------------------------------------------------
class TestAufloesung:
    async def test_header_gewinnt(self, session):
        werke = await _werke(session)
        benutzer = await _benutzer(session, default_plant_id=werke[0].id)
        werk = await get_active_plant(str(werke[1].id), session, benutzer)
        assert werk.id == werke[1].id, "Die Wahl des Benutzers schlägt die Vorgabe"

    async def test_ohne_header_greift_die_vorgabe(self, session):
        werke = await _werke(session)
        benutzer = await _benutzer(session, default_plant_id=werke[1].id)
        werk = await get_active_plant(None, session, benutzer)
        assert werk.id == werke[1].id

    async def test_ohne_vorgabe_greift_das_erste_werk(self, session):
        werke = await _werke(session)
        benutzer = await _benutzer(session)
        werk = await get_active_plant(None, session, benutzer)
        assert werk.id == werke[0].id

    async def test_unbekanntes_werk_im_header_ist_ein_fehler(self, session):
        await _werke(session)
        benutzer = await _benutzer(session)
        with pytest.raises(Exception) as fehler:
            await get_active_plant("9999", session, benutzer)
        assert "existiert nicht" in str(fehler.value)

    async def test_unsinniger_header_ist_ein_fehler(self, session):
        await _werke(session)
        benutzer = await _benutzer(session)
        with pytest.raises(Exception) as fehler:
            await get_active_plant("Werk-1", session, benutzer)
        assert "Ungültiges Arbeitswerk" in str(fehler.value)

    async def test_leerer_header_zaehlt_wie_kein_header(self, session):
        werke = await _werke(session)
        benutzer = await _benutzer(session, default_plant_id=werke[1].id)
        werk = await get_active_plant("", session, benutzer)
        assert werk.id == werke[1].id

    async def test_aufloesung_fuer_antworten_ohne_header(self, session):
        werke = await _werke(session)
        benutzer = await _benutzer(session, default_plant_id=werke[1].id)
        assert await resolve_active_plant_id(session, benutzer) == werke[1].id

    async def test_ohne_werke_klare_meldung(self, session):
        benutzer = await _benutzer(session)
        with pytest.raises(Exception) as fehler:
            await get_active_plant(None, session, benutzer)
        assert "kein Werk angelegt" in str(fehler.value)


# ----------------------------------------------------------------------
# Das Arbeitswerk filtert nichts (DEC-070 Punkt 6)
# ----------------------------------------------------------------------
class TestKeinFilter:
    async def test_werkzeugliste_bleibt_werkuebergreifend(self, session):
        werke = await _werke(session)
        typ = ToolType(name="01 Rund")
        session.add(typ)
        await session.flush()
        for werk in werke:
            session.add(Tool(
                tool_id=f"0102000{werk.id}", category=ToolCategory.STEMPEL,
                status=ToolStatus.AVAILABLE, is_storage=False, allow_duplicate_id=False,
                measure_a="7,00", plant_id=werk.id, tool_type_id=typ.id,
            ))
        await session.commit()

        service = ToolService(session)
        # Ohne expliziten Werk-Filter liefert die Liste alle Werke – das Arbeitswerk
        # ist Bequemlichkeit, keine Zugangskontrolle.
        seite = await service.get_tools(limit=50)
        assert seite["total"] == len(werke)

        # Und der bestehende Werk-Filter funktioniert unverändert.
        nur_werk_2 = await service.get_tools(plant_id=werke[1].id, limit=50)
        assert nur_werk_2["total"] == 1


# ----------------------------------------------------------------------
# Werkfarbe
# ----------------------------------------------------------------------
class TestWerkfarbe:
    async def test_farbe_wird_normalisiert(self):
        assert normalize_color("#0F766E") == "#0f766e"
        assert normalize_color("  #abc ") == "#abc"
        assert normalize_color("") is None
        assert normalize_color(None) is None

    async def test_unsinnige_farbe_wird_abgelehnt(self):
        with pytest.raises(ValueError) as fehler:
            normalize_color("blau")
        assert "Hex-Wert" in str(fehler.value)
        with pytest.raises(ValueError):
            normalize_color("#12345")

    async def test_werk_hat_farbe_und_sie_ist_aenderbar(self, session):
        werke = await _werke(session)
        assert werke[0].color == "#0f766e"
        daten = PlantUpdate(name="Werk 1", color="#7c3aed")
        assert daten.color == "#7c3aed", "Farbe muss über das Formular änderbar sein"


# ----------------------------------------------------------------------
# Aktueller Ort am Werkzeug (DEC-071)
# ----------------------------------------------------------------------
class TestAktuellerOrt:
    async def test_aktueller_ort_ist_optional_und_bedeutet_heimatwerk(self, session):
        werke = await _werke(session)
        typ = ToolType(name="01 Rund")
        session.add(typ)
        await session.flush()
        werkzeug = Tool(
            tool_id="01020000", category=ToolCategory.STEMPEL,
            status=ToolStatus.AVAILABLE, is_storage=False, allow_duplicate_id=False,
            measure_a="7,00", plant_id=werke[0].id, tool_type_id=typ.id,
        )
        session.add(werkzeug)
        await session.commit()
        await session.refresh(werkzeug)
        assert werkzeug.current_plant_id is None
        gelesen = ToolRead.model_validate(werkzeug)
        assert gelesen.current_plant_id is None
        assert gelesen.plant is not None and gelesen.plant.id == werke[0].id
