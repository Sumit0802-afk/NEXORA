"""Outgoing email: verification/sign-in/reset codes and private forwarding of support messages.

Sender identity
- Every message is sent as "NEXORA <MAIL_FROM_ADDRESS>" where the address is on the project's own verified domain
  (e.g. noreply@yourdomain.com). The display name is always just "NEXORA".
- A free-mail address (gmail.com, outlook.com, ...) is refused as sender: those providers rewrite the From header to
  the logged-in mailbox, which would expose a personal address. No Reply-To is set on system email.
- The envelope sender and Message-ID use the same domain, so no personal address or machine name leaks in headers.

Delivery
- Production: set SMTP_HOST / SMTP_USER / SMTP_PASSWORD (from your email provider) and MAIL_FROM_ADDRESS.
- Development only: with no usable SMTP configuration the code is written to the API log so the flow can be exercised
  locally. Outside development a missing or invalid configuration fails loudly instead of pretending to send.
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr

from app.core.config import settings
from app.core.email_templates import otp_email

log = logging.getLogger("nexora.mailer")

SENDER_NAME = "NEXORA"
FREE_MAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "yahoo.in",
    "ymail.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "zoho.com", "mail.com",
}

# Consumer mailbox servers rewrite the From header to the logged-in personal account, so they can never send as NEXORA.
CONSUMER_SMTP_HOSTS = ("smtp.gmail.com", "smtp.googlemail.com", "smtp-mail.outlook.com", "smtp.office365.com", "smtp.live.com", "smtp.mail.yahoo.com", "smtp.mail.me.com", "smtp.aol.com")

SETUP_HINT = (
    "Set MAIL_FROM_ADDRESS to an address on your own verified domain (for example noreply@yourdomain.com) and "
    "SMTP_HOST / SMTP_USER / SMTP_PASSWORD from your email provider. See docs/EMAIL.md."
)


class MailerUnavailable(RuntimeError):
    pass


def sender_address() -> str | None:
    """The configured From address, or None if it is missing or not on the project's own (non free-mail) domain."""
    raw = settings.mail_from_address or settings.smtp_from
    addr = parseaddr(raw)[1].strip().lower()
    if "@" not in addr and settings.allow_personal_smtp:
        # SMTP_FROM may be just a name (or empty): a personal mailbox sends as its own login anyway.
        addr = parseaddr(settings.smtp_user)[1].strip().lower()
    if "@" not in addr:
        return None
    domain = addr.rsplit("@", 1)[1]
    if "." not in domain or (domain in FREE_MAIL_DOMAINS and not settings.allow_personal_smtp):
        return None
    return addr


def _clean(value: str) -> str:
    return " ".join(value.replace("\r", " ").replace("\n", " ").split())


def _new_message(to: str, subject: str, from_addr: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = _clean(subject)
    msg["From"] = formataddr((SENDER_NAME, from_addr))
    msg["To"] = to
    msg["Message-ID"] = make_msgid(domain=from_addr.rsplit("@", 1)[1])
    return msg


def _deliver(msg: EmailMessage, from_addr: str, to: str) -> None:
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
            smtp.send_message(msg, from_addr=from_addr, to_addrs=[to])
    except (OSError, smtplib.SMTPException) as exc:
        log.error("Could not send email: %s", exc)
        raise MailerUnavailable("Could not send the email. Please try again.") from exc


def _usable_sender() -> str | None:
    """The From address if real delivery is configured, else None (development logs instead; otherwise raises)."""
    if settings.smtp_host:
        addr = sender_address()
        if addr and not settings.allow_personal_smtp and settings.smtp_host.strip().lower() in CONSUMER_SMTP_HOSTS:
            addr = None  # a personal mailbox server would replace the From address with the personal one
        if addr:
            return addr
        if settings.app_env != "development":
            raise MailerUnavailable("Email sender is not configured on a verified domain.")
        log.warning("[dev mailer] SMTP is a personal mailbox server, or the sender is missing / a free-mail address. %s", SETUP_HINT)
        return None
    if settings.app_env == "development":
        return None
    raise MailerUnavailable("Email delivery is not configured.")


def send_otp(to_email: str, code: str, minutes: int, purpose: str = "verify") -> None:
    from_addr = _usable_sender()
    if not from_addr:
        log.warning("[dev mailer] SMTP not configured. %s code for %s: %s", purpose, to_email, code)
        return
    subject, text, html = otp_email(code, minutes, purpose, settings.email_asset_base_url)
    msg = _new_message(to_email, subject, from_addr)
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    _deliver(msg, from_addr, to_email)


def send_support(kind: str, subject: str, body: str, reply_to: str | None = None) -> None:
    """Forward a feedback / contact / support message to the private inbox in SUPPORT_INBOX.

    The inbox address only ever lives in the server environment: it is never returned by an API or shown in the UI.
    reply_to, when given, is the *submitter's* own address so the team can answer them directly.
    """
    inbox = settings.support_inbox.strip()
    if not inbox:
        raise MailerUnavailable("Support messages are not configured.")
    from_addr = _usable_sender()
    if not from_addr:
        log.warning("[dev mailer] support %s message (not sent, no sender configured): %s", kind, _clean(subject))
        return
    msg = _new_message(inbox, f"[NEXORA {kind}] {subject}", from_addr)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(body)
    _deliver(msg, from_addr, inbox)
