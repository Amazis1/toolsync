from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.permissions import require_active, require_admin
from app.models.user import User
from app.utils.database import get_db

from ..crud.crud_spare_part import SparePartSortKey, SparePartSortOrder
from ..models.spare_part import SparePart
from ..schemas.spare_part import (
    SparePartCreate,
    SparePartPage,
    SparePartRead,
    SparePartUpdate,
)
from ..services.spare_part_service import SparePartService

router = APIRouter()


async def _with_codes(
    parts: List[SparePart], service: SparePartService
) -> List[SparePartRead]:
    """Antworten bauen – inklusive Platz-Code des Matrix-Platzes („01-A-25").

    Die Codes für alle Zeilen kommen in **einer** Abfrage; sonst käme pro
    Ersatzteil eine eigene Suche nach Schrank, Schublade und Platz.
    """
    codes = await service.position_codes(
        {part.position_id for part in parts if part.position_id is not None}
    )
    antworten: List[SparePartRead] = []
    for part in parts:
        data = SparePartRead.model_validate(part)
        if part.position_id is not None:
            data.position_code = codes.get(part.position_id)
        antworten.append(data)
    return antworten


async def _to_read(part: SparePart, service: SparePartService) -> SparePartRead:
    """Antwort eines einzelnen Ersatzteils."""
    return (await _with_codes([part], service))[0]


@router.get("/", response_model=SparePartPage)
async def get_spare_parts(
    search: Optional[str] = Query(
        None,
        description=(
            "Freitextsuche über Artikelnummer, Name, Typ, Lagerort, Beschreibung "
            "sowie Werk- und Maschinenname."
        ),
    ),
    plant_id: Optional[int] = Query(None, description="Nur dieses Werk."),
    machine_id: Optional[int] = Query(None, description="Nur diese Maschine."),
    type: Optional[str] = Query(None, description="Nur dieser Typ (genau)."),
    sort: SparePartSortKey = Query("article_number", description="Sortierspalte."),
    order: SparePartSortOrder = Query("asc", description="Sortierrichtung."),
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
    """Gefilterte, sortierte und seitenweise Ersatzteil-Liste samt Gesamtzahl.

    `sort` und `order` werden über Literal-Typen geprüft: ein unbekannter
    Spaltenname ergibt HTTP 422 statt einer Abfrage mit beliebigem Spaltennamen.
    """
    service = SparePartService(db)
    items, total = await service.get_all(
        search=search,
        plant_id=plant_id,
        machine_id=machine_id,
        type=type,
        sort=sort,
        order=order,
        skip=skip,
        limit=limit,
    )
    return SparePartPage(
        items=await _with_codes(items, service),
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/check-article-number")
async def check_article_number(
    article_number: str = Query(..., description="Zu prüfende Artikelnummer."),
    exclude_id: Optional[int] = Query(
        None, description="Eigener Datensatz beim Bearbeiten."
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Live-Prüfung der Artikelnummer im Formular.

    Wichtig – **anders als beim Serienartikel ist eine Dublette kein Fehler:**
    mehrere Zeilen mit derselben Artikelnummer sind bei Ersatzteilen der
    Normalfall (mehrere Lagerorte, mehrere Chargen, DEC-064). Der Endpunkt sagt
    deshalb nur, **wie oft** es die Nummer schon gibt.

    Diese Route ist **vor** `/{id}` definiert: stünde die generische Route zuerst,
    würde `/check-article-number` als `id="check-article-number"` interpretiert.
    """
    service = SparePartService(db)
    existing = await service.count_by_article_number(article_number, exclude_id)

    if existing == 0:
        message = "Diese Artikelnummer gibt es hier noch nicht."
    elif existing == 1:
        message = "Diese Artikelnummer gibt es hier bereits 1×."
    else:
        message = f"Diese Artikelnummer gibt es hier bereits {existing}×."

    return {
        "existing_count": existing,
        "message": message,
        # Für die Oberfläche: kein Blockieren, nur ein Hinweis.
        "is_duplicate": existing > 0,
    }


@router.get("/{id}", response_model=SparePartRead)
async def get_spare_part(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = SparePartService(db)
    part = await service.get(id)
    if not part:
        raise HTTPException(status_code=404, detail="Ersatzteil nicht gefunden")
    return await _to_read(part, service)


@router.post("/", response_model=SparePartRead, status_code=201)
async def create_spare_part(
    data: SparePartCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Ersatzteil anlegen.

    Bewusst **ohne** Admin-Recht – wie bei den Werkzeugen (DEC-064 Punkt 10):
    Lagerbestand pflegt die Werkstatt. Nur das **Löschen** ist Administratoren
    vorbehalten.
    """
    service = SparePartService(db)
    try:
        part = await service.create(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await _to_read(part, service)


@router.put("/{id}", response_model=SparePartRead)
async def update_spare_part(
    id: int,
    data: SparePartUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = SparePartService(db)
    try:
        part = await service.update(id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not part:
        raise HTTPException(status_code=404, detail="Ersatzteil nicht gefunden")
    return await _to_read(part, service)


@router.delete("/{id}", status_code=204)
async def delete_spare_part(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Ersatzteil löschen (nur Admin)."""
    service = SparePartService(db)
    deleted = await service.delete(id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Ersatzteil nicht gefunden")
    return None
