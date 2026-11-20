import {
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Gamepad2,
  Link2,
  Monitor,
  Play,
  Plus,
  QrCode,
  Save,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MAPEL_LIST } from '../constants/school';
import { getBankForTemplate } from '../data/gameQuestionBank';
import { publishPublicGame } from '../services/storageService';
import {
  ClassRosterMap,
  GameDoc,
  GamePlayMode,
  GameQuestionItem,
  GameTemplate,
  MapelName,
  TeacherProfile,
  WorkspaceItemRecord,
} from '../types/portal';
import {
  buildGameShareUrl,
  copyTextSafe,
  makeGameRoomCode,
} from '../utils/gameShare';
import { buildLocalGameDraft } from '../utils/localRpmBuilder';
import { GameBarcodeModal } from './GameBarcodeModal';
import { SimpleGuideStrip } from './SimpleGuideStrip';

interface GameBuilderProps {
  teacher: TeacherProfile;
  rosters: ClassRosterMap;
  initialGame?: GameDoc | null;
  onSaveToFolder: (record: WorkspaceItemRecord) => Promise<void>;
  onLaunchGame: (game: GameDoc, initialView?: 'play' | 'monitor') => void;
  simpleMode?: boolean;
}

const TEMPLATE_OPTIONS: { id: GameTemplate; name: string; desc: string }[] = [
  {
    id: 'running-race',
    name: 'Lomba Lari',
    desc: 'Evaluasi interaktif dengan pelari animasi; setiap siswa mendapat soal seragam & independen.',
  },
  {
    id: 'crossword',
    name: 'Teka-Teki Silang',
    desc: 'Grid mendatar & menurun otomatis dari kata kunci + papan ketik layar sentuh PID/HP.',
  },
  {
    id: 'word-scramble',
    name: 'Menyusun Kata',
    desc: 'Daftar pernyataan & kotak huruf acak; siswa mencari kata ke samping kanan dan turun ke bawah.',
  },
  {
    id: 'horse-race',
    name: 'Lomba Pacuan Kuda',
    desc: 'Evaluasi interaktif dengan penunggang kuda & Pacu Cepat; setiap siswa mendapat soal seragam.',
  },
];

const PAGE_SIZE = 10;

