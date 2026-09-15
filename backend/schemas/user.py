import uuid
from pydantic import BaseModel, EmailStr, Field

from models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    # Must match the frontend register form's minLength={8} - enforced here
    # so API clients cannot create accounts with empty/trivial passwords.
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
