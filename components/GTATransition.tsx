'use client';

import { useEffect, useRef, ReactNode, useState } from 'react';

interface ZapMorphProps {
  /** The "from" scene rendered as a child (map view) */
  fromScene: ReactNode;
  /** The "to" scene rendered under (data view) */
  toScene: ReactNode;
  /** 
   * 'enter' = map→data   
   * 'exit'  = data→map 
   * 'idle'  = show fromScene only (map); 'active' = show toScene only
   */
  mode: 'idle' | 'enter' | 'active' | 'exit';
  /** Normalized click origin [0-1, 0-1] — zoom emanates from here */
  origin: { x: number; y: number };
  onEnterComplete: () => void;
  onExitComplete: () => void;
}

const ENTER_MS = 680;
const EXIT_MS  = 520;

function ease(t: number): number {
  // Cubic bezier approximation: fast start, gentle end
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default function ZapMorph({
  fromScene, toScene, mode, origin, onEnterComplete, onExitComplete,
}: ZapMorphProps) {
  const fromRef  = useRef<HTMLDivElement>(null);
  const toRef    = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const [frameCount, setFrameCount] = useState(0); // force re-render on RAF

  // Kill any ongoing animation
  const stopRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
  };

  useEffect(() => {
    stopRaf();

    if (mode === 'idle' || mode === 'active') {
      // Snap to final state immediately
      applyFrom(fromRef.current, mode === 'idle' ? 0 : 1);
      applyTo(toRef.current,     mode === 'idle' ? 0 : 1, origin);
      return;
    }

    const duration = mode === 'enter' ? ENTER_MS : EXIT_MS;
    const forward  = mode === 'enter';

    function frame(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const raw = Math.min((ts - startRef.current) / duration, 1);
      const t   = forward ? ease(raw) : 1 - ease(raw);

      applyFrom(fromRef.current, t);
      applyTo(toRef.current, t, origin);

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        if (forward) onEnterComplete();
        else         onExitComplete();
      }
    }

    rafRef.current = requestAnimationFrame(frame);
    return stopRaf;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* FROM layer (map) */}
      <div
        ref={fromRef}
        style={{
          position: 'absolute', inset: 0,
          willChange: 'transform, filter, opacity',
          transformOrigin: `${origin.x * 100}% ${origin.y * 100}%`,
        }}
      >
        {fromScene}
      </div>

      {/* TO layer (data view) */}
      <div
        ref={toRef}
        style={{
          position: 'absolute', inset: 0,
          willChange: 'transform, filter, opacity',
          transformOrigin: `${origin.x * 100}% ${origin.y * 100}%`,
          pointerEvents: mode === 'active' ? 'auto' : 'none',
        }}
      >
        {toScene}
      </div>
    </div>
  );
}

/**
 * Apply transform to the FROM (map) layer.
 * t=0 → normal; t=1 → fully zoomed+blurred out
 */
function applyFrom(el: HTMLDivElement | null, t: number) {
  if (!el) return;
  // Scale up dramatically (zap zoom) as t goes 0→1
  const scale  = 1 + t * 3.2;           // 1x → 4.2x
  const blur   = t * t * 22;            // 0 → 22px (motion blur feel)
  const opacity = Math.max(1 - t * 1.6, 0); // fade out

  el.style.transform = `scale(${scale})`;
  el.style.filter    = `blur(${blur.toFixed(1)}px)`;
  el.style.opacity   = opacity.toFixed(3);
}

/**
 * Apply transform to the TO (data) layer.
 * t=0 → zoomed-in compressed; t=1 → normal
 */
function applyTo(el: HTMLDivElement | null, t: number, origin: { x: number; y: number }) {
  if (!el) return;
  el.style.transformOrigin = `${origin.x * 100}% ${origin.y * 100}%`;

  // Scale in from small: data view starts tiny at the click point and expands
  const scale   = 0.25 + t * 0.75;      // 0.25x → 1x
  const blur    = (1 - t) * (1 - t) * 18; // starts blurry, clears up
  const opacity = Math.pow(t, 0.5);     // quick fade in

  el.style.transform = `scale(${scale.toFixed(4)})`;
  el.style.filter    = `blur(${blur.toFixed(1)}px)`;
  el.style.opacity   = opacity.toFixed(3);
}
