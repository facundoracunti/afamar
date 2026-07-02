import sqlite3
conn = sqlite3.connect('afamar-backend/afamar.db')
cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
for r in cur.fetchall():
    print(r[0])
conn.close()
