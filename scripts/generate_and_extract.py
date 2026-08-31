#!/usr/bin/env python3
"""
LiquiGuard Full Video Pipeline
================================
1. Generates a cinematic video using Google Veo 2 (via Gemini API)
2. Downloads the video
3. Extracts frames with zoom-optimised JPEG quality
4. Copies frames into frontend/public/images/frames/
5. Patches FRAME_COUNT in ScrollFrameHero.tsx automatically

Usage:
    python3 scripts/generate_and_extract.py

Requirements (already installed):
    pip3 install google-genai opencv-python Pillow
"""

import os
import sys
import time
import shutil
import re
from pathlib import Path

try:
    from google import genai
    from google.genai import types
    import cv2
    from PIL import Image
except ImportError as e:
    print(f"❌ Missing dependency: {e}")
    print("   Run: pip3 install google-genai opencv-python Pillow")
    sys.exit(1)

# ─── Config ──────────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

VIDEO_PROMPT = (
    "A breathtaking cinematic shot of a hyper-detailed glowing quantum crystal prism "
    "security core floating in deep space. The camera starts extremely far away, "
    "with the prism as a tiny speck in an infinite obsidian void. "
    "Slowly, dramatically zoom in over 8 seconds — the prism grows larger, "
    "neon purple and cyan light refracting and scattering across its crystalline facets, "
    "magenta orbital rings glowing around it. "
    "At the end the crystal fills the frame, pulsating with radiant energy. "
    "No text, no HUD, purely cinematic. Ultra 4K, dark space background."
)

OUTPUT_VIDEO = Path("scripts/hero_video.mp4")
FRAMES_DIR = Path("frontend/public/images/frames")
HERO_TSX = Path("frontend/src/components/ScrollFrameHero.tsx")

TARGET_FPS = 12          # frames per second to extract
MAX_FRAMES = 60          # max frames to extract
FRAME_W = 1920           # output width
FRAME_H = 1080           # output height
JPEG_QUALITY = 88        # JPEG compression quality

# ─────────────────────────────────────────────────────────────────────────────

def check_api_key():
    if not GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY environment variable not set.")
        print("   Set it with: export GEMINI_API_KEY=your_key_here")
        sys.exit(1)
    print(f"✅ API Key loaded ({GEMINI_API_KEY[:12]}...)")


def generate_video(client: genai.Client) -> Path:
    """Generate video using Veo 2 and save locally."""
    if OUTPUT_VIDEO.exists():
        print(f"✅ Video already exists at {OUTPUT_VIDEO}, skipping generation.")
        return OUTPUT_VIDEO

    print("\n🎬 Generating cinematic hero video with Veo 2...")
    print(f"   Prompt: {VIDEO_PROMPT[:80]}...")

    operation = client.models.generate_video(
        model="veo-2.0-generate-001",
        prompt=VIDEO_PROMPT,
        config=types.GenerateVideoConfig(
            aspect_ratio="16:9",
            duration_seconds=8,
            number_of_videos=1,
            enhance_prompt=True,
        ),
    )

    print("   ⏳ Waiting for generation (usually 2-4 minutes)...")
    poll = 0
    while not operation.done:
        time.sleep(10)
        operation = client.operations.get(operation)
        poll += 1
        elapsed = poll * 10
        print(f"   ... {elapsed}s elapsed", end="\r")

    if operation.error:
        print(f"\n❌ Video generation failed: {operation.error}")
        sys.exit(1)

    # Download video bytes
    video_result = operation.response.generated_videos[0]
    video_bytes = client.files.download(file=video_result.video)

    OUTPUT_VIDEO.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_VIDEO.write_bytes(video_bytes)
    print(f"\n✅ Video saved: {OUTPUT_VIDEO} ({OUTPUT_VIDEO.stat().st_size // 1024}KB)")
    return OUTPUT_VIDEO


def extract_frames(video_path: Path) -> int:
    """Extract JPEG frames from video and save to frames dir."""
    print(f"\n🖼  Extracting frames from {video_path}...")

    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"❌ Could not open video: {video_path}")
        sys.exit(1)

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 24
    total_source = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_source / source_fps
    print(f"   Source: {source_fps:.1f}fps · {total_source} frames · {duration:.1f}s")

    # Calculate which frame indices to extract
    interval = source_fps / TARGET_FPS
    indices = []
    pos = 0.0
    while len(indices) < MAX_FRAMES and pos < total_source:
        indices.append(int(pos))
        pos += interval

    print(f"   Extracting {len(indices)} frames at {TARGET_FPS}fps → {FRAMES_DIR}/")

    extracted = 0
    for out_idx, src_idx in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, src_idx)
        ret, frame = cap.read()
        if not ret:
            break

        # Convert BGR → RGB, resize with Lanczos
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb)

        # Centre-crop to target aspect ratio
        target_ratio = FRAME_W / FRAME_H
        current_ratio = img.width / img.height
        if abs(current_ratio - target_ratio) > 0.01:
            if current_ratio > target_ratio:
                new_w = int(img.height * target_ratio)
                left = (img.width - new_w) // 2
                img = img.crop((left, 0, left + new_w, img.height))
            else:
                new_h = int(img.width / target_ratio)
                top = (img.height - new_h) // 2
                img = img.crop((0, top, img.width, top + new_h))

        img = img.resize((FRAME_W, FRAME_H), Image.LANCZOS)

        out_path = FRAMES_DIR / f"frame_{out_idx:03d}.jpg"
        img.save(out_path, "JPEG", quality=JPEG_QUALITY, optimize=True)
        extracted += 1

        if extracted % 10 == 0 or extracted == len(indices):
            size_kb = out_path.stat().st_size // 1024
            print(f"   [{extracted:>3}/{len(indices)}] frame_{out_idx:03d}.jpg  ({size_kb}KB)")

    cap.release()
    print(f"\n✅ {extracted} frames saved to {FRAMES_DIR.resolve()}/")
    return extracted


def patch_frame_count(count: int):
    """Update FRAME_COUNT constant in ScrollFrameHero.tsx."""
    if not HERO_TSX.exists():
        print(f"⚠️  {HERO_TSX} not found — update FRAME_COUNT manually.")
        return

    content = HERO_TSX.read_text()
    updated = re.sub(
        r"const FRAME_COUNT\s*=\s*\d+",
        f"const FRAME_COUNT = {count}",
        content,
    )

    if updated == content:
        print(f"⚠️  Could not find FRAME_COUNT in {HERO_TSX} — update manually.")
    else:
        HERO_TSX.write_text(updated)
        print(f"✅ Patched FRAME_COUNT = {count} in {HERO_TSX}")


def main():
    print("=" * 60)
    print("  LiquiGuard — Cinematic Hero Frame Pipeline")
    print("=" * 60)

    check_api_key()

    client = genai.Client(api_key=GEMINI_API_KEY)

    # Step 1: Generate video
    video_path = generate_video(client)

    # Step 2: Extract frames
    frame_count = extract_frames(video_path)

    # Step 3: Patch ScrollFrameHero.tsx
    patch_frame_count(frame_count)

    print("\n" + "=" * 60)
    print("  🎉 Pipeline complete!")
    print(f"     {frame_count} frames → frontend/public/images/frames/")
    print(f"     FRAME_COUNT updated in ScrollFrameHero.tsx")
    print()
    print("  Next: refresh http://localhost:3000 and scroll the hero!")
    print("=" * 60)


if __name__ == "__main__":
    main()
