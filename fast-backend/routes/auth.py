from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.email_utils import email_backend_configured, send_verification_email
from core.user_exports import EXPORT_PATH, export_metadata, export_users_csv
from core.security import get_current_admin
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_verification_token,
    generate_email_otp,
    hash_email_otp,
    verify_email_otp,
    decode_token,
)
from models.models import User
from schemas.schemas import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserOut,
    UserUpdate,
    EmailVerificationRequest,
    EmailVerifyOTP,
    VerificationStartResponse,
    UserStatusUpdate,
    UsersExportOut,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
OTP_EXPIRY_MINUTES = 10


async def _issue_email_verification(
    user: User,
    db: AsyncSession,
    background_tasks: BackgroundTasks | None = None,
) -> str | None:
    otp = generate_email_otp()
    user.email_verified = False
    user.email_verified_at = None
    user.verification_code_hash = hash_email_otp(user.email, otp)
    user.verification_code_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    await db.commit()
    await db.refresh(user)

    if email_backend_configured():
        if background_tasks is not None:
            background_tasks.add_task(send_verification_email, user.email, user.name, otp)
            return None
        email_sent = send_verification_email(user.email, user.name, otp)
        return None if email_sent else otp

    return otp


def _build_token(user: User) -> str:
    return create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "is_admin": user.is_admin,
            "email_verified": user.email_verified,
        }
    )


def _decode_verification_token(token: str) -> dict:
    payload = decode_token(token)
    if payload.get("token_type") != "email_verification":
        raise HTTPException(status_code=401, detail="Invalid verification token")
    if not payload.get("email") or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid verification token")
    return payload


@router.post("/register", response_model=VerificationStartResponse, status_code=201)
async def register(
    payload: UserRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user and user.email_verified:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user:
        user.name = payload.name.strip()
        user.hashed_password = hash_password(payload.password)
    else:
        user = User(
            name=payload.name.strip(),
            email=payload.email,
            hashed_password=hash_password(payload.password),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    dev_otp = await _issue_email_verification(user, db, background_tasks)
    await export_users_csv(db)
    return VerificationStartResponse(
        message="Verification OTP sent to your email. Verify your email to activate the account.",
        email=user.email,
        expires_in_minutes=OTP_EXPIRY_MINUTES,
        verification_token=create_verification_token(user.email, user.id),
        dev_otp=dev_otp,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user: User | None = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Email verification required",
                "verification_token": create_verification_token(user.email, user.id),
                "email": user.email,
            },
        )

    user.last_login_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    await export_users_csv(db)

    token = _build_token(user)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(payload: EmailVerifyOTP, db: AsyncSession = Depends(get_db)):
    verification_payload = _decode_verification_token(payload.verification_token)
    result = await db.execute(select(User).where(User.id == int(verification_payload["sub"])))
    user: User | None = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email_verified:
        token = _build_token(user)
        return TokenResponse(access_token=token, user=UserOut.model_validate(user))
    if not user.verification_code_expires_at or user.verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP expired. Request a new code.")
    if user.email != verification_payload["email"]:
        raise HTTPException(status_code=401, detail="Invalid verification token")
    if not verify_email_otp(user.email, payload.otp, user.verification_code_hash):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    user.verification_code_hash = None
    user.verification_code_expires_at = None
    await db.commit()
    await db.refresh(user)
    await export_users_csv(db)

    token = _build_token(user)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/resend-verification", response_model=VerificationStartResponse)
async def resend_verification(
    payload: EmailVerificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    verification_payload = _decode_verification_token(payload.verification_token)
    result = await db.execute(select(User).where(User.id == int(verification_payload["sub"])))
    user: User | None = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")

    dev_otp = await _issue_email_verification(user, db, background_tasks)
    return VerificationStartResponse(
        message="A fresh OTP has been sent to your email.",
        email=user.email,
        expires_in_minutes=OTP_EXPIRY_MINUTES,
        verification_token=create_verification_token(user.email, user.id),
        dev_otp=dev_otp,
    )


@router.get("/me", response_model=UserOut)
async def me(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(__import__("core.security", fromlist=["get_current_user"]).get_current_user),
):
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.put("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(__import__("core.security", fromlist=["get_current_user"]).get_current_user),
):
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email != user.email:
        raise HTTPException(status_code=400, detail="Email changes are locked after verification")

    user.name = payload.name.strip()
    await db.commit()
    await db.refresh(user)
    await export_users_csv(db)
    return UserOut.model_validate(user)


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserOut.model_validate(user) for user in users]


@router.post("/users/{user_id}/status", response_model=UserOut)
async def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: dict = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin["id"] and not payload.is_active:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)
    await export_users_csv(db)
    return UserOut.model_validate(user)


@router.get("/users/export", response_model=UsersExportOut)
async def get_users_export(
    _: dict = Depends(get_current_admin),
):
    download_path, filename, updated_at = export_metadata()
    return UsersExportOut(download_path=download_path, filename=filename, updated_at=updated_at)


@router.get("/users/export/download")
async def download_users_export(
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin),
):
    await export_users_csv(db)
    return FileResponse(EXPORT_PATH, filename=EXPORT_PATH.name, media_type="text/csv")
