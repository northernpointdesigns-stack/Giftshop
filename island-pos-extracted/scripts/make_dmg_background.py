#!/usr/bin/env python3
"""Generate the branded DMG background for 'The Gift Shop POS'.

Produces build/dmg-background.png (660x400) and the Retina
build/dmg-background@2x.png (1320x800). Icon wells are drawn at the same
icon-center coordinates used in electron-builder.json (dmg.contents), where
x/y are device-independent offsets from the top-left of the window.

Run:  python3 scripts/make_dmg_background.py
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 660, 400

# Positions must match electron-builder.json -> dmg.contents (icon centers).
APP_CENTER = (180, 190)
APPS_CENTER = (480, 190)
HELPER_CENTER = (330, 330)

TEAL = (13, 148, 136)
SHELL = (51, 65, 85)
MUTED = (148, 163, 184)
DIM = (107, 114, 128)
WHITE = (255, 255, 255)


def _font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for c in candidates:
        try:
            return ImageFont.truetype(c, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img


def _radial_glow(size, center, radius, color):
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    steps = 48
    for i in range(steps, 0, -1):
        rr = radius * i / steps
        alpha = int(22 * (1 - i / steps))
        d.ellipse(
            [center[0] - rr, center[1] - rr * 0.55, center[0] + rr, center[1] + rr * 0.55],
            fill=(color[0], color[1], color[2], alpha),
        )
    return overlay


def _draw_icon_well(d, cx, cy, s, outline, fill, radius=18):
    d.rounded_rectangle(
        [cx - 55 * s, cy - 55 * s, cx + 55 * s, cy + 55 * s],
        radius=int(radius * s),
        fill=fill,
        outline=outline,
        width=max(int(3 * s), 1),
    )


def _draw_gift(d, cx, cy, s):
    """Simple white gift-box glyph for the app icon well."""
    w = int(3 * s)
    d.rectangle([cx - 22 * s, cy + 8 * s, cx + 22 * s, cy + 26 * s], outline=SHELL, width=w)
    d.rectangle([cx - 22 * s, cy - 4 * s, cx + 22 * s, cy + 8 * s], outline=SHELL, width=w)
    d.line([cx, cy - 4 * s, cx, cy + 26 * s], fill=SHELL, width=w)
    d.line([cx - 22 * s, cy - 4 * s, cx, cy + 8 * s], fill=SHELL, width=w)
    d.line([cx + 22 * s, cy - 4 * s, cx, cy + 8 * s], fill=SHELL, width=w)


def _draw_up_arrow(d, cx, cy, s):
    """Classic upward arrow used for the /Applications shortcut chip."""
    d.polygon(
        [
            (cx, cy - 20 * s),
            (cx - 17 * s, cy - 3 * s),
            (cx - 6 * s, cy - 3 * s),
            (cx - 6 * s, cy + 20 * s),
            (cx + 6 * s, cy + 20 * s),
            (cx + 6 * s, cy - 3 * s),
            (cx + 17 * s, cy - 3 * s),
        ],
        fill=MUTED,
    )


def _center_text(d, text, font, y, fill):
    w = d.textlength(text, font=font)
    d.text(((W * 1) - w) / 2 * 1, y, text, font=font, fill=fill)


def make(scale, out):
    w, h = W * scale, H * scale
    s = scale
    img = _gradient((w, h), (13, 17, 28), (15, 17, 21))  # #0D111C -> #0F1115
    glow = _radial_glow((w, h), (int(330 * s), int(215 * s)), int(320 * s), TEAL)
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    d = ImageDraw.Draw(img)

    title = _font(int(34 * s), bold=True)
    sub = _font(int(15 * s))
    cap = _font(int(13 * s))

    t = "The Gift Shop POS"
    d.text(((w - d.textlength(t, font=title)) / 2, int(52 * s)), t, font=title, fill=WHITE)
    st = "Drag The Gift Shop POS into your Applications folder"
    d.text(((w - d.textlength(st, font=sub)) / 2, int(104 * s)), st, font=sub, fill=(156, 163, 175))

    cx, cy = (int(APP_CENTER[0] * s), int(APP_CENTER[1] * s))
    _draw_icon_well(d, cx, cy, s, TEAL, (20, 26, 38))
    _draw_gift(d, cx, cy, s)

    y = cy
    d.line([int(248 * s), y, int(412 * s), y], fill=TEAL, width=max(int(4 * s), 1))
    d.polygon(
        [(int(412 * s), y), (int(394 * s), y - int(13 * s)), (int(394 * s), y + int(13 * s))],
        fill=TEAL,
    )
    d.polygon(
        [(int(248 * s), y), (int(262 * s), y - int(11 * s)), (int(262 * s), y + int(11 * s))],
        fill=TEAL,
    )

    cx2, cy2 = (int(APPS_CENTER[0] * s), int(APPS_CENTER[1] * s))
    _draw_icon_well(d, cx2, cy2, s, MUTED, (20, 26, 38))
    _draw_up_arrow(d, cx2, cy2, s)

    cap_txt = "Double-click Install.command to clear Gatekeeper and launch"
    d.text(((w - d.textlength(cap_txt, font=cap)) / 2, int(HELPER_CENTER[1] * s - 42 * s)), cap_txt, font=cap, fill=DIM)

    img.convert("RGB").save(out)
    print("wrote", out, img.size)


if __name__ == "__main__":
    import os

    os.makedirs("build", exist_ok=True)
    make(1, "build/dmg-background.png")
    make(2, "build/dmg-background@2x.png")