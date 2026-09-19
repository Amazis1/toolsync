from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StorageItemBase(BaseModel):
    storage_id: str
    name: str
    type: Optional[str] = None
    article_number: Optional[str] = None
    machine_id: Optional[int] = None
    location_id: Optional[int] = None
    description: Optional[str] = None
    allow_duplicate_id: bool = False


class StorageItemCreate(StorageItemBase):
    pass


class StorageItemUpdate(StorageItemBase):
    pass


class StorageItemRead(StorageItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
