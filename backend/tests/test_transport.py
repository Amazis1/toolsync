"""Werkzeug-Logistik zwischen Werken (DEC-072, TASK-025b).

Geprüft wird der **Service** (`TransportService`), weil dort die Regeln liegen:

* Ein Auftrag ist **eine Richtung**; der Rückweg ist ein eigener Auftrag mit
  `parent_order_id`.
* Verschickt wird nur, was **verfügbar** ist, **im Arbeitswerk liegt** und in
  **keinem offenen Auftrag** steht.
* Der **Heimatplatz bleibt** beim Verschicken (`plant_id`, `position_id`), erst der
  **bestätigte Empfang** setzt `current_plant_id` – und am Heimatwerk wieder auf
  `NULL` (DEC-071).
* Der Empfang wird **je Zeile** bestätigt; „alles angekommen" ist die Abkürzung.
* Stornieren geht **nur im Entwurf**.

Ausführen im backend-Verzeichnis:

    python -m pytest tests/test_transport.py -q
"""

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.base import Base
from app.models.enums import MovementType, ToolCategory, ToolStatus, TransportStatus
from app.models.master_data import Plant, ToolType
from app.models.movement import ToolMovement
from app.models.storage import Cabinet, Drawer, Position
from app.models.tool import Tool
from app.models.user import User
from app.schemas.transport import (
    TransportItemCreate,
    TransportOrderCreate,
)
from app.services.transport_service import TransportService

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db_session:
        yield db_session
    await engine.dispose()


async def aufbau(db):
    """Zwei Werke, ein Heimatplatz, eine Person und drei Werkzeuge."""
    werk1 = Plant(name="Werk 1", color="#0f766e")
    werk2 = Plant(name="Werk 2", color="#4338ca")
    typ = ToolType(name="01 Rund")
    db.add_all([werk1, werk2, typ])
    await db.flush()

    schrank = Cabinet(name="03", plant_id=werk1.id)
    db.add(schrank)
    await db.flush()
    schublade = Drawer(name="C", cols=5, rows=1, cabinet_id=schrank.id)
    db.add(schublade)
    await db.flush()
    platz = Position(name="02", x=2, y=1, drawer_id=schublade.id)
    db.add(platz)
    await db.flush()

    anna = User(
        personal_number="2277", first_name="Anna", last_name="Ausleiherin",
        is_active=True, is_admin=False,
    )
    db.add(anna)
    await db.flush()

    def werkzeug(code, werk, status=ToolStatus.AVAILABLE, platz_id=None):
        return Tool(
            tool_id=code, category=ToolCategory.STEMPEL, status=status,
            is_storage=False, allow_duplicate_id=False, measure_a="8,20",
            plant_id=werk.id, tool_type_id=typ.id, position_id=platz_id,
        )

    stempel = werkzeug("01020002", werk1, platz_id=platz.id)
    abstreifer = werkzeug("01020003", werk1)
    fremd = werkzeug("02000001", werk2)
    db.add_all([stempel, abstreifer, fremd])
    await db.commit()
    for werkzeug_objekt in (stempel, abstreifer, fremd):
        await db.refresh(werkzeug_objekt)
    return {
        "werk1": werk1,
        "werk2": werk2,
        "anna": anna,
        "stempel": stempel,
        "abstreifer": abstreifer,
        "fremd": fremd,
        "platz": platz,
    }


def kopf(nummer, ziel, *werkzeuge, info=None, reference=None):
    """Auftragsdaten mit den angegebenen Werkzeugen."""
    return TransportOrderCreate(
        order_number=nummer,
        reference=reference,
        to_plant_id=ziel.id,
        info=info,
        items=[TransportItemCreate(tool_id=w.id) for w in werkzeuge],
    )


async def bewegungen(db):
    return list(
        (await db.execute(select(ToolMovement).order_by(ToolMovement.id))).scalars().all()
    )


