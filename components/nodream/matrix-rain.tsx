"use client";

import { useEffect, useRef } from 'react';

interface MatrixRainProps {
  enabled?: boolean;
  opacity?: number;
}

/**
 * Canvas-based katakana rain for the NoDream Tactical OS background.
 * Ported from the design prototype (chats/chat1.md).
 *
 * Reads `--accent-tech` from the body to pick its trail color, so it
 * responds to the palette tweak (matrix / cyan / magenta).
 */
export function MatrixRain({ enabled = true, opacity = 0.18 }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const fontSize = 14;
    let cols = Math.floor(w / fontSize);
    let drops = Array(cols).fill(0).map(() => Math.random() * -h);

    const chars =
      'ノドリームNODREAM01アイウエオカキクケコサシスセソタチツテトナニヌネノ$%#&*+=<>'.split('');

    const accent =
      getComputedStyle(document.body).getPropertyValue('--accent-tech').trim() || '#00ff66';

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      cols = Math.floor(w / fontSize);
      drops = Array(cols).fill(0).map(() => Math.random() * -h);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 50) {
        last = t;
        ctx.fillStyle = 'rgba(6, 3, 15, 0.06)';
        ctx.fillRect(0, 0, w, h);
        ctx.font = `bold ${fontSize}px JetBrains Mono, monospace`;
        for (let i = 0; i < cols; i++) {
          const c = chars[Math.floor(Math.random() * chars.length)];
          const x = i * fontSize;
          const y = drops[i] * fontSize;
          ctx.fillStyle = '#e6ffe6';
          ctx.shadowColor = accent;
          ctx.shadowBlur = 8;
          ctx.fillText(c, x, y);
          ctx.shadowBlur = 0;
          ctx.fillStyle = accent;
          if (drops[i] > 1) ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - fontSize);
          if (drops[i] > 3) {
            ctx.fillStyle = accent + 'aa';
            ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - fontSize * 2);
          }
          if (y > h && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className="matrix-rain" style={{ opacity }} aria-hidden />;
}
