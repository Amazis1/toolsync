from sqlalchemy import select
from typing import Optional, List
from ..models.serial_article import SerialArticle
from .base import CRUDBase

class CRUDSerialArticle(CRUDBase):
    model = SerialArticle

    async def get_multi(self, search: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[SerialArticle]:
        query = select(self.model)
        if search:
            query = query.where(
                (self.model.article_number.ilike(f"%{search}%")) |
                (self.model.description.ilike(f"%{search}%"))
            )
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_article_number(self, article_number: str) -> Optional[SerialArticle]:
        query = select(self.model).where(self.model.article_number == article_number)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_with_pdf(self, obj_in, pdf_path: Optional[str] = None) -> SerialArticle:
        db_obj = self.model(
            article_number=obj_in.article_number,
            description=obj_in.description,
            pdf_path=pdf_path,
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj
