"""Tests für die Werkzeugliste: Suche, Filter, Sortierung und Pagination.

Geprüft wird der Service (ToolService.get_tools), also genau die Schicht, die
die Oberfläche aufruft. Schwerpunkte:

- Suche über Werkzeug-ID, Bezeichnung, Werkzeugtyp und Werk
- Mehrfachfilter (Kategorie, Status) und Zustandsfilter (Lager/Ersatz, Ablage)
- Sortierung inkl. numerischer Sortierung von Maß A und NULLS LAST
- Pagination: Seitengröße, `total` und stabile Reihenfolge über Seitengrenzen
- Lagerplatz-Code ("01-A-25" bzw. None für Ablage)
- globaler Favorit samt Filter

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_tools_list.py -q
"""

import io
import shutil
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from starlette.datastructures import Headers, UploadFile

from app.models.base import Base
from app.models.data_sheet import DataSheet  # noqa: F401  (Modell registrieren)
from app.models.master_data import Plant, ToolType
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.models.movement import ToolMovement  # noqa: F401  (Model registrieren)
from app.models.enums import ToolCategory, ToolStatus
from app.schemas.data_sheet import DataSheetCreate
from app.services.data_sheet_service import DataSheetService
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
    """Zwei Werke, zwei Typen, ein Lagerplatz (01-A-25) und drei Werkzeuge."""
    plant = Plant(name="Werk 1")
    other_plant = Plant(name="Werk 2")
    round_type = ToolType(name="01 Rund")
    square_type = ToolType(name="02 Quadrat")
    session.add_all([plant, other_plant, round_type, square_type])
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

    on_place = Tool(
        tool_id="01025000",
        category=ToolCategory.STEMPEL,
        status=ToolStatus.AVAILABLE,
        measure_a="7,00",
        description="Rund 2.5 ALU",
        plant_id=plant.id,
        tool_type_id=round_type.id,
        position_id=position.id,
    )
    in_tray = Tool(
        tool_id="01060000",
        category=ToolCategory.STEMPEL,
        status=ToolStatus.LENT,
        measure_a="10,00",
        description="Rund 6,0",
        plant_id=plant.id,
        tool_type_id=round_type.id,
        position_id=None,
    )
    storage_spare = Tool(
        tool_id="01025000",
        category=ToolCategory.STEMPEL,
        status=None,
        is_storage=True,
        allow_duplicate_id=True,
        measure_a="8,50",
        description=None,
        plant_id=plant.id,
        tool_type_id=square_type.id,
        position_id=None,
    )
    session.add_all([on_place, in_tray, storage_spare])
    await session.commit()

    position.tool_id = on_place.id
    await session.commit()

    return {
        "plant": plant,
        "other_plant": other_plant,
        "round_type": round_type,
        "square_type": square_type,
        "position": position,
        "on_place": on_place,
        "in_tray": in_tray,
        "storage_spare": storage_spare,
    }


async def test_search_covers_id_description_type_and_plant(session, workspace):
    """Das Suchfeld findet Werkzeug-ID, Bezeichnung, Werkzeugtyp und Werk."""
    service = ToolService(session)

    by_id = await service.get_tools(q="01060000")
    assert [t.tool_id for t in by_id["items"]] == ["01060000"]

    by_description = await service.get_tools(q="2.5 ALU")
    assert [t.tool_id for t in by_description["items"]] == ["01025000"]

    by_type = await service.get_tools(q="Quadrat")
    assert [t.tool_id for t in by_type["items"]] == ["01025000"]

    by_plant = await service.get_tools(q="Werk 2")
    assert by_plant["items"] == []
    assert by_plant["total"] == 0


async def test_search_is_case_insensitive_and_partial(session, workspace):
    """Suche ist unabhängig von Groß-/Kleinschreibung und findet Teiltreffer."""
    result = await ToolService(session).get_tools(q="rund 6")
    assert [t.tool_id for t in result["items"]] == ["01060000"]


