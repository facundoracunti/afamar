from dataclasses import dataclass

from sqlalchemy.orm import Query, Session

from app.utils.responses import PaginationInfo


@dataclass
class Page:
    items: list
    pagination: PaginationInfo


def paginate(db: Session, query: Query, skip: int = 0, limit: int = 100) -> Page:
    total = query.count() or 0
    items = query.offset(skip).limit(limit).all()
    return Page(items=items, pagination=PaginationInfo(total=total, skip=skip, limit=limit))
