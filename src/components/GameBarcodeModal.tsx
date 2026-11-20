import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  Globe,
  QrCode,
  RefreshCw,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameDoc } from '../types/portal';
import {
  buildGameShareUrl,
  copyTextSafe,
  downloadStandaloneGameHtml,
  getCustomShareOrigin,
  getPublicShareOrigin,
  isDevPreviewOrigin,
  setCustomShareOrigin,
} from '../utils/gameShare';

interface GameBarcodeModalProps {
  title: string;
  subtitle?: string;
  roomCode: string;
  shareUrl: string;
  qrValue?: string;
  game?: GameDoc;
  onClose: () => void;
}

export function GameBarcodeModal({
  title,
  subtitle,
  roomCode,
  shareUrl: initialShareUrl,
  qrValue: initialQrValue,
  game,
  onClose,
}: GameBarcodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [urlMode, setUrlMode] = useState<'public' | 'current'>('public');
  const [customOriginInput, setCustomOriginInput] = useState(() => getCustomShareOrigin());
  const [savedOrigin, setSavedOrigin] = useState(() => getCustomShareOrigin());
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    checked: boolean;
    ok: boolean;
    status: number;
    authGated?: boolean;
  }>({ checked: false, ok: false, status: 0 });

  const svgContainerRef = useRef<HTMLDivElement | null>(null);

  const effectivePublicOrigin = useMemo(
    () => savedOrigin || getPublicShareOrigin(),
    [savedOrigin]
  );

  const activeShareUrl = useMemo(() => {
    if (!game) return initialShareUrl;
    if (urlMode === 'current') {
      return buildGameShareUrl(game, roomCode, { useCurrentOrigin: true });
    }
    return buildGameShareUrl(game, roomCode, {
      customOrigin: effectivePublicOrigin,
    });
  }, [effectivePublicOrigin, game, initialShareUrl, roomCode, urlMode]);

  const effectiveQr = useMemo(() => {
    if (!game) return initialQrValue || initialShareUrl;
    if (urlMode === 'current') {
      return buildGameShareUrl(game, roomCode, { useCurrentOrigin: true, forQr: true });
    }
    return buildGameShareUrl(game, roomCode, {
      customOrigin: effectivePublicOrigin,
      forQr: true,
    });
  }, [effectivePublicOrigin, game, initialQrValue, initialShareUrl, roomCode, urlMode]);

  const checkPublicUrl = useCallback(async (targetOrigin: string) => {
    if (!targetOrigin || !targetOrigin.startsWith('https://')) {
      setProbeResult({ checked: true, ok: false, status: 0 });
      return;
    }
    setCheckingStatus(true);
    try {
      const res = await fetch(
        `/api/check-share-url?url=${encodeURIComponent(targetOrigin)}`
      );
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          ok: boolean;
          status: number;
          authGated?: boolean;
        };
        setProbeResult({
          checked: true,
          ok: Boolean(data.ok),
          status: Number(data.status || 0),
          authGated: Boolean(data.authGated),
        });
        return;
      }

      // Static host fallback (e.g., Vercel / Netlify / Firebase Hosting without Express /api)
      const sameOrigin =
        typeof window !== 'undefined' && targetOrigin === window.location.origin;
      if (sameOrigin) {
        if (isDevPreviewOrigin()) {
          setProbeResult({ checked: true, ok: false, status: 401, authGated: true });
          return;
        }
        try {
          const assetRes = await fetch(`${targetOrigin}/icon.svg`, {
            method: 'HEAD',
            cache: 'no-store',
          });
          setProbeResult({
            checked: true,
            ok: assetRes.ok,
            status: assetRes.status,
          });
          return;
        } catch {
          setProbeResult({ checked: true, ok: true, status: 200 });
          return;
        }
      }

      try {
        await fetch(targetOrigin, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
        setProbeResult({ checked: true, ok: true, status: 200 });
      } catch {
        setProbeResult({ checked: true, ok: false, status: res.status || 0 });
      }
    } catch {
      const sameOrigin =
        typeof window !== 'undefined' && targetOrigin === window.location.origin;
      if (sameOrigin && !isDevPreviewOrigin()) {
        setProbeResult({ checked: true, ok: true, status: 200 });
      } else {
        setProbeResult({ checked: true, ok: false, status: 0 });
      }
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    void checkPublicUrl(effectivePublicOrigin);
  }, [checkPublicUrl, effectivePublicOrigin]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    const ok = await copyTextSafe(activeShareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleApplyCustomOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = setCustomShareOrigin(customOriginInput);
    setCustomOriginInput(saved);
    setSavedOrigin(saved);
    setUrlMode('public');
  };

  const handleDownloadPng = () => {
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const width = 560;
      const height = 680;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN BARCODE GAME EVALUASI', width / 2, 52);

      ctx.fillStyle = '#475569';
      ctx.font = '18px sans-serif';
      const safeTitle = title.length > 42 ? `${title.slice(0, 39)}...` : title;
      ctx.fillText(safeTitle, width / 2, 84);

      ctx.drawImage(img, (width - 420) / 2, 110, 420, 420);

      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`KODE ROOM: ${roomCode}`, width / 2, 575);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText('SD Negeri Lendang Telaga · Kec. Kopang, Lombok Tengah', width / 2, 620);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `barcode-${roomCode.toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const show404Warning =
    probeResult.checked && !probeResult.ok && urlMode === 'public';

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg my-auto max-h-[94vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl">
        {/* Top Bar with Explicit Kembali Button */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="touch-target px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
          <div className="text-xs font-semibold text-sky-700 inline-flex items-center gap-1.5">
            <QrCode className="w-4 h-4" />
            Barcode &amp; Tautan Siswa
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
            aria-label="Tutup Barcode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="font-display font-bold text-lg text-slate-900 leading-snug">
            {title}
          </h3>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </div>

        {/* Public Link Status Check Banner */}
        {checkingStatus ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
            Memeriksa status link publik untuk HP siswa...
          </div>
        ) : probeResult.checked && probeResult.ok ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs text-emerald-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Link publik aktif ({effectivePublicOrigin}). Siap dibuka di HP siswa!</span>
            </div>
          </div>
        ) : show404Warning ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2 text-xs text-amber-950">
            <div className="flex items-start gap-2 font-semibold text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Link publik ({effectivePublicOrigin}) belum aktif (HTTP {probeResult.status || '404'}).
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900">
              {isDevPreviewOrigin()
                ? 'Saat ini aplikasi masih berjalan di mode Pratinjau Developer. Agar HP siswa bisa memindai QR & membuka link online langsung, aktifkan tombol Share App / Deploy to Cloud Run di pojok kanan atas AI Studio.'
                : 'Pastikan link memakai URL Production Vercel/domain publik Anda dan Deployment Protection (Vercel Authentication) tidak mengunci akses publik.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void checkPublicUrl(effectivePublicOrigin)}
                className="px-2.5 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold rounded-lg inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Cek Ulang Status Link
              </button>
              {game && (
                <button
                  type="button"
                  onClick={() => setUrlMode('current')}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Pakai URL Uji Coba Browser Ini
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Mode Switcher when game prop is available */}
        {game && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setUrlMode('public')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-semibold transition-colors ${
                urlMode === 'public'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Link Publik Siswa
            </button>
            <button
              type="button"
              onClick={() => setUrlMode('current')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg font-semibold transition-colors ${
                urlMode === 'current'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              URL Aktif (Uji Coba Guru)
            </button>
          </div>
        )}

        {/* QR Display */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center text-center space-y-2.5">
          <div
            ref={svgContainerRef}
            className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
          >
            <QRCodeSVG
              value={effectiveQr}
              size={220}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="L"
              includeMargin={false}
            />
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-slate-500 font-medium">
              {urlMode === 'current'
                ? 'Mode Uji Coba: buka di browser yang sama dengan akun guru'
                : 'Arahkan kamera HP siswa ke barcode di atas (langsung masuk tanpa login)'}
            </div>
            <div className="font-mono text-sm font-bold text-slate-900">
              Kode Room: {roomCode}
            </div>
          </div>
        </div>

        {/* Custom Public Domain Input (optional for deployed Cloud Run URL) */}
        {game && (
          <form onSubmit={handleApplyCustomOrigin} className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              URL Publik Aplikasi (opsional jika memakai domain lain, mis. Vercel / Cloud Run)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={customOriginInput}
                onChange={(e) => setCustomOriginInput(e.target.value)}
                placeholder="https://nama-aplikasi-anda.vercel.app"
                className="flex-1 min-h-[36px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl whitespace-nowrap"
              >
                Terapkan
              </button>
            </div>
          </form>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-700 break-all max-h-20 overflow-y-auto">
          {activeShareUrl}
        </div>

        {/* Primary Share / Export Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="touch-target px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Link Tersalin!' : 'Salin Link'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            className="touch-target px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Unduh Barcode PNG
          </button>
        </div>

        {game && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => downloadStandaloneGameHtml(game, roomCode)}
              className="touch-target px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
            >
              <FileCode2 className="w-4 h-4" />
              Unduh Game HTML (Kirim WA)
            </button>
            <a
              href={buildGameShareUrl(game, roomCode, { useCurrentOrigin: true })}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              Tes Tampilan Siswa
            </a>
          </div>
        )}

        {/* Prominent Bottom Back Button */}
        <button
          type="button"
          onClick={onClose}
          className="touch-target w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Ruang Kerja
        </button>
      </div>
    </div>
  );
}
