#!/usr/bin/env python3
"""
LiquiGuard — 4-Keyframe Synthetic Frame Generator
===================================================
Creates 80 frames across 4 keyframe images:
  0 — frame_01.jpg         (far: tiny prism in void)
  1 — hologram_core.jpg    (mid-far: approaching, ~25% zoom in)
  2 — hologram_core blend  (mid-close: blended intermediate, ~60% zoom)
  3 — hero_somnia_orb.jpg  (close: full glow, fully zoomed)

Easing: ease-in-out between each pair, so transitions feel organic.
Zoom: 1.0x → 1.3x → 1.6x → 1.4x (slight pullback at end)
"""

import sys
from pathlib import Path
import math
import re

try:
    from PIL import Image, ImageFilter, ImageEnhance
except ImportError:
    print("Run: pip3 install Pillow")
    sys.exit(1)

FRAMES_DIR = Path("frontend/public/images/frames")
FRAME_W, FRAME_H = 1920, 1080
TOTAL_FRAMES = 80
JPEG_QUALITY = 88

# 4 keyframe sources — ordered far → close
SOURCES = [
    Path("frontend/public/images/frame_01.jpg"),       # 0: far void
    Path("frontend/public/images/hologram_core.jpg"),  # 1: mid approach
    Path("frontend/public/images/hologram_core.jpg"),  # 2: same img, higher zoom (tighter crop)
    Path("frontend/public/images/hero_somnia_orb.jpg"),# 3: full close-up glow
]

# Zoom levels at each keyframe (1.0 = no zoom, 1.6 = very close)
KEYFRAME_ZOOMS = [1.02, 1.25, 1.55, 1.42]

# Brightness tweak per keyframe (1.0 = unchanged)
KEYFRAME_BRIGHTNESS = [1.0, 1.05, 1.10, 1.15]


def ease_in_out_quad(t: float) -> float:
    return 2 * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 2 / 2


def ease_in_out_cubic(t: float) -> float:
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def cover_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Centre-cover crop to exact aspect ratio."""
    tr = target_w / target_h
    ir = img.width / img.height
    if abs(ir - tr) > 0.01:
        if ir > tr:
            nw = int(img.height * tr)
            left = (img.width - nw) // 2
            img = img.crop((left, 0, left + nw, img.height))
        else:
            nh = int(img.width / tr)
            top = (img.height - nh) // 2
            img = img.crop((0, top, img.width, top + nh))
    return img.resize((target_w, target_h), Image.LANCZOS)


def zoom_crop(img: Image.Image, zoom: float) -> Image.Image:
    """Zoom in by cropping centre."""
    if zoom <= 1.0:
        return img
    w, h = img.size
    nw, nh = int(w / zoom), int(h / zoom)
    left, top = (w - nw) // 2, (h - nh) // 2
    return img.crop((left, top, left + nw, top + nh)).resize((w, h), Image.LANCZOS)


def add_overlays(img: Image.Image, t_global: float) -> Image.Image:
    """Purple edge glows + soft top/bottom fades."""
    from PIL import ImageDraw

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = img.size

    # Top fade (dark)
    for y in range(int(h * 0.30)):
        a = int(130 * (1 - y / (h * 0.30)))
        draw.line([(0, y), (w, y)], fill=(7, 3, 17, a))

    # Bottom fade (dark)
    fade_start = int(h * 0.62)
    for y in range(fade_start, h):
        a = int(220 * ((y - fade_start) / (h - fade_start)))
        draw.line([(0, y), (w, y)], fill=(7, 3, 17, a))

    # Left purple glow
    for x in range(int(w * 0.14)):
        a = int(80 * (1 - x / (w * 0.14)))
        draw.line([(x, 0), (x, h)], fill=(60, 10, 90, a))

    # Right purple glow
    edge_start = int(w * 0.86)
    for x in range(edge_start, w):
        a = int(80 * ((x - edge_start) / (w - edge_start)))
        draw.line([(x, 0), (x, h)], fill=(60, 10, 90, a))

    result = Image.alpha_composite(img.convert("RGBA"), overlay)
    return result.convert("RGB")


def main():
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    # Load and prep all 4 keyframes
    print("📂 Loading 4 keyframe images...")
    keyframes = []
    for i, src in enumerate(SOURCES):
        if not src.exists():
            print(f"   ⚠️  Missing: {src}")
            if keyframes:
                keyframes.append(keyframes[-1].copy())
            continue
        img = cover_crop(Image.open(src).convert("RGB"), FRAME_W, FRAME_H)
        # Slight brightness boost for later keyframes (crystal "activates")
        img = ImageEnhance.Brightness(img).enhance(KEYFRAME_BRIGHTNESS[i])
        keyframes.append(img)
        print(f"   ✅ [{i}] {src.name}  brightness={KEYFRAME_BRIGHTNESS[i]}  zoom_target={KEYFRAME_ZOOMS[i]}×")

    if len(keyframes) < 2:
        print("❌ Need at least 2 source images.")
        sys.exit(1)

    # Pad to 4 if needed
    while len(keyframes) < 4:
        keyframes.append(keyframes[-1].copy())

    n_segs = len(keyframes) - 1  # 3 segments
    # frames per segment (weighted: last segment gets more frames = slower)
    seg_weights = [0.28, 0.30, 0.42]  # 22, 24, 34 frames → totals 80
    seg_frames = [round(w * TOTAL_FRAMES) for w in seg_weights]
    seg_frames[-1] = TOTAL_FRAMES - sum(seg_frames[:-1])  # ensure exact total

    print(f"\n🎬 Generating {TOTAL_FRAMES} frames across {n_segs} segments: {seg_frames}")

    generated = 0
    for seg in range(n_segs):
        n = seg_frames[seg]
        img_a = keyframes[seg]
        img_b = keyframes[seg + 1]
        za = KEYFRAME_ZOOMS[seg]
        zb = KEYFRAME_ZOOMS[seg + 1]

        for i in range(n):
            local_t = i / (n - 1) if n > 1 else 1.0
            eased_t = ease_in_out_cubic(local_t)

            # Blend images
            blended = Image.blend(img_a, img_b, eased_t)

            # Interpolate zoom
            zoom = za + (zb - za) * eased_t
            final = zoom_crop(blended, zoom)

            # Very slight gaussian blur at far/early frames (depth of field)
            global_t = generated / (TOTAL_FRAMES - 1)
            if global_t < 0.08:
                blur_r = (0.08 - global_t) / 0.08 * 2.5
                final = final.filter(ImageFilter.GaussianBlur(blur_r))

            # Add purple edge overlays
            final = add_overlays(final, global_t)

            out_path = FRAMES_DIR / f"frame_{generated:03d}.jpg"
            final.save(out_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
            generated += 1

        seg_end = generated - 1
        print(f"   Segment {seg} done → frames {generated - n:03d}–{seg_end:03d}  "
              f"zoom {za:.2f}×→{zb:.2f}×")

    print(f"\n✅ {generated} frames saved to {FRAMES_DIR.resolve()}/")

    # Auto-patch FRAME_COUNT in ScrollFrameHero.tsx
    hero = Path("frontend/src/components/ScrollFrameHero.tsx")
    if hero.exists():
        txt = hero.read_text()
        patched = re.sub(r"const FRAME_COUNT\s*=\s*\d+", f"const FRAME_COUNT = {generated}", txt)
        hero.write_text(patched)
        print(f"✅ Patched FRAME_COUNT = {generated} in ScrollFrameHero.tsx")

    print("\n🎉 Done! Refresh http://localhost:3000 — scroll will feel smoother.")


if __name__ == "__main__":
    main()
