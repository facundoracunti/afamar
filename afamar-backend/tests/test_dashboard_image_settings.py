from io import BytesIO

from PIL import Image

from app.api.dependencies import get_current_user
from app.api.routers import settings as settings_router
from app.models.setting import Setting
from app.models.user import User
from app.main import app


def _png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (80, 40), (12, 34, 56)).save(output, format="PNG")
    return output.getvalue()


def test_dashboard_image_upload_persists_and_restores(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings_router, "UPLOAD_DIR", tmp_path)

    response = client.post(
        "/api/v1/settings/upload-dashboard-image",
        files={"file": ("hero.png", _png_bytes(), "image/png")},
    )

    assert response.status_code == 200
    path = response.json()["data"]["path"]
    stored = tmp_path / path.removeprefix("/uploads/")
    assert stored.exists()
    assert client.get("/api/v1/settings").json()["data"]["dashboard_image"] == path

    restored = client.post("/api/v1/settings/restore-dashboard-image")

    assert restored.status_code == 200
    assert not stored.exists()
    assert client.get("/api/v1/settings").json()["data"]["dashboard_image"] == ""


def test_dashboard_image_upload_rejects_invalid_extension_and_content(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings_router, "UPLOAD_DIR", tmp_path)

    invalid_extension = client.post(
        "/api/v1/settings/upload-dashboard-image",
        files={"file": ("hero.gif", b"not-an-image", "image/gif")},
    )
    invalid_content = client.post(
        "/api/v1/settings/upload-dashboard-image",
        files={"file": ("hero.png", b"not-an-image", "image/png")},
    )

    assert invalid_extension.status_code == 400
    assert invalid_content.status_code == 400
    assert list(tmp_path.iterdir()) == []


def test_dashboard_image_upload_requires_admin(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings_router, "UPLOAD_DIR", tmp_path)
    app.dependency_overrides[get_current_user] = lambda: User(
        id=2, username="operator", email="operator@test.com", is_active=True, is_admin=False
    )

    response = client.post(
        "/api/v1/settings/upload-dashboard-image",
        files={"file": ("hero.png", _png_bytes(), "image/png")},
    )

    assert response.status_code == 403
    assert not list(tmp_path.iterdir())
