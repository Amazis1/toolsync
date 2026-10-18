"""Konsistenz der Platz-Beziehung („zwei Wahrheiten") nach jeder Operation.

Ausgangslage: Werkzeug ↔ Platz ist **beidseitig** modelliert –
`Position.tool_id` („welches Werkzeug liegt auf diesem Platz") und
`Tool.position_id` („auf welchem Platz liegt dieses Werkzeug"). Beide Seiten
führen dieselbe Aussage. Eine DB-seitige Garantie gibt es **nicht**: weder ein
Unique-Index auf `positions.tool_id` noch ein Trigger hält beide Seiten
zusammen. Das leisten ausschließlich `LocationService` und `ToolService`.

Wenn eine der beiden Seiten stehen bleibt, ist der Bestand still falsch: die
Matrix zeigt ein Werkzeug, das sich selbst für „in der Ablage" hält, oder ein
Werkzeug steht auf einem Platz, der offiziell frei ist. Die Werkzeugliste liest
`Tool.position_id`, die Schubladen-Ansicht `Position.tool_id` – beide Ansichten
widersprächen sich.

Diese Datei prüft **nach jeder schreibenden Operation**, dass beide Seiten
dieselbe Aussage treffen (`assert_platz_konsistenz`), und zwar lückenlos in
beide Richtungen:

- Platz belegt  → das Werkzeug muss auf **diesen** Platz zeigen.
- Werkzeug eingelagert → auf dem Platz muss **dieses** Werkzeug liegen.

Geprüft werden alle Schreibwege: die fünf Platz-Operationen des
`LocationService` (move, swap, insert_at, place-tool, release-tool), das
Löschen von Schublade und Schrank (gibt Plätze frei, ohne Werkzeuge zu
verlieren), sowie Anlegen, Bearbeiten und Löschen eines Werkzeugs über den
`ToolService` – letzteres ist der zweite Schreibweg derselben Beziehung und
wird deshalb mitgeprüft.

Der letzte Test dokumentiert ausdrücklich, dass die Prüfung eine echte
Abweichung erkennt (kein Test, der immer grün ist).

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_platz_konsistenz.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.master_data import Plant, ToolType
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.models.movement import ToolMovement  # noqa: F401  (Model registrieren)
from app.models.enums import ToolCategory, ToolStatus
from app.schemas.tool import ToolCreate, ToolUpdate
from app.services.location_service import LocationService
from app.services.tool_service import ToolService

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


# ----------------------------------------------------------------------
# Prüfung: beide Seiten müssen dieselbe Aussage treffen
# ----------------------------------------------------------------------
async def assert_platz_konsistenz(db) -> None:
    """Beide Seiten der Platz-Beziehung gegeneinander prüfen.

    Lädt Positionen und Werkzeuge frisch aus der Datenbank (nicht aus der
    Identity Map) und vergleicht sie in beide Richtungen. Bei einer Abweichung
    schlägt der Test mit einer Meldung fehl, die den konkreten Datensatz nennt –
    sonst sucht man den Fehler in der ganzen Matrix.
    """
    positions = list(
        (await db.execute(select(Position).order_by(Position.id))).scalars().all()
    )
    tools = list((await db.execute(select(Tool).order_by(Tool.id))).scalars().all())

    tools_by_id = {tool.id: tool for tool in tools}
    belegte_plaetze: dict[int, int] = {}

    # Richtung 1: Platz -> Werkzeug
    for position in positions:
        if position.tool_id is None:
            continue
        tool = tools_by_id.get(position.tool_id)
        assert tool is not None, (
            f"Platz {position.name} (id={position.id}) verweist auf Werkzeug "
            f"{position.tool_id}, das es nicht mehr gibt."
        )
        assert tool.position_id == position.id, (
            f"Abweichung: Platz {position.name} (id={position.id}) hält Werkzeug "
            f"{tool.id}, aber das Werkzeug zeigt auf Platz {tool.position_id}."
        )
        assert position.id not in belegte_plaetze, (
            f"Platz {position.name} (id={position.id}) ist von mehreren Werkzeugen "
            f"belegt: {belegte_plaetze[position.id]} und {tool.id}."
        )
        belegte_plaetze[position.id] = tool.id

    # Richtung 2: Werkzeug -> Platz
    for tool in tools:
        if tool.position_id is None:
            continue
        position = next((p for p in positions if p.id == tool.position_id), None)
        assert position is not None, (
            f"Werkzeug {tool.id} zeigt auf Platz {tool.position_id}, den es nicht "
            "mehr gibt."
        )
        assert position.tool_id == tool.id, (
            f"Abweichung: Werkzeug {tool.id} zeigt auf Platz {position.name} "
            f"(id={position.id}), aber der Platz hält "
            f"{'niemanden' if position.tool_id is None else f'Werkzeug {position.tool_id}'}."
        )


# ----------------------------------------------------------------------
# Hilfsmittel
# ----------------------------------------------------------------------
async def create_workspace(db, drawer_count=2, positions_per_drawer=5):
    """Schrank mit Schubladen und Plätzen anlegen (wie in test_location_service)."""
    plant = Plant(name="Werk 1")
    tool_type = ToolType(name="01 Rund")
    db.add(plant)
    db.add(tool_type)
    await db.flush()

    cabinet = Cabinet(name="03", plant_id=plant.id)
    db.add(cabinet)
    await db.flush()

    drawers: dict[str, dict] = {}
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

        position_ids = []
        for x in range(1, positions_per_drawer + 1):
            position = Position(name=f"{x:02d}", x=x, y=1, drawer_id=drawer.id)
            db.add(position)
            await db.flush()
            position_ids.append(position.id)

        drawers[drawer_name] = {"drawer": drawer, "position_ids": position_ids}

    await db.commit()
    return {"plant": plant, "tool_type": tool_type, "cabinet": cabinet, "drawers": drawers}


async def create_tool(db, plant_id, tool_type_id, tool_id):
    """Werkzeug ohne Platz (Ablage) – direkt über das Modell."""
    tool = Tool(
        tool_id=tool_id,
        category=ToolCategory.STEMPEL,
        status=ToolStatus.AVAILABLE,
        is_storage=False,
        allow_duplicate_id=False,
        measure_a="7,00",
        plant_id=plant_id,
        tool_type_id=tool_type_id,
    )
    db.add(tool)
    await db.commit()
    await db.refresh(tool)
    return tool


async def place(db, tool, position_id):
    """Werkzeug auf einen Platz legen (beide Seiten), wie es der Service tut."""
    position = await db.get(Position, position_id)
    position.tool_id = tool.id
    tool.position_id = position_id
    await db.commit()


def tool_payload(ctx, tool_id, position_id=None, **overrides):
    """Nutzlast wie aus dem Anlege-/Bearbeiten-Formular."""
    data = {
        "tool_id": tool_id,
        "category": ToolCategory.STEMPEL,
        "status": ToolStatus.AVAILABLE,
        "is_storage": False,
        "allow_duplicate_id": False,
        "measure_a": "7,00",
        "measure_b": None,
        "description": None,
        "plant_id": ctx["plant"].id,
        "tool_type_id": ctx["tool_type"].id,
        "position_id": position_id,
        "machine_id": None,
        "customer_id": None,
    }
    data.update(overrides)
    return data


async def create_tool_with_stale_place(db, ctx, tool_id, position_id, tool_position_id=None):
    """Werkzeug anlegen, dessen **beide Seiten absichtlich auseinanderlaufen**.

    `Position.tool_id` zeigt auf das Werkzeug, `Tool.position_id` steht bewusst
    auf etwas anderem (Vorgabe: `None`). Genau dieser Zustand kann nach einem
    Abbruch zwischen zwei Commits entstehen – und die Oberfläche zeigt ihn
    falsch an: die Matrix hat ein Werkzeug auf dem Platz, die Werkzeugliste
    nennt „Ablage". Die Prüfung `assert_platz_konsistenz` schlägt hier mit
    Absicht an und wird deshalb nicht aufgerufen.
    """
    tool = await create_tool(db, ctx["plant"].id, ctx["tool_type"].id, tool_id)
    position = await db.get(Position, position_id)
    position.tool_id = tool.id
    tool.position_id = tool_position_id
    await db.commit()
    return tool


# ----------------------------------------------------------------------
# LocationService: die fünf Schreibwege
# ----------------------------------------------------------------------
class TestLocationServiceKonsistenz:
    async def test_move(self, session):
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        tool = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01010000")
        await place(session, tool, a[0])
        await assert_platz_konsistenz(session)  # Ausgangslage ist sauber

        await LocationService(session).move_position(a[0], a[1])

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[0])).tool_id is None

    async def test_swap(self, session):
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        t1 = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01010001")
        t2 = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01010002")
        await place(session, t1, a[0])
        await place(session, t2, a[1])

        await LocationService(session).swap_positions(a[0], a[1])

        await assert_platz_konsistenz(session)

    async def test_insert_at(self, session):
        """Der früher als „synchronisiert nicht in jedem Fall" bezeichnete Fall."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        b = ctx["drawers"]["B"]["position_ids"]

        # Ziel-Schublade A: 01=A, 02=B, 03=C, 04/05 frei
        for index, name in enumerate(["A", "B", "C"]):
            tool = await create_tool(
                session, ctx["plant"].id, ctx["tool_type"].id, f"0103{index}"
            )
            await place(session, tool, a[index])

        # Quelle: Schublade B (anderes Fach, sonst verbietet insert_at sich selbst)
        d = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01030099")
        await place(session, d, b[0])

        await LocationService(session).insert_at_position(b[0], a[1])

        await assert_platz_konsistenz(session)

        # Der Shift rückt 02 und 03 eine Position weiter: 01/02/03/04 belegt,
        # 05 bleibt frei (es war nur ein Platz frei, und der wird verbraucht).
        positions = [await session.get(Position, pid) for pid in a]
        assert [p.tool_id is not None for p in positions] == [True, True, True, True, False], (
            "Nach dem Einreihen muss 01–04 belegt und 05 frei sein"
        )
        assert (await session.get(Position, b[0])).tool_id is None

    async def test_place_tool_from_tray(self, session):
        """Ablage → freier Platz (einfaches Einlegen)."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        tool = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01020000")

        await LocationService(session).place_tool_at_position(tool.id, a[2])

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[2])).tool_id == tool.id

    async def test_place_tool_from_tray_shifts(self, session):
        """Ablage → belegter Platz: die ganze Schublade wird neu belegt."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        for index, name in enumerate(["A", "B"]):
            tool = await create_tool(
                session, ctx["plant"].id, ctx["tool_type"].id, f"0104{index}"
            )
            await place(session, tool, a[index])

        neu = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01040099")
        await LocationService(session).place_tool_at_position(neu.id, a[0])

        await assert_platz_konsistenz(session)

    async def test_release_tool_to_tray(self, session):
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        tool = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01050000")
        await place(session, tool, a[0])

        await LocationService(session).release_tool_from_position(a[0])

        await assert_platz_konsistenz(session)
        assert (await session.get(Tool, tool.id)).position_id is None

    async def test_delete_drawer_releases_tools(self, session):
        """Eine ganze Schublade löschen: Plätze frei, Werkzeuge bleiben erhalten."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        for index, name in enumerate(["A", "B"]):
            tool = await create_tool(
                session, ctx["plant"].id, ctx["tool_type"].id, f"0106{index}"
            )
            await place(session, tool, a[index])

        await LocationService(session).delete_drawer(ctx["drawers"]["A"]["drawer"].id)

        await assert_platz_konsistenz(session)
        for index in range(2):
            tool = (
                await session.execute(
                    select(Tool).where(Tool.tool_id == f"0106{index}")
                )
            ).scalar_one()
            assert tool.position_id is None, "Werkzeuge gehören danach in die Ablage"

    async def test_delete_cabinet_releases_tools(self, session):
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        b = ctx["drawers"]["B"]["position_ids"]
        for position_id, suffix in ((a[0], "00"), (b[0], "01")):
            tool = await create_tool(
                session, ctx["plant"].id, ctx["tool_type"].id, f"0107{suffix}"
            )
            await place(session, tool, position_id)

        await LocationService(session).delete_cabinet(ctx["cabinet"].id)

        await assert_platz_konsistenz(session)
        for suffix in ("00", "01"):
            tool = (
                await session.execute(
                    select(Tool).where(Tool.tool_id == f"0107{suffix}")
                )
            ).scalar_one()
            assert tool.position_id is None, "Werkzeuge gehören danach in die Ablage"


# ----------------------------------------------------------------------
# ToolService: der zweite Schreibweg derselben Beziehung
# ----------------------------------------------------------------------
class TestToolServiceKonsistenz:
    async def test_create_tool_with_place(self, session):
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        service = ToolService(session)

        tool = await service.create_tool(
            ToolCreate(**tool_payload(ctx, "01080000", position_id=a[3]))
        )

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[3])).tool_id == tool.id

    async def test_update_tool_moves_place(self, session):
        """Platzwechsel über das Bearbeiten-Formular: alter Platz frei, neuer belegt."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        service = ToolService(session)
        tool = await service.create_tool(
            ToolCreate(**tool_payload(ctx, "01090000", position_id=a[0]))
        )

        await service.update_tool(
            tool.id, ToolUpdate(**tool_payload(ctx, "01090000", position_id=a[1]))
        )

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[0])).tool_id is None
        assert (await session.get(Position, a[1])).tool_id == tool.id

    async def test_update_tool_to_tray(self, session):
        """„In Ablage legen": Werkzeug gibt seinen Platz frei."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        service = ToolService(session)
        tool = await service.create_tool(
            ToolCreate(**tool_payload(ctx, "01100000", position_id=a[0]))
        )

        await service.update_tool(
            tool.id, ToolUpdate(**tool_payload(ctx, "01100000", position_id=None))
        )

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[0])).tool_id is None

    async def test_update_tool_without_place_change(self, session):
        """Ein Update ohne Platzänderung darf die Beziehung nicht zerstören."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        service = ToolService(session)
        tool = await service.create_tool(
            ToolCreate(**tool_payload(ctx, "01110000", position_id=a[2]))
        )

        await service.update_tool(
            tool.id,
            ToolUpdate(
                **tool_payload(
                    ctx, "01110000", position_id=a[2], description="Neu beschrieben"
                )
            ),
        )

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[2])).tool_id == tool.id

    async def test_update_tool_releases_a_place_it_still_occupies(self, session):
        """Regression: der alte Platz wird auch bei auseinandergelaufener Beziehung frei.

        Gemeldeter Fall: `Position.tool_id` hält das Werkzeug, `Tool.position_id`
        steht auf `NULL` (so sieht es nach einem Abbruch zwischen zwei Commits
        aus). Wird das Werkzeug jetzt auf einen anderen Platz gelegt, muss der
        alte Platz **trotzdem** frei werden – sonst bliebe dort ein Geist
        stehen, der kein Werkzeug mehr hat.
        """
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        tool = await create_tool_with_stale_place(
            session, ctx, "01150000", a[0], tool_position_id=None
        )
        service = ToolService(session)

        await service.update_tool(
            tool.id, ToolUpdate(**tool_payload(ctx, "01150000", position_id=a[1]))
        )

        # Jetzt ist die Beziehung wieder in Ordnung – und der alte Platz leer.
        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[0])).tool_id is None, (
            "Der alte Platz muss frei werden"
        )
        assert (await session.get(Position, a[1])).tool_id == tool.id

    async def test_update_tool_to_tray_releases_a_stale_place(self, session):
        """Derselbe Fall beim Weg in die Ablage (position_id = NULL)."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        tool = await create_tool_with_stale_place(
            session, ctx, "01160000", a[0], tool_position_id=None
        )
        service = ToolService(session)

        await service.update_tool(
            tool.id, ToolUpdate(**tool_payload(ctx, "01160000", position_id=None))
        )

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[0])).tool_id is None

    async def test_delete_tool_releases_place(self, session):
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        service = ToolService(session)
        tool = await service.create_tool(
            ToolCreate(**tool_payload(ctx, "01120000", position_id=a[1]))
        )

        await service.delete_tool(tool.id)

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[1])).tool_id is None

    async def test_second_tool_cannot_take_an_occupied_place(self, session):
        """Ein belegter Platz bleibt belegt – die Prüfung greift, nichts kippt um."""
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        service = ToolService(session)
        erster = await service.create_tool(
            ToolCreate(**tool_payload(ctx, "01130000", position_id=a[0]))
        )

        with pytest.raises(ValueError):
            await service.create_tool(
                ToolCreate(**tool_payload(ctx, "01130001", position_id=a[0]))
            )

        await assert_platz_konsistenz(session)
        assert (await session.get(Position, a[0])).tool_id == erster.id


# ----------------------------------------------------------------------
# Die Prüfung selbst muss eine Abweichung erkennen
# ----------------------------------------------------------------------
class TestPruefungGreift:
    async def test_erkennt_einseitige_abweichung(self, session):
        """Absichtlich eine Seite stehen lassen – die Prüfung muss anschlagen.

        Ohne diesen Test wäre nicht belegt, dass `assert_platz_konsistenz`
        überhaupt etwas prüft: eine Prüfung, die immer grün ist, sichert nichts.
        """
        ctx = await create_workspace(session)
        a = ctx["drawers"]["A"]["position_ids"]
        tool = await create_tool(session, ctx["plant"].id, ctx["tool_type"].id, "01140000")

        # Nur die Platz-Seite setzen, die Werkzeug-Seite absichtlich vergessen –
        # genau der Zustand, den ein abgebrochener Schreibvorgang hinterließe.
        position = await session.get(Position, a[0])
        position.tool_id = tool.id
        await session.commit()

        with pytest.raises(AssertionError):
            await assert_platz_konsistenz(session)
