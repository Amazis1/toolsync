"""Tests für die Schubladen-Verschiebung (move / swap / insert_at).

Diese Tests prüfen die Service-Logik mit einer isolierten In-Memory-SQLite-Datenbank.
Voraussetzung: pytest und pytest-asyncio installieren, z. B.:

    pip install pytest pytest-asyncio

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_location_service.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, ToolType
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.models.movement import ToolMovement
from app.models.enums import ToolCategory, ToolStatus, MovementType, MovementStatus
from app.services.location_service import LocationService

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        future=True,
    )
    SessionLocal = async_sessionmaker(
        bind=engine,
        expire_on_commit=False,
        autoflush=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db_session:
        yield db_session

    await engine.dispose()


async def create_workspace(db, drawer_count=2, positions_per_drawer=5):
    """Legt in einer Transaktion die benötigten Grunddaten an."""
    plant = Plant(name="Werk 1")
    tool_type = ToolType(name="01 Rund")
    db.add(plant)
    db.add(tool_type)
    await db.flush()

    cabinet = Cabinet(name="03", plant_id=plant.id)
    db.add(cabinet)
    await db.flush()

    drawers = {}
    for drawer_idx in range(drawer_count):
        drawer_name = chr(65 + drawer_idx)  # A, B, ...
        drawer = Drawer(
            name=drawer_name,
            cols=positions_per_drawer,
            rows=1,
            cabinet_id=cabinet.id,
        )
        db.add(drawer)
        await db.flush()

        positions = []
        for x in range(1, positions_per_drawer + 1):
            position = Position(
                name=f"{x:02d}",
                x=x,
                y=1,
                drawer_id=drawer.id,
            )
            db.add(position)
            positions.append(position)

        await db.flush()
        drawers[drawer_name] = drawer
        # Zugriff auf Positionen später über fresh query oder bekannte IDs
        globals()[f"_drawer_{drawer_name}_first_pos_id"] = positions[0].id
        globals()[f"_drawer_{drawer_name}_last_pos_id"] = positions[-1].id

    await db.commit()

    return {
        "plant": plant,
        "tool_type": tool_type,
        "cabinet": cabinet,
        "drawers": drawers,
    }


async def create_tool(db, plant_id, tool_type_id, tool_id, status=ToolStatus.AVAILABLE):
    tool = Tool(
        tool_id=tool_id,
        category=ToolCategory.STEMPEL,
        status=status,
        is_storage=False,
        allow_duplicate_id=False,
        plant_id=plant_id,
        tool_type_id=tool_type_id,
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return tool


async def get_all_tools(db):
    result = await db.execute(select(Tool).order_by(Tool.id))
    return list(result.scalars().all())


async def get_all_positions(db):
    result = await db.execute(select(Position).order_by(Position.id))
    return list(result.scalars().all())


async def get_all_movements(db):
    result = await db.execute(select(ToolMovement).order_by(ToolMovement.id))
    return list(result.scalars().all())


def find_position(positions, position_id):
    return next(p for p in positions if p.id == position_id)


class TestMovePosition:
    async def test_simple_move(self, session):
        ctx = await create_workspace(session)
        first_pos_id = _drawer_A_first_pos_id
        second_pos_id = _drawer_A_first_pos_id + 1
        tool = await create_tool(
            session,
            ctx["plant"].id,
            ctx["tool_type"].id,
            "01010000",
        )
        position = await session.get(Position, first_pos_id)
        position.tool_id = tool.id
        tool.position_id = first_pos_id
        await session.commit()

        service = LocationService(session)
        await service.move_position(first_pos_id, second_pos_id)

        positions = await get_all_positions(session)
        source = find_position(positions, first_pos_id)
        target = find_position(positions, second_pos_id)
        assert source.tool_id is None
        assert target.tool_id == tool.id

        tools = await get_all_tools(session)
        updated_tool = next(t for t in tools if t.id == tool.id)
        assert updated_tool.position_id == second_pos_id

        movements = await get_all_movements(session)
        assert len(movements) == 1
        assert movements[0].movement_type == MovementType.RELOCATE
        assert movements[0].status == MovementStatus.COMPLETED
        assert movements[0].tool_id == tool.id

    async def test_move_does_not_allow_occupied_target(self, session):
        ctx = await create_workspace(session)
        first_pos_id = _drawer_A_first_pos_id
        second_pos_id = _drawer_A_first_pos_id + 1
        tool1 = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01010001"
        )
        tool2 = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01010002"
        )

        pos1 = await session.get(Position, first_pos_id)
        pos2 = await session.get(Position, second_pos_id)
        pos1.tool_id = tool1.id
        tool1.position_id = first_pos_id
        pos2.tool_id = tool2.id
        tool2.position_id = second_pos_id
        await session.commit()

        service = LocationService(session)
        with pytest.raises(ValueError):
            await service.move_position(first_pos_id, second_pos_id)


class TestSwapPositions:
    async def test_swap_two_positions(self, session):
        ctx = await create_workspace(session)
        first_pos_id = _drawer_A_first_pos_id
        second_pos_id = _drawer_A_first_pos_id + 1
        tool1 = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01020001"
        )
        tool2 = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01020002"
        )

        pos1 = await session.get(Position, first_pos_id)
        pos2 = await session.get(Position, second_pos_id)
        pos1.tool_id = tool1.id
        tool1.position_id = first_pos_id
        pos2.tool_id = tool2.id
        tool2.position_id = second_pos_id
        await session.commit()

        service = LocationService(session)
        await service.swap_positions(first_pos_id, second_pos_id)

        positions = await get_all_positions(session)
        source = find_position(positions, first_pos_id)
        target = find_position(positions, second_pos_id)
        assert source.tool_id == tool2.id
        assert target.tool_id == tool1.id

        tools = await get_all_tools(session)
        updated_tool1 = next(t for t in tools if t.id == tool1.id)
        updated_tool2 = next(t for t in tools if t.id == tool2.id)
        assert updated_tool1.position_id == second_pos_id
        assert updated_tool2.position_id == first_pos_id

        movements = await get_all_movements(session)
        assert len(movements) == 2
        assert {m.tool_id for m in movements} == {tool1.id, tool2.id}


class TestInsertAtPosition:
    async def test_insert_at_shifts_within_target_drawer(self, session):
        ctx = await create_workspace(session)
        drawer_a_ids = [_drawer_A_first_pos_id + i for i in range(5)]
        drawer_b_first = _drawer_B_first_pos_id

        # Ziel-Schublade A: 01=A, 02=B, 03=C, 04=frei, 05=frei
        tools = {}
        for name, pos_id in zip(["A", "B", "C"], drawer_a_ids[:3]):
            tool = await create_tool(
                session, ctx["plant"].id, ctx["tool_type"].id, f"0103{ord(name)}"
            )
            position = await session.get(Position, pos_id)
            position.tool_id = tool.id
            tool.position_id = pos_id
            tools[name] = tool

        # Quelle in Schublade B: 01=X
        tool_x = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "0103X"
        )
        source_position = await session.get(Position, drawer_b_first)
        source_position.tool_id = tool_x.id
        tool_x.position_id = drawer_b_first
        await session.commit()

        service = LocationService(session)
        await service.insert_at_position(drawer_b_first, drawer_a_ids[1])

        positions = await get_all_positions(session)
        pos_01 = find_position(positions, drawer_a_ids[0])
        pos_02 = find_position(positions, drawer_a_ids[1])
        pos_03 = find_position(positions, drawer_a_ids[2])
        pos_04 = find_position(positions, drawer_a_ids[3])
        pos_05 = find_position(positions, drawer_a_ids[4])
        source_pos = find_position(positions, drawer_b_first)

        assert pos_01.tool_id == tools["A"].id
        assert pos_02.tool_id == tool_x.id
        assert pos_03.tool_id == tools["B"].id
        assert pos_04.tool_id == tools["C"].id
        assert pos_05.tool_id is None
        assert source_pos.tool_id is None

        tools_after = await get_all_tools(session)
        updated_x = next(t for t in tools_after if t.id == tool_x.id)
        updated_b = next(t for t in tools_after if t.id == tools["B"].id)
        updated_c = next(t for t in tools_after if t.id == tools["C"].id)
        assert updated_x.position_id == drawer_a_ids[1]
        assert updated_b.position_id == drawer_a_ids[2]
        assert updated_c.position_id == drawer_a_ids[3]

        movements = await get_all_movements(session)
        assert len(movements) == 3

    async def test_insert_at_blocked_when_last_position_occupied(self, session):
        ctx = await create_workspace(session)
        drawer_a_ids = [_drawer_A_first_pos_id + i for i in range(5)]
        drawer_b_first = _drawer_B_first_pos_id

        # Ziel-Schublade A komplett belegen.
        tools = []
        for idx, pos_id in enumerate(drawer_a_ids):
            tool = await create_tool(
                session, ctx["plant"].id, ctx["tool_type"].id, f"0104{idx}"
            )
            position = await session.get(Position, pos_id)
            position.tool_id = tool.id
            tool.position_id = pos_id
            tools.append(tool)

        tool_x = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "0104X"
        )
        source_position = await session.get(Position, drawer_b_first)
        source_position.tool_id = tool_x.id
        tool_x.position_id = drawer_b_first
        await session.commit()

        before_positions = await get_all_positions(session)
        before_tools = await get_all_tools(session)
        before_movements = await get_all_movements(session)

        service = LocationService(session)
        with pytest.raises(ValueError):
            await service.insert_at_position(drawer_b_first, drawer_a_ids[1])

        after_positions = await get_all_positions(session)
        after_tools = await get_all_tools(session)
        after_movements = await get_all_movements(session)

        assert after_positions == before_positions
        assert after_tools == before_tools
        assert len(after_movements) == len(before_movements)


class TestCrossDrawer:
    async def test_move_between_drawers(self, session):
        ctx = await create_workspace(session)
        drawer_a_first = _drawer_A_first_pos_id
        drawer_b_second = _drawer_B_first_pos_id + 1

        tool = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01050001"
        )
        source = await session.get(Position, drawer_a_first)
        source.tool_id = tool.id
        tool.position_id = drawer_a_first
        await session.commit()

        service = LocationService(session)
        await service.move_position(drawer_a_first, drawer_b_second)

        positions = await get_all_positions(session)
        source_after = find_position(positions, drawer_a_first)
        target_after = find_position(positions, drawer_b_second)
        assert source_after.tool_id is None
        assert target_after.tool_id == tool.id

        tools = await get_all_tools(session)
        updated = next(t for t in tools if t.id == tool.id)
        assert updated.position_id == drawer_b_second

    async def test_swap_between_drawers(self, session):
        ctx = await create_workspace(session)
        drawer_a_first = _drawer_A_first_pos_id
        drawer_b_first = _drawer_B_first_pos_id

        tool_a = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01060001"
        )
        tool_b = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01060002"
        )

        pos_a = await session.get(Position, drawer_a_first)
        pos_b = await session.get(Position, drawer_b_first)
        pos_a.tool_id = tool_a.id
        tool_a.position_id = drawer_a_first
        pos_b.tool_id = tool_b.id
        tool_b.position_id = drawer_b_first
        await session.commit()

        service = LocationService(session)
        await service.swap_positions(drawer_a_first, drawer_b_first)

        positions = await get_all_positions(session)
        assert find_position(positions, drawer_a_first).tool_id == tool_b.id
        assert find_position(positions, drawer_b_first).tool_id == tool_a.id

        tools = await get_all_tools(session)
        updated_a = next(t for t in tools if t.id == tool_a.id)
        updated_b = next(t for t in tools if t.id == tool_b.id)
        assert updated_a.position_id == drawer_b_first
        assert updated_b.position_id == drawer_a_first


class TestLentTool:
    async def test_lent_tool_can_move(self, session):
        ctx = await create_workspace(session)
        first_pos_id = _drawer_A_first_pos_id
        second_pos_id = _drawer_A_first_pos_id + 1
        tool = await create_tool(
            session,
            ctx["plant"].id,
            ctx["tool_type"].id,
            "01070001",
            status=ToolStatus.LENT,
        )
        position = await session.get(Position, first_pos_id)
        position.tool_id = tool.id
        tool.position_id = first_pos_id
        await session.commit()

        service = LocationService(session)
        await service.move_position(first_pos_id, second_pos_id)

        tools = await get_all_tools(session)
        updated = next(t for t in tools if t.id == tool.id)
        assert updated.status == ToolStatus.LENT
        assert updated.position_id == second_pos_id


async def _place_tool(db, position_id, tool):
    """Werkzeug auf einen Platz legen und beide Seiten synchron halten."""
    position = await db.get(Position, position_id)
    position.tool_id = tool.id
    tool.position_id = position_id
    await db.commit()


class TestDeleteKeepsTools:
    async def test_delete_drawer_releases_tools(self, session):
        ctx = await create_workspace(session)
        first_pos_id = _drawer_A_first_pos_id
        drawer_id = ctx["drawers"]["A"].id

        tool_a = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01080001"
        )
        tool_b = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01080002"
        )
        await _place_tool(session, first_pos_id, tool_a)
        await _place_tool(session, first_pos_id + 1, tool_b)

        service = LocationService(session)
        released = await service.delete_drawer(drawer_id)

        assert released == 2

        tools = await get_all_tools(session)
        assert len(tools) == 2
        for tool in tools:
            assert tool.position_id is None

        assert await session.get(Drawer, drawer_id) is None

    async def test_delete_cabinet_releases_tools(self, session):
        ctx = await create_workspace(session)
        first_pos_id = _drawer_A_first_pos_id
        cabinet_id = ctx["cabinet"].id

        tool = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01090001"
        )
        await _place_tool(session, first_pos_id, tool)

        service = LocationService(session)
        released = await service.delete_cabinet(cabinet_id)

        assert released == 1

        tools = await get_all_tools(session)
        assert len(tools) == 1
        assert tools[0].position_id is None

        assert await session.get(Cabinet, cabinet_id) is None


class TestTrayTools:
    async def test_tray_contains_tools_without_position(self, session):
        ctx = await create_workspace(session)
        tool_placed = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01100001"
        )
        tool_tray = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01100002"
        )
        await _place_tool(session, _drawer_A_first_pos_id, tool_placed)

        service = LocationService(session)
        tray = await service.get_tray_tools(ctx["plant"].id)

        tray_ids = {t.id for t in tray}
        assert tool_tray.id in tray_ids
        assert tool_placed.id not in tray_ids


class TestPlaceToolAtPosition:
    async def test_place_on_free_position(self, session):
        ctx = await create_workspace(session)
        target_id = _drawer_A_first_pos_id
        tool = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01110001"
        )

        service = LocationService(session)
        await service.place_tool_at_position(tool.id, target_id)

        position = await session.get(Position, target_id)
        assert position.tool_id == tool.id

        tools = await get_all_tools(session)
        updated = next(t for t in tools if t.id == tool.id)
        assert updated.position_id == target_id

    async def test_place_on_occupied_position_shifts(self, session):
        ctx = await create_workspace(session)
        drawer_a_ids = [_drawer_A_first_pos_id + i for i in range(5)]

        tool_a = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01120001"
        )
        tool_b = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01120002"
        )
        tool_c = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01120003"
        )

        await _place_tool(session, drawer_a_ids[0], tool_a)
        await _place_tool(session, drawer_a_ids[1], tool_b)

        service = LocationService(session)
        await service.place_tool_at_position(tool_c.id, drawer_a_ids[0])

        positions = await get_all_positions(session)
        assert find_position(positions, drawer_a_ids[0]).tool_id == tool_c.id
        assert find_position(positions, drawer_a_ids[1]).tool_id == tool_a.id
        assert find_position(positions, drawer_a_ids[2]).tool_id == tool_b.id

    async def test_place_blocked_when_last_position_occupied(self, session):
        ctx = await create_workspace(session)
        drawer_a_ids = [_drawer_A_first_pos_id + i for i in range(5)]

        tools = []
        for idx, pos_id in enumerate(drawer_a_ids):
            tool = await create_tool(
                session, ctx["plant"].id, ctx["tool_type"].id, f"0113{idx}"
            )
            await _place_tool(session, pos_id, tool)
            tools.append(tool)

        tool_new = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "0113NEW"
        )

        service = LocationService(session)
        with pytest.raises(ValueError):
            await service.place_tool_at_position(tool_new.id, drawer_a_ids[0])

        # Kein Zustandsverlust.
        assert tool_new.position_id is None
        positions = await get_all_positions(session)
        assert find_position(positions, drawer_a_ids[0]).tool_id == tools[0].id


class TestReleaseToolFromPosition:
    async def test_release_moves_tool_to_tray(self, session):
        ctx = await create_workspace(session)
        pos_id = _drawer_A_first_pos_id
        tool = await create_tool(
            session, ctx["plant"].id, ctx["tool_type"].id, "01140001"
        )
        await _place_tool(session, pos_id, tool)

        service = LocationService(session)
        await service.release_tool_from_position(pos_id)

        position = await session.get(Position, pos_id)
        assert position.tool_id is None

        tools = await get_all_tools(session)
        updated = next(t for t in tools if t.id == tool.id)
        assert updated.position_id is None

        tray = await service.get_tray_tools(ctx["plant"].id)
        assert tool.id in {t.id for t in tray}