async def test_status_and_category_filters_accept_multiple_values(session, workspace):
    """Status und Kategorie sind mehrfach wählbar (OR innerhalb eines Filters)."""
    service = ToolService(session)

    both = await service.get_tools(statuses=[ToolStatus.AVAILABLE, ToolStatus.LENT])
    assert both["total"] == 2

    single = await service.get_tools(statuses=[ToolStatus.LENT])
    assert [t.tool_id for t in single["items"]] == ["01060000"]

    categories = await service.get_tools(categories=[ToolCategory.MATRIZE])
    assert categories["total"] == 0


async def test_filters_combine_as_and(session, workspace):
    """Verschiedene Filter wirken zusammen als UND."""
    result = await ToolService(session).get_tools(
        categories=[ToolCategory.STEMPEL],
        statuses=[ToolStatus.AVAILABLE],
        plant_id=workspace["plant"].id,
        tool_type_id=workspace["round_type"].id,
    )
    assert [t.tool_id for t in result["items"]] == ["01025000"]

    # Typ passt nicht zum Status -> leere Seite, aber korrekte Gesamtzahl
    mismatch = await ToolService(session).get_tools(
        statuses=[ToolStatus.LENT], tool_type_id=workspace["square_type"].id
    )
    assert mismatch["items"] == []
    assert mismatch["total"] == 0


async def test_storage_and_place_filters(session, workspace):
    """Lager/Ersatz und „nur Ablage" sind getrennt filterbar."""
    service = ToolService(session)

    storage = await service.get_tools(is_storage=True)
    assert [t.tool_id for t in storage["items"]] == ["01025000"]

    # Nur Ablage: in_tray (ohne Platz) + Ersatz-Exemplar (ohne Platz)
    tray_only = await service.get_tools(has_place=False)
    assert tray_only["total"] == 2

    with_place = await service.get_tools(has_place=True)
    assert [t.tool_id for t in with_place["items"]] == ["01025000"]
    assert with_place["items"][0].position_code == "01-A-25"


async def test_position_code_is_composed_and_none_for_tray(session, workspace):
    """Der Lagerplatz-Code wird aus Schrank/Schublade/Platz gebildet."""
    result = await ToolService(session).get_tools(sort="tool_id", order="asc")
    codes = {t.id: t.position_code for t in result["items"]}
    assert codes[workspace["on_place"].id] == "01-A-25"
    assert codes[workspace["in_tray"].id] is None
    assert codes[workspace["storage_spare"].id] is None


async def test_measure_sort_is_numeric_not_alphabetical(session, workspace):
    """Maß A wird numerisch sortiert: 7,00 vor 10,00 (nicht '10' vor '7')."""
    ascending = await ToolService(session).get_tools(sort="measure_a", order="asc")
    measures = [t.measure_a for t in ascending["items"]]
    assert measures == ["7,00", "8,50", "10,00"]

    descending = await ToolService(session).get_tools(sort="measure_a", order="desc")
    assert [t.measure_a for t in descending["items"]] == ["10,00", "8,50", "7,00"]


async def test_empty_values_sort_last_in_both_directions(session, workspace):
    """Leere Bezeichnungen stehen am Ende — aufsteigend wie absteigend."""
    service = ToolService(session)

    ascending = await service.get_tools(sort="description", order="asc")
    assert ascending["items"][-1].description is None

    descending = await service.get_tools(sort="description", order="desc")
    assert descending["items"][-1].description is None
    assert descending["items"][0].description == "Rund 6,0"


async def test_status_sort_uses_fachliche_order(session, workspace):
    """Status wird fachlich sortiert, nicht alphabetisch nach Speicherwert.

    Verfügbar → Ausgeliehen → In Transit → In Wartung → Defekt → ohne Status.
    """
    session.add_all(
        [
            Tool(
                tool_id="70000001",
                category=ToolCategory.STEMPEL,
                status=ToolStatus.MAINTENANCE,
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["round_type"].id,
            ),
            Tool(
                tool_id="70000002",
                category=ToolCategory.STEMPEL,
                status=ToolStatus.DEFECTIVE,
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["round_type"].id,
            ),
            Tool(
                tool_id="70000003",
                category=ToolCategory.STEMPEL,
                status=ToolStatus.IN_TRANSIT,
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["round_type"].id,
            ),
        ]
    )
    await session.commit()

    result = await ToolService(session).get_tools(sort="status", order="asc")
    order = [tool.status for tool in result["items"]]

    assert order == [
        ToolStatus.AVAILABLE,  # aus dem Fixture
        ToolStatus.LENT,  # aus dem Fixture
        ToolStatus.IN_TRANSIT,
        ToolStatus.MAINTENANCE,
        ToolStatus.DEFECTIVE,
        None,  # Lager/Ersatz ohne Status steht am Ende
    ]

    reversed_order = await ToolService(session).get_tools(sort="status", order="desc")
    assert reversed_order["items"][0].status is None


