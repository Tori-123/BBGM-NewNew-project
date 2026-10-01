from __future__ import annotations

import smtplib
from email.message import EmailMessage

from config import Settings
from errors import StorageError

_CONSOLE_CODES: dict[tuple[str, str], str] = {}


def peek_console_code(email: str, purpose: str) -> str | None:
    return _CONSOLE_CODES.get((email, purpose))


def clear_console_codes() -> None:
    _CONSOLE_CODES.clear()


def send_verification_email(settings: Settings, email: str, code: str, purpose: str) -> None:
    if settings.mail_backend == "console":
        _CONSOLE_CODES[(email, purpose)] = code
        print(f"email code for {email} ({purpose}): {code}", flush=True)
        return
    if not settings.smtp_host or not settings.smtp_from:
        raise StorageError()
    subject = "Your Elegram registration code" if purpose == "register" else "Your Elegram password reset code"
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from
    message["To"] = email
    message.set_content(
        f"Your verification code is:\n\n{code}\n\nIt expires in 2 minutes. If you did not request this, ignore this email."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise StorageError() from exc
