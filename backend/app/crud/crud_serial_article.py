from typing import List, Literal, Optional, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import aliased

from ..models.master_data import Customer, Machine, Plant
from ..models.serial_article import SerialArticle
from .base import CRUDBase

# Sortierbare Spalten der Serienartikel-Liste. Die Whitelist liegt hier und
# nicht im Router: der Router validiert sie per Literal (ungültig -> HTTP 422),
# damit niemals ein Spaltenname aus der Anfrage an die Datenbank gereicht wird.
SerialArticleSortKey = Literal[
    "article_number",
    "name",
    "plant",
    "customer",
    "machine",
    "created_at",
]
SerialArticleSortOrder = Literal["asc", "desc"]


class CRUDSerialArticle(CRUDBase):
    model = SerialArticle

    async def get_multi(
        self,
        search: Optional[str] = None,
        plant_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        machine_id: Optional[int] = None,
        has_pdf: Optional[bool] = None,
        favorites_only: bool = False,
        sort: SerialArticleSortKey = "article_number",
        order: SerialArticleSortOrder = "asc",
        skip: int = 0,
        limit: int = 25,
    ) -> Tuple[List[SerialArticle], int]:
        """Gefilterte, sortierte und seitenweise Liste samt Gesamtzahl.

        Filter, Sortierung und Ausschnitt passieren in der Datenbank: die Liste
        kann nicht mehr alle Datensätze laden und im Browser filtern (vorher
        fehlten ab 100 Einträgen Datensätze stillschweigend).
        """
        # Aliase statt der eager geladenen Beziehungen: die Relationship-Joins
        # von SerialArticle.plant/customer/machine stehen bereits in der Abfrage,
        # ein zweiter Join auf dieselbe Tabelle ohne Alias wäre ein Fehler.
        # Alles sind n:1-Joins, es entstehen also keine doppelten Zeilen.
        plant = aliased(Plant)
        customer = aliased(Customer)
        machine = aliased(Machine)

        def with_joins(stmt):
            return (
                stmt.join(plant, SerialArticle.plant_id == plant.id)
                .outerjoin(customer, SerialArticle.customer_id == customer.id)
                .outerjoin(machine, SerialArticle.machine_id == machine.id)
            )

        conditions = []
        if search and search.strip():
            term = search.strip()
            like = f"%{term}%"
            # Suchfelder der Oberfläche: Artikelnummer, Name, Beschreibung, Werk,
            # Kunde und Maschine – genau die sechs Angaben, die ein Werker kennt.
            conditions.append(
                or_(
                    SerialArticle.article_number.ilike(like),
                    SerialArticle.name.ilike(like),
                    SerialArticle.description.ilike(like),
                    plant.name.ilike(like),
                    customer.name.ilike(like),
                    machine.name.ilike(like),
                )
            )
        if plant_id is not None:
            conditions.append(SerialArticle.plant_id == plant_id)
        if customer_id is not None:
            conditions.append(SerialArticle.customer_id == customer_id)
        if machine_id is not None:
            conditions.append(SerialArticle.machine_id == machine_id)
        if has_pdf is not None:
            conditions.append(
                SerialArticle.pdf_path.isnot(None)
                if has_pdf
                else SerialArticle.pdf_path.is_(None)
            )
        if favorites_only:
            # Globaler Favorit (nicht pro Benutzer) – wie in der Werkzeugliste.
            conditions.append(SerialArticle.is_favorite.is_(True))

        sort_columns = {
            "article_number": (SerialArticle.article_number,),
            "name": (SerialArticle.name,),
            "plant": (plant.name,),
            "customer": (customer.name,),
            "machine": (machine.name,),
            "created_at": (SerialArticle.created_at,),
        }[sort]

        order_by = []
        for column in sort_columns:
            # NULLS LAST in beide Richtungen: leere Angaben sollen die Liste
            # nicht anführen, egal ob auf- oder absteigend sortiert wird.
            ordering = column.asc() if order == "asc" else column.desc()
            order_by.append(ordering.nullslast())
        # Stabiler Tiebreaker: ohne ihn kann dieselbe Zeile auf zwei Seiten
        # auftauchen oder zwischen zwei Seiten verschwinden (gleiches Werk,
        # gleicher Kunde o. ä.).
        order_by.append(SerialArticle.id.asc())

        rows_query = (
            with_joins(select(SerialArticle))
            .where(*conditions)
            .order_by(*order_by)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(rows_query)
        items = list(result.scalars().unique().all())

        count_query = with_joins(select(func.count()).select_from(SerialArticle)).where(
            *conditions
        )
        total = int((await self.db.execute(count_query)).scalar_one())

        return items, total

    async def set_favorite(
        self, article_id: int, is_favorite: bool
    ) -> Optional[SerialArticle]:
        """Favoriten-Markierung setzen (global). None, wenn es den Artikel nicht gibt.

        Eigener Weg statt `apply_update`, weil die Markierung über einen eigenen
        Endpunkt gesetzt wird und ein normales Bearbeiten sie nicht anfassen darf
        (DEC-063).
        """
        article = await self.get(article_id)
        if article is None:
            return None
        article.is_favorite = is_favorite
        await self.db.commit()
        await self.db.refresh(article)
        return article

    async def get_by_article_number(
        self, article_number: str, exclude_id: Optional[int] = None
    ) -> Optional[SerialArticle]:
        """Artikel anhand seiner Nummer (optional ohne den eigenen Datensatz).

        Verwendet für die Dublettenprüfung beim Anlegen, beim Umbenennen und in
        der Live-Prüfung des Formulars.
        """
        if not article_number or not article_number.strip():
            return None
        conditions = [SerialArticle.article_number == article_number.strip()]
        if exclude_id is not None:
            conditions.append(SerialArticle.id != exclude_id)
        result = await self.db.execute(select(SerialArticle).where(*conditions))
        return result.scalar_one_or_none()

    async def create_article(
        self, data, pdf_path: Optional[str] = None
    ) -> SerialArticle:
        """Neuen Artikel anlegen. `extra_metadata` gibt es nicht mehr (DEC-056)."""
        db_obj = SerialArticle(
            article_number=data.article_number,
            name=data.name,
            description=data.description,
            plant_id=data.plant_id,
            customer_id=data.customer_id,
            machine_id=data.machine_id,
            pdf_path=pdf_path,
        )
        self.db.add(db_obj)
        await self.db.commit()
        await self.db.refresh(db_obj)
        return db_obj

    async def apply_update(self, article: SerialArticle, values: dict) -> SerialArticle:
        """Änderung übernehmen – auch bewusst gesendete `None`-Werte.

        `CRUDBase.update()` überspringt None-Werte. Für dieses Formular ist das
        falsch: „Kunde entfernen" oder „Beschreibung leeren" sendet ausdrücklich
        None und muss ankommen (dieselbe Überlegung wie bei
        `ToolService.update_tool()`, siehe `docs/05-tools.md` §7).
        """
        for key, value in values.items():
            setattr(article, key, value)
        await self.db.commit()
        await self.db.refresh(article)
        return article

    async def set_pdf_path(
        self, article: SerialArticle, pdf_path: Optional[str]
    ) -> SerialArticle:
        """Speicherpfad des Einrichteplans setzen oder leeren."""
        article.pdf_path = pdf_path
        await self.db.commit()
        await self.db.refresh(article)
        return article
