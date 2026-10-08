export type Silence = { start: number; end: number };
export type Analysis = { duration: number; peaks: Float32Array; silences: Silence[] };

/** Decode the file's audio track (works for MP4 video too) at a low sample rate to save memory. */
export async function analyzeFile(file: File): Promise<Analysis> {
  let buf = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 8000);
  let audio: AudioBuffer;
  try { audio = await ctx.decodeAudioData(buf); }
  catch { const { extractAudio } = await import('./exporter'); buf = await (await extractAudio(file)).arrayBuffer(); audio = await ctx.decodeAudioData(buf); }
  const ch = audio.getChannelData(0);
  const sr = audio.sampleRate;
  const bins = 2000;
  const per = Math.max(1, Math.floor(ch.length / bins));
  const peaks = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    let m = 0;
    for (let j = i * per; j < Math.min(ch.length, (i + 1) * per); j++) m = Math.max(m, Math.abs(ch[j]));
    peaks[i] = m;
  }
  // RMS per 50ms frame -> adaptive threshold -> silent regions >= 0.3s
  const fl = Math.floor(sr * 0.05);
  const rms: number[] = [];
  for (let i = 0; i + fl <= ch.length; i += fl) {
    let s = 0;
    for (let j = i; j < i + fl; j++) s += ch[j] * ch[j];
    rms.push(Math.sqrt(s / fl));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const thr = p10 + (p50 - p10) * 0.3;
  const silences: Silence[] = [];
  let st = -1;
  rms.forEach((v, i) => {
    if (v <= thr && st < 0) st = i;
    if ((v > thr || i === rms.length - 1) && st >= 0) {
      if ((i - st) * 0.05 >= 0.3) silences.push({ start: st * 0.05, end: i * 0.05 });
      st = -1;
    }
  });
  return { duration: audio.duration, peaks, silences };
}

export const fmt = (t: number) => {
  if (!isFinite(t)) return "0:00.0";
  const m = Math.floor(t / 60);
  const s = (t - m * 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
};
