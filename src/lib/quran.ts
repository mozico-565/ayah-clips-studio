// Quran text comes from api.alquran.cloud (Tanzil "quran-uthmani" edition) — never generated.
export type SurahMeta = { number: number; name: string; englishName: string; numberOfAyahs: number };
export type Verse = { surah: number; n: number; text: string };

const API = "https://api.alquran.cloud/v1";
const cache = new Map<number, Verse[]>();
let surahList: SurahMeta[] | null = null;

export async function fetchSurahList(): Promise<SurahMeta[]> {
  if (surahList) return surahList;
  const r = await fetch(`${API}/surah`);
  if (!r.ok) throw new Error("تعذر تحميل قائمة السور");
  const j = await r.json();
  surahList = j.data as SurahMeta[];
  return surahList;
}

const strip = (s: string) =>
  s.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/[ٱأإآ]/g, "ا");

export async function fetchSurah(n: number): Promise<Verse[]> {
  const c = cache.get(n);
  if (c) return c;
  const r = await fetch(`${API}/surah/${n}/quran-uthmani`);
  if (!r.ok) throw new Error("تعذر تحميل نص السورة");
  const j = await r.json();
  const verses: Verse[] = j.data.ayahs.map((a: { numberInSurah: number; text: string }) => {
    let text = a.text.trim();
    // The edition prefixes ayah 1 with the Basmala (except Al-Fatiha / At-Tawbah); remove it.
    if (a.numberInSurah === 1 && n !== 1 && n !== 9) {
      const words = text.split(/\s+/);
      if (strip(words.slice(0, 4).join(" ")) === "بسم الله الرحمن الرحيم") text = words.slice(4).join(" ");
    }
    return { surah: n, n: a.numberInSurah, text };
  });
  cache.set(n, verses);
  return verses;
}
