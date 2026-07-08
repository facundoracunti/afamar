"""Clean up test artifacts from material update testing."""
from sqlalchemy import text

from app.db.database import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        # Drop the test price_history row created during the API smoke test
        # (the price change from 45.0 to 50.0 inserted a row; we restored the
        # price back to 45.0 and don't want a stale history entry).
        result = db.execute(
            text("DELETE FROM price_history WHERE material_id = 106")
        )
        print(f"Deleted {result.rowcount} price_history rows for material 106")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
