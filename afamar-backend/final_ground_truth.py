"""ESTADO FINAL definitivo. 1) MySQL: alembic_version + tipos de columna + truncado.
2) API: borrar el roundtrip test id=16 y su cliente (maneja 204 = sin body)."""
import json
import sys
import urllib.request
import urllib.error
import pymysql
from urllib.parse import urlsplit, unquote

sys.path.insert(0, r"C:\Users\facul\OneDrive\Desktop\proyectos\afamar\afamar-backend")
from app.core.settings import settings

API = "http://127.0.0.1:3095/api/v1"
TOKAPI = "http://127.0.0.1:3095/api/v1"
tok = None

# ---------- 1) MySQL ground truth ----------
u = urlsplit(settings.DATABASE_URL)
conn = pymysql.connect(
    host="127.0.0.1", port=u.port or 3306,
    user=unquote(u.username), password=unquote(u.password),
    database=u.path[1:], charset="utf8mb4", connect_timeout=8,
)
cur = conn.cursor()
print("MySQL 127.0.0.1 /", u.path[1:])

cur.execute("SELECT version_num FROM alembic_version")
print("alembic_version:", cur.fetchone()[0])

cur.execute("SHOW FULL COLUMNS FROM measurements")
print("--- SHOW FULL COLUMNS (photos/sketch) ---")
for r in cur.fetchall():
    if r[0] in ("photos_data", "sketch_data"):
        print(" ", r[0], "=", r[1])

cur.execute(
    "SELECT id, status, scheduled_date, LENGTH(photos_data), "
    "CASE WHEN LENGTH(photos_data) >= 65535 THEN 'TRUNCED' ELSE 'ok' END "
    "FROM measurements ORDER BY id DESC LIMIT 6"
)
print("--- rows (photos truncation) ---")
for r in cur.fetchall():
    print(" ", r)
conn.close()
print()

# ---------- 2) API login + cleanup ----------
def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(TOKAPI + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if tok:
        req.add_header("Authorization", f"Bearer {tok}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            parsed = None
            if r.status != 204 and raw.strip():
                try:
                    parsed = json.loads(raw.decode())
                except Exception:
                    parsed = None
            return r.status, parsed
    except urllib.error.HTTPError as e:
        raw = e.read()
        parsed = None
        if raw.strip():
            try:
                parsed = json.loads(raw.decode())
            except Exception:
                parsed = None
        return e.code, parsed

_, login = api("POST", "/auth/login", {"username": "admin", "password": "admin123"})
if isinstance(login, dict) and isinstance(login.get("data"), dict):
    tok = login["data"]["access_token"]
else:
    tok = login["data"]["access_token"] if isinstance(login, dict) else login["access_token"]
print("login OK")

# borrar measurement id=16 (roundtrip test 200KB)
code, _ = api("DELETE", "/measurements/16")
print("DELETE /measurements/16 ->", code)

# borrar el cliente de roundtrip (nombre ROUNDTRIP-LONGTEXT o similar)
_, clients = api("GET", "/clients?search=ROUNDTRIP&limit=10")
found = []
if isinstance(clients, dict):
    d = clients.get("data")
    if isinstance(d, dict):
        found = d.get("items", [])
    elif isinstance(d, list):
        found = d
for c in found:
    code, _ = api("DELETE", f"/clients/{c['id']}")
    print(f"DELETE /clients/{c['id']} ({c.get('first_name','')}) ->", code)

print()
print("CLEANUP DONE")
