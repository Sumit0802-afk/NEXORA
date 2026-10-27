import smtplib

import pytest

from app.core import mailer
from app.core.config import settings


class _Fake:
    calls: list = []

    def __init__(self, *a, **k):
        _Fake.calls.append((type(self).__name__, a))

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def starttls(self, **k):
        _Fake.calls.append(("starttls",))

    def login(self, user, pw):
        _Fake.calls.append(("login", user))

    def send_message(self, msg, **kw):
        _Fake.calls.append(("send", msg["To"], kw))


class _FakeSSL(_Fake):
    pass


@pytest.fixture(autouse=True)
def _fake_smtp(monkeypatch):
    _Fake.calls = []
    monkeypatch.setattr(smtplib, "SMTP", _Fake)
    monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSSL)
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_user", "me@example.com")
    monkeypatch.setattr(settings, "smtp_password", "pw")
    monkeypatch.setattr(settings, "smtp_from", "NEXORA <me@example.com>")
    monkeypatch.setattr(settings, "allow_personal_smtp", False)
    monkeypatch.setattr(settings, "mail_from_address", "")


def test_port_465_uses_implicit_tls(monkeypatch):
    monkeypatch.setattr(settings, "smtp_port", 465)
    mailer.send_otp("a@example.com", "123456", 10)
    names = [c[0] for c in _Fake.calls]
    assert names[0] == "_FakeSSL" and "starttls" not in names and names[-1] == "send"


def test_port_587_uses_starttls(monkeypatch):
    monkeypatch.setattr(settings, "smtp_port", 587)
    mailer.send_otp("a@example.com", "123456", 10)
    names = [c[0] for c in _Fake.calls]
    assert names[0] == "_Fake" and "starttls" in names and "login" in names


def test_unconfigured_mailer_fails_outside_development(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "")
    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(mailer.MailerUnavailable):
        mailer.send_otp("a@example.com", "123456", 10)


def test_email_is_multipart_with_themed_html_and_escaped_code(monkeypatch):
    sent = []
    monkeypatch.setattr(_Fake, "send_message", lambda self, msg, **kw: sent.append(msg))
    mailer.send_otp("a@b.com", "123456", 10, "reset")
    msg = sent[0]
    assert msg["Subject"] == "Your NEXORA password reset code"
    plain = msg.get_body(("plain",)).get_content()
    html = msg.get_body(("html",)).get_content()
    assert "123456" in plain and "10 minutes" in plain
    assert "Reset your password" in html and "Your OTP" in html and "max-width:480px" in html
    assert all(f">{d}</td>" in html for d in "123456")  # one tile per digit
    # nothing is embedded: Gmail lists embedded pictures as attachment chips
    assert not [p for p in msg.walk() if p.get_content_maintype() == "image"]
    assert "cid:" not in html and "<img" not in html


def test_otp_html_escapes_markup():
    from app.core.email_templates import otp_email
    assert "<script>" not in otp_email("<script>", 5)[2]


def test_picture_design_links_hosted_images_only_when_configured(monkeypatch):
    from app.core.email_templates import otp_email
    embedded = otp_email("123456", 10, "verify")[2]
    full = otp_email("123456", 10, "verify", "https://nexora.example.com/email/")[2]
    assert "<img" not in embedded and "cid:" not in embedded
    for name in ("trails-top.jpg", "trails-bottom.jpg"):
        assert f"https://nexora.example.com/email/{name}" in full
    assert "cid:" not in full


def test_inbox_preview_is_only_the_short_preheader():
    from app.core.email_templates import otp_email
    html = otp_email("123456", 10, "login")[2]
    body = html.split("<body", 1)[1]
    first_text = body.split(">", 2)[2].split("</div>", 1)[0]
    assert first_text.startswith("Your sign-in code") and "NEXORA" not in first_text


