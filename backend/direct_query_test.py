"""Direkter Test der Drawer-Abfrage mit allen Fehlerdetails."""
import asyncio
import traceback

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.storage import Cabinet, Drawer, Position

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///./toolsync.db")
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        query = (
            select(Drawer)
            .where(Drawer.cabinet_id == 1)
            .options(selectinload(Drawer.positions))
        )
        result = await session.execute(query)
        drawers = result.scalars().all()
        print(f"Drawers: {len(drawers)}")
        for d in drawers:
            print(f"  id={d.id}, name={d.name}, cols={d.cols}, rows={d.rows}, positions={len(d.positions)}")
            for p in d.positions:
                print(f"    pos: id={p.id}, name={p.name}, x={p.x}, y={p.y}, tool_id={p.tool_id}")
    await engine.dispose()

try:
    asyncio.run(main())
except Exception:
    traceback.print_exc()
