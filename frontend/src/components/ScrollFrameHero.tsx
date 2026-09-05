'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIG — update when you extract video frames
//  python3 scripts/generate_synthetic_frames.py  (already done, 60 frames)
//  python3 scripts/extract_frames.py video.mp4 --max 60  (for real video)
// ─────────────────────────────────────────────────────────────────────────────
const FRAME_COUNT = 80;
const FRAMES_DIR = '/images/frames';

// Fallback for when frames folder is empty
const FALLBACK_SRCS = [
  '/images/frame_01.jpg',
  '/images/hologram_core.jpg',
  '/images/hero_somnia_orb.jpg',
];

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL BACKGROUND CANVAS
//  • Position: fixed, covers entire viewport, z-0
//  • Animates frame index based on TOTAL page scroll (0 → page bottom)
//  • All UI sections scroll over it with glass/translucent backgrounds
// ─────────────────────────────────────────────────────────────────────────────

export function ScrollFrameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(-1);
  const lastZoomRef = useRef(1);
  const lastOverlayRef = useRef(0);
  const [ready, setReady] = useState(false);

  // ── Load all frames ───────────────────────────────────────────────────────
  useEffect(() => {
    const srcs =
      FRAME_COUNT > 0
        ? Array.from({ length: FRAME_COUNT }, (_, i) =>
            `${FRAMES_DIR}/frame_${String(i).padStart(3, '0')}.jpg`
          )
        : FALLBACK_SRCS;

    let done = 0;
    const imgs = srcs.map((src) => {
      const img = new Image();
      img.src = src;
      img.onload = img.onerror = () => {
        done++;
        if (done === srcs.length) setReady(true);
      };
      return img;
    });
    imagesRef.current = imgs;
  }, []);

  // ── Draw frame ────────────────────────────────────────────────────────────
  const drawFrame = useCallback((index: number, zoom: number, overlayAlpha: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgs = imagesRef.current.filter((i) => i.complete && i.naturalWidth > 0);
    if (!imgs.length) return;

    const img = imgs[Math.min(Math.max(index, 0), imgs.length - 1)];
    if (!img?.complete) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Always cover the viewport. Zoom < 1 leaves pillarbox bars on the sides
    // when returning to the hero. Ken Burns still zooms above 1 while scrolling.
    const coverZoom = Math.max(zoom, 1);
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = canvas.width / canvas.height;
    const dw = ir >= cr ? canvas.height * ir * coverZoom : canvas.width * coverZoom;
    const dh = ir >= cr ? canvas.height * coverZoom : (canvas.width / ir) * coverZoom;
    ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);

    const topFade = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.35);
    topFade.addColorStop(0, 'rgba(7,3,17,0.55)');
    topFade.addColorStop(1, 'rgba(7,3,17,0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bottomFade = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
    bottomFade.addColorStop(0, 'rgba(7,3,17,0)');
    bottomFade.addColorStop(1, 'rgba(7,3,17,0.9)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Side glow only after leaving the hero — otherwise it reads as a leftover frame box
    if (overlayAlpha > 0) {
      const leftPurple = ctx.createLinearGradient(0, 0, canvas.width * 0.18, 0);
      leftPurple.addColorStop(0, 'rgba(60,10,90,0.35)');
      leftPurple.addColorStop(1, 'rgba(60,10,90,0)');
      ctx.fillStyle = leftPurple;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const rightPurple = ctx.createLinearGradient(canvas.width * 0.82, 0, canvas.width, 0);
      rightPurple.addColorStop(0, 'rgba(60,10,90,0)');
      rightPurple.addColorStop(1, 'rgba(60,10,90,0.35)');
      ctx.fillStyle = rightPurple;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Dark overlay for readability when scrolled into bento/vault
    if (overlayAlpha > 0) {
      ctx.fillStyle = `rgba(7,3,17,${overlayAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

  }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    if (lastFrameRef.current >= 0) {
      drawFrame(lastFrameRef.current, lastZoomRef.current, lastOverlayRef.current);
    }
  }, [drawFrame]);

  // ── Scroll → global page progress ────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const imgs = imagesRef.current.filter((i) => i.complete && i.naturalWidth > 0);
    const total = imgs.length;

    lastFrameRef.current = 0;
    lastZoomRef.current = 1;
    lastOverlayRef.current = 0;
    drawFrame(0, 1, 0);

    const onScroll = () => {
      const scrollMax = document.body.scrollHeight - window.innerHeight;
      const t = scrollMax > 0 ? Math.min(window.scrollY / scrollMax, 1) : 0;

      const rawPct = Math.min(t / 0.85, 1);
      const eased = 1 - Math.pow(1 - rawPct, 3);
      const fi = Math.floor(eased * (total - 1));

      // Never zoom below 1 (cover). 1.0 at hero → 1.12 mid-scroll → 1.0 later.
      let zoom: number;
      if (t < 0.35) zoom = 1.0 + (t / 0.35) * 0.12;
      else if (t < 0.85) zoom = 1.12 - ((t - 0.35) / 0.50) * 0.12;
      else zoom = 1.0;

      // Dark overlay increases after hero zone (after ~30% scroll = bento/vault)
      // 0 in hero → 0.55 in vault section (keeps canvas visible but readable)
      const overlay = t < 0.30 ? 0 : Math.min((t - 0.30) / 0.45 * 0.55, 0.55);

      lastFrameRef.current = fi;
      lastZoomRef.current = zoom;
      lastOverlayRef.current = overlay;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => drawFrame(fi, zoom, overlay));
    };

    // Initial draw with no scroll
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, resize, drawFrame]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{
        zIndex: 0,
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.8s ease',
        width: '100vw',
        height: '100vh',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  HERO TEXT SECTION
//  • Not sticky — normal scrolling section on top of the fixed canvas
//  • Takes up 100vh, text fades out as user scrolls away
// ─────────────────────────────────────────────────────────────────────────────

interface HeroTextSectionProps {
  onLaunchVault?: () => void;
  onOpenArchitecture?: () => void;
}

export function HeroTextSection({ onLaunchVault, onOpenArchitecture }: HeroTextSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(1);
  const [translateY, setTranslateY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = Math.max(0, -rect.top / (window.innerHeight * 0.5));
      setOpacity(Math.max(0, 1 - progress * 1.4));
      setTranslateY(progress * -40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section
      ref={ref}
      className="relative w-full min-h-screen flex flex-col items-center justify-center px-6 md:px-16 py-24"
      style={{ zIndex: 10 }}
    >
      <div
        className="max-w-3xl w-full text-center space-y-7"
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          willChange: 'opacity, transform',
        }}
      >
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/[0.1] text-xs font-semibold text-purple-200 backdrop-blur-xl">
          <img src="/logo.png" alt="LiquiGuard Logo" className="w-4 h-4 rounded-[4px] object-cover" />
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
          </span>
          <span>Somnia Shannon Testnet · Sub-100ms Micro-Hedging</span>
        </div>

        {/* Title */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[1.02] text-white drop-shadow-[0_0_40px_rgba(168,85,247,0.35)]">
          Zero-Liquidation
          <br />
          <span className="text-gradient-purple">Lending Vaults</span>
          <br />
          <span className="text-gradient-sunset text-4xl sm:text-5xl lg:text-6xl">On Somnia Network</span>
        </h1>

        {/* Sub */}
        <p className="text-base sm:text-lg text-purple-100/70 leading-relaxed max-w-xl mx-auto">
          When markets crash, LiquiGuard executes sub-second DreamDEX binary hedges
          to self-heal your debt before liquidators can act.
        </p>

        {/* Metrics row */}
        <div className="pt-2 border-t border-white/10 space-y-1">
          <div className="flex items-center justify-center gap-10">
            {[
              {
                val: '<100ms',
                label: 'Reactivity',
                title: 'Somnia sub-second consensus target — demo reaction time depends on keeper polling interval',
              },
              {
                val: '100k+',
                label: 'TPS',
                title: 'Somnia network marketing spec — not measured on this page',
              },
              {
                val: '$0',
                label: 'Liq Penalty',
                cls: 'text-pink-400',
                title: 'Autonomous micro-hedging repays debt before liquidation threshold',
              },
            ].map(({ val, label, cls, title }) => (
              <div key={label} className="text-center" title={title}>
                <div className={`text-2xl font-black font-mono ${cls ?? 'text-white'}`}>{val}</div>
                <div className="text-[10px] text-purple-300/60 font-medium uppercase tracking-widest">{label}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-purple-300/40 font-mono text-center">
            Somnia network spec · not measured on this page
          </div>
        </div>


        {/* CTA */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={onLaunchVault}
            className="glow-btn-primary px-7 py-3 rounded-xl text-sm font-bold cursor-pointer hover:scale-105 transition-all shadow-lg"
          >
            Launch Vault ↓
          </button>
          <button
            onClick={onOpenArchitecture}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-purple-200 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm cursor-pointer hover:scale-105"
          >
            Architecture →
          </button>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ opacity: opacity * 0.7 }}>
        <span className="text-[10px] text-white/40 font-medium tracking-widest uppercase">Scroll</span>
        <div className="w-5 h-8 rounded-full border border-white/20 flex justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-white/50 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
