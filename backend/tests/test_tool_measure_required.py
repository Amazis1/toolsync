"""Test zu „Maß A ist Pflicht" (DEC-055).

Ausgangslage (Audit-Befund): Das Anlegeformular verlangte Maß A für **alle**
drei Kategorien – `assert_tool_identity` prüfte aber nur die Werkzeug-ID. Ein
Werkzeug ohne Maß A war damit über das Formular unmöglich, über die API
problemlos. Für Abstreifer und Matrize ist das Maß das **einzige** Merkmal, über
das sie geführt werden: ohne Maß ist der Datensatz in der Liste nicht zu
identifizieren.

Geprüft wird:
- Anlegen ohne Maß A → Fehler (bei jeder Kategorie, auch beim Stempel)
- Maß A aus Leerzeichen → ebenfalls Fehler (kein „gepflegter" Leerwert)
- Maß A entzieht sich beim Bearbeiten nicht (Teil-Update ohne das Feld prüft
  gegen den bisherigen Wert; ein Update auf Leerstring wird abgelehnt)
- die Meldung steht in der Sprache der Oberfläche und nennt Maß A

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_tool_measure_required.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, ToolType
from app.models.tool import Tool  # noqa: F401  (Model registrieren)
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
    """Werk mit einem Werkzeugtyp – mehr braucht das Anlegen nicht."""
    plant = Plant(name="Werk 1")
    tool_type = ToolType(name="01 Rund")
    session.add_all([plant, tool_type])
    await session.commit()
    return {"plant": plant, "tool_type": tool_type}


def new_tool(workspace, category: ToolCategory, tool_id=None, measure_a=None):
    """Nutzlast wie aus dem Formular – Maß A absichtlich nicht vorbelegt."""
    return ToolCreate(
        tool_id=tool_id,
        category=category,
        measure_a=measure_a,
        plant_id=workspace["plant"].id,
        tool_type_id=workspace["tool_type"].id,
        position_id=None,
    )


@pytest.mark.parametrize(
    "category",
    [ToolCategory.STEMPEL, ToolCategory.ABSTREIFER, ToolCategory.MATRIZE],
)
async def test_create_without_measure_a_is_rejected(session, workspace, category):
    """Ohne Maß A wird nichts angelegt – unabhängig von der Kategorie.

    Beim Stempel kommt die ID mit, damit wirklich das Maß der Grund ist.
    """
    with pytest.raises(ValueError) as error:
        await ToolService(session).create_tool(
            new_tool(workspace, category, tool_id="TS-1", measure_a=None)
        )

    assert "Maß A" in str(error.value), "Die Meldung benennt das Feld"


async def test_measure_a_of_whitespace_is_rejected(session, workspace):
    """Ein Feld mit Leerzeichen ist kein gepflegtes Maß."""
    with pytest.raises(ValueError) as error:
        await ToolService(session).create_tool(
            new_tool(workspace, ToolCategory.ABSTREIFER, measure_a="   ")
        )

    assert "Maß A" in str(error.value)


async def test_create_with_measure_a_succeeds(session, workspace):
    """Mit Maß A entsteht der Datensatz – die Prüfung blockiert nichts Gültiges."""
    created = await ToolService(session).create_tool(
        new_tool(workspace, ToolCategory.ABSTREIFER, measure_a="7,00")
    )

    assert created.measure_a == "7,00"
    assert created.tool_id is None


def full_update(tool, workspace, **overrides):
    """Vollständige Nutzlast wie aus dem Formular.

    `ToolUpdate` verlangt Kategorie und Werk – ein Update ohne diese Felder
    scheitert schon an Pydantic und käme nie am Service an.
    """
    payload = {
        "tool_id": tool.tool_id,
        "category": tool.category,
        "plant_id": tool.plant_id,
        "tool_type_id": tool.tool_type_id,
        "measure_a": tool.measure_a,
    }
    payload.update(overrides)
    return payload


async def test_partial_update_without_measure_field_keeps_the_rule(session, workspace):
    """Ein Update ohne `measure_a` im Rumpf prüft gegen den bisherigen Wert.

    Sonst käme ein Update an der Pflicht vorbei, weil das Feld fehlt. Über den
    Schema-Weg entsteht ein solcher Rumpf, sobald ein Aufrufer das Feld weg lässt.
    """
    service = ToolService(session)
    created = await service.create_tool(
        new_tool(workspace, ToolCategory.ABSTREIFER, measure_a="7,00")
    )

    payload = full_update(created, workspace)
    del payload["measure_a"]  # Feld nicht mitgeschickt
    updated = await service.update_tool(created.id, ToolUpdate(**payload))

    assert updated.measure_a == "7,00", "Der bestehende Wert bleibt die Grundlage"
    assert updated.category == ToolCategory.ABSTREIFER


async def test_measure_a_cannot_be_cleared_by_update(session, workspace):
    """Maß A lässt sich nicht auf leer setzen – der Datensatz bliebe unauffindbar."""
    service = ToolService(session)
    created = await service.create_tool(
        new_tool(workspace, ToolCategory.MATRIZE, measure_a="12,00")
    )

    with pytest.raises(ValueError) as error:
        await service.update_tool(
            created.id, ToolUpdate(**full_update(created, workspace, measure_a=""))
        )

    assert "Maß A" in str(error.value)
