"""Production-grade admin seeder.

Usa el mismo CryptContext (hash_password) del sistema de login,
garantizando compatibilidad total de hashes.

Usage:
    python init_db_admin.py                         # Crea si no existe
    python init_db_admin.py --force                  # Resetea password
    python init_db_admin.py --username=admin --password=secreto123
"""

import sys
import argparse
from app.database import SessionLocal
from app.models.user import User
from app.services.auth_service import hash_password


def seed_admin(
    username: str = "admin",
    email: str = "admin@afamar.com.ar",
    password: str = "admin123",
    full_name: str = "Administrador",
    force: bool = False,
) -> User:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(
            (User.email == email) | (User.username == username)
        ).first()

        if existing and not force:
            print(
                f"Admin '{existing.username}' ya existe "
                f"(email={existing.email}, id={existing.id})."
            )
            return existing

        if existing and force:
            existing.hashed_password = hash_password(password)
            existing.username = username
            existing.email = email
            existing.full_name = full_name
            existing.is_active = True
            existing.is_admin = True
            db.commit()
            db.refresh(existing)
            print(f"Admin '{username}' actualizado (id={existing.id}).")
            return existing

        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            is_active=True,
            is_admin=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Admin '{username}' creado (id={user.id}).")
        return user

    except Exception as exc:
        db.rollback()
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Crea/actualiza el usuario administrador"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Reemplazar credenciales aunque el usuario exista"
    )
    parser.add_argument("--username", default="admin")
    parser.add_argument("--email", default="admin@afamar.com.ar")
    parser.add_argument("--password", default="admin123")
    parser.add_argument("--full-name", default="Administrador")
    args = parser.parse_args()

    seed_admin(
        username=args.username,
        email=args.email,
        password=args.password,
        full_name=args.full_name,
        force=args.force,
    )
