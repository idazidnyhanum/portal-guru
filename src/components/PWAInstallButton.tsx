import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isInIframe, offlineReady, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handlePrimaryClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  // Already running in installed standalone PWA mode: suppress install CTA, show clean offline status only if offline
  if (isInstalled) {
    if (!isOnline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold whitespace-nowrap shrink-0">
          <WifiOff className="w-3.5 h-3.5" />
          Mode Offline
        </span>
      );
    }
    return null;
  }

  const fallbackLabel = compact
    ? isInIframe
      ? 'Cara Instal'
      : 'Siap Offline'
    : isIOS
      ? 'Pasang di iOS'
      : isInIframe
        ? 'Instal / Mode Offline'
        : 'Siap Offline & Instal';

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <>
      <button
        type="button"
        onClick={handlePrimaryClick}
        className={`touch-target inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 border ${
          isInstallable
            ? 'px-3.5 py-2 bg-sky-600 border-sky-600 hover:bg-sky-700 text-white'
            : 'px-3 py-2 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800'
        }`}
        title={
          isInstallable
            ? 'Pasang aplikasi ke Laptop/HP agar dapat dibuka & dijalankan tanpa internet'
            : isInIframe
              ? 'Instalasi aplikasi memerlukan tampilan tab browser penuh (bukan Preview)'
              : 'Info penggunaan offline tanpa internet & cara pasang aplikasi'
        }
      >
        {isInstallable ? (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>{compact ? 'Pasang App' : 'Pasang Aplikasi (Offline)'}</span>
          </>
        ) : (
          <>
            <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
            <span>{fallbackLabel}</span>
          </>
        )}
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-emerald-700">
                  Mode Aplikasi Offline (PWA)
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {isIOS
                    ? 'Pasang di iPhone / iPad (Safari)'
                    : 'Pasang & Jalankan Tanpa Internet'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Tutup panduan offline"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-950 space-y-2">
                <div className="font-semibold flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Aplikasi tidak bisa diinstal langsung dari bingkai Preview</span>
                </div>
                <p className="text-amber-900 leading-relaxed">
                  Browser (Chrome, Edge, dan Safari) melarang instalasi aplikasi dari dalam jendela
                  Preview. Buka aplikasi di tab browser penuh terlebih dahulu agar tombol{' '}
                  <strong>Pasang App</strong> atau ikon instalasi di bilah alamat URL muncul.
                </p>
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Aplikasi di Tab Baru</span>
                </a>
              </div>
            )}

            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {offlineReady
                    ? 'Aset aplikasi sudah tersimpan di cache browser untuk akses offline.'
                    : 'Aplikasi menyimpan perangkat ajar, bank soal, dan file kerja langsung di perangkat ini.'}
                </span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Saat tanpa internet: Bank CP BSKAP, susun TP-ATP (4–5 elemen), PROTA, PROSEM, RPM,
                Agenda, Asesmen lokal, Game Edukasi PID (600 soal), serta unduh PDF &amp; Word tetap
                berjalan normal.
              </p>
            </div>

            {isIOS ? (
              <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-900">Cara pasang ke Layar Utama (iOS):</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Buka alamat aplikasi langsung di browser <strong>Safari</strong> (bukan di dalam
                    preview).
                  </li>
                  <li>
                    Ketuk ikon <Share className="w-3.5 h-3.5 inline mx-0.5 text-sky-600" />{' '}
                    <strong>Bagikan (Share)</strong> pada bilah Safari.
                  </li>
                  <li>
                    Gulir ke bawah lalu pilih{' '}
                    <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>Ketuk <strong>Tambah</strong>, lalu buka dari ikon aplikasi di Layar Utama.</li>
                </ol>
              </div>
            ) : (
              <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-900">Cara pasang di Laptop / HP Android:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Buka aplikasi di tab penuh Chrome atau Edge (gunakan tombol{' '}
                    <strong>Buka Aplikasi di Tab Baru</strong> di atas atau link aplikasi yang
                    dibagikan/dipublikasikan).
                  </li>
                  <li>
                    Klik tombol biru <strong>Pasang Aplikasi (Offline)</strong> atau klik ikon{' '}
                    <strong>Instal</strong> di ujung kanan bilah alamat URL (Chrome/Edge).
                  </li>
                  <li>
                    Pada HP Android, dapat juga lewat menu titik tiga browser &#8594;{' '}
                    <strong>Tambahkan ke layar utama / Instal aplikasi</strong>.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
