import hashlib
import json
import uuid
from time import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.models import BlockchainBlock, BlockchainTransaction, Document, DocumentStatus, User


MINING_DIFFICULTY = 4


def _transaction_payload(transaction: BlockchainTransaction) -> dict[str, Any]:
    return {
        "tx_id": transaction.tx_id,
        "document_hash": transaction.document_hash,
        "uploader_id": transaction.uploader_id,
        "uploader_email": transaction.uploader_email,
        "filename": transaction.filename,
        "timestamp": transaction.timestamp,
    }


def _block_payload(block: BlockchainBlock) -> dict[str, Any]:
    transactions = sorted(block.__dict__.get("transactions") or [], key=lambda item: item.id or 0)
    return {
        "index": block.index,
        "timestamp": block.timestamp,
        "transactions": [_transaction_payload(tx) for tx in transactions],
        "proof": block.proof,
        "previous_hash": block.previous_hash,
    }


def hash_block(block: BlockchainBlock) -> str:
    encoded = json.dumps(_block_payload(block), sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _valid_proof(last_proof: int, proof: int, last_hash: str) -> bool:
    guess = f"{last_proof}{proof}{last_hash}".encode("utf-8")
    guess_hash = hashlib.sha256(guess).hexdigest()
    return guess_hash[:MINING_DIFFICULTY] == "0" * MINING_DIFFICULTY


def _proof_of_work(last_proof: int, last_hash: str) -> int:
    proof = 0
    while not _valid_proof(last_proof, proof, last_hash):
        proof += 1
    return proof


async def _load_chain(session: AsyncSession) -> list[BlockchainBlock]:
    result = await session.execute(
        select(BlockchainBlock)
        .options(selectinload(BlockchainBlock.transactions))
        .order_by(BlockchainBlock.index.asc())
    )
    return list(result.scalars().all())


async def ensure_genesis_block(session: AsyncSession) -> BlockchainBlock:
    existing = await session.execute(select(BlockchainBlock).where(BlockchainBlock.index == 1))
    genesis = existing.scalar_one_or_none()
    if genesis is not None:
        return genesis

    genesis = BlockchainBlock(
        index=1,
        timestamp=time(),
        proof=1,
        previous_hash="0" * 64,
        block_hash="",
    )
    session.add(genesis)
    await session.flush()
    genesis.block_hash = hash_block(genesis)
    await session.flush()
    return genesis


async def anchor_document(session: AsyncSession, document: Document) -> BlockchainBlock:
    chain = await _load_chain(session)
    if not chain:
        chain = [await ensure_genesis_block(session)]

    last_block = chain[-1]
    tx_id = document.tx_id or uuid.uuid4().hex
    tx_timestamp = time()

    owner_result = await session.execute(select(User).where(User.id == document.user_id))
    owner = owner_result.scalar_one_or_none()
    uploader_email = owner.email if owner else "unknown"

    new_block = BlockchainBlock(
        index=last_block.index + 1,
        timestamp=tx_timestamp,
        proof=_proof_of_work(last_block.proof, last_block.block_hash),
        previous_hash=last_block.block_hash,
        block_hash="",
    )
    session.add(new_block)
    await session.flush()

    session.add(
        BlockchainTransaction(
            block_id=new_block.id,
            tx_id=tx_id,
            document_hash=document.document_hash,
            uploader_id=document.user_id,
            uploader_email=uploader_email,
            filename=document.original_name,
            timestamp=tx_timestamp,
        )
    )
    await session.flush()
    await session.refresh(new_block, attribute_names=["transactions"])

    new_block.block_hash = hash_block(new_block)
    await session.flush()

    document.tx_id = tx_id
    document.block_index = new_block.index
    document.verified_at = document.verified_at or document.reviewed_at
    document.status = DocumentStatus.VERIFIED
    return new_block


async def find_document(session: AsyncSession, document_hash: str) -> dict[str, Any] | None:
    result = await session.execute(
        select(BlockchainTransaction, BlockchainBlock)
        .join(BlockchainBlock, BlockchainTransaction.block_id == BlockchainBlock.id)
        .where(BlockchainTransaction.document_hash == document_hash)
        .order_by(BlockchainBlock.index.asc())
    )
    row = result.first()
    if row is None:
        return None

    transaction, block = row
    payload = _transaction_payload(transaction)
    payload.update({"block_index": block.index, "block_timestamp": block.timestamp})
    return payload


async def is_chain_valid(session: AsyncSession) -> bool:
    chain = await _load_chain(session)
    if not chain:
        return True

    for index, block in enumerate(chain):
        if hash_block(block) != block.block_hash:
            return False

        if index == 0:
            if block.index != 1 or block.previous_hash != "0" * 64 or block.proof != 1:
                return False
            continue

        previous = chain[index - 1]
        if block.previous_hash != previous.block_hash:
            return False
        if not _valid_proof(previous.proof, block.proof, previous.block_hash):
            return False

    return True


async def get_chain_snapshot(session: AsyncSession) -> list[dict[str, Any]]:
    chain = await _load_chain(session)
    return [_block_payload(block) for block in chain]


async def ensure_blockchain_ready(session: AsyncSession) -> None:
    chain = await _load_chain(session)
    if not chain:
        await ensure_genesis_block(session)

    existing_transactions = await session.execute(select(BlockchainTransaction.document_hash))
    anchored_hashes = set(existing_transactions.scalars().all())

    verified_docs_result = await session.execute(
        select(Document)
        .where(Document.status == DocumentStatus.VERIFIED)
        .order_by(Document.verified_at.asc(), Document.uploaded_at.asc(), Document.id.asc())
    )
    verified_documents = list(verified_docs_result.scalars().all())

    for document in verified_documents:
        if document.document_hash in anchored_hashes:
            continue
        await anchor_document(session, document)
        anchored_hashes.add(document.document_hash)
