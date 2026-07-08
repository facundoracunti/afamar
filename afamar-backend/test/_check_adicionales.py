"""Verify the adicionales table exists with the right columns."""
import sys
sys.path.insert(0, ".")
from app.db.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    res = db.execute(text("DESCRIBE adicionales"))
    for row in res:
        print(row)
finally:
    db.close()
