import { useEffect, useRef } from "react";
import type { Clip, Timing } from "@/lib/alignment";

type Props = {
  peaks: Float32Array; duration: number; time: number;
  timings: Timing[]; clips: Clip[]; activeClip?: string | null;
  onSeek: (t: number) => void;
};

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function Waveform({ peaks, duration, time, timings, clips, activeClip, onSeek }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !duration) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const x = (t: number) => (t / duration) * w; // timeline left→right (time axis)
    clips.forEach((cl, i) => {
      ctx.fillStyle = cl.id === activeClip ? "oklch(0.78 0.11 80 / 0.28)" : i % 2 ? "oklch(0.42 0.07 165 / 0.25)" : "oklch(0.42 0.07 165 / 0.12)";
      ctx.fillRect(x(cl.start), 0, x(cl.end) - x(cl.start), h);
    });
    ctx.fillStyle = css("--wave");
    const max = Math.max(...peaks, 0.001);
    for (let i = 0; i < peaks.length; i++) {
      const px = (i / peaks.length) * w;
      const ph = (peaks[i] / max) * (h * 0.85);
      ctx.fillRect(px, (h - ph) / 2, Math.max(1, w / peaks.length), ph);
    }
    ctx.fillStyle = css("--muted-foreground");
    timings.forEach((t) => ctx.fillRect(x(t.start), 0, 1, h));
    ctx.fillStyle = css("--primary");
    ctx.fillRect(x(time) - 1, 0, 2, h);
  }, [peaks, duration, time, timings, clips, activeClip]);

  return (
    <canvas
      ref={ref}
      dir="ltr"
      aria-label="الخط الزمني"
      className="h-16 w-full cursor-pointer rounded-lg bg-muted"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek(((e.clientX - r.left) / r.width) * duration);
      }}
    />
  );
}
