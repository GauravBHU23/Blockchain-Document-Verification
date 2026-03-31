import csv
from datetime import datetime
from io import StringIO
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import User


EXPORT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "users_export_live.csv"
CSV_HEADERS = [
    "id",
    "name",
    "email",
    "is_active",
    "is_admin",
    "email_verified",
    "email_verified_at",
    "last_login_at",
    "created_at",
]


async def export_users_csv(db: AsyncSession) -> Path:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()

    EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(CSV_HEADERS)

    for user in users:
        writer.writerow(
            [
                user.id,
                user.name,
                user.email,
                user.is_active,
                user.is_admin,
                user.email_verified,
                user.email_verified_at.isoformat(sep=" ") if user.email_verified_at else "",
                user.last_login_at.isoformat(sep=" ") if user.last_login_at else "",
                user.created_at.isoformat(sep=" ") if user.created_at else "",
            ]
        )

    EXPORT_PATH.write_text(buffer.getvalue(), encoding="utf-8", newline="")
    return EXPORT_PATH


def export_metadata() -> tuple[str, str, datetime]:
    if not EXPORT_PATH.exists():
        return str(EXPORT_PATH), EXPORT_PATH.name, datetime.utcnow()
    return str(EXPORT_PATH), EXPORT_PATH.name, datetime.fromtimestamp(EXPORT_PATH.stat().st_mtime)
