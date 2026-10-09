"""Datenblätter: Ablage und Geschäftslogik (DEC-065).

Ein Datenblatt ist ein PDF mit den **Einstellwerten eines Werkzeugs für eine
Maschine**. Die Dateien liegen in einem **eigenen Ordner je Datensatz**:

    uploads/data_sheets/<id>/plan.pdf, plan-2.pdf …   (Datenblätter)
    uploads/data_sheets/<id>/bild-1.jpg, bild-2.png … (Bilder)
    uploads/data_sheets/<id>/.thumbs/<name>.jpg       (Zwischenspeicher)

Der Ordner ist nach der **Datensatz-ID** benannt (nicht nach der Werkzeug-ID):
die Werkzeug-ID ist weder eindeutig (DEC-052) noch Pflicht (DEC-055) und ändert
sich beim Umbenennen – als Ordnername unbrauchbar.

Die Dateiliste wird aus dem Ordner gelesen; es gibt keine eigenen Spalten dafür.
`data_sheets.pdf_path` zeigt auf das **erste** Datenblatt (für `has_pdf`) und
wird bei jeder Änderung nachgeführt.

> **Bewusst eigenständig:** Diese Ablage-Logik ist der des Serienartikels
> (`serial_article_service.py`) sehr ähnlich, teilt sie aber **nicht**. Die
> Serienartikel-Logik ist mit 66 Tests abgesichert und bleibt für dieses Feature
> unangetastet (DEC-065 Punkt 12) – lieber etwas Doppelung als ein Eingriff in
> einen laufenden Bereich.
"""

import mimetypes
import os
import shutil
from pathlib import Path
from typing import Iterable, List, Optional, Tuple, Union

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile as StarletteUploadFile

from ..crud.crud_data_sheet import (
    CRUDDataSheet,
    DataSheetSortKey,
    DataSheetSortOrder,
)
from ..models.data_sheet import DataSheet
from ..models.master_data import Machine, Plant

try:  # Bildbibliothek ist optional: ohne sie wird das Original ausgeliefert.
    from PIL import Image
except ImportError:  # pragma: no cover – Ablage und Anzeige funktionieren auch so
    Image = None  # type: ignore[assignment]

# Basisordner der Ablage: das **Backend-Verzeichnis**, nicht das
# Arbeitsverzeichnis des Prozesses (sonst hängt die Auslieferung daran, aus
# welchem Ordner der Server gestartet wurde).
BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_SUBDIR = Path("uploads") / "data_sheets"


