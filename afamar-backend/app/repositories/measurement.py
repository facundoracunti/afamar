from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.measurement import Measurement
from app.repositories.base import BaseRepository


class MeasurementRepository(BaseRepository):
    model = Measurement

    def __init__(self, db: Session):
        super().__init__(db)

    def get_by_id(self, measurement_id: int) -> Optional[Measurement]:
        return self.db.query(Measurement).filter(Measurement.id == measurement_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Measurement]:
        return self.db.query(Measurement).order_by(Measurement.id.desc()).offset(skip).limit(limit).all()

    def create(self, data: dict) -> Measurement:
        return self.save(Measurement(**data))

    def update(self, measurement: Measurement, data: dict) -> Measurement:
        for key, value in data.items():
            if value is not None:
                setattr(measurement, key, value)
        return self.save(measurement)

    def delete(self, measurement: Measurement) -> None:
        super().delete(measurement)
