import { matchRecognizedWords, type RecognizedWord, type VerseMatch } from './recognition-match';
import type { Verse } from './quran';

export async function recognizeRecitation(file: File, verses: Verse[], onProgress: (message: string) => void, signal: AbortSignal): Promise<{ matches: VerseMatch[]; transcript: string }> {
  onProgress('فك المسار الصوتي وتحويله إلى 16kHz…');
  const decoder = new OfflineAudioContext(1, 1, 16000);
  let buffer: AudioBuffer;
  try { buffer = await decoder.decodeAudioData(await file.arrayBuffer()); }
  catch { const { extractAudio } = await import('./exporter'); buffer = await decoder.decodeAudioData(await (await extractAudio(file)).arrayBuffer()); }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const resampler = new OfflineAudioContext(1, Math.ceil(buffer.duration * 16000), 16000);
  const source = resampler.createBufferSource(); source.buffer = buffer; source.connect(resampler.destination); source.start();
  const audio = (await resampler.startRendering()).getChannelData(0).slice();
  const worker = new Worker(new URL('./recognition.worker.ts', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const stop = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { stop(); reject(new DOMException('Cancelled', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = (e) => { stop(); reject(new Error(e.message || 'تعذر تشغيل النموذج المحلي')); };
    worker.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'progress') onProgress(data.message);
      if (data.type === 'error') { stop(); reject(new Error(data.message)); }
      if (data.type === 'result') {
        stop();
        try { const result = data.result as { text: string; chunks?: RecognizedWord[] }; resolve({ matches: matchRecognizedWords(verses, result.chunks ?? [], buffer.duration), transcript: result.text }); }
        catch (e) { reject(e); }
      }
    };
    worker.postMessage({ audio }, [audio.buffer]);
    if (signal.aborted) abort();
  });
}