def upload_root() -> Path:
    """Wurzel der Ablage; über `TOOLSYNC_UPLOAD_DIR` übersteuerbar (Tests).

    Dieselbe Funktion wie in `serial_article_service.py` – beide Bereiche legen
    ihre Ordner unter `uploads/` ab.
    """
    override = os.getenv("TOOLSYNC_UPLOAD_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return BACKEND_DIR / UPLOAD_SUBDIR

# Datenblätter liegen als `plan.pdf` (erstes) und `plan-2.pdf`, `plan-3.pdf` …
# Mehrere Datenblätter je Datensatz sind möglich (andere Auflage, andere
# Maschine, andere Version) – dieselbe Namenslogik wie bei den Serienartikeln.
PLAN_FILE_NAME = "plan.pdf"
PLAN_PREFIX = "plan-"

# Bilder: fortlaufender Name im Ordner (`bild-1.jpg`, `bild-2.png` …). Geprüft
# wird nur die Endung (wie beim Serienartikel, DEC-058).
IMAGE_PREFIX = "bild-"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic", ".heif"}

# Vorschaubilder in **fester Größe**: einmal erzeugt und im Unterordner `.thumbs`
# abgelegt. Der Ordner ist ein Zwischenspeicher – er zählt nicht als Datei des
# Datensatzes und verschwindet mit dem Ordner (dieselbe Mechanik wie DEC-059).
THUMB_DIR_NAME = ".thumbs"
THUMB_MAX_SIZE = (400, 400)
THUMB_QUALITY = 80

UploadInput = Union[UploadFile, Iterable[UploadFile], None]


def _as_file_list(files: UploadInput) -> List[UploadFile]:
    """Eingabe zu einer Liste machen: eine Datei, mehrere oder nichts.

    Geprüft wird gegen die **Starlette**-Klasse: FastAPIs `UploadFile` ist eine
    Unterklasse davon, eine Prüfung gegen die FastAPI-Klasse würde die in Tests
    erzeugten Objekte nicht erkennen (dieselbe Überlegung wie im
    Serienartikel-Service).
    """
    if files is None:
        return []
    if isinstance(files, StarletteUploadFile):
        return [files]
    return [file for file in files if file is not None]


def is_plan_name(name: str) -> bool:
    """Ist das der Dateiname eines Datenblatts? (`plan.pdf`, `plan-2.pdf` …)"""
    lowered = (name or "").lower()
    if lowered == PLAN_FILE_NAME:
        return True
    if not lowered.endswith(".pdf"):
        return False
    stem = Path(lowered).stem
    return stem.startswith(PLAN_PREFIX) and stem[len(PLAN_PREFIX) :].isdigit()


def is_image_name(name: str) -> bool:
    """Ist das der Dateiname eines Bildes? (Endung entscheidet, DEC-058)"""
    return Path(name or "").suffix.lower() in IMAGE_EXTENSIONS


def _plan_index(name: str) -> int:
    """Reihenfolge der Datenblätter: `plan.pdf` = 1, `plan-2.pdf` = 2 …"""
    stem = Path((name or "").lower()).stem
    if stem == Path(PLAN_FILE_NAME).stem:
        return 1
    digits = stem[len(PLAN_PREFIX) :]
    return int(digits) if digits.isdigit() else 0


class DataSheetService:
    def __init__(self, db: AsyncSession, root: Optional[Path] = None) -> None:
        self.db = db
        self.crud = CRUDDataSheet(db)
        # Ablageort: `root` gewinnt (Tests), sonst `TOOLSYNC_UPLOAD_DIR`, sonst
        # `backend/uploads`.
        #
        # **Der `root`-Parameter wurde vorher ignoriert**: hier stand
        # `Path(base).resolve() if base else (BACKEND_DIR / "uploads")` mit
        # `base` aus der Umgebungsvariable – `root` kam nicht vor. Die Tests
        # reichten deshalb einen temporären Ordner herein und schrieben in die
        # **echte** Ablage: in `backend/uploads/data_sheets/1` lagen danach sechs
        # `plan*.pdf` aus Testläufen. `SerialArticleService` machte es von Anfang
        # an richtig; hier ist es jetzt genauso.
        self.root = Path(root).resolve() if root is not None else upload_root()
        self.root.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Lesen
    # ------------------------------------------------------------------
    async def get(self, id: int) -> Optional[DataSheet]:
        return await self.crud.get(id)

    async def get_all(
        self,
        search: Optional[str] = None,
        tool_id: Optional[str] = None,
        plant_id: Optional[int] = None,
        machine_id: Optional[int] = None,
        has_pdf: Optional[bool] = None,
        favorites_only: bool = False,
        sort: DataSheetSortKey = "tool_id",
        order: DataSheetSortOrder = "asc",
        skip: int = 0,
        limit: int = 25,
    ):
        return await self.crud.get_multi(
            search=search,
            tool_id=tool_id,
            plant_id=plant_id,
            machine_id=machine_id,
            has_pdf=has_pdf,
            favorites_only=favorites_only,
            sort=sort,
            order=order,
            skip=skip,
            limit=limit,
        )

    async def count_by_tool_id(
        self, tool_id: str, exclude_id: Optional[int] = None
    ) -> int:
        return await self.crud.count_by_tool_id(tool_id, exclude_id)

    async def set_favorite(
        self, id: int, is_favorite: bool
    ) -> Optional[DataSheet]:
        return await self.crud.set_favorite(id, is_favorite)

    # ------------------------------------------------------------------
    # Pfade und Ordner
    # ------------------------------------------------------------------
    def sheet_dir(self, sheet_id: int) -> Path:
        """Ordner eines Datensatzes (nach der **ID**, siehe Modulkopf)."""
        return self.root / UPLOAD_SUBDIR.name / str(sheet_id)

    def _is_inside_root(self, path: Path) -> bool:
        try:
            path.resolve().relative_to(self.root)
        except ValueError:
            return False
        return True

    def _stored_path(self, folder: Path, file_name: str) -> str:
        """Pfad, wie er in der Datenbank steht (relativ, mit `/` als Trenner)."""
        return (UPLOAD_SUBDIR / folder.name / file_name).as_posix()

    def _ensure_sheet_dir(self, sheet_id: int) -> Path:
        folder = self.sheet_dir(sheet_id)
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def _remove_dir(self, folder: Path) -> None:
        """Ordner samt Inhalt entfernen – nur innerhalb der Ablage."""
        if not self._is_inside_root(folder):
            return
        shutil.rmtree(folder, ignore_errors=True)

    def resolve_file(self, sheet: DataSheet, name: str) -> Optional[Path]:
        """Eine Datei des Datensatzes auflösen – `None`, wenn sie nicht zulässig ist.

        Nur der reine Dateiname ist erlaubt (`..`, `/`, `\\` werden abgewiesen),
        die Datei muss im Ordner liegen und eine bekannte Rolle haben: ein
        Datenblatt (`plan.pdf`, `plan-2.pdf` …) oder ein Bild.
        """
        if not name or Path(name).name != name:
            return None
        candidate = (self.sheet_dir(sheet.id) / name).resolve()
        if not self._is_inside_root(candidate) or not candidate.is_file():
            return None
        if is_plan_name(candidate.name) or is_image_name(candidate.name):
            return candidate
        return None

    @staticmethod
    def media_type_for(path: Path) -> str:
        """MIME-Typ aus der Dateiendung (für die Auslieferung)."""
        guessed, _ = mimetypes.guess_type(path.name)
        return guessed or "application/octet-stream"

    def _plan_names(self, folder: Path) -> List[str]:
        """Vorhandene Datenblatt-Dateien, nach Nummer sortiert."""
        if not folder.is_dir():
            return []
        return sorted(
            (
                path.name
                for path in folder.iterdir()
                if path.is_file() and is_plan_name(path.name)
            ),
            key=lambda name: (_plan_index(name), name),
        )

    def _next_plan_name(self, folder: Path) -> str:
        """Namen für das nächste Datenblatt: `plan.pdf`, dann `plan-2.pdf` …"""
        vorhandene = self._plan_names(folder)
        if not vorhandene:
            return PLAN_FILE_NAME

        used = {_plan_index(name) for name in vorhandene}
        index = 2
        while index in used:
            index += 1
        return f"{PLAN_PREFIX}{index}.pdf"

    def _first_plan_path(self, folder: Path) -> Optional[str]:
        """Relativer Pfad des ersten Datenblatts – oder None, wenn es keines gibt."""
        namen = self._plan_names(folder)
        return self._stored_path(folder, namen[0]) if namen else None

    def list_files(self, sheet: DataSheet) -> Tuple[List[dict], List[dict]]:
        """Alle Dateien aus dem Ordner des Datensatzes lesen (ohne Datenbank).

        Rückgabe: (Datenblätter, Bilder). Datenblätter sind nach ihrer Nummer
        sortiert (`plan.pdf` = 1, dann `plan-2.pdf` …), Bilder nach der Zahl im
        Namen (`bild-2` vor `bild-10` – Textsortierung wäre dort falsch).
        """
        return self._list_files_in(self.sheet_dir(sheet.id))

    def list_images(self, sheet: DataSheet) -> List[dict]:
        """Nur die Bilder des Datensatzes (Bequemlichkeit für Aufrufer und Tests)."""
        _, images = self.list_files(sheet)
        return images

    def _list_files_in(self, folder: Path) -> Tuple[List[dict], List[dict]]:
        plans: List[dict] = []
        images: List[dict] = []
        if not folder.is_dir():
            return plans, images

        for path in folder.iterdir():
            if not path.is_file():
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if is_plan_name(path.name):
                plans.append({"name": path.name, "size": size, "kind": "plan"})
            elif is_image_name(path.name):
                images.append({"name": path.name, "size": size, "kind": "image"})

        plans.sort(key=lambda entry: (_plan_index(entry["name"]), entry["name"]))
        images.sort(key=lambda entry: self._image_sort_key(entry["name"]))
        return plans, images

    @staticmethod
    def _image_sort_key(name: str) -> Tuple[int, str]:
        """`bild-2` vor `bild-10`: nach Zahl sortieren, nicht nach Text."""
        stem = Path(name).stem
        digits = "".join(char for char in stem if char.isdigit())
        return (int(digits) if digits else 0, name)

    # ------------------------------------------------------------------
    # Vorschaubilder (feste Größe)
    # ------------------------------------------------------------------
    def thumbnail_path(self, sheet: DataSheet, name: str) -> Optional[Path]:
        """Vorschaubild in fester Größe liefern – erzeugt und merkt es sich.

        Die Vorschau wird **einmal** erzeugt (`THUMB_MAX_SIZE`, JPEG) und unter
        `.thumbs` im Ordner des Datensatzes abgelegt; weitere Aufrufe liefern die
        Datei direkt. Gibt es keine Bildbibliothek, ist das Bild nicht lesbar
        (z. B. HEIC ohne Zusatzpaket) oder schlägt das Schreiben fehl, kommt das
        **Original** zurück – die Anzeige funktioniert also immer.
        """
        source = self.resolve_file(sheet, name)
        if source is None or is_plan_name(source.name):
            # Ein Datenblatt hat keine Vorschau: es läuft im iframe; sein Symbol
            # in der Dateiliste ist ein Icon.
            return None
        if Image is None:
            return source

        cache_dir = self.sheet_dir(sheet.id) / THUMB_DIR_NAME
        target = cache_dir / f"{source.stem}.jpg"
        try:
            if target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
                return target
            cache_dir.mkdir(parents=True, exist_ok=True)
            with Image.open(source) as bild:
                # JPEG kennt keine Transparenz – PNG/WEBP mit Alpha umwandeln.
                vorschau = bild.convert("RGB")
                vorschau.thumbnail(THUMB_MAX_SIZE)
                vorschau.save(target, "JPEG", quality=THUMB_QUALITY, optimize=True)
            return target
        except Exception:
            return source

    def _remove_thumbnail(self, folder: Path, image_name: str) -> None:
        """Zwischenspeicher zum Bild mitentfernen (sonst bleibt er verwaist)."""
        thumb = folder / THUMB_DIR_NAME / f"{Path(image_name).stem}.jpg"
        try:
            thumb.unlink(missing_ok=True)
        except OSError:
            pass

    # ------------------------------------------------------------------
    # Schreiben
    # ------------------------------------------------------------------
    async def create(
        self,
        data,
        pdf_files: UploadInput = None,
        image_files: Optional[Iterable[UploadFile]] = None,
    ) -> DataSheet:
        """Datensatz anlegen: Zeile, dann Ordner, dann Dateien.

        Der Ordner entsteht **immer** – auch ohne Datei (dort liegen die
        Datenblätter, die später dazukommen). Scheitert das Schreiben, wird die
        eben angelegte Zeile samt Ordner wieder entfernt: kein halber Zustand.
        """
        await self._assert_master_data(data.plant_id, data.machine_id)

        sheet = await self.crud.create_sheet(data)
        folder = self._ensure_sheet_dir(sheet.id)
        try:
            await self._write_plans(folder, pdf_files)
            await self._write_images(folder, image_files)
            return await self._sync(sheet, folder)
        except Exception:
            self._remove_dir(folder)
            await self.crud.delete(sheet.id)
            raise

    async def update(
        self,
        id: int,
        values: dict,
        pdf_files: UploadInput = None,
        image_files: Optional[Iterable[UploadFile]] = None,
    ) -> Optional[DataSheet]:
        """Datensatz ändern und mitgeschickte Dateien **ergänzen**.

        Eine mitgeschickte Datei ersetzt keine andere; entfernt wird einzeln über
        `delete_file()` (wie beim Serienartikel, DEC-062).
        """
        sheet = await self.crud.get(id)
        if sheet is None:
            return None

        await self._assert_master_data(values.get("plant_id"), values.get("machine_id"))

        folder = self._ensure_sheet_dir(sheet.id)
        await self._write_plans(folder, pdf_files)
        await self._write_images(folder, image_files)
        sheet = await self.crud.apply_update(sheet, values)
        return await self._sync(sheet, folder)

    async def delete(self, id: int) -> bool:
        """Datensatz, seine Dateien und seinen Ordner entfernen."""
        sheet = await self.crud.get(id)
        if sheet is None:
            return False
        folder = self.sheet_dir(sheet.id)
        await self.crud.delete(id)
        self._remove_dir(folder)
        return True

    async def delete_file(self, sheet: DataSheet, name: str) -> bool:
        """Ein Datenblatt oder Bild entfernen. `False`, wenn es die Datei nicht gibt.

        Danach wird `pdf_path` nachgeführt: zeigt es auf die gelöschte Datei,
        rückt das nächste Datenblatt nach – oder das Feld wird geleert und
        `has_pdf` ist falsch.
        """
        path = self.resolve_file(sheet, name)
        if path is None:
            return False
        try:
            path.unlink()
        except OSError:
            return False
        if is_plan_name(path.name):
            await self._sync(sheet, path.parent)
        else:
            self._remove_thumbnail(path.parent, path.name)
        return True

    async def _write_plans(self, folder: Path, files: UploadInput) -> List[str]:
        """Mitgeschickte Dateien ablegen (`plan.pdf`, `plan-2.pdf` …).

        Geprüft wird nur die **Dateiendung** – keine Größe, kein MIME-Typ
        (`docs/01-requirements.md` 6.3 gilt sinngemäß, DEC-065 Punkt 8).
        """
        written: List[str] = []
        eingaben = _as_file_list(files)
        if not eingaben:
            return written

        folder.mkdir(parents=True, exist_ok=True)
        for file in eingaben:
            if not file.filename:
                continue
            if Path(file.filename).suffix.lower() != ".pdf":
                raise ValueError("Bitte eine PDF-Datei auswählen.")
            name = self._next_plan_name(folder)
            (folder / name).write_bytes(await file.read())
            written.append(name)
        return written

    async def _write_images(
        self, folder: Path, files: Optional[Iterable[UploadFile]]
    ) -> List[str]:
        """Mitgeschickte Bilder in den Ordner legen (`bild-1.jpg`, `bild-2.png` …).

        Namen werden fortlaufend vergeben, damit gleichnamige Handyfotos einander
        nicht überschreiben. Geprüft wird die **Dateiendung** – wie beim
        Datenblatt ohne Größen- und Inhaltsprüfung.
        """
        written: List[str] = []
        if not files:
            return written

        folder.mkdir(parents=True, exist_ok=True)
        for file in files:
            if file is None or not file.filename:
                continue
            extension = Path(file.filename).suffix.lower()
            if extension not in IMAGE_EXTENSIONS:
                raise ValueError(
                    f"„{file.filename}“ ist kein Bild. Erlaubt sind "
                    "JPG, PNG, WEBP, GIF, BMP und HEIC."
                )
            name = self._next_image_name(folder, extension)
            (folder / name).write_bytes(await file.read())
            written.append(name)
        return written

    def _next_image_name(self, folder: Path, extension: str) -> str:
        """Ersten freien Bildnamen im Ordner finden (`bild-<n><.ext>`).

        Gezählt wird über **alle** vorhandenen Bilder, nicht nur über die der
        eigenen Endung: sonst hieße das zweite Bild (`skizze.PNG`) neben
        `bild-1.jpg` ebenfalls `bild-1.png`.
        """
        used: set[int] = set()
        for path in folder.iterdir():
            if not path.is_file() or not path.stem.startswith(IMAGE_PREFIX):
                continue
            digits = path.stem[len(IMAGE_PREFIX) :]
            if digits.isdigit():
                used.add(int(digits))

        index = 1
        while index in used:
            index += 1
        return f"{IMAGE_PREFIX}{index}{extension}"

    async def _sync(self, sheet: DataSheet, folder: Path) -> DataSheet:
        """`pdf_path` an die vorhandenen Dateien angleichen und speichern."""
        pdf_path = self._first_plan_path(folder)
        if pdf_path != sheet.pdf_path:
            sheet = await self.crud.set_pdf_path(sheet, pdf_path)
        return sheet

    # ------------------------------------------------------------------
    # Stammdaten
    # ------------------------------------------------------------------
    async def _assert_master_data(
        self, plant_id: Optional[int], machine_id: Optional[int]
    ) -> None:
        """Werk muss existieren; die Maschine, wenn sie angegeben ist.

        Ohne diese Prüfung käme bei einer gelöschten Maschine ein
        Fremdschlüsselfehler aus der Datenbank als HTTP 500 zurück.
        """
        if plant_id is None:
            raise ValueError("Bitte ein Werk auswählen.")

        plant = await self.db.get(Plant, plant_id)
        if plant is None:
            raise ValueError("Das gewählte Werk gibt es nicht mehr. Lade die Seite neu.")

        if machine_id is not None:
            machine = await self.db.get(Machine, machine_id)
            if machine is None:
                raise ValueError(
                    "Die gewählte Maschine gibt es nicht mehr. Lade die Seite neu."
                )
