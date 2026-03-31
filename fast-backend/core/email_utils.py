import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def _env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def email_backend_configured() -> bool:
    return all(
        [
            os.getenv("SMTP_HOST"),
            os.getenv("SMTP_USERNAME"),
            os.getenv("SMTP_PASSWORD"),
        ]
    )


def send_verification_email(recipient_email: str, recipient_name: str, otp: str) -> bool:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SMTP_FROM_EMAIL", smtp_username or "noreply@blockvault.local")
    sender_name = os.getenv("SMTP_FROM_NAME", "Blockchain Document Verification")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    use_tls = _env_flag("SMTP_USE_TLS", "true")

    if not email_backend_configured():
        print(
            f"[BlockVault OTP] Email backend not configured. "
            f"OTP for {recipient_email} ({recipient_name}): {otp}"
        )
        return False

    message = EmailMessage()
    message["Subject"] = "BlockVault email verification OTP"
    message["From"] = formataddr((sender_name, sender_email))
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                f"Hello {recipient_name},",
                "",
                "Use the OTP below to verify your BlockVault account:",
                otp,
                "",
                "This code expires in 10 minutes.",
                "If you did not request this, you can ignore this email.",
            ]
        )
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(message)
        return True
    except Exception as exc:
        print(
            f"[BlockVault OTP] Failed to send email via SMTP ({type(exc).__name__}: {exc}). "
            f"OTP for {recipient_email} ({recipient_name}): {otp}"
        )
        return False
