import hashlib
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from core import ledger
from core.database import get_db
from core.security import get_current_admin, get_current_user
from models.models import Document, DocumentStatus, User
from schemas.schemas import (
    AuditEventOut,
    DocumentDetailOut,
    DocumentOut,
    DocumentReviewIn,
    DocumentSummaryOut,
    DocumentVerifyResult,
)

router = APIRouter(prefix="/documents", tags=["Documents"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _build_document_audit(
    doc: Document,
    uploader_email: str | None,
    reviewer_email: str | None = None,
    archiver_email: str | None = None,
) -> List[AuditEventOut]:
    document_name = doc.original_name
    audit_events = [
        AuditEventOut(
            timestamp=doc.uploaded_at,
            event_type="uploaded",
            title="Document uploaded",
            description=f"{document_name} was submitted for blockchain registration.",
            document_id=doc.id,
            document_hash=doc.document_hash,
            document_name=document_name,
            tx_id=doc.tx_id,
            actor_email=uploader_email,
        )
    ]

    if doc.reviewed_at and doc.status == DocumentStatus.VERIFIED and doc.block_index is not None:
        verified_by = reviewer_email or "an admin"
        audit_events.append(
            AuditEventOut(
                timestamp=doc.reviewed_at,
                event_type="approved",
                title="Document approved",
                description=f"Hash anchored in block #{doc.block_index} and verified for {verified_by}.",
                document_id=doc.id,
                document_hash=doc.document_hash,
                document_name=document_name,
                block_index=doc.block_index,
                tx_id=doc.tx_id,
                actor_email=reviewer_email,
            )
        )

    if doc.reviewed_at and doc.status == DocumentStatus.REJECTED:
        audit_events.append(
            AuditEventOut(
                timestamp=doc.reviewed_at,
                event_type="rejected",
                title="Document rejected",
                description=doc.notes or "Rejected during admin review.",
                document_id=doc.id,
                document_hash=doc.document_hash,
                document_name=document_name,
                actor_email=reviewer_email,
            )
        )

    if doc.is_archived and doc.archived_at:
        audit_events.append(
            AuditEventOut(
                timestamp=doc.archived_at,
                event_type="archived",
                title="Document archived",
                description="Archived from the active workspace while preserving audit history.",
                document_id=doc.id,
                document_hash=doc.document_hash,
                document_name=document_name,
                actor_email=archiver_email,
            )
        )

    if doc.notes and doc.status != DocumentStatus.REJECTED:
        audit_events.append(
            AuditEventOut(
                timestamp=doc.reviewed_at or doc.uploaded_at,
                event_type="note",
                title="Compliance note",
                description=doc.notes,
                document_id=doc.id,
                document_hash=doc.document_hash,
                document_name=document_name,
                block_index=doc.block_index,
                tx_id=doc.tx_id,
                actor_email=reviewer_email or uploader_email,
            )
        )

    return sorted(audit_events, key=lambda event: event.timestamp, reverse=True)


def _base_document_query(current_user: dict, include_archived: bool = False):
    query = select(Document)
    if not current_user.get("is_admin"):
        query = query.where(Document.user_id == current_user["id"])
    if not include_archived:
        query = query.where(Document.is_archived.is_(False))
    return query


async def _get_user_email(db: AsyncSession, user_id: int | None) -> str | None:
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return user.email if user else None


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # --- Validate mime type ---
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"File type '{file.content_type}' not allowed")

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    doc_hash = hashlib.sha256(content).hexdigest()

    # --- Check duplicate ---
    existing = await db.execute(select(Document).where(Document.document_hash == doc_hash))
    existing_doc = existing.scalar_one_or_none()
    if existing_doc:
        if existing_doc.is_archived:
            detail = "Document already exists in the archive. Restore the existing record instead of uploading it again."
        elif existing_doc.status == DocumentStatus.PENDING:
            detail = "Document already exists and is pending admin review."
        elif existing_doc.status == DocumentStatus.VERIFIED:
            detail = "Document already exists and has already been verified."
        else:
            detail = "Document already exists in the registry."
        raise HTTPException(status_code=409, detail=detail)

    # --- Persist to DB ---
    doc = Document(
        user_id=current_user["id"],
        filename=f"{uuid.uuid4().hex}_{file.filename}",
        original_name=file.filename or "unknown",
        document_hash=doc_hash,
        file_size=len(content),
        mime_type=file.content_type,
        status=DocumentStatus.PENDING,
        notes="Awaiting admin review",
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.get("/verify/{document_hash}", response_model=DocumentVerifyResult)
async def verify_document(
    document_hash: str,
    db: AsyncSession = Depends(get_db),
):
    result = await ledger.find_document(db, document_hash)
    if not result:
        pending_result = await db.execute(select(Document).where(Document.document_hash == document_hash))
        pending_doc = pending_result.scalar_one_or_none()
        if pending_doc and pending_doc.status == DocumentStatus.PENDING:
            return DocumentVerifyResult(
                verified=False,
                document_hash=document_hash,
                original_name=pending_doc.original_name,
                uploaded_at=pending_doc.uploaded_at,
                message="Document exists but is still pending admin approval.",
            )
        return DocumentVerifyResult(
            verified=False,
            document_hash=document_hash,
            message="Document NOT found on blockchain — it may be tampered or unregistered.",
        )

    # Fetch metadata from DB for extra context
    db_result = await db.execute(select(Document).where(Document.document_hash == document_hash))
    doc: Document | None = db_result.scalar_one_or_none()

    uploader_email = await _get_user_email(db, doc.user_id if doc else None)

    return DocumentVerifyResult(
        verified=True,
        document_hash=document_hash,
        block_index=result.get("block_index"),
        block_timestamp=result.get("block_timestamp"),
        uploader_email=uploader_email,
        original_name=doc.original_name if doc else result.get("filename"),
        uploaded_at=doc.uploaded_at if doc else None,
        message="Document verified ✓ — hash matches blockchain record.",
    )


@router.get("/verify-file", response_model=DocumentVerifyResult)
async def verify_by_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    doc_hash = hashlib.sha256(content).hexdigest()

    # Reuse hash-based verification
    from fastapi import Request
    return await verify_document(doc_hash, db)


@router.get("/", response_model=List[DocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=200),
    status: DocumentStatus | None = Query(None),
    include_archived: bool = Query(False),
):
    query = _base_document_query(current_user, include_archived=include_archived)

    if status is not None:
        query = query.where(Document.status == status)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Document.original_name.ilike(search_term),
                Document.document_hash.ilike(search_term),
                Document.tx_id.ilike(search_term),
            )
        )

    result = await db.execute(
        query.offset(skip).limit(limit).order_by(Document.uploaded_at.desc())
    )
    return [DocumentOut.model_validate(d) for d in result.scalars().all()]


