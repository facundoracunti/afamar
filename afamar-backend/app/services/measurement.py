from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.measurement import Measurement
from app.repositories.measurement import MeasurementRepository
from app.services.base import BaseService


class MeasurementService(BaseService[Measurement]):
    def __init__(self, db: Session):
        self.repo = MeasurementRepository(db)
        super().__init__(db)

    def create(self, data: dict) -> Measurement:
        measurement = self.repo.create(data)
        self.repo.db.commit()
        self.repo.db.refresh(measurement)
        return measurement

    def update(self, measurement_id: int, data: dict) -> Optional[Measurement]:
        measurement = self.repo.get_by_id(measurement_id)
        if not measurement:
            return None
        result = self.repo.update(measurement, data)
        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete(self, measurement_id: int) -> bool:
        measurement = self.repo.get_by_id(measurement_id)
        if not measurement:
            return False
        self.repo.delete(measurement)
        self.repo.db.commit()
        return True
