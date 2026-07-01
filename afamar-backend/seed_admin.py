"""Seeder que crea el usuario administrador inicial.

Uso:
  python seed_admin.py                   # Crea admin si no existe
  python seed_admin.py --force           # Recrea admin aunque ya exista
"""
import sys
from app.db.database import SessionLocal
from app.models.user import User
from app.services.auth import hash_password

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@afamar.com.ar"
ADMIN_PASSWORD = "admin123"
ADMIN_FULL_NAME = "Administrador"


def seed_admin(force: bool = False) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == ADMIN_USERNAME).first()

        if existing and not force:
            print(f"Usuario '{ADMIN_USERNAME}' ya existe (id={existing.id}). Usa --force para recrearlo.")
            return

        if existing and force:
            existing.hashed_password = hash_password(ADMIN_PASSWORD)
            existing.is_active = True
            existing.is_admin = True
            db.commit()
            print(f"Usuario '{ADMIN_USERNAME}' actualizado (password reiniciado).")
            return

        user = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            hashed_password=hash_password(ADMIN_PASSWORD),
            full_name=ADMIN_FULL_NAME,
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        print(f"Usuario '{ADMIN_USERNAME}' creado correctamente (id={user.id}).")

    except Exception as e:
        db.rollback()
        print(f"Error al crear usuario: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    force = "--force" in sys.argv
    seed_admin(force)
