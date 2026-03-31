import hashlib
import json
from time import time
from typing import List, Optional, Dict, Any


class Block:
    def __init__(
        self,
        index: int,
        transactions: List[Dict[str, Any]],
        proof: int,
        previous_hash: str,
        timestamp: Optional[float] = None,
    ):
        self.index = index
        self.timestamp = timestamp or time()
        self.transactions = transactions
        self.proof = proof
        self.previous_hash = previous_hash

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "proof": self.proof,
            "previous_hash": self.previous_hash,
        }


class Blockchain:
    MINING_DIFFICULTY = 4  # Leading zeros required

    def __init__(self):
        self.chain: List[Block] = []
        self.pending_transactions: List[Dict[str, Any]] = []
        # Genesis block
        self._create_block(proof=1, previous_hash="0" * 64)

    # ── Chain construction ────────────────────────────────────────────────────

    def _create_block(self, proof: int, previous_hash: str) -> Block:
        block = Block(
            index=len(self.chain) + 1,
            transactions=self.pending_transactions.copy(),
            proof=proof,
            previous_hash=previous_hash,
        )
        self.pending_transactions = []
        self.chain.append(block)
        return block

    def mine_block(self) -> Block:
        """Proof-of-work mining to add pending transactions."""
        last_block = self.last_block
        last_proof = last_block.proof
        last_hash = self.hash(last_block)

        proof = self._proof_of_work(last_proof, last_hash)
        return self._create_block(proof=proof, previous_hash=last_hash)

    def add_transaction(self, transaction: Dict[str, Any]) -> int:
        """Add a transaction; returns index of block that will hold it."""
        transaction["timestamp"] = time()
        self.pending_transactions.append(transaction)
        return self.last_block.index + 1

    # ── Hashing & PoW ─────────────────────────────────────────────────────────

    @staticmethod
    def hash(block: Block) -> str:
        encoded = json.dumps(block.to_dict(), sort_keys=True).encode()
        return hashlib.sha256(encoded).hexdigest()

    def _proof_of_work(self, last_proof: int, last_hash: str) -> int:
        proof = 0
        while not self._valid_proof(last_proof, proof, last_hash):
            proof += 1
        return proof

    @staticmethod
    def _valid_proof(last_proof: int, proof: int, last_hash: str) -> bool:
        guess = f"{last_proof}{proof}{last_hash}".encode()
        guess_hash = hashlib.sha256(guess).hexdigest()
        return guess_hash[: Blockchain.MINING_DIFFICULTY] == "0" * Blockchain.MINING_DIFFICULTY

    # ── Validation ────────────────────────────────────────────────────────────

    def is_chain_valid(self) -> bool:
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]

            if current.previous_hash != self.hash(previous):
                return False
            if not self._valid_proof(previous.proof, current.proof, current.previous_hash):
                return False
        return True

    def find_document(self, document_hash: str) -> Optional[Dict[str, Any]]:
        """Search entire chain for a document hash."""
        for block in self.chain:
            for tx in block.transactions:
                if tx.get("document_hash") == document_hash:
                    return {"block_index": block.index, "block_timestamp": block.timestamp, **tx}
        return None

    # ── Helpers ───────────────────────────────────────────────────────────────

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def chain_as_dict(self) -> List[Dict[str, Any]]:
        return [b.to_dict() for b in self.chain]

        