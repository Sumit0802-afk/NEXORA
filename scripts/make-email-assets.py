"""Cuts the optional light-trail pictures for the OTP email out of the approved mock-up (needs Pillow).

Usage: python scripts/make-email-assets.py path/to/otp-reference.webp
Writes apps/web/public/email/*, served by the web app at <site>/email/<file>. The email only links to them when
EMAIL_ASSET_BASE_URL is set; it never embeds pictures (Gmail would list them as attachment chips). The email looks
complete without them: they just add the glowing trails in two corners.
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "apps/web/public/email"


def main(ref: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.open(ref).convert("RGB")
    im.crop((0, 0, 420, 370)).save(OUT / "trails-top.jpg", quality=82, optimize=True)
    im.crop((1100, 770, 1536, 1024)).save(OUT / "trails-bottom.jpg", quality=82, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1])
