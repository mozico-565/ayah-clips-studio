import type { Verse } from './quran';
import type { Timing } from './alignment';

export type RecognizedWord = { text: string; timestamp: [number, number | null] };
export type VerseMatch = { timing: Timing | null; confidence: number; coverage: number; heard: string; reason: string };
export function normalizeArabic(s: string) {
  return s.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, '').trim();
}
function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}
/** Ordered edit alignment against actual ASR word timestamps, never text-duration interpolation. */
export function matchRecognizedWords(verses: Verse[], chunks: RecognizedWord[], duration: number): VerseMatch[] {
  const expected = verses.flatMap((v, verse) => normalizeArabic(v.text).split(/\s+/).filter(Boolean).map((text, position) => ({ text, verse, position })));
  const heard = chunks.flatMap(c => normalizeArabic(c.text).split(/\s+/).filter(Boolean).map(text => ({ text, timestamp: c.timestamp })));
  if (expected.length * heard.length > 12_000_000) throw new Error('قسّم التسجيل إلى نطاق آيات أصغر قبل المحاذاة.');
  const width = heard.length + 1;
  const moves = new Uint8Array((expected.length + 1) * width);
  let prev = Float32Array.from({ length: width }, (_, j) => j);
  for (let i = 1; i <= expected.length; i++) {
    const row = new Float32Array(width); row[0] = i;
    for (let j = 1; j < width; j++) {
      const score = similarity(expected[i - 1].text, heard[j - 1].text);
      const diagonal = prev[j - 1] + (score >= .65 ? 1 - score : 1.7);
      const drop = prev[j] + 1, extra = row[j - 1] + 1;
      const best = Math.min(diagonal, drop, extra);
      row[j] = best; moves[i * width + j] = best === diagonal ? 1 : best === drop ? 2 : 3;
    }
    prev = row;
  }
  const pairs: { e: number; h: number; score: number }[] = [];
  let i = expected.length, j = heard.length;
  while (i > 0 && j > 0) {
    const move = moves[i * width + j];
    if (move === 1) { const score = similarity(expected[i - 1].text, heard[j - 1].text); if (score >= .65) pairs.push({ e: i - 1, h: j - 1, score }); i--; j--; }
    else if (move === 2) i--; else j--;
  }
  pairs.reverse();
  const results = verses.map((_, verse): VerseMatch => {
    const words = expected.filter(e => e.verse === verse);
    const hits = pairs.filter(p => expected[p.e].verse === verse);
    const coverage = hits.length / Math.max(1, words.length);
    const confidence = hits.reduce((s, p) => s + p.score, 0) / Math.max(1, words.length);
    const first = hits[0], last = hits.at(-1);
    const beginningFound = first && expected[first.e].position === 0;
    const start = first ? heard[first.h].timestamp[0] : NaN;
    const end = last ? heard[last.h].timestamp[1] : null;
    const valid = beginningFound && coverage >= .55 && confidence >= .5 && Number.isFinite(start) && end != null && end > start && start >= 0 && end <= duration + .5;
    return { timing: valid ? { start, end: Math.min(end ?? duration, duration) } : null, confidence, coverage, heard: hits.map(p => heard[p.h].text).join(' '), reason: valid ? 'مطابقة صوتية — راجع البداية والنهاية' : !beginningFound ? 'لم تُرصد كلمة بداية الآية بثقة؛ اضبطها يدويًا' : 'مطابقة غير كافية؛ يلزم الضبط اليدوي' };
  });
  return results;
}