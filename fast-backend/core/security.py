import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-change-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
VERIFICATION_TOKEN_EXPIRE_MINUTES = 15

pwd_context = CryptContext(
    # Use PBKDF2 for new hashes to avoid bcrypt's 72-byte password limit and
    # local backend compatibility issues, while still verifying legacy bcrypt hashes.
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def generate_email_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_email_otp(email: str, otp: str) -> str:
    secret = os.getenv("EMAIL_OTP_SECRET", SECRET_KEY)
    payload = f"{email.lower()}:{otp}:{secret}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_email_otp(email: str, otp: str, otp_hash: Optional[str]) -> bool:
    if not otp_hash:
        return False
    return hash_email_otp(email, otp) == otp_hash


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_verification_token(email: str, user_id: int) -> str:
    return create_access_token(
        {
            "sub": str(user_id),
            "email": email,
            "token_type": "email_verification",
        },
        expires_delta=timedelta(minutes=VERIFICATION_TOKEN_EXPIRE_MINUTES),
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI dependency ────────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return {
        "id": int(user_id),
        "email": payload.get("email"),
        "is_admin": bool(payload.get("is_admin", False)),
        "email_verified": bool(payload.get("email_verified", False)),
    }


def get_current_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
