import os
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient

from alembic import command
from app.core.settings import TEST_DATABASE_PATH, Settings, settings
from app.db.session import engine
from app.main import app, run_migrations


def test_pytest_forces_testing_environment_before_app_import():
    assert os.environ["ENVIRONMENT"] == "testing"
    assert os.environ["RATE_LIMIT_ENABLED"] == "false"
    assert settings.is_testing


def test_testing_database_is_always_the_temporary_sqlite_database():
    assert settings.DATABASE_URL.startswith("sqlite:///")
    assert "mysql" not in settings.DATABASE_URL.lower()
    assert Path(engine.url.database) == TEST_DATABASE_PATH


def test_test_fixtures_use_the_same_isolated_sqlite_database(setup_db):
    with engine.connect() as connection:
        assert connection.dialect.name == "sqlite"
        assert Path(connection.engine.url.database) == TEST_DATABASE_PATH


def test_testclient_lifespan_skips_database_check_and_migrations(monkeypatch):
    check_database_called = False
    migrations_called = False

    def fail_database_check():
        nonlocal check_database_called
        check_database_called = True
        raise AssertionError("testing lifespan must not check the database")

    def fail_migrations():
        nonlocal migrations_called
        migrations_called = True
        raise AssertionError("testing lifespan must not run migrations")

    monkeypatch.setattr("app.main.check_database", fail_database_check)
    monkeypatch.setattr("app.main.run_migrations", fail_migrations)

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200

    assert not check_database_called
    assert not migrations_called


def test_direct_migrations_are_rejected_in_testing():
    with pytest.raises(RuntimeError, match="disabled in testing"):
        run_migrations()


def test_alembic_rejects_testing_before_opening_a_connection():
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    with pytest.raises(RuntimeError, match="disabled in testing"):
        command.current(config)


def test_development_and_production_database_behavior_is_unchanged():
    development = Settings(ENVIRONMENT="development", SECRET_KEY="test")
    production = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="test",
        DB_USER="user",
        DB_PASSWORD="password",
        DB_HOST="mysql-host",
        DB_PORT="3306",
        DB_NAME="afamar_db",
    )

    assert development.DATABASE_URL == "sqlite:///afamar.db"
    assert development.is_development
    assert not development.is_testing
    assert production.DATABASE_URL == "mysql+pymysql://user:password@mysql-host:3306/afamar_db"
    assert production.is_production
    assert not production.is_testing
