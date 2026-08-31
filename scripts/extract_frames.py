#!/usr/bin/env python3
"""
LiquiGuard Hero Frame Extractor
================================
Extracts frames from a video file and saves them as JPEG images for use
in the scroll-driven canvas animation in the LiquiGuard frontend.

Usage:
    python3 extract_frames.py <input_video> [--fps 24] [--out ./frames] [--max 60]

Requirements:
    pip install opencv-python Pillow

After extraction, copy the frames to:
    frontend/public/images/frames/frame_000.jpg ... frame_NNN.jpg

Then update FRAME_COUNT in ScrollFrameHero.tsx to match the number of frames.
"""

import argparse
import os
import sys
from pathlib import Path

try:
    import cv2
    from PIL import Image
except ImportError:
    print("Missing dependencies. Run: pip install opencv-python Pillow")
    sys.exit(1)


def extract_frames(
    video_path: str,
    output_dir: str = "./frames",
    target_fps: float = 12.0,
    max_frames: int = 60,
    width: int = 1920,
    height: int = 1080,
):
    """Extract frames from video at target_fps and save as JPEG."""
    video_path = Path(video_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not video_path.exists():
        print(f"❌ Video file not found: {video_path}")
        sys.exit(1)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"❌ Could not open video: {video_path}")
        sys.exit(1)

    source_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_s = total_frames / source_fps

    print(f"✅ Video: {video_path.name}")
    print(f"   Source FPS: {source_fps:.1f} | Duration: {duration_s:.1f}s | Total Frames: {total_frames}")
    print(f"   Target FPS: {target_fps} | Max Output Frames: {max_frames}")
    print(f"   Output Size: {width}x{height}")
    print(f"   Output Dir: {output_dir.resolve()}")
    print()

    # Calculate which frame indices to extract
    frame_interval = source_fps / target_fps
    frame_indices = []
    i = 0.0
    while len(frame_indices) < max_frames and i < total_frames:
        frame_indices.append(int(i))
        i += frame_interval

    print(f"   Extracting {len(frame_indices)} frames...")

    extracted = 0
    for idx, frame_num in enumerate(frame_indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()
        if not ret:
            break

        # Resize with Pillow for high quality Lanczos downscaling
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(frame_rgb)

        # Crop to exact aspect ratio if needed
        if img.width / img.height != width / height:
            target_ratio = width / height
            current_ratio = img.width / img.height
            if current_ratio > target_ratio:
                # Crop sides
                new_width = int(img.height * target_ratio)
                left = (img.width - new_width) // 2
                img = img.crop((left, 0, left + new_width, img.height))
            else:
                # Crop top/bottom
                new_height = int(img.width / target_ratio)
                top = (img.height - new_height) // 2
                img = img.crop((0, top, img.width, top + new_height))

        img = img.resize((width, height), Image.LANCZOS)

        out_path = output_dir / f"frame_{idx:03d}.jpg"
        img.save(out_path, "JPEG", quality=88, optimize=True)
        extracted += 1

        if extracted % 5 == 0 or extracted == len(frame_indices):
            print(f"   [{extracted}/{len(frame_indices)}] frame_{idx:03d}.jpg")

    cap.release()

    print()
    print(f"✅ Done! {extracted} frames saved to: {output_dir.resolve()}")
    print()
    print("Next steps:")
    print(f"  1. Copy the frames folder to: frontend/public/images/frames/")
    print(f"  2. In ScrollFrameHero.tsx, set: const FRAME_COUNT = {extracted};")
    print(f"  3. Refresh your browser to see the scroll animation play the frames.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract frames from a video for scroll animation")
    parser.add_argument("video", help="Path to input video file (mp4, mov, webm, etc)")
    parser.add_argument("--fps", type=float, default=12.0, help="Target frames per second to extract (default: 12)")
    parser.add_argument("--out", default="./frames", help="Output directory (default: ./frames)")
    parser.add_argument("--max", type=int, default=60, help="Maximum number of frames to extract (default: 60)")
    parser.add_argument("--width", type=int, default=1920, help="Output frame width (default: 1920)")
    parser.add_argument("--height", type=int, default=1080, help="Output frame height (default: 1080)")
    args = parser.parse_args()

    extract_frames(
        video_path=args.video,
        output_dir=args.out,
        target_fps=args.fps,
        max_frames=args.max,
        width=args.width,
        height=args.height,
    )
