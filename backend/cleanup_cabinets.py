"""Temporäres Cleanup: Alle Schränke, Schubladen, Plätze löschen."""
import sqlite3

conn = sqlite3.connect("toolsync.db")
cur = conn.cursor()

cur.execute("DELETE FROM positions")
cur.execute("DELETE FROM drawers")
cur.execute("DELETE FROM cabinets")
cur.execute("UPDATE tools SET position_id = NULL")

conn.commit()

for t in ["positions", "drawers", "cabinets"]:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"{t}: {cur.fetchone()[0]} Einträge")

cur.execute("SELECT COUNT(*) FROM tools WHERE position_id IS NOT NULL")
print(f"tools mit position_id: {cur.fetchone()[0]}")

conn.close()
print("Cleanup abgeschlossen.")