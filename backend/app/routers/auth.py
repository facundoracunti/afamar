from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, UserCreate, UserResponse
from app.services.auth_service import authenticate_user, create_access_token, create_user

router = APIRouter(tags=["Auth"])


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        return {"error": "Credenciales inválidas"}, 401
    access_token = create_access_token({"sub": str(user.id), "username": user.username})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump(),
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user).model_dump()


@router.post("/register")
def register(body: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == body.username) | (User.email == body.email)).first()
    if existing:
        return {"error": "El usuario o email ya existe"}, 409
    user = create_user(db, body.username, body.email, body.password, body.full_name, body.is_admin)
    return UserResponse.model_validate(user).model_dump()