def _sent_messages(monkeypatch):
    sent = []
    monkeypatch.setattr(_Fake, "send_message", lambda self, msg, **kw: sent.append((msg, kw)))
    return sent


def test_sender_is_only_nexora_on_the_verified_domain_with_no_reply_to(monkeypatch):
    monkeypatch.setattr(settings, "mail_from_address", "noreply@nexora-studio.in")
    monkeypatch.setattr(settings, "smtp_user", "private.person@gmail.com")  # login only, must never reach a header
    sent = _sent_messages(monkeypatch)
    mailer.send_otp("a@example.com", "123456", 10)
    msg, kw = sent[0]
    assert msg["From"] == "NEXORA <noreply@nexora-studio.in>"
    assert msg["Reply-To"] is None and msg["Sender"] is None
    assert kw["from_addr"] == "noreply@nexora-studio.in"  # envelope sender is the domain address too
    assert "nexora-studio.in" in msg["Message-ID"]
    assert "gmail.com" not in msg.as_string()


def test_free_mail_sender_is_refused_outside_development(monkeypatch):
    monkeypatch.setattr(settings, "mail_from_address", "me@gmail.com")
    monkeypatch.setattr(settings, "smtp_from", "")
    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(mailer.MailerUnavailable):
        mailer.send_otp("a@example.com", "123456", 10)


def test_free_mail_sender_falls_back_to_log_in_development(monkeypatch, caplog):
    monkeypatch.setattr(settings, "mail_from_address", "me@gmail.com")
    monkeypatch.setattr(settings, "smtp_from", "")
    monkeypatch.setattr(settings, "app_env", "development")
    sent = _sent_messages(monkeypatch)
    mailer.send_otp("a@example.com", "123456", 10)
    assert sent == []  # nothing goes out through a personal mailbox
    assert "123456" in caplog.text


def test_support_message_goes_privately_to_the_inbox(monkeypatch):
    monkeypatch.setattr(settings, "mail_from_address", "noreply@nexora-studio.in")
    monkeypatch.setattr(settings, "support_inbox", "owner@gmail.com")
    sent = _sent_messages(monkeypatch)
    mailer.send_support("feedback", "Nice\r\nBcc: evil@x.com", "hello", reply_to="user@example.com")
    msg, kw = sent[0]
    assert msg["To"] == "owner@gmail.com" and msg["From"] == "NEXORA <noreply@nexora-studio.in>"
    assert msg["Reply-To"] == "user@example.com" and msg["Bcc"] is None
    assert "\n" not in msg["Subject"] and kw["to_addrs"] == ["owner@gmail.com"]


def test_support_requires_an_inbox(monkeypatch):
    monkeypatch.setattr(settings, "support_inbox", "")
    with pytest.raises(mailer.MailerUnavailable):
        mailer.send_support("contact", "x", "y")


def test_personal_mailbox_smtp_server_is_never_used_even_with_a_domain_sender(monkeypatch, caplog):
    monkeypatch.setattr(settings, "mail_from_address", "noreply@nexora.com")
    monkeypatch.setattr(settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(settings, "app_env", "development")
    sent = _sent_messages(monkeypatch)
    mailer.send_otp("a@example.com", "654321", 10)
    assert sent == [] and "654321" in caplog.text
    monkeypatch.setattr(settings, "app_env", "production")
    with pytest.raises(mailer.MailerUnavailable):
        mailer.send_otp("a@example.com", "654321", 10)


def test_personal_smtp_works_only_when_explicitly_allowed(monkeypatch):
    monkeypatch.setattr(settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(settings, "mail_from_address", "")
    monkeypatch.setattr(settings, "smtp_from", "NEXORA <me@gmail.com>")
    monkeypatch.setattr(settings, "allow_personal_smtp", True)
    sent = _sent_messages(monkeypatch)
    mailer.send_otp("a@example.com", "123456", 10)
    assert sent[0][0]["From"] == "NEXORA <me@gmail.com>"
