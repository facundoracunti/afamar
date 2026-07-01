from typing import List

from app.models.options import AppOption
from app.repositories.base import BaseRepository


class OptionRepository(BaseRepository):
    model = AppOption

    def get_by_category(self, category: str) -> List[AppOption]:
        return self.db.query(AppOption).filter(AppOption.category == category).order_by(AppOption.sort_order).all()

    def get_by_id(self, option_id: int):
        return self.db.query(AppOption).filter(AppOption.id == option_id).first()
