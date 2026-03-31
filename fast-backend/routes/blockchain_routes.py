from fastapi import APIRouter, Depends

from core.security import get_current_user
from routes.documents import _blockchain          # shared instance
from schemas.schemas import ChainStatusOut, BlockOut

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])


@router.get("/", response_model=ChainStatusOut)
async def get_chain(_: dict = Depends(get_current_user)):
    blocks = [
        BlockOut(
            index=b.index,
            timestamp=b.timestamp,
            transactions=b.transactions,
            proof=b.proof,
            previous_hash=b.previous_hash,
        )
        for b in _blockchain.chain
    ]
    return ChainStatusOut(
        length=len(_blockchain.chain),
        is_valid=_blockchain.is_chain_valid(),
        pending_transactions=len(_blockchain.pending_transactions),
        blocks=blocks,
    )


@router.get("/validate")
async def validate_chain():
    valid = _blockchain.is_chain_valid()
    return {"is_valid": valid, "chain_length": len(_blockchain.chain)}