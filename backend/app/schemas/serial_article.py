from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any

class SerialArticleBase(BaseModel):
    article_number: str
    description: Optional[str] = None
    pdf_path: Optional[str] = None
    extra_metadata: Optional[dict[str, Any]] = None  # Umbenannt!

class SerialArticleCreate(SerialArticleBase):
    pass

class SerialArticleUpdate(SerialArticleBase):
    pass

class SerialArticleRead(SerialArticleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True