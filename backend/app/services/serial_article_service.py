"""Serienartikel: Dateiablage und Geschäftslogik.

Alle Dateien eines Artikels liegen in einem **eigenen Ordner je Artikel**
(`uploads/serial_articles/<Artikelnummer>/`, DEC-057):

- Einrichtepläne: `plan.pdf` (Altbestand, zählt als erster Plan) und
  `plan-2.pdf`, `plan-3.pdf` … – **mehrere Pläne je Artikel** sind möglich
  (DEC-062).
- Bilder: `bild-1.jpg`, `bild-2.png` … (DEC-058).
- Vorschaubilder: `.thumbs/<name>.jpg` – Zwischenspeicher (DEC-059).

Die Dateiliste wird aus dem Ordner gelesen; es gibt keine eigenen
Datenbankspalten dafür. `serial_articles.pdf_path` zeigt auf den **ersten**
Plan (für `GET /{id}/pdf` und `has_pdf`) und wird bei jeder Änderung
nachgeführt.
"""

import mimetypes
import os
import shutil
from pathlib import Path
from typing import Iterable, List, Optional, Tuple, Union

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import UploadFile as StarletteUploadFile

from ..crud.crud_serial_article import (
    CRUDSerialArticle,
    SerialArticleSortKey,
    SerialArticleSortOrder,
)
from ..models.master_data import Customer, Machine, Plant
from ..models.serial_article import SerialArticle

try:  # Bildbibliothek ist optional: ohne sie wird das Original ausgeliefert.
    from PIL import Image
except ImportError:  # pragma: no cover – Ablage und Anzeige funktionieren auch so
    Image = None  # type: ignore[assignment]

# Basisordner der Ablage: das **Backend-Verzeichnis**, nicht das Arbeitsverzeichnis
# des Prozesses. Vorher hing die PDF-Auslieferung daran, aus welchem Ordner der
# Server gestartet wurde – ein Start von woanders ergab HTTP 404
# (`docs/06-serial-articles.md` §6).
BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_SUBDIR = Path("uploads") / "serial_articles"

# Einrichtepläne: der Altbestand liegt als `plan.pdf` (zählt als erster Plan),
# weitere Pläne heißen `plan-2.pdf`, `plan-3.pdf` … (DEC-062).
PLAN_FILE_NAME = "plan.pdf"
PLAN_PREFIX = "plan-"

# Bilder zum Plan: fortlaufender Name im Artikelordner. Der Präfix hält sie
# auseinander und macht sie im Ordner als Bilder erkennbar.
IMAGE_PREFIX = "bild-"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic", ".heif"}

# Vorschaubilder in **fester Größe** (DEC-059): einmal erzeugt und im Unterordner
# `.thumbs` des Artikelordners abgelegt. Der Ordner ist ein Zwischenspeicher –
# er zählt nicht als Datei des Artikels und verschwindet mit dem Artikelordner.
THUMB_DIR_NAME = ".thumbs"
THUMB_MAX_SIZE = (400, 400)
THUMB_QUALITY = 80

# Ordnername, wenn die Artikelnummer keinen brauchbaren Namen hergibt.
FALLBACK_FOLDER = "artikel"

UploadInput = Union[UploadFile, Iterable[UploadFile], None]


def _as_file_list(files: UploadInput) -> List[UploadFile]:
    """Eingabe zu einer Liste machen: eine Datei, mehrere oder nichts.

    Der Service nimmt aus historischen Gründen auch eine **einzelne**
    `UploadFile` entgegen – so bleiben bestehende Aufrufe gültig (DEC-062).
    Geprüft wird gegen die Starlette-Klasse: FastAPIs `UploadFile` ist eine
    Unterklasse davon, eine Prüfung gegen die FastAPI-Klasse würde die vom Test
    erzeugten Objekte nicht erkennen.
    """
    if files is None:
        return []
    if isinstance(files, StarletteUploadFile):
        return [files]
    return [file for file in files if file is not None]


def is_plan_name(name: str) -> bool:
    """Ist das der Dateiname eines Einrichteplans? (`plan.pdf`, `plan-2.pdf` …)"""
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
    """Reihenfolge der Pläne: `plan.pdf` = 1, `plan-2.pdf` = 2 …"""
    stem = Path((name or "").lower()).stem
    if stem == Path(PLAN_FILE_NAME).stem:
        return 1
    digits = stem[len(PLAN_PREFIX) :]
    return int(digits) if digits.isdigit() else 0

# Namen, die Windows nicht als Ordner zulässt (CON, NUL, COM1 …).
_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}


