"""
Auth business logic.

WHY THIS FILE EXISTS:
Even auth (register/login) counts as business logic - it stays out of
routes/auth.py. Routes only receive the request and call these functions.
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from core.security import hash_password, verify_password, create_access_token
from models.user import User


def register_user(db: Session, email: str, password: str) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Accounts are created ready to use - register, then log in directly.
    user = User(email=email, hashed_password=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> str:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return token
