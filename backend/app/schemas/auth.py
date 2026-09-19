from pydantic import BaseModel
from typing import Optional
from .user import UserRead

class LoginRequest(BaseModel):
    personal_number: str

class AdminLoginRequest(BaseModel):
    personal_number: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserRead] = None