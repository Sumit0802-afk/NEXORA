"""HTML and plain-text bodies for the verification, sign-in and password-reset emails.

Premium black-and-gold design: wordmark between gold light lines, bold title, a large glowing OTP card with six cream
tiles, a validity pill and a security note, with sparkles and light trails around it.

Built for real inboxes:
- Pure table layout with inline styles and bgcolor fallbacks, so Outlook (Word engine) and Gmail render the same
  structure. Gradients, shadows and rounded corners are enhancements that degrade to flat colour / square corners.
- No pictures are ever embedded (Gmail would list them as attachment chips). With asset_base (the public URL of the web
  app's /email folder) two glowing trail pictures are linked in the corners; without it the design is complete anyway.
- Motion is CSS-only (Apple Mail, iOS Mail, some Android clients) and switched off for prefers-reduced-motion. Gmail and
  Outlook ignore it and show the finished static design.
- One 600px column that shrinks: tiles are percentage-width and a media query tightens type and spacing on phones.
"""
from html import escape

_COPY = {
    "verify": {
        "subject": "Your NEXORA verification code",
        "preheader": "Your verification code",
        "title": "Verify your email",
        "intro": "Welcome to NEXORA. Use the OTP below to verify your email and finish creating your account.",
    },
    "login": {
        "subject": "Your NEXORA sign-in code",
        "preheader": "Your sign-in code",
        "title": "Confirm it’s you",
        "intro": "Someone entered your password to sign in to NEXORA. Use the OTP below to continue.",
    },
    "reset": {
        "subject": "Your NEXORA password reset code",
        "preheader": "Your password reset code",
        "title": "Reset your password",
        "intro": "We received a request to reset your password. Use the OTP below to choose a new one.",
    },
}

BG, CARD, CREAM, GOLD, GOLD_DIM, MUTED = "#0B0A09", "#14110D", "#FFF1CF", "#E0B66B", "#8A6A33", "#C9BFA8"
# Invisible filler after the preheader so inbox lists show only that line, not the first words of the body.
PREHEADER_PAD = "&nbsp;&zwnj;" * 120
FONT = "'Segoe UI',Helvetica,Arial,sans-serif"


def _line(direction: str) -> str:
    """A thin gold light line fading out toward the middle ('in' fades in left-to-right, 'out' the reverse)."""
    a, b = ("transparent", GOLD) if direction == "in" else (GOLD, "transparent")
    return (f'<td class="nx-trail" height="1" bgcolor="{GOLD_DIM}" '
            f'style="height:1px;font-size:0;line-height:0;background:linear-gradient(90deg,{a},{b});">&nbsp;</td>')


def _rule(direction: str, width: str) -> str:
    return (f'<td width="{width}" valign="middle"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
            f'<tr>{_line(direction)}</tr></table></td>')


def _sparks(left: tuple[str, str], right: tuple[str, str], pad: str) -> str:
    cells = "".join(
        f'<td align="{side}" class="nx-spark {cls}" style="padding:{pad};font-family:{FONT};font-size:14px;line-height:14px;color:{GOLD};">{ch}</td>'
        for (ch, cls), side in ((left, "left"), (right, "right"))
    )
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{cells}</tr></table>'


