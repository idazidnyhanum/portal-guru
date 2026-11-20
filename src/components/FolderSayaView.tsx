import {
  Check,
  Download,
  Edit3,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Link2,
  Monitor,
  Package,
  Printer,
  QrCode,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MAPEL_LIST } from '../constants/school';
import {
  deleteGameScoreRecord,
  loadGameScores,
  publishPublicGame,
} from '../services/storageService';
import {
  AssessmentDoc,
  CpMateriBankDoc,
  GameDoc,
  GameScoreRecord,
  RpmSuiteDoc,
  SchoolTeacherSettings,
  TeacherProfile,
  WorkspaceItemRecord,
} from '../types/portal';
import {
  buildGameShareUrl,
  copyTextSafe,
  makeGameRoomCode,
} from '../utils/gameShare';
import {
  downloadCpTpAtpPdf,
  downloadCpTpAtpWord,
  printCpTpAtpWithIframe,
} from '../utils/exportCpTpAtp';
import {
  downloadGameScoresPdf,
  downloadGameScoresWord,
  getGameScoresExportFileName,
} from '../utils/exportGameScores';
import {
  downloadAllRpmSeparateZip,
  downloadRpmPdf,
  downloadRpmWord,
  getDocKindLabel,
  getRpmExportFileName,
  printRpmWithIframe,
} from '../utils/exportRpm';
import { GameBarcodeModal } from './GameBarcodeModal';

interface FolderSayaViewProps {
  teacher: TeacherProfile;
  schoolSettings?: SchoolTeacherSettings;
  items: WorkspaceItemRecord[];
  simpleMode?: boolean;
  onEditAssessment: (doc: AssessmentDoc) => void;
  onPrintAssessment: (doc: AssessmentDoc) => void;
  onDownloadAssessmentPDF: (doc: AssessmentDoc) => void;
  onDownloadAssessmentWord: (doc: AssessmentDoc) => void;
  onEditRpm: (doc: RpmSuiteDoc) => void;
  onOpenCpMateri: (bank: CpMateriBankDoc) => void;
  onEditGame: (game: GameDoc) => void;
  onPlayGame: (game: GameDoc) => void;
  onMonitorGame: (game: GameDoc) => void;
  onDeleteItem: (itemId: string) => Promise<void>;
}

