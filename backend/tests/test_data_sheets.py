"""Tests für Datenblätter – Schwerpunkt: der **exakte** Werkzeug-ID-Filter.

Der Bereich „Datenblätter" hatte keine Backend-Tests. Diese Datei deckt den
Filter ab, der für die Zeilenaktion „Datenblatt" in der Werkzeugliste gebraucht
wird (DEC-065 Punkt 10):

    Aus der Werkzeugzeile wird `GET /api/data-sheets/?tool_id=<id>` aufgerufen,
    um **das** Datenblatt dieses Werkzeugs zu finden. Mit der unscharfen Suche
    (`search`, `ilike`) waere „188" auch in „1880" enthalten – die Liste zeigte
    dann ein fremdes Datenblatt, und die Oberflaeche oeffnete es.

Dazu die Faelle, die die Oberflaeche unterscheidet: genau ein Treffer mit PDF
(→ direkt oeffnen), mehrere (→ Liste mit Auswahl), keiner (→ Liste).

Die Ablage zeigt auf ein temporaeres Verzeichnis (`root`-Parameter des
Service) – der echte `backend/uploads`-Ordner bleibt unberuehrt.

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_data_sheets.py -q
"""

import io
import shutil
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.datastructures import Headers, UploadFile

from app.models.base import Base
from app.models.data_sheet import DataSheet  # noqa: F401  (Modell registrieren)
from app.models.master_data import Machine, Plant
from app.routers.data_sheets import _to_read
from app.schemas.data_sheet import DataSheetCreate
from app.services.data_sheet_service import DataSheetService

pytestmark = pytest.mark.asyncio


def _pdf(filename: str = "plan.pdf", content: bytes = b"%PDF-1.4 Testinhalt"):
    """UploadFile für den direkten Service-Aufruf (ohne HTTP-Schicht)."""
    return UploadFile(
        file=io.BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": "application/pdf"}),
    )


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db_session:
        yield db_session

    await engine.dispose()


@pytest.fixture
def upload_root_dir():
    """Temporäre Ablage – im Projektordner, nicht im System-Temp.

    Bewusst **nicht** `tmp_path`: das System-Temp liegt in dieser Umgebung
    außerhalb des Schreibbereichs. Der Ordner wird nach dem Test entfernt.
    """
    base = Path(__file__).resolve().parent / "_uploads_tmp"
    folder = base / uuid.uuid4().hex
    folder.mkdir(parents=True, exist_ok=True)
    try:
        yield folder
    finally:
        shutil.rmtree(base, ignore_errors=True)


@pytest_asyncio.fixture
async def workspace(session, upload_root_dir):
    """Ein Werk mit Maschine und ein Service mit eigener Ablage."""
    plant = Plant(name="Werk 1")
    session.add(plant)
    await session.flush()

    machine = Machine(name="TruMatic 4kW", plant_id=plant.id)
    session.add(machine)
    await session.flush()

    service = DataSheetService(session, root=upload_root_dir)
    return {"plant": plant, "machine": machine, "service": service}


async def _anlegen(workspace, tool_id, name, mit_pdf=True):
    """Ein Datenblatt anlegen – mit oder ohne hinterlegte Datei."""
    service = workspace["service"]
    return await service.create(
        DataSheetCreate(
            tool_id=tool_id,
            plant_id=workspace["plant"].id,
            machine_id=workspace["machine"].id,
            name=name,
        ),
        pdf_files=_pdf(f"{name}.pdf") if mit_pdf else None,
    )


# --------------------------------------------------------------------------
# Exakter Werkzeug-ID-Filter (Zeilenaktion „Datenblatt")
# --------------------------------------------------------------------------


async def test_tool_id_filter_matches_exactly(workspace):
    """`tool_id` trifft genau diese ID – nicht die ähnliche."""
    await _anlegen(workspace, "188", "Senker")
    await _anlegen(workspace, "1880", "Ähnliche Nummer")
    service = workspace["service"]

    items, total = await service.get_all(tool_id="188")
    assert total == 1
    assert items[0].name == "Senker"

    items, total = await service.get_all(tool_id="1880")
    assert total == 1
    assert items[0].name == "Ähnliche Nummer"


async def test_tool_id_filter_does_not_search_other_fields(workspace):
    """Die ID darf **nicht** über Name oder Beschreibung treffen.

    Genau das wäre bei der unscharfen Suche passiert: ein Datenblatt mit der ID
    „999" und dem Namen „188 Montage" hätte den Filter auf „188" erfüllt.
    """
    await _anlegen(workspace, "999", "188 Montage")
    service = workspace["service"]

    _, total = await service.get_all(tool_id="188")
    assert total == 0, "Der Filter darf nur die Werkzeug-ID vergleichen"


async def test_tool_id_filter_trims_whitespace(workspace):
    """Leerraum um die ID wird abgeschnitten (so kommt sie aus dem Formular)."""
    await _anlegen(workspace, "01020000", "RundTEST")
    service = workspace["service"]

    items, total = await service.get_all(tool_id="  01020000  ")
    assert total == 1
    assert items[0].tool_id == "01020000"


async def test_tool_id_filter_returns_all_sheets_of_that_id(workspace):
    """Mehrere Datenblätter je ID sind der Normalfall (andere Maschine, Auflage).

    Die Oberfläche öffnet nur bei **genau einem** Treffer direkt; bei mehreren
    zeigt sie die Liste, damit der Benutzer wählen kann.
    """
    await _anlegen(workspace, "365545", "Senker Auflage 1")
    await _anlegen(workspace, "365545", "Senker Auflage 2")
    service = workspace["service"]

    items, total = await service.get_all(tool_id="365545")
    assert total == 2
    assert {eintrag.name for eintrag in items} == {"Senker Auflage 1", "Senker Auflage 2"}


