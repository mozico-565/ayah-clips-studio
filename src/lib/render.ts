export type Aspect = "9:16" | "1:1" | "16:9";
export const SIZES: Record<Aspect, [number, number]> = { "9:16": [720, 1280], "1:1": [720, 720], "16:9": [1280, 720] };

export const QURAN_FONT = '"Amiri Quran", "Amiri", serif';
export const UI_FONT = '"IBM Plex Sans Arabic", sans-serif';

export async function ensureFonts() {
  await Promise.all([
    document.fonts.load(`48px "Amiri Quran"`, "بِسْمِ"),
    document.fonts.load(`24px "IBM Plex Sans Arabic"`, "سورة"),
  ]).catch(() => {});
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
  bg: HTMLImageElement | null,
  text: string,
  caption: string,
) {
  const [w, h] = SIZES[aspect];
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0f0e";
  ctx.fillRect(0, 0, w, h);
  if (bg) {
    const s = Math.max(w / bg.width, h / bg.height);
    const dw = bg.width * s, dh = bg.height * s;
    ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.35)"); g.addColorStop(0.5, "rgba(0,0,0,0.55)"); g.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.direction = "rtl"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#f5ecd7";
  const maxW = w * 0.84;
  if (text) {
    let size = Math.round(Math.min(w, h) * 0.075);
    let lines: string[] = [];
    const maxH = h * 0.6;
    for (; size > 16; size -= 2) {
      ctx.font = `${size}px ${QURAN_FONT}`;
      lines = wrap(ctx, text, maxW);
      if (lines.length * size * 1.9 <= maxH) break;
    }
    const lh = size * 1.9;
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2;
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 12;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, y0 + i * lh));
    ctx.shadowBlur = 0;
  }
  if (caption) {
    ctx.font = `${Math.round(Math.min(w, h) * 0.032)}px ${UI_FONT}`;
    ctx.fillStyle = "rgba(220,190,120,0.95)";
    ctx.fillText(caption, w / 2, h - Math.min(w, h) * 0.09);
  }
}

export const canvasToBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