export function FolderSayaView({
  teacher,
  schoolSettings,
  items,
  simpleMode = true,
  onEditAssessment,
  onPrintAssessment,
  onDownloadAssessmentPDF,
  onDownloadAssessmentWord,
  onEditRpm,
  onOpenCpMateri,
  onEditGame,
  onPlayGame,
  onMonitorGame,
  onDeleteItem,
}: FolderSayaViewProps) {
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'cp-materi' | 'assessment' | 'rpm' | 'game' | 'scores'
  >('all');
  const [mapelFilter, setMapelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [barcodeGame, setBarcodeGame] = useState<GameDoc | null>(null);
  const [gameScores, setGameScores] = useState<GameScoreRecord[]>([]);

  useEffect(() => {
    let active = true;
    void loadGameScores(teacher.id).then((list) => {
      if (active) setGameScores(list);
    });
    return () => {
      active = false;
    };
  }, [teacher.id]);

  const filtered = useMemo(() => {
    if (typeFilter === 'scores') return [];
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.itemType !== typeFilter) return false;
      if (mapelFilter !== 'all' && item.mapel !== mapelFilter) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.mapel.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [items, mapelFilter, searchQuery, typeFilter]);

  const filteredScores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return gameScores.filter((rec) => {
      if (mapelFilter !== 'all' && rec.mapel !== mapelFilter) return false;
      if (
        q &&
        !rec.gameTitle.toLowerCase().includes(q) &&
        !rec.mapel.toLowerCase().includes(q) &&
        !rec.roomCode.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [gameScores, mapelFilter, searchQuery]);

  const handleDownloadScoreCsv = (rec: GameScoreRecord) => {
    const headers = ['Peringkat', 'Nama Siswa', 'Skor', 'Jawaban Benar', 'Total Soal', 'Akurasi (%)'];
    const rows = rec.entries.map((entry, idx) => [
      String(idx + 1),
      `"${String(entry.name || '').replace(/"/g, '""')}"`,
      String(entry.score),
      String(entry.correctCount),
      String(entry.totalQuestions),
      String(entry.accuracyPct),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap-game-${rec.roomCode.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteScore = async (scoreId: string) => {
    const next = await deleteGameScoreRecord(teacher.id, scoreId);
    setGameScores(next);
  };

  const handleCopyGameLink = async (game: GameDoc) => {
    void publishPublicGame(game);
    const roomCode = makeGameRoomCode(game.id);
    const url = buildGameShareUrl(game, roomCode);
    const ok = await copyTextSafe(url);
    if (ok) {
      setCopiedId(game.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Code Export */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-700">
            Arsip Digital Guru ({teacher.name})
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-sky-600" />
            Folder Saya (File Word &amp; PDF)
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Setiap perangkat pembelajaran (CP-TP-ATP, PROTA, PROSEM, RPM, Agenda, Asesmen STS/SAS, &amp; Rekap Nilai Game) langsung tersimpan siap diunduh dalam format File Word (.doc) dan File PDF (.pdf).
          </p>
        </div>

        {!simpleMode && (
          <a
            href="/api/export-code"
            download="portal-guru-sdn-lendang-telaga.zip"
            className="touch-target px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-4 h-4" />
            Unduh Semua Kode (.zip)
          </a>
        )}
      </div>

      {simpleMode && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl px-4 py-3 text-xs text-sky-900 leading-relaxed">
          <strong>Petunjuk Singkat:</strong> Cari file di bawah lalu pilih tombol{' '}
          <strong>Unduh Word (.doc)</strong> jika ingin mengedit naskah di Microsoft Word, atau pilih{' '}
          <strong>Unduh PDF (.pdf)</strong> jika file sudah siap langsung dicetak.
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'all', label: `Semua (${items.length})` },
                {
                  id: 'cp-materi',
                  label: `Bank CP & Materi (${items.filter((i) => i.itemType === 'cp-materi').length})`,
                },
                {
                  id: 'assessment',
                  label: `Asesmen (${items.filter((i) => i.itemType === 'assessment').length})`,
                },
                {
                  id: 'rpm',
                  label: `Perangkat RPM (${items.filter((i) => i.itemType === 'rpm').length})`,
                },
                {
                  id: 'game',
                  label: `Game (${items.filter((i) => i.itemType === 'game').length})`,
                },
                {
                  id: 'scores',
                  label: `Rekap Nilai Game (${gameScores.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  typeFilter === tab.id
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={mapelFilter}
            onChange={(e) => setMapelFilter(e.target.value)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl bg-white"
          >
            <option value="all">Semua Mapel</option>
            {MAPEL_LIST.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari perangkat atau game..."
            className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
          />
        </div>
      </div>

      {/* Items List or Rekap Nilai Game */}
      {typeFilter === 'scores' ? (
        filteredScores.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-2">
            <div className="text-base font-semibold text-slate-800">
              Belum ada Rekap Nilai Game tersimpan
            </div>
            <p className="text-sm text-slate-500">
              Saat sesi Game Edukasi Live selesai di Pantau Progres PID, klik tombol Simpan ke Rekap Nilai untuk menyimpan peringkat dan skor siswa di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredScores.map((rec) => {
              const savedDate = new Date(rec.savedAt).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={rec.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="font-semibold text-amber-700 inline-flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" />
                          Rekap Nilai Game
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.mapel}</span>
                        <span aria-hidden="true">·</span>
                        <span>Kelas {rec.kelas}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">Room {rec.roomCode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{savedDate}</span>
                      </div>
                      <h3 className="font-display font-bold text-lg text-slate-900 mt-1">
                        {rec.gameTitle}
                      </h3>
                      <div className="text-[11px] font-mono text-slate-500 mt-1 truncate">
                        File siap unduh: {getGameScoresExportFileName(rec, 'doc')} · {getGameScoresExportFileName(rec, 'pdf')}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => downloadGameScoresWord(rec, schoolSettings)}
                        className="touch-target px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <FileDown className="w-4 h-4" />
                        Unduh Word (.doc)
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadGameScoresPdf(rec, schoolSettings)}
                        className="touch-target px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        Unduh PDF (.pdf)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadScoreCsv(rec)}
                        className="touch-target px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteScore(rec.id)}
                        className="touch-target px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 w-14">Peringkat</th>
                          <th className="py-2 px-3">Nama Siswa</th>
                          <th className="py-2 px-3 text-right">Skor</th>
                          <th className="py-2 px-3 text-right">Benar</th>
                          <th className="py-2 px-3 text-right">Akurasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rec.entries.map((entry, idx) => (
                          <tr key={`${rec.id}_${idx}`} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-700 tabular-nums">
                              #{idx + 1}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              {entry.name}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-sky-700 tabular-nums">
                              {entry.score}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600 tabular-nums">
                              {entry.correctCount}/{entry.totalQuestions}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                              {entry.accuracyPct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-2">
          <div className="text-base font-semibold text-slate-800">
            Folder Saya masih kosong untuk filter ini
          </div>
          <p className="text-sm text-slate-500">
            Buat perangkat asesmen STS/SAS, perangkat RPM, atau game edukasi lalu simpan ke Folder Saya.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const isAssessment = item.itemType === 'assessment';
            const isRpm = item.itemType === 'rpm';
            const isCpMateri = item.itemType === 'cp-materi';
            const rpmPayload = isRpm ? (item.payload as RpmSuiteDoc) : null;
            const cpPayload = isCpMateri ? (item.payload as CpMateriBankDoc) : null;
            const dateStr = new Date(item.updatedAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span
                      className={`font-semibold ${
                        isCpMateri
                          ? 'text-teal-700'
                          : isRpm
                          ? 'text-indigo-700'
                          : isAssessment
                          ? 'text-sky-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {isCpMateri
                        ? 'Bank CP, TP & ATP'
                        : isRpm && rpmPayload
                        ? getDocKindLabel(rpmPayload.docKind)
                        : isAssessment
                        ? 'Asesmen STS/SAS'
                        : 'Game Edukasi'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.mapel}</span>
                    <span aria-hidden="true">·</span>
                    <span>Kelas {item.kelas}</span>
                    {isRpm && rpmPayload && (rpmPayload.rpmList?.length || 1) > 1 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {rpmPayload.rpmList?.length} Pertemuan
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{dateStr}</span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-slate-900 mt-1.5 leading-snug">
                    {item.title}
                  </h3>
                  {(isCpMateri || isAssessment || isRpm) && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="truncate">
                        {isRpm && rpmPayload
                          ? `${getRpmExportFileName(rpmPayload, rpmPayload.docKind || 'suite', 'doc')} · .pdf`
                          : isCpMateri && cpPayload
                          ? `CP_TP_ATP_${cpPayload.mapel.replace(/\s+/g, '_')}_Kls${cpPayload.kelas}.doc · .pdf`
                          : `Asesmen_${item.mapel.replace(/\s+/g, '_')}_Kls${item.kelas}.doc · .pdf`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                  {isCpMateri && cpPayload ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          downloadCpTpAtpWord(cpPayload, teacher.name, 'F4', schoolSettings)
                        }
                        className="touch-target px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        File Word (.doc)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadCpTpAtpPdf(cpPayload, teacher.name, 'F4', schoolSettings)
                        }
                        className="touch-target px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        File PDF (.pdf)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          printCpTpAtpWithIframe(cpPayload, teacher.name, 'F4', schoolSettings)
                        }
                        className="touch-target px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCpMateri(cpPayload)}
                        className="touch-target px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Sunting
                      </button>
                    </>
                  ) : isAssessment ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onDownloadAssessmentWord(item.payload as AssessmentDoc)}
                        className="touch-target px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        File Word (.doc)
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadAssessmentPDF(item.payload as AssessmentDoc)}
                        className="touch-target px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        File PDF (.pdf)
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrintAssessment(item.payload as AssessmentDoc)}
                        className="touch-target px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Pratinjau
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditAssessment(item.payload as AssessmentDoc)}
                        className="touch-target px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </>
                  ) : isRpm && rpmPayload ? (
                    <>
                      <button
                        type="button"
                        onClick={() => downloadRpmWord(rpmPayload, rpmPayload.docKind || 'suite')}
                        className="touch-target px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        File Word (.doc)
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadRpmPdf(rpmPayload, rpmPayload.docKind || 'suite')}
                        className="touch-target px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        File PDF (.pdf)
                      </button>
                      <button
                        type="button"
                        onClick={() => printRpmWithIframe(rpmPayload, rpmPayload.docKind || 'suite')}
                        className="touch-target px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak
                      </button>
                      {rpmPayload.docKind === 'suite' && (
                        <button
                          type="button"
                          onClick={() => downloadAllRpmSeparateZip(rpmPayload, 'both')}
                          className="touch-target px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                        >
                          <Package className="w-3.5 h-3.5" />
                          ZIP (Word &amp; PDF)
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditRpm(rpmPayload)}
                        className="touch-target px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Sunting
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onPlayGame(item.payload as GameDoc)}
                        className="touch-target px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Mainkan
                      </button>
                      <button
                        type="button"
                        onClick={() => onMonitorGame(item.payload as GameDoc)}
                        className="touch-target px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        Lihat Progres (PID/Laptop)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyGameLink(item.payload as GameDoc)}
                        className="touch-target px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        {copiedId === item.id ? 'Tersalin' : 'Salin Link Game'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBarcodeGame(item.payload as GameDoc)}
                        className="touch-target px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Barcode
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditGame(item.payload as GameDoc)}
                        className="touch-target px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit Ulang
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => onDeleteItem(item.id)}
                    className="touch-target ml-auto px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                    title="Hapus dari Folder Saya"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {barcodeGame && (() => {
        const roomCode = makeGameRoomCode(barcodeGame.id);
        const shareUrl = buildGameShareUrl(barcodeGame, roomCode);
        const qrValue = buildGameShareUrl(barcodeGame, roomCode, { forQr: true });
        return (
          <GameBarcodeModal
            title={barcodeGame.title}
            subtitle={`${barcodeGame.mapel} · Kelas ${barcodeGame.kelas}`}
            roomCode={roomCode}
            shareUrl={shareUrl}
            qrValue={qrValue}
            game={barcodeGame}
            onClose={() => setBarcodeGame(null)}
          />
        );
      })()}
    </div>
  );
}
