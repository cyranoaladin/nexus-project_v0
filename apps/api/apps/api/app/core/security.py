from datetime import datetime, timedelta
import jwt
from passlib.hash import bcrypt
from .config import settings

def hash_password(p: str) -> str:
    return bcrypt.hash(p)

def verify_password(p: str, hashed: str) -> bool:
    return bcrypt.verify(p, hashed)

def create_jwt(subject: str, expires_delta: timedelta = timedelta(hours=12)) -> str:
    payload = {"sub": subject, "exp": datetime.utcnow() + expires_delta}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