def otp_email(code: str, minutes: int, purpose: str = "verify", asset_base: str = "") -> tuple[str, str, str]:
    """Returns (subject, plain_text, html)."""
    c = _COPY[purpose if purpose in _COPY else "verify"]
    base = asset_base.rstrip("/")
    top_bg = f"background:{BG} url({base}/trails-top.jpg) no-repeat left top;background-size:210px auto;" if base else f"background:{BG};"
    bottom_bg = f"background:{BG} url({base}/trails-bottom.jpg) no-repeat right bottom;background-size:240px auto;" if base else f"background:{BG};"

    n = len(code)
    tile_w = f"{100 // n - 2}%"
    tiles = "".join(
        f'<td class="nx-tile" width="{tile_w}" align="center" bgcolor="{CREAM}" '
        f'style="width:{tile_w};background:#FFF1CF;background:linear-gradient(180deg,#FFF6DC,#F3DDA8);border-radius:14px;'
        f'font-family:{FONT};font-size:40px;font-weight:700;color:#14110D;height:76px;line-height:76px;'
        f'animation-delay:{0.3 + i * 0.1:.1f}s;">{escape(ch)}</td>'
        + ('<td class="nx-gap" width="2%" style="font-size:0;line-height:0;">&nbsp;</td>' if i < n - 1 else "")
        for i, ch in enumerate(code)
    )

    text = (
        f"{c['title']}\n\n{c['intro']}\n\nYour OTP: {code}\n\n"
        f"This code is valid for {minutes} minutes and can be used once.\n"
        "Never share this code with anyone. NEXORA will never ask you for it.\n"
        "If you did not request this, you can safely ignore this email.\n\n— NEXORA"
    )

    html = f"""<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>{escape(c['subject'])}</title>
<!--[if mso]><style>td,div,p,h1,span{{font-family:Segoe UI,Arial,sans-serif !important}}</style><![endif]-->
<style>
body,table,td{{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}}
@keyframes nx-rise{{from{{opacity:0;transform:translateY(16px)}}to{{opacity:1;transform:none}}}}
@keyframes nx-pop{{0%{{opacity:0;transform:scale(.6)}}70%{{transform:scale(1.07)}}100%{{opacity:1;transform:scale(1)}}}}
@keyframes nx-trail{{0%{{background-position:200% 0}}100%{{background-position:-200% 0}}}}
@keyframes nx-twinkle{{0%,100%{{opacity:.25}}50%{{opacity:1}}}}
@keyframes nx-glow{{0%,100%{{box-shadow:0 0 18px rgba(224,182,107,.18)}}50%{{box-shadow:0 0 44px rgba(224,182,107,.42)}}}}
@media (prefers-reduced-motion:no-preference){{
.nx-rise{{animation:nx-rise .8s cubic-bezier(.2,.7,.2,1) both}}
.nx-d1{{animation-delay:.1s}}.nx-d2{{animation-delay:.25s}}.nx-d3{{animation-delay:.85s}}
.nx-tile{{animation:nx-pop .6s cubic-bezier(.2,.8,.3,1) both}}
.nx-trail{{background-size:200% 100% !important;animation:nx-trail 5s linear infinite}}
.nx-spark{{animation:nx-twinkle 3s ease-in-out infinite}}.nx-s2{{animation-delay:1s}}.nx-s3{{animation-delay:2s}}
.nx-card{{animation:nx-glow 4s ease-in-out infinite}}
}}
@media only screen and (max-width:480px){{
.nx-pad{{padding-left:14px !important;padding-right:14px !important}}
.nx-title{{font-size:30px !important}}
.nx-intro{{font-size:15px !important}}
.nx-card-pad{{padding:30px 12px 24px !important}}
.nx-tile{{font-size:30px !important;height:60px !important;line-height:60px !important;border-radius:11px !important}}
.nx-brand{{font-size:23px !important}}
.nx-pill{{font-size:12px !important}}
}}
</style></head>
<body style="margin:0;padding:0;background:{BG};" bgcolor="{BG}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{BG};">{escape(c['preheader'])}{PREHEADER_PAD}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{BG}" style="background:{BG};">
<tr><td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{BG}" style="max-width:600px;width:100%;background:{BG};">

<tr><td class="nx-pad" align="center" style="padding:34px 24px 0;{top_bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
{_rule("in", "30%")}
<td align="center" valign="middle" style="padding:0 10px;">
<div style="font-family:{FONT};font-size:34px;line-height:26px;font-weight:200;color:{CREAM};">&#8896;</div>
<div class="nx-brand" style="margin-top:6px;font-family:{FONT};font-size:26px;font-weight:300;letter-spacing:.34em;color:{CREAM};padding-left:.34em;">NEXORA</div>
</td>
{_rule("out", "30%")}
</tr></table>
</td></tr>

<tr><td class="nx-pad nx-rise nx-d1" align="center" style="padding:22px 28px 0;font-family:{FONT};">
{_sparks(("&#10022;", "nx-s2"), ("&middot;", ""), "0 6px")}
<h1 class="nx-title" style="margin:0;font-size:44px;line-height:1.12;font-weight:800;color:{CREAM};letter-spacing:-.01em;">{escape(c['title'])}</h1>
<p class="nx-intro" style="margin:14px auto 0;max-width:440px;font-size:17px;line-height:1.55;color:{MUTED};">{escape(c['intro'])}</p>
</td></tr>

<tr><td class="nx-pad nx-rise nx-d2" align="center" style="padding:26px 22px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="nx-card" bgcolor="{CARD}"
 style="background:{CARD};background:linear-gradient(160deg,#1C1711,#100E0B);border:1px solid {GOLD_DIM};border-radius:26px;box-shadow:0 0 30px rgba(224,182,107,.22);">
<tr><td class="nx-card-pad" align="center" style="padding:34px 22px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
<td width="60" height="60" align="center" bgcolor="#1E1812" style="width:60px;height:60px;background:#1E1812;border:2px solid {GOLD};border-radius:30px;font-family:{FONT};font-size:26px;line-height:56px;color:{CREAM};box-shadow:0 0 22px rgba(224,182,107,.45);">&#9993;</td>
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
{_rule("in", "28%")}
<td align="center" style="padding:0 10px;font-family:{FONT};font-size:20px;font-weight:600;color:{CREAM};white-space:nowrap;"><span style="color:{GOLD};font-size:11px;">&#9670;</span>&nbsp; Your OTP &nbsp;<span style="color:{GOLD};font-size:11px;">&#9670;</span></td>
{_rule("out", "28%")}
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>{tiles}</tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:22px;"><tr>
<td class="nx-pill" align="center" style="padding:9px 20px;border:1px solid {GOLD_DIM};border-radius:22px;font-family:{FONT};font-size:14px;color:{CREAM};"><span style="color:{GOLD};">&#9719;</span>&nbsp; This code is valid for {minutes} minutes.</td>
</tr></table>
</td></tr></table>
</td></tr>

<tr><td class="nx-pad nx-rise nx-d3" align="center" style="padding:24px 28px 26px;font-family:{FONT};{bottom_bg}">
<div style="font-size:15px;line-height:1.5;color:{CREAM};"><span style="color:{GOLD};">&#10003;</span>&nbsp; Never share this code with anyone. NEXORA will never ask you for it.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr>
{_rule("in", "10%")}
<td align="center" style="padding:0 10px;font-size:13px;line-height:1.5;color:#A59B86;">If you didn’t request it, you can safely ignore this email.</td>
{_rule("out", "10%")}
</tr></table>
{_sparks(("&middot;", "nx-s3"), ("&#10022;", ""), "6px 10px 0")}
</td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>"""
    return c["subject"], text, html
