"""Temporäre Synchronisierung: tool.position_id -> position.tool_id"""
import sqlite3

conn = sqlite3.connect("toolsync.db")
cur = conn.cursor()

cur.execute("SELECT id, position_id FROM tools WHERE position_id IS NOT NULL")
tools = cur.fetchall()
print(f"Tools mit position_id: {len(tools)}")

for tool_id, position_id in tools:
    cur.execute("UPDATE positions SET tool_id = ? WHERE id = ?", (tool_id, position_id))
    print(f"  Tool {tool_id} -> Position {position_id} belegt")

conn.commit()

cur.execute("SELECT id, name, tool_id FROM positions WHERE tool_id IS NOT NULL")
print("\nBelegte Positionen:")
for row in cur.fetchall():
    print(f"  {row}")

conn.close()
print("\nSynchronisierung abgeschlossen.")
