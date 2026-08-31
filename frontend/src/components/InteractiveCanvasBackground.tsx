'use client';

import React, { useEffect, useRef } from 'react';

export function InteractiveCanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates
    let mouse = { x: width / 2, y: height / 2, radius: 180 };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // Particle nodes for grid wave
    const cols = Math.floor(width / 45);
    const rows = Math.floor(height / 45);
    const particles: { x: number; y: number; originX: number; originY: number; vx: number; vy: number; color: string; size: number }[] = [];

    const colors = [
      'rgba(168, 85, 247, 0.4)', // purple
      'rgba(236, 72, 153, 0.35)', // pink
      'rgba(6, 182, 212, 0.35)', // cyan
      'rgba(139, 92, 246, 0.25)', // indigo
    ];

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i / cols) * width + 20;
        const y = (j / rows) * height + 20;
        particles.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: 0,
          vy: 0,
          color: colors[(i + j) % colors.length],
          size: Math.random() * 1.5 + 0.8,
        });
      }
    }

    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Subtle ambient background gradient
      const bgGrad = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        50,
        mouse.x,
        mouse.y,
        width * 0.7
      );
      bgGrad.addColorStop(0, 'rgba(30, 12, 60, 0.35)');
      bgGrad.addColorStop(0.5, 'rgba(10, 4, 24, 0.15)');
      bgGrad.addColorStop(1, 'rgba(3, 2, 8, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw and update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Harmonic wave displacement
        const waveX = Math.sin(time + p.originY * 0.01) * 6;
        const waveY = Math.cos(time + p.originX * 0.01) * 6;

        // Mouse repulsion physics
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
          const force = (1 - distance / mouse.radius) * 20;
          const angle = Math.atan2(dy, dx);
          p.vx -= Math.cos(angle) * force * 0.15;
          p.vy -= Math.sin(angle) * force * 0.15;
        }

        // Spring back to wave origin
        p.vx += (p.originX + waveX - p.x) * 0.05;
        p.vy += (p.originY + waveY - p.y) * 0.05;

        // Damping
        p.vx *= 0.88;
        p.vy *= 0.88;

        p.x += p.vx;
        p.y += p.vy;

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Connect nearby particles with delicate laser lines
        if (i % cols !== cols - 1) {
          const rightP = particles[i + 1];
          const distToRight = Math.hypot(p.x - rightP.x, p.y - rightP.y);
          if (distToRight < 60) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(rightP.x, rightP.y);
            ctx.strokeStyle = `rgba(168, 85, 247, ${0.08 * (1 - distToRight / 60)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-75"
    />
  );
}
