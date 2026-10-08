import { env, pipeline } from '@huggingface/transformers';
env.allowLocalModels = false;
// Single thread works on ordinary mobile hosting without cross-origin isolation.
env.backends.onnx.wasm.numThreads = 1;
let transcriber: Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>> | null = null;
self.onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  try {
    if (!transcriber) transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
      device: 'wasm', dtype: 'q8',
      progress_callback: (p) => self.postMessage({ type: 'progress', message: p.status === 'progress' ? `تحميل النموذج: ${Math.round(p.progress ?? 0)}٪` : 'تهيئة نموذج Whisper المحلي…' }),
    });
    self.postMessage({ type: 'progress', message: 'التعرف على الصوت وتوقيت الكلمات على جهازك…' });
    const result = await transcriber(event.data.audio, { language: 'arabic', task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ type: 'result', result });
  } catch (e) { self.postMessage({ type: 'error', message: e instanceof Error ? e.message : String(e) }); }
};