async def test_pagination_reports_total_and_slices(session, workspace):
    """Seitengröße und Versatz schneiden die Liste, `total` bleibt die Gesamtzahl."""
    for index in range(30):
        session.add(
            Tool(
                tool_id=f"90{index:06d}",
                category=ToolCategory.STEMPEL,
                status=ToolStatus.AVAILABLE,
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["round_type"].id,
            )
        )
    await session.commit()

    service = ToolService(session)
    first = await service.get_tools(limit=25, skip=0)
    assert len(first["items"]) == 25
    assert first["total"] == 33

    second = await service.get_tools(limit=25, skip=25)
    assert len(second["items"]) == 8
    assert second["total"] == 33


async def test_order_is_stable_across_page_borders(session, workspace):
    """Gleiche Sortierwerte erzeugen keine Dubletten und keine Lücken.

    Ohne Tiebreaker auf `id` kann dieselbe Zeile auf zwei Seiten erscheinen
    oder zwischen zwei Seiten verloren gehen.
    """
    for index in range(12):
        session.add(
            Tool(
                tool_id=f"80{index:06d}",
                category=ToolCategory.STEMPEL,
                status=ToolStatus.AVAILABLE,  # identischer Sortierwert
                plant_id=workspace["plant"].id,
                tool_type_id=workspace["round_type"].id,
            )
        )
    await session.commit()

    service = ToolService(session)
    collected = []
    for page in range(3):
        result = await service.get_tools(
            statuses=[ToolStatus.AVAILABLE], sort="status", order="asc",
            limit=5, skip=page * 5,
        )
        collected.extend(t.id for t in result["items"])

    # 12 neue Datensätze plus das verfügbare Werkzeug aus dem Fixture.
    assert len(collected) == 13
    assert len(set(collected)) == 13, "Keine Zeile darf doppelt erscheinen"


async def test_favorites_are_global_and_filterable(session, workspace):
    """Favoriten sind global: setzen, filtern, wieder entfernen."""
    service = ToolService(session)
    tool = workspace["on_place"]

    assert (await service.get_tools(favorites_only=True))["total"] == 0

    await service.set_favorite(tool.id, True)
    favorites = await service.get_tools(favorites_only=True)
    assert [t.id for t in favorites["items"]] == [tool.id]
    assert favorites["items"][0].is_favorite is True

    # Der Favorit ist unabhängig von Filtern derselbe Datensatz. Achtung:
    # "01025000" existiert zweimal (Werkzeug auf Platz + Ersatz in der Ablage),
    # deshalb wird über die Datensatz-ID verglichen.
    all_tools = await service.get_tools()
    marked = {t.id: t.is_favorite for t in all_tools["items"]}
    assert marked[tool.id] is True
    assert marked[workspace["in_tray"].id] is False

    await service.set_favorite(tool.id, False)
    assert (await service.get_tools(favorites_only=True))["total"] == 0


async def test_favorite_of_unknown_tool_returns_none(session, workspace):
    """Ein unbekanntes Werkzeug liefert None -> der Router antwortet 404."""
    assert await ToolService(session).set_favorite(999999, True) is None


# --------------------------------------------------------------------------
# Datenblatt-Symbol je Zeile (DEC-068)
# --------------------------------------------------------------------------