@router.get("/summary", response_model=DocumentSummaryOut)
async def get_document_summary(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    docs_result = await db.execute(
        _base_document_query(current_user, include_archived=True).order_by(Document.uploaded_at.desc())
    )
    documents = list(docs_result.scalars().all())
    active_documents = [doc for doc in documents if not doc.is_archived]

    total_documents = len(active_documents)
    verified_documents = sum(1 for doc in active_documents if doc.status == DocumentStatus.VERIFIED)
    pending_documents = sum(1 for doc in active_documents if doc.status == DocumentStatus.PENDING)
    rejected_documents = sum(1 for doc in active_documents if doc.status == DocumentStatus.REJECTED)
    archived_documents = sum(1 for doc in documents if doc.is_archived)
    total_storage_bytes = sum(doc.file_size or 0 for doc in active_documents)
    latest_upload_at = max((doc.uploaded_at for doc in active_documents), default=None)
    latest_verification_at = max(
        (doc.verified_at for doc in active_documents if doc.verified_at is not None),
        default=None,
    )

    recent_activity: List[AuditEventOut] = []
    for doc in documents[:8]:
        owner_email = await _get_user_email(db, doc.user_id)
        reviewer_email = await _get_user_email(db, doc.reviewed_by)
        archiver_email = await _get_user_email(db, doc.archived_by)
        recent_activity.extend(
            _build_document_audit(doc, owner_email, reviewer_email=reviewer_email, archiver_email=archiver_email)
        )

    recent_activity.sort(key=lambda event: event.timestamp, reverse=True)

    verification_rate = (
        round((verified_documents / total_documents) * 100, 1)
        if total_documents
        else 0.0
    )
    chain_valid = await ledger.is_chain_valid(db)
    chain_snapshot = await ledger.get_chain_snapshot(db)

    return DocumentSummaryOut(
        total_documents=total_documents,
        verified_documents=verified_documents,
        pending_documents=pending_documents,
        rejected_documents=rejected_documents,
        archived_documents=archived_documents,
        total_storage_bytes=total_storage_bytes,
        verification_rate=verification_rate,
        blockchain_blocks=len(chain_snapshot),
        chain_valid=chain_valid,
        latest_upload_at=latest_upload_at,
        latest_verification_at=latest_verification_at,
        recent_activity=recent_activity[:10],
    )


@router.get("/{document_id}", response_model=DocumentDetailOut)
async def get_document_detail(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        _base_document_query(current_user, include_archived=True).where(Document.id == document_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    owner_email = await _get_user_email(db, doc.user_id)
    reviewer_email = await _get_user_email(db, doc.reviewed_by)
    archiver_email = await _get_user_email(db, doc.archived_by)

    return DocumentDetailOut(
        document=DocumentOut.model_validate(doc),
        audit_trail=_build_document_audit(doc, owner_email, reviewer_email=reviewer_email, archiver_email=archiver_email),
        share_path=f"/public/verify/{doc.document_hash}",
    )


@router.post("/{document_id}/review", response_model=DocumentOut)
async def review_document(
    document_id: int,
    payload: DocumentReviewIn,
    db: AsyncSession = Depends(get_db),
    current_admin: dict = Depends(get_current_admin),
):
    result = await db.execute(select(Document).where(Document.id == document_id, Document.is_archived.is_(False)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.status == DocumentStatus.VERIFIED and payload.action == "approve":
        raise HTTPException(status_code=400, detail="Document is already approved")

    doc.reviewed_at = datetime.utcnow()
    doc.reviewed_by = current_admin["id"]
    doc.notes = payload.notes or doc.notes

    if payload.action == "approve":
        doc.verified_at = datetime.utcnow()
        await ledger.anchor_document(db, doc)
        if not doc.notes:
            doc.notes = "Approved by admin review"
    else:
        doc.status = DocumentStatus.REJECTED
        doc.block_index = None
        doc.tx_id = None
        doc.verified_at = None
        if not doc.notes:
            doc.notes = "Rejected during admin review"

    await db.flush()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.post("/{document_id}/archive", response_model=DocumentOut)
async def archive_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(_base_document_query(current_user, include_archived=True).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.is_archived:
        raise HTTPException(status_code=400, detail="Document is already archived")

    doc.is_archived = True
    doc.archived_at = datetime.utcnow()
    doc.archived_by = current_user["id"]
    await db.flush()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.post("/{document_id}/restore", response_model=DocumentOut)
async def restore_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(_base_document_query(current_user, include_archived=True).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.is_archived:
        raise HTTPException(status_code=400, detail="Document is already active")

    doc.is_archived = False
    doc.archived_at = None
    doc.archived_by = None
    await db.flush()
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)
