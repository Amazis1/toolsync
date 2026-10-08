"""Tests für den Matrix-Lagerplatz von Ersatzteilen (Nachtrag zu DEC-064).

Kern der Regel: Ein Platz ist **belegt**, wenn `positions.tool_id` gesetzt ist
**oder** ein Ersatzteil darauf zeigt. Damit gilt Anforderung 7.2 („ein Platz darf
nicht mehrfach belegt sein") auch für Ersatzteile.

Geprüft wird:

- Ersatzteil kann einen freien Platz belegen; der Platz-Code wird geliefert
- ein mit Ersatzteil belegter Platz nimmt **kein** Werkzeug auf (Service)
- Verschieben auf einen Ersatzteil-Platz wird abgelehnt
- ein zweites Ersatzteil auf denselben Platz wird abgelehnt
- ein Platz aus einem **anderen Werk** wird abgelehnt
- Einreihen in eine Schublade mit Ersatzteil wird abgelehnt (die Schublade wird
  beim Einreihen komplett neu belegt)
- nach dem Löschen des Ersatzteils ist der Platz wieder frei

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_spare_part_position.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.enums import ToolCategory
from app.models.master_data import Plant, ToolType
from app.models.spare_part import SparePart  # noqa: F401  (Mapper registrieren)
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.schemas.spare_part import SparePartCreate, SparePartUpdate
from app.schemas.tool import ToolCreate
from app.services.location_service import LocationService
from app.services.spare_part_service import SparePartService
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
async def workspace(session):
    """Zwei Werke, ein Schrank mit zwei Schubladen (je drei Plätze), ein Typ."""
    plant = Plant(name="Werk 1")
    other_plant = Plant(name="Werk 2")
    tool_type = ToolType(name="01 Rund")
    session.add_all([plant, other_plant, tool_type])
    await session.flush()

    cabinet = Cabinet(name="01", plant_id=plant.id)
    session.add(cabinet)
    await session.flush()

    drawer_a = Drawer(name="A", cols=3, rows=1, cabinet_id=cabinet.id)
    drawer_b = Drawer(name="B", cols=3, rows=1, cabinet_id=cabinet.id)
    session.add_all([drawer_a, drawer_b])
    await session.flush()

    positions: dict[str, Position] = {}
    for drawer, prefix in ((drawer_a, "A"), (drawer_b, "B")):
        for index in (1, 2, 3):
            position = Position(
                name=f"{index:02d}", x=index, y=1, drawer_id=drawer.id
            )
            session.add(position)
            positions[f"{prefix}{index}"] = position
    await session.flush()

    return {
        "plant": plant,
        "other_plant": other_plant,
        "tool_type": tool_type,
        "drawer_a": drawer_a,
        "drawer_b": drawer_b,
        "positions": positions,
    }


def part_data(workspace, **overrides) -> SparePartCreate:
    felder = {
        "article_number": "4711",
        "name": "Dichtung Ø40",
        "plant_id": workspace["plant"].id,
        "quantity": 5,
        "unit": "Stk",
    }
    felder.update(overrides)
    return SparePartCreate(**felder)


def tool_data(workspace, **overrides) -> ToolCreate:
    # `measure_a` gehört dazu: es ist für alle Kategorien Pflicht
    # (siehe tests/test_tool_measure_required.py).
    felder = {
        "tool_id": "01025000",
        "category": ToolCategory.STEMPEL,
        "measure_a": "7,00",
        "plant_id": workspace["plant"].id,
        "tool_type_id": workspace["tool_type"].id,
    }
    felder.update(overrides)
    return ToolCreate(**felder)


# --------------------------------------------------------------------------
# Platz belegen
# --------------------------------------------------------------------------


async def test_spare_part_takes_a_free_position(session, workspace):
    """Ein freies Platz-Feld wird belegt und der Code („01-A-01") geliefert."""
    service = SparePartService(session)
    platz = workspace["positions"]["A1"]

    part = await service.create(part_data(workspace, position_id=platz.id))

    assert part.position_id == platz.id
    codes = await service.position_codes({platz.id})
    assert codes[platz.id] == "01-A-01"
    # Der Platz bleibt für Werkzeuge „leer" (tool_id ist None) – belegt ist er
    # über die Beziehung zum Ersatzteil.
    await session.refresh(platz)
    assert platz.tool_id is None
    assert platz.spare_part is not None
    assert platz.spare_part.id == part.id


async def test_free_text_place_stays_independent(session, workspace):
    """Freitext-Lagerort und Matrix-Platz sind unabhängig — beides ist erlaubt."""
    service = SparePartService(session)
    platz = workspace["positions"]["A1"]

    part = await service.create(
        part_data(workspace, storage_place="Regal B3 / Fach 2", position_id=platz.id)
    )

    assert part.storage_place == "Regal B3 / Fach 2"
    assert part.position_id == platz.id


# --------------------------------------------------------------------------
# Belegung blockiert Werkzeuge
# --------------------------------------------------------------------------


async def test_tool_cannot_take_position_with_spare_part(session, workspace):
    """Ein Platz mit Ersatzteil nimmt kein Werkzeug auf."""
    platz = workspace["positions"]["A1"]
    await SparePartService(session).create(part_data(workspace, position_id=platz.id))

    with pytest.raises(ValueError) as fehler:
        await ToolService(session).create_tool(tool_data(workspace, position_id=platz.id))

    assert "Ersatzteil" in str(fehler.value)
    assert "4711" in str(fehler.value)


async def test_move_to_position_with_spare_part_is_rejected(session, workspace):
    """Verschieben auf einen Ersatzteil-Platz wird abgelehnt."""
    platz = workspace["positions"]["A1"]
    ziel_frei = workspace["positions"]["A2"]
    await SparePartService(session).create(part_data(workspace, position_id=platz.id))

    # Ein Werkzeug auf einen anderen, freien Platz legen – von dort verschieben.
    tool = await ToolService(session).create_tool(
        tool_data(workspace, tool_id="01026000", position_id=ziel_frei.id)
    )

    with pytest.raises(ValueError) as fehler:
        await LocationService(session).move_position(ziel_frei.id, platz.id, None)

    assert "Ersatzteil" in str(fehler.value)
    # Nichts verschoben.
    await session.refresh(ziel_frei)
    assert ziel_frei.tool_id == tool.id


async def test_insert_at_is_rejected_when_drawer_has_spare_part(session, workspace):
    """Einreihen in eine Schublade mit Ersatzteil wird abgelehnt.

    Beim Einreihen wird die ganze Ziel-Schublade neu belegt (jeder Platz bekommt
    eine Werkzeug-ID) – das Ersatzteil würde überschrieben.
    """
    quelle = workspace["positions"]["A1"]
    ziel = workspace["positions"]["B1"]

    # Quelle: Werkzeug in Schublade A. Ziel: Werkzeug in Schublade B.
    werkzeug = await ToolService(session).create_tool(
        tool_data(workspace, tool_id="01027000", position_id=quelle.id)
    )
    await ToolService(session).create_tool(
        tool_data(workspace, tool_id="01028000", position_id=ziel.id)
    )
    # Ersatzteil in derselben Schublade wie das Ziel.
    ersatzteil_platz = workspace["positions"]["B3"]
    await SparePartService(session).create(
        part_data(workspace, position_id=ersatzteil_platz.id)
    )

    with pytest.raises(ValueError) as fehler:
        await LocationService(session).insert_at_position(quelle.id, ziel.id, None)

    assert "Ersatzteil" in str(fehler.value)
    # Quelle unverändert.
    await session.refresh(quelle)
    assert quelle.tool_id == werkzeug.id


# --------------------------------------------------------------------------
# Der Platz selbst
# --------------------------------------------------------------------------


async def test_second_spare_part_on_same_position_is_rejected(session, workspace):
    """Ein Platz hält nur **ein** Ersatzteil."""
    service = SparePartService(session)
    platz = workspace["positions"]["A1"]
    await service.create(part_data(workspace, position_id=platz.id))

    with pytest.raises(ValueError) as fehler:
        await service.create(
            part_data(workspace, article_number="4712", position_id=platz.id)
        )

    assert "bereits mit einem Ersatzteil belegt" in str(fehler.value)


async def test_position_of_another_plant_is_rejected(session, workspace):
    """Ein Platz aus einem anderen Werk ist nicht zulässig."""
    service = SparePartService(session)
    platz = workspace["positions"]["A1"]

    with pytest.raises(ValueError) as fehler:
        await service.create(
            part_data(workspace, plant_id=workspace["other_plant"].id, position_id=platz.id)
        )

    assert "anderen Werk" in str(fehler.value)


async def test_unknown_position_is_rejected(session, workspace):
    """Ein Platz, den es nicht (mehr) gibt, ergibt eine klare Meldung."""
    service = SparePartService(session)

    with pytest.raises(ValueError) as fehler:
        await service.create(part_data(workspace, position_id=999_999))

    assert "gibt es nicht mehr" in str(fehler.value)


async def test_editing_own_part_keeps_its_position(session, workspace):
    """Beim Bearbeiten zählt der eigene Datensatz nicht als Belegung."""
    service = SparePartService(session)
    platz = workspace["positions"]["A1"]
    part = await service.create(part_data(workspace, position_id=platz.id))

    aktualisiert = await service.update(
        part.id,
        SparePartUpdate(
            article_number="4711",
            name="Dichtung Ø40 (neu)",
            plant_id=workspace["plant"].id,
            quantity=9,
            unit="Stk",
            position_id=platz.id,
        ),
    )

    assert aktualisiert is not None
    assert aktualisiert.position_id == platz.id
    assert aktualisiert.name == "Dichtung Ø40 (neu)"


async def test_deleting_spare_part_frees_the_position(session, workspace):
    """Nach dem Löschen ist der Platz wieder frei – ein Werkzeug passt darauf."""
    service = SparePartService(session)
    platz = workspace["positions"]["A1"]
    part = await service.create(part_data(workspace, position_id=platz.id))

    assert await service.delete(part.id) is True

    tool = await ToolService(session).create_tool(
        tool_data(workspace, position_id=platz.id)
    )
    await session.refresh(platz)
    assert platz.tool_id == tool.id
    assert platz.spare_part is None
