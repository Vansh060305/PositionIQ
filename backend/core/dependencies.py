"""
Shared FastAPI dependencies.

WHY THIS FILE EXISTS:
- get_current_user: reads the JWT from the request, verifies it, loads
  the user from DB. Every protected route depends on this.
- require_role: wraps get_current_user and checks the user's role -
  this is how RBAC (USER/ANALYST/ADMIN) gets enforced on routes.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import uuid

from core.database import get_db
from core.security import decode_access_token
from models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error

    raw_user_id = payload.get("sub")
    if raw_user_id is None:
        raise credentials_error

    try:
        user_id = uuid.UUID(raw_user_id)
    except (ValueError, TypeError):
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_error

    return user


def require_role(*allowed_roles: UserRole):
    """Usage: Depends(require_role(UserRole.ADMIN))"""

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to perform this action",
            )
        return current_user

    return role_checker
