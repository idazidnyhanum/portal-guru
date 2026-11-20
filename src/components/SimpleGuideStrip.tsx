import { Info } from 'lucide-react';

export interface GuideStep {
  title: string;
  desc: string;
}

interface SimpleGuideStripProps {
  heading?: string;
  steps: [GuideStep, GuideStep, GuideStep];
  tip?: string;
}

export function SimpleGuideStrip({
  heading = 'Panduan Cepat 3 Langkah',
  steps,
  tip,
}: SimpleGuideStripProps) {
  return (
    <div className="no-print bg-sky-50/70 border border-sky-200 rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wide text-sky-900">
          {heading}
        </div>
        <div className="text-[11px] font-medium text-sky-800">
          Hijau = Simpan · Biru/Hitam = Unduh Word/PDF · Kuning = Tanpa Kuota AI
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((st, idx) => (
          <div
            key={idx}
            className="bg-white border border-sky-200/80 rounded-xl p-3 flex items-start gap-3"
          >
            <div className="w-7 h-7 rounded-lg bg-sky-600 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
              {idx + 1}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 leading-snug">
                {st.title}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {st.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {tip && (
        <div className="flex items-start gap-2 pt-1 text-xs text-sky-900">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <span>{tip}</span>
        </div>
      )}
    </div>
  );
}
