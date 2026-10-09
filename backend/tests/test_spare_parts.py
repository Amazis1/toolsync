"""Tests für Ersatzteile (DEC-064): Suche, Filter, Sortierung, Pagination, Regeln.

Geprüft wird der Service (`SparePartService`), also genau die Schicht, die die
Oberfläche aufruft. Schwerpunkte:

- Suche über Artikelnummer, Name, Typ, Lagerort, Beschreibung, Werk, Maschine
- Werk- und Maschinenfilter, Typfilter
- Sortierung mit NULLS LAST und stabiler Tiebreaker (dieselbe Artikelnummer
  kommt mehrfach vor – das ist bei Ersatzteilen der Normalfall)
- Mengenbestand: Default 1, 0 erlaubt, negativ abgelehnt
- Pflichtangaben: Artikelnummer und Werk; gelöschtes Werk/gelöschte Maschine
- Dubletten sind **erlaubt** (anders als beim Serienartikel)
- Änderung: None-Werte kommen an („Maschine entfernen", „Lagerort leeren")

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_spare_parts.py -q
"""

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Machine, Plant
from app.models.spare_part import SparePart
from app.schemas.spare_part import SparePartCreate, SparePartUpdate
from app.services.spare_part_service import SparePartService

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
    """Zwei Werke, zwei Maschinen und vier Ersatzteile.

    - `4711` gibt es **zweimal** (zwei Lagerorte) – der Normalfall.
    - `8020` hat keine Maschine und keinen Lagerort (NULLS-LAST-Prüfung).
    - `1000` liegt in Werk 2 (Werk-Filter).
    """
    plant = Plant(name="Werk 1")
    other_plant = Plant(name="Werk 2")
    session.add_all([plant, other_plant])
    await session.flush()

    press = Machine(name="Presse 4", plant_id=plant.id)
    mill = Machine(name="Fräse 2", plant_id=plant.id)
    session.add_all([press, mill])
    await session.flush()

    parts = [
        SparePart(
            article_number="4711",
            name="Dichtung Ø40",
            type="Dichtung",
            plant_id=plant.id,
            quantity=25,
            unit="Stk",
            machine_id=press.id,
            storage_place="Regal B3 / Fach 2",
            description="NBR, hitzebeständig",
        ),
        SparePart(
            article_number="4711",
            name="Dichtung Ø40",
            type="Dichtung",
            plant_id=plant.id,
            quantity=4,
            unit="Stk",
            machine_id=press.id,
            storage_place="Regal B4 / Fach 1",
        ),
        SparePart(
            article_number="8020",
            name="Näherungsschalter",
            type="Sensor",
            plant_id=plant.id,
            quantity=0,
            unit="Stk",
            machine_id=None,
            storage_place=None,
        ),
        SparePart(
            article_number="1000",
            name="Keilriemen",
            type="Normteil",
            plant_id=other_plant.id,
            quantity=2,
            unit="Stk",
            machine_id=None,
            storage_place="Schrank 1",
        ),
    ]
    session.add_all(parts)
    await session.flush()
    return {
        "plant": plant,
        "other_plant": other_plant,
        "press": press,
        "mill": mill,
        "parts": parts,
    }


# --------------------------------------------------------------------------
# Suche und Filter
# --------------------------------------------------------------------------


async def test_search_finds_all_documented_fields(session, workspace):
    """Die Suche greift über Artikelnummer, Name, Typ, Lagerort, Beschreibung,
    Werk- und Maschinenname (DEC-064)."""
    service = SparePartService(session)

    async def numbers(**kwargs):
        items, _ = await service.get_all(**kwargs)
        return sorted(part.article_number for part in items)

    assert await numbers(search="4711") == ["4711", "4711"]
    assert await numbers(search="Dichtung") == ["4711", "4711"]
    assert await numbers(search="Sensor") == ["8020"]
    assert await numbers(search="Regal B4") == ["4711"]
    assert await numbers(search="hitzebeständig") == ["4711"]
    assert await numbers(search="Werk 2") == ["1000"]
    assert await numbers(search="Presse 4") == ["4711", "4711"]


