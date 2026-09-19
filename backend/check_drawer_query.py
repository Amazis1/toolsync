"""Diagnose: Warum schlägt die Drawer-Abfrage fehl?"""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.models.storage import Cabinet, Drawer, Position
from app.models.base import Base

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///./toolsync.db")
    async with engine.connect() as conn:
        # Tabellen-Spalten ausgeben
        result = await conn.exec_driver_sql("PRAGMA table_info(drawers)")
        print("Drawer-Spalten (DB):")
        for row in result:
            print(f"  {row}")

        result = await conn.exec_driver_sql("PRAGMA table_info(positions)")
        print("\nPosition-Spalten (DB):")
        for row in result:
            print(f"  {row}")

        # Direct query
        result = await conn.exec_driver_sql("SELECT * FROM drawers")
        print("\nDrawer-Daten:")
        for row in result:
            print(f"  {row}")

        result = await conn.exec_driver_sql("SELECT * FROM positions")
        print("\nPosition-Daten:")
        for row in result:
            print(f"  {row}")

    await engine.dispose()

asyncio.run(main())
