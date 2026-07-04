from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.api.dependencies import get_current_user, get_db
from app.utils.responses import error, success
from app.models.user import User
from app.schemas.auth import LoginRequest, UserCreate, UserResponse
from app.services.auth import authenticate_user, create_access_token, create_user

limiter = Limiter(key_func=get_remote_address, enabled=settings.RATE_LIMIT_ENABLED)

router = APIRouter(tags=["Auth"])


@router.post("/login")
@limiter.limit(settings.RATE_LIMIT_LOGIN)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        return error(detail="Credenciales inválidas", status_code=401)
    access_token = create_access_token({"sub": str(user.id), "username": user.username})
    return success({"access_token": access_token, "token_type": "bearer", "user": UserResponse.model_validate(user)})


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return success(UserResponse.model_validate(current_user))


@router.post("/register")
@limiter.limit(settings.RATE_LIMIT_REGISTER)
def register(request: Request, body: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == body.username) | (User.email == body.email)).first()
    if existing:
        return error(detail="El usuario o email ya existe", status_code=409)
    user = create_user(db, body.username, body.email, body.password, body.full_name, body.is_admin)
    return success(UserResponse.model_validate(user))