async def test_search_is_case_insensitive_and_partial(session, workspace):
    """Suche ist unabhängig von Groß-/Kleinschreibung und findet Teiltreffer."""
    service = SparePartService(session)
    items, total = await service.get_all(search="näherungs")
    assert total == 1
    assert [part.article_number for part in items] == ["8020"]


async def test_plant_machine_and_type_filters(session, workspace):
    """Werk-, Maschinen- und Typfilter wirken einzeln und zusammen als UND."""
    service = SparePartService(session)

    in_plant = await service.get_all(plant_id=workspace["plant"].id)
    assert in_plant[1] == 3

    in_other = await service.get_all(plant_id=workspace["other_plant"].id)
    assert [part.article_number for part in in_other[0]] == ["1000"]

    by_machine = await service.get_all(machine_id=workspace["press"].id)
    assert by_machine[1] == 2

    # Werk und Maschine, die nicht zusammenpassen -> leere Seite, korrekte Zahl
    mismatch = await service.get_all(
        plant_id=workspace["other_plant"].id, machine_id=workspace["press"].id
    )
    assert mismatch[0] == []
    assert mismatch[1] == 0

    sensors = await service.get_all(type="Sensor")
    assert [part.article_number for part in sensors[0]] == ["8020"]


# --------------------------------------------------------------------------
# Sortierung und Pagination
# --------------------------------------------------------------------------


async def test_sorting_and_nulls_last(session, workspace):
    """Sortierung nach Artikelnummer, Name, Menge; leere Werte stehen hinten."""
    service = SparePartService(session)

    ascending = await service.get_all(sort="article_number", order="asc")
    assert [p.article_number for p in ascending[0]] == ["1000", "4711", "4711", "8020"]

    descending = await service.get_all(sort="article_number", order="desc")
    assert [p.article_number for p in descending[0]] == ["8020", "4711", "4711", "1000"]

    by_quantity = await service.get_all(sort="quantity", order="asc")
    assert [p.quantity for p in by_quantity[0]] == [0, 2, 4, 25]

    # `8020` hat keinen Lagerort -> NULLS LAST, auch absteigend.
    place_asc = await service.get_all(sort="storage_place", order="asc")
    assert place_asc[0][-1].article_number == "8020"
    place_desc = await service.get_all(sort="storage_place", order="desc")
    assert place_desc[0][-1].article_number == "8020"


async def test_pagination_is_stable_despite_duplicate_numbers(session, workspace):
    """Zwei Seiten überlappen nicht und lassen nichts aus – trotz doppelter Nummer.

    Genau dafür gibt es den Tiebreaker auf `id`: ohne ihn wäre die Reihenfolge
    der beiden `4711`-Zeilen beliebig und eine Zeile könnte doppelt erscheinen.
    """
    service = SparePartService(session)

    page1, total = await service.get_all(sort="article_number", skip=0, limit=2)
    page2, _ = await service.get_all(sort="article_number", skip=2, limit=2)

    assert total == 4
    ids1 = [part.id for part in page1]
    ids2 = [part.id for part in page2]
    assert len(ids1) == 2 and len(ids2) == 2
    assert set(ids1).isdisjoint(ids2)
    assert len(set(ids1 + ids2)) == 4


# --------------------------------------------------------------------------
# Pflichtangaben und Stammdaten
# --------------------------------------------------------------------------


async def test_article_number_is_required_and_trimmed():
    """Ohne Artikelnummer kein Datensatz; Leerraum wird abgeschnitten."""
    with pytest.raises(ValidationError) as error:
        SparePartCreate(article_number="   ", plant_id=1)
    assert "Bitte eine Artikelnummer angeben." in str(error.value)

    cleaned = SparePartCreate(article_number="  4711  ", plant_id=1)
    assert cleaned.article_number == "4711"


