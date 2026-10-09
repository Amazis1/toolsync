from typing import List, Literal, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import aliased

from ..models.data_sheet import DataSheet
from ..models.master_data import Machine, Plant
from .base import CRUDBase

# Sortierbare Spalten der Datenblatt-Liste. Die Whitelist liegt hier und nicht im
# Router: der Router validiert sie per Literal (ungültig -> HTTP 422), damit
# niemals ein Spaltenname aus der Anfrage an die Datenbank gereicht wird.
DataSheetSortKey = Literal[
    "tool_id",
    "name",
    "plant",
    "machine",
    "created_at",
]
DataSheetSortOrder = Literal["asc", "desc"]


class CRUDDataSheet(CRUDBase):
    model = DataSheet

    async def get_multi(
        self,
        search: Optional[str] = None,
        tool_id: Optional[str] = None,
        plant_id: Optional[int] = None,
        machine_id: Optional[int] = None,
        has_pdf: Optional[bool] = None,
        favorites_only: bool = False,
        sort: DataSheetSortKey = "tool_id",
        order: DataSheetSortOrder = "asc",
        skip: int = 0,
        limit: int = 25,
    ) -> Tuple[List[DataSheet], int]:
        """Gefilterte, sortierte und seitenweise Liste samt Gesamtzahl."""
        # Aliase statt der eager geladenen Beziehungen: die Relationship-Joins von
        # DataSheet.plant/machine stehen bereits in der Abfrage, ein zweiter Join
        # auf dieselbe Tabelle ohne Alias wäre ein Fehler (beides n:1).
        plant = aliased(Plant)
        machine = aliased(Machine)

        def with_joins(stmt):
            return stmt.join(plant, DataSheet.plant_id == plant.id).outerjoin(
                machine, DataSheet.machine_id == machine.id
            )

        conditions = []
        if search and search.strip():
            like = f"%{search.strip()}%"
            # Suchfelder der Oberfläche: Werkzeug-ID, Name, Beschreibung sowie
            # Werk- und Maschinenname – die Angaben, die ein Werker kennt.
            conditions.append(
                or_(
                    DataSheet.tool_id.ilike(like),
                    DataSheet.name.ilike(like),
                    DataSheet.description.ilike(like),
                    plant.name.ilike(like),
                    machine.name.ilike(like),
                )
            )
        if tool_id is not None:
            # **Exakter** Vergleich, nicht `ilike`: Aus der Werkzeugzeile wird
            # diese Abfrage mit der ID des Werkzeugs aufgerufen, um dessen
            # Datenblatt zu finden. Mit `ilike` waere „188" auch in „1880"
            # enthalten und die Liste zeigte ein fremdes Datenblatt.
            conditions.append(DataSheet.tool_id == tool_id.strip())
        if plant_id is not None:
            conditions.append(DataSheet.plant_id == plant_id)
        if machine_id is not None:
            conditions.append(DataSheet.machine_id == machine_id)
        if has_pdf is not None:
            conditions.append(
                DataSheet.pdf_path.isnot(None)
                if has_pdf
                else DataSheet.pdf_path.is_(None)
            )
        if favorites_only:
            conditions.append(DataSheet.is_favorite.is_(True))

        sort_columns = {
            "tool_id": (DataSheet.tool_id,),
            "name": (DataSheet.name,),
            "plant": (plant.name,),
            "machine": (machine.name,),
            "created_at": (DataSheet.created_at,),
        }[sort]

        order_by = []
        for column in sort_columns:
            # NULLS LAST in beide Richtungen: Datenblätter **ohne** Werkzeug-ID
            # (DEC-055) sollen die Liste nicht anführen.
            ordering = column.asc() if order == "asc" else column.desc()
            order_by.append(ordering.nullslast())
        # Stabiler Tiebreaker: ohne ihn kann dieselbe Zeile auf zwei Seiten
        # auftauchen – bei mehreren Datenblättern je Werkzeug-ID leicht möglich.
        order_by.append(DataSheet.id.asc())

        rows_query = (
            with_joins(select(DataSheet))
            .where(*conditions)
            .order_by(*order_by)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(rows_query)
        items = list(result.scalars().unique().all())

        count_query = with_joins(select(func.count()).select_from(DataSheet)).where(
            *conditions
        )
        total = int((await self.db.execute(count_query)).scalar_one())

        return items, total

    async def get_by_tool_ids(self, tool_ids: List[str]) -> List[DataSheet]:
        """Alle Datenblätter zu diesen Werkzeug-IDs – **eine** Abfrage.

        Für die Werkzeugliste (DEC-068): sie zeigt je Zeile ein Symbol, wenn es
        zu der ID ein Datenblatt **mit Datei** gibt. Statt je Zeile nachzufragen,
        holt der Service die Datensätze der ganzen Seite in einem Zug.
        """
        if not tool_ids:
            return []
        query = select(DataSheet).where(DataSheet.tool_id.in_(list(tool_ids)))
        result = await self.db.execute(query)
        return list(result.scalars().unique().all())

    async def count_by_tool_id(
        self, tool_id: str, exclude_id: Optional[int] = None
    ) -> int:
        """Wie viele Datenblätter gibt es zu dieser Werkzeug-ID?

        Für den Hinweis im Formular („zu dieser ID gibt es bereits 2 Datenblätter").
        Mehrere sind erlaubt – kein Fehler, nur eine Information (DEC-065).
        """
        if not tool_id or not tool_id.strip():
            return 0
        conditions = [DataSheet.tool_id == tool_id.strip()]
        if exclude_id is not None:
            conditions.append(DataSheet.id != exclude_id)
        query = select(func.count()).select_from(DataSheet).where(*conditions)
        return int((await self.db.execute(query)).scalar_one())

    async def create_sheet(
        self, data, pdf_path: Optional[str] = None
    ) -> DataSheet:
        """Neuen Datensatz anlegen."""
        db_obj = DataSheet(
            tool_id=data.tool_id,
            plant_id=data.plant_id,
            machine_id=data.machine_id,
            name=data.name,
            description=data.description,
            pdf_path=pdf_path,
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def apply_update(self, sheet: DataSheet, values: dict) -> DataSheet:
        """Änderung übernehmen – auch bewusst gesendete `None`-Werte.

        `CRUDBase.update()` überspringt None-Werte. Für dieses Formular ist das
        falsch: „Werkzeug-ID entfernen" oder „Maschine entfernen" sendet
        ausdrücklich None und muss ankommen (wie bei `CRUDTool.apply_update()`).
        """
        for key, value in values.items():
            setattr(sheet, key, value)
        await self.db.commit()
        await self.db.refresh(sheet)
        return sheet

    async def set_pdf_path(
        self, sheet: DataSheet, pdf_path: Optional[str]
    ) -> DataSheet:
        """Speicherpfad des ersten Datenblatts setzen oder leeren."""
        sheet.pdf_path = pdf_path
        await self.db.commit()
        await self.db.refresh(sheet)
        return sheet

    async def set_favorite(
        self, sheet_id: int, is_favorite: bool
    ) -> Optional[DataSheet]:
        """Favoriten-Markierung setzen (global). None, wenn es den Datensatz nicht gibt."""
        sheet = await self.get(sheet_id)
        if sheet is None:
            return None
        sheet.is_favorite = is_favorite
        await self.db.commit()
        await self.db.refresh(sheet)
        return sheet
