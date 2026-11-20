import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface FloatingToastProps {
  successMsg?: string | null;
  errorMsg?: string | null;
  onDismissSuccess?: () => void;
  onDismissError?: () => void;
}

export function FloatingToast({
  successMsg,
  errorMsg,
  onDismissSuccess,
  onDismissError,
}: FloatingToastProps) {
  if (!successMsg && !errorMsg) return null;

  return (
    <div
      className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {errorMsg && (
        <div className="pointer-events-auto bg-white border border-rose-300 shadow-lg rounded-2xl px-4 py-3 flex items-start gap-3 text-rose-900">
          <div className="w-7 h-7 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xs sm:text-sm font-medium leading-snug flex-1 pt-0.5">
            {errorMsg}
          </div>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              aria-label="Tutup pesan kesalahan"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {successMsg && (
        <div className="pointer-events-auto bg-white border border-emerald-300 shadow-lg rounded-2xl px-4 py-3 flex items-start gap-3 text-slate-900">
          <div className="w-7 h-7 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs sm:text-sm font-medium leading-snug flex-1 pt-0.5 text-emerald-950">
            {successMsg}
          </div>
          {onDismissSuccess && (
            <button
              type="button"
              onClick={onDismissSuccess}
              aria-label="Tutup pemberitahuan"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
