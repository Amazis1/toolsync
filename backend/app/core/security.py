import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from .config import settings

def get_password_hash(password: str) -> str:
    """Erzeugt einen bcrypt-Hash für ein Passwort."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Prüft ein Klartext-Passwort gegen einen bcrypt-Hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        # Ungültiger Hash (z. B. falsches Format oder zu langes Passwort)
        return False
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return encoded_jwt