async def test_quantity_defaults_to_one_and_rejects_negative():
    """Menge: Default 1, „0" (aufgebraucht) erlaubt, negativ und Text abgelehnt."""
    default = SparePartCreate(article_number="1", plant_id=1)
    assert default.quantity == 1

    empty = SparePartCreate(article_number="1", plant_id=1, quantity="")
    assert empty.quantity == 1

    used_up = SparePartCreate(article_number="1", plant_id=1, quantity=0)
    assert used_up.quantity == 0

    from_form = SparePartCreate(article_number="1", plant_id=1, quantity="25")
    assert from_form.quantity == 25

    with pytest.raises(ValidationError) as negative:
        SparePartCreate(article_number="1", plant_id=1, quantity=-5)
    assert "Die Menge darf nicht negativ sein." in str(negative.value)

    with pytest.raises(ValidationError):
        SparePartCreate(article_number="1", plant_id=1, quantity="viele")


async def test_empty_optional_text_becomes_none():
    """Leere Freiwillig-Felder bedeuten „nicht gepflegt", nicht Leerstring."""
    data = SparePartCreate(
        article_number="1",
        plant_id=1,
        name="   ",
        type="",
        unit="  ",
        storage_place=" ",
        description="",
    )
    assert data.name is None
    assert data.type is None
    assert data.unit is None
    assert data.storage_place is None
    assert data.description is None


async def test_missing_plant_is_rejected(session, workspace):
    """Ein Werk, das es nicht mehr gibt, ergibt eine verständliche Meldung."""
    service = SparePartService(session)

    with pytest.raises(ValueError) as missing:
        await service.create(SparePartCreate(article_number="9999", plant_id=999_999))
    assert "Das gewählte Werk gibt es nicht mehr." in str(missing.value)


async def test_missing_machine_is_rejected(session, workspace):
    """Eine gelöschte Maschine darf nicht als Fremdschlüsselfehler hochkommen."""
    service = SparePartService(session)

    with pytest.raises(ValueError) as missing:
        await service.create(
            SparePartCreate(
                article_number="9999",
                plant_id=workspace["plant"].id,
                machine_id=999_999,
            )
        )
    assert "Die gewählte Maschine gibt es nicht mehr." in str(missing.value)


# --------------------------------------------------------------------------
# Anlegen, Ändern, Löschen
# --------------------------------------------------------------------------


async def test_create_allows_duplicate_article_number(session, workspace):
    """Dieselbe Artikelnummer mehrfach ist erlaubt – und wird gezählt.

    Anders als beim Serienartikel (dort ist die Nummer eindeutig, DEC-056) ist die
    Dublette bei Ersatzteilen der Normalfall (DEC-064 Punkt 8).
    """
    service = SparePartService(session)

    before = await service.count_by_article_number("4711")
    assert before == 2

    created = await service.create(
        SparePartCreate(
            article_number="4711",
            name="Dichtung Ø40",
            plant_id=workspace["plant"].id,
            quantity=3,
            storage_place="Regal B5",
        )
    )
    assert created.id is not None
    assert created.quantity == 3
    assert await service.count_by_article_number("4711") == 3

    # Beim Bearbeiten zählt der eigene Datensatz nicht mit.
    assert await service.count_by_article_number("4711", exclude_id=created.id) == 2


async def test_update_applies_none_values(session, workspace):
    """„Maschine entfernen" und „Lagerort leeren" müssen ankommen.

    `CRUDBase.update()` würde None überspringen – hier ist das ausdrücklich falsch.
    """
    service = SparePartService(session)
    part = workspace["parts"][0]
    assert part.machine_id is not None
    assert part.storage_place is not None

    updated = await service.update(
        part.id,
        SparePartUpdate(
            article_number="4711",
            name="Dichtung Ø40",
            type="Dichtung",
            plant_id=workspace["plant"].id,
            quantity=10,
            unit="Stk",
            machine_id=None,
            storage_place=None,
            description=None,
        ),
    )
    assert updated is not None
    assert updated.machine_id is None
    assert updated.storage_place is None
    assert updated.description is None
    assert updated.quantity == 10


