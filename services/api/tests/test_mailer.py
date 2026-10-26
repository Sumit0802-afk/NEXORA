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

    def send_message(self, msg):
        _Fake.calls.append(("send", msg["To"]))


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
