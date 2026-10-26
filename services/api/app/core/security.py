"""Password hashing and session-token helpers (standard library only)."""
import base64
import hashlib
import hmac
import os
import secrets

# scrypt parameters (~32 MiB, interactive-login cost). Stored with the hash so they can be raised later.
_N, _R, _P = 2**15, 8, 1
_MAXMEM = 128 * 1024 * 1024


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, maxmem=_MAXMEM, dklen=32)
    return "scrypt${}${}${}${}${}".format(
        _N, _R, _P, base64.b64encode(salt).decode(), base64.b64encode(digest).decode()
    )


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, n, r, p, salt_b64, digest_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode(), salt=salt, n=int(n), r=int(r), p=int(p), maxmem=_MAXMEM, dklen=len(expected)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# Verified against when the email is unknown so login timing does not reveal which accounts exist.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_otp() -> str:
    """Six random digits from the OS CSPRNG."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(code: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode()).hexdigest()
