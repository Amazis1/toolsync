from sqlalchemy import (
    Float,
    and_,
    case,
    cast,
    func,
    or_,
    select,
)
from sqlalchemy.orm import aliased
from typing import List, Literal, Optional, Sequence, Tuple

from ..models.enums import ToolCategory, ToolStatus
from ..models.master_data import Customer, Machine, Plant, ToolType
from ..models.storage import Cabinet, Drawer, Position
from ..models.tool import Tool
from .base import CRUDBase

# Sortierbare Spalten der Werkzeugliste. Die Whitelist liegt hier und nicht im
# Router, damit der Router sie per Literal validieren und der Service sie direkt
# verwenden kann. Ein Sortierfeld, das hier nicht steht, ergibt HTTP 422 —
# Spaltennamen aus der Anfrage werden niemals direkt an die Datenbank gereicht.
ToolSortKey = Literal[
    "tool_id",
    "description",
    "measure_a",
    "status",
    "plant",
    "tool_type",
    "location",
    "customer",
    "machine",
]
ToolSortOrder = Literal["asc", "desc"]

# Ein Listeneintrag: das Werkzeug plus die drei Namensteile seines Lagerplatzes
# (Schrank, Schublade, Platz). Der Code ("01-A-25") entsteht daraus im Service.
ToolListRow = Tuple[Tool, Optional[str], Optional[str], Optional[str]]

# Maß A wird als Text gespeichert (normalisiert auf "123,45"). Textweise zu
# sortieren wäre falsch ("10,00" stünde vor "7,00"), deshalb numerisch sortieren.
# NULLIF fängt den leeren String ab: in Postgres würde CAST('' AS FLOAT) sonst
# einen Fehler werfen statt NULL zu liefern.
_MEASURE_A_NUMERIC = cast(
    func.nullif(func.replace(Tool.measure_a, ",", "."), ""), Float
)

# Fachliche Reihenfolge der Status statt Alphabet: nach dem Speicherwert
# sortiert stünde "ausgeliehen" vor "defekt" vor "in Transit" vor "verfügbar" —
# eine Reihenfolge, die niemand erwartet. „Verfügbar" kommt zuerst, weil das
# die Werkzeuge sind, die man entnehmen darf.
#
# **Ohne Status = verfügbar** (DEC-080): Ein Datensatz ohne gepflegten Status ist
# der Normalfall (Bestand aus dem Altsystem) und wird wie „verfügbar" behandelt –
# auch in der Sortierung (`else_=0`). Nur so steht „noch nie gepflegt" nicht
# hinter „defekt".
_STATUS_RANK = case(
    (Tool.status == ToolStatus.AVAILABLE, 0),
    (Tool.status == ToolStatus.LENT, 1),
    (Tool.status == ToolStatus.IN_TRANSIT, 2),
    (Tool.status == ToolStatus.MAINTENANCE, 3),
    (Tool.status == ToolStatus.DEFECTIVE, 4),
    else_=0,
)


