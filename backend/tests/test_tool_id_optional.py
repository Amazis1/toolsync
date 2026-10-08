"""Tests zu den Pflichtfeldern je Kategorie (DEC-055).

Ausgangslage (gemeldeter Fall): Im Anlegeformular war die Werkzeug-ID für alle
Kategorien Pflicht. Für Abstreifer und Matrize ist das falsch – sie werden über
ihr Maß geführt und haben oft gar keine ID. Umgekehrt darf die ID eines Stempels
nicht leer bleiben: sie kommt aus SAP und ist eingraviert.

Geprüft wird:
- Stempel ohne ID → Fehler beim Anlegen UND beim Bearbeiten
- Abstreifer und Matrize ohne ID → werden angelegt (tool_id ist None, nicht "")
- mehrere Datensätze ohne ID sind keine Dubletten zueinander
- ein leeres Eingabefeld wird zu None normalisiert (nie Leerstring)
- die Live-Prüfung ohne ID blockiert nicht und schlägt nichts zu übernehmen vor

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_tool_id_optional.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, ToolType
from app.models.tool import Tool
from app.models.movement import ToolMovement  # noqa: F401  (Model registrieren)
from app.models.enums import ToolCategory
from app.schemas.tool import ToolCreate, ToolUpdate
from app.schemas.storage import ToolLiteRead
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
    """Werk mit einem Werkzeugtyp – mehr braucht das Anlegen ohne ID nicht."""
    plant = Plant(name="Werk 1")
    tool_type = ToolType(name="01 Rund")
    session.add_all([plant, tool_type])
    await session.commit()
    return {"plant": plant, "tool_type": tool_type}


def new_tool(
    workspace,
    category: ToolCategory,
    tool_id=None,
    measure_a="12,00",
    description=None,
):
    """Nutzlast wie aus dem Formular, ohne Lagerplatz (Ablage)."""
    return ToolCreate(
        tool_id=tool_id,
        category=category,
        measure_a=measure_a,
        description=description,
        plant_id=workspace["plant"].id,
        tool_type_id=workspace["tool_type"].id,
        position_id=None,
    )


async def test_stempel_without_id_is_rejected(session, workspace):
    """Ein Stempel ohne ID ist nicht auffindbar – das Anlegen wird abgelehnt."""
    with pytest.raises(ValueError) as error:
        await ToolService(session).create_tool(
            new_tool(workspace, ToolCategory.STEMPEL, tool_id=None)
        )

    assert "Werkzeug-ID" in str(error.value)
    assert "Stempel" in str(error.value)


async def test_abstreifer_and_matrize_without_id_are_created(session, workspace):
    """Abstreifer und Matrize dürfen ohne ID angelegt werden."""
    service = ToolService(session)

    for category in (ToolCategory.ABSTREIFER, ToolCategory.MATRIZE):
        created = await service.create_tool(new_tool(workspace, category, tool_id=None))
        assert created.tool_id is None, f"{category.value} ohne ID: NULL statt Leerstring"
        assert created.measure_a == "12,00", "Maß A wird gespeichert"

    stored = (await service.get_tools(limit=50))["items"]
    assert len(stored) == 2, "Beide Datensätze stehen in der Liste"
    assert {item.tool_id for item in stored} == {None}


async def test_rows_without_id_are_not_duplicates(session, workspace):
    """„Ohne ID" ist keine geteilte ID: zwei ID-lose Datensätze sind erlaubt."""
    service = ToolService(session)

    first = await service.create_tool(new_tool(workspace, ToolCategory.ABSTREIFER))
    second = await service.create_tool(
        new_tool(workspace, ToolCategory.ABSTREIFER, measure_a="14,50")
    )

    assert first.id != second.id
    assert (await service.get_tools(limit=50))["total"] == 2


async def test_blank_id_becomes_none(session, workspace):
    """Ein leeres Eingabefeld (auch nur Leerzeichen) bedeutet „ohne ID"."""
    payload = new_tool(workspace, ToolCategory.MATRIZE, tool_id="   ")
    assert payload.tool_id is None, "Leerstring muss zu NULL normalisiert werden"

    created = await ToolService(session).create_tool(payload)
    assert created.tool_id is None


async def test_stempel_id_cannot_be_cleared_on_update(session, workspace):
    """Die ID eines Stempels lässt sich nicht nachträglich leeren."""
    service = ToolService(session)
    stempel = await service.create_tool(
        new_tool(workspace, ToolCategory.STEMPEL, tool_id="01025000")
    )

    with pytest.raises(ValueError):
        await service.update_tool(
            stempel.id,
            ToolUpdate(
                tool_id=None,
                category=ToolCategory.STEMPEL,
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["tool_type"].id,
            ),
        )

    assert (await service.get_tool(stempel.id)).tool_id == "01025000"


async def test_update_without_id_field_keeps_stempel_id(session, workspace):
    """Ein Teil-Update ohne ID-Feld darf den Stempel nicht an der Regel scheitern lassen."""
    service = ToolService(session)
    stempel = await service.create_tool(
        new_tool(workspace, ToolCategory.STEMPEL, tool_id="01025000")
    )

    updated = await service.update_tool(
        stempel.id,
        ToolUpdate(
            category=ToolCategory.STEMPEL,
            plant_id=workspace["plant"].id,
            tool_type_id=workspace["tool_type"].id,
            measure_a="9,00",
        ),
    )

    assert updated.tool_id == "01025000", "ID bleibt stehen"
    assert updated.measure_a == "9,00"


async def test_tool_lite_accepts_tool_without_id(session, workspace):
    """Die Platz-Anzeige (ToolLiteRead) muss ein Werkzeug ohne ID tragen.

    `tool_id` war dort als Pflicht-String deklariert: ein ID-loser Datensatz
    hätte die Antwortprüfung gesprengt (HTTP 500) und die Lagerplatz-Seite samt
    Ablage leer gelassen.
    """
    tool = Tool(
        tool_id=None,
        category=ToolCategory.ABSTREIFER,
        measure_a="12,00",
        plant_id=workspace["plant"].id,
        tool_type_id=workspace["tool_type"].id,
    )
    session.add(tool)
    await session.flush()

    lite = ToolLiteRead.model_validate(tool, from_attributes=True)

    assert lite.id == tool.id
    assert lite.tool_id is None
    assert lite.status is None


async def test_search_finds_rows_without_id(session, workspace):
    """„ohne ID" steht in der Liste, also findet die Suche diese Datensätze.

    Ein ILIKE auf `tool_id` könnte NULL nie treffen – ohne den zusätzlichen
    `IS NULL`-Zweig wäre der sichtbare Wert nicht suchbar (docs/05-tools.md §6:
    „was man sieht, findet man auch").
    """
    service = ToolService(session)
    await service.create_tool(
        new_tool(workspace, ToolCategory.ABSTREIFER, description="Abstreifer 12")
    )
    await service.create_tool(
        new_tool(workspace, ToolCategory.MATRIZE, tool_id="01025000", description="Matrize")
    )

    result = await service.get_tools(q="ohne")

    assert result["total"] == 1
    assert result["items"][0].tool_id is None


async def test_check_without_id_blocks_nothing(session, workspace):
    """Die Live-Prüfung hat ohne ID nichts zu prüfen."""
    result = await ToolService(session).check_tool_id(
        None, ToolCategory.ABSTREIFER, workspace["plant"].id, is_storage=False
    )

    assert result["available"] is True
    assert result["existing_count"] == 0
    assert result["locations"] == []
    assert result["prefill"] is None
