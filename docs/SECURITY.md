# Security checklist

- [x] Authentication: email + password (scrypt), server-side sessions in an httpOnly SameSite=Lax cookie, origin check on writes, login throttling. All project, layout and validation routes require a session and projects are owner-scoped.
- [x] Email verification: 6-digit one-time code (10 min expiry, 5 attempts, single use, hashed at rest, 60 s resend cooldown). Accounts cannot sign in until verified. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` in `services/api/.env`; without SMTP the code is only logged when `APP_ENV=development`, otherwise registration fails with a clear error.
- [x] Password reset: emailed one-time code, kept apart from sign-up codes. A reset signs out every session.
- [x] Rate limiting that survives restarts and is shared between workers, kept in the database.
- [x] Enforce project ownership server-side. Roles are not needed yet, since projects have one owner.
- [x] Keep smart provider keys and storage secrets server-side only.
- [x] Rate-limit project creation, generation and reference readings, per hour: projects 60, generation 60, readings 20. Exports run in the browser, so they have no server endpoint to limit.
- [x] Validate file type and file size. There is no object storage yet.
- [x] Implement account/data deletion and retention policy. Audit events are kept 365 days and rate events 2 days; expired sessions are removed at startup. Deleting an account removes its projects and designs, and keeps only the audit record of ids.
- [x] Never present generated conceptual plans as construction approval.