@pytest.fixture
def datenblatt_ablage(monkeypatch):
    """Temporäre Ablage für Datenblätter – im Projektordner, nicht im System-Temp.

    Der `ToolService` baut seinen `DataSheetService` selbst und nimmt dessen
    Standardwurzel. Beide müssen dieselbe Ablage sehen, deshalb wird sie über
    `TOOLSYNC_UPLOAD_DIR` gesetzt (wie in `test_data_sheets.py` über den
    `root`-Parameter).
    """
    base = Path(__file__).resolve().parent / "_uploads_tmp" / uuid.uuid4().hex
    base.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("TOOLSYNC_UPLOAD_DIR", str(base))
    try:
        yield base
    finally:
        shutil.rmtree(base.parent, ignore_errors=True)


def _pdf_upload(name: str = "plan.pdf"):
    return UploadFile(
        file=io.BytesIO(b"%PDF-1.4 Testinhalt"),
        filename=name,
        headers=Headers({"content-type": "application/pdf"}),
    )


async def _datenblatt(session, workspace, tool_id: str, mit_datei: bool):
    """Datenblatt anlegen – mit oder ohne hinterlegte Datei."""
    service = DataSheetService(session)
    return await service.create(
        DataSheetCreate(
            tool_id=tool_id,
            plant_id=workspace["plant"].id,
            name=f"Blatt {tool_id}",
        ),
        pdf_files=_pdf_upload() if mit_datei else None,
    )


async def test_has_data_sheet_nur_mit_datei(session, workspace, datenblatt_ablage):
    """Das Symbol steht nur, wenn zu der ID ein Datenblatt **mit Datei** gehört.

    Drei Fälle in einer Liste: mit Datei (Symbol), Datensatz ohne Datei (kein
    Symbol – das Symbol führte sonst ins Leere) und ohne jeden Datensatz.
    """
    await _datenblatt(session, workspace, "01025000", mit_datei=True)
    await _datenblatt(session, workspace, "01060000", mit_datei=False)

    items = (await ToolService(session).get_tools(limit=50))["items"]
    flag = {t.tool_id: t.has_data_sheet for t in items if not t.is_storage}

    assert flag["01025000"] is True
    assert flag["01060000"] is False


async def test_has_data_sheet_ist_exakt_und_nicht_unscharf(
    session, workspace, datenblatt_ablage
):
    """„188" ist nicht „1880" – verglichen wird die ganze ID.

    Dieselbe Überlegung wie beim Filter der Zeilenaktion (DEC-065 Punkt 10): eine
    unscharfe Zuordnung ließe die Werkzeugliste ein Symbol für ein fremdes
    Datenblatt zeigen.
    """
    await _datenblatt(session, workspace, "1880", mit_datei=True)
    session.add(
        Tool(
            tool_id="188",
            category=ToolCategory.STEMPEL,
            status=ToolStatus.AVAILABLE,
            measure_a="7,00",
            plant_id=workspace["plant"].id,
            tool_type_id=workspace["round_type"].id,
        )
    )
    await session.commit()

    items = (await ToolService(session).get_tools(limit=50))["items"]
    flag = {t.tool_id: t.has_data_sheet for t in items}
    assert flag["188"] is False


async def test_has_data_sheet_auch_beim_einzelnen_werkzeug(
    session, workspace, datenblatt_ablage
):
    """Einzelsatz und Favoriten-Endpunkt tragen dasselbe Feld wie die Liste."""
    tool = workspace["on_place"]
    await _datenblatt(session, workspace, "01025000", mit_datei=True)

    einzeln = await ToolService(session).get_tool_read(tool.id)
    assert einzeln is not None
    assert einzeln.has_data_sheet is True


async def test_has_data_sheet_falsch_ohne_werkzeug_id(session, workspace):
    """Ohne Werkzeug-ID gibt es kein Datenblatt (DEC-055) – kein Symbol."""
    ohne_id = Tool(
        tool_id=None,
        category=ToolCategory.ABSTREIFER,
        status=ToolStatus.AVAILABLE,
        measure_a="7,00",
        plant_id=workspace["plant"].id,
        tool_type_id=workspace["round_type"].id,
    )
    session.add(ohne_id)
    await session.commit()

    einzeln = await ToolService(session).get_tool_read(ohne_id.id)
    assert einzeln is not None
    assert einzeln.has_data_sheet is False
