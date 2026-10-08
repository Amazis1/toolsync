"""Tests für Serienartikel: Felder, Rechte-Grundlage, Liste und Artikelordner.

Geprüft wird der Service (`SerialArticleService`) – also genau die Schicht, die
die Oberfläche aufruft – plus die Ordnerlogik aus DEC-057. Schwerpunkte:

- Felder und Pflichtwerte (Werk Pflicht, Name/Kunde/Maschine/Beschreibung frei)
- Stammdatenprüfung (gelöschtes Werk/Kunde/Maschine -> verständlicher Fehler)
- Suche über alle sechs Angaben, Sortierung (NULLS LAST), Pagination, `total`
- Artikelordner: anlegen, bereinigen, umbenennen, löschen (samt Inhalt)
- Pfadauflösung gegen die Ablage (kein Ausbruch aus dem Upload-Ordner)
- Ersetzen und Ablegen des Plans als `plan.pdf`

Die Ablage zeigt in den Tests auf ein temporäres Verzeichnis
(`TOOLSYNC_UPLOAD_DIR`-Ersatz über den `root`-Parameter) – der echte
`backend/uploads`-Ordner bleibt unberührt.

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_serial_articles.py -q
"""

import io
import shutil
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from starlette.datastructures import Headers, UploadFile

from app.models.base import Base
from app.models.master_data import Customer, Machine, Plant
from app.models.serial_article import SerialArticle  # noqa: F401  (Modell registrieren)
from app.schemas.serial_article import SerialArticleCreate
from app.services.serial_article_service import (
    PLAN_FILE_NAME,
    SerialArticleService,
    sanitize_folder_name,
)

pytestmark = pytest.mark.asyncio


def _upload(filename: str = "plan.pdf", content: bytes = b"%PDF-1.4 Testinhalt"):
    """UploadFile für den direkten Service-Aufruf (ohne HTTP-Schicht)."""
    return UploadFile(
        file=io.BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": "application/pdf"}),
    )


