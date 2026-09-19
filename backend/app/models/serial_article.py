from sqlalchemy import String, JSON
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, AuditMixin

class SerialArticle(Base, AuditMixin):
    __tablename__ = "serial_articles"

    id: Mapped[int] = mapped_column(primary_key=True)

    article_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ACHTUNG: "metadata" ist reserviert in SQLAlchemy!
    # Deshalb heißt das Feld "extra_metadata"
    extra_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f"<SerialArticle(id={self.id}, article_number={self.article_number})>"