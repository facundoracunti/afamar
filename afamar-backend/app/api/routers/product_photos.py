
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.exceptions import NotFoundError
from app.utils.responses import created, success
from app.schemas.product_photo import ProductPhotoUpdate
from app.services.product_photo import ProductPhotoService

router = APIRouter()


@router.get("")
def list_product_photos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = ProductPhotoService(db)
    return success(service.get_all(skip, limit))


@router.get("/latest")
def latest_product_photos(limit: int = 12, db: Session = Depends(get_db)):
    service = ProductPhotoService(db)
    return success(service.get_latest(limit))


@router.get("/{photo_id}")
def get_product_photo(photo_id: int, db: Session = Depends(get_db)):
    service = ProductPhotoService(db)
    photo = service.get_by_id(photo_id)
    if not photo:
        raise NotFoundError("ProductPhoto")
    return success(photo)


@router.post("", status_code=201, dependencies=[Depends(get_current_user)])
def create_product_photo(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    description: str = Form(default=""),
    db: Session = Depends(get_db),
):
    service = ProductPhotoService(db)
    data = file.file.read()
    photo = service.create(data, file.filename or "photo.jpg", title, description)
    return created(photo)


@router.put("/{photo_id}", dependencies=[Depends(get_current_user)])
def update_product_photo(photo_id: int, data: ProductPhotoUpdate, db: Session = Depends(get_db)):
    service = ProductPhotoService(db)
    photo = service.update(photo_id, data.model_dump(exclude_unset=True))
    if not photo:
        raise NotFoundError("ProductPhoto")
    return success(photo)


@router.delete("/{photo_id}", status_code=204, dependencies=[Depends(get_current_user)])
def delete_product_photo(photo_id: int, db: Session = Depends(get_db)):
    service = ProductPhotoService(db)
    if not service.delete(photo_id):
        raise NotFoundError("ProductPhoto")
