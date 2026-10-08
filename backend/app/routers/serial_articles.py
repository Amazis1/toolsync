from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.permissions import require_active, require_admin
from app.models.user import User
from app.utils.database import get_db

from ..crud.crud_serial_article import SerialArticleSortKey, SerialArticleSortOrder
from ..models.serial_article import SerialArticle
from ..schemas.serial_article import (
    ArticleFileRead,
    ArticleNumberCheck,
    SerialArticleCreate,
    SerialArticleFavoriteUpdate,
    SerialArticlePage,
    SerialArticleRead,
)
from ..services.serial_article_service import SerialArticleService

router = APIRouter()

# Geschuetzte Dateien duerfen **nicht** im Browser zwischengespeichert werden.
#
# FastAPI liefert Dateien mit `ETag` und `Last-Modified` aus. Ohne Cache-Verbot
# darf der Browser sie danach "heuristisch" lange selbst anzeigen - ohne den
# Server zu fragen. Folge: Ein abgelaufener Zugang fiel nicht auf, solange eine
# Datei noch im Zwischenspeicher lag (der eine Artikel "ging", der andere nicht),
# und nach dem Abmelden blieben bereits betrachtete Einrichteplaene auf dem
# Rechner abrufbar. Mit `no-store` gilt: entweder die Sitzung ist gueltig und die
# Datei kommt frisch vom Server, oder der Zugriff wird abgelehnt.
NO_STORE = {"Cache-Control": "no-store"}


def _to_read(article: SerialArticle, service: SerialArticleService) -> SerialArticleRead:
    """Antwort des Artikels bauen – inklusive der Dateien aus dem Artikelordner.

    Pläne und Bilder liegen als Dateien im Ordner (DEC-058, DEC-062) und werden
    hier ausgelesen: ein `listdir` je Artikel, dafür braucht es keine Tabellen.
    """
    data = SerialArticleRead.model_validate(article)
    plans, images = service.list_files(article)
    data.plans = [ArticleFileRead(**entry) for entry in plans]
    data.images = [ArticleFileRead(**entry) for entry in images]
    return data


def _parse_optional_int(raw: Optional[str], label: str) -> Optional[int]:
    """Formularwert in eine Zahl umwandeln.

    Leer bedeutet „keine Angabe" (None) – bei Kunde und Maschine ist das ein
    gültiger Wert, beim Werk prüft der Aufrufer darauf. Ein unlesbarer Wert
    ergibt HTTP 400 mit verständlichem Text statt eines rohen 422.
    """
    if raw is None:
        return None
    cleaned = raw.strip()
    if cleaned == "":
        return None
    try:
        return int(cleaned)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"{label} ist ungültig. Bitte neu auswählen."
        )


def _validation_message(error: ValidationError) -> str:
    """Erste Meldung eines Pydantic-Fehlers in der Sprache der Oberfläche.

    Die Meldungen der Schemas sind deutsch formuliert; Pydantic stellt ihnen
    „Value error, " voran – das wird entfernt.
    """
    for entry in error.errors():
        message = str(entry.get("msg", "")).strip()
        if message:
            return message.removeprefix("Value error, ")
    return "Die Eingaben sind unvollständig oder ungültig."


