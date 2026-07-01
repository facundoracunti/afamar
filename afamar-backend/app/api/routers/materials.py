from fastapi import APIRouter, Depends
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
