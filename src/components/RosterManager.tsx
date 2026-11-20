import { Check, ClipboardPaste, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { getFaseByKelas } from '../constants/school';
import { ClassRosterMap } from '../types/portal';

interface RosterManagerProps {
  rosters: ClassRosterMap;
  selectedKelas: number;
  onSelectKelas: (kelas: number) => void;
  onSaveRoster: (kelas: number, students: string[]) => Promise<void>;
}

export function RosterManager({
  rosters,
  selectedKelas,
  onSelectKelas,
  onSaveRoster,
}: RosterManagerProps) {
  const [singleName, setSingleName] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState<'append' | 'replace'>('append');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const students = rosters[selectedKelas] || [];

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = singleName.trim();
    if (!cleaned) return;
    setSaving(true);
    try {
      await onSaveRoster(selectedKelas, [...students, cleaned]);
      setSingleName('');
      showFeedback(`"${cleaned}" ditambahkan ke Kelas ${selectedKelas}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setSaving(true);
    try {
      const next =
        bulkMode === 'replace' ? lines : [...students, ...lines];
      await onSaveRoster(selectedKelas, next);
      setBulkText('');
      showFeedback(`${lines.length} nama siswa berhasil disimpan ke Kelas ${selectedKelas}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStudent = async (index: number) => {
    setSaving(true);
    try {
      const next = students.filter((_, i) => i !== index);
      await onSaveRoster(selectedKelas, next);
    } finally {
      setSaving(false);
    }
  };

  const handleClearClass = async () => {
    if (students.length === 0) return;
    setSaving(true);
    try {
      await onSaveRoster(selectedKelas, []);
      showFeedback(`Daftar siswa Kelas ${selectedKelas} dikosongkan.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            Daftar Nama Siswa Per Kelas
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Digunakan otomatis untuk Format Daftar Nilai Asesmen dan daftar pemain Game Edukasi.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onSelectKelas(k)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                selectedKelas === k
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kelas {k}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="mt-4 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Controls */}
        <div className="lg:col-span-5 space-y-5">
          <form onSubmit={handleAddSingle} className="space-y-2.5">
            <label className="block text-sm font-semibold text-slate-800">
              Tambah Siswa Satuan (Kelas {selectedKelas} · {getFaseByKelas(selectedKelas)})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="Ketik nama lengkap siswa..."
                className="flex-1 min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
              <button
                type="submit"
                disabled={saving || !singleName.trim()}
                className="touch-target px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <ClipboardPaste className="w-4 h-4 text-sky-600" />
                Tempel Banyak Baris Sekaligus
              </label>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setBulkMode('append')}
                  className={`px-2.5 py-1 rounded-md font-medium ${
                    bulkMode === 'append' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Tambahkan
                </button>
                <button
                  type="button"
                  onClick={() => setBulkMode('replace')}
                  className={`px-2.5 py-1 rounded-md font-medium ${
                    bulkMode === 'replace' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  Ganti Semua
                </button>
              </div>
            </div>
            <textarea
              rows={5}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'Tempel daftar nama siswa dari Excel/Word (satu nama per baris):\nAhmad Fauzan\nBaiq Alya Zahira\nLalu Rizky Pratama'}
              className="w-full p-3.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            <button
              type="button"
              onClick={handleBulkSave}
              disabled={saving || !bulkText.trim()}
              className="touch-target w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Simpan Daftar Tempelan'}
            </button>
          </div>
        </div>

        {/* Roster List */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-800">
              Siswa Kelas {selectedKelas}{' '}
              <span className="font-mono text-slate-500 tabular-nums">({students.length} siswa)</span>
            </div>
            {students.length > 0 && (
              <button
                type="button"
                onClick={handleClearClass}
                disabled={saving}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
              >
                Kosongkan Kelas
              </button>
            )}
          </div>

          {students.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
              Belum ada data siswa di Kelas {selectedKelas}. Tambahkan satuan atau tempel banyak baris di sebelah kiri.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto divide-y divide-slate-100">
              {students.map((student, idx) => (
                <div
                  key={`${student}_${idx}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 text-xs font-mono text-slate-400 tabular-nums shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-medium text-slate-800 truncate">{student}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStudent(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                    title="Hapus siswa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