def _image(filename: str = "foto.jpg", content: bytes = b"bildinhalt"):
    """UploadFile für ein Bild (DEC-058)."""
    return UploadFile(
        file=io.BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": "image/jpeg"}),
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
    """Temporäre Ablage für den Test – im Projektordner, nicht im System-Temp.

    Bewusst **nicht** `tmp_path`: das System-Temp-Verzeichnis liegt in dieser
    Umgebung außerhalb des Schreibbereichs (PermissionError). Der Ordner wird
    nach dem Test wieder entfernt.
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
    """Zwei Werke, Kunden, Maschinen und ein Service mit eigener Ablage."""
    plant = Plant(name="Werk 1")
    other_plant = Plant(name="Werk 2")
    session.add_all([plant, other_plant])

    customer = Customer(name="ECO")
    other_customer = Customer(name="BEGA")
    session.add_all([customer, other_customer])
    await session.flush()

    machine = Machine(name="TruMatic 4kW", plant_id=plant.id)
    other_machine = Machine(name="TruMatic 5000", plant_id=other_plant.id)
    session.add_all([machine, other_machine])
    await session.flush()

    service = SerialArticleService(session, root=upload_root_dir)
    return {
        "session": session,
        "service": service,
        "root": upload_root_dir,
        "plant": plant,
        "other_plant": other_plant,
        "customer": customer,
        "other_customer": other_customer,
        "machine": machine,
        "other_machine": other_machine,
    }


def _data(workspace, article_number="01075000", **overrides):
    values = {
        "article_number": article_number,
        "name": "Rund 2.5 ALU",
        "plant_id": workspace["plant"].id,
        "customer_id": None,
        "machine_id": None,
        "description": None,
    }
    values.update(overrides)
    return SerialArticleCreate(**values)


# ----------------------------------------------------------------------
# Anlegen und Ordner (DEC-056, DEC-057)
# ----------------------------------------------------------------------
async def test_create_legt_ordner_und_plan_an(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload())

    folder = workspace["root"] / "01075000"
    assert folder.is_dir(), "Der Artikelordner muss angelegt werden"
    assert (folder / PLAN_FILE_NAME).is_file(), "Der Plan liegt als plan.pdf im Ordner"
    assert article.pdf_path == "uploads/serial_articles/01075000/plan.pdf"
    assert article.has_pdf is True


async def test_create_ohne_pdf_legt_ordner_trotzdem_an(workspace):
    """Der Ordner ist die Dateiablage des Artikels – er entsteht auch ohne PDF."""
    service = workspace["service"]
    article = await service.create(_data(workspace, article_number="02000000"))

    assert (workspace["root"] / "02000000").is_dir()
    assert article.pdf_path is None
    assert article.has_pdf is False


async def test_create_doppelte_nummer_abgelehnt(workspace):
    service = workspace["service"]
    await service.create(_data(workspace, article_number="03000000"))

    with pytest.raises(ValueError, match="bereits vergeben"):
        await service.create(_data(workspace, article_number="03000000"))


async def test_create_ohne_werk_abgelehnt(workspace):
    """Werk ist Pflicht (DEC-056 Punkt 2) – auch serverseitig."""
    with pytest.raises(ValidationError):
        SerialArticleCreate(
            article_number="04000000",
            plant_id=None,
        )


async def test_create_mit_unbekanntem_werk_abgelehnt(workspace):
    service = workspace["service"]
    with pytest.raises(ValueError, match="Werk gibt es nicht mehr"):
        await service.create(_data(workspace, plant_id=9999))


async def test_create_mit_geloeschtem_kunden_abgelehnt(workspace):
    service = workspace["service"]
    with pytest.raises(ValueError, match="Kunde gibt es nicht mehr"):
        await service.create(_data(workspace, customer_id=9999))


async def test_create_mit_geloeschter_maschine_abgelehnt(workspace):
    service = workspace["service"]
    with pytest.raises(ValueError, match="Maschine gibt es nicht mehr"):
        await service.create(_data(workspace, machine_id=9999))


async def test_create_mit_fremder_dateiendung_abgelehnt(workspace):
    """Nur die Endung wird geprüft – aber sie wird geprüft (DEC-056 Punkt 12)."""
    service = workspace["service"]
    with pytest.raises(ValueError, match="PDF-Datei"):
        await service.create(_data(workspace), _upload(filename="notizen.txt"))


async def test_create_laesst_keinen_leeren_ordner_zurueck(workspace):
    """Scheitert das Anlegen, bleibt kein halber Zustand in der Ablage."""
    service = workspace["service"]
    with pytest.raises(ValueError):
        await service.create(_data(workspace), _upload(filename="notizen.txt"))

    assert not (workspace["root"] / "01075000").exists()


async def test_nummer_wird_getrimmt(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace, article_number="  01075000  "))
    assert article.article_number == "01075000"


# ----------------------------------------------------------------------
# Nummernprüfung (Live-Prüfung im Formular)
# ----------------------------------------------------------------------
async def test_check_nummer_frei_und_belegt(workspace):
    service = workspace["service"]
    frei = await service.check_article_number("01075000")
    assert frei["available"] is True

    article = await service.create(_data(workspace, article_number="01075000"))
    belegt = await service.check_article_number("01075000")
    assert belegt["available"] is False
    assert belegt["existing_count"] == 1
    assert belegt["existing_id"] == article.id
    assert "bereits vergeben" in belegt["message"]

    leer = await service.check_article_number("   ")
    assert leer["available"] is False
    assert "Artikelnummer angeben" in leer["message"]


async def test_check_nummer_nimmt_eigene_id_aus(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace, article_number="05000000"))

    eigen = await service.check_article_number("05000000", exclude_id=article.id)
    assert eigen["available"] is True


# ----------------------------------------------------------------------
# Ordnernamen (DEC-057 Punkt 2)
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    ("nummer", "erwartet"),
    [
        ("01075000", "01075000"),
        ("0107/5000", "0107_5000"),
        ("A:B*C", "A_B_C"),
        ("0107 5000", "0107_5000"),
        ("..", "artikel"),
        ("...", "artikel"),
        (".geheim", "geheim"),
        ("CON", "artikel_CON"),
        ("com1", "artikel_com1"),
        ("", "artikel"),
        ("   ", "artikel"),
    ],
)
async def test_ordnername_wird_bereinigt(nummer, erwartet):
    assert sanitize_folder_name(nummer) == erwartet


async def test_ordnername_enthaelt_keine_pfadtrenner():
    name = sanitize_folder_name("../..\\etc/passwd")
    assert "/" not in name and "\\" not in name and ".." not in name


# ----------------------------------------------------------------------
# Ändern (inkl. Felder leeren, Ordner umbenennen, PDF ersetzen)
# ----------------------------------------------------------------------
async def test_update_leert_name_und_beschreibung(workspace):
    service = workspace["service"]
    article = await service.create(
        _data(workspace, name="Plan A", description="alte Notiz")
    )

    updated = await service.update(
        article.id, {"name": None, "description": None}
    )
    assert updated is not None
    assert updated.name is None
    assert updated.description is None


async def test_update_setzt_und_leert_kunde_und_maschine(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace))

    gesetzt = await service.update(
        article.id,
        {"customer_id": workspace["customer"].id, "machine_id": workspace["machine"].id},
    )
    assert gesetzt.customer_id == workspace["customer"].id
    assert gesetzt.machine_id == workspace["machine"].id

    geleert = await service.update(article.id, {"customer_id": None, "machine_id": None})
    assert geleert.customer_id is None
    assert geleert.machine_id is None


async def test_update_benennt_ordner_um(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace, article_number="06000000"), _upload())
    alt = workspace["root"] / "06000000"
    assert alt.is_dir()

    updated = await service.update(article.id, {"article_number": "06000001"})

    assert not alt.exists(), "Der alte Ordner darf nicht liegen bleiben"
    neu = workspace["root"] / "06000001"
    assert neu.is_dir()
    assert (neu / PLAN_FILE_NAME).is_file()
    assert updated.pdf_path == "uploads/serial_articles/06000001/plan.pdf"


async def test_update_auf_belegten_ordner_bricht_ab(workspace):
    """Liegt zum neuen Namen schon ein Ablageordner, wird nicht hineinkopiert.

    Erreichbar, wenn der Ordner übrig geblieben ist (z. B. nach einem manuellen
    Eingriff) – die beiden Artikel dürfen nicht in einem Ordner landen
    (DEC-057 Punkt 6).
    """
    service = workspace["service"]
    article = await service.create(_data(workspace, article_number="07000000"), _upload())
    fremder_ordner = workspace["root"] / "07000009"
    fremder_ordner.mkdir(parents=True)
    (fremder_ordner / "fremd.pdf").write_bytes(b"%PDF fremd")

    with pytest.raises(ValueError, match="Ablageordner"):
        await service.update(article.id, {"article_number": "07000009"})

    # Nichts wurde verschoben oder überschrieben.
    assert (workspace["root"] / "07000000" / PLAN_FILE_NAME).is_file()
    assert (fremder_ordner / "fremd.pdf").read_bytes() == b"%PDF fremd"
    unveraendert = await service.get(article.id)
    assert unveraendert.article_number == "07000000"


async def test_update_auf_vergebene_nummer_bricht_ab(workspace):
    service = workspace["service"]
    erster = await service.create(_data(workspace, article_number="08000000"))
    await service.create(_data(workspace, article_number="08000001"))

    with pytest.raises(ValueError, match="bereits vergeben"):
        await service.update(erster.id, {"article_number": "08000001"})


async def test_zweiter_plan_kommt_hinzu_statt_zu_ersetzen(workspace):
    """Mehrere Pläne je Artikel: der erste bleibt `plan.pdf` (DEC-062)."""
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload(content=b"%PDF alt"))
    folder = workspace["root"] / "01075000"

    await service.update(article.id, {}, pdf_file=_upload(content=b"%PDF neu"))
    frisch = await service.get(article.id)

    assert (folder / PLAN_FILE_NAME).read_bytes() == b"%PDF alt"
    assert (folder / "plan-2.pdf").read_bytes() == b"%PDF neu"

    plaene, bilder = service.list_files(frisch)
    assert [eintrag["name"] for eintrag in plaene] == ["plan.pdf", "plan-2.pdf"]
    assert [eintrag["kind"] for eintrag in plaene] == ["plan", "plan"]
    assert bilder == []
    # `pdf_path` zeigt weiterhin auf den ersten Plan.
    assert frisch.pdf_path == "uploads/serial_articles/01075000/plan.pdf"
    assert frisch.has_pdf is True


async def test_mehrere_plaene_in_einer_anfrage(workspace):
    """Der Service nimmt auch eine Liste von Plänen entgegen."""
    service = workspace["service"]
    article = await service.create(
        _data(workspace),
        pdf_file=[_upload(content=b"%PDF 1"), _upload(content=b"%PDF 2")],
    )

    folder = workspace["root"] / "01075000"
    assert (folder / PLAN_FILE_NAME).read_bytes() == b"%PDF 1"
    assert (folder / "plan-2.pdf").read_bytes() == b"%PDF 2"
    plaene, _ = service.list_files(article)
    assert [eintrag["name"] for eintrag in plaene] == ["plan.pdf", "plan-2.pdf"]


async def test_plan_loeschen_fuehrt_pdf_path_nach(workspace):
    """Der gelöschte Plan verschwindet – `pdf_path` zeigt auf den nächsten (DEC-062)."""
    service = workspace["service"]
    article = await service.create(
        _data(workspace),
        pdf_file=[_upload(content=b"%PDF 1"), _upload(content=b"%PDF 2")],
    )

    assert await service.delete_file(article, PLAN_FILE_NAME) is True
    frisch = await service.get(article.id)

    assert frisch.pdf_path == "uploads/serial_articles/01075000/plan-2.pdf"
    assert frisch.has_pdf is True
    plaene, _ = service.list_files(frisch)
    assert [eintrag["name"] for eintrag in plaene] == ["plan-2.pdf"]


async def test_letzter_plan_geloescht_hebt_has_pdf_auf(workspace):
    """Ohne Plan ist `has_pdf` falsch und der PDF-Eintrag verschwindet (DEC-062)."""
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload())

    assert await service.delete_file(article, PLAN_FILE_NAME) is True
    frisch = await service.get(article.id)

    assert frisch.pdf_path is None
    assert frisch.has_pdf is False
    assert service.list_files(frisch) == ([], [])


async def test_update_unbekannte_id_gibt_none(workspace):
    service = workspace["service"]
    assert await service.update(9999, {"name": "x"}) is None


# ----------------------------------------------------------------------
# Löschen
# ----------------------------------------------------------------------
async def test_delete_entfernt_ordner_samt_inhalt(workspace):
    """Gelöscht wird der ganze Artikelordner – dort können weitere Dateien liegen."""
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload())
    folder = workspace["root"] / "01075000"
    (folder / "foto-1.jpg").write_bytes(b"kein echtes Bild, nur ein Platzhalter")

    assert await service.delete(article.id) is True

    assert not folder.exists(), "Der Artikelordner muss samt Inhalt entfernt werden"
    assert await service.get(article.id) is None


async def test_delete_unbekannte_id_gibt_false(workspace):
    service = workspace["service"]
    assert await service.delete(9999) is False


# ----------------------------------------------------------------------
# Pfadauflösung (DEC-057 Punkt 8)
# ----------------------------------------------------------------------
async def test_resolve_pdf_path_findet_die_datei(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload())

    aufgeloest = service.resolve_pdf_path(article.pdf_path)
    assert aufgeloest is not None
    assert aufgeloest.is_file()
    assert aufgeloest == (workspace["root"] / "01075000" / PLAN_FILE_NAME).resolve()


@pytest.mark.parametrize(
    "pfad",
    [
        "../geheim.txt",
        "uploads/serial_articles/../../geheim.txt",
        "uploads/serial_articles/01075000/../../../../etc/passwd",
        "",
        None,
    ],
)
async def test_resolve_pdf_path_verhindert_ausbruch(pfad):
    from app.services.serial_article_service import SerialArticleService as _Service

    service = _Service.__new__(_Service)  # nur die Pfadlogik, ohne Datenbank
    service.root = (Path.cwd() / "uploads_tmp_test").resolve()

    assert service.resolve_pdf_path(pfad) is None


# ----------------------------------------------------------------------
# Liste: Suche, Filter, Sortierung, Pagination
# ----------------------------------------------------------------------
@pytest_asyncio.fixture
async def bestand(workspace):
    """Fünf Artikel mit unterschiedlichen Angaben."""
    service = workspace["service"]
    await service.create(
        _data(
            workspace,
            article_number="01075000",
            name="Rund 2.5 ALU",
            customer_id=workspace["customer"].id,
            machine_id=workspace["machine"].id,
            description="Programm 4711",
        ),
        _upload(),
    )
    await service.create(
        _data(
            workspace,
            article_number="01080000",
            name="Quadrat 4.0",
            customer_id=workspace["other_customer"].id,
            machine_id=workspace["other_machine"].id,
            description="Programm 0815",
        )
    )
    await service.create(
        _data(workspace, article_number="01090000", name="Zebra", plant_id=workspace["other_plant"].id)
    )
    await service.create(_data(workspace, article_number="02000000", name=None))
    await service.create(_data(workspace, article_number="02000001", name="Alpha"))
    return workspace


async def test_liste_suche_ueber_alle_felder(bestand):
    service = bestand["service"]

    async def zahlen(term):
        items, total = await service.get_all(search=term)
        return total, [item.article_number for item in items]

    assert await zahlen("01075000") == (1, ["01075000"])  # Artikelnummer
    assert await zahlen("Zebra") == (1, ["01090000"])  # Name
    assert await zahlen("4711") == (1, ["01075000"])  # Beschreibung
    assert await zahlen("Werk 2") == (1, ["01090000"])  # Werk
    assert await zahlen("ECO") == (1, ["01075000"])  # Kunde
    assert await zahlen("TruMatic 5000") == (1, ["01080000"])  # Maschine


async def test_liste_filter(bestand):
    service = bestand["service"]

    _, nur_werk_1 = await service.get_all(plant_id=bestand["plant"].id)
    assert nur_werk_1 == 4

    items, total = await service.get_all(customer_id=bestand["customer"].id)
    assert total == 1 and items[0].article_number == "01075000"

    items, total = await service.get_all(machine_id=bestand["other_machine"].id)
    assert total == 1 and items[0].article_number == "01080000"

    _, mit_pdf = await service.get_all(has_pdf=True)
    assert mit_pdf == 1

    _, ohne_pdf = await service.get_all(has_pdf=False)
    assert ohne_pdf == 4


async def test_liste_sortiert_name_mit_null_last(bestand):
    service = bestand["service"]

    items, _ = await service.get_all(sort="name", order="asc")
    assert [item.name for item in items] == [
        "Alpha",
        "Quadrat 4.0",
        "Rund 2.5 ALU",
        "Zebra",
        None,
    ], "Leere Namen stehen am Ende (NULLS LAST)"


async def test_liste_pagination_ist_stabil(bestand):
    service = bestand["service"]

    alle, total = await service.get_all(sort="customer", limit=10)
    assert total == 5

    # Gleichstand beim Kunden (alle ohne Kunde) -> Tiebreaker id, damit dieselbe
    # Zeile nicht zwischen zwei Seiten wandert.
    seite_1, _ = await service.get_all(sort="customer", skip=0, limit=2)
    seite_2, _ = await service.get_all(sort="customer", skip=2, limit=2)
    seite_3, _ = await service.get_all(sort="customer", skip=4, limit=2)

    ids_gesamt = [item.id for item in alle]
    ids_seiten = [item.id for item in seite_1 + seite_2 + seite_3]
    assert ids_seiten == ids_gesamt


async def test_liste_default_sortierung_ist_die_artikelnummer(bestand):
    service = bestand["service"]
    items, _ = await service.get_all()
    assert [item.article_number for item in items] == sorted(
        [item.article_number for item in items]
    )


# ----------------------------------------------------------------------
# Favoriten (DEC-063)
# ----------------------------------------------------------------------
async def test_favorit_setzen_und_filtern(bestand):
    service = bestand["service"]
    items, _ = await service.get_all()
    artikel = items[0]

    gesetzt = await service.set_favorite(artikel.id, True)
    assert gesetzt is not None and gesetzt.is_favorite is True

    nur_favoriten, total = await service.get_all(favorites_only=True)
    assert total == 1
    assert nur_favoriten[0].id == artikel.id

    wieder_weg = await service.set_favorite(artikel.id, False)
    assert wieder_weg is not None and wieder_weg.is_favorite is False
    _, total_danach = await service.get_all(favorites_only=True)
    assert total_danach == 0


async def test_favorit_ueberlebt_das_bearbeiten(bestand):
    """Ein normales Bearbeiten darf die Markierung nicht zurücksetzen."""
    service = bestand["service"]
    items, _ = await service.get_all()
    artikel = items[0]
    await service.set_favorite(artikel.id, True)

    geaendert = await service.update(artikel.id, {"name": "Neuer Name"})

    assert geaendert is not None
    assert geaendert.name == "Neuer Name"
    assert geaendert.is_favorite is True


async def test_favorit_unbekannte_id_gibt_none(workspace):
    service = workspace["service"]
    assert await service.set_favorite(9999, True) is None


# ----------------------------------------------------------------------
# Bilder zum Plan (DEC-058)
# ----------------------------------------------------------------------
async def test_create_legt_bilder_ab(workspace):
    service = workspace["service"]
    article = await service.create(
        _data(workspace),
        _upload(),
        image_files=[
            _image("foto.jpg", b"jpeg-inhalt"),
            _image("skizze.PNG", b"png-inhalt"),
        ],
    )

    folder = workspace["root"] / "01075000"
    assert (folder / "bild-1.jpg").read_bytes() == b"jpeg-inhalt"
    assert (folder / "bild-2.png").read_bytes() == b"png-inhalt"

    bilder = service.list_images(article)
    assert [entry["name"] for entry in bilder] == ["bild-1.jpg", "bild-2.png"]
    assert [entry["kind"] for entry in bilder] == ["image", "image"]
    assert bilder[0]["size"] == len(b"jpeg-inhalt")


async def test_bilder_kommen_hinzu_und_ueberschreiben_nichts(workspace):
    """Beim Ändern werden Bilder ergänzt – der Plan wird ersetzt, Bilder nicht."""
    service = workspace["service"]
    article = await service.create(_data(workspace), image_files=[_image("a.jpg")])

    await service.update(article.id, {}, image_files=[_image("b.jpg")])
    frisch = await service.get(article.id)

    assert [entry["name"] for entry in service.list_images(frisch)] == [
        "bild-1.jpg",
        "bild-2.jpg",
    ]
    assert (workspace["root"] / "01075000" / "bild-1.jpg").is_file()


async def test_bilder_werden_nach_nummer_sortiert(workspace):
    """`bild-2` vor `bild-10`: sortiert wird nach der Zahl, nicht nach Text."""
    service = workspace["service"]
    article = await service.create(_data(workspace))

    for index in range(1, 11):
        await service.update(
            article.id, {}, image_files=[_image(f"foto{index}.jpg", b"x")]
        )

    frisch = await service.get(article.id)
    namen = [entry["name"] for entry in service.list_images(frisch)]
    assert namen == [f"bild-{index}.jpg" for index in range(1, 11)]


async def test_bild_mit_falscher_endung_abgelehnt(workspace):
    service = workspace["service"]
    with pytest.raises(ValueError, match="kein Bild"):
        await service.create(_data(workspace), image_files=[_image("notizen.txt")])

    # Kein halber Zustand: Ordner und Zeile entstehen nicht.
    assert not (workspace["root"] / "01075000").exists()
    assert await service.crud.get_by_article_number("01075000") is None


async def test_bild_loeschen_laesst_den_plan_stehen(workspace):
    service = workspace["service"]
    article = await service.create(
        _data(workspace), _upload(), image_files=[_image("a.jpg")]
    )

    assert await service.delete_file(article, "bild-1.jpg") is True
    frisch = await service.get(article.id)

    assert service.list_images(frisch) == []
    assert (workspace["root"] / "01075000" / PLAN_FILE_NAME).is_file()
    assert frisch.has_pdf is True
    assert await service.delete_file(frisch, "bild-1.jpg") is False


async def test_plan_ist_einzeln_loeschbar(workspace):
    """Seit DEC-062 ist auch der Einrichteplan einzeln entfernbar."""
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload())

    assert await service.delete_file(article, PLAN_FILE_NAME) is True
    assert not (workspace["root"] / "01075000" / PLAN_FILE_NAME).exists()
    frisch = await service.get(article.id)
    assert frisch.has_pdf is False


async def test_artikel_loeschen_entfernt_auch_bilder(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload(), image_files=[_image("a.jpg")])

    assert await service.delete(article.id) is True
    assert not (workspace["root"] / "01075000").exists()


@pytest.mark.parametrize(
    "name",
    [
        "../plan.pdf",
        "unter/ordner.jpg",
        "..\\bild-1.jpg",
        "",
        "plan.txt",
        "geheim.jpg.exe",
    ],
)
async def test_resolve_article_file_verhindert_ausbruch(workspace, name):
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload(), image_files=[_image("a.jpg")])

    assert service.resolve_article_file(article, name) is None


async def test_resolve_article_file_findet_plan_und_bild(workspace):
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload(), image_files=[_image("a.jpg")])

    assert service.resolve_article_file(article, PLAN_FILE_NAME) is not None
    bild = service.resolve_article_file(article, "bild-1.jpg")
    assert bild is not None and bild.is_file()


@pytest.mark.parametrize(
    ("name", "erwartet"),
    [("bild-1.jpg", "image/jpeg"), ("bild-1.png", "image/png"), ("plan.pdf", "application/pdf")],
)
async def test_media_type_kommt_aus_der_endung(name, erwartet):
    from app.services.serial_article_service import SerialArticleService

    assert SerialArticleService.media_type_for(Path(name)) == erwartet


# ----------------------------------------------------------------------
# Vorschaubilder in fester Größe (DEC-059)
# ----------------------------------------------------------------------
def _png_bytes(width: int, height: int) -> bytes:
    """Ein echtes PNG in der gewünschten Größe (für die Vorschautrechnung)."""
    from PIL import Image as _Image

    buffer = io.BytesIO()
    _Image.new("RGB", (width, height), (12, 118, 110)).save(buffer, "PNG")
    return buffer.getvalue()


async def test_vorschau_wird_in_fester_groesse_erzeugt(workspace):
    from app.services.serial_article_service import THUMB_MAX_SIZE

    service = workspace["service"]
    article = await service.create(
        _data(workspace), image_files=[_image("gross.png", _png_bytes(1200, 800))]
    )

    thumb = service.thumbnail_path(article, "bild-1.png")
    assert thumb is not None and thumb.is_file()

    from PIL import Image as _Image

    with _Image.open(thumb) as bild:
        assert max(bild.size) <= max(THUMB_MAX_SIZE)
        assert bild.size == (400, 267), "Seitenverhältnis bleibt erhalten"
    # Der Zwischenspeicher liegt im Artikelordner und zählt nicht als Bild.
    assert thumb.parent.name == ".thumbs"
    frisch = await service.get(article.id)
    assert [entry["name"] for entry in service.list_images(frisch)] == ["bild-1.png"]


async def test_vorschau_wird_nur_einmal_gerechnet(workspace):
    service = workspace["service"]
    article = await service.create(
        _data(workspace), image_files=[_image("gross.png", _png_bytes(800, 600))]
    )

    erst = service.thumbnail_path(article, "bild-1.png")
    zweit = service.thumbnail_path(article, "bild-1.png")
    assert erst == zweit
    assert erst is not None and erst.stat().st_size > 0


async def test_vorschau_fuer_den_plan_gibt_es_nicht(workspace):
    """Der Einrichteplan hat keine Vorschau – er wird im iframe gezeigt."""
    service = workspace["service"]
    article = await service.create(_data(workspace), _upload())

    assert service.thumbnail_path(article, PLAN_FILE_NAME) is None
    assert service.thumbnail_path(article, "gibts-nicht.png") is None


async def test_bild_loeschen_entfernt_auch_die_vorschau(workspace):
    service = workspace["service"]
    article = await service.create(
        _data(workspace), image_files=[_image("gross.png", _png_bytes(600, 400))]
    )

    thumb = service.thumbnail_path(article, "bild-1.png")
    assert thumb is not None and thumb.is_file()

    assert await service.delete_file(article, "bild-1.png") is True
    assert not thumb.exists(), "Die Vorschau darf nicht verwaist liegen bleiben"


async def test_unlesbares_bild_liefert_das_original(workspace):
    """Ohne lesbaren Inhalt kommt das Original zurück – kein Fehler (DEC-059)."""
    service = workspace["service"]
    article = await service.create(
        _data(workspace), image_files=[_image("kaputt.png", b"kein echtes Bild")]
    )

    thumb = service.thumbnail_path(article, "bild-1.png")
    assert thumb is not None
    assert thumb.name == "bild-1.png", "Kein Vorschaubild, sondern das Original"