class CRUDTool(CRUDBase):
    model = Tool

    async def get_multi(
        self,
        q: Optional[str] = None,
        categories: Optional[Sequence[ToolCategory]] = None,
        statuses: Optional[Sequence[ToolStatus]] = None,
        plant_id: Optional[int] = None,
        tool_type_id: Optional[int] = None,
        is_storage: Optional[bool] = None,
        has_place: Optional[bool] = None,
        favorites_only: bool = False,
        sort: ToolSortKey = "tool_id",
        order: ToolSortOrder = "asc",
        skip: int = 0,
        limit: int = 25,
    ) -> Tuple[List[ToolListRow], int]:
        """Gefilterte, sortierte und seitenweise Liste samt Gesamtzahl.

        Filter, Sortierung und Ausschnitt passieren in der Datenbank: Bei
        mehreren tausend Werkzeugen kann die Oberfläche nicht mehr alle
        Datensätze laden und im Browser filtern.

        `total` wird mit exakt denselben Bedingungen gezählt, damit die
        Seitenzahl zur angezeigten Liste passt.
        """
        plant = aliased(Plant)
        tool_type = aliased(ToolType)
        position = aliased(Position)
        drawer = aliased(Drawer)
        cabinet = aliased(Cabinet)
        customer = aliased(Customer)
        machine = aliased(Machine)

        def with_joins(stmt):
            # Aliase statt der eager geladenen Beziehungen: die Relationship-
            # joins von Tool.plant/Tool.tool_type sind bereits in der Abfrage,
            # ein zweiter Join auf dieselbe Tabelle ohne Alias wäre ein Fehler.
            # Alles sind n:1-Joins, es entstehen also keine doppelten Zeilen.
            # Kunde und Maschine sind optional -> LEFT JOIN.
            return (
                stmt.join(plant, Tool.plant_id == plant.id)
                .join(tool_type, Tool.tool_type_id == tool_type.id)
                .outerjoin(position, Tool.position_id == position.id)
                .outerjoin(drawer, position.drawer_id == drawer.id)
                .outerjoin(cabinet, drawer.cabinet_id == cabinet.id)
                .outerjoin(customer, Tool.customer_id == customer.id)
                .outerjoin(machine, Tool.machine_id == machine.id)
            )

        conditions = []
        if q and q.strip():
            term = q.strip()
            like = f"%{term}%"
            # Suchfelder der Oberfläche: Werkzeug-ID, Bezeichnung, Typ, Werk,
            # Kunde und Maschine (alle sechs stehen als Spalte in der Liste).
            search_fields = [
                Tool.tool_id.ilike(like),
                Tool.description.ilike(like),
                tool_type.name.ilike(like),
                plant.name.ilike(like),
                customer.name.ilike(like),
                machine.name.ilike(like),
            ]
            # Zusätzlich die Kategorie: wer "Stempel" tippt, erwartet die
            # Stempel — die Kategorie ist kein eigener Suchbegriff, sondern
            # steht ebenfalls als Spalte in der Oberfläche.
            matched_categories = [
                category
                for category in ToolCategory
                if term.lower() in category.value.lower()
            ]
            if matched_categories:
                search_fields.append(Tool.category.in_(matched_categories))
            # „ohne ID" steht als Wert in der Liste, also ist es auch ein
            # Suchbegriff (DEC-055): wer „ohne" tippt, sucht die Datensätze ohne
            # Werkzeug-ID. Ein ILIKE auf `tool_id` könnte NULL nie treffen –
            # dafür braucht es `IS NULL`.
            if "ohne id".startswith(term.lower()):
                search_fields.append(Tool.tool_id.is_(None))
            conditions.append(or_(*search_fields))
        if categories:
            conditions.append(Tool.category.in_(list(categories)))
        if statuses:
            # „Ohne Status = verfügbar" (DEC-080): Wer nach verfügbaren Werkzeugen
            # filtert, meint die, die man entnehmen darf – und das sind die ohne
            # Status genauso. `IN (…)` allein fände NULL nie.
            gewaehlt = list(statuses)
            if ToolStatus.AVAILABLE in gewaehlt:
                conditions.append(
                    or_(Tool.status.in_(gewaehlt), Tool.status.is_(None))
                )
            else:
                conditions.append(Tool.status.in_(gewaehlt))
        if plant_id is not None:
            conditions.append(Tool.plant_id == plant_id)
        if tool_type_id is not None:
            conditions.append(Tool.tool_type_id == tool_type_id)
        if is_storage is not None:
            conditions.append(Tool.is_storage == is_storage)
        if has_place is not None:
            conditions.append(
                Tool.position_id.isnot(None) if has_place else Tool.position_id.is_(None)
            )
        if favorites_only:
            conditions.append(Tool.is_favorite.is_(True))

        sort_columns = {
            "tool_id": (Tool.tool_id,),
            "description": (Tool.description,),
            "measure_a": (_MEASURE_A_NUMERIC,),
            "status": (_STATUS_RANK,),
            "plant": (plant.name,),
            "tool_type": (tool_type.name,),
            "location": (cabinet.name, drawer.name, position.name),
            "customer": (customer.name,),
            "machine": (machine.name,),
        }[sort]

        order_by = []
        for column in sort_columns:
            # NULLS LAST in beide Richtungen: leere Werte sollen die Liste
            # nicht anführen, egal ob auf- oder absteigend sortiert wird.
            ordering = column.asc() if order == "asc" else column.desc()
            order_by.append(ordering.nullslast())
        # Stabiler Tiebreaker: ohne ihn kann dieselbe Zeile auf zwei Seiten
        # auftauchen oder zwischen zwei Seiten verschwinden, sobald mehrere
        # Datensätze denselben Sortierwert haben (z. B. gleicher Status).
        order_by.append(Tool.id.asc())

        rows_query = (
            with_joins(
                select(
                    Tool,
                    cabinet.name.label("cabinet_name"),
                    drawer.name.label("drawer_name"),
                    position.name.label("position_name"),
                )
            )
            .where(*conditions)
            .order_by(*order_by)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(rows_query)
        rows: List[ToolListRow] = [
            (row[0], row[1], row[2], row[3]) for row in result.all()
        ]

        count_query = with_joins(select(func.count()).select_from(Tool)).where(
            *conditions
        )
        total = int((await self.db.execute(count_query)).scalar_one())

        return rows, total

    async def set_favorite(self, tool_id: int, is_favorite: bool) -> Optional[Tool]:
        """Favoriten-Markierung setzen. None, wenn das Werkzeug nicht existiert."""
        tool = await self.get(tool_id)
        if not tool:
            return None
        tool.is_favorite = is_favorite
        await self.db.commit()
        await self.db.refresh(tool)
        return tool

    async def get_by_tool_id(
        self,
        tool_id: Optional[str],
        category: ToolCategory,
        plant_id: int,
        is_storage: bool = False,
        exclude_id: Optional[int] = None,
    ) -> Optional[Tool]:
        """Sucht ein Werkzeug anhand seiner fachlichen ID.

        is_storage trennt normale Werkzeuge von Lager/Ersatz (eigener ID-Bereich).
        exclude_id blendet das eigene Werkzeug beim Bearbeiten aus.

        Ohne ID (None oder leer) gibt es nichts zu finden: Abstreifer und
        Matrize dürfen ohne ID angelegt werden (DEC-055), und ein Vergleich
        gegen NULL würde sie sonst alle als Dublette zueinander ausweisen.
        """
        if not tool_id:
            return None
        conditions = [
            self.model.tool_id == tool_id,
            self.model.category == category,
            self.model.plant_id == plant_id,
            self.model.is_storage == is_storage,
        ]
        if exclude_id is not None:
            conditions.append(self.model.id != exclude_id)
        query = select(self.model).where(and_(*conditions))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_all_by_tool_id(
        self,
        tool_id: Optional[str],
        category: ToolCategory,
        plant_id: int,
        is_storage: Optional[bool] = False,
        exclude_id: Optional[int] = None,
    ) -> List[Tool]:
        """Alle Werkzeuge mit dieser fachlichen ID (fuer die Fundort-Anzeige).

        Im Unterschied zu get_by_tool_id() bewusst eine Liste: Lager/Ersatz
        (is_storage=True) darf dieselbe ID mehrfach enthalten, und das Formular
        soll alle vorhandenen Exemplare samt Ort anzeigen koennen.

        is_storage=None hebt die Trennung zwischen normalen Werkzeugen und
        Lager/Ersatz auf - dann kommen beide Arten zurueck. Das Anlegeformular
        braucht das, damit "ID 01020000" nicht nur die Ersatz-Exemplare zeigt,
        sondern auch das normale Werkzeug auf seinem Lagerplatz.

        Ohne ID ist die Liste leer: "ohne ID" ist keine gemeinsame ID, sondern
        das Fehlen einer Angabe (DEC-055).
        """
        if not tool_id:
            return []
        conditions = [
            self.model.tool_id == tool_id,
            self.model.category == category,
            self.model.plant_id == plant_id,
        ]
        if is_storage is not None:
            conditions.append(self.model.is_storage == is_storage)
        if exclude_id is not None:
            conditions.append(self.model.id != exclude_id)
        query = select(self.model).where(and_(*conditions)).order_by(self.model.id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_tool_id(
        self,
        tool_id: Optional[str],
        category: ToolCategory,
        plant_id: int,
        is_storage: bool = False,
        exclude_id: Optional[int] = None,
    ) -> int:
        """Anzahl vorhandener Werkzeuge mit dieser fachlichen ID.

        Fuer Lager/Ersatz (is_storage=True) sind Mehrfach-IDs erlaubt -
        die Anzahl zeigt, als wievieltes Exemplar ein neues angelegt wird.
        exclude_id blendet das eigene Werkzeug beim Bearbeiten aus.

        Ohne ID ist die Anzahl 0 (DEC-055): es gibt nichts zu zählen.
        """
        if not tool_id:
            return 0
        conditions = [
            self.model.tool_id == tool_id,
            self.model.category == category,
            self.model.plant_id == plant_id,
            self.model.is_storage == is_storage,
        ]
        if exclude_id is not None:
            conditions.append(self.model.id != exclude_id)
        query = select(func.count()).select_from(self.model).where(and_(*conditions))
        result = await self.db.execute(query)
        return int(result.scalar_one())
