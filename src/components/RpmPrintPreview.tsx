import { Download, FileDown, Maximize2, Printer, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { RpmDocKind, RpmSuiteDoc, SchoolTeacherSettings } from '../types/portal';
import {
  buildPairedTpAtpRows,
  downloadRpmPdf,
  downloadRpmWord,
  getProsemMonths,
  getRpmPlans,
  printRpmWithIframe,
} from '../utils/exportRpm';
import {
  cleanMeetingTopic,
  formatRpmTpLine,
  getDefaultRpmCrossAndDigital,
} from '../utils/localRpmBuilder';
import { getEffectiveKop } from '../utils/schoolKop';

interface RpmPrintPreviewProps {
  docData: RpmSuiteDoc;
  activeView: RpmDocKind;
  onChangeView: (view: RpmDocKind) => void;
  onSaveSingleFile?: (kind: Exclude<RpmDocKind, 'suite'>) => Promise<void>;
  savingKind?: string | null;
  hideFileCardsPanel?: boolean;
  initialMeetingIdx?: number | null;
  schoolSettings?: SchoolTeacherSettings;
}

const DOC_CARDS: {
  kind: 'tp-atp' | 'prota' | 'prosem' | 'rpm' | 'agenda';
  shortTitle: string;
  desc: string;
}[] = [
  {
    kind: 'tp-atp',
    shortTitle: '1 & 2. TP & ATP (1 Lembar)',
    desc: 'Tujuan Pembelajaran & kolom ATP bersebelahan dalam satu lembar',
  },
  { kind: 'prota', shortTitle: '3. PROTA', desc: 'Program Tahunan (Ganjil & Genap)' },
  { kind: 'prosem', shortTitle: '4. PROSEM', desc: 'Program Semester (5 Minggu / Bulan)' },
  { kind: 'rpm', shortTitle: '5. RPM', desc: 'Rencana Pembelajaran Mendalam + LKPD + Rubrik' },
  { kind: 'agenda', shortTitle: '6. Agenda Harian', desc: 'Jurnal & Agenda Mengajar Harian' },
];

export function RpmPrintPreview({
  docData,
  activeView,
  onChangeView,
  onSaveSingleFile,
  savingKind,
  hideFileCardsPanel = false,
  initialMeetingIdx = null,
  schoolSettings,
}: RpmPrintPreviewProps) {
  const { identity } = docData;
  const kop = getEffectiveKop(schoolSettings, identity.instansi);
  const protas = Array.isArray(docData.protas) ? docData.protas : [];
  const prosems = Array.isArray(docData.prosems) ? docData.prosems : [];
  const agendaHarian = Array.isArray(docData.agendaHarian) ? docData.agendaHarian : [];
  const allRpmPlans = getRpmPlans(docData);

  const [selectedMeetingFilter, setSelectedMeetingFilter] = useState<'all' | number>(
    typeof initialMeetingIdx === 'number' ? initialMeetingIdx : 'all'
  );

  useEffect(() => {
    if (typeof initialMeetingIdx === 'number' && initialMeetingIdx < allRpmPlans.length) {
      setSelectedMeetingFilter(initialMeetingIdx);
    } else if (selectedMeetingFilter !== 'all' && selectedMeetingFilter >= allRpmPlans.length) {
      setSelectedMeetingFilter('all');
    }
  }, [allRpmPlans.length, initialMeetingIdx, selectedMeetingFilter]);

  const displayedRpmPlans =
    selectedMeetingFilter === 'all'
      ? allRpmPlans
      : getRpmPlans(docData, selectedMeetingFilter);

  const paperClass = identity.paperSize === 'F4' ? 'paper-sheet-f4' : 'paper-sheet-a4';
  const paperClassLandscape =
    identity.paperSize === 'F4' ? 'paper-sheet-f4-landscape' : 'paper-sheet-a4-landscape';
  const months = getProsemMonths(identity.semester);

  const [previewZoom, setPreviewZoom] = useState<'fit' | 0.7 | 0.85 | 1>('fit');
  const [fitScale, setFitScale] = useState<number>(1);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);

  const isLandscapeActive = activeView === 'prosem';
  const targetSheetWidthPx = isLandscapeActive
    ? identity.paperSize === 'F4'
      ? 1248
      : 1123
    : identity.paperSize === 'F4'
    ? 813
    : 794;

  useEffect(() => {
    const updateScale = () => {
      const wrap = previewWrapRef.current;
      if (!wrap) return;
      const available = Math.max(280, wrap.clientWidth - 24);
      setFitScale(Math.min(1, Math.max(0.42, available / targetSheetWidthPx)));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (previewWrapRef.current) ro.observe(previewWrapRef.current);
    return () => ro.disconnect();
  }, [targetSheetWidthPx, activeView]);

  const effectiveScale = previewZoom === 'fit' ? fitScale : previewZoom;

  useEffect(() => {
    const styleId = 'dynamic-rpm-print-page-size';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const pageSize = identity.paperSize === 'F4' ? '215mm 330mm' : '210mm 297mm';
    const isProsemOnly = activeView === 'prosem';
    styleEl.textContent = isProsemOnly
      ? `@media print { @page { size: ${pageSize} landscape; margin: 12mm 14mm; } }`
      : `@media print { @page { size: ${pageSize}; margin: 14mm 15mm; } @page prosemLandscape { size: ${pageSize} landscape; margin: 12mm 14mm; } .prosem-print-sheet { page: prosemLandscape; } }`;
  }, [activeView, identity.paperSize]);

  const pairedTpAtpRows = buildPairedTpAtpRows(docData);

  const showSection = (k: 'tp-atp' | 'prota' | 'prosem' | 'rpm' | 'agenda') =>
    activeView === 'suite' ||
    activeView === k ||
    (k === 'tp-atp' && (activeView === 'tp' || activeView === 'atp'));

  const renderKop = (subJudul: string, extraSub?: string) => (
    <div className="border-b-[3px] border-double border-black pb-2.5 mb-4 text-center">
      <div className="relative flex items-center justify-center">
        {kop.logoDataUrl && (
          <img
            src={kop.logoDataUrl}
            alt="Logo Sekolah"
            className="w-14 h-14 object-contain sm:absolute sm:left-1 sm:top-0"
          />
        )}
        <div className={kop.logoDataUrl ? 'sm:px-16' : ''}>
          <div className="text-[10.5pt] font-bold tracking-wide uppercase">
            {kop.pemerintah}
          </div>
          <div className="text-[10.5pt] font-bold tracking-wide uppercase">
            {kop.dinas}
          </div>
          <div className="text-[14pt] font-extrabold tracking-wide uppercase mt-0.5">
            {kop.namaSekolah}
          </div>
          <div className="text-[8.5pt] text-slate-700 mt-0.5">{kop.alamat}</div>
        </div>
      </div>
      <div className="text-[11pt] font-bold uppercase mt-1.5 underline underline-offset-4">
        {subJudul}
      </div>
      {extraSub && <div className="text-[10pt] font-bold uppercase mt-0.5">{extraSub}</div>}
    </div>
  );

  const renderMetaStrip = () => (
    <div className="text-[10pt] mb-3 flex flex-wrap gap-x-6 gap-y-1">
      <span>
        <strong>Mata Pelajaran:</strong> {identity.mapel}
      </span>
      <span>
        <strong>Kelas / Fase:</strong> {identity.kelas} / {identity.fase}
      </span>
      <span>
        <strong>Semester:</strong> {identity.semester} ({identity.tahunAjaran})
      </span>
    </div>
  );

  const renderSignatures = () => (
    <div className="grid grid-cols-2 gap-8 mt-8 text-[10pt] avoid-break">
      <div>
        <div>Mengetahui,</div>
        <div>Kepala Sekolah</div>
        <div className="h-16" />
        <div className="font-bold">
          {identity.kepalaSekolah || '(..........................................)'}
        </div>
        <div>NIP. {identity.nipKepalaSekolah || '....................................'}</div>
      </div>
      <div>
        <div>{identity.kotaTanggal || 'Lendang Telaga, ........................ 2026'}</div>
        <div>Guru {identity.mapel}</div>
        <div className="h-16" />
        <div className="font-bold">
          {identity.namaPenyusun || '(..........................................)'}
        </div>
        <div>NIP. {identity.nipPenyusun || '....................................'}</div>
      </div>
    </div>
  );

  const formatSteps = (steps: string[] = []) =>
    steps.map((s, idx) => (/^\d+\./.test(s.trim()) ? s : `${idx + 1}. ${s}`));

  const activeMeetingArg =
    selectedMeetingFilter === 'all' ? undefined : selectedMeetingFilter;

  return (
    <div className="space-y-5">
      {/* Separate File Cards Panel */}
      {!hideFileCardsPanel && (
        <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-base text-slate-900">
                Pusat File Terpisah (Simpan, Download PDF/Word, atau Cetak Satuan)
              </h2>
              <p className="text-xs text-slate-500">
                Setiap perangkat memiliki file terpisah yang dapat dipratinjau, disimpan ke Folder Saya, diunduh PDF/Word, atau dicetak langsung.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onChangeView('suite')}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                  activeView === 'suite'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tampilkan Semua Perangkat
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {DOC_CARDS.map((card) => {
              const isActive =
                activeView === card.kind ||
                (card.kind === 'tp-atp' && (activeView === 'tp' || activeView === 'atp'));
              const isSaving = savingKind === card.kind;
              return (
                <div
                  key={card.kind}
                  className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                    isActive
                      ? 'border-sky-600 bg-sky-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onChangeView(card.kind)}
                    className="text-left"
                  >
                    <div className="text-sm font-bold text-slate-900">{card.shortTitle}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{card.desc}</div>
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                    {onSaveSingleFile && (
                      <button
                        type="button"
                        disabled={Boolean(savingKind)}
                        onClick={() => onSaveSingleFile(card.kind)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1"
                        title="Simpan file terpisah ke Folder Saya"
                      >
                        <Save className="w-3 h-3" />
                        {isSaving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        downloadRpmPdf(
                          docData,
                          card.kind,
                          card.kind === 'rpm' ? activeMeetingArg : undefined
                        )
                      }
                      className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadRpmWord(
                          docData,
                          card.kind,
                          card.kind === 'rpm' ? activeMeetingArg : undefined
                        )
                      }
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg inline-flex items-center gap-1"
                    >
                      <FileDown className="w-3 h-3" />
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        printRpmWithIframe(
                          docData,
                          card.kind,
                          card.kind === 'rpm' ? activeMeetingArg : undefined
                        )
                      }
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      Cetak
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meeting Filter for RPM Preview if multiple Pertemuan */}
      {showSection('rpm') && allRpmPlans.length > 1 && (
        <div className="no-print bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 mr-1">
              Filter Pratinjau Pertemuan RPM:
            </span>
            <button
              type="button"
              onClick={() => setSelectedMeetingFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                selectedMeetingFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Semua ({allRpmPlans.length} Pertemuan)
            </button>
            {allRpmPlans.map((plan, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedMeetingFilter(idx)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  selectedMeetingFilter === idx
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Pertemuan {plan.pertemuanKe ?? idx + 1}
                {plan.kodeTp ? ` (${plan.kodeTp})` : ''}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => downloadRpmPdf(docData, 'rpm', activeMeetingArg)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              PDF {selectedMeetingFilter === 'all' ? 'Semua' : `Pert. ${selectedMeetingFilter + 1}`}
            </button>
            <button
              type="button"
              onClick={() => printRpmWithIframe(docData, 'rpm', activeMeetingArg)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak
            </button>
          </div>
        </div>
      )}

      {/* Preview Scale Bar */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
          <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
          <span>
            Skala Pratinjau Kertas ({identity.paperSize}{' '}
            {isLandscapeActive ? 'Landscape' : activeView === 'suite' ? 'Portrait & Landscape' : 'Portrait'}) ·{' '}
            <span className="font-mono tabular-nums text-sky-700">
              {Math.round(effectiveScale * 100)}%
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {(
            [
              { id: 'fit', label: 'Pas Layar' },
              { id: 0.7, label: '70%' },
              { id: 0.85, label: '85%' },
              { id: 1, label: '100%' },
            ] as const
          ).map((opt) => (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => setPreviewZoom(opt.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                previewZoom === opt.id
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Printable Paper Sheets */}
      <div ref={previewWrapRef} className="paper-preview-wrapper">
        <div className="paper-zoom-inner" style={{ zoom: effectiveScale }}>
        {/* 1 & 2. TP & ATP DALAM 1 LEMBAR (KOLOM ATP DI SEBELAH KOLOM TP) */}
        {showSection('tp-atp') && (
          <section className={`paper-sheet ${paperClass}`}>
            {renderKop(
              'TUJUAN PEMBELAJARAN (TP) & ALUR TUJUAN PEMBELAJARAN (ATP)',
              `${identity.mapel.toUpperCase()} — KELAS ${identity.kelas} (${identity.fase})`
            )}
            {renderMetaStrip()}

            <div className="border border-black bg-slate-50 p-2.5 mb-3 text-[10pt]">
              <div className="font-bold mb-0.5">Capaian Pembelajaran (CP):</div>
              <div>{identity.cpText || '-'}</div>
            </div>

            <table className="w-full border-collapse border border-black text-[9pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black px-1.5 py-1.5 w-8 text-center">No</th>
                  <th className="border border-black px-1.5 py-1.5 w-16 text-center">Kode</th>
                  <th className="border border-black px-2 py-1.5 w-32 text-left">Materi Pokok</th>
                  <th className="border border-black px-2 py-1.5 text-left">
                    Tujuan Pembelajaran (TP)
                  </th>
                  <th className="border border-black px-2 py-1.5 text-left">
                    Alur Tujuan Pembelajaran (ATP) &amp; Indikator
                  </th>
                  <th className="border border-black px-1.5 py-1.5 w-10 text-center">JP</th>
                </tr>
              </thead>
              <tbody>
                {pairedTpAtpRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-black px-3 py-4 text-center text-slate-500">
                      Belum ada data Tujuan Pembelajaran (TP) &amp; ATP. Silakan susun otomatis atau tambah baris pada mode Sunting.
                    </td>
                  </tr>
                ) : (
                  pairedTpAtpRows.map((row) => (
                    <tr key={`${row.kode}_${row.no}`} className="avoid-break">
                      <td className="border border-black px-1.5 py-1.5 text-center tabular-nums">
                        {row.no}
                      </td>
                      <td className="border border-black px-1.5 py-1.5 text-center font-bold">
                        {row.kode}
                      </td>
                      <td className="border border-black px-2 py-1.5 align-top">
                        {row.materiPokok}
                      </td>
                      <td className="border border-black px-2 py-1.5 align-top whitespace-pre-line">
                        {row.tpText}
                      </td>
                      <td className="border border-black px-2 py-1.5 align-top whitespace-pre-line">
                        {row.atpText}
                      </td>
                      <td className="border border-black px-1.5 py-1.5 text-center tabular-nums">
                        {row.jp}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {renderSignatures()}
          </section>
        )}

        {/* 3. PROTA */}
        {showSection('prota') && (
          <section
            className={`paper-sheet ${paperClass} ${activeView === 'suite' ? 'print-page-break' : ''}`}
          >
            {renderKop('PROGRAM TAHUNAN (PROTA)', `TAHUN PELAJARAN ${identity.tahunAjaran}`)}
            {renderMetaStrip()}

            <table className="w-full border-collapse border border-black text-[9.5pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black px-2 py-1.5 w-10 text-center">No</th>
                  <th className="border border-black px-2 py-1.5 w-24 text-center">Semester</th>
                  <th className="border border-black px-2 py-1.5 text-left">
                    Materi Pokok / Unit Pembelajaran
                  </th>
                  <th className="border border-black px-2 py-1.5 w-28 text-center">Alokasi Waktu</th>
                  <th className="border border-black px-2 py-1.5 text-left">Bulan / Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {protas.map((p) => (
                  <tr key={p.id} className="avoid-break">
                    <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                      {p.no}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center">{p.semester}</td>
                    <td className="border border-black px-2 py-1.5">{p.materiPokok}</td>
                    <td className="border border-black px-2 py-1.5 text-center font-bold tabular-nums">
                      {p.alokasiJp} JP
                    </td>
                    <td className="border border-black px-2 py-1.5">{p.bulanKeterangan}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={3} className="border border-black px-2 py-1.5 text-right">
                    Total Alokasi Waktu Tahunan
                  </td>
                  <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                    {protas.reduce((acc, r) => acc + (r.alokasiJp || 0), 0)} JP
                  </td>
                  <td className="border border-black px-2 py-1.5" />
                </tr>
              </tbody>
            </table>

            {renderSignatures()}
          </section>
        )}

        {/* 4. PROSEM (Kertas Landscape, 5 Minggu tiap Bulan, tidak dicentang otomatis) */}
        {showSection('prosem') && (
          <section
            className={`paper-sheet ${paperClassLandscape} prosem-print-sheet ${activeView === 'suite' ? 'print-page-break' : ''}`}
          >
            {renderKop(
              `PROGRAM SEMESTER (PROSEM) — SEMESTER ${identity.semester.toUpperCase()}`,
              `TAHUN PELAJARAN ${identity.tahunAjaran}`
            )}
            {renderMetaStrip()}

            <table className="w-full border-collapse border border-black text-[8.5pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th rowSpan={2} className="border border-black px-1.5 py-1.5 w-8 text-center">
                    No
                  </th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1.5 w-16 text-center">
                    Kode TP
                  </th>
                  <th rowSpan={2} className="border border-black px-2 py-1.5 text-left">
                    Materi Pokok
                  </th>
                  <th rowSpan={2} className="border border-black px-1.5 py-1.5 w-10 text-center">
                    JP
                  </th>
                  {months.map((m) => (
                    <th key={m} colSpan={5} className="border border-black px-1 py-1 text-center">
                      {m}
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-50">
                  {months.flatMap((m) =>
                    [1, 2, 3, 4, 5].map((w) => (
                      <th
                        key={`${m}-${w}`}
                        className="border border-black px-0.5 py-0.5 text-center w-5 tabular-nums"
                      >
                        {w}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {prosems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + months.length * 5}
                      className="border border-black px-3 py-4 text-center text-slate-500"
                    >
                      Belum ada data PROSEM.
                    </td>
                  </tr>
                ) : (
                  prosems.map((r) => {
                    const marks = Array.isArray(r.bulanMinggu) ? r.bulanMinggu : [];
                    return (
                      <tr key={r.id} className="avoid-break">
                        <td className="border border-black px-1 py-1.5 text-center tabular-nums">
                          {r.no}
                        </td>
                        <td className="border border-black px-1 py-1.5 text-center font-bold">
                          {r.kodeTp}
                        </td>
                        <td className="border border-black px-1.5 py-1.5">{r.materiPokok}</td>
                        <td className="border border-black px-1 py-1.5 text-center tabular-nums">
                          {r.alokasiJp}
                        </td>
                        {months.flatMap((m) =>
                          [1, 2, 3, 4, 5].map((w) => {
                            const checked = marks.includes(`${m}-M${w}`);
                            return (
                              <td
                                key={`${r.id}_${m}_${w}`}
                                className={`border border-black px-0.5 py-1.5 text-center font-bold ${
                                  checked ? 'bg-slate-200' : ''
                                }`}
                              >
                                {checked ? '✓' : ''}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {renderSignatures()}
          </section>
        )}

        {/* 5. RENCANA PEMBELAJARAN MENDALAM (RPM) — PER PERTEMUAN / PER TP */}
        {showSection('rpm') &&
          displayedRpmPlans.map((plan, pIdx) => {
            const meetingNum = plan.pertemuanKe ?? pIdx + 1;
            const materiBaris = cleanMeetingTopic(plan.judulPertemuan || identity.materiPokok);
            const totalCount = displayedRpmPlans.length;
            const headerExtra =
              allRpmPlans.length > 1 || plan.kodeTp
                ? `${identity.mapel.toUpperCase()} — PERTEMUAN KE-${meetingNum}${
                    plan.kodeTp ? ` (${plan.kodeTp})` : ''
                  }`
                : identity.mapel.toUpperCase();

            return (
              <section
                key={`rpm_sheet_${meetingNum}_${pIdx}`}
                className={`paper-sheet ${paperClass} ${
                  activeView === 'suite' || pIdx > 0 ? 'print-page-break' : ''
                }`}
              >
                {renderKop('RENCANA PEMBELAJARAN MENDALAM (RPM)', headerExtra)}

                <div className="font-bold text-[10.5pt] mt-2 mb-1">A. IDENTITAS UMUM</div>
                <table className="w-full border-collapse text-[10pt] mb-3">
                  <tbody>
                    <tr>
                      <td className="py-0.5 w-40 font-semibold">Nama Penyusun</td>
                      <td className="py-0.5">: {identity.namaPenyusun}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold">NIP Penyusun</td>
                      <td className="py-0.5">: {identity.nipPenyusun || '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold">Instansi</td>
                      <td className="py-0.5">: {identity.instansi}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold">Tahun Pelajaran</td>
                      <td className="py-0.5">: {identity.tahunAjaran}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold">Fase / Kelas</td>
                      <td className="py-0.5">
                        : {identity.fase} / Kelas {identity.kelas} SD
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold">Mata Pelajaran</td>
                      <td className="py-0.5">: {identity.mapel}</td>
                    </tr>
                    {(allRpmPlans.length > 1 || plan.kodeTp) && (
                      <tr>
                        <td className="py-0.5 font-semibold">Pertemuan / Kode TP</td>
                        <td className="py-0.5">
                          : Pertemuan ke-{meetingNum} ({plan.kodeTp || `TP.${meetingNum}`})
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-0.5 font-semibold">Materi Pokok</td>
                      <td className="py-0.5">: {materiBaris}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-semibold">Alokasi Waktu</td>
                      <td className="py-0.5">: {identity.alokasiWaktu}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="font-bold text-[10.5pt] mt-3 mb-1">
                  B. KOMPONEN PEMBELAJARAN MENDALAM
                </div>
                <table className="w-full border-collapse border border-black text-[9.5pt] mb-3">
                  <tbody>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 w-44 text-left align-top">
                        Capaian Pembelajaran (CP)
                      </th>
                      <td className="border border-black px-2.5 py-1.5">
                        {plan.capaianPembelajaran || identity.cpText}
                      </td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Tujuan Pembelajaran (TP)
                      </th>
                      <td className="border border-black px-2.5 py-1.5">
                        {(plan.tujuanPembelajaran || []).map((tp, idx) => (
                          <div key={idx}>
                            {idx + 1}. {formatRpmTpLine(tp)}
                          </div>
                        ))}
                      </td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Dimensi Profil Lulusan
                      </th>
                      <td className="border border-black px-2.5 py-1.5">
                        {plan.dimensiProfilLulusan}
                      </td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Lintas Disiplin Ilmu
                      </th>
                      <td className="border border-black px-2.5 py-1.5">
                        {plan.lintasDisiplinIlmu ||
                          getDefaultRpmCrossAndDigital(identity.mapel, materiBaris, identity.kelas)
                            .lintasDisiplinIlmu}
                      </td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Pemanfaatan Digital
                      </th>
                      <td className="border border-black px-2.5 py-1.5">
                        {plan.pemanfaatanDigital ||
                          getDefaultRpmCrossAndDigital(identity.mapel, materiBaris, identity.kelas)
                            .pemanfaatanDigital}
                      </td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Pendekatan &amp; Model
                      </th>
                      <td className="border border-black px-2.5 py-1.5">{plan.pendekatanModel}</td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Sarana &amp; Media Belajar
                      </th>
                      <td className="border border-black px-2.5 py-1.5">{plan.saranaMedia}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="font-bold text-[10.5pt] mt-3 mb-1">
                  C. LANGKAH-LANGKAH KEGIATAN PEMBELAJARAN
                </div>
                <table className="w-full border-collapse border border-black text-[9.5pt] mb-3">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black px-2.5 py-1.5 w-40 text-left">
                        Tahap &amp; Waktu
                      </th>
                      <th className="border border-black px-2.5 py-1.5 text-left">
                        Deskripsi Kegiatan Pembelajaran
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="avoid-break">
                      <td className="border border-black px-2.5 py-2 align-top">
                        <div className="font-bold">Kegiatan Awal</div>
                        <div>({plan.kegiatanAwal?.durasi || '10 Menit'})</div>
                        <div className="italic">{plan.kegiatanAwal?.label || 'Mindful & Joyful'}</div>
                      </td>
                      <td className="border border-black px-2.5 py-2 align-top space-y-1">
                        {formatSteps(plan.kegiatanAwal?.langkah).map((line, i) => (
                          <div key={i} className="whitespace-pre-line">
                            {line}
                          </div>
                        ))}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-2.5 py-2 align-top">
                        <div className="font-bold">Kegiatan Inti</div>
                        <div>({plan.kegiatanInti?.durasi || '50 Menit'})</div>
                        <div className="italic">
                          {plan.kegiatanInti?.label || 'Meaningful & Deep Learning'}
                        </div>
                      </td>
                      <td className="border border-black px-2.5 py-2 align-top space-y-1.5">
                        {formatSteps(plan.kegiatanInti?.langkah).map((line, i) => (
                          <div key={i} className="whitespace-pre-line">
                            {line}
                          </div>
                        ))}
                      </td>
                    </tr>
                    <tr className="avoid-break">
                      <td className="border border-black px-2.5 py-2 align-top">
                        <div className="font-bold">Kegiatan Penutup</div>
                        <div>({plan.kegiatanPenutup?.durasi || '10 Menit'})</div>
                        <div className="italic">{plan.kegiatanPenutup?.label || 'Refleksi'}</div>
                      </td>
                      <td className="border border-black px-2.5 py-2 align-top space-y-1">
                        {formatSteps(plan.kegiatanPenutup?.langkah).map((line, i) => (
                          <div key={i} className="whitespace-pre-line">
                            {line}
                          </div>
                        ))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="font-bold text-[10.5pt] mt-3 mb-1">D. ASESMEN &amp; TINDAK LANJUT</div>
                <table className="w-full border-collapse border border-black text-[9.5pt]">
                  <tbody>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 w-40 text-left align-top">
                        Asesmen Awal
                      </th>
                      <td className="border border-black px-2.5 py-1.5">{plan.asesmenAwal}</td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Asesmen Formatif
                      </th>
                      <td className="border border-black px-2.5 py-1.5">{plan.asesmenFormatif}</td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Asesmen Sumatif
                      </th>
                      <td className="border border-black px-2.5 py-1.5 whitespace-pre-line">
                        {plan.asesmenSumatif}
                      </td>
                    </tr>
                    <tr className="avoid-break">
                      <th className="border border-black bg-slate-50 px-2.5 py-1.5 text-left align-top">
                        Tindak Lanjut
                      </th>
                      <td className="border border-black px-2.5 py-1.5">
                        <div>
                          &bull; <strong>Pengayaan:</strong> {plan.tindakLanjutPengayaan}
                        </div>
                        <div>
                          &bull; <strong>Remedial:</strong> {plan.tindakLanjutRemedial}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {renderSignatures()}

                {/* LAMPIRAN 1: LKPD */}
                <div className="print-page-break pt-6 mt-8 border-t-2 border-dashed border-slate-300">
                  <div className="font-bold text-[11pt] uppercase mb-2">
                    LAMPIRAN 1: LEMBAR KERJA MURID (LKPD)
                    {totalCount > 1 || allRpmPlans.length > 1 ? ` — PERTEMUAN ${meetingNum}` : ''}
                  </div>
                  <div className="text-[10pt] mb-3">
                    <div>Nama Kelompok / Siswa : ....................................................</div>
                    <div>
                      Kelas / Materi &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Kelas{' '}
                      {identity.kelas} / {materiBaris}
                    </div>
                  </div>

                  <div className="font-bold text-[10pt] mb-1">
                    {plan.lkpd?.judulAktivitas1 || 'Aktivitas 1: Pemahaman Konsep'}
                  </div>
                  <table className="w-full border-collapse border border-black text-[9.5pt] mb-4">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black px-2 py-1.5 w-10 text-center">No</th>
                        <th className="border border-black px-2 py-1.5 w-40 text-left">
                          {plan.lkpd?.kolomHeader1 || 'Konsep / Materi'}
                        </th>
                        <th className="border border-black px-2 py-1.5 text-left">
                          {plan.lkpd?.kolomHeader2 || 'Penjelasan'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.lkpd?.aktivitas1Rows || []).map((row) => (
                        <tr key={row.no} className="avoid-break">
                          <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                            {row.no}
                          </td>
                          <td className="border border-black px-2 py-1.5 font-semibold">
                            {row.item}
                          </td>
                          <td className="border border-black px-2 py-1.5 whitespace-pre-line">
                            {row.promptIsian}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="font-bold text-[10pt] mb-1">
                    {plan.lkpd?.judulAktivitas2 || 'Aktivitas 2: Analisis Studi Kasus'}
                  </div>
                  <table className="w-full border-collapse border border-black text-[9.5pt] mb-4">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black px-2 py-1.5 w-[42%] text-left">
                          Cerita Masalah
                        </th>
                        <th className="border border-black px-2 py-1.5 text-left">
                          Hasil Analisis &amp; Solusi Kelompok
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.lkpd?.aktivitas2Cases || []).map((c, idx) => (
                        <tr key={idx} className="avoid-break">
                          <td className="border border-black px-2.5 py-2 align-top">
                            <div className="font-bold">{c.judulKasus}:</div>
                            <div>{c.ceritaMasalah}</div>
                          </td>
                          <td className="border border-black px-2.5 py-2 align-top space-y-1.5">
                            <div>
                              1. {c.pertanyaan1}
                              <div className="pl-3 text-slate-600">
                                Jawab: ....................................................................................
                              </div>
                            </div>
                            <div>
                              2. {c.pertanyaan2}
                              <div className="pl-3 text-slate-600">
                                Jawab: ....................................................................................
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="font-bold text-[10pt] mb-1">
                    {plan.lkpd?.judulAktivitas3 || 'Aktivitas 3: Komitmen Aksi Nyata Individu'}
                  </div>
                  <div className="text-[9.5pt] mb-2">{plan.lkpd?.promptAktivitas3}</div>
                  <div className="space-y-3 mb-6">
                    <div className="border-b border-dotted border-black h-4" />
                    <div className="border-b border-dotted border-black h-4" />
                  </div>

                  {/* LAMPIRAN 2: RUBRIK PENILAIAN */}
                  <div className="font-bold text-[11pt] uppercase mt-6 mb-1.5">
                    LAMPIRAN 2: RUBRIK PENILAIAN DISKUSI &amp; LKPD
                  </div>
                  <table className="w-full border-collapse border border-black text-[8.5pt]">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-black px-2 py-1.5 text-left w-36">
                          Aspek Penilaian
                        </th>
                        <th className="border border-black px-2 py-1.5 text-left">
                          Skor 4 (Sangat Baik)
                        </th>
                        <th className="border border-black px-2 py-1.5 text-left">Skor 3 (Baik)</th>
                        <th className="border border-black px-2 py-1.5 text-left">Skor 2 (Cukup)</th>
                        <th className="border border-black px-2 py-1.5 text-left">
                          Skor 1 (Perlu Bimbingan)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plan.rubrikRows || []).map((rb, idx) => (
                        <tr key={idx} className="avoid-break">
                          <td className="border border-black px-2 py-1.5 font-semibold align-top">
                            {rb.aspek}
                          </td>
                          <td className="border border-black px-2 py-1.5 align-top">{rb.skor4}</td>
                          <td className="border border-black px-2 py-1.5 align-top">{rb.skor3}</td>
                          <td className="border border-black px-2 py-1.5 align-top">{rb.skor2}</td>
                          <td className="border border-black px-2 py-1.5 align-top">{rb.skor1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

        {/* 6. AGENDA HARIAN */}
        {showSection('agenda') && (
          <section
            className={`paper-sheet ${paperClass} ${activeView === 'suite' ? 'print-page-break' : ''}`}
          >
            {renderKop(
              'AGENDA HARIAN MENGAJAR GURU',
              `${identity.mapel.toUpperCase()} — KELAS ${identity.kelas} (${identity.semester} ${identity.tahunAjaran})`
            )}
            {renderMetaStrip()}

            <table className="w-full border-collapse border border-black text-[8.5pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black px-1.5 py-1.5 w-10 text-center">Pert.</th>
                  <th className="border border-black px-2 py-1.5 w-28 text-left">Hari / Tanggal</th>
                  <th className="border border-black px-2 py-1.5 w-24 text-left">Alokasi</th>
                  <th className="border border-black px-2 py-1.5 w-32 text-left">Materi Pokok</th>
                  <th className="border border-black px-2 py-1.5 text-left">
                    Ringkasan Kegiatan Inti
                  </th>
                  <th className="border border-black px-2 py-1.5 w-28 text-left">Media / LKPD</th>
                  <th className="border border-black px-2 py-1.5 w-28 text-left">
                    Catatan / Ketercapaian
                  </th>
                </tr>
              </thead>
              <tbody>
                {agendaHarian.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-black px-3 py-4 text-center text-slate-500">
                      Belum ada data Agenda Harian.
                    </td>
                  </tr>
                ) : (
                  agendaHarian.map((ag) => (
                    <tr key={ag.id} className="avoid-break">
                      <td className="border border-black px-1.5 py-1.5 text-center tabular-nums">
                        {ag.pertemuanKe}
                      </td>
                      <td className="border border-black px-2 py-1.5">{ag.hariTanggal}</td>
                      <td className="border border-black px-2 py-1.5">{ag.jamAlokasi}</td>
                      <td className="border border-black px-2 py-1.5">{ag.materiPokok}</td>
                      <td className="border border-black px-2 py-1.5">{ag.kegiatanIntiRingkas}</td>
                      <td className="border border-black px-2 py-1.5">{ag.mediaLkpd}</td>
                      <td className="border border-black px-2 py-1.5">{ag.catatanKetercapaian}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {renderSignatures()}
          </section>
        )}
        </div>
      </div>
    </div>
  );
}
