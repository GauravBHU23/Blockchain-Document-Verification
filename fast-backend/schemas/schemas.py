from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, field_validator
import re


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a digit")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class EmailVerificationRequest(BaseModel):
    verification_token: str


class EmailVerifyOTP(BaseModel):
    otp: str
    verification_token: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        normalized = value.strip()
        if not re.fullmatch(r"\d{6}", normalized):
            raise ValueError("OTP must be exactly 6 digits")
        return normalized


class UserUpdate(BaseModel):
    name: str
    email: EmailStr

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("Name must be at least 2 characters")
        return normalized


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    is_active: bool
    is_admin: bool
    email_verified: bool
    email_verified_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class VerificationStartResponse(BaseModel):
    message: str
    email: str
    expires_in_minutes: int
    verification_token: str
    dev_otp: Optional[str] = None


class UserStatusUpdate(BaseModel):
    is_active: bool


class UsersExportOut(BaseModel):
    download_path: str
    filename: str
    updated_at: datetime


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    filename: str
    original_name: str
    document_hash: str
    file_size: Optional[int]
    mime_type: Optional[str]
    status: str
    block_index: Optional[int]
    tx_id: Optional[str]
    uploaded_at: datetime
    verified_at: Optional[datetime]
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[int]
    archived_at: Optional[datetime]
    archived_by: Optional[int]
    is_archived: bool
    notes: Optional[str]

    model_config = {"from_attributes": True}


class AuditEventOut(BaseModel):
    timestamp: datetime
    event_type: str
    title: str
    description: str
    document_id: Optional[int] = None
    document_hash: Optional[str] = None
    document_name: Optional[str] = None
    block_index: Optional[int] = None
    tx_id: Optional[str] = None
    actor_email: Optional[str] = None


class DocumentDetailOut(BaseModel):
    document: DocumentOut
    audit_trail: List[AuditEventOut]
    share_path: str


class DocumentSummaryOut(BaseModel):
    total_documents: int
    verified_documents: int
    pending_documents: int
    rejected_documents: int
    archived_documents: int
    total_storage_bytes: int
    verification_rate: float
    blockchain_blocks: int
    chain_valid: bool
    latest_upload_at: Optional[datetime] = None
    latest_verification_at: Optional[datetime] = None
    recent_activity: List[AuditEventOut]


class DocumentReviewIn(BaseModel):
    action: str
    notes: Optional[str] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"approve", "reject"}:
            raise ValueError("Action must be either 'approve' or 'reject'")
        return normalized


class DocumentVerifyResult(BaseModel):
    verified: bool
    document_hash: str
    block_index: Optional[int] = None
    block_timestamp: Optional[float] = None
    uploader_email: Optional[str] = None
    original_name: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    message: str


# ── Blockchain ────────────────────────────────────────────────────────────────

class BlockOut(BaseModel):
    index: int
    timestamp: float
    transactions: List[dict]
    proof: int
    previous_hash: str


class ChainStatusOut(BaseModel):
    length: int
    is_valid: bool
    pending_transactions: int
    blocks: List[BlockOut]
