// Browser-only: ffmpeg.wasm (single-thread core, no SharedArrayBuffer needed), lazy-loaded.
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { Clip, Timing } from "./alignment";
import type { Verse } from "./quran";
import { drawFrame, canvasToBlob, DEFAULT_STYLE, type Aspect, type Background, type TextStyle } from "./render";

let ff: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let inputKey = "";
let inputName = "";
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job); queue = next.catch(() => {}); return next;
}

export function getFFmpeg(): Promise<FFmpeg> {
  if (ff) return Promise.resolve(ff);
  if (loading) return loading;
  loading = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
    const f = new FFmpeg();
    await f.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ff = f;
    return f;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

async function ensureInput(f: FFmpeg, file: File) {
  const key = `${file.name}-${file.size}-${file.lastModified}`;
  if (key === inputKey) return inputName;
  if (inputName) await f.deleteFile(inputName).catch(() => {});
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  inputName = `input.${ext}`;
  await f.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
  inputKey = key;
  return inputName;
}

export async function extractAudio(file: File): Promise<Blob> {
  return exclusive(async () => {
  const f = await getFFmpeg();
  const inp = await ensureInput(f, file);
  let code = await f.exec(["-y", "-i", inp, "-vn", "-c:a", "copy", "audio.m4a"]);
  if (code !== 0) code = await f.exec(["-y", "-i", inp, "-vn", "-c:a", "aac", "-b:a", "128k", "audio.m4a"]);
  if (code !== 0) throw new Error("فشل استخراج الصوت");
  const data = (await f.readFile("audio.m4a")) as Uint8Array;
  await f.deleteFile("audio.m4a");
  return new Blob([data.slice()], { type: "audio/mp4" });
  });
}

export type ExportOpts = {
  file: File; clip: Clip; timings: Timing[]; verses: Verse[]; surahName: string;
  aspect: Aspect; bg: Background | null; backgroundUrl?: string; backgroundVideo?: boolean; style?: TextStyle; onProgress?: (p: number) => void;
};

export async function exportClip(o: ExportOpts): Promise<Blob> {
  return exclusive(async () => {
  if (!Number.isFinite(o.clip.start) || o.clip.start < 0 || o.clip.end <= o.clip.start) throw new Error('حدود المقطع غير صالحة');
  const f = await getFFmpeg();
  const inp = await ensureInput(f, o.file);
  const canvas = document.createElement("canvas");
  const style = o.style ?? DEFAULT_STYLE;
  const moving = !!o.backgroundUrl;
  const segs: { text: string; caption: string; number?: number; dur: number }[] = [];
  let t = o.clip.start;
  for (let i = 0; i < o.timings.length; i++) {
    const s = Math.max(o.timings[i].start, o.clip.start), e = Math.min(o.timings[i].end, o.clip.end);
    if (e <= s) continue;
    if (s > t + 0.05) segs.push({ text: "", caption: o.surahName, dur: s - t });
    const verse = o.verses[i];
    if (!verse) continue;
    segs.push({ text: verse.text, caption: o.surahName, number: verse.n, dur: e - s });
    t = e;
  }
  if (o.clip.end > t + 0.05) segs.push({ text: "", caption: o.surahName, dur: o.clip.end - t });
  const files: string[] = [];
  let list = '';
  const frame = async (seg: typeof segs[number], opacity: number, duration: number) => {
    const name = `f${files.length}.png`;
    drawFrame(canvas, o.aspect, moving ? null : o.bg, seg.text, seg.caption, style, seg.number, opacity, moving);
    await f.writeFile(name, new Uint8Array(await (await canvasToBlob(canvas)).arrayBuffer())); files.push(name);
    list += `file '${name}'\nduration ${duration.toFixed(6)}\n`;
  };
  const dur = o.clip.end - o.clip.start;
  const onP = ({ progress }: { progress: number }) => o.onProgress?.(Math.max(0, Math.min(1, progress)));
  f.on("progress", onP);
  try {
    for (const seg of segs) {
      const fade = style.effect === 'fade' && seg.text ? Math.min(.3, seg.dur / 3) : 0;
      for (let k = 0; k < (fade ? 4 : 0); k++) await frame(seg, (k + 1) / 4, fade / 4);
      await frame(seg, 1, seg.dur - 2 * fade);
      for (let k = 0; k < (fade ? 4 : 0); k++) await frame(seg, (3 - k) / 4, fade / 4);
    }
    if (!files.length) throw new Error('لا توجد آيات داخل المقطع');
    list += `file '${files.at(-1)}'\n`;
    await f.writeFile('list.txt', new TextEncoder().encode(list));
    const inputs = ['-y', '-filter_complex_threads', '1', '-f', 'concat', '-safe', '0', '-i', 'list.txt'];
    if (moving && o.backgroundUrl) {
      const response = await fetch(o.backgroundUrl); if (!response.ok) throw new Error('تعذر تحميل الخلفية للتصدير');
      const name = o.backgroundVideo ? 'background.mp4' : 'background.jpg'; files.push(name);
      await f.writeFile(name, new Uint8Array(await response.arrayBuffer()));
      inputs.push(...(o.backgroundVideo ? ['-stream_loop', '-1'] : ['-loop', '1']), '-i', name);
    }
    inputs.push('-ss', o.clip.start.toFixed(3), '-t', dur.toFixed(3), '-i', inp);
    const [w, h] = canvas.width ? [canvas.width, canvas.height] : [720, 1280];
    if (moving) inputs.push('-filter_complex', `[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=15[bg];[0:v]fps=15,format=rgba[txt];[bg][txt]overlay=shortest=1:format=auto[v]`, '-map', '[v]', '-map', '2:a:0');
    else inputs.push('-map', '0:v:0', '-map', '1:a:0');
    const code = await f.exec([...inputs, '-r', '15', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-t', dur.toFixed(3), '-movflags', '+faststart', 'out.mp4']);
    if (code !== 0) throw new Error('فشل ترميز الفيديو');
    const data = await f.readFile('out.mp4');
    if (!(data instanceof Uint8Array)) throw new Error('تعذر قراءة الفيديو');
    return new Blob([data.slice()], { type: 'video/mp4' });
  } finally {
    f.off('progress', onP);
    for (const name of [...files, 'list.txt', 'out.mp4']) await f.deleteFile(name).catch(() => {});
  }
  });
}

export async function shareOrDownload(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: name }); return "shared"; }
    catch (e) { if ((e as Error).name === "AbortError") return "cancelled"; }
  }
  download(blob, name);
  return "downloaded";
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
