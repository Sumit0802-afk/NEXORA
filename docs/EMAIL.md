# NEXORA email setup

NEXORA sends two kinds of email:

| Mail | From | To |
| --- | --- | --- |
| Verification, sign-in and password-reset codes | `NEXORA <noreply@yourdomain.com>` | the user |
| Feedback / contact / support messages | `NEXORA <noreply@yourdomain.com>` | your private inbox (`SUPPORT_INBOX`) |

Recipients only ever see the name **NEXORA** and your domain address. No personal address appears in headers, the web
app or any API response, and system email has no `Reply-To`. Support messages carry the *submitter's* address as
`Reply-To` (only if they typed one), so you can answer them straight from your inbox.

## What you must set up (nothing here can be invented for you)

1. **A domain you own** (e.g. `nexora-studio.in`).
2. **A transactional email provider** that can send for that domain: Amazon SES, Brevo, Postmark, Mailgun, Resend,
   Zoho ZeptoMail, or Google Workspace / Microsoft 365 on your own domain. Free consumer mailboxes (gmail.com,
   outlook.com, yahoo.com …) will **not** work as the sender: they rewrite the From address to the personal account,
   and NEXORA refuses them on purpose.
3. **DNS records** (your provider shows the exact values after you add the domain):

   | Record | Host | Value (example) | Purpose |
   | --- | --- | --- | --- |
   | SPF (TXT) | `@` | `v=spf1 include:<provider-spf-domain> ~all` | Says your provider may send for the domain. Only **one** SPF record per domain. |
   | DKIM (TXT or CNAME) | `<selector>._domainkey` | the key / CNAME the provider gives you | Signs each message so it cannot be forged. |
   | DMARC (TXT) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com; adkim=s; aspf=s` | Tells inboxes what to do with failures. Start with `p=none`, move to `quarantine`, then `reject` once reports are clean. |

   Check them (replace the domain and selector):

   ```
   nslookup -type=TXT yourdomain.com
   nslookup -type=TXT <selector>._domainkey.yourdomain.com
   nslookup -type=TXT _dmarc.yourdomain.com
   ```

   Send a test message to a Gmail address, open **Show original** and confirm `SPF: PASS`, `DKIM: PASS`,
   `DMARC: PASS`.
4. **Create the mailbox that receives reports/replies** for `dmarc@yourdomain.com` (or point `rua` at any address).

## Environment variables (server only, `services/api/.env`)

```
SMTP_HOST=<from your provider>
SMTP_PORT=587                  # 465 for implicit TLS
SMTP_USER=<from your provider>
SMTP_PASSWORD=<from your provider>
MAIL_FROM_ADDRESS=noreply@yourdomain.com
SUPPORT_INBOX=<your private mailbox>   # stays on the server, never returned by an API
EMAIL_ASSET_BASE_URL=          # optional, see below
```

`.env` is git-ignored. Never put these in `NEXT_PUBLIC_*` variables or in frontend code.

## Behaviour

- **Production** (`APP_ENV` not `development`): a missing SMTP config, or a sender that is empty / a free-mail address,
  makes sending fail with a generic error (details go to the server log). Nothing is sent from a personal mailbox.
- **Development**: if SMTP or the sender is not usable, codes are written to the API log instead of being emailed.
  `SUPPORT_INBOX` must still be set, otherwise support messages return 503.
- The envelope sender and `Message-ID` use your domain, so no machine name or personal address leaks.
- `POST /api/support/messages` (signed-in users, 5 per hour each) is the only route that forwards messages; the
  feedback form uses it. A contact or support form can use the same route with `kind: "contact"` or `"support"`.

## Optional: glow pictures in the OTP email

The OTP email is complete without pictures (Gmail would list embedded pictures as attachment chips). If the web app is
deployed on a public URL, set `EMAIL_ASSET_BASE_URL=https://yourdomain.com/email` to link two decorative corner images
from `apps/web/public/email/`.
