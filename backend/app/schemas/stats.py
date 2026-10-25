"""Kennzahlen der rechten Spalte (DEC-089).

Die Karten „Aktive Ausleihen / Verfügbare Werkzeuge / Offene Aufträge / Eingang
offen" standen seit dem ersten Entwurf auf „—" – die rechte Spalte war die letzte
offene Frage aus `docs/21` (offene Frage 7). Dieses Schema liefert die Zahlen
dafür in **einer** Antwort: Alle Werte gelten für das **Arbeitswerk** aus
`X-Plant-Id` und werden in einer Anfrage gezählt (statt vier Anfragen aus der
Oberfläche).

Bewusst flach (nur `int`): Die Karten zeigen eine Zahl und einen Anteil, keine
Zeitreihen.
"""

from pydantic import BaseModel


class StatsOverview(BaseModel):
    """Kennzahlen des Arbeitswerks für die rechte Spalte."""

    # --- Werkzeuge -------------------------------------------------------
    tools_total: int
    """Alle Werkzeuge dieses Werks (unabhängig vom Zustand)."""
    tools_available: int
    """Verfügbar – `AVAILABLE` **oder kein Status** (DEC-080: „kein Status = verfügbar")."""
    tools_lent: int
    """Bei einer Person ausgeliehen."""
    tools_in_transit: int
    """Zwischen den Werken unterwegs (in einem Auftrag)."""
    tools_storage: int
    """Lager/Ersatz (Verbrauchsmaterial, DEC-064)."""

    # --- Stammdaten ------------------------------------------------------
    serial_articles: int
    """Serienartikel dieses Werks."""
    data_sheets: int
    """Datenblätter dieses Werks **plus** die allgemeinen (ohne Werk, DEC-085)."""
    spare_parts: int
    """Ersatzteile dieses Werks."""

    # --- Logistik --------------------------------------------------------
    orders_open: int
    """Offene Aufträge in beiden Richtungen (`draft`, `sent`, `partly_received`)."""
    orders_draft: int
    """Entwürfe – angelegt, aber noch nicht verschickt."""
    orders_sent: int
    """Unterwegs (verschickt oder teilweise angekommen) – ausgehend **und** eingehend."""
    orders_incoming_open: int
    """Eingehende Aufträge, die hier noch bestätigt werden müssen."""
    orders_old: int
    """Offene Aufträge, die seit mindestens 7 Tagen laufen."""
