"""Tests für die Live-Prüfung der Werkzeug-ID im Anlegeformular.

Ausgangslage (gemeldeter Fall): Ein Stempel mit der ID 01020000 liegt aktiv
auf Platz 01-A-25, dazu existiert bereits ein Ersatz-Exemplar derselben ID in
der Ablage. Das Formular zeigte beim Anlegen eines weiteren Exemplars nur
"existiert bereits 1x" (weil die Prüfung Lager/Ersatz und normale Werkzeuge
trennte) und ließ Maß, Typ und Lagerplatz neu eintippen.

Geprüft wird:
- die Prüfung listet ALLE Datensätze der ID (normales Werkzeug + Lager/Ersatz)
- sie blockiert bei Lager/Ersatz nie
- sie liefert die Übernahme-Daten (Maße, Typ, Beschreibung)
- Vorlage ist der Datensatz mit festem Lagerplatz; nur wenn keiner einen Platz
  hat, wird "In Ablage legen" vorbelegt
- normale Werkzeuge bleiben unverändert eindeutig

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_tool_id_check.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, ToolType
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.models.movement import ToolMovement  # noqa: F401  (Model registrieren)
from app.models.enums import ToolCategory, ToolStatus
from app.services.tool_service import ToolService

pytestmark = pytest.mark.asyncio

TOOL_ID = "01020000"


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db_session:
        yield db_session

    await engine.dispose()


@pytest_asyncio.fixture
async def workspace(session):
    """Werk 1 mit Schrank 01 / Schublade A / Platz 25 (= Code 01-A-25)."""
    plant = Plant(name="Werk 1")
    tool_type = ToolType(name="01 Rund")
    session.add_all([plant, tool_type])
    await session.flush()

    cabinet = Cabinet(name="01", plant_id=plant.id)
    session.add(cabinet)
    await session.flush()

    drawer = Drawer(name="A", cols=25, rows=1, cabinet_id=cabinet.id)
    session.add(drawer)
    await session.flush()

    position = Position(name="25", x=25, y=1, drawer_id=drawer.id)
    session.add(position)
    second_position = Position(name="26", x=26, y=1, drawer_id=drawer.id)
    session.add(second_position)
    await session.flush()

    active_tool = Tool(
        tool_id=TOOL_ID,
        category=ToolCategory.STEMPEL,
        status=ToolStatus.AVAILABLE,
        is_storage=False,
        allow_duplicate_id=False,
        measure_a="7,00",
        measure_b="8,00",
        description="Stempel für Kunde X",
        plant_id=plant.id,
        tool_type_id=tool_type.id,
        position_id=position.id,
    )
    session.add(active_tool)
    await session.flush()

    position.tool_id = active_tool.id
    await session.commit()

    return {
        "plant": plant,
        "tool_type": tool_type,
        "position": position,
        "second_position": second_position,
        "active_tool": active_tool,
    }


async def test_storage_check_lists_active_tool_and_spare(session, workspace):
    """Beide Datensätze der ID erscheinen – auch das aktive Werkzeug."""
    session.add(
        Tool(
            tool_id=TOOL_ID,
            category=ToolCategory.STEMPEL,
            status=None,
            is_storage=True,
            allow_duplicate_id=True,
            measure_a="7,00",
            measure_b="8,00",
            plant_id=workspace["plant"].id,
            tool_type_id=workspace["tool_type"].id,
            position_id=None,  # Ablage
        )
    )
    await session.commit()

    result = await ToolService(session).check_tool_id(
        TOOL_ID, ToolCategory.STEMPEL, workspace["plant"].id, is_storage=True
    )

    assert result["available"] is True, "Lager/Ersatz darf nie blockieren"
    assert result["existing_count"] == 2

    by_location = {loc["location"]: loc for loc in result["locations"]}
    assert set(by_location) == {"01-A-25", "Ablage"}

    active = by_location["01-A-25"]
    assert active["is_storage"] is False
    assert active["status"] == ToolStatus.AVAILABLE.value
    assert active["tool_type_name"] == "01 Rund"

    spare = by_location["Ablage"]
    assert spare["is_storage"] is True
    assert spare["status"] is None


async def test_tool_with_place_has_priority_over_ablage(session, workspace):
    """Datensatz mit Platz schlägt Ablage – auch wenn Ablage neuer ist.

    Gemeldeter Fall: aktiver Stempel auf 01-A-25 plus Ersatz in der Ablage.
    Vorlage ist der Stempel auf dem Platz, und „In Ablage legen" wird NICHT
    vorbelegt.
    """
    session.add(
        Tool(
            tool_id=TOOL_ID,
            category=ToolCategory.STEMPEL,
            status=None,
            is_storage=True,
            allow_duplicate_id=True,
            measure_a="7,50",
            measure_b="9,00",
            description="Ersatz-Stempel",
            plant_id=workspace["plant"].id,
            tool_type_id=workspace["tool_type"].id,
            position_id=None,  # Ablage, aber neuer als das Werkzeug auf dem Platz
        )
    )
    await session.commit()

    result = await ToolService(session).check_tool_id(
        TOOL_ID, ToolCategory.STEMPEL, workspace["plant"].id, is_storage=True
    )
    prefill = result["prefill"]

    assert prefill["source_location"] == "01-A-25"
    assert prefill["source_is_storage"] is False
    assert prefill["measure_a"] == "7,00"
    assert prefill["description"] == "Stempel für Kunde X"
    assert prefill["in_tray"] is False, "Platz hat Vorrang vor Ablage"


async def test_spare_with_place_has_priority_over_spare_in_ablage(session, workspace):
    """Ein Ersatz MIT Platz schlägt einen Ersatz in der Ablage."""
    session.add_all(
        [
            Tool(
                tool_id=TOOL_ID,
                category=ToolCategory.STEMPEL,
                is_storage=True,
                allow_duplicate_id=True,
                measure_a="7,50",
                description="Ersatz in der Ablage",
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["tool_type"].id,
                position_id=None,
            ),
            Tool(
                tool_id=TOOL_ID,
                category=ToolCategory.STEMPEL,
                is_storage=True,
                allow_duplicate_id=True,
                measure_a="8,25",
                description="Ersatz auf Platz 26",
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["tool_type"].id,
                position_id=workspace["second_position"].id,
            ),
        ]
    )
    await session.commit()

    result = await ToolService(session).check_tool_id(
        TOOL_ID, ToolCategory.STEMPEL, workspace["plant"].id, is_storage=True
    )
    prefill = result["prefill"]

    assert prefill["source_location"] == "01-A-26"
    assert prefill["source_is_storage"] is True
    assert prefill["measure_a"] == "8,25"
    assert prefill["description"] == "Ersatz auf Platz 26"
    assert prefill["in_tray"] is False


async def test_in_tray_only_when_no_record_has_place(session, workspace):
    """Liegt alles in der Ablage, wird „In Ablage legen" vorbelegt."""
    # Das aktive Werkzeug von seinem Platz nehmen
    workspace["active_tool"].position_id = None
    workspace["position"].tool_id = None
    await session.commit()

    session.add(
        Tool(
            tool_id=TOOL_ID,
            category=ToolCategory.STEMPEL,
            is_storage=True,
            allow_duplicate_id=True,
            measure_a="8,25",
            description="Ersatz in der Ablage",
            plant_id=workspace["plant"].id,
            tool_type_id=workspace["tool_type"].id,
            position_id=None,
        )
    )
    await session.commit()

    result = await ToolService(session).check_tool_id(
        TOOL_ID, ToolCategory.STEMPEL, workspace["plant"].id, is_storage=True
    )
    prefill = result["prefill"]

    assert prefill["in_tray"] is True
    assert prefill["source_is_storage"] is True
    assert prefill["source_location"] == "Ablage"
    assert prefill["measure_a"] == "8,25"


