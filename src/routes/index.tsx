import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeFile, fmt, type Analysis } from "@/lib/audio";
import { fetchSurah, fetchSurahList, type SurahMeta, type Verse } from "@/lib/quran";
import { estimateTimings, splitByPauses, splitEvery, type Clip, type Timing } from "@/lib/alignment";
import { drawFrame, ensureFonts, loadImage, type Aspect } from "@/lib/render";
import { Waveform } from "@/components/Waveform";
import kaaba from "@/assets/bg-kaaba.jpg";
import nature from "@/assets/bg-nature.jpg";
import mosque from "@/assets/bg-mosque.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ayah Clips — مقاطع قصيرة من التلاوات" },
      { name: "description", content: "قسّم التلاوات الطويلة إلى مقاطع قصيرة بآيات متزامنة وصدّرها MP4." },
      { property: "og:title", content: "Ayah Clips — مقاطع قصيرة من التلاوات" },
      { property: "og:description", content: "قسّم التلاوات الطويلة إلى مقاطع قصيرة بآيات متزامنة وصدّرها MP4." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

const TEMPLATES = [
  { id: "kaaba", label: "الكعبة", src: kaaba },
  { id: "nature", label: "الطبيعة", src: nature },
  { id: "mosque", label: "المسجد", src: mosque },
];
const STEPS = ["الملف", "الآيات", "المقاطع", "التصدير"];

function App() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stopAt = useRef<number | null>(null);

  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [surah, setSurah] = useState(1);
  const [range, setRange] = useState<[number, number]>([1, 7]);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [timings, setTimings] = useState<Timing[]>([]);
  const [timingSource, setTimingSource] = useState<"" | "manual" | "estimate">("");
  const [tapIdx, setTapIdx] = useState(0);

  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [mode, setMode] = useState<"four" | "pause">("four");

  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [tpl, setTpl] = useState("kaaba");
  const [customBg, setCustomBg] = useState("");
  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [exports, setExports] = useState<Record<string, { blob?: Blob; p: number; err?: string }>>({});
  const previewRef = useRef<HTMLCanvasElement>(null);

  const isVideo = file?.type.startsWith("video") ?? false;
  const duration = analysis?.duration ?? 0;
  const surahMeta = surahs.find((s) => s.number === surah);
  const surahName = surahMeta?.name ?? "";

  useEffect(() => { fetchSurahList().then(setSurahs).catch(() => setErr("تعذر الاتصال بمصدر نص القرآن")); ensureFonts(); }, []);

  // media clock
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const m = mediaRef.current;
      if (m) {
        setTime(m.currentTime);
        if (stopAt.current != null && m.currentTime >= stopAt.current) { m.pause(); stopAt.current = null; }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bgSrc = tpl === "custom" ? customBg : TEMPLATES.find((t) => t.id === tpl)?.src ?? "";
  useEffect(() => { if (bgSrc) loadImage(bgSrc).then(setBgImg).catch(() => setBgImg(null)); else setBgImg(null); }, [bgSrc]);

  const curIdx = useMemo(() => timings.findIndex((t) => time >= t.start && time < t.end), [timings, time]);

  useEffect(() => {
    if (step !== 3 || !previewRef.current) return;
    const v = verses[curIdx];
    drawFrame(previewRef.current, aspect, bgImg, v?.text ?? "", v ? `${surahName} • ${v.n}` : surahName);
  }, [step, curIdx, aspect, bgImg, verses, surahName]);

  async function onFile(f: File) {
    setErr(""); setBusy("جارٍ تحليل الصوت…");
    try {
      if (url) URL.revokeObjectURL(url);
      setFile(f); setUrl(URL.createObjectURL(f));
      setAnalysis(await analyzeFile(f));
      setTimings([]); setClips([]); setExports({});
    } catch {
      setErr("تعذر قراءة المسار الصوتي من هذا الملف. جرّب MP4 أو MP3 أو M4A آخر.");
      setFile(null);
    } finally { setBusy(""); }
  }

  async function loadVerses() {
    setErr(""); setBusy("جارٍ تحميل النص القرآني…");
    try {
      const all = await fetchSurah(surah);
      const v = all.slice(range[0] - 1, range[1]);
      setVerses(v); setTimings([]); setTimingSource(""); setTapIdx(0); setClips([]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  function seek(t: number, play = false, until?: number) {
    const m = mediaRef.current; if (!m) return;
    m.currentTime = Math.max(0, Math.min(duration, t));
    stopAt.current = until ?? null;
    if (play) m.play();
  }

  function tap() {
    const t = mediaRef.current?.currentTime ?? 0;
    setTimings((prev) => {
      const next = verses.map((_, i) => prev[i] ?? { start: duration, end: duration });
      next[tapIdx] = { start: t, end: next[tapIdx + 1]?.start ?? duration };
      if (tapIdx > 0) next[tapIdx - 1] = { ...next[tapIdx - 1], end: t };
      for (let i = tapIdx + 1; i < next.length; i++) next[i] = { start: duration, end: duration };
      next[tapIdx].end = duration;
      return next;
    });
    setTimingSource("manual");
    setTapIdx((i) => Math.min(verses.length, i + 1));
  }
  function tapEnd() {
    const t = mediaRef.current?.currentTime ?? 0;
    setTimings((p) => p.map((x, i) => (i === tapIdx - 1 ? { ...x, end: t } : x)));
  }

  function estimate() {
    if (!analysis) return;
    const s = analysis.silences;
    const start = s[0] && s[0].start < 0.2 ? s[0].end : 0;
    const last = s[s.length - 1];
    const end = last && last.end > duration - 0.3 ? last.start : duration;
    setTimings(estimateTimings(verses, start, end, s));
    setTimingSource("estimate");
  }

  function setTiming(i: number, field: "start" | "end", v: number) {
    setTimings((p) => p.map((x, j) => {
      if (j === i) return field === "start" ? { ...x, start: v } : { ...x, end: v };
      if (field === "start" && j === i - 1) return { ...x, end: v };
      if (field === "end" && j === i + 1) return { ...x, start: v };
      return x;
    }));
  }

  const timingsReady = timings.length === verses.length && verses.length > 0 && timings.every((t) => t.end > t.start);

  function makeClips(m = mode) {
    setClips(m === "four" ? splitEvery(timings, 4) : splitByPauses(timings, analysis?.silences ?? []));
    setExports({});
  }

  function updateClip(id: string, patch: Partial<Clip>) {
    setClips((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setExports((e) => { const n = { ...e }; delete n[id]; return n; });
  }

  async function doExport(c: Clip) {
    if (!file) return;
    setExports((e) => ({ ...e, [c.id]: { p: 0 } }));
    try {
      await ensureFonts();
      const { exportClip } = await import("@/lib/exporter");
      const blob = await exportClip({
        file, clip: c, timings, verses, surahName, aspect, bg: bgImg,
        onProgress: (p) => setExports((e) => ({ ...e, [c.id]: { p } })),
      });
      setExports((e) => ({ ...e, [c.id]: { p: 1, blob } }));
      return blob;
    } catch (er) {
      setExports((e) => ({ ...e, [c.id]: { p: 0, err: (er as Error).message || "فشل التصدير" } }));
      return undefined;
    }
  }

  const clipName = (c: Clip) => `ayah-clip_${surah}_${verses[c.from]?.n}-${verses[c.to]?.n}_${aspect.replace(":", "x")}.mp4`;

  async function exportZip() {
    setBusy("جارٍ تصدير كل المقاطع…");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const c of clips) {
        const b = exports[c.id]?.blob ?? (await doExport(c));
        if (b) zip.file(clipName(c), b);
      }
      const out = await zip.generateAsync({ type: "blob" });
      (await import("@/lib/exporter")).download(out, `ayah-clips_${surah}.zip`);
    } finally { setBusy(""); }
  }

  async function extract() {
    if (!file) return;
    setBusy("جارٍ استخراج المسار الصوتي (تحميل FFmpeg أول مرة قد يستغرق دقيقة)…");
    try {
      const ex = await import("@/lib/exporter");
      ex.download(await ex.extractAudio(file), file.name.replace(/\.[^.]+$/, "") + "_audio.m4a");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  const canGo = [true, !!analysis, timingsReady, clips.length > 0];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col pb-24">
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Ayah Clips</h1>
          <p className="text-xs text-muted-foreground">مقاطع قصيرة من التلاوات الطويلة</p>
        </div>
        {busy && <span className="max-w-[55%] animate-pulse text-xs text-primary">{busy}</span>}
      </header>

      {/* Sticky player */}
      <div className={`sticky top-0 z-10 bg-background/90 px-4 pb-3 pt-1 backdrop-blur ${file ? "" : "hidden"}`}>
        <video
          ref={mediaRef}
          src={url || undefined}
          playsInline
          controls
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className={isVideo ? "mb-2 max-h-48 w-full rounded-lg bg-card" : "mb-2 h-12 w-full"}
        />
        {analysis && (
          <Waveform peaks={analysis.peaks} duration={duration} time={time} timings={timings} clips={clips} activeClip={activeClip} onSeek={(t) => seek(t)} />
        )}
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground" dir="ltr">
          <span>{fmt(time)}</span><span>{fmt(duration)}</span>
        </div>
        {curIdx >= 0 && verses[curIdx] && (
          <p className="quran mt-1 line-clamp-2 text-center text-lg">{verses[curIdx].text} <span className="text-primary">﴿{verses[curIdx].n}﴾</span></p>
        )}
      </div>

      {err && <p className="mx-4 mb-3 rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{err}</p>}

      <main className="flex-1 space-y-4 px-4">
        {step === 0 && (
          <section className="space-y-4">
            <label className="panel flex cursor-pointer flex-col items-center gap-2 border-dashed py-10 text-center">
              <span className="text-3xl">🎙️</span>
              <span className="font-semibold">{file ? file.name : "ارفع تلاوة"}</span>
              <span className="text-xs text-muted-foreground">فيديو MP4 أو صوت MP3 / M4A — المعالجة تتم على جهازك</span>
              <input type="file" accept="video/mp4,audio/mpeg,audio/mp4,audio/x-m4a,.m4a,.mp3,.mp4" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            {analysis && (
              <div className="panel space-y-2 text-sm">
                <p>المدة: <b dir="ltr">{fmt(duration)}</b> — النوع: {isVideo ? "فيديو" : "صوت"}</p>
                <p className="text-muted-foreground">رُصدت {analysis.silences.length} وقفة صوتية (تُستخدم لاقتراح الحدود).</p>
                <button className="btn-ghost btn-sm" onClick={extract} disabled={!!busy}>استخراج المسار الصوتي وتنزيله (M4A)</button>
              </div>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <div className="panel space-y-3">
              <h2 className="font-semibold">السورة والآيات</h2>
              <select className="field" value={surah} onChange={(e) => { const n = +e.target.value; setSurah(n); const m = surahs.find((s) => s.number === n); setRange([1, Math.min(m?.numberOfAyahs ?? 1, 10)]); }}>
                {surahs.map((s) => <option key={s.number} value={s.number}>{s.number}. {s.name} ({s.numberOfAyahs})</option>)}
              </select>
              <div className="flex items-center gap-2 text-sm">
                <span>من</span>
                <input type="number" className="field" min={1} max={surahMeta?.numberOfAyahs} value={range[0]} onChange={(e) => setRange([+e.target.value, Math.max(+e.target.value, range[1])])} />
                <span>إلى</span>
                <input type="number" className="field" min={range[0]} max={surahMeta?.numberOfAyahs} value={range[1]} onChange={(e) => setRange([range[0], Math.min(+e.target.value, surahMeta?.numberOfAyahs ?? 999)])} />
              </div>
              <button className="btn-primary w-full" onClick={loadVerses} disabled={!!busy}>تحميل نص الآيات</button>
              <p className="text-[11px] text-muted-foreground">النص بالرسم العثماني من مصدر Tanzil عبر alquran.cloud — لا يُولَّد أي نص آليًا.</p>
            </div>

            {verses.length > 0 && (
              <div className="panel space-y-3">
                <h2 className="font-semibold">ضبط التوقيت</h2>
                <p className="note">لا يوجد نموذج تعرّف على التلاوة في هذا الإصدار. المسار الموثوق هو الضبط اليدوي: شغّل التلاوة واضغط «بدأت الآية» عند بداية كل آية. «التقدير التقريبي» يوزّع الآيات حسب طول النص ويلتقط أقرب وقفة صوتية — ويحتاج تدقيقًا دائمًا.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-primary col-span-2 py-4 text-base" onClick={tap} disabled={tapIdx >= verses.length}>
                    {tapIdx < verses.length ? `بدأت الآية ${verses[tapIdx].n}` : "اكتمل الضبط"}
                  </button>
                  <button className="btn-ghost" onClick={() => (playing ? mediaRef.current?.pause() : mediaRef.current?.play())}>{playing ? "إيقاف مؤقت" : "تشغيل"}</button>
                  <button className="btn-ghost" onClick={tapEnd} disabled={tapIdx === 0}>انتهت الآية الأخيرة</button>
                  <button className="btn-ghost" onClick={() => { setTapIdx(0); setTimings([]); seek(0); }}>إعادة الضبط</button>
                  <button className="btn-ghost" onClick={estimate}>تقدير تقريبي</button>
                </div>
                {timingSource === "estimate" && <p className="note">التوقيت الحالي تقديري وغير مُتحقق منه — استمع لكل آية وصحّح الحدود.</p>}
                <ul className="space-y-2">
                  {verses.map((v, i) => (
                    <li key={v.n} className={`rounded-lg border p-3 ${i === curIdx ? "border-primary bg-primary/5" : ""}`}>
                      <p className="quran text-lg">{v.text} <span className="text-primary">﴿{v.n}﴾</span></p>
                      {timings[i] && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" dir="ltr">
                          <input type="number" step={0.1} className="field w-20 py-1" value={+timings[i].start.toFixed(2)} onChange={(e) => setTiming(i, "start", +e.target.value)} />
                          <span>→</span>
                          <input type="number" step={0.1} className="field w-20 py-1" value={+timings[i].end.toFixed(2)} onChange={(e) => setTiming(i, "end", +e.target.value)} />
                          <button className="btn-ghost btn-sm" onClick={() => setTiming(i, "start", time)}>start=now</button>
                          <button className="btn-ghost btn-sm" onClick={() => seek(timings[i].start, true, timings[i].end)}>▶</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="panel space-y-3">
              <h2 className="font-semibold">طريقة التقسيم</h2>
              <div className="flex gap-2">
                <button className={mode === "four" ? "chip-on" : "chip-off"} onClick={() => { setMode("four"); makeClips("four"); }}>كل 4 آيات</button>
                <button className={mode === "pause" ? "chip-on" : "chip-off"} onClick={() => { setMode("pause"); makeClips("pause"); }}>وفق الوقفات</button>
              </div>
              <p className="text-[11px] text-muted-foreground">«وفق الوقفات» يقطع عند نهايات الآيات المصحوبة بوقفة صوتية طويلة بطول 15–60 ثانية؛ هو تقريب للوقف وليس تحليلًا للمعنى، فراجع الحدود.</p>
              {clips.length === 0 && <button className="btn-primary w-full" onClick={() => makeClips()}>إنشاء المقاطع</button>}
            </div>
            {clips.map((c, k) => (
              <div key={c.id} className={`panel space-y-2 ${activeClip === c.id ? "border-primary" : ""}`}>
                <div className="flex items-center justify-between">
                  <b>مقطع {k + 1}: الآيات {verses[c.from]?.n}–{verses[c.to]?.n}</b>
                  <span className="text-xs text-muted-foreground" dir="ltr">{(c.end - c.start).toFixed(1)}s</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs" dir="ltr">
                  <button className="btn-ghost btn-sm" onClick={() => updateClip(c.id, { start: Math.max(0, c.start - 0.5) })}>−0.5</button>
                  <input type="number" step={0.1} className="field w-20 py-1" value={+c.start.toFixed(2)} onChange={(e) => updateClip(c.id, { start: +e.target.value })} />
                  <button className="btn-ghost btn-sm" onClick={() => updateClip(c.id, { start: c.start + 0.5 })}>+0.5</button>
                  <span className="px-1">→</span>
                  <button className="btn-ghost btn-sm" onClick={() => updateClip(c.id, { end: c.end - 0.5 })}>−0.5</button>
                  <input type="number" step={0.1} className="field w-20 py-1" value={+c.end.toFixed(2)} onChange={(e) => updateClip(c.id, { end: +e.target.value })} />
                  <button className="btn-ghost btn-sm" onClick={() => updateClip(c.id, { end: Math.min(duration, c.end + 0.5) })}>+0.5</button>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => { setActiveClip(c.id); seek(c.start, true, c.end); }}>▶ معاينة</button>
                  <button className="btn-ghost btn-sm" onClick={() => updateClip(c.id, { start: time })}>البداية = الآن</button>
                  <button className="btn-ghost btn-sm" onClick={() => updateClip(c.id, { end: time })}>النهاية = الآن</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="panel space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["9:16", "1:1", "16:9"] as Aspect[]).map((a) => (
                  <button key={a} className={aspect === a ? "chip-on" : "chip-off"} onClick={() => { setAspect(a); setExports({}); }} dir="ltr">{a}</button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.id} onClick={() => { setTpl(t.id); setExports({}); }} className={`overflow-hidden rounded-lg border-2 ${tpl === t.id ? "border-primary" : "border-transparent"}`}>
                    <img src={t.src} alt={t.label} loading="lazy" width={768} height={1344} className="aspect-[3/4] w-full object-cover" />
                    <span className="block py-1 text-xs">{t.label}</span>
                  </button>
                ))}
                <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-xs ${tpl === "custom" ? "border-primary" : ""}`}>
                  {customBg ? <img src={customBg} alt="خلفية خاصة" className="aspect-[3/4] w-full object-cover" /> : <span className="p-2 text-center">خلفية خاصة +</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCustomBg(URL.createObjectURL(f)); setTpl("custom"); setExports({}); } }} />
                </label>
              </div>
            </div>
            <div className="panel flex flex-col items-center gap-2">
              <canvas ref={previewRef} className={`rounded-lg ${aspect === "16:9" ? "w-full" : aspect === "1:1" ? "w-3/4" : "w-1/2"}`} />
              <p className="text-[11px] text-muted-foreground">معاينة حيّة متزامنة مع موضع التشغيل — هي نفس الإطارات التي تُرمَّز في MP4.</p>
            </div>
            <button className="btn-primary w-full" onClick={exportZip} disabled={!!busy || clips.length === 0}>تصدير الكل كملف ZIP</button>
            <p className="text-[11px] text-muted-foreground">التصدير يتم بـ FFmpeg داخل المتصفح (يُحمَّل ~30MB أول مرة). قد يكون بطيئًا على الهواتف الضعيفة.</p>
            {clips.map((c, k) => {
              const ex = exports[c.id];
              return (
                <div key={c.id} className="panel space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm">مقطع {k + 1} — الآيات {verses[c.from]?.n}–{verses[c.to]?.n}</b>
                    <button className="btn-ghost btn-sm" onClick={() => { setActiveClip(c.id); seek(c.start, true, c.end); }}>▶</button>
                  </div>
                  {ex && !ex.blob && !ex.err && (
                    <div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round(ex.p * 100)}%` }} /></div>
                  )}
                  {ex?.err && <p className="text-xs text-destructive">{ex.err}</p>}
                  {ex?.blob && <video src={URL.createObjectURL(ex.blob)} controls playsInline className="max-h-80 w-full rounded-lg bg-muted" />}
                  <div className="flex gap-2">
                    {!ex?.blob ? (
                      <button className="btn-primary btn-sm" disabled={!!ex && !ex.err} onClick={() => doExport(c)}>تصدير MP4</button>
                    ) : (
                      <>
                        <button className="btn-primary btn-sm" onClick={async () => (await import("@/lib/exporter")).shareOrDownload(ex.blob!, clipName(c))}>مشاركة</button>
                        <button className="btn-ghost btn-sm" onClick={async () => (await import("@/lib/exporter")).download(ex.blob!, clipName(c))}>تنزيل MP4</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {STEPS.map((s, i) => (
            <button key={s} disabled={!canGo.slice(0, i + 1).every(Boolean)} onClick={() => setStep(i)}
              className={`py-3 text-sm disabled:opacity-30 ${step === i ? "font-bold text-primary" : "text-muted-foreground"}`}>
              <span className="block text-[10px]">{i + 1}</span>{s}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
