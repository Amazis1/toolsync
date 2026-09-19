import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Eine gemeinsame Base-Klasse für alle Models (aus app.models.base)
from app.models.base import Base
# Datenbank-URL aus Umgebungsvariablen oder Fallback zu SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./toolsync.db")

engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    future=True
)

# Async Session Factory erstellen
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Alias für SessionLocal zur Abwärtskompatibilität
SessionLocal = AsyncSessionLocal

# Base wird aus app.models.base re-exportiert
# (damit main.py und andere Dateien weiterhin aus database.py importieren können)
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()