class TestAnlegen:
    async def test_anlegen_legt_einen_entwurf_an(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)

        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"], ctx["abstreifer"]),
            user_id=ctx["anna"].id,
            plant_id=ctx["werk1"].id,
        )

        gelesen = service.to_read(order, ctx["werk1"].id)
        assert gelesen.status == TransportStatus.DRAFT
        assert gelesen.item_count == 2
        assert gelesen.received_count == 0
        assert gelesen.direction == "out", "aus Sicht des Absenders ist es der Ausgang"
        assert gelesen.from_plant.name == "Werk 1"
        assert gelesen.to_plant.name == "Werk 2"
        assert gelesen.created_by_name == "Anna Ausleiherin"
        assert gelesen.sent_at is None, "im Entwurf ist noch nichts verschickt"

    async def test_zeilen_halten_den_heimatplatz_fest(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"], ctx["abstreifer"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        codes = {zeile.tool_id: zeile.home_position_code for zeile in order.items}
        assert codes[ctx["stempel"].id] == "03-C-02"
        assert codes[ctx["abstreifer"].id] == "Ablage", "ohne Heimatplatz gilt die Ablage"

    async def test_gleiches_werk_ist_ein_fehler(self, session):
        ctx = await aufbau(session)
        with pytest.raises(ValueError) as fehler:
            await TransportService(session).create_order(
                kopf("T-1", ctx["werk1"], ctx["stempel"]),
                user_id=None,
                plant_id=ctx["werk1"].id,
            )
        assert "dasselbe Werk" in str(fehler.value)

    async def test_unbekanntes_zielwerk_ist_ein_fehler(self, session):
        ctx = await aufbau(session)
        daten = TransportOrderCreate(
            order_number="T-1", to_plant_id=9999,
            items=[TransportItemCreate(tool_id=ctx["stempel"].id)],
        )
        with pytest.raises(ValueError) as fehler:
            await TransportService(session).create_order(
                daten, user_id=None, plant_id=ctx["werk1"].id
            )
        assert "Empfängerwerk existiert nicht" in str(fehler.value)

    async def test_werkzeug_aus_anderem_werk_ist_nicht_waehlbar(self, session):
        ctx = await aufbau(session)
        with pytest.raises(ValueError) as fehler:
            await TransportService(session).create_order(
                kopf("T-1", ctx["werk2"], ctx["fremd"]),
                user_id=None,
                plant_id=ctx["werk1"].id,
            )
        assert "liegt in Werk 2" in str(fehler.value)

    async def test_ausgeliehenes_werkzeug_ist_gesperrt(self, session):
        ctx = await aufbau(session)
        ctx["stempel"].status = ToolStatus.LENT
        await session.commit()
        with pytest.raises(ValueError) as fehler:
            await TransportService(session).create_order(
                kopf("T-1", ctx["werk2"], ctx["stempel"]),
                user_id=None,
                plant_id=ctx["werk1"].id,
            )
        assert "ausgeliehen" in str(fehler.value)

    async def test_defektes_und_gewartetes_werkzeug_ist_gesperrt(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        for zustand, wort in (
            (ToolStatus.DEFECTIVE, "defekt"),
            (ToolStatus.MAINTENANCE, "in Wartung"),
        ):
            ctx["stempel"].status = zustand
            await session.commit()
            with pytest.raises(ValueError) as fehler:
                await service.create_order(
                    kopf("T-1", ctx["werk2"], ctx["stempel"]),
                    user_id=None,
                    plant_id=ctx["werk1"].id,
                )
            assert wort in str(fehler.value)

    async def test_doppeltes_werkzeug_ist_ein_fehler(self, session):
        ctx = await aufbau(session)
        daten = TransportOrderCreate(
            order_number="T-1", to_plant_id=ctx["werk2"].id,
            items=[
                TransportItemCreate(tool_id=ctx["stempel"].id),
                TransportItemCreate(tool_id=ctx["stempel"].id),
            ],
        )
        with pytest.raises(ValueError) as fehler:
            await TransportService(session).create_order(
                daten, user_id=None, plant_id=ctx["werk1"].id
            )
        assert "mehrfach" in str(fehler.value)

    async def test_unbekanntes_werkzeug_ist_ein_fehler(self, session):
        ctx = await aufbau(session)
        daten = TransportOrderCreate(
            order_number="T-1", to_plant_id=ctx["werk2"].id,
            items=[TransportItemCreate(tool_id=9999)],
        )
        with pytest.raises(ValueError) as fehler:
            await TransportService(session).create_order(
                daten, user_id=None, plant_id=ctx["werk1"].id
            )
        assert "existiert nicht" in str(fehler.value)

    async def test_zweiter_offener_auftrag_ist_verboten(self, session):
        """Ein Werkzeug steht in höchstens einem offenen Auftrag (DEC-072)."""
        ctx = await aufbau(session)
        service = TransportService(session)
        await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        with pytest.raises(ValueError) as fehler:
            await service.create_order(
                kopf("T-2", ctx["werk2"], ctx["stempel"]),
                user_id=None,
                plant_id=ctx["werk1"].id,
            )
        assert "steht bereits im Auftrag T-1" in str(fehler.value)

    async def test_leerer_entwurf_laesst_sich_anlegen(self, session):
        """Die Auswahl darf leer starten – verschickt werden kann er dann nicht."""
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"]), user_id=None, plant_id=ctx["werk1"].id
        )
        assert order.items == []
        with pytest.raises(ValueError) as fehler:
            await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        assert "keine Werkzeuge" in str(fehler.value)


class TestEntwurfAendern:
    async def test_aendern_ersetzt_die_zeilen(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        geaendert = await service.update_order(
            order.id,
            kopf("T-1b", ctx["werk2"], ctx["abstreifer"], reference="Umbau"),
            plant_id=ctx["werk1"].id,
        )
        gelesen = service.to_read(geaendert, ctx["werk1"].id)
        assert gelesen.order_number == "T-1b"
        assert gelesen.reference == "Umbau"
        assert [zeile.tool_id for zeile in gelesen.items] == [ctx["abstreifer"].id]

    async def test_verschickter_auftrag_laesst_sich_nicht_aendern(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        with pytest.raises(ValueError) as fehler:
            await service.update_order(
                order.id,
                kopf("T-1", ctx["werk2"], ctx["abstreifer"]),
                plant_id=ctx["werk1"].id,
            )
        assert "Nur ein Entwurf" in str(fehler.value)


class TestVerschicken:
    async def test_verschicken_setzt_unterwegs(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=ctx["anna"].id,
            plant_id=ctx["werk1"].id,
        )
        verschickt = await service.send_order(
            order.id, user_id=ctx["anna"].id, plant_id=ctx["werk1"].id
        )
        gelesen = service.to_read(verschickt, ctx["werk1"].id)
        assert gelesen.status == TransportStatus.SENT
        assert gelesen.sent_at is not None
        assert gelesen.sent_by_name == "Anna Ausleiherin"
        assert ctx["stempel"].status == ToolStatus.IN_TRANSIT

    async def test_heimatplatz_bleibt_reserviert(self, session):
        """Der Platz bleibt dem Werkzeug erhalten, solange es unterwegs ist."""
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)

        assert ctx["stempel"].position_id == ctx["platz"].id
        assert ctx["stempel"].plant_id == ctx["werk1"].id, "Heimatwerk bleibt unangetastet"
        assert ctx["stempel"].current_plant_id is None, "Ort ändert sich erst beim Empfang"

    async def test_verschicken_schreibt_eine_bewegung_mit_auftrag(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=ctx["anna"].id,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=ctx["anna"].id, plant_id=ctx["werk1"].id)

        alle = await bewegungen(session)
        assert len(alle) == 1
        bewegung = alle[0]
        assert bewegung.movement_type == MovementType.TRANSFER
        assert bewegung.tool_id == ctx["stempel"].id
        assert bewegung.transport_id == order.id, "Verlauf und Auftrag sind verbunden"
        assert bewegung.plant_id == ctx["werk1"].id, "Arbeitswerk des Vorgangs"
        assert bewegung.user_id == ctx["anna"].id
        assert bewegung.from_location == "Werk 1"
        assert bewegung.to_location == "Werk 2"

    async def test_zweimal_verschicken_ist_ein_fehler(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        with pytest.raises(ValueError) as fehler:
            await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        assert "Nur ein Entwurf kann verschickt werden" in str(fehler.value)

    async def test_nur_das_absenderwerk_verschickt(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        with pytest.raises(ValueError) as fehler:
            await service.send_order(order.id, user_id=None, plant_id=ctx["werk2"].id)
        assert "Nur das Absenderwerk" in str(fehler.value)


class TestEmpfang:
    async def test_empfang_setzt_den_aktuellen_ort(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        empfangen = await service.receive_order(
            order.id, item_ids=None, user_id=ctx["anna"].id, plant_id=ctx["werk2"].id
        )

        gelesen = service.to_read(empfangen, ctx["werk2"].id)
        assert gelesen.status == TransportStatus.RECEIVED
        assert gelesen.received_count == 1
        assert gelesen.closed_at is not None
        assert gelesen.direction == "in", "aus Sicht des Empfängers der Eingang"
        zeile = gelesen.items[0]
        assert zeile.received_at is not None
        assert zeile.received_by_name == "Anna Ausleiherin"
        assert zeile.received_plant.name == "Werk 2"

        assert ctx["stempel"].status == ToolStatus.AVAILABLE
        assert ctx["stempel"].current_plant_id == ctx["werk2"].id
        assert ctx["stempel"].position_id == ctx["platz"].id, "Heimatplatz bleibt reserviert"

    async def test_empfang_schreibt_eine_bewegung(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        await service.receive_order(
            order.id, item_ids=None, user_id=ctx["anna"].id, plant_id=ctx["werk2"].id
        )

        alle = await bewegungen(session)
        assert [b.movement_type for b in alle] == [MovementType.TRANSFER] * 2
        ankunft = alle[-1]
        assert ankunft.transport_id == order.id
        assert ankunft.plant_id == ctx["werk2"].id, "Arbeitswerk des Empfängers"
        assert ankunft.from_location == "Werk 1"
        assert ankunft.to_location == "Werk 2"

    async def test_teilempfang_haelt_den_auftrag_offen(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"], ctx["abstreifer"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)

        erste_zeile = order.items[0]
        teil = await service.receive_order(
            order.id, item_ids=[erste_zeile.id], user_id=None, plant_id=ctx["werk2"].id
        )
        gelesen = service.to_read(teil, ctx["werk2"].id)
        assert gelesen.status == TransportStatus.PARTLY_RECEIVED
        assert gelesen.received_count == 1
        assert gelesen.closed_at is None

        empfangen_id = erste_zeile.tool_id
        offen = [
            werkzeug
            for werkzeug in (ctx["stempel"], ctx["abstreifer"])
            if werkzeug.id != empfangen_id
        ]
        assert offen[0].status == ToolStatus.IN_TRANSIT, "der Rest ist weiter unterwegs"

        ganz = await service.receive_order(
            order.id, item_ids=None, user_id=None, plant_id=ctx["werk2"].id
        )
        assert service.to_read(ganz, ctx["werk2"].id).status == TransportStatus.RECEIVED

    async def test_nur_das_empfaengerwerk_bestaetigt(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        with pytest.raises(ValueError) as fehler:
            await service.receive_order(
                order.id, item_ids=None, user_id=None, plant_id=ctx["werk1"].id
            )
        assert "Nur das Empfängerwerk" in str(fehler.value)

    async def test_entwurf_hat_nichts_zu_empfangen(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        with pytest.raises(ValueError) as fehler:
            await service.receive_order(
                order.id, item_ids=None, user_id=None, plant_id=ctx["werk2"].id
            )
        assert "nicht unterwegs" in str(fehler.value)

    async def test_zweiter_empfang_meldet_sich(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        await service.receive_order(
            order.id, item_ids=None, user_id=None, plant_id=ctx["werk2"].id
        )
        with pytest.raises(ValueError) as fehler:
            await service.receive_order(
                order.id, item_ids=None, user_id=None, plant_id=ctx["werk2"].id
            )
        assert "nicht unterwegs" in str(fehler.value), "ein abgeschlossener Auftrag ist zu"

    async def test_bereits_bestaetigte_zeile_ist_kein_empfang(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"], ctx["abstreifer"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        erste = order.items[0].id
        await service.receive_order(
            order.id, item_ids=[erste], user_id=None, plant_id=ctx["werk2"].id
        )
        with pytest.raises(ValueError) as fehler:
            await service.receive_order(
                order.id, item_ids=[erste], user_id=None, plant_id=ctx["werk2"].id
            )
        assert "Keine der gewählten Zeilen ist noch offen" in str(fehler.value)

    async def test_fremde_zeile_ist_kein_empfang(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        with pytest.raises(ValueError) as fehler:
            await service.receive_order(
                order.id, item_ids=[9999], user_id=None, plant_id=ctx["werk2"].id
            )
        assert "Keine der gewählten Zeilen" in str(fehler.value)


class TestStorno:
    async def test_storno_gibt_das_werkzeug_frei(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        storniert = await service.cancel_order(order.id, plant_id=ctx["werk1"].id)
        assert service.to_read(storniert, ctx["werk1"].id).status == TransportStatus.CANCELLED

        # Dasselbe Werkzeug ist danach wieder frei für einen neuen Auftrag
        neu = await service.create_order(
            kopf("T-2", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        assert service.to_read(neu, ctx["werk1"].id).status == TransportStatus.DRAFT

    async def test_verschickter_auftrag_laesst_sich_nicht_stornieren(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        with pytest.raises(ValueError) as fehler:
            await service.cancel_order(order.id, plant_id=ctx["werk1"].id)
        assert "Nur ein Entwurf lässt sich stornieren" in str(fehler.value)


class TestRueckweg:
    async def _hinweg(self, session, ctx, nummer="T-1", nur_erste=False):
        """Auftrag anlegen, verschicken und (ganz oder teilweise) empfangen."""
        service = TransportService(session)
        order = await service.create_order(
            kopf(nummer, ctx["werk2"], ctx["stempel"], ctx["abstreifer"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        zeilen = [order.items[0].id] if nur_erste else None
        empfangen = await service.receive_order(
            order.id, item_ids=zeilen, user_id=None, plant_id=ctx["werk2"].id
        )
        return service, empfangen

    async def test_rueckauftrag_ist_ein_eigener_auftrag(self, session):
        ctx = await aufbau(session)
        service, hinweg = await self._hinweg(session, ctx)

        rueck = await service.return_order(
            hinweg.id, tool_ids=None, user_id=ctx["anna"].id, plant_id=ctx["werk2"].id
        )
        gelesen = service.to_read(rueck, ctx["werk2"].id)
        assert gelesen.status == TransportStatus.DRAFT
        assert gelesen.parent_order_id == hinweg.id, "Rückweg zeigt auf den Hinweg"
        assert gelesen.order_number == "T-1-R"
        assert gelesen.from_plant.name == "Werk 2", "der Rückweg startet beim Empfänger"
        assert gelesen.to_plant.name == "Werk 1"
        assert gelesen.direction == "out", "für das Werk, das die Werkzeuge hat"

    async def test_rueckauftrag_nimmt_nur_angekommene_werkzeuge(self, session):
        ctx = await aufbau(session)
        service, hinweg = await self._hinweg(session, ctx, nur_erste=True)

        rueck = await service.return_order(
            hinweg.id, tool_ids=None, user_id=None, plant_id=ctx["werk2"].id
        )
        assert len(rueck.items) == 1, "was nicht angekommen ist, kann nicht zurück"

    async def test_nicht_angekommenes_werkzeug_geht_nicht_zurueck(self, session):
        ctx = await aufbau(session)
        service, hinweg = await self._hinweg(session, ctx, nur_erste=True)
        angekommen = hinweg.items[0].tool_id
        nicht_angekommen = [
            w.id for w in (ctx["stempel"], ctx["abstreifer"]) if w.id != angekommen
        ]
        with pytest.raises(ValueError) as fehler:
            await service.return_order(
                hinweg.id,
                tool_ids=nicht_angekommen,
                user_id=None,
                plant_id=ctx["werk2"].id,
            )
        assert "Kein angekommenes Werkzeug" in str(fehler.value)

    async def test_rueckauftrag_erst_nach_dem_empfang(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        with pytest.raises(ValueError) as fehler:
            await service.return_order(
                order.id, tool_ids=None, user_id=None, plant_id=ctx["werk2"].id
            )
        assert "Erst wenn Werkzeuge angekommen sind" in str(fehler.value)

    async def test_nur_das_werk_mit_den_werkzeugen_schickt_zurueck(self, session):
        ctx = await aufbau(session)
        service, hinweg = await self._hinweg(session, ctx)
        with pytest.raises(ValueError) as fehler:
            await service.return_order(
                hinweg.id, tool_ids=None, user_id=None, plant_id=ctx["werk1"].id
            )
        assert "Nur das Werk, das die Werkzeuge hat" in str(fehler.value)

    async def test_kompletter_rueckweg_bringt_das_werkzeug_nach_hause(self, session):
        """Hin und zurück: der aktuelle Ort ist am Ende wieder `NULL` (Heimatwerk)."""
        ctx = await aufbau(session)
        service, hinweg = await self._hinweg(session, ctx)

        rueck = await service.return_order(
            hinweg.id, tool_ids=None, user_id=None, plant_id=ctx["werk2"].id
        )
        await service.send_order(rueck.id, user_id=None, plant_id=ctx["werk2"].id)
        assert ctx["stempel"].status == ToolStatus.IN_TRANSIT

        zurueck = await service.receive_order(
            rueck.id, item_ids=None, user_id=None, plant_id=ctx["werk1"].id
        )
        assert service.to_read(zurueck, ctx["werk1"].id).status == TransportStatus.RECEIVED
        assert ctx["stempel"].current_plant_id is None, "am Heimatwerk gilt NULL"
        assert ctx["stempel"].status == ToolStatus.AVAILABLE
        assert ctx["stempel"].position_id == ctx["platz"].id

        alle = await bewegungen(session)
        assert len(alle) == 8, "zwei Werkzeuge × (raus + an) über zwei Aufträge"
        assert {b.transport_id for b in alle} == {hinweg.id, rueck.id}
        assert sum(1 for b in alle if b.transport_id == rueck.id) == 4
        assert alle[-1].plant_id == ctx["werk1"].id

    async def test_rueckauftrag_von_rueckauftrag_ist_verboten(self, session):
        ctx = await aufbau(session)
        service, hinweg = await self._hinweg(session, ctx)
        rueck = await service.return_order(
            hinweg.id, tool_ids=None, user_id=None, plant_id=ctx["werk2"].id
        )
        await service.send_order(rueck.id, user_id=None, plant_id=ctx["werk2"].id)
        await service.receive_order(
            rueck.id, item_ids=None, user_id=None, plant_id=ctx["werk1"].id
        )
        with pytest.raises(ValueError) as fehler:
            await service.return_order(
                rueck.id, tool_ids=None, user_id=None, plant_id=ctx["werk1"].id
            )
        assert "bereits ein Rück-Auftrag" in str(fehler.value)


class TestListen:
    async def test_liste_trennt_ausgang_und_eingang(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )

        ausgang, gesamt = await service.list_orders(plant_id=ctx["werk1"].id, direction="out")
        assert gesamt == 1 and ausgang[0].id == order.id
        eingang_beim_kollegen, _ = await service.list_orders(
            plant_id=ctx["werk2"].id, direction="in"
        )
        assert [o.id for o in eingang_beim_kollegen] == [order.id]
        kein_eingang, gesamt_leer = await service.list_orders(
            plant_id=ctx["werk1"].id, direction="in"
        )
        assert kein_eingang == [] and gesamt_leer == 0

    async def test_liste_filtert_status_und_suche(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        entwurf = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"], reference="Presse 4"),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        verschickt = await service.create_order(
            kopf("T-2", ctx["werk2"], ctx["abstreifer"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(verschickt.id, user_id=None, plant_id=ctx["werk1"].id)

        nur_entwurf, _ = await service.list_orders(
            plant_id=ctx["werk1"].id, statuses=[TransportStatus.DRAFT]
        )
        assert [o.id for o in nur_entwurf] == [entwurf.id]

        treffer, _ = await service.list_orders(plant_id=ctx["werk1"].id, q="Presse")
        assert [o.id for o in treffer] == [entwurf.id]

        treffer_nummer, _ = await service.list_orders(plant_id=ctx["werk1"].id, q="T-2")
        assert [o.id for o in treffer_nummer] == [verschickt.id]

    async def test_kandidaten_nennen_den_sperrgrund(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        ctx["abstreifer"].status = ToolStatus.LENT
        await session.commit()

        liste = {k.tool_code: k for k in await service.candidates(ctx["werk1"].id)}
        assert liste["01020002"].blocked is None, "verfügbar im Arbeitswerk"
        assert "ausgeliehen" in liste["01020003"].blocked

    async def test_kandidaten_zeigen_nur_das_arbeitswerk(self, session):
        """Fremde Werkzeuge werden gar nicht angeboten (DEC-081).

        Ein Werkzeug aus dem anderen Werk lässt sich nicht verschicken – eine
        Zeile, die man nicht anhaken kann, ist nur Ballast. Werkzeuge **im**
        Arbeitswerk bleiben auch dann sichtbar, wenn sie gesperrt sind.
        """
        ctx = await aufbau(session)
        liste = await TransportService(session).candidates(ctx["werk1"].id)

        codes = {kandidat.tool_code for kandidat in liste}
        assert "02000001" not in codes, "Werkzeug aus Werk 2 fehlt in der Auswahl"
        assert codes == {"01020002", "01020003"}, "nur die Werkzeuge aus Werk 1"

        # Aus Sicht von Werk 2 ist es umgekehrt.
        aus_werk2 = await TransportService(session).candidates(ctx["werk2"].id)
        assert [kandidat.tool_code for kandidat in aus_werk2] == ["02000001"]

    async def test_kandidaten_nennen_den_offenen_auftrag(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)

        liste = {k.tool_code: k for k in await service.candidates(ctx["werk1"].id)}
        kandidat = liste["01020002"]
        assert kandidat.open_order_number == "T-1"
        assert "unterwegs (T-1)" in kandidat.blocked

    async def test_kandidaten_suchen_ueber_die_kennung(self, session):
        ctx = await aufbau(session)
        treffer = await TransportService(session).candidates(ctx["werk1"].id, q="0102000")
        assert sorted(k.tool_code for k in treffer) == ["01020002", "01020003"]

    async def test_wo_ist_was_zeigt_nur_abwesendes(self, session):
        """DEC-077: „Wo ist was" listet nur Ausgeliehenes und Unterwegs befindliches."""
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        ctx["abstreifer"].status = ToolStatus.LENT
        await session.commit()

        liste = {eintrag.tool_code: eintrag for eintrag in await service.away_tools()}
        assert set(liste) == {"01020002", "01020003"}, "verfügbare Werkzeuge fehlen"
        assert liste["01020002"].transport_number == "T-1"
        assert liste["01020002"].target_plant.name == "Werk 2"
        assert liste["01020002"].home_position_code == "03-C-02"
        assert liste["01020003"].lent_to is None, "Ausleiher kommt aus der lend-Bewegung"


class TestGelieheneWerkzeuge:
    """„Werkzeug zurück" (DEC-081): was hier liegt, aber anderen Werken gehört.

    Der Inhaber hat es so beschrieben: „Der jeweilige Werk schickt die Werkzeuge
    zurück." Also braucht es eine Liste der **fremden** Werkzeuge im eigenen Werk –
    nicht der an Personen ausgeliehenen.
    """

    async def test_leere_liste_ohne_fremde_werkzeuge(self, session):
        ctx = await aufbau(session)
        assert await TransportService(session).borrowed_tools(ctx["werk1"].id) == []

    async def test_zeigt_nur_fremde_werkzeuge_im_eigenen_werk(self, session):
        ctx = await aufbau(session)
        service = TransportService(session)
        # Ein Werkzeug von Werk 1 liegt nach bestätigtem Empfang in Werk 2.
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"], ctx["abstreifer"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        await service.receive_order(
            order.id, item_ids=None, user_id=None, plant_id=ctx["werk2"].id
        )

        in_werk2 = await service.borrowed_tools(ctx["werk2"].id)
        assert {eintrag.tool_code for eintrag in in_werk2} == {"01020002", "01020003"}
        # Beim Heimatwerk selbst steht nichts (die Werkzeuge sind ja weg).
        assert await service.borrowed_tools(ctx["werk1"].id) == []

        eintrag = next(e for e in in_werk2 if e.tool_code == "01020002")
        assert eintrag.home_plant.name == "Werk 1", "dorthin geht es zurück"
        assert eintrag.home_position_code == "03-C-02", "Heimatplatz bleibt reserviert"
        assert eintrag.arrived_at is not None, "wann es hier ankam"
        assert eintrag.arrived_with == "T-1", "mit welchem Auftrag es kam"

    async def test_eigene_werkzeuge_tauchen_nicht_auf(self, session):
        """Ein Werkzeug, das im eigenen Werk zu Hause ist, ist nicht „geliehen"."""
        ctx = await aufbau(session)
        ctx["stempel"].current_plant_id = ctx["werk1"].id
        await session.commit()

        geliehen = await TransportService(session).borrowed_tools(ctx["werk1"].id)
        assert geliehen == [], "Heimatwerk == aktueller Ort: nicht geliehen"

    async def test_zurueckschicken_aus_der_liste(self, session):
        """Der Rückweg: Auftrag vom **haltenden** Werk zum Heimatwerk."""
        ctx = await aufbau(session)
        service = TransportService(session)
        order = await service.create_order(
            kopf("T-1", ctx["werk2"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk1"].id,
        )
        await service.send_order(order.id, user_id=None, plant_id=ctx["werk1"].id)
        await service.receive_order(
            order.id, item_ids=None, user_id=None, plant_id=ctx["werk2"].id
        )

        # Werk 2 schickt zurück – ohne den alten Auftrag zu kennen.
        rueck = await service.create_order(
            kopf("R-1", ctx["werk1"], ctx["stempel"]),
            user_id=None,
            plant_id=ctx["werk2"].id,
        )
        await service.send_order(rueck.id, user_id=None, plant_id=ctx["werk2"].id)

        # Unterwegs ist es **nicht mehr** in der Rückgabe-Liste: Es liegt nicht
        # mehr im Regal, auch wenn `current_plant_id` erst beim Empfang wechselt.
        assert await service.borrowed_tools(ctx["werk2"].id) == []

        await service.receive_order(
            rueck.id, item_ids=None, user_id=None, plant_id=ctx["werk1"].id
        )

        assert ctx["stempel"].current_plant_id is None, "wieder am Heimatwerk"
        assert await service.borrowed_tools(ctx["werk2"].id) == [], "nichts mehr geliehen"
        assert await service.borrowed_tools(ctx["werk1"].id) == []
