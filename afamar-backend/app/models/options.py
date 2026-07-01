from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AppOption(Base):
    """Generic key-value pairs for selectable options across the app.
    `category` groups options (e.g. finish_type, front_type, bacha_type, anafe_type).
    """
    __tablename__ = "app_options"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
