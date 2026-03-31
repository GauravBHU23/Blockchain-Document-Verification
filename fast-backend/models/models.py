from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum as SAEnum, Float
)
from sqlalchemy.orm import relationship
import enum

from core.database import Base


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)
    verification_code_hash = Column(String(255), nullable=True)
    verification_code_expires_at = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship(
        "Document",
        back_populates="owner",
        cascade="all, delete-orphan",
        foreign_keys="Document.user_id",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(Text, nullable=False)
    original_name = Column(Text, nullable=False)
    document_hash = Column(String(64), unique=True, index=True, nullable=False)
    file_size = Column(Integer)  # bytes
    mime_type = Column(String(120))
    status = Column(SAEnum(DocumentStatus), default=DocumentStatus.PENDING)
    block_index = Column(Integer, nullable=True)  # set after mining
    tx_id = Column(String(64), nullable=True)     # internal transaction reference
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    archived_at = Column(DateTime, nullable=True)
    archived_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    owner = relationship("User", back_populates="documents", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<Document id={self.id} hash={self.document_hash[:12]}...>"


class BlockchainBlock(Base):
    __tablename__ = "blockchain_blocks"

    id = Column(Integer, primary_key=True, index=True)
    index = Column(Integer, unique=True, index=True, nullable=False)
    timestamp = Column(Float, nullable=False)
    proof = Column(Integer, nullable=False)
    previous_hash = Column(String(64), nullable=False)
    block_hash = Column(String(64), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transactions = relationship(
        "BlockchainTransaction",
        back_populates="block",
        cascade="all, delete-orphan",
        order_by="BlockchainTransaction.id",
    )

    def __repr__(self) -> str:
        return f"<BlockchainBlock index={self.index} hash={self.block_hash[:12]}...>"


class BlockchainTransaction(Base):
    __tablename__ = "blockchain_transactions"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(Integer, ForeignKey("blockchain_blocks.id", ondelete="CASCADE"), nullable=False, index=True)
    tx_id = Column(String(64), unique=True, index=True, nullable=False)
    document_hash = Column(String(64), index=True, nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploader_email = Column(String(255), nullable=False)
    filename = Column(Text, nullable=False)
    timestamp = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    block = relationship("BlockchainBlock", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<BlockchainTransaction tx_id={self.tx_id[:12]}... document_hash={self.document_hash[:12]}...>"
