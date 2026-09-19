import os

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.dependencies.permissions import require_active
from app.models.user import User
from app.utils.database import get_db
from ..schemas.serial_article import SerialArticleCreate, SerialArticleRead
from ..services.serial_article_service import SerialArticleService

router = APIRouter()

@router.get("/", response_model=List[SerialArticleRead])
async def get_serial_articles(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = SerialArticleService(db)
    return await service.get_all(search=search, skip=skip, limit=limit)

# Wichtig: Spezifische Route VOR der generischen "/{id}"-Route definieren,
# damit "/3/pdf" nicht als id="3/pdf" interpretiert wird.
@router.get("/{id}/pdf")
async def get_serial_article_pdf(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Liefert das hinterlegte PDF eines Serienartikels als Datei-Download."""
    service = SerialArticleService(db)
    article = await service.get(id)
    if not article:
        raise HTTPException(status_code=404, detail="Serial article not found")
    if not article.pdf_path:
        raise HTTPException(status_code=404, detail="No PDF available for this serial article")

    pdf_path = service.resolve_pdf_path(article.pdf_path)
    if not pdf_path or not os.path.isfile(pdf_path):
        raise HTTPException(status_code=404, detail="PDF file is missing on the server")

    # Sicherer Download-Dateiname: Leerzeichen/Sonderzeichen ersetzen
    safe_name = "".join(
        c if c.isalnum() or c in ".-_" else "_" for c in article.article_number
    ) or "serial-article"
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{safe_name}.pdf",
    )

@router.get("/{id}", response_model=SerialArticleRead)
async def get_serial_article(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = SerialArticleService(db)
    article = await service.get(id)
    if not article:
        raise HTTPException(status_code=404, detail="Serial article not found")
    return article

@router.post("/", response_model=SerialArticleRead, status_code=201)
async def create_serial_article(
    article_number: str = Form(...),
    description: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Erstellt einen Serienartikel. Das PDF (Einrichteplan) wird optional
    als Datei-Upload mitgeschickt (multipart/form-data)."""
    data = SerialArticleCreate(
        article_number=article_number.strip(),
        description=description,
    )
    service = SerialArticleService(db)
    try:
        return await service.create(data, pdf_file=file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id}", status_code=204)
async def delete_serial_article(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    service = SerialArticleService(db)
    await service.delete(id)
    return None
    await service.delete(id)
    return None

