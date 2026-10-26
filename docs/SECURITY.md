# Security checklist

- [x] Authentication: email + password (scrypt), server-side sessions in an httpOnly SameSite=Lax cookie, origin check on writes, login throttling. All project, layout and validation routes require a session and projects are owner-scoped.
- [x] Email verification: 6-digit one-time code (10 min expiry, 5 attempts, single use, hashed at rest, 60 s resend cooldown). Accounts cannot sign in until verified. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` in `services/api/.env`; without SMTP the code is only logged when `APP_ENV=development`, otherwise registration fails with a clear error.
- [ ] Still open: password reset, rate limiting that survives restarts / multiple workers (the login throttle is in-memory).
- [ ] Enforce project ownership/role permissions server-side.
- [ ] Keep smart provider keys and storage secrets server-side only.
- [ ] Rate-limit project creation, generation and export endpoints.
- [ ] Validate file type, file size and object-storage access.
- [ ] Use signed, expiring export/share URLs where appropriate.
- [ ] Add audit events for share, delete, export and permission changes.
- [ ] Implement account/data deletion and retention policy.
- [ ] Configure backups and periodically test restore.
- [ ] Never present generated conceptual plans as construction approval.
