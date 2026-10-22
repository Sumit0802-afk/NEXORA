# Security checklist

- [ ] Add authentication and validate identity on every API request.
- [ ] Enforce project ownership/role permissions server-side.
- [ ] Keep smart provider keys and storage secrets server-side only.
- [ ] Rate-limit project creation, generation and export endpoints.
- [ ] Validate file type, file size and object-storage access.
- [ ] Use signed, expiring export/share URLs where appropriate.
- [ ] Add audit events for share, delete, export and permission changes.
- [ ] Implement account/data deletion and retention policy.
- [ ] Configure backups and periodically test restore.
- [ ] Never present generated conceptual plans as construction approval.
