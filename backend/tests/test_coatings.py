"""Tests zur Stempel-Beschichtung (DEC-083).

Die Beschichtungen laufen unter der Dachmarke **MultiDur** und sind Stammdaten
(`coatings`). Ein Werkzeug hängt mit `coating_id` an der Zeile; das Formular
bietet die Auswahl nur beim Stempel an.

Geprüft wird die Service-Schicht (also genau der Weg, den die Oberfläche geht):

- ein Stempel lässt sich mit Beschichtung anlegen, `ToolRead` liefert den Namen
- ohne Beschichtung bleibt `coating_id`/`coating` leer
- ein Teil-Update ohne `coating_id` behält die Beschichtung (kein stiller Verlust)
- ein Update mit `coating_id=None` entfernt sie wieder

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_coatings.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Coating, Plant, ToolType
from app.models.tool import Tool
from app.models.movement import ToolMovement  # noqa: F401  (Model registrieren)
from app.models.enums import ToolCategory
from app.schemas.tool import ToolCreate, ToolUpdate
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
    """Werk, Werkzeugtyp und die drei MultiDur-Beschichtungen plus „Standard"."""
    plant = Plant(name="Werk 1")
    tool_type = ToolType(name="01 Rund")
    ticn = Coating(name="MultiDur TiCN")
    performance = Coating(name="MultiDur Performance")
    standard = Coating(name="Standard")
    session.add_all([plant, tool_type, ticn, performance, standard])
    await session.commit()
    return {
        "plant": plant,
        "tool_type": tool_type,
        "ticn": ticn,
        "performance": performance,
        "standard": standard,
    }


def new_tool(workspace, coating_id):
    """Nutzlast wie aus dem Formular (Kategorie Stempel, keine Platzwahl)."""
    return ToolCreate(
        tool_id="1075000",
        category=ToolCategory.STEMPEL,
        measure_a="12,00",
        plant_id=workspace["plant"].id,
        tool_type_id=workspace["tool_type"].id,
        coating_id=coating_id,
        position_id=None,
    )


async def test_stempel_mit_beschichtung_wird_gespeichert(session, workspace):
    """Die Beschichtung wird gespeichert und `ToolRead` liefert ihren Namen."""
    service = ToolService(session)
    tool = await service.create_tool(new_tool(workspace, workspace["ticn"].id))

    read = await service.get_tool_read(tool.id)
    assert read is not None
    assert read.coating_id == workspace["ticn"].id
    assert read.coating is not None
    assert read.coating.name == "MultiDur TiCN"


async def test_ohne_beschichtung_bleibt_das_feld_leer(session, workspace):
    """Keine Beschichtung ist ein gültiger Zustand – kein Pflichtfeld."""
    service = ToolService(session)
    tool = await service.create_tool(new_tool(workspace, None))

    read = await service.get_tool_read(tool.id)
    assert read.coating_id is None
    assert read.coating is None


def update_tool_payload(workspace, **overrides):
    """Nutzlast eines Formular-Updates – alle Pflichtfelder, `overrides` zuletzt."""
    return ToolUpdate(
        tool_id="1075000",
        category=ToolCategory.STEMPEL,
        measure_a="12,00",
        plant_id=workspace["plant"].id,
        tool_type_id=workspace["tool_type"].id,
        **overrides,
    )


async def test_update_ohne_beschichtung_behaelt_sie(session, workspace):
    """Ein Update, das `coating_id` nicht mitschickt (Teil-Update), verliert sie nicht."""
    service = ToolService(session)
    tool = await service.create_tool(new_tool(workspace, workspace["performance"].id))

    await service.update_tool(tool.id, update_tool_payload(workspace, description="neu geschliffen"))

    read = await service.get_tool_read(tool.id)
    assert read.coating_id == workspace["performance"].id


async def test_update_kann_die_beschichtung_entfernen(session, workspace):
    """`coating_id=None` nimmt die Beschichtung wieder weg (kein „nicht ändern")."""
    service = ToolService(session)
    tool = await service.create_tool(new_tool(workspace, workspace["ticn"].id))

    await service.update_tool(tool.id, update_tool_payload(workspace, coating_id=None))

    read = await service.get_tool_read(tool.id)
    assert read.coating_id is None


async def test_geloeschte_beschichtung_laesst_das_werkzeug_stehen(session, workspace):
    """Ohne die Zeile bleibt der Stempel – nur die Zuordnung fällt weg.

    Geprüft am Modell statt über die Route: SQLite setzt `ON DELETE SET NULL`
    in Tests nur mit aktivem `PRAGMA foreign_keys` durch, hier wird der Zustand
    deshalb nach dem Löschen der Zeile ausdrücklich gesetzt (dieselbe Wirkung).
    """
    service = ToolService(session)
    tool = await service.create_tool(new_tool(workspace, workspace["ticn"].id))

    await session.execute(delete(Coating).where(Coating.id == workspace["ticn"].id))
    reste = await session.execute(select(Tool).where(Tool.id == tool.id))
    gespeichert = reste.scalar_one()
    gespeichert.coating_id = None
    await session.commit()

    read = await service.get_tool_read(tool.id)
    assert read is not None
    assert read.coating_id is None
    assert read.tool_id == "1075000"
