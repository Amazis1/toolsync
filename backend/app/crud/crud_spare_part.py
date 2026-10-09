from typing import List, Literal, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import aliased

from ..models.master_data import Machine, Plant
from ..models.spare_part import SparePart
from .base import CRUDBase

# Sortierbare Spalten der Ersatzteil-Liste. Die Whitelist liegt hier und nicht im
# Router: der Router validiert sie per Literal (ungültig -> HTTP 422), damit
# niemals ein Spaltenname aus der Anfrage an die Datenbank gereicht wird.
SparePartSortKey = Literal[
    "article_number",
    "name",
    "type",
    "plant",
    "machine",
    "storage_place",
    "quantity",
    "created_at",
]
SparePartSortOrder = Literal["asc", "desc"]


class CRUDSparePart(CRUDBase):
    model = SparePart

    async def get_multi(
        self,
        search: Optional[str] = None,
        plant_id: Optional[int] = None,
        machine_id: Optional[int] = None,
        type: Optional[str] = None,
        favorites_only: bool = False,
        sort: SparePartSortKey = "article_number",
        order: SparePartSortOrder = "asc",
        skip: int = 0,
        limit: int = 25,
    ) -> Tuple[List[SparePart], int]:
        """Gefilterte, sortierte und seitenweise Liste samt Gesamtzahl.

        Filter, Sortierung und Ausschnitt passieren in der Datenbank: der Browser
        bekommt genau eine Seite, nicht den ganzen Bestand.
        """
        # Aliase statt der eager geladenen Beziehungen: die Relationship-Joins von
        # SparePart.plant/machine stehen bereits in der Abfrage, ein zweiter Join
        # auf dieselbe Tabelle ohne Alias wäre ein Fehler. Beides sind n:1-Joins,
        # es entstehen also keine doppelten Zeilen.
        plant = aliased(Plant)
        machine = aliased(Machine)

        def with_joins(stmt):
            return stmt.join(plant, SparePart.plant_id == plant.id).outerjoin(
                machine, SparePart.machine_id == machine.id
            )

        conditions = []
        if search and search.strip():
            like = f"%{search.strip()}%"
            # Suchfelder der Oberfläche: Artikelnummer, Name, Typ, Lagerort,
            # Beschreibung sowie Werk- und Maschinenname – die Angaben, die ein
            # Werker kennt, wenn er ein Teil sucht (DEC-064).
            conditions.append(
                or_(
                    SparePart.article_number.ilike(like),
                    SparePart.name.ilike(like),
                    SparePart.type.ilike(like),
                    SparePart.storage_place.ilike(like),
                    SparePart.description.ilike(like),
                    plant.name.ilike(like),
                    machine.name.ilike(like),
                )
            )
        if plant_id is not None:
            conditions.append(SparePart.plant_id == plant_id)
        if machine_id is not None:
            conditions.append(SparePart.machine_id == machine_id)
        if type is not None and type.strip():
            conditions.append(SparePart.type == type.strip())
        if favorites_only:
            conditions.append(SparePart.is_favorite.is_(True))

        sort_columns = {
            "article_number": (SparePart.article_number,),
            "name": (SparePart.name,),
            "type": (SparePart.type,),
            "plant": (plant.name,),
            "machine": (machine.name,),
            "storage_place": (SparePart.storage_place,),
            "quantity": (SparePart.quantity,),
            "created_at": (SparePart.created_at,),
        }[sort]

        order_by = []
        for column in sort_columns:
            # NULLS LAST in beide Richtungen: leere Angaben sollen die Liste nicht
            # anführen, egal ob auf- oder absteigend sortiert wird.
            ordering = column.asc() if order == "asc" else column.desc()
            order_by.append(ordering.nullslast())
        # Stabiler Tiebreaker: ohne ihn kann dieselbe Zeile auf zwei Seiten
        # auftauchen oder zwischen zwei Seiten verschwinden – bei Ersatzteilen
        # besonders leicht, weil dieselbe Artikelnummer mehrfach vorkommt.
        order_by.append(SparePart.id.asc())

        rows_query = (
            with_joins(select(SparePart))
            .where(*conditions)
            .order_by(*order_by)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(rows_query)
        items = list(result.scalars().unique().all())

        count_query = with_joins(select(func.count()).select_from(SparePart)).where(
            *conditions
        )
        total = int((await self.db.execute(count_query)).scalar_one())

        return items, total

    async def count_by_article_number(
        self, article_number: str, exclude_id: Optional[int] = None
    ) -> int:
        """Wie oft gibt es diese Artikelnummer? (Für Hinweise im Formular.)

        Eine Dublette ist bei Ersatzteilen **kein** Fehler (DEC-064) – die Zahl
        dient nur der Rückmeldung „Diese Artikelnummer gibt es hier bereits 3×".
        """
        if not article_number or not article_number.strip():
            return 0
        conditions = [SparePart.article_number == article_number.strip()]
        if exclude_id is not None:
            conditions.append(SparePart.id != exclude_id)
        query = select(func.count()).select_from(SparePart).where(*conditions)
        return int((await self.db.execute(query)).scalar_one())

    async def count_by_position(
        self, position_id: int, exclude_id: Optional[int] = None
    ) -> int:
        """Wie viele Ersatzteile liegen auf diesem Matrix-Platz?

        Für die Belegungsprüfung: ein Platz darf nur **ein** Ersatzteil halten
        (Anforderung 7.2, DEC-064).
        """
        conditions = [SparePart.position_id == position_id]
        if exclude_id is not None:
            conditions.append(SparePart.id != exclude_id)
        query = select(func.count()).select_from(SparePart).where(*conditions)
        return int((await self.db.execute(query)).scalar_one())

    async def create_part(self, data) -> SparePart:
        """Neues Ersatzteil anlegen."""
        db_obj = SparePart(
            article_number=data.article_number,
            name=data.name,
            type=data.type,
            plant_id=data.plant_id,
            quantity=data.quantity,
            unit=data.unit,
            machine_id=data.machine_id,
            storage_place=data.storage_place,
            position_id=data.position_id,
            description=data.description,
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def apply_update(self, part: SparePart, values: dict) -> SparePart:
        """Änderung übernehmen – auch bewusst gesendete `None`-Werte.

        `CRUDBase.update()` überspringt None-Werte. Für dieses Formular ist das
        falsch: „Maschine entfernen" oder „Lagerort leeren" sendet ausdrücklich
        None und muss ankommen (dieselbe Überlegung wie bei
        `CRUDTool.apply_update()` und `SerialArticle`).
        """
        for key, value in values.items():
            setattr(part, key, value)
        await self.db.commit()
        await self.db.refresh(part)
        return part

    async def set_favorite(
        self, part_id: int, is_favorite: bool
    ) -> Optional[SparePart]:
        """Favoriten-Markierung setzen (global).

        `None`, wenn es den Datensatz nicht gibt. Die Markierung laeuft bewusst
        nicht ueber `apply_update`: sie kommt aus einem eigenen Endpunkt, damit
        ein normales Bearbeiten sie nicht zuruecksetzt (DEC-063).
        """
        part = await self.get(part_id)
        if part is None:
            return None
        part.is_favorite = is_favorite
        await self.db.commit()
        await self.db.refresh(part)
        return part
