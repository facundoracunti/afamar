import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, success
from app.schemas.material import (
    MaterialCategoryCreate,
    MaterialColorCreate,
    MaterialThicknessCreate,
    MaterialCreate,
    MaterialUpdate,
)
from app.services.material import MaterialService
from app.utils.pagination import paginate

router = APIRouter(dependencies=[Depends(get_current_user)])

MATERIALS_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "uploads",
    "materials",
)
os.makedirs(MATERIALS_UPLOAD_DIR, exist_ok=True)


# ── Colors ──────────────────────────────────────────────

@router.get("/colors")
def list_colors(db: Session = Depends(get_db)):
    service = MaterialService(db)
    return success(service.list_colors())


@router.post("/colors", status_code=201)
def create_color(data: MaterialColorCreate, db: Session = Depends(get_db)):
    service = MaterialService(db)
    return created(service.create_color(data.model_dump()))


@router.delete("/colors/{color_id}", status_code=204)
def delete_color(color_id: int, db: Session = Depends(get_db)):
    service = MaterialService(db)
    if not service.delete_color(color_id):
        raise NotFoundError("Color")


# ── Thicknesses ─────────────────────────────────────────

@router.get("/thicknesses")
def list_thicknesses(db: Session = Depends(get_db)):
    service = MaterialService(db)
    return success(service.list_thicknesses())


@router.post("/thicknesses", status_code=201)
def create_thickness(data: MaterialThicknessCreate, db: Session = Depends(get_db)):
    service = MaterialService(db)
    return created(service.create_thickness(data.model_dump()))


@router.delete("/thicknesses/{thickness_id}", status_code=204)
def delete_thickness(thickness_id: int, db: Session = Depends(get_db)):
    service = MaterialService(db)
    if not service.delete_thickness(thickness_id):
        raise NotFoundError("Thickness")


# ── Categories ───────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    from app.repositories.material import MaterialCategoryRepository
    repo = MaterialCategoryRepository(db)
    return success(repo.get_all())


@router.post("/categories", status_code=201)
def create_category(data: MaterialCategoryCreate, db: Session = Depends(get_db)):
    from app.repositories.material import MaterialCategoryRepository
    repo = MaterialCategoryRepository(db)
    cat = repo.create(data.name)
    db.commit()
    db.refresh(cat)
    return created(cat)


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    from app.repositories.material import MaterialCategoryRepository
    repo = MaterialCategoryRepository(db)
    cat = repo.get_by_id(category_id)
    if not cat:
        raise NotFoundError("Category")
    repo.delete(cat)
    db.commit()


@router.put("/categories/{category_id}")
def update_category(category_id: int, data: MaterialCategoryCreate, db: Session = Depends(get_db)):
    from app.repositories.material import MaterialCategoryRepository
    repo = MaterialCategoryRepository(db)
    cat = repo.get_by_id(category_id)
    if not cat:
        raise NotFoundError("Category")
    cat.name = data.name
    db.commit()
    db.refresh(cat)
    return success(cat)


# ── Price History ──────────────────────────────────────

@router.get("/{material_id}/price-history")
def get_price_history(material_id: int, db: Session = Depends(get_db)):
    service = MaterialService(db)
    return success(service.get_price_history(material_id))


# ── Materials ───────────────────────────────────────────

@router.get("")
def list_materials(
    skip: int = 0,
    limit: int = 100,
    category_id: int | None = None,
    db: Session = Depends(get_db),
):
    if category_id:
        service = MaterialService(db)
        return success(service.get_by_category(category_id))
    service = MaterialService(db)
    query = service.repo.db.query(service.repo.model)
    page = paginate(db, query, skip, limit)
    return success(page.items, page.pagination)


@router.get("/{material_id}")
def get_material(material_id: int, db: Session = Depends(get_db)):
    service = MaterialService(db)
    material = service.get_by_id(material_id)
    if not material:
        raise NotFoundError("Material")
    return success(material)


@router.post("", status_code=201)
def create_material(data: MaterialCreate, db: Session = Depends(get_db)):
    service = MaterialService(db)
    return created(service.create(data.model_dump()))


@router.put("/{material_id}")
def update_material(material_id: int, data: MaterialUpdate, db: Session = Depends(get_db)):
    service = MaterialService(db)
    material = service.update(material_id, data.model_dump(exclude_unset=True))
    if not material:
        raise NotFoundError("Material")
    return success(material)


@router.delete("/{material_id}", status_code=204)
def delete_material(material_id: int, db: Session = Depends(get_db)):
    service = MaterialService(db)
    if not service.delete(material_id):
        raise NotFoundError("Material")


# ── Photo upload/remove ─────────────────────────────────


def _delete_photo_file(photo: str | None) -> None:
    """Best-effort delete of a previously stored photo file."""
    if not photo:
        return
    abs_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        photo.lstrip("/"),
    )
    try:
        if os.path.isfile(abs_path):
            os.remove(abs_path)
    except OSError:
        pass


@router.post("/{material_id}/upload-foto")
def upload_material_photo(material_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Store an image on disk and save its path on the material row.

    Mirrors `settings.upload_logo`: image is normalized to PNG, validated
    with Pillow, and the original file is overwritten so a stale photo
    cannot leak.
    """
    from PIL import Image
    from io import BytesIO

    service = MaterialService(db)
    material = service.get_by_id(material_id)
    if not material:
        raise NotFoundError("Material")

    contents = file.file.read()
    try:
        img = Image.open(BytesIO(contents))
        img.load()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Archivo no es una imagen válida: {exc}")

    # Always overwrite any prior photo (different extensions) before saving the
    # new one so an old variant cannot leak on disk.
    _delete_photo_file(getattr(material, "photo", None))

    stored_name = f"{material_id}_{uuid.uuid4().hex[:8]}.png"
    abs_dest = os.path.join(MATERIALS_UPLOAD_DIR, stored_name)
    if img.mode in ("RGBA", "LA", "P"):
        img.save(abs_dest, format="PNG")
    else:
        img.convert("RGB").save(abs_dest, format="PNG")

    relative_path = f"/uploads/materials/{stored_name}"
    # Save directly via the repository to bypass the `update()` helper, which
    # would re-fetch and validate the row against the schema fields.
    material.photo = relative_path
    db.commit()
    db.refresh(material)
    return success({"path": relative_path})


@router.delete("/{material_id}/foto", status_code=204)
def delete_material_photo(material_id: int, db: Session = Depends(get_db)):
    """Remove the photo file from disk and clear the column."""
    service = MaterialService(db)
    material = service.get_by_id(material_id)
    if not material:
        raise NotFoundError("Material")
    _delete_photo_file(getattr(material, "photo", None))
    material.photo = None
    db.commit()
    return None
