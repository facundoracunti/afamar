from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class PaginationInfo(BaseModel):
    total: int
    skip: int = 0
    limit: int = 100


class APIResponse(BaseModel):
    success: bool = True
    data: Any = None
    error: str | None = None
    pagination: PaginationInfo | None = None


def _build(success: bool, data: Any = None, error: str | None = None, pagination: PaginationInfo | None = None) -> dict:
    body: dict[str, Any] = {"success": success, "data": jsonable_encoder(data), "error": error}
    if pagination is not None:
        body["pagination"] = pagination.model_dump()
    return body


def success(data: Any = None, pagination: PaginationInfo | None = None) -> JSONResponse:
    return JSONResponse(content=_build(True, data, pagination=pagination), status_code=200)


def created(data: Any = None) -> JSONResponse:
    return JSONResponse(content=_build(True, data), status_code=201)


def error(detail: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(content=_build(False, error=detail), status_code=status_code)
