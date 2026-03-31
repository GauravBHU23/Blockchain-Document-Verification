from fastapi import APIRouter, Depends

from core import ledger
from core.database import get_db
from core.security import get_current_user
from schemas.schemas import ChainStatusOut, BlockOut
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])


@router.get("/", response_model=ChainStatusOut)
async def get_chain(
    _: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chain = await ledger.get_chain_snapshot(db)
    blocks = [BlockOut(**block) for block in chain]
    return ChainStatusOut(
        length=len(chain),
        is_valid=await ledger.is_chain_valid(db),
        pending_transactions=0,
        blocks=blocks,
    )


@router.get("/validate")
async def validate_chain(db: AsyncSession = Depends(get_db)):
    chain = await ledger.get_chain_snapshot(db)
    valid = await ledger.is_chain_valid(db)
    return {"is_valid": valid, "chain_length": len(chain)}
