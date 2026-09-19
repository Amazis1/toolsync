from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from fastapi import UploadFile
import os
import uuid

from ..models.serial_article import SerialArticle
from ..crud.crud_serial_article import CRUDSerialArticle

# PDFs werden relativ zum Backend-Arbeitsverzeichnis gespeichert
# (d.h. D:\toolsync\backend\uploads\serial_articles\...)
UPLOAD_DIR = os.path.join("uploads", "serial_articles")


class SerialArticleService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDSerialArticle(db)

    async def get_all(self, search: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[SerialArticle]:
        return await self.crud.get_multi(search=search, skip=skip, limit=limit)

    async def get(self, id: int) -> Optional[SerialArticle]:
        return await self.crud.get(id)

    async def create(self, data, pdf_file: Optional[UploadFile] = None) -> SerialArticle:
        # Prüfe ob Artikelnummer existiert
        existing = await self.crud.get_by_article_number(data.article_number)
        if existing:
            raise ValueError(f"Artikelnummer {data.article_number} existiert bereits!")

        pdf_path = None
        if pdf_file is not None and pdf_file.filename:
            pdf_path = await self._save_pdf(pdf_file)

        return await self.crud.create_with_pdf(data, pdf_path)

    async def _save_pdf(self, file: UploadFile) -> str:
        """Speichert die hochgeladene PDF-Datei und liefert den relativen Pfad."""
        os.makedirs(UPLOAD_DIR, exist_ok=True)

        # Endung aus Original-Dateinamen übernehmen, sonst .pdf
        original_name = file.filename or ""
        ext = os.path.splitext(original_name)[1].lower()
        if ext not in (".pdf", ".PDF"):
            ext = ".pdf"

        # Eindeutiger Dateiname (UUID), um Kollisionen zu vermeiden
        filename = f"{uuid.uuid4().hex}{ext}"
        full_path = os.path.join(UPLOAD_DIR, filename)

        content = await file.read()
        with open(full_path, "wb") as f:
            f.write(content)

        # Relativen Pfad mit Slashes speichern (plattformunabhängig)
        return os.path.join(UPLOAD_DIR, filename).replace("\\", "/")

    def resolve_pdf_path(self, pdf_path: str) -> str:
        """Löst den gespeicherten (relativen) Pfad zum tatsächlichen Dateipfad auf."""
        return pdf_path

    async def delete(self, id: int) -> None:
        article = await self.crud.get(id)
        if article is not None and article.pdf_path:
            self._remove_pdf_file(article.pdf_path)
        await self.crud.delete(id)

    def _remove_pdf_file(self, pdf_path: str) -> None:
        """Löscht die zugehörige PDF-Datei, falls vorhanden (Fehler werden ignoriert)."""
        try:
            if os.path.isfile(pdf_path):
                os.remove(pdf_path)
        except OSError:
            pass