@router.get("/", response_model=SerialArticlePage)
async def get_serial_articles(
    search: Optional[str] = Query(
        None,
        description="Freitextsuche über Artikelnummer, Name, Beschreibung, Werk, Kunde und Maschine.",
    ),
    plant_id: Optional[int] = Query(None, description="Nur dieses Werk."),
    customer_id: Optional[int] = Query(None, description="Nur dieser Kunde."),
    machine_id: Optional[int] = Query(None, description="Nur diese Maschine."),
    has_pdf: Optional[bool] = Query(
        None, description="true = nur mit Einrichteplan, false = nur ohne."
    ),
    favorites_only: bool = Query(False, description="Nur Favoriten."),
    sort: SerialArticleSortKey = Query("article_number", description="Sortierspalte."),
    order: SerialArticleSortOrder = Query("asc", description="Sortierrichtung."),
    skip: int = Query(0, ge=0, description="Übersprungene Datensätze (Offset)."),
    limit: int = Query(
        25,
        ge=1,
        le=200,
        description="Seitengröße. Der Deckel verhindert, dass eine Anfrage die ganze Tabelle zieht.",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Gefilterte, sortierte und seitenweise Liste samt Gesamtzahl.

    Suchen, Ansehen und Herunterladen darf jeder aktive Benutzer; das Verwalten
    ist Administratoren vorbehalten (DEC-056 Punkt 4).
    """
    service = SerialArticleService(db)
    items, total = await service.get_all(
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
    return SerialArticlePage(
        items=[_to_read(item, service) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


# Wichtig: die spezifischen Routen VOR der generischen "/{id}"-Route definieren,
# damit "/check-number" und "/3/pdf" nicht als id interpretiert werden.
@router.get("/check-number", response_model=ArticleNumberCheck)
async def check_article_number(
    article_number: str = Query(..., description="Zu prüfende Artikelnummer."),
    exclude_id: Optional[int] = Query(
        None, description="Beim Bearbeiten die eigene Artikel-ID ausnehmen."
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Live-Prüfung der Artikelnummer für das Formular (DEC-056 Punkt 7)."""
    service = SerialArticleService(db)
    return await service.check_article_number(article_number, exclude_id=exclude_id)


@router.get("/{id}/pdf")
async def get_serial_article_pdf(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Liefert den hinterlegten Einrichteplan als Datei-Download."""
    service = SerialArticleService(db)
    article = await service.get(id)
    if not article:
        raise HTTPException(status_code=404, detail="Serienartikel nicht gefunden")
    if not article.pdf_path:
        raise HTTPException(
            status_code=404, detail="Für diesen Serienartikel ist kein PDF hinterlegt"
        )

    # Der aufgelöste Pfad wird gegen die Ablage geprüft – ein Pfad außerhalb
    # liefert None und damit 404 (DEC-057 Punkt 8).
    stored = service.resolve_pdf_path(article.pdf_path)
    if stored is None or not stored.is_file():
        raise HTTPException(status_code=404, detail="Die PDF-Datei fehlt auf dem Server")

    # Sicherer Download-Dateiname: Leerzeichen/Sonderzeichen ersetzen
    safe_name = "".join(
        char if char.isalnum() or char in ".-_" else "_"
        for char in article.article_number
    ) or "serial-article"
    return FileResponse(
        stored,
        media_type="application/pdf",
        filename=f"{safe_name}.pdf",
        headers=NO_STORE,
    )


@router.get("/{id}/files/{name}")
async def get_serial_article_file(
    id: int,
    name: str,
    variant: Optional[str] = Query(
        None,
        description="'thumb' = Vorschaubild in fester Größe (DEC-059); sonst das Original.",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Liefert eine Datei aus dem Artikelordner (Bilder und Vorschauen).

    Der Name wird gegen den Artikelordner aufgelöst – Pfadanteile (`..`, `/`)
    werden abgewiesen, und nur der Einrichteplan oder ein Bild sind zulässig
    (DEC-057 Punkt 8). Mit `variant=thumb` kommt die kleine Vorschau
    (`THUMB_MAX_SIZE`, JPEG) statt des Originals (DEC-059).
    """
    service = SerialArticleService(db)
    article = await service.get(id)
    if not article:
        raise HTTPException(status_code=404, detail="Serienartikel nicht gefunden")

    stored = (
        service.thumbnail_path(article, name)
        if variant == "thumb"
        else service.resolve_article_file(article, name)
    )
    if stored is None:
        raise HTTPException(status_code=404, detail="Diese Datei gibt es nicht")
    return FileResponse(
        stored,
        media_type=service.media_type_for(stored),
        headers=NO_STORE,
    )


@router.put("/{id}/favorite", response_model=SerialArticleRead)
async def set_serial_article_favorite(
    id: int,
    data: SerialArticleFavoriteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Favoriten-Markierung setzen (global, für alle Benutzer sichtbar).

    Bewusst **ohne** Admin-Recht – wie bei den Werkzeugen: die Markierung ändert
    nichts am Bestand, sie ist eine Sichtmarkierung für die Werkstatt (DEC-063).
    Ein normales Bearbeiten (`PUT /{id}`) setzt sie nicht zurück.
    """
    service = SerialArticleService(db)
    article = await service.set_favorite(id, data.is_favorite)
    if article is None:
        raise HTTPException(status_code=404, detail="Serienartikel nicht gefunden")
    return _to_read(article, service)


@router.get("/{id}", response_model=SerialArticleRead)
async def get_serial_article(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = SerialArticleService(db)
    article = await service.get(id)
    if not article:
        raise HTTPException(status_code=404, detail="Serienartikel nicht gefunden")
    return _to_read(article, service)


@router.post("/", response_model=SerialArticleRead, status_code=201)
async def create_serial_article(
    article_number: str = Form(...),
    plant_id: str = Form(...),
    name: Optional[str] = Form(None),
    customer_id: Optional[str] = Form(None),
    machine_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    plans: Optional[List[UploadFile]] = File(None),
    images: Optional[List[UploadFile]] = File(None),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Serienartikel anlegen (nur Admin). Pläne und Bilder sind optional.

    Im Ablageordner des Artikels entsteht der Ordner `<Artikelnummer>`; Pläne
    liegen darin als `plan-2.pdf`, `plan-3.pdf` … (der erste auch als
    `plan.pdf`), Bilder als `bild-1.jpg`, `bild-2.png` … (DEC-057, DEC-058,
    DEC-062). Mehrere Pläne und mehrere Bilder sind möglich.
    """
    parsed_plant = _parse_optional_int(plant_id, "Das Werk")
    if parsed_plant is None:
        raise HTTPException(status_code=400, detail="Bitte ein Werk auswählen.")

    try:
        data = SerialArticleCreate(
            article_number=article_number,
            name=name,
            plant_id=parsed_plant,
            customer_id=_parse_optional_int(customer_id, "Der Kunde"),
            machine_id=_parse_optional_int(machine_id, "Die Maschine"),
            description=description,
        )
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=_validation_message(error))

    service = SerialArticleService(db)
    try:
        article = await service.create(data, pdf_file=plans, image_files=images)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return _to_read(article, service)


@router.put("/{id}", response_model=SerialArticleRead)
async def update_serial_article(
    id: int,
    article_number: Optional[str] = Form(None),
    plant_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    customer_id: Optional[str] = Form(None),
    machine_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    plans: Optional[List[UploadFile]] = File(None),
    images: Optional[List[UploadFile]] = File(None),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Serienartikel ändern, Pläne und Bilder ergänzen (nur Admin).

    Regeln der Formularwerte: **fehlendes Feld** = unverändert, **leerer Wert**
    = Feld leeren (Name, Beschreibung, Kunde, Maschine). Artikelnummer und Werk
    sind Pflicht und werden nie geleert. Mitgeschickte Dateien kommen **hinzu**;
    entfernt wird einzeln über `DELETE /{id}/files/{name}` (DEC-062). Wird die
    Artikelnummer geändert, zieht der Ordner mit (DEC-057).
    """
    values: dict = {}

    if article_number is not None and article_number.strip():
        values["article_number"] = article_number.strip()

    if plant_id is not None:
        parsed_plant = _parse_optional_int(plant_id, "Das Werk")
        if parsed_plant is None:
            raise HTTPException(status_code=400, detail="Bitte ein Werk auswählen.")
        values["plant_id"] = parsed_plant

    if customer_id is not None:
        values["customer_id"] = _parse_optional_int(customer_id, "Der Kunde")
    if machine_id is not None:
        values["machine_id"] = _parse_optional_int(machine_id, "Die Maschine")
    if name is not None:
        values["name"] = name.strip() or None
    if description is not None:
        values["description"] = description.strip() or None

    service = SerialArticleService(db)
    try:
        article = await service.update(
            id, values, pdf_file=plans, image_files=images
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    if article is None:
        raise HTTPException(status_code=404, detail="Serienartikel nicht gefunden")
    return _to_read(article, service)


@router.delete("/{id}/files/{name}", status_code=204)
async def delete_serial_article_file(
    id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Eine Datei des Artikels entfernen – Einrichteplan **oder** Bild (nur Admin).

    Wird der letzte Plan entfernt, ist `has_pdf` danach falsch und der
    PDF-Eintrag verschwindet aus der Oberfläche (DEC-062).
    """
    service = SerialArticleService(db)
    article = await service.get(id)
    if not article:
        raise HTTPException(status_code=404, detail="Serienartikel nicht gefunden")
    if not await service.delete_file(article, name):
        raise HTTPException(status_code=404, detail="Diese Datei gibt es nicht")
    return None


@router.delete("/{id}", status_code=204)
async def delete_serial_article(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Serienartikel löschen – samt Artikelordner und allen Dateien darin.

    Nur Admin (DEC-056 Punkt 4). Eine unbekannte ID ergibt 404 statt einer
    Erfolgsmeldung für etwas, das es nie gab.
    """
    service = SerialArticleService(db)
    deleted = await service.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Serienartikel nicht gefunden")
    return None
