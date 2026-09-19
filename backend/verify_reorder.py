"""Isolierter Test der Perlenketten-Verschiebung auf einer temporären DB."""
import asyncio
import os
from collections import Counter

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, Customer, Machine, ToolType
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.models.enums import ToolCategory
from app.services.location_service import LocationService

DB_PATH = "./verify_reorder_tmp.db"


async def main() -> None:
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    engine = create_async_engine(f"sqlite+aiosqlite:///{DB_PATH}", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with SessionLocal() as db:
        plant = Plant(name="Testwerk")
        tool_type = ToolType(name="Rundstempel")
        db.add_all([plant, tool_type])
        await db.flush()

        cabinet = Cabinet(name="02", plant_id=plant.id)
        db.add(cabinet)
        await db.flush()

        drawer = Drawer(name="A", cols=5, rows=2, cabinet_id=cabinet.id)
        db.add(drawer)
        await db.flush()

        positions: list[Position] = []
        counter = 1
        for x in range(1, 6):
            for y in range(1, 3):
                pos = Position(name=str(counter).zfill(2), x=x, y=y, drawer_id=drawer.id)
                db.add(pos)
                positions.append(pos)
                counter += 1
        await db.flush()

        tools: list[Tool] = []
        for tid in ["A100", "B200", "C300"]:
            tool = Tool(
                tool_id=tid,
                category=ToolCategory.STEMPEL,
                is_storage=True,
                allow_duplicate_id=False,
                plant_id=plant.id,
                tool_type_id=tool_type.id,
            )
            db.add(tool)
            await db.flush()
            tools.append(tool)

        ordered = sorted(positions, key=lambda p: (-p.y, p.x))
        # Werkzeuge auf Positionen 6, 7, 8 der Anzeige-Reihenfolge legen
        for tool, pos in zip(tools, ordered[5:8]):
            pos.tool_id = tool.id
            tool.position_id = pos.id
        await db.commit()

        service = LocationService(db)
        result = await service.reorder_positions(ordered[5].id, ordered[7].id)

        assert result[5].tool_id == tools[1].id, f"Erwartet Tool B200 auf Platz {result[5].name}"
        assert result[6].tool_id == tools[2].id, f"Erwartet Tool C300 auf Platz {result[6].name}"
        assert result[7].tool_id == tools[0].id, f"Erwartet Tool A100 auf Platz {result[7].name}"

        for tool in tools:
            await db.refresh(tool)
        assert tools[0].position_id == ordered[7].id
        assert tools[1].position_id == ordered[5].id
        assert tools[2].position_id == ordered[6].id

        counts = Counter(p.tool_id for p in result if p.tool_id is not None)
        assert all(count == 1 for count in counts.values()), f"Duplikate gefunden: {counts}"

        print("=== TEST BESTANDEN ===")
        print("Neue Reihenfolge der betroffenen Plätze:")
        for p in result:
            if p.tool_id is not None:
                print(f"  Platz {p.name} (x={p.x}, y={p.y}) -> Tool-ID {p.tool_id}")

    await engine.dispose()
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)


if __name__ == "__main__":
    asyncio.run(main())
