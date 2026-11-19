from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.additional_work import AdditionalWork
from app.models.additional_work_category import AdditionalWorkCategory
from app.schemas.additional_work_category import (
    AdditionalWorkCategoryCreate, AdditionalWorkCategoryResponse, AdditionalWorkCategoryUpdate,
)
from app.utils.responses import created, success

router = APIRouter(prefix="/additional-work-categories", tags=["Additional Work Categories"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(AdditionalWorkCategory).filter(AdditionalWorkCategory.active.is_(True)).order_by(AdditionalWorkCategory.sort_order, AdditionalWorkCategory.name).all()
    return success([AdditionalWorkCategoryResponse.model_validate(row).model_dump() for row in rows])


@router.post("", status_code=201)
def create_category(data: AdditionalWorkCategoryCreate, db: Session = Depends(get_db)):
    row = AdditionalWorkCategory(**data.model_dump())
    db.add(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre")
    db.refresh(row)
    return created(AdditionalWorkCategoryResponse.model_validate(row).model_dump())


@router.put("/{category_id}")
def update_category(category_id: int, data: AdditionalWorkCategoryUpdate, db: Session = Depends(get_db)):
    row = db.get(AdditionalWorkCategory, category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    old_name = row.name
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(row, key, value)
    if "name" in changes and changes["name"] != old_name:
        db.query(AdditionalWork).filter(AdditionalWork.category == old_name).update({AdditionalWork.category: changes["name"]}, synchronize_session=False)
    db.commit()
    db.refresh(row)
    return success(AdditionalWorkCategoryResponse.model_validate(row).model_dump())


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    row = db.get(AdditionalWorkCategory, category_id)
    if not row:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    used = db.query(AdditionalWork).filter(AdditionalWork.category == row.name).count()
    if used:
        replacement = (
            db.query(AdditionalWorkCategory)
            .filter(AdditionalWorkCategory.id != row.id, AdditionalWorkCategory.active.is_(True))
            .order_by(AdditionalWorkCategory.name.asc())
            .all()
        )
        preferred = next((candidate for candidate in replacement if candidate.name.casefold() == "otros"), None)
        target = preferred or (replacement[0] if replacement else None)
        if not target:
            raise HTTPException(status_code=409, detail="No se puede eliminar: no existe otra categoría para reasignar los trabajos")
        db.query(AdditionalWork).filter(AdditionalWork.category == row.name).update({AdditionalWork.category: target.name}, synchronize_session=False)
    db.delete(row)
    db.commit()
    return success({"deleted": True, "reassigned": used})
