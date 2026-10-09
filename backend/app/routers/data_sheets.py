from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.permissions import require_active, require_admin
from app.models.user import User
from app.utils.database import get_db

from ..crud.crud_data_sheet import DataSheetSortKey, DataSheetSortOrder
from ..models.data_sheet import DataSheet
from ..schemas.data_sheet import (
    DataSheetCreate,
    DataSheetFavoriteUpdate,
    DataSheetFileRead,
    DataSheetPage,
    DataSheetRead,
    DataSheetToolIdCheck,
)
from ..services.data_sheet_service import DataSheetService

router = APIRouter()

# Geschützte Dateien dürfen **nicht** im Browser zwischengespeichert werden –
# sonst bliebe ein Datenblatt nach dem Abmelden abrufbar (Begründung im Detail in
# `routers/serial_articles.py`).
NO_STORE = {"Cache-Control": "no-store"}


def _to_read(sheet: DataSheet, service: DataSheetService) -> DataSheetRead:
    """Antwort bauen – inklusive der Dateien aus dem Ordner des Datensatzes.

    `has_pdf` wird aus der **Dateiliste** abgeleitet, nicht aus der Spalte
    `pdf_path` (so liefert es das Modell). Beide können auseinanderlaufen: die
    Datei kann außerhalb der Anwendung verschwinden, und während des Fehlers in
    `sheet_dir` fand die Nachführung die vorhandenen Dateien nicht und leerte den
    Verweis. Eine Antwort mit `has_pdf: true` und leerer Dateiliste widerspricht
    sich selbst – und die Zeilenaktion „Datenblatt" in der Werkzeugliste hängt
    genau an diesem Feld, sie hätte das vorhandene Datenblatt nicht geöffnet.
    """
    data = DataSheetRead.model_validate(sheet)
    plans, images = service.list_files(sheet)
    data.plans = [DataSheetFileRead(**entry) for entry in plans]
    data.images = [DataSheetFileRead(**entry) for entry in images]
    data.has_pdf = bool(plans)
    return data


def _parse_optional_int(raw: Optional[str], label: str) -> Optional[int]:
    """Formularwert in eine Zahl umwandeln (leer = „keine Angabe")."""
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
    """Erste Meldung eines Pydantic-Fehlers in der Sprache der Oberfläche."""
    for entry in error.errors():
        message = str(entry.get("msg", "")).strip()
        if message:
            return message.removeprefix("Value error, ")
    return "Die Eingaben sind unvollständig oder ungültig."


