import pytest

from scripts.seeders import users


def test_development_keeps_the_local_admin_fallback(monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.setattr(users.settings, "ENVIRONMENT", "development")

    assert users._configured_admin_password() == "admin123"


def test_production_requires_an_explicit_admin_password(monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    monkeypatch.setattr(users.settings, "ENVIRONMENT", "production")

    with pytest.raises(RuntimeError, match="ADMIN_PASSWORD is required"):
        users._configured_admin_password()


def test_explicit_admin_password_is_used_in_any_environment(monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "configured-value")
    monkeypatch.setattr(users.settings, "ENVIRONMENT", "production")

    assert users._configured_admin_password() == "configured-value"
