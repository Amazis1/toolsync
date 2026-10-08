"""Tests zum Bearbeiten eines Werkzeugs (ToolService.update_tool).

Ausgangslage (gemeldeter Fall): Im Bearbeiten-Formular ließ sich der Status
nicht auf „— ohne Status —" zurückstellen — der alte Wert blieb stehen. Ursache
war `CRUDBase.update()`, das None-Werte als „nicht ändern" behandelt. Dieselbe
Falle traf Beschreibung, Maß B, Maschine, Kunde und `position_id`.

Geprüft wird:
- Status setzen und wieder leeren
- Beschreibung setzen und wieder leeren (leerer Text = null)
- Maß B leeren
- Platz verlassen (position_id = null gibt die Position frei)
- Favorit bleibt bei einer normalen Bearbeitung erhalten

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_tool_update.py -q
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
from app.schemas.tool import ToolUpdate
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


@pytest_asyncio.fixture
async def tool(session):
    """Ein Werkzeug mit Status, Beschreibung, Maß B und festem Lagerplatz."""
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
    await session.flush()

    entry = Tool(
        tool_id="01025000",
        category=ToolCategory.STEMPEL,
        status=ToolStatus.AVAILABLE,
        measure_a="7,00",
        measure_b="8,00",
        description="Rund 2.5 ALU",
        plant_id=plant.id,
        tool_type_id=tool_type.id,
        position_id=position.id,
    )
    session.add(entry)
    await session.commit()

    position.tool_id = entry.id
    await session.commit()

    return {
        "plant": plant,
        "tool_type": tool_type,
        "position": position,
        "entry": entry,
    }


def full_payload(tool: dict, **overrides) -> ToolUpdate:
    """Vollständige Nutzlast wie aus dem Formular, mit Abweichungen."""
    entry = tool["entry"]
    payload = {
        "tool_id": entry.tool_id,
        "category": entry.category,
        "status": entry.status,
        "is_storage": entry.is_storage,
        "allow_duplicate_id": entry.allow_duplicate_id,
        "measure_a": entry.measure_a,
        "measure_b": entry.measure_b,
        "description": entry.description,
        "plant_id": entry.plant_id,
        "tool_type_id": entry.tool_type_id,
        "position_id": entry.position_id,
        "machine_id": None,
        "customer_id": None,
    }
    payload.update(overrides)
    return ToolUpdate(**payload)


async def test_status_can_be_set_and_cleared(session, tool):
    """Status ändern und wieder auf „ohne Status" zurückstellen."""
    service = ToolService(session)
    entry_id = tool["entry"].id

    await service.update_tool(entry_id, full_payload(tool, status=ToolStatus.MAINTENANCE))
    assert (await service.get_tool(entry_id)).status == ToolStatus.MAINTENANCE

    # Zurückstellen auf „— ohne Status —" (null) muss ankommen
    await service.update_tool(entry_id, full_payload(tool, status=None))
    assert (await service.get_tool(entry_id)).status is None, (
        "Status muss sich leeren lassen"
    )

    # Und wieder setzbar sein
    await service.update_tool(entry_id, full_payload(tool, status=ToolStatus.LENT))
    assert (await service.get_tool(entry_id)).status == ToolStatus.LENT


async def test_description_and_measure_b_can_be_cleared(session, tool):
    """Beschreibung und Maß B lassen sich leeren."""
    service = ToolService(session)
    entry_id = tool["entry"].id

    await service.update_tool(
        entry_id, full_payload(tool, description=None, measure_b=None)
    )
    updated = await service.get_tool(entry_id)

    assert updated.description is None
    assert updated.measure_b is None
    assert updated.measure_a == "7,00", "Maß A bleibt unberührt"


async def test_leaving_the_place_releases_the_position(session, tool):
    """„In Ablage legen" gibt den Lagerplatz frei."""
    service = ToolService(session)
    entry_id = tool["entry"].id

    await service.update_tool(entry_id, full_payload(tool, position_id=None))
    updated = await service.get_tool(entry_id)

    assert updated.position_id is None
    position = await session.get(Position, tool["position"].id)
    await session.refresh(position)
    assert position.tool_id is None, "Der Platz muss wieder frei sein"


async def test_favorite_survives_a_normal_edit(session, tool):
    """Die Favoriten-Markierung gehört nicht zur Nutzlast des Formulars."""
    service = ToolService(session)
    entry_id = tool["entry"].id
    await service.set_favorite(entry_id, True)

    await service.update_tool(entry_id, full_payload(tool, description="Neu beschrieben"))

    assert (await service.get_tool(entry_id)).is_favorite is True
