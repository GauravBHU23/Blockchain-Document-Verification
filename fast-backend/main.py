import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv
from sqlalchemy import inspect, text

from core.database import engine, Base, AsyncSessionLocal
from core.user_exports import export_users_csv
from routes import auth, documents, blockchain_routes

BACKEND_ROOT = Path(__file__).resolve().parent
load_dotenv(BACKEND_ROOT / ".env")


def _ensure_document_lifecycle_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    tables = inspector.get_table_names()
    if "documents" not in tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("documents")}
    dialect = sync_conn.dialect.name

    column_sql = {
        "reviewed_at": "TIMESTAMP NULL",
        "reviewed_by": "INTEGER NULL",
        "archived_at": "TIMESTAMP NULL",
        "archived_by": "INTEGER NULL",
        "is_archived": "BOOLEAN NOT NULL DEFAULT FALSE" if dialect != "sqlite" else "BOOLEAN NOT NULL DEFAULT 0",
    }

    for column_name, definition in column_sql.items():
        if column_name in existing_columns:
            continue
        sync_conn.execute(text(f"ALTER TABLE documents ADD COLUMN {column_name} {definition}"))


def _ensure_user_verification_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    tables = inspector.get_table_names()
    if "users" not in tables:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    dialect = sync_conn.dialect.name

    column_sql = {
        "email_verified": "BOOLEAN NOT NULL DEFAULT FALSE" if dialect != "sqlite" else "BOOLEAN NOT NULL DEFAULT 0",
        "email_verified_at": "TIMESTAMP NULL",
        "verification_code_hash": "VARCHAR(255) NULL",
        "verification_code_expires_at": "TIMESTAMP NULL",
        "last_login_at": "TIMESTAMP NULL",
    }

    for column_name, definition in column_sql.items():
        if column_name in existing_columns:
            continue
        sync_conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {definition}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (use Alembic migrations in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_document_lifecycle_columns)
        await conn.run_sync(_ensure_user_verification_columns)
    async with AsyncSessionLocal() as session:
        await export_users_csv(session)
    yield
    await engine.dispose()


app = FastAPI(
    title="BlockVault — Document Verification API",
    description="Immutable document verification powered by blockchain",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(blockchain_routes.router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "BlockVault API",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
