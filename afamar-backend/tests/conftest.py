import os
import tempfile

os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.core.dependencies import get_current_user, get_db
from app.main import app
from app.models.user import User

_db_file = os.path.join(tempfile.gettempdir(), "afamar_test.db")
engine = create_engine(f"sqlite:///{_db_file}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def public_client(setup_db):
    """Client without auth override — for testing login/register/401."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client(setup_db):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1, username="admin", email="admin@test.com", is_active=True, is_admin=True
    )
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seed_db(setup_db):
    """Seed the in-memory test DB with reference data."""
    db = TestingSessionLocal()
    try:
        from app.models.material import MaterialCategory, MaterialColor, MaterialThickness
        from app.models.options import AppOption
        from app.models.setting import Setting
        for name in ["Granitos", "Cuarzos"]:
            db.add(MaterialCategory(name=name))
        for c in ["Blanco", "Negro"]:
            db.add(MaterialColor(name=c))
        for t in ["2cm", "3cm"]:
            db.add(MaterialThickness(name=t))
        for cat, vals in {"finish_type": ["Pulido"], "bacha_type": ["Sobreponer"], "anafe_type": ["Empotrar"]}.items():
            for i, v in enumerate(vals):
                db.add(AppOption(category=cat, value=v, sort_order=i))
        for k in ["company_name", "company_address"]:
            db.add(Setting(key=k, value=""))
        db.commit()
    finally:
        db.close()
    yield