@router.get("/", response_model=DataSheetPage)
async def get_data_sheets(
    search: Optional[str] = Query(
        None,
        description="Freitextsuche über Werkzeug-ID, Name, Beschreibung, Werk und Maschine.",
    ),
    tool_id: Optional[str] = Query(
        None,
        description=(
            # Einfache Anfuehrungszeichen aussen: der Text enthaelt deutsche
            # Anfuehrungszeichen („…“). Mit doppelten aussen schliesst das
            # normale " den String vorzeitig – genau dieser Syntaxfehler hat
            # das Backend einmal nicht mehr starten lassen.
            'Nur Datenblätter **genau** dieser Werkzeug-ID. Für die Zeilenaktion '
            '„Datenblatt“ in der Werkzeugliste: sie sucht das Datenblatt des '
            'Werkzeugs, nicht ähnliche IDs.'
        ),
    ),
    plant_id: Optional[int] = Query(None, description="Nur dieses Werk."),
    machine_id: Optional[int] = Query(None, description="Nur diese Maschine."),
    has_pdf: Optional[bool] = Query(
        None,
        description=(
            "true = nur mit Datenblatt, false = nur ohne. Filtert über den "
            "gespeicherten Verweis `pdf_path`; im Ergebnis zählt die Dateiliste "
            "im Ordner. Beides geht normalerweise zusammen – nach einem Eingriff "
            "von außen kann der Filter deshalb kurz nachlaufen."
        ),
    ),
    favorites_only: bool = Query(False, description="Nur Favoriten."),
    sort: DataSheetSortKey = Query("tool_id", description="Sortierspalte."),
    order: DataSheetSortOrder = Query("asc", description="Sortierrichtung."),
    skip: int = Query(0, ge=0, description="Übersprungene Datensätze (Offset)."),
    limit: int = Query(
        25,
        ge=1,
        le=200,
        description=(
            "Seitengröße. Der Deckel verhindert, dass eine Anfrage die ganze "
            "Tabelle zieht."
        ),
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Gefilterte, sortierte und seitenweise Datenblatt-Liste samt Gesamtzahl.

    Suchen und Ansehen darf jeder aktive Benutzer; das Verwalten ist
    Administratoren vorbehalten (DEC-065 Punkt 9).
    """
    service = DataSheetService(db)
    items, total = await service.get_all(
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
    return DataSheetPage(
        items=[_to_read(item, service) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


# Wichtig: die spezifischen Routen VOR der generischen "/{id}"-Route definieren,
# damit "/check-tool-id" und "/3/files/x" nicht als id interpretiert werden.
@router.get("/check-tool-id", response_model=DataSheetToolIdCheck)
async def check_tool_id(
    tool_id: str = Query(..., description="Zu prüfende Werkzeug-ID."),
    exclude_id: Optional[int] = Query(
        None, description="Beim Bearbeiten die eigene Datensatz-ID ausnehmen."
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Hinweis im Formular: gibt es zu dieser Werkzeug-ID schon ein Datenblatt?

    Mehrere Datenblätter zu einer ID sind **erlaubt** (andere Maschine, andere
    Auflage) – der Endpunkt blockiert deshalb nichts, er sagt nur wie viele es
    schon gibt. Das ist der Unterschied zur Artikelnummer des Serienartikels.
    """
    service = DataSheetService(db)
    existing = await service.count_by_tool_id(tool_id, exclude_id)

    if existing == 0:
        message = "Zu dieser Werkzeug-ID gibt es noch kein Datenblatt."
    elif existing == 1:
        message = "Zu dieser Werkzeug-ID gibt es bereits 1 Datenblatt."
    else:
        message = f"Zu dieser Werkzeug-ID gibt es bereits {existing} Datenblätter."

    return DataSheetToolIdCheck(existing_count=existing, message=message)


@router.get("/{id}/files/{name}")
async def get_data_sheet_file(
    id: int,
    name: str,
    variant: Optional[str] = Query(
        None,
        description="'thumb' = Vorschaubild in fester Größe (nur Bilder); sonst das Original.",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Liefert eine Datei aus dem Ordner des Datensatzes.

    Der Name wird gegen den Ordner aufgelöst – Pfadanteile (`..`, `/`) sind
    abgewiesen, und nur Datenblatt- oder Bildnamen sind zulässig. Mit
    `variant=thumb` kommt die kleine Vorschau (max. 400 px, JPEG) statt des
    Originals; ein Datenblatt hat keine Vorschau und wird unverändert geliefert.
    """
    service = DataSheetService(db)
    sheet = await service.get(id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Datenblatt nicht gefunden")

    stored = (
        service.thumbnail_path(sheet, name)
        if variant == "thumb"
        else service.resolve_file(sheet, name)
    )
    if stored is None:
        raise HTTPException(status_code=404, detail="Diese Datei gibt es nicht")
    return FileResponse(
        stored,
        media_type=service.media_type_for(stored),
        headers=NO_STORE,
    )


@router.put("/{id}/favorite", response_model=DataSheetRead)
async def set_data_sheet_favorite(
    id: int,
    data: DataSheetFavoriteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Favoriten-Markierung setzen (global, ohne Admin-Recht – wie DEC-063)."""
    service = DataSheetService(db)
    sheet = await service.set_favorite(id, data.is_favorite)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Datenblatt nicht gefunden")
    return _to_read(sheet, service)


@router.get("/{id}", response_model=DataSheetRead)
async def get_data_sheet(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = DataSheetService(db)
    sheet = await service.get(id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Datenblatt nicht gefunden")
    return _to_read(sheet, service)


@router.post("/", response_model=DataSheetRead, status_code=201)
async def create_data_sheet(
    plant_id: str = Form(...),
    tool_id: Optional[str] = Form(None),
    machine_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    plans: Optional[List[UploadFile]] = File(None),
    images: Optional[List[UploadFile]] = File(None),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Datenblatt anlegen (nur Admin). Mehrere PDFs und Bilder sind möglich.

    Der Ordner `<Datensatz-ID>` entsteht in der Ablage; Datenblätter liegen darin
    als `plan.pdf`, `plan-2.pdf` …, Bilder als `bild-1.jpg`, `bild-2.png` …
    (DEC-065).
    """
    parsed_plant = _parse_optional_int(plant_id, "Das Werk")
    if parsed_plant is None:
        raise HTTPException(status_code=400, detail="Bitte ein Werk auswählen.")

    try:
        data = DataSheetCreate(
            tool_id=tool_id,
            plant_id=parsed_plant,
            machine_id=_parse_optional_int(machine_id, "Die Maschine"),
            name=name,
            description=description,
        )
    except ValidationError as error:
        raise HTTPException(status_code=400, detail=_validation_message(error))

    service = DataSheetService(db)
    try:
        sheet = await service.create(data, pdf_files=plans, image_files=images)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return _to_read(sheet, service)


@router.put("/{id}", response_model=DataSheetRead)
async def update_data_sheet(
    id: int,
    tool_id: Optional[str] = Form(None),
    plant_id: Optional[str] = Form(None),
    machine_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    plans: Optional[List[UploadFile]] = File(None),
    images: Optional[List[UploadFile]] = File(None),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Datenblatt ändern (nur Admin) und Dateien ergänzen.

    Ein **fehlendes** Feld bedeutet „unverändert", ein **leerer** Wert bedeutet
    „Feld leeren" (Werkzeug-ID, Maschine, Name, Beschreibung). Das Werk ist
    Pflicht und wird nie geleert.
    """
    service = DataSheetService(db)

    values: dict = {}
    if tool_id is not None:
        values["tool_id"] = tool_id.strip() or None
    if name is not None:
        values["name"] = name.strip() or None
    if description is not None:
        values["description"] = description.strip() or None
    if machine_id is not None:
        values["machine_id"] = _parse_optional_int(machine_id, "Die Maschine")

    if plant_id is not None:
        parsed_plant = _parse_optional_int(plant_id, "Das Werk")
        if parsed_plant is None:
            raise HTTPException(status_code=400, detail="Bitte ein Werk auswählen.")
        values["plant_id"] = parsed_plant

    try:
        sheet = await service.update(id, values, pdf_files=plans, image_files=images)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    if not sheet:
        raise HTTPException(status_code=404, detail="Datenblatt nicht gefunden")
    return _to_read(sheet, service)


@router.delete("/{id}/files/{name}", status_code=204)
async def delete_data_sheet_file(
    id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Ein Datenblatt entfernen (nur Admin). Danach rückt `pdf_path` nach."""
    service = DataSheetService(db)
    sheet = await service.get(id)
    if not sheet:
        raise HTTPException(status_code=404, detail="Datenblatt nicht gefunden")
    if not await service.delete_file(sheet, name):
        raise HTTPException(status_code=404, detail="Diese Datei gibt es nicht")
    return None


@router.delete("/{id}", status_code=204)
async def delete_data_sheet(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Datensatz samt Ordnern und Dateien löschen (nur Admin)."""
    service = DataSheetService(db)
    if not await service.delete(id):
        raise HTTPException(status_code=404, detail="Datenblatt nicht gefunden")
    return None