async def test_prefill_from_active_tool_when_no_spare_exists(session, workspace):
    """Ohne Ersatz-Exemplar dient das Werkzeug auf dem Platz als Vorlage."""
    result = await ToolService(session).check_tool_id(
        TOOL_ID, ToolCategory.STEMPEL, workspace["plant"].id, is_storage=True
    )

    assert result["existing_count"] == 1
    assert result["locations"][0]["location"] == "01-A-25"

    prefill = result["prefill"]
    assert prefill["source_is_storage"] is False
    assert prefill["source_location"] == "01-A-25"
    assert prefill["measure_a"] == "7,00"
    assert prefill["description"] == "Stempel für Kunde X"
    # Kein Ersatz-Exemplar vorhanden -> keine automatische Ablage
    assert prefill["in_tray"] is False


async def test_free_id_has_nothing_to_prefill(session, workspace):
    """Neue ID: keine Fundorte, kein Übernahme-Vorschlag."""
    result = await ToolService(session).check_tool_id(
        "99999999", ToolCategory.STEMPEL, workspace["plant"].id, is_storage=True
    )

    assert result["available"] is True
    assert result["existing_count"] == 0
    assert result["locations"] == []
    assert result["prefill"] is None
    assert result["message"] == "Diese ID gibt es hier noch nicht."


async def test_normal_tool_stays_blocked_and_ignores_spare(session, workspace):
    """Normale Werkzeuge bleiben eindeutig; Lager/Ersatz blockiert dort nicht."""
    session.add(
        Tool(
            tool_id=TOOL_ID,
            category=ToolCategory.STEMPEL,
            status=None,
            is_storage=True,
            allow_duplicate_id=True,
            plant_id=workspace["plant"].id,
            tool_type_id=workspace["tool_type"].id,
        )
    )
    await session.commit()

    service = ToolService(session)

    # ID ist als normales Werkzeug belegt -> blockiert (Lager/Ersatz zählt nicht mit)
    blocked = await service.check_tool_id(
        TOOL_ID, ToolCategory.STEMPEL, workspace["plant"].id, is_storage=False
    )
    assert blocked["available"] is False
    assert blocked["existing_count"] == 1
    assert "bereits vergeben" in blocked["message"]

    # Andere Kategorie = anderer ID-Bereich -> frei
    other_category = await service.check_tool_id(
        TOOL_ID, ToolCategory.MATRIZE, workspace["plant"].id, is_storage=False
    )
    assert other_category["available"] is True
    assert other_category["existing_count"] == 0


async def test_edit_excludes_own_record(session, workspace):
    """Beim Bearbeiten zählt der eigene Datensatz nicht als Duplikat."""
    result = await ToolService(session).check_tool_id(
        TOOL_ID,
        ToolCategory.STEMPEL,
        workspace["plant"].id,
        is_storage=False,
        exclude_id=workspace["active_tool"].id,
    )

    assert result["available"] is True
    assert result["existing_count"] == 0
    assert result["locations"] == []