async def test_update_checks_master_data(session, workspace):
    """Auch beim Ändern wird das Werk geprüft."""
    service = SparePartService(session)
    part = workspace["parts"][0]

    with pytest.raises(ValueError):
        await service.update(
            part.id,
            SparePartUpdate(article_number="4711", plant_id=999_999),
        )


async def test_update_and_delete_unknown_id(session, workspace):
    """Unbekannte ID: Ändern liefert None, Löschen False (HTTP 404 im Router)."""
    service = SparePartService(session)
    assert (
        await service.update(
            999_999, SparePartUpdate(article_number="1", plant_id=workspace["plant"].id)
        )
        is None
    )
    assert await service.delete(999_999) is False


async def test_delete_removes_row(session, workspace):
    """Löschen entfernt genau eine Zeile – die zweite mit gleicher Nummer bleibt."""
    service = SparePartService(session)
    part = workspace["parts"][0]

    assert await service.delete(part.id) is True
    assert await service.get(part.id) is None
    assert await service.count_by_article_number("4711") == 1


async def test_quantity_zero_counts_as_existing(session, workspace):
    """„0 Stück" ist ein gepflegter Bestand, keine fehlende Angabe."""
    service = SparePartService(session)
    items, total = await service.get_all(search="8020")
    assert total == 1
    assert items[0].quantity == 0


# --------------------------------------------------------------------------
# Favoriten (global, DEC-063)
# --------------------------------------------------------------------------


async def test_favorite_defaults_to_false(session, workspace):
    """Neue Teile sind keine Favoriten – die Spalte kommt mit `false`."""
    service = SparePartService(session)
    part = await service.get(workspace["parts"][0].id)
    assert part.is_favorite is False


async def test_set_favorite_and_filter_by_it(session, workspace):
    """Markieren, filtern, wieder abwählen – der Filter folgt der Markierung."""
    service = SparePartService(session)
    erste, zweite = workspace["parts"][0], workspace["parts"][2]

    # Ohne Markierung ist der Filter leer.
    items, total = await service.get_all(favorites_only=True)
    assert total == 0

    markiert = await service.set_favorite(erste.id, True)
    assert markiert.is_favorite is True

    items, total = await service.get_all(favorites_only=True)
    assert total == 1
    assert items[0].id == erste.id

    # Eine zweite Markierung – der Filter liefert beide.
    await service.set_favorite(zweite.id, True)
    _, total = await service.get_all(favorites_only=True)
    assert total == 2

    # Abwählen entfernt sie wieder aus dem Filter.
    await service.set_favorite(erste.id, False)
    items, total = await service.get_all(favorites_only=True)
    assert total == 1
    assert items[0].id == zweite.id


async def test_update_does_not_reset_the_favorite(session, workspace):
    """Ein normales Bearbeiten lässt die Markierung stehen (DEC-063).

    `is_favorite` steht bewusst **nicht** in `SparePartUpdate`: sonst würde
    jedes Speichern aus dem Formular den Stern zurücksetzen.
    """
    service = SparePartService(session)
    part = workspace["parts"][0]
    await service.set_favorite(part.id, True)

    geaendert = await service.update(
        part.id,
        SparePartUpdate(
            article_number=part.article_number,
            plant_id=part.plant_id,
            quantity=7,
        ),
    )
    assert geaendert.quantity == 7
    assert geaendert.is_favorite is True, "Der Stern darf nicht verloren gehen"


async def test_set_favorite_unknown_id(session):
    """Unbekannte ID: keine Markierung (HTTP 404 im Router)."""
    service = SparePartService(session)
    assert await service.set_favorite(999_999, True) is None
