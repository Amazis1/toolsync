import sqlite3

conn = sqlite3.connect("toolsync.db")
cur = conn.cursor()

tables = [
    "users",
    "tools",
    "tool_types",
    "plants",
    "storage_locations",
    "serial_articles",
    "tool_movements",
    "roles",
    "permissions",
]

print("toolsync.db (SQLite) – Anzahl Datensätze")
print("-" * 50)
for t in tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        print(f"{t}: {cur.fetchone()[0]}")
    except Exception as exc:
        print(f"{t}: FEHLER ({exc})")

print("-" * 50)

row = cur.execute(
    "SELECT hashed_password FROM users WHERE personal_number='admin1'"
).fetchone()

if row is None:
    print("Admin admin1: NICHT GEFUNDEN")
else:
    hashed = row[0]
    print(f"Admin-Hash: {hashed[:7]}...")

    try:
        import bcrypt

        if isinstance(hashed, str):
            hashed_bytes = hashed.encode("utf-8")
        else:
            hashed_bytes = hashed

        print("Passwort-Kandidaten-Test:")
        for pw in ["123", "test123", "password", "admin"]:
            try:
                ok = bcrypt.checkpw(pw.encode("utf-8"), hashed_bytes)
                print(f"  '{pw}': {'PASST' if ok else 'nein'}")
            except Exception as exc:
                print(f"  '{pw}': Prüfung fehlerhaft ({exc})")
    except ImportError:
        print("bcrypt nicht installiert – Passworttest übersprungen")

conn.close()