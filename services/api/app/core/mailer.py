"""Outgoing email for verification codes.

Production: set SMTP_HOST (and SMTP_USER / SMTP_PASSWORD / SMTP_FROM) and codes are emailed.
Development only: with no SMTP configured the code is written to the API log so the flow can be
exercised locally. Outside development an unconfigured mailer fails loudly instead of pretending to send.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

log = logging.getLogger("nexora.mailer")


class MailerUnavailable(RuntimeError):
    pass


def send_otp(to_email: str, code: str, minutes: int, purpose: str = "verify") -> None:
    if settings.smtp_host:
        msg = EmailMessage()
        reset = purpose == "reset"
        msg["Subject"] = "Your NEXORA password reset code" if reset else "Your NEXORA verification code"
        msg["From"] = settings.smtp_from or settings.smtp_user
        msg["To"] = to_email
        msg.set_content(
            f"Your NEXORA {'password reset' if reset else 'verification'} code is {code}.\n\n"
            f"It expires in {minutes} minutes. If you did not request it, you can ignore this email."
        )
        try:
            if settings.smtp_port == 465:
                # Implicit TLS. Some networks block or break the STARTTLS port (587) but allow 465.
                client = smtplib.SMTP_SSL(settings.smtp_host, 465, timeout=30, context=ssl.create_default_context())
            else:
                client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
            with client as smtp:
                if settings.smtp_port != 465 and settings.smtp_starttls:
                    smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(msg)
        except (OSError, smtplib.SMTPException) as exc:
            log.error("Could not send verification email: %s", exc)
            raise MailerUnavailable("Could not send the verification email. Please try again.") from exc
        return
    if settings.app_env == "development":
        log.warning("[dev mailer] SMTP not configured. %s code for %s: %s", purpose, to_email, code)
        return
    raise MailerUnavailable("Email delivery is not configured.")