function shuffleQuestionList(arr: GameQuestionItem[]): GameQuestionItem[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function GameBuilder({
  teacher,
  rosters,
  initialGame,
  onSaveToFolder,
  onLaunchGame,
  simpleMode = true,
}: GameBuilderProps) {
  const [gameId, setGameId] = useState<string>(initialGame?.id || `game_${Date.now()}`);
  const [mapel, setMapel] = useState<MapelName>(initialGame?.mapel || 'IPAS');
  const [kelas, setKelas] = useState<number>(initialGame?.kelas || 4);
  const [template, setTemplate] = useState<GameTemplate>(initialGame?.template || 'running-race');
  const [playMode, setPlayMode] = useState<GamePlayMode>(initialGame?.playMode || 'single');
  const [title, setTitle] = useState<string>(
    initialGame?.title || 'Lomba Lari Bank Soal SD (150 Soal)'
  );
  const [topic, setTopic] = useState<string>(initialGame?.topic || 'Materi Tematik SD Kelas 1-6');
  const [items, setItems] = useState<GameQuestionItem[]>(() =>
    initialGame?.items.length
      ? initialGame.items
      : getBankForTemplate(initialGame?.template || 'running-race')
  );
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(
    initialGame?.players.length ? initialGame.players : (rosters[4] || []).slice(0, 4)
  );
  const [customPlayer, setCustomPlayer] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [barcodeData, setBarcodeData] = useState<{
    title: string;
    subtitle: string;
    roomCode: string;
    shareUrl: string;
    qrValue: string;
    game: GameDoc;
  } | null>(null);

  useEffect(() => {
    if (initialGame) {
      setGameId(initialGame.id);
      setMapel(initialGame.mapel);
      setKelas(initialGame.kelas);
      setTemplate(initialGame.template);
      setPlayMode(initialGame.playMode);
      setTitle(initialGame.title);
      setTopic(initialGame.topic);
      setItems(initialGame.items);
      setSelectedPlayers(initialGame.players);
      setCurrentPage(1);
      setSearchQuery('');
    }
  }, [initialGame]);

  const isWordTemplate = template === 'crossword' || template === 'word-scramble';

  const handleTemplateSwitch = (nextTemplate: GameTemplate) => {
    setTemplate(nextTemplate);
    // Automatically swap to the matching 150-question database if using built-in bank items
    const isUsingBuiltInBank = items.some((it) => /^(rr|hr|cw|ws)_bank_/.test(it.id));
    if (isUsingBuiltInBank) {
      setItems(getBankForTemplate(nextTemplate));
      setCurrentPage(1);
      setSearchQuery('');
      const tplInfo = TEMPLATE_OPTIONS.find((t) => t.id === nextTemplate);
      if (tplInfo && title.includes('Bank Soal SD')) {
        setTitle(`${tplInfo.name} Bank Soal SD (150 Soal)`);
      }
    }
  };

  const handleLoad150Database = () => {
    const bank = getBankForTemplate(template);
    setItems(bank);
    setCurrentPage(1);
    setSearchQuery('');
    setStatusMsg(`Database ${bank.length} soal siap dimainkan untuk template ini.`);
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleShuffleDatabaseOrder = () => {
    setItems((prev) => shuffleQuestionList(prev));
    setCurrentPage(1);
    setStatusMsg('Urutan soal berhasil diacak.');
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const filteredIndexedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (!q) return true;
        return (
          item.prompt.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q)
        );
      });
  }, [items, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredIndexedItems.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredIndexedItems.slice(start, start + PAGE_SIZE);
  }, [filteredIndexedItems, safePage]);

  const handleGenerateLocalDraft = () => {
    setErrorMsg(null);
    const cleanTopic = topic.trim() || mapel;
    const localItems = buildLocalGameDraft({
      mapel,
      kelas,
      template,
      topic: cleanTopic,
      count: 10,
    });
    setItems(localItems);
    setCurrentPage(1);
    setSearchQuery('');
    setStatusMsg(
      `Berhasil menyiapkan ${localItems.length} soal cepat tanpa kuota AI untuk topik "${cleanTopic}".`
    );
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const handleGenerateAIDraft = async () => {
    setErrorMsg(null);
    if (!topic.trim()) {
      setErrorMsg('Tuliskan topik materi game terlebih dahulu sebelum membuat draf soal.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const localItems = buildLocalGameDraft({
        mapel,
        kelas,
        template,
        topic: topic.trim(),
        count: 10,
      });
      setItems(localItems);
      setCurrentPage(1);
      setSearchQuery('');
      setStatusMsg(
        `Mode Offline — ${localItems.length} soal lokal untuk topik "${topic}" disiapkan otomatis (Tanpa Kuota).`
      );
      setTimeout(() => setStatusMsg(null), 5000);
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapel,
          kelas,
          template,
          topic: topic.trim(),
          count: 10,
        }),
      });
      const data = (await res.json()) as { items?: GameQuestionItem[]; error?: string };
      if (!res.ok || !data.items) {
        throw new Error(data.error || 'Gagal membuat draf soal game.');
      }
      setItems(data.items);
      setCurrentPage(1);
      setSearchQuery('');
      setStatusMsg(`Berhasil menyusun ${data.items.length} draf soal dari topik "${topic}".`);
      setTimeout(() => setStatusMsg(null), 3500);
    } catch {
      const localItems = buildLocalGameDraft({
        mapel,
        kelas,
        template,
        topic: topic.trim(),
        count: 10,
      });
      setItems(localItems);
      setCurrentPage(1);
      setSearchQuery('');
      const reason =
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Mode Offline'
          : 'Kuota AI sedang penuh';
      setStatusMsg(
        `${reason} — sistem otomatis menyiapkan ${localItems.length} soal lokal untuk topik "${topic}" (Tanpa Kuota).`
      );
      setTimeout(() => setStatusMsg(null), 5000);
    } finally {
      setAiLoading(false);
    }
  };

  const buildGameDoc = (): GameDoc => ({
    id: gameId,
    title: title.trim() || `Game ${mapel} Kelas ${kelas}`,
    topic: topic.trim() || mapel,
    teacherId: teacher.id,
    teacherName: teacher.name,
    mapel,
    kelas,
    template,
    playMode,
    items: items
      .filter((it) => it.prompt.trim() && it.answer.trim())
      .map((it) => ({
        ...it,
        options: isWordTemplate
          ? undefined
          : (it.options || []).map((o) => o.trim()).filter(Boolean),
      })),
    players: selectedPlayers.length > 0 ? selectedPlayers : rosters[kelas] || ['Siswa 1'],
    updatedAt: new Date().toISOString(),
  });

  const persistGame = async (): Promise<GameDoc> => {
    const docData = buildGameDoc();
    if (docData.items.length === 0) {
      throw new Error('Tambahkan minimal 1 soal/kata beserta jawabannya.');
    }
    if (!isWordTemplate) {
      const invalidIdx = docData.items.findIndex((it) => {
        const opts = it.options || [];
        if (opts.length === 0) return false;
        const lowerOpts = opts.map((o) => o.toLowerCase());
        const caseSensitive = new Set(lowerOpts).size !== lowerOpts.length;
        const ans = it.answer.trim();
        return caseSensitive
          ? !opts.includes(ans)
          : !lowerOpts.includes(ans.toLowerCase());
      });
      if (invalidIdx !== -1) {
        throw new Error(
          `Butir #${invalidIdx + 1}: "Jawaban Benar" tidak cocok dengan salah satu Opsi A–D. Samakan teks jawaban dengan opsinya.`
        );
      }
    }
    const record: WorkspaceItemRecord = {
      id: docData.id,
      teacherId: teacher.id,
      itemType: 'game',
      title: docData.title,
      mapel: docData.mapel,
      kelas: docData.kelas,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payload: docData,
    };
    await onSaveToFolder(record);
    return docData;
  };

  const handleSave = async () => {
    setErrorMsg(null);
    setSaving(true);
    try {
      await persistGame();
      setStatusMsg('Game edukasi berhasil disimpan ke Folder Saya.');
      setTimeout(() => setStatusMsg(null), 3500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan game.');
    } finally {
      setSaving(false);
    }
  };

  const handlePlayNow = async () => {
    setErrorMsg(null);
    try {
      const saved = await persistGame();
      onLaunchGame(saved, 'play');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memulai game.');
    }
  };

  const handleMonitorLive = async () => {
    setErrorMsg(null);
    try {
      const saved = await persistGame();
      onLaunchGame(saved, 'monitor');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuka monitor progres game.');
    }
  };

  const handleShareLink = async () => {
    setErrorMsg(null);
    try {
      const saved = await persistGame();
      await publishPublicGame(saved);
      const roomCode = makeGameRoomCode(saved.id);
      const url = buildGameShareUrl(saved, roomCode);
      const copied = await copyTextSafe(url);
      const previewUrl = url.length > 90 ? `${url.slice(0, 88)}...` : url;
      setStatusMsg(
        copied
          ? `Link Auto-Play Siswa lengkap telah disalin ke clipboard! (${previewUrl})`
          : `Link Auto-Play Siswa siap dibagikan: ${previewUrl}`
      );
      setTimeout(() => setStatusMsg(null), 6000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat link game.');
    }
  };

  const handleShowBarcode = async () => {
    setErrorMsg(null);
    try {
      const saved = await persistGame();
      await publishPublicGame(saved);
      const roomCode = makeGameRoomCode(saved.id);
      const shareUrl = buildGameShareUrl(saved, roomCode);
      const qrValue = buildGameShareUrl(saved, roomCode, { forQr: true });
      setBarcodeData({
        title: saved.title,
        subtitle: `${saved.mapel} · Kelas ${saved.kelas}`,
        roomCode,
        shareUrl,
        qrValue,
        game: saved,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal membuat barcode game.');
    }
  };

  const classRoster = rosters[kelas] || [];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-sky-700">
              Modul 2 · Generator Game Edukasi Interaktif
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              Rancang &amp; Mainkan Game Kelas
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="touch-target px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Save className="w-4 h-4" />
              Simpan ke Folder
            </button>
            <button
              type="button"
              onClick={handleShareLink}
              className="touch-target px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Link2 className="w-4 h-4" />
              Share Link Game
            </button>
            <button
              type="button"
              onClick={handleShowBarcode}
              className="touch-target px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Barcode / QR Scan
            </button>
            <button
              type="button"
              onClick={handleMonitorLive}
              className="touch-target px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Monitor className="w-4 h-4" />
              {simpleMode ? 'Pantau Skor Kelas' : 'Lihat Progres Live (PID/Laptop)'}
            </button>
            <button
              type="button"
              onClick={handlePlayNow}
              className="touch-target px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Play className="w-4 h-4" />
              Mainkan Game
            </button>
          </div>
        </div>

        {simpleMode && (
          <SimpleGuideStrip
            heading="3 Langkah Bermain Game Kelas (100% Tanpa Kuota)"
            steps={[
              {
                title: '1. Pilih Jenis Permainan',
                desc: 'Pilih Lomba Lari, TTS, Susun Kata, atau Pacuan Kuda. Sudah tersedia 150 soal SD siap main!',
              },
              {
                title: '2. Pilih Soal Topik Tertentu (Opsional)',
                desc: 'Ketik topik materi lalu klik tombol kuning "Susun Cepat Tanpa Kuota" atau langsung pakai 150 soal bawaan.',
              },
              {
                title: '3. Tampilkan QR atau Mainkan',
                desc: 'Klik "Barcode / QR Scan" agar murid bisa ikut lewat HP, atau klik "Mainkan Game" di layar kelas.',
              },
            ]}
          />
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 break-all">
            <Check className="w-4 h-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Basic Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Judul Game
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Mata Pelajaran
            </label>
            <select
              value={mapel}
              onChange={(e) => setMapel(e.target.value as MapelName)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              {MAPEL_LIST.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">Kelas</label>
            <select
              value={kelas}
              onChange={(e) => {
                const k = Number(e.target.value);
                setKelas(k);
                setSelectedPlayers((rosters[k] || []).slice(0, 6));
              }}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              {[1, 2, 3, 4, 5, 6].map((k) => (
                <option key={k} value={k}>
                  Kelas {k}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1.5">
              Mode Bermain
            </label>
            <select
              value={playMode}
              onChange={(e) => setPlayMode(e.target.value as GamePlayMode)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <option value="single">
                {simpleMode ? 'Main Sendiri (1 Anak)' : 'Single Player'}
              </option>
              <option value="pid-multiplayer">
                {simpleMode ? 'Main Bergiliran di Layar Kelas (PID)' : 'Multiplayer Layar PID (Bergiliran)'}
              </option>
              <option value="live-mobile">
                {simpleMode ? 'Main Serentak di HP Siswa (Scan QR)' : 'Multiplayer Live HP Siswa (WebSocket)'}
              </option>
            </select>
          </div>
        </div>

        {/* 4 Template Cards */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Pilih Template Game Interaktif
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TEMPLATE_OPTIONS.map((tpl) => {
              const active = template === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleTemplateSwitch(tpl.id)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    active
                      ? 'bg-sky-50 border-sky-600 ring-1 ring-sky-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-slate-900">
                      {tpl.name}
                    </span>
                    <Gamepad2
                      className={`w-4 h-4 ${active ? 'text-sky-600' : 'text-slate-400'}`}
                    />
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{tpl.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Topic Draft Helper (Local Zero-Quota + AI) */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Topik Materi (untuk Memilih / Membuat 10 Soal Sesuai Bab)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Contoh: Bagian Tubuh Tumbuhan / Pecahan Sederhana / Sila Pancasila"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleGenerateLocalDraft}
              className="touch-target px-4 py-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Zap className="w-4 h-4 text-amber-600" />
              Susun Cepat (Tanpa Kuota)
            </button>
            <button
              type="button"
              onClick={handleGenerateAIDraft}
              disabled={aiLoading}
              className="touch-target px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {aiLoading ? 'Menyusun Draf...' : 'Buat Draf Soal dari Topik'}
            </button>
          </div>
        </div>
      </div>

      {/* Question / Word Items Editor + Student Player Picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isWordTemplate ? 'Daftar Kata & Petunjuk' : 'Daftar Soal & Jawaban Game'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Tersedia {items.length} butir soal aktif ·{' '}
                {isWordTemplate
                  ? 'Gunakan 1 kata huruf kapital A-Z tanpa spasi agar grid TTS/Susun Kata tersusun rapi.'
                  : 'Seluruh siswa mendapat soal evaluasi dengan urutan yang sama tanpa berubah saat peserta lain menjawab.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLoad150Database}
                className="touch-target px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Database className="w-3.5 h-3.5" />
                Muat 150 Soal Database
              </button>
              <button
                type="button"
                onClick={handleShuffleDatabaseOrder}
                className="touch-target px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Acak Urutan
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextLen = items.length + 1;
                  setItems((prev) => [
                    ...prev,
                    {
                      id: `gq_${Date.now()}`,
                      prompt: '',
                      answer: '',
                      options: isWordTemplate ? [] : ['', '', '', ''],
                      clue: '',
                    },
                  ]);
                  setSearchQuery('');
                  setCurrentPage(Math.ceil(nextLen / PAGE_SIZE));
                }}
                className="touch-target px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Tambah Butir
              </button>
            </div>
          </div>

          {/* Search & Pagination Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari soal atau jawaban..."
                className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                aria-label="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">
                Halaman {safePage} / {totalPages} ({filteredIndexedItems.length} butir)
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                aria-label="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {paginatedItems.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center text-xs text-slate-500">
                Tidak ada soal yang cocok dengan pencarian "{searchQuery}".
              </div>
            ) : (
              paginatedItems.map(({ item, originalIndex }) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-500 tabular-nums">
                      BUTIR #{originalIndex + 1}
                    </span>
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() =>
                        setItems((prev) => prev.filter((_, i) => i !== originalIndex))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {isWordTemplate ? 'Petunjuk / Pertanyaan' : 'Pertanyaan'}
                      </label>
                      <input
                        type="text"
                        value={item.prompt}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it, i) =>
                              i === originalIndex ? { ...it, prompt: e.target.value } : it
                            )
                          )
                        }
                        className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Jawaban Benar
                      </label>
                      <input
                        type="text"
                        value={item.answer}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it, i) =>
                              i === originalIndex
                                ? {
                                    ...it,
                                    answer: isWordTemplate
                                      ? e.target.value.toUpperCase().replace(/[^A-Z]/g, '')
                                      : e.target.value,
                                  }
                                : it
                            )
                          )
                        }
                        className="w-full min-h-[40px] px-3 py-1.5 text-sm font-semibold bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  {!isWordTemplate && (() => {
                    const cleanOpts = (item.options || []).map((o) => o.trim()).filter(Boolean);
                    const lowerOpts = cleanOpts.map((o) => o.toLowerCase());
                    const caseSensitive = new Set(lowerOpts).size !== lowerOpts.length;
                    const ans = item.answer.trim();
                    const hasMismatch =
                      cleanOpts.length > 0 &&
                      Boolean(ans) &&
                      (caseSensitive
                        ? !cleanOpts.includes(ans)
                        : !lowerOpts.includes(ans.toLowerCase()));
                    return (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[0, 1, 2, 3].map((optIdx) => (
                            <input
                              key={optIdx}
                              type="text"
                              placeholder={`Opsi ${String.fromCharCode(65 + optIdx)}`}
                              value={item.options?.[optIdx] || ''}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((it, i) => {
                                    if (i !== originalIndex) return it;
                                    const nextOpts = [...(it.options || ['', '', '', ''])];
                                    nextOpts[optIdx] = e.target.value;
                                    return { ...it, options: nextOpts };
                                  })
                                )
                              }
                              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                            />
                          ))}
                        </div>
                        {hasMismatch && (
                          <p className="text-[11px] font-medium text-amber-700">
                            Catatan: teks &ldquo;Jawaban Benar&rdquo; belum ada di antara Opsi A–D.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
              <span>
                Menampilkan {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredIndexedItems.length)} dari{' '}
                {filteredIndexedItems.length} butir
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold"
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Student Participants Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Daftar Pemain (Kelas {kelas})
            </h3>
            <button
              type="button"
              onClick={() => setSelectedPlayers(classRoster)}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700"
            >
              Pilih Semua
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Siswa yang dipilih tampil sebagai pelari/penunggang pada mode PID maupun pilihan cepat di HP siswa.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={customPlayer}
              onChange={(e) => setCustomPlayer(e.target.value)}
              placeholder="Tambah nama pemain..."
              className="flex-1 min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                if (!customPlayer.trim()) return;
                setSelectedPlayers((p) => [...p, customPlayer.trim()]);
                setCustomPlayer('');
              }}
              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
            >
              +
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2.5">
            {Array.from(new Set([...classRoster, ...selectedPlayers])).map((student) => {
              const checked = selectedPlayers.includes(student);
              return (
                <label
                  key={student}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    checked ? 'bg-sky-50 text-sky-900' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlayers((prev) => [...prev, student]);
                      } else {
                        setSelectedPlayers((prev) => prev.filter((s) => s !== student));
                      }
                    }}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-600"
                  />
                  <span className="truncate">{student}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {barcodeData && (
        <GameBarcodeModal
          title={barcodeData.title}
          subtitle={barcodeData.subtitle}
          roomCode={barcodeData.roomCode}
          shareUrl={barcodeData.shareUrl}
          qrValue={barcodeData.qrValue}
          game={barcodeData.game}
          onClose={() => setBarcodeData(null)}
        />
      )}
    </div>
  );
}
