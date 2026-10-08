import type { Silence } from "./audio";
import type { Verse } from "./quran";

export type Timing = { start: number; end: number };
export type Clip = { id: string; from: number; to: number; start: number; end: number }; // verse indices inclusive

/**
 * Alignment architecture (no speech recognition model is bundled):
 *  1. Manual: user taps at each verse start while listening (source of truth).
 *  2. Estimate: distribute [start,end] proportionally to verse letter count, then snap
 *     each boundary to the nearest detected silence within ±4s. This is a heuristic and
 *     MUST be reviewed by the user.
 *  A future ASR/forced-alignment model would plug in here by returning Timing[].
 */
export function estimateTimings(verses: Verse[], start: number, end: number, silences: Silence[]): Timing[] {
  const lens = verses.map((v) => v.text.replace(/[\s\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").length || 1);
  const total = lens.reduce((a, b) => a + b, 0);
  const bounds = [start];
  let acc = start;
  lens.forEach((l, i) => {
    acc += ((end - start) * l) / total;
    if (i < lens.length - 1) bounds.push(acc);
  });
  const mids = silences.map((s) => (s.start + s.end) / 2).filter((m) => m > start && m < end);
  for (let i = 1; i < bounds.length; i++) {
    let best = bounds[i], bd = 4;
    for (const m of mids) {
      const d = Math.abs(m - bounds[i]);
      if (d < bd && m > bounds[i - 1] + 0.5) { bd = d; best = m; }
    }
    bounds[i] = best;
  }
  return verses.map((_, i) => ({ start: bounds[i], end: i < verses.length - 1 ? bounds[i + 1] : end }));
}

const uid = () => Math.random().toString(36).slice(2, 9);

export function splitEvery(timings: Timing[], n: number): Clip[] {
  const clips: Clip[] = [];
  for (let i = 0; i < timings.length; i += n) {
    const to = Math.min(timings.length - 1, i + n - 1);
    clips.push({ id: uid(), from: i, to, start: timings[i].start, end: timings[to].end });
  }
  return clips;
}

/** Waqf-approximation: cut only at verse ends, prefer boundaries with longer silence, keep 15–60s. */
export function splitByPauses(timings: Timing[], silences: Silence[], minDur = 15, maxDur = 60): Clip[] {
  const gapAt = (t: number) =>
    silences.reduce((g, s) => (t >= s.start - 0.4 && t <= s.end + 0.4 ? Math.max(g, s.end - s.start) : g), 0);
  const clips: Clip[] = [];
  let from = 0;
  for (let i = 0; i < timings.length; i++) {
    const dur = timings[i].end - timings[from].start;
    const last = i === timings.length - 1;
    const nextDur = last ? 0 : timings[i + 1].end - timings[from].start;
    const gap = gapAt(timings[i].end);
    if (last || (dur >= minDur && (gap >= 0.8 || nextDur > maxDur)) || nextDur > maxDur) {
      clips.push({ id: uid(), from, to: i, start: timings[from].start, end: timings[i].end });
      from = i + 1;
    }
  }
  return clips;
}
