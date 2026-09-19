"""Einmalige Bereinigung: Positionen und Werkzeuge konsistent machen.

Regeln:
1. Verwaiste Verweise (tool_id/position_id zeigt auf nicht existierenden
   Datensatz) werden auf NULL gesetzt.
2. Werkzeug.position_id -> Position.tool_id und umgekehrt werden
   synchronisiert, sofern kein Konflikt besteht.
3. Doppelte position.tool_id werden entfernt (es bleibt der Eintrag,
   dessen Position zur Werkzeug.position_id passt, sonst der kleinste id).

Das Skript arbeitet explizit mit SQLite (toolsync.db), wie es auch die
bestehenden Diagnose-Skripte tun.
"""
import sqlite3


def main() -> None:
    conn = sqlite3.connect("toolsync.db")
    cur = conn.cursor()

    print("=== BESTANDSAUFNAHME ===")
    cur.execute("SELECT id, tool_id, position_id FROM tools ORDER BY id")
    tools_before = cur.fetchall()
    cur.execute("SELECT id, drawer_id, name, tool_id FROM positions ORDER BY id")
    positions_before = cur.fetchall()

    tool_positions = {row[0]: row[2] for row in tools_before}
    position_tools = {row[0]: row[3] for row in positions_before}
    tool_ids = {row[0] for row in tools_before}

    konflikte: list[str] = []

    # 1. Verwaiste position.tool_id entfernen
    for position_id, tool_id in position_tools.items():
        if tool_id is not None and tool_id not in tool_ids:
            print(f"Bereinige Orphan: Position {position_id} -> tool_id {tool_id} (existiert nicht)")
            cur.execute("UPDATE positions SET tool_id = NULL WHERE id = ?", (position_id,))
            position_tools[position_id] = None

    # 2. Verwaiste tools.position_id entfernen
    for tool_id, position_id in tool_positions.items():
        if position_id is not None and position_id not in position_tools:
            print(f"Bereinige Orphan: Tool {tool_id} -> position_id {position_id} (existiert nicht)")
            cur.execute("UPDATE tools SET position_id = NULL WHERE id = ?", (tool_id,))
            tool_positions[tool_id] = None

    # 3. Doppelte position.tool_id behandeln
    dupes: dict[int, list[int]] = {}
    for pos_id, tool_id in position_tools.items():
        if tool_id is not None:
            dupes.setdefault(tool_id, []).append(pos_id)

    for tool_id, pos_ids in dupes.items():
        if len(pos_ids) <= 1:
            continue
        expected_pos = tool_positions.get(tool_id)
        keeper = next((p for p in pos_ids if p == expected_pos), pos_ids[0])
        for pos_id in pos_ids:
            if pos_id == keeper:
                continue
            print(f"Bereinige Duplikat: Tool {tool_id} war mehrfach belegt -> Position {pos_id} wird frei")
            cur.execute("UPDATE positions SET tool_id = NULL WHERE id = ?", (pos_id,))
        position_tools[keeper] = tool_id
        for pos_id in pos_ids:
            if pos_id != keeper:
                position_tools[pos_id] = None

    # 4. tools.position_id -> positions.tool_id synchronisieren
    for tool_id, pos_id in tool_positions.items():
        if pos_id is None:
            continue
        current_tool = position_tools.get(pos_id)
        if current_tool is None:
            print(f"Sync: Tool {tool_id} belegt Position {pos_id}")
            cur.execute("UPDATE positions SET tool_id = ? WHERE id = ?", (tool_id, pos_id))
            position_tools[pos_id] = tool_id
        elif current_tool != tool_id:
            konflikte.append(
                f"Konflikt nicht automatisch behoben: Tool {tool_id} will Position {pos_id}, "
                f"aber sie ist von Tool {current_tool} belegt."
            )

    # 5. positions.tool_id -> tools.position_id synchronisieren
    for pos_id, tool_id in position_tools.items():
        if tool_id is None:
            continue
        current_position = tool_positions.get(tool_id)
        if current_position is None:
            print(f"Sync: Position {pos_id} ist von Tool {tool_id} belegt -> setze tool.position_id")
            cur.execute("UPDATE tools SET position_id = ? WHERE id = ?", (pos_id, tool_id))
            tool_positions[tool_id] = pos_id
        elif current_position != pos_id:
            konflikte.append(
                f"Konflikt nicht automatisch behoben: Position {pos_id} hat Tool {tool_id}, "
                f"aber dessen position_id zeigt auf {current_position}."
            )

    conn.commit()

    print("\n=== ERGEBNIS ===")
    if konflikte:
        print("Bitte manuell prüfen:")
        for k in konflikte:
            print(f"  - {k}")
    else:
        print("Keine Konflikte festgestellt.")

    print("\nPositionen mit Belegung:")
    cur.execute(
        "SELECT p.id, p.drawer_id, p.name, p.tool_id, t.position_id "
        "FROM positions p LEFT JOIN tools t ON t.id = p.tool_id "
        "WHERE p.tool_id IS NOT NULL ORDER BY p.id"
    )
    for row in cur.fetchall():
        print(f"  {row}")

    print("\nWerkzeuge mit Lagerplatz:")
    cur.execute(
        "SELECT t.id, t.tool_id, t.position_id, p.tool_id "
        "FROM tools t LEFT JOIN positions p ON p.id = t.position_id "
        "WHERE t.position_id IS NOT NULL ORDER BY t.id"
    )
    for row in cur.fetchall():
        print(f"  {row}")

    conn.close()
    print("\n=== Bereinigung abgeschlossen ===")


if __name__ == "__main__":
    main()