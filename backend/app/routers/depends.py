from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.exceptions import NotFoundError, ConflictError, ValidationError


def handle_service_errors(func):
    """Decorator for router endpoints that converts service exceptions to HTTP."""
    import functools

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except NotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except ConflictError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=str(e))

    return wrapper
