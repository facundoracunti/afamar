import json
import sys
import time
import urllib.request
import urllib.error
import pymysql
import pymysql.cursors
from urllib.parse import urlsplit, unquote, quote

sys.path.insert(0, r"C:\Users\facul\OneDrive\Desktop\proyectos\afamar\afamar-backend")
from app.core.settings import settings

# ---- MySQL directo: estado del schema Y de la fila 15 ----
u = urlsplit(settings.DATABASE_URL)
conn = pymysql.connect(
    host="127.0.0.1", port=u.port or 3306,
    user=unquote(u.username), password=unquote(u.password),
    database=u.path.strip("/"), charset="utf8mb4", connect_timeout=8,
)
cur = conn.cursor()

cur.execute("SELECT version_num FROM alembic_version")
print("alembic_version en MySQL prod:", cur.fetchone()[0])

cur.execute("SHOW FULL COLUMNS FROM measurements")
print("\n--- SHOW FULL COLUMNS measurements (fotos/croquis) ---")
for r in cur.fetchall():
    if r[0] in ("photos_data", "sketch_data"):
        print(f"  {r[0]}: {r[1]}")

cur.execute(
    "SELECT id, status, scheduled_date, LENGTH(photos_data), "
    "CASE WHEN LENGTH(photos_data) >= 65535 THEN 'TEXT-TRUNCADA' ELSE 'ok' END "
    "FROM measurements ORDER BY id DESC LIMIT 8"
)
print("\n--- mediciones recientes (fotos_data) ---")
for r in cur.fetchall():
    print(" ", r)

conn.close()

# ---- API: limpiar la medicion de test id=16 + su cliente (roundtrip 200KB) ----
API = "http://localhost:3095/api/v1"
def api(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, (json.loads(r.read().decode()) if r.status != 204 else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, (json.loads(raw) if raw else None)

_, login = api("POST", "/auth/login", body={"username": "admin", "password": "admin123"})
tok = login["data"]["access_token"]

code, _ = api("DELETE", "/measurements/16", tok)
print("\nDELETE /measurements/16 ->", code)

code, res = api("GET", "/clients?search=LONGTEST%20ROUNDTRIP", tok)
for c in (res.get("data") or {}).get("items", []):
    api("DELETE", f"/clients/{c['id']}", tok)
    print(f"DELETE /clients/{c['id']} ok")
