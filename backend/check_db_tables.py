"""Temporäres Diagnose-Skript – prüft Tabellenstruktur der SQLite-DB."""
import sqlite3

conn = sqlite3.connect("toolsync.db")
cur = conn.cursor()

# Alle Tabellen auflisten
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cur.fetchall()
print("=== Vorhandene Tabellen ===")
for t in tables:
    print(f"  {t[0]}")

print("\n=== Spalten der relevanten Tabellen ===")
for tbl in ["cabinets", "drawers", "positions", "tools", "storage_items"]:
    try:
        cur.execute(f"PRAGMA table_info({tbl})")
        cols = cur.fetchall()
        print(f"\n{tbl}:")
        for c in cols:
            print(f"  {c[1]} ({c[2]})")
    except Exception as e:
        print(f"\n{tbl}: FEHLER - {e}")

print("\n=== Cabinet-Daten ===")
try:
    cur.execute("SELECT * FROM cabinets")
    for row in cur.fetchall():
        print(f"  {row}")
except Exception as e:
    print(f"  FEHLER: {e}")

print("\n=== Drawer-Daten ===")
try:
    cur.execute("SELECT * FROM drawers")
    for row in cur.fetchall():
        print(f"  {row}")
except Exception as e:
    print(f"  FEHLER: {e}")

print("\n=== Position-Daten ===")
try:
    cur.execute("SELECT COUNT(*) FROM positions")
    print(f"  Anzahl: {cur.fetchone()[0]}")
except Exception as e:
    print(f"  FEHLER: {e}")

print("\n=== Tool-Daten (position_id) ===")
try:
    cur.execute("SELECT id, tool_id, plant_id, position_id FROM tools")
    for row in cur.fetchall():
        print(f"  {row}")
except Exception as e:
    print(f"  FEHLER: {e}")

conn.close()
print("\n=== Diagnose abgeschlossen ===")