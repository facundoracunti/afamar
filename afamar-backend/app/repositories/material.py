from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.material import Material, MaterialCategory, MaterialColor, MaterialThickness
from app.models.price_history import PriceHistory
from app.repositories.base import BaseRepository


class MaterialCategoryRepository(BaseRepository):
    model = MaterialCategory

    def __init__(self, db: Session):
        super().__init__(db)

    def get_all(self) -> List[MaterialCategory]:
        return self.db.query(MaterialCategory).all()

    def get_by_id(self, category_id: int) -> Optional[MaterialCategory]:
        return self.db.query(MaterialCategory).filter(MaterialCategory.id == category_id).first()

    def create(self, name: str) -> MaterialCategory:
        cat = MaterialCategory(name=name)
        return self.save(cat)

    def delete(self, category: MaterialCategory) -> None:
        super().delete(category)


class ColorRepository(BaseRepository):
    model = MaterialColor

    def __init__(self, db: Session):
        super().__init__(db)

    def get_all(self) -> List[MaterialColor]:
        return self.db.query(MaterialColor).order_by(MaterialColor.name).all()

    def get_by_id(self, color_id: int) -> Optional[MaterialColor]:
        return self.db.query(MaterialColor).filter(MaterialColor.id == color_id).first()

    def create(self, data: dict) -> MaterialColor:
        return self.save(MaterialColor(**data))

    def delete(self, color: MaterialColor) -> None:
        super().delete(color)


class ThicknessRepository(BaseRepository):
    model = MaterialThickness

    def __init__(self, db: Session):
        super().__init__(db)

    def get_all(self) -> List[MaterialThickness]:
        return self.db.query(MaterialThickness).order_by(MaterialThickness.name).all()

    def get_by_id(self, thickness_id: int) -> Optional[MaterialThickness]:
        return self.db.query(MaterialThickness).filter(MaterialThickness.id == thickness_id).first()

    def create(self, data: dict) -> MaterialThickness:
        return self.save(MaterialThickness(**data))

    def delete(self, thickness: MaterialThickness) -> None:
        super().delete(thickness)


class MaterialRepository(BaseRepository):
    model = Material

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, material_id: int) -> Optional[Material]:
        return self.db.query(Material).filter(Material.id == material_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Material]:
        return self.db.query(Material).offset(skip).limit(limit).all()

    def get_by_category(self, category_id: int) -> List[Material]:
        return self.db.query(Material).filter(Material.category_id == category_id).all()

    def create(self, data: dict) -> Material:
        return self.save(Material(**data))

    def update(self, material: Material, data: dict) -> Material:
        for key, value in data.items():
            if value is not None:
                setattr(material, key, value)
        return self.save(material)

    def delete(self, material: Material) -> None:
        super().delete(material)


class PriceHistoryRepository(BaseRepository):
    model = PriceHistory

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_material(self, material_id: int) -> List[PriceHistory]:
        return self.db.query(PriceHistory).filter(PriceHistory.material_id == material_id).order_by(PriceHistory.date.desc()).all()

    def create(self, data: dict) -> PriceHistory:
        return self.save(PriceHistory(**data))
