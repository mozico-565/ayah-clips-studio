// Browser-only: ffmpeg.wasm (single-thread core, no SharedArrayBuffer needed), lazy-loaded.
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { Clip, Timing } from "./alignment";
import type { Verse } from "./quran";
import { drawFrame, canvasToBlob, type Aspect } from "./render";

let ff: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let inputKey = "";
let inputName = "";

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
  const f = await getFFmpeg();
  const inp = await ensureInput(f, file);
  let code = await f.exec(["-y", "-i", inp, "-vn", "-c:a", "copy", "audio.m4a"]);
  if (code !== 0) code = await f.exec(["-y", "-i", inp, "-vn", "-c:a", "aac", "-b:a", "128k", "audio.m4a"]);
  if (code !== 0) throw new Error("فشل استخراج الصوت");
  const data = (await f.readFile("audio.m4a")) as Uint8Array;
  await f.deleteFile("audio.m4a");
  return new Blob([data.slice()], { type: "audio/mp4" });
}

export type ExportOpts = {
  file: File; clip: Clip; timings: Timing[]; verses: Verse[]; surahName: string;
  aspect: Aspect; bg: HTMLImageElement | null; onProgress?: (p: number) => void;
};

export async function exportClip(o: ExportOpts): Promise<Blob> {
  const f = await getFFmpeg();
  const inp = await ensureInput(f, o.file);
  const canvas = document.createElement("canvas");
  // Build still-frame segments covering [clip.start, clip.end]
  const segs: { text: string; caption: string; dur: number }[] = [];
  let t = o.clip.start;
  for (let i = 0; i < o.timings.length; i++) {
    const s = Math.max(o.timings[i].start, o.clip.start), e = Math.min(o.timings[i].end, o.clip.end);
    if (e <= s) continue;
    if (s > t + 0.05) segs.push({ text: "", caption: o.surahName, dur: s - t });
    segs.push({ text: o.verses[i].text, caption: `${o.surahName} • ${o.verses[i].n}`, dur: e - s });
    t = e;
  }
  if (o.clip.end > t + 0.05) segs.push({ text: "", caption: o.surahName, dur: o.clip.end - t });
  let list = "";
  for (let i = 0; i < segs.length; i++) {
    drawFrame(canvas, o.aspect, o.bg, segs[i].text, segs[i].caption);
    await f.writeFile(`f${i}.png`, new Uint8Array(await (await canvasToBlob(canvas)).arrayBuffer()));
    list += `file 'f${i}.png'\nduration ${segs[i].dur.toFixed(3)}\n`;
  }
  list += `file 'f${segs.length - 1}.png'\n`;
  await f.writeFile("list.txt", new TextEncoder().encode(list));
  const dur = o.clip.end - o.clip.start;
  const onP = ({ progress }: { progress: number }) => o.onProgress?.(Math.max(0, Math.min(1, progress)));
  f.on("progress", onP);
  const code = await f.exec([
    "-y", "-f", "concat", "-safe", "0", "-i", "list.txt",
    "-ss", o.clip.start.toFixed(3), "-t", dur.toFixed(3), "-i", inp,
    "-map", "0:v", "-map", "1:a", "-r", "15", "-c:v", "libx264", "-preset", "ultrafast",
    "-tune", "stillimage", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
    "-t", dur.toFixed(3), "-movflags", "+faststart", "out.mp4",
  ]);
  f.off("progress", onP);
  for (let i = 0; i < segs.length; i++) await f.deleteFile(`f${i}.png`).catch(() => {});
  if (code !== 0) throw new Error("فشل ترميز الفيديو");
  const data = (await f.readFile("out.mp4")) as Uint8Array;
  await f.deleteFile("out.mp4");
  return new Blob([data.slice()], { type: "video/mp4" });
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
