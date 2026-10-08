"""Tool-Service: Business-Logik für Werkzeuge inkl. Lagerplatz-Synchronisierung."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Sequence

from ..models.tool import Tool
from ..models.storage import Position, Cabinet, Drawer
from ..models.enums import ToolCategory, ToolStatus
from ..crud.crud_tool import CRUDTool, ToolSortKey, ToolSortOrder
from ..schemas.tool import ToolRead


def assert_tool_identity(
    tool_id: Optional[str],
    category: ToolCategory,
    measure_a: Optional[str] = None,
) -> None:
    """Regel der Werkzeug-ID je Kategorie (DEC-055).

    Stempel werden über ihre ID geführt: sie kommt aus SAP und ist eingraviert,
    ohne ID ist ein Stempel im Betrieb nicht auffindbar. Abstreifer und Matrize
    werden über ihr Maß geführt - dort ist die ID freiwillig.

    Deshalb gilt für **alle drei** Kategorien: Maß A ist Pflicht. Bei Abstreifer
    und Matrize ist es das **einzige** Merkmal, über das sie geführt werden -
    ohne Maß ist der Datensatz in der Liste nicht zu identifizieren. Vorher
    prüfte das nur das Formular, die API nahm ein Werkzeug ohne Maß A an: über
    das Formular unmöglich, über die Schnittstelle problemlos.

    Die Prüfung sitzt hier und nicht im Schema: `ToolUpdate` wird auch als
    Teil-Update gesendet, ein Schema-Validator würde dann bei jedem Update ohne
    ID-Feld anschlagen. Hier gilt die Regel für Anlegen und Bearbeiten an
    derselben Stelle und mit derselben Meldung.
    """
    if category == ToolCategory.STEMPEL and not tool_id:
        raise ValueError(
            "Für Stempel ist die Werkzeug-ID erforderlich – "
            "ohne ID lassen sich nur Abstreifer und Matrize anlegen."
        )
    if measure_a is None or not str(measure_a).strip():
        raise ValueError(
            "Maß A ist erforderlich – Abstreifer und Matrize werden über ihr Maß "
            "geführt (z. B. 7,00)."
        )


class ToolService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.crud = CRUDTool(db)

    async def get_tools(
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
    ) -> dict:
        """Liste, Suche, Filter, Sortierung und Pagination in der Datenbank.

        Rückgabe ist die Seitendarstellung: die Datensätze dieser Seite plus
        die Gesamtzahl der Treffer (Grundlage für „1–25 von 342" und für die
        Seitenzahlen in der Oberfläche).

        Jeder Datensatz trägt zusätzlich seinen Lagerplatz-Code ("01-A-25"),
        damit die Liste nicht pro Zeile nachfragen muss. `position_code = None`
        heißt: das Werkzeug liegt in der Ablage.
        """
        rows, total = await self.crud.get_multi(
            q=q,
            categories=categories,
            statuses=statuses,
            plant_id=plant_id,
            tool_type_id=tool_type_id,
            is_storage=is_storage,
            has_place=has_place,
            favorites_only=favorites_only,
            sort=sort,
            order=order,
            skip=skip,
            limit=limit,
        )

        items = []
        for tool, cabinet_name, drawer_name, position_name in rows:
            read = ToolRead.model_validate(tool)
            items.append(
                read.model_copy(
                    update={
                        "position_code": self._compose_position_code(
                            cabinet_name, drawer_name, position_name
                        )
                    }
                )
            )

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    async def get_tool_read(self, tool_id: int) -> Optional[ToolRead]:
        """Einzelwerkzeug samt Lagerplatz-Code (None, wenn es nicht existiert)."""
        tool = await self.crud.get(tool_id)
        if not tool:
            return None
        code = None
        if tool.position_id is not None:
            position = await self._get_position(tool.position_id)
            code = await self._position_code(position) if position else None
        return ToolRead.model_validate(tool).model_copy(
            update={"position_code": code}
        )

    async def set_favorite(self, tool_id: int, is_favorite: bool) -> Optional[Tool]:
        """Favoriten-Markierung setzen (global für alle Benutzer)."""
        return await self.crud.set_favorite(tool_id, is_favorite)

    def _compose_position_code(
        self,
        cabinet_name: Optional[str],
        drawer_name: Optional[str],
        position_name: Optional[str],
    ) -> Optional[str]:
        """Platz-Code wie "01-A-25" aus den drei Namensteilen bauen.

        None, wenn das Werkzeug keinen festen Platz hat (= Ablage).
        """
        if not position_name:
            return None
        return f"{cabinet_name or '??'}-{drawer_name or '??'}-{position_name}"

    async def get_tool(self, tool_id: int) -> Optional[Tool]:
        return await self.crud.get(tool_id)

    async def check_tool_id(
        self,
        tool_id: Optional[str],
        category: ToolCategory,
        plant_id: int,
        is_storage: bool = False,
        exclude_id: Optional[int] = None,
    ) -> dict:
        """Live-Pruefung der Werkzeug-ID (fuer das Anlegeformular).

        Normale Werkzeuge: ID muss in Werk + Kategorie eindeutig sein.
        Lager/Ersatz (is_storage=True): Mehrfach-IDs sind ausdruecklich
        erlaubt (DEC-052) - die Pruefung blockiert dort nie.

        Zurueckgegeben werden ALLE Datensaetze dieser ID, also normale
        Werkzeuge UND Lager/Ersatz. Fachlich sind das zwei getrennte
        ID-Bereiche, fuer den Benutzer ist es aber dieselbe ID: wer
        "01020000" sieht, erwartet das aktive Werkzeug auf dem Lagerplatz
        genauso wie das Ersatz-Exemplar in der Ablage.

        locations enthaelt je Datensatz Fundort, Status und die Daten, die
        beim Anlegen eines weiteren Exemplars uebernommen werden koennen.
        prefill ist der daraus abgeleitete Uebernahme-Vorschlag (None, wenn
        es nichts zu uebernehmen gibt).

        Ohne ID (Abstreifer/Matrize, DEC-055) gibt es nichts zu pruefen: "ohne
        ID" ist keine geteilte ID, sondern das Fehlen einer Angabe.
        """
        if not tool_id:
            return {
                "available": True,
                "existing_count": 0,
                "message": "Ohne Werkzeug-ID wird nichts geprüft – Maß A ist hier das Pflichtfeld.",
                "locations": [],
                "prefill": None,
            }

        tools = await self.crud.get_all_by_tool_id(
            tool_id, category, plant_id, is_storage=None, exclude_id=exclude_id
        )
        locations = [await self._describe_existing_tool(t) for t in tools]
        prefill = self._build_prefill(tools, locations)

        if is_storage:
            # Mehrfach-IDs sind erlaubt - der Benutzer entscheidet, ob er
            # wirklich ein weiteres Exemplar anlegen will.
            if not tools:
                message = "Diese ID gibt es hier noch nicht."
            else:
                message = f"Diese ID gibt es hier bereits {len(tools)}×."
            return {
                "available": True,
                "existing_count": len(tools),
                "message": message,
                "locations": locations,
                "prefill": prefill,
            }

        # Normales Werkzeug: nur die normalen Werkzeuge zaehlen, Lager/Ersatz
        # hat einen eigenen ID-Bereich und blockiert hier nicht.
        normal_count = sum(1 for t in tools if not t.is_storage)
        if normal_count > 0:
            return {
                "available": False,
                "existing_count": normal_count,
                "message": f"Werkzeug-ID {tool_id} ist in diesem Werk bereits vergeben.",
                "locations": locations,
                "prefill": prefill,
            }
        return {
            "available": True,
            "existing_count": 0,
            "message": "Werkzeug-ID ist frei.",
            "locations": locations,
            "prefill": prefill,
        }

    async def create_tool(self, data) -> Tool:
        # Stempel brauchen eine ID, Abstreifer und Matrize nicht (DEC-055);
        # Maß A brauchen alle drei. Die Meldung landet als HTTP 400 im Formular.
        assert_tool_identity(data.tool_id, data.category, data.measure_a)

        # is_storage muss mitgegeben werden, sonst wird immer gegen die
        # normalen Werkzeuge geprueft und Lager/Ersatz laeuft ins Leere.
        # Ohne ID findet die Pruefung nichts (get_by_tool_id) – ID-lose
        # Datensätze sind keine Dubletten zueinander.
        existing = await self.crud.get_by_tool_id(
            data.tool_id, data.category, data.plant_id, data.is_storage
        )
        if existing and not data.allow_duplicate_id:
            raise ValueError(f"Werkzeug-ID {data.tool_id} existiert bereits!")

        # Wenn ein Platz angegeben ist, prüfen ob er frei ist
        if data.position_id:
            position = await self._get_position(data.position_id)
            if not position:
                raise ValueError("Angegebener Platz existiert nicht.")
            if position.tool_id is not None:
                raise ValueError(f"Platz {position.name} ist bereits belegt.")
            # Ein Platz kann auch ein **Ersatzteil** halten (DEC-064) – dann ist er
            # ebenso belegt und darf kein Werkzeug aufnehmen (Anforderung 7.2).
            if position.spare_part is not None:
                raise ValueError(
                    f"Platz {position.name} ist mit dem Ersatzteil "
                    f"„{position.spare_part.article_number}“ belegt."
                )

        tool = await self.crud.create(data)

        # Position-Tool-Sync: tool_id an der Position setzen
        if data.position_id:
            await self._set_position_tool(data.position_id, tool.id)

        return tool

    async def update_tool(self, tool_id: int, data) -> Tool:
        old_tool = await self.crud.get(tool_id)
        if not old_tool:
            return None

        # Bewusst gesendete Felder (exclude_unset) – auch die mit Wert null.
        # `position_id` ist optional und wird über das Vorhandensein erkannt.
        payload = data.model_dump(exclude_unset=True)

        # Wirksame Werte: bei einem Teil-Update bleibt der bisherige Wert
        # stehen. Sonst prüfte die Duplikat-Suche gegen `None` und ein
        # Update ohne ID-Feld käme an der Regel vorbei.
        new_tool_id = payload.get("tool_id", old_tool.tool_id)
        new_category = payload.get("category", old_tool.category)
        new_plant_id = payload.get("plant_id", old_tool.plant_id)
        new_is_storage = payload.get("is_storage", old_tool.is_storage)
        new_allow_duplicate = payload.get(
            "allow_duplicate_id", old_tool.allow_duplicate_id
        )
        # Wie oben: ein Teil-Update ohne `measure_a` prüft gegen den bisherigen
        # Wert, sonst käme es an der Pflicht vorbei.
        new_measure_a = payload.get("measure_a", old_tool.measure_a)

        # Auch beim Bearbeiten: die ID eines Stempels lässt sich nicht leeren
        # und Maß A lässt sich nicht entfernen (DEC-055). Ohne diese Prüfung
        # würde ein Update den Datensatz still unauffindbar machen.
        assert_tool_identity(new_tool_id, new_category, new_measure_a)

        # Duplikat-Pruefung auch beim Bearbeiten - das eigene Werkzeug
        # wird ueber exclude_id ausgenommen, sonst blockiert es sich selbst.
        existing = await self.crud.get_by_tool_id(
            new_tool_id,
            new_category,
            new_plant_id,
            new_is_storage,
            exclude_id=tool_id,
        )
        if existing and not new_allow_duplicate:
            raise ValueError(f"Werkzeug-ID {new_tool_id} existiert bereits!")

        old_position_id = old_tool.position_id
        new_position_id = payload.get("position_id", old_position_id)

        # Neuer Platz: existiert er und ist er frei?
        if new_position_id and new_position_id != old_position_id:
            position = await self._get_position(new_position_id)
            if not position:
                raise ValueError("Angegebener Platz existiert nicht.")
            if position.tool_id is not None:
                raise ValueError(f"Platz {position.name} ist bereits belegt.")
            if position.spare_part is not None:
                raise ValueError(
                    f"Platz {position.name} ist mit dem Ersatzteil "
                    f"„{position.spare_part.article_number}“ belegt."
                )

        # Felder direkt übernehmen statt über CRUDBase.update: das überspringt
        # None-Werte ("None = nicht ändern") und macht damit jedes Leeren
        # unmöglich — Status, Beschreibung, Maß B, Maschine, Kunde und
        # position_id ließen sich so nie zurücksetzen (gemeldeter Fall: Status
        # blieb nach dem Zurückstellen auf „ohne Status" erhalten).
        for field, value in payload.items():
            setattr(old_tool, field, value)
        await self.db.commit()
        await self.db.refresh(old_tool)

        tool = old_tool

        # Alten Platz freigeben, wenn sich die Position geändert hat
        if old_position_id and old_position_id != new_position_id:
            await self._release_position(old_position_id)

        # Neuen Platz belegen (None = Ablage, nichts zu belegen)
        if new_position_id:
            await self._set_position_tool(new_position_id, tool.id)

        return tool

    async def delete_tool(self, tool_id: int) -> None:
        tool = await self.crud.get(tool_id)
        if tool and tool.position_id:
            await self._release_position(tool.position_id)
        await self.crud.delete(tool_id)

    # ---------------------------------------------------------
    # Hilfsfunktionen für die Platz-Synchronisierung
    # ---------------------------------------------------------
    async def _get_position(self, position_id: int) -> Optional[Position]:
        result = await self.db.execute(
            select(Position).where(Position.id == position_id)
        )
        return result.scalar_one_or_none()

    async def _set_position_tool(self, position_id: int, tool_id: int) -> None:
        position = await self._get_position(position_id)
        if position:
            position.tool_id = tool_id
            await self.db.commit()

    async def _release_position(self, position_id: int) -> None:
        position = await self._get_position(position_id)
        if position:
            position.tool_id = None
            await self.db.commit()

    # ---------------------------------------------------------
    # Hilfsfunktionen für die Fundort-Anzeige (Lager/Ersatz)
    # ---------------------------------------------------------
    async def _describe_existing_tool(self, tool: Tool) -> dict:
        """Ein vorhandener Datensatz mit dieser ID für das Anlegeformular.

        Liefert den Fundort (Platz-Code wie "01-A-25" oder "Ablage", wenn das
        Werkzeug keinen festen Lagerplatz hat) und dazu die Felder, die der
        Benutzer beim Anlegen eines weiteren Exemplars nicht neu tippen soll.
        """
        if tool.position_id is None:
            code = "Ablage"
        else:
            position = await self._get_position(tool.position_id)
            code = await self._position_code(position) if position else "??-??-??"
        return {
            "id": tool.id,
            "location": code,
            "status": tool.status.value if tool.status else None,
            # False = normales Werkzeug, True = Lager/Ersatz. Das Formular
            # beschriftet die Zeile damit ("Werkzeug" / "Ersatz").
            "is_storage": tool.is_storage,
            "position_id": tool.position_id,
            "measure_a": tool.measure_a,
            "measure_b": tool.measure_b,
            "description": tool.description,
            "tool_type_id": tool.tool_type_id,
            "tool_type_name": tool.tool_type.name if tool.tool_type else None,
        }

    def _build_prefill(self, tools: List[Tool], locations: List[dict]) -> Optional[dict]:
        """Was beim Anlegen eines weiteren Exemplars übernommen wird.

        Vorlage ist der Datensatz mit festem Lagerplatz - er ist der
        vollständigere Datensatz und hat Vorrang vor einem Exemplar in der
        Ablage. Innerhalb dieser Gruppe gewinnt ein Lager/Ersatz-Exemplar,
        danach der zuletzt angelegte Datensatz.

        Rueckgabe None, wenn es zu dieser ID noch nichts zu uebernehmen gibt.
        """
        if not tools:
            return None

        # Datensätze mit festem Lagerplatz zuerst.
        with_place = [t for t in tools if t.position_id is not None]
        pool = with_place or tools
        storage_in_pool = [t for t in pool if t.is_storage]
        template = max(storage_in_pool or pool, key=lambda t: t.id)
        location = next((loc["location"] for loc in locations if loc["id"] == template.id), None)

        return {
            "source_id": template.id,
            "source_location": location,
            "source_is_storage": template.is_storage,
            "measure_a": template.measure_a,
            "measure_b": template.measure_b,
            "description": template.description,
            "tool_type_id": template.tool_type_id,
            # "In Ablage legen" nur vorbelegen, wenn KEIN Datensatz der ID einen
            # festen Lagerplatz hat. Sonst haette die Ablage Vorrang vor dem
            # Datensatz mit Platz - ein Platz kann aber nur ein Werkzeug
            # halten, deshalb bleibt die Platzwahl dann offen.
            "in_tray": not with_place,
        }

    async def _position_code(self, position: Position) -> str:
        """Platz-Code wie '03-C-01' erzeugen.

        Gleiches Muster wie LocationService._position_code(); hier bewusst
        nachgebildet, um keinen Zyklus zwischen den Services zu erzeugen.
        """
        drawer = await self.db.get(Drawer, position.drawer_id)
        if drawer is None:
            return f"??-??-{position.name}"
        cabinet = await self.db.get(Cabinet, drawer.cabinet_id)
        return f"{cabinet.name if cabinet else '??'}-{drawer.name}-{position.name}"
