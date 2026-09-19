"""Temporäres Reparatur-Skript: Fügt fehlende Spalten zur SQLite-DB hinzu.

Problem: Die Migration c7d9e2f3a1b8 wurde als angewendet markiert,
aber die Spalten cols/rows (drawers) und x/y (positions) fehlen in der DB.

Dieses Skript fügt die fehlenden Spalten hinzu.
"""
import sqlite3

conn = sqlite3.connect("toolsync.db")
cur = conn.cursor()


def get_columns(table: str) -> list[str]:
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


repairs = [
    # (Tabelle, Spalte, Typ, Default)
    ("drawers", "cols", "INTEGER", "5"),
    ("drawers", "rows", "INTEGER", "2"),
    ("positions", "x", "INTEGER", "1"),
    ("positions", "y", "INTEGER", "1"),
]

for table, column, col_type, default in repairs:
    cols = get_columns(table)
    if column not in cols:
        print(f"+ Füge Spalte {table}.{column} ({col_type} DEFAULT {default}) hinzu")
        cur.execute(
            f"ALTER TABLE {table} ADD COLUMN {column} {col_type} NOT NULL DEFAULT {default}"
        )
    else:
        print(f"= Spalte {table}.{column} existiert bereits")

conn.commit()

# Verifizieren
print("\n=== Verifikation ===")
for table in ["drawers", "positions"]:
    cols = get_columns(table)
    print(f"{table}: {cols}")

conn.close()
print("\n=== Reparatur abgeschlossen ===")