async def test_tool_id_filter_without_pdf(workspace):
    """Ohne hinterlegte Datei bleibt `has_pdf` falsch.

    Die Oberfläche öffnet dann **nicht** direkt – es gibt nichts anzuzeigen –
    und wechselt in die Liste.
    """
    await _anlegen(workspace, "4711", "Ohne Datei", mit_pdf=False)
    service = workspace["service"]

    items, total = await service.get_all(tool_id="4711")
    assert total == 1
    assert items[0].has_pdf is False


async def test_tool_id_filter_counts_only_that_id(workspace):
    """Der Filter zählt nur die eigene ID – `total` trägt die Entscheidung.

    Die Oberfläche entscheidet anhand von `total` und `has_pdf` des Treffers, ob
    sie direkt öffnet; deshalb muss die Zählung stimmen.
    """
    for nummer in ("188", "188", "1880", "999"):
        await _anlegen(workspace, nummer, f"Blatt {nummer}")

    service = workspace["service"]
    _, total = await service.get_all(tool_id="188")
    assert total == 2
    _, alle = await service.get_all()
    assert alle == 4


# --------------------------------------------------------------------------
# `has_pdf` in der Antwort folgt der Dateiliste
# --------------------------------------------------------------------------


async def test_antwort_has_pdf_folgt_der_dateiliste(workspace):
    """Die Antwort meldet `has_pdf` genau dann, wenn eine Datei da ist."""
    sheet = await _anlegen(workspace, "5001", "Mit Datei")
    service = workspace["service"]

    data = _to_read(sheet, service)
    assert data.has_pdf is True
    assert [eintrag.name for eintrag in data.plans] == ["plan.pdf"]


async def test_antwort_has_pdf_ist_falsch_wenn_die_datei_verschwindet(workspace):
    """Verschwindet die Datei außerhalb der Anwendung, bleibt keine Lüge übrig.

    Der gespeicherte Verweis `pdf_path` zeigt dann ins Leere – die Antwort darf
    trotzdem **nicht** `has_pdf: true` bei leerer Dateiliste melden: die
    Zeilenaktion „Datenblatt" in der Werkzeugliste öffnet nur bei `has_pdf`, und
    ein Öffnen ohne Datei wäre ein Fehler statt einer Anzeige.
    """
    sheet = await _anlegen(workspace, "5002", "Verschwundene Datei")
    service = workspace["service"]

    # Eingriff von außen: die Datei wird am Service vorbei entfernt.
    (service.sheet_dir(sheet.id) / "plan.pdf").unlink()
    assert sheet.pdf_path is not None  # der Verweis steht noch in der Datenbank

    data = _to_read(sheet, service)
    assert data.plans == []
    assert data.has_pdf is False


# --------------------------------------------------------------------------
# Datenblatt ohne Werk = gilt für alle Werke (DEC-085)
# --------------------------------------------------------------------------


async def test_anlegen_ohne_werk_ist_erlaubt(workspace):
    """Allgemeine Info: kein Werk, kein Werkzeug – nur Name und Datei.

    Das war der gemeldete Fall: „Ich muss Werk auswählen, die Info soll aber für
    beide Werke gehen." Ohne Werk gilt der Datensatz für **alle** Werke.
    """
    service = workspace["service"]
    sheet = await service.create(
        DataSheetCreate(name="Allgemeine Bedienungsanleitung"),
        pdf_files=_pdf("anleitung.pdf"),
    )

    assert sheet.plant_id is None
    data = _to_read(sheet, service)
    assert data.plant is None, "ohne Werk kein Plant-Objekt - die Liste zeigt 'Alle Werke'"
    assert data.has_pdf is True


async def test_werk_filter_findet_auch_allgemeine_datensaetze(workspace):
    """Ein Filter auf ein Werk schließt die „für alle Werke" nicht aus.

    Sonst wäre die allgemeine Info in jedem Werk unsichtbar – genau das Gegenteil
    von „gilt für alle".
    """
    service = workspace["service"]
    await _anlegen(workspace, "188", "Nur Werk 1")
    await service.create(DataSheetCreate(name="Für alle"))

    items, total = await service.get_all(plant_id=workspace["plant"].id)
    assert total == 2
    assert {eintrag.name for eintrag in items} == {"Nur Werk 1", "Für alle"}


async def test_werk_laesst_sich_wieder_leeren(workspace):
    """Aus „Werk 1" wird „alle Werke" – das Feld ist leerbar (anders als früher)."""
    sheet = await _anlegen(workspace, "189", "Erst Werk 1")
    service = workspace["service"]

    geaendert = await service.update(sheet.id, {"plant_id": None})
    assert geaendert.plant_id is None

    items, total = await service.get_all(plant_id=workspace["plant"].id)
    assert total == 1, "gilt weiterhin für Werk 1 – jetzt, weil es für alle gilt"


async def test_unbekanntes_werk_wird_weiter_abgewiesen(workspace):
    """Ein *angegebenes*, aber unbekanntes Werk bleibt ein Fehler."""
    service = workspace["service"]
    with pytest.raises(ValueError) as fehler:
        await service.create(DataSheetCreate(plant_id=9999, name="Geisterwerk"))
    assert "gibt es nicht mehr" in str(fehler.value)