def upload_root() -> Path:
    """Wurzel der Ablage; über `TOOLSYNC_UPLOAD_DIR` übersteuerbar (Tests)."""
    override = os.getenv("TOOLSYNC_UPLOAD_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return BACKEND_DIR / UPLOAD_SUBDIR


def sanitize_folder_name(article_number: str) -> str:
    """Ordnernamen aus der Artikelnummer bilden (DEC-057).

    Alle Zeichen außer Buchstaben, Ziffern, `.`, `-` und `_` werden zu `_`.
    Der Name wird nie aus ungeprüftem Text gebildet: `/`, `\\` und `..` können so
    nicht in den Pfad geraten. Bleibt nichts übrig, heißt der Ordner `artikel`.
    """
    cleaned = "".join(
        char if char.isalnum() or char in ".-_" else "_"
        for char in (article_number or "").strip()
    )
    # Führende/abschließende Punkte entfernen: sonst entstünde aus ".." ein
    # Ordner mit Sonderbedeutung und aus ".abc" ein versteckter Ordner.
    cleaned = cleaned.strip("._-")
    if not cleaned:
        return FALLBACK_FOLDER
    if cleaned.upper() in _RESERVED_NAMES:
        return f"{FALLBACK_FOLDER}_{cleaned}"
    return cleaned


class SerialArticleService:
    def __init__(self, db: AsyncSession, root: Optional[Path] = None) -> None:
        self.db = db
        self.crud = CRUDSerialArticle(db)
        self.root = Path(root).resolve() if root is not None else upload_root()

    # ------------------------------------------------------------------
    # Lesen
    # ------------------------------------------------------------------
    async def get(self, id: int) -> Optional[SerialArticle]:
        return await self.crud.get(id)

    async def get_all(
        self,
        search: Optional[str] = None,
        plant_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        machine_id: Optional[int] = None,
        has_pdf: Optional[bool] = None,
        favorites_only: bool = False,
        sort: SerialArticleSortKey = "article_number",
        order: SerialArticleSortOrder = "asc",
        skip: int = 0,
        limit: int = 25,
    ) -> Tuple[List[SerialArticle], int]:
        return await self.crud.get_multi(
            search=search,
            plant_id=plant_id,
            customer_id=customer_id,
            machine_id=machine_id,
            has_pdf=has_pdf,
            favorites_only=favorites_only,
            sort=sort,
            order=order,
            skip=skip,
            limit=limit,
        )

    async def set_favorite(
        self, id: int, is_favorite: bool
    ) -> Optional[SerialArticle]:
        """Favoriten-Markierung setzen (global, für alle Benutzer sichtbar)."""
        return await self.crud.set_favorite(id, is_favorite)

    async def check_article_number(
        self, article_number: str, exclude_id: Optional[int] = None
    ) -> dict:
        """Live-Prüfung der Artikelnummer für das Formular (DEC-056 Punkt 7)."""
        cleaned = (article_number or "").strip()
        if not cleaned:
            return {
                "available": False,
                "existing_count": 0,
                "message": "Bitte eine Artikelnummer angeben.",
            }

        existing = await self.crud.get_by_article_number(cleaned, exclude_id=exclude_id)
        if existing is None:
            return {
                "available": True,
                "existing_count": 0,
                "message": f"Artikelnummer {cleaned} ist frei.",
            }

        label = existing.name or existing.description
        suffix = f" – vergeben an „{label}“." if label else "."
        return {
            "available": False,
            "existing_count": 1,
            "message": f"Artikelnummer {cleaned} ist bereits vergeben{suffix}",
            "existing_id": existing.id,
            "existing_label": label,
        }

    # ------------------------------------------------------------------
    # Pfade und Ordner (DEC-057)
    # ------------------------------------------------------------------
    def article_dir(self, article_number: str) -> Path:
        """Absoluter Pfad des Artikelordners."""
        return self.root / sanitize_folder_name(article_number)

    def resolve_pdf_path(self, pdf_path: Optional[str]) -> Optional[Path]:
        """Gespeicherten (relativen) Pfad zu einer absoluten Datei auflösen.

        Gibt `None` zurück, wenn der Pfad aus der Ablage herausführt – der
        aufgelöste Pfad wird also **immer** gegen die Wurzel geprüft, bevor
        etwas ausgeliefert oder gelöscht wird.
        """
        if not pdf_path:
            return None

        stored = Path(str(pdf_path).replace("\\", "/"))
        if stored.is_absolute():
            candidate = stored
        else:
            parts = stored.parts
            prefix = UPLOAD_SUBDIR.parts
            if parts[: len(prefix)] == prefix:
                # Relativ zur Ablage (Normalfall): "uploads/serial_articles/x/y.pdf"
                candidate = self.root.joinpath(*parts[len(prefix) :])
            else:
                # Unerwartet gespeicherter Pfad: relativ zum Backend-Verzeichnis.
                candidate = BACKEND_DIR / stored

        candidate = candidate.resolve()
        if not self._is_inside_root(candidate):
            return None
        return candidate

    def _is_inside_root(self, path: Path) -> bool:
        try:
            path.resolve().relative_to(self.root)
        except ValueError:
            return False
        return True

    def _stored_path(self, folder: Path, file_name: str) -> str:
        """Pfad, wie er in der Datenbank steht (relativ, mit `/` als Trenner)."""
        return (UPLOAD_SUBDIR / folder.name / file_name).as_posix()

    def _ensure_article_dir(self, article_number: str) -> Path:
        folder = self.article_dir(article_number)
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def _remove_dir(self, folder: Path) -> None:
        """Artikelordner samt Inhalt entfernen – nur innerhalb der Ablage."""
        if not self._is_inside_root(folder):
            return
        shutil.rmtree(folder, ignore_errors=True)

    # ------------------------------------------------------------------
    # Schreiben
    # ------------------------------------------------------------------
    async def create(
        self,
        data,
        pdf_file: UploadInput = None,
        image_files: Optional[Iterable[UploadFile]] = None,
    ) -> SerialArticle:
        """Artikel anlegen: Nummer prüfen, Ordner anlegen, Pläne und Bilder ablegen.

        Der Ordner entsteht **immer**, auch ohne Dateien – dort liegen die Dateien
        des Artikels (DEC-057 Punkt 5). `pdf_file` nimmt eine oder mehrere PDFs
        entgegen (DEC-062).
        """
        existing = await self.crud.get_by_article_number(data.article_number)
        if existing is not None:
            raise ValueError(
                f"Artikelnummer {data.article_number} ist bereits vergeben."
            )

        await self._assert_master_data(data.plant_id, data.customer_id, data.machine_id)

        folder = self._ensure_article_dir(data.article_number)
        try:
            await self._write_plans(folder, pdf_file)
            await self._write_images(folder, image_files)
            return await self.crud.create_article(data, self._first_plan_path(folder))
        except Exception:
            # Kein halber Zustand: konnte die Zeile nicht angelegt werden,
            # verschwindet der eben erzeugte Ordner samt Dateien wieder.
            self._remove_dir(folder)
            raise

    async def update(
        self,
        id: int,
        values: dict,
        pdf_file: UploadInput = None,
        image_files: Optional[Iterable[UploadFile]] = None,
    ) -> Optional[SerialArticle]:
        """Artikel ändern – inklusive Ordner umbenennen, Pläne und Bilder ergänzen.

        `values` enthält nur die tatsächlich gesendeten Felder; ein bewusst
        gesendetes `None` leert ein Feld (z. B. „kein Kunde mehr"). Mitgeschickte
        Dateien kommen **hinzu**; entfernt wird über `delete_file()` (DEC-062).
        """
        article = await self.crud.get(id)
        if article is None:
            return None

        if any(key in values for key in ("plant_id", "customer_id", "machine_id")):
            await self._assert_master_data(
                values.get("plant_id", article.plant_id),
                values.get("customer_id", article.customer_id),
                values.get("machine_id", article.machine_id),
            )

        new_number = values.get("article_number")
        folder = self.article_dir(article.article_number)
        pdf_path = article.pdf_path

        if new_number and new_number != article.article_number:
            clash = await self.crud.get_by_article_number(new_number, exclude_id=id)
            if clash is not None:
                raise ValueError(f"Artikelnummer {new_number} ist bereits vergeben.")
            target = self.article_dir(new_number)
            if target != folder and target.exists():
                # Bewusst kein Zusammenführen und kein Überschreiben: sonst
                # lägen die Dateien zweier Artikel vermischt in einem Ordner.
                raise ValueError(
                    f"Zum Artikel {new_number} gibt es bereits einen Ablageordner. "
                    "Bitte die Nummer prüfen oder den Ordner zuerst wegräumen."
                )
            if folder.exists():
                folder.rename(target)
            folder = target

        await self._write_plans(folder, pdf_file)
        if image_files is not None:
            await self._write_images(folder, image_files)

        # `pdf_path` zeigt immer auf den **ersten** Plan (für `GET /{id}/pdf` und
        # `has_pdf`) – nach jedem Schreiben neu bestimmen (DEC-062).
        pdf_path = self._first_plan_path(folder)
        if pdf_path != article.pdf_path:
            values = {**values, "pdf_path": pdf_path}

        return await self.crud.apply_update(article, values)

    async def delete(self, id: int) -> bool:
        """Artikel löschen: Dateien und Ordner zuerst, dann die Datenbankzeile.

        `False` bedeutet: den Artikel gibt es nicht (der Router antwortet 404).
        """
        article = await self.crud.get(id)
        if article is None:
            return False

        # 1) Der gespeicherte Plan (kann bei älteren Datensätzen flach liegen).
        stored = self.resolve_pdf_path(article.pdf_path)
        if stored is not None:
            try:
                stored.unlink(missing_ok=True)
            except OSError:
                # Ist die Datei gesperrt, bleibt die Zeile trotzdem löschbar –
                # der Ordner wird anschließend ohnehin entfernt.
                pass

        # 2) Der Artikelordner samt Inhalt (dort liegen ggf. weitere Dateien).
        self._remove_dir(self.article_dir(article.article_number))

        await self.crud.delete(id)
        return True

    # ------------------------------------------------------------------
    # Intern
    # ------------------------------------------------------------------
    async def _write_plans(self, folder: Path, files: UploadInput) -> List[str]:
        """Mitgeschickte Einrichtepläne ablegen (`plan-2.pdf`, `plan-3.pdf` …).

        Namen werden fortlaufend vergeben; der Altbestand `plan.pdf` zählt als
        erster Plan. Geprüft wird nur die Endung (DEC-056 Punkt 12).
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

    def _plan_names(self, folder: Path) -> List[str]:
        """Vorhandene Plan-Dateien, nach Nummer sortiert."""
        if not folder.is_dir():
            return []
        return sorted(
            (path.name for path in folder.iterdir() if path.is_file() and is_plan_name(path.name)),
            key=lambda name: (_plan_index(name), name),
        )

    def _next_plan_name(self, folder: Path) -> str:
        """Namen für den nächsten Plan finden.

        Der **erste** Plan heißt weiterhin `plan.pdf` (so bleibt der Altbestand
        und die bisherige Ablage unverändert), weitere Pläne heißen
        `plan-2.pdf`, `plan-3.pdf` … (DEC-062).
        """
        vorhandene = self._plan_names(folder)
        if not vorhandene:
            return PLAN_FILE_NAME

        used = {_plan_index(name) for name in vorhandene}
        index = 2
        while index in used:
            index += 1
        return f"{PLAN_PREFIX}{index}.pdf"

    def _first_plan_path(self, folder: Path) -> Optional[str]:
        """Relativer Pfad des ersten Plans – oder None, wenn es keinen gibt."""
        namen = self._plan_names(folder)
        return self._stored_path(folder, namen[0]) if namen else None

    # ------------------------------------------------------------------
    # Bilder zum Plan (DEC-058)
    # ------------------------------------------------------------------
    async def _write_images(
        self, folder: Path, files: Optional[Iterable[UploadFile]]
    ) -> List[str]:
        """Mitgeschickte Bilder in den Artikelordner legen.

        Namen werden fortlaufend vergeben (`bild-1.jpg`, `bild-2.png` …), damit
        gleichnamige Handyfotos einander nicht überschreiben. Geprüft wird die
        **Dateiendung** – wie beim Plan ohne Größen- und Inhaltsprüfung.
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

    def list_files(self, article: SerialArticle) -> Tuple[List[dict], List[dict]]:
        """Alle Dateien des Artikels aus dem Ordner lesen (ohne Datenbank).

        Rückgabe: (Pläne, Bilder). Pläne sind nach ihrer Nummer sortiert
        (`plan.pdf` = 1, dann `plan-2.pdf` …), Bilder nach der Zahl im Namen
        (`bild-2` vor `bild-10` – Textsortierung wäre dort falsch). DEC-062.
        """
        return self._list_files_in(self.article_dir(article.article_number))

    def list_images(self, article: SerialArticle) -> List[dict]:
        """Nur die Bilder des Artikels (Bequemlichkeit für Aufrufer und Tests)."""
        _, images = self.list_files(article)
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

    def resolve_article_file(
        self, article: SerialArticle, name: str
    ) -> Optional[Path]:
        """Datei des Artikels auflösen – **ohne** Ausbruch aus der Ablage.

        Nur der reine Dateiname ist erlaubt (`..`, `/`, `\\` werden abgewiesen),
        die Datei muss im Artikelordner liegen und eine bekannte Rolle haben:
        ein Einrichteplan (`plan.pdf`, `plan-2.pdf` …) oder ein Bild.
        """
        if not name or Path(name).name != name:
            return None

        candidate = (self.article_dir(article.article_number) / name).resolve()
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

    def thumbnail_path(
        self, article: SerialArticle, name: str
    ) -> Optional[Path]:
        """Vorschaubild in fester Größe liefern – erzeugt und merkt es sich (DEC-059).

        Die Vorschau wird **einmal** erzeugt (`THUMB_MAX_SIZE`, JPEG) und unter
        `.thumbs` im Artikelordner abgelegt; weitere Aufrufe liefern die Datei
        direkt. Gibt es keine Bildbibliothek, das Bild ist nicht lesbar (z. B.
        HEIC ohne Zusatzpaket) oder schlägt das Schreiben fehl, kommt das
        **Original** zurück – die Anzeige funktioniert also immer.
        """
        source = self.resolve_article_file(article, name)
        if source is None or is_plan_name(source.name):
            # Der Einrichteplan hat keine Vorschau: er läuft im iframe; sein
            # Symbol in der Dateiliste ist ein Icon (DEC-059).
            return None
        if Image is None:
            return source

        cache_dir = self.article_dir(article.article_number) / THUMB_DIR_NAME
        target = cache_dir / f"{source.stem}.jpg"
        try:
            if target.is_file() and target.stat().st_mtime >= source.stat().st_mtime:
                return target
            cache_dir.mkdir(parents=True, exist_ok=True)
            with Image.open(source) as bild:
                # JPEG kennt keine Transparenz – PNG/WEBP mit Alpha umwandeln.
                # `convert()` liefert ein **neues** Bild: verkleinert wird die
                # Kopie, nicht das Original (sonst bliebe `bild` unverändert).
                vorschau = bild.convert("RGB")
                vorschau.thumbnail(THUMB_MAX_SIZE)
                vorschau.save(
                    target, "JPEG", quality=THUMB_QUALITY, optimize=True
                )
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

    async def delete_file(self, article: SerialArticle, name: str) -> bool:
        """Eine Datei des Artikels entfernen – Plan **oder** Bild (DEC-062).

        `False`, wenn es die Datei nicht gibt. Wird ein Plan entfernt, wird
        `pdf_path` auf den nächsten Plan nachgeführt (oder geleert, wenn keiner
        mehr da ist) – `has_pdf` stimmt dadurch immer.
        """
        path = self.resolve_article_file(article, name)
        if path is None:
            return False
        try:
            path.unlink()
        except OSError:
            return False

        if is_plan_name(path.name):
            await self.sync_pdf_path(article, path.parent)
        else:
            self._remove_thumbnail(path.parent, path.name)
        return True

    async def sync_pdf_path(
        self, article: SerialArticle, folder: Optional[Path] = None
    ) -> Optional[str]:
        """`pdf_path` an die vorhandenen Pläne angleichen und speichern.

        Ohne Pläne wird das Feld geleert – dann ist `has_pdf` falsch und der
        „PDF"-Eintrag verschwindet aus der Oberfläche.
        """
        ziel_ordner = folder or self.article_dir(article.article_number)
        pdf_path = self._first_plan_path(ziel_ordner)
        if pdf_path != article.pdf_path:
            await self.crud.set_pdf_path(article, pdf_path)
        return pdf_path

    async def _assert_master_data(
        self,
        plant_id: Optional[int],
        customer_id: Optional[int],
        machine_id: Optional[int],
    ) -> None:
        """Werk muss existieren; Kunde und Maschine, wenn sie angegeben sind.

        Ohne diese Prüfung käme bei einer gelöschten Maschine ein
        Fremdschlüsselfehler aus der Datenbank als HTTP 500 zurück.
        """
        if plant_id is None:
            raise ValueError("Bitte ein Werk auswählen.")

        plant = await self.db.get(Plant, plant_id)
        if plant is None:
            raise ValueError("Das gewählte Werk gibt es nicht mehr. Lade die Seite neu.")

        if customer_id is not None:
            customer = await self.db.get(Customer, customer_id)
            if customer is None:
                raise ValueError(
                    "Der gewählte Kunde gibt es nicht mehr. Lade die Seite neu."
                )

        if machine_id is not None:
            machine = await self.db.get(Machine, machine_id)
            if machine is None:
                raise ValueError(
                    "Die gewählte Maschine gibt es nicht mehr. Lade die Seite neu."
                )
