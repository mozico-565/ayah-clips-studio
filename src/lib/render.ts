export type Aspect = "9:16" | "1:1" | "16:9";
export const SIZES: Record<Aspect, [number, number]> = { "9:16": [720, 1280], "1:1": [720, 720], "16:9": [1280, 720] };

import amiriAsset from '@/assets/amiri.ttf.asset.json';
import quranAsset from '@/assets/amiri-quran.ttf.asset.json';
export const QURAN_FONT = '"Ayah Uthmani", serif';
export const UI_FONT = '"IBM Plex Sans Arabic", sans-serif';
export type TextStyle = { font: 'uthmani' | 'amiri'; size: number; color: string; shadow: number; position: number; ornament: 'circle' | 'brackets' | 'none'; lineHeight: number; effect: 'fade' | 'none'; darkness: number };
export const DEFAULT_STYLE: TextStyle = { font: 'uthmani', size: 48, color: '#ffffff', shadow: 12, position: 50, ornament: 'circle', lineHeight: 1.9, effect: 'fade', darkness: .5 };
export type Background = HTMLImageElement | HTMLVideoElement;
let fontPromise: Promise<void> | null = null;

export async function ensureFonts() {
  if (!fontPromise) fontPromise = (async () => {
    for (const [name, url] of [['Ayah Uthmani', quranAsset.url], ['Ayah Amiri', amiriAsset.url]]) {
      const face = await new FontFace(name, `url(${url})`).load(); document.fonts.add(face);
    }
  })();
  await fontPromise;
}

export function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
    video.onloadeddata = () => resolve(video); video.onerror = () => reject(new Error('تعذر تحميل فيديو الخلفية')); video.src = src; video.load();
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawFrame(
  canvas: HTMLCanvasElement,
  aspect: Aspect,
  bg: Background | null,
  text: string,
  caption: string,
  style: TextStyle = DEFAULT_STYLE,
  number?: number,
  opacity = 1,
  transparent = false,
) {
  const [w, h] = SIZES[aspect];
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const tokens = getComputedStyle(document.documentElement);
  if (!transparent) { ctx.fillStyle = tokens.getPropertyValue('--video-background').trim(); ctx.fillRect(0, 0, w, h); }
  if (bg && !transparent) {
    const bw = bg instanceof HTMLVideoElement ? bg.videoWidth : bg.width, bh = bg instanceof HTMLVideoElement ? bg.videoHeight : bg.height;
    const s = Math.max(w / bw, h / bh);
    const dw = bw * s, dh = bh * s;
    ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  ctx.fillStyle = tokens.getPropertyValue('--video-shade').trim(); ctx.globalAlpha = style.darkness; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = opacity;
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = style.color;
  const maxW = w * 0.84;
  if (text) {
    let size = style.size * Math.min(w, h) / 720;
    let lines: string[] = [];
    const maxH = h * 0.6;
    for (; size > 16; size -= 2) {
      ctx.font = `${size}px ${style.font === 'uthmani' ? QURAN_FONT : '"Ayah Amiri", serif'}`;
      lines = wrap(ctx, text, maxW);
      if (lines.length * size * style.lineHeight <= maxH && lines.every(l => ctx.measureText(l).width <= maxW)) break;
    }
    const lh = size * style.lineHeight;
    const centerY = Math.max(lines.length * lh / 2 + 20, Math.min(h - lines.length * lh / 2 - 55, h * style.position / 100));
    const y0 = centerY - ((lines.length - 1) * lh) / 2;
    ctx.shadowColor = tokens.getPropertyValue('--video-shadow').trim(); ctx.shadowBlur = style.shadow;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y0 + i * lh));
    ctx.shadowBlur = 0;
    if (number != null && style.ornament !== 'none') {
      const y = y0 + (lines.length - 1) * lh + size * 1.25;
      ctx.font = `${size * .55}px "Ayah Amiri"`;
      const digits = number.toLocaleString('ar-EG');
      if (style.ornament === 'circle') { ctx.strokeStyle = style.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(w / 2, y, size * .48, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(w / 2, y, size * .55, 0, Math.PI * 2); ctx.stroke(); ctx.fillText(digits, w / 2, y); }
      else ctx.fillText(`﴿${digits}﴾`, w / 2, y);
    }
  }
  if (caption) {
    ctx.font = `${Math.round(Math.min(w, h) * 0.032)}px ${UI_FONT}`;
    ctx.fillStyle = style.color;
    ctx.fillText(caption, w / 2, h - Math.min(w, h) * 0.09);
  }
}

export const canvasToBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, reject) => c.toBlob((b) => b ? res(b) : reject(new Error('تعذر رسم إطار الفيديو')), "image/png"));
