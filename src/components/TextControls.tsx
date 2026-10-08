import type { TextStyle } from '@/lib/render';
export function TextControls({ value, onChange }: { value: TextStyle; onChange: (value: TextStyle) => void }) {
  const set = (patch: Partial<TextStyle>) => onChange({ ...value, ...patch });
  return <fieldset className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
    <legend className="px-2 font-semibold">نص الآية</legend>
    <label>الخط<select aria-label="الخط القرآني" className="field mt-1" value={value.font} onChange={e => set({ font: e.target.value as TextStyle['font'] })}><option value="uthmani">عثماني — Amiri Quran</option><option value="amiri">Amiri — نسخ مشكول</option></select></label>
    <label>اللون<input aria-label="لون الآية" type="color" className="field mt-1 h-10" value={value.color} onChange={e => set({ color: e.target.value })} /></label>
    {([{ key: 'size', label: 'حجم الخط', min: 24, max: 80, step: 1 }, { key: 'shadow', label: 'الظل', min: 0, max: 30, step: 1 }, { key: 'position', label: 'مكان النص', min: 15, max: 80, step: 1 }, { key: 'lineHeight', label: 'تباعد السطور', min: 1.5, max: 2.5, step: .1 }, { key: 'darkness', label: 'تعتيم الخلفية', min: 0, max: .8, step: .05 }] as const).map(c => <label key={c.key}>{c.label} · {value[c.key]}<input aria-label={c.label} className="mt-2 w-full accent-primary" type="range" min={c.min} max={c.max} step={c.step} value={value[c.key]} onChange={e => set({ [c.key]: +e.target.value })} /></label>)}
    <label>رقم الآية<select aria-label="زخرفة رقم الآية" className="field mt-1" value={value.ornament} onChange={e => set({ ornament: e.target.value as TextStyle['ornament'] })}><option value="circle">دائرة مزدوجة</option><option value="brackets">أقواس قرآنية</option><option value="none">بدون</option></select></label>
    <label>ظهور الآية<select aria-label="تأثير ظهور الآية" className="field mt-1" value={value.effect} onChange={e => set({ effect: e.target.value as TextStyle['effect'] })}><option value="fade">تلاشي هادئ</option><option value="none">مباشر</option></select></label>
  </fieldset>;
}