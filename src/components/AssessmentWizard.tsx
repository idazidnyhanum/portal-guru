import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Download,
  FileDown,
  FileText,
  Gamepad2,
  ImagePlus,
  PenLine,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getFaseByKelas, MAPEL_LIST } from '../constants/school';
import { loadGameScores } from '../services/storageService';
import {
  downloadAssessmentPDF,
  downloadAssessmentWord,
  printAssessmentWithIframe,
} from '../utils/exportAssessment';
import { compressImageFile } from '../utils/imageUtils';
import {
  buildLocalAssessmentDraft,
  buildLocalQuestionsFromKisi,
} from '../utils/localRpmBuilder';
import {
  AssessmentDoc,
  AssessmentQuestion,
  ClassRosterMap,
  DifficultyLevel,
  DifficultyProportion,
  ExamType,
  GameScoreRecord,
  KisiKisiRow,
  MapelName,
  PaperSize,
  QuestionComposition,
  QuestionType,
  SchoolTeacherSettings,
  SemesterType,
  StudentGradeEntry,
  TeacherProfile,
  WorkspaceItemRecord,
} from '../types/portal';
import { AssessmentPrintPreview } from './AssessmentPrintPreview';
import { FloatingToast } from './FloatingToast';
import { SimpleGuideStrip } from './SimpleGuideStrip';

interface AssessmentPrefillFromRpm {
  mapel: MapelName;
  kelas: number;
  semester: SemesterType;
  tahunAjaran: string;
  paperSize: PaperSize;
  tps: string[];
}

interface AssessmentWizardProps {
  teacher: TeacherProfile;
  rosters: ClassRosterMap;
  initialDoc?: AssessmentDoc | null;
  prefillFromRpm?: AssessmentPrefillFromRpm | null;
  schoolSettings?: SchoolTeacherSettings;
  onSaveToFolder: (record: WorkspaceItemRecord) => Promise<void>;
  simpleMode?: boolean;
}

const SAMPLE_TPS_BY_MAPEL: Partial<Record<MapelName, string[]>> = {
  IPAS: [
    'Peserta didik dapat mengidentifikasi bagian tubuh tumbuhan beserta fungsinya.',
    'Peserta didik dapat menjelaskan proses fotosintesis dan pentingnya bagi kehidupan.',
    'Peserta didik dapat mengelompokkan perubahan wujud benda dalam kehidupan sehari-hari.',
  ],
  Matematika: [
    'Peserta didik dapat menyelesaikan operasi hitung penjumlahan dan pengurangan bilangan cacah.',
    'Peserta didik dapat menentukan nilai pecahan sederhana dari gambar dan soal cerita.',
    'Peserta didik dapat menghitung keliling bangun datar persegi dan persegi panjang.',
  ],
  'Bahasa Indonesia': [
    'Peserta didik dapat menemukan ide pokok dan informasi penting dari teks bacaan.',
    'Peserta didik dapat menggunakan tanda baca dan huruf kapital dengan tepat dalam kalimat.',
    'Peserta didik dapat menulis kalimat efektif menggunakan kosakata baku.',
  ],
};

export function AssessmentWizard({
  teacher,
  rosters,
  initialDoc,
  prefillFromRpm,
  schoolSettings,
  onSaveToFolder,
  simpleMode = true,
}: AssessmentWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(initialDoc ? 3 : 1);
  const [docId, setDocId] = useState<string>(initialDoc?.id || `asm_${Date.now()}`);

  // Step 1: Identity & Manual TPs (NO CP input)
  const [examType, setExamType] = useState<ExamType>(initialDoc?.identity.examType || 'STS');
  const [kelas, setKelas] = useState<number>(
    initialDoc?.identity.kelas || prefillFromRpm?.kelas || 4
  );
  const [paperSize, setPaperSize] = useState<PaperSize>(
    initialDoc?.identity.paperSize || prefillFromRpm?.paperSize || 'F4'
  );
  const [semester, setSemester] = useState<SemesterType>(
    initialDoc?.identity.semester || prefillFromRpm?.semester || 'Ganjil'
  );
  const [tahunAjaran, setTahunAjaran] = useState<string>(
    initialDoc?.identity.tahunAjaran || prefillFromRpm?.tahunAjaran || '2026/2027'
  );
  const [mapel, setMapel] = useState<MapelName>(
    initialDoc?.identity.mapel || prefillFromRpm?.mapel || 'IPAS'
  );
  const [tps, setTps] = useState<string[]>(
    initialDoc?.identity.tps.length
      ? initialDoc.identity.tps
      : prefillFromRpm?.tps.length
      ? prefillFromRpm.tps
      : [
          'Peserta didik dapat menjelaskan konsep utama materi pembelajaran secara tepat.',
          'Peserta didik dapat menerapkan pemahaman konsep pada situasi kehidupan sehari-hari.',
        ]
  );

  // Step 2: Composition & Kisi-Kisi
  const [composition, setComposition] = useState<QuestionComposition>(
    initialDoc?.composition || { pg: 10, isian: 5, uraian: 3, menjodohkan: 2 }
  );
  const [difficulty, setDifficulty] = useState<DifficultyProportion>(
    initialDoc?.difficulty || { mudah: 30, sedang: 50, sulit: 20 }
  );
  const [kisiRows, setKisiRows] = useState<KisiKisiRow[]>(initialDoc?.kisiRows || []);

  // Step 3: Generated Questions, Editor, KKTP & Preview
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(initialDoc?.questions || []);
  const [step3Tab, setStep3Tab] = useState<'preview' | 'edit-soal' | 'analisis'>('preview');
  const [kktp, setKktp] = useState<number>(initialDoc?.kktp ?? 75);
  const [studentGrades, setStudentGrades] = useState<StudentGradeEntry[]>(
    initialDoc?.studentGrades || []
  );
  const [savedGameScores, setSavedGameScores] = useState<GameScoreRecord[]>([]);

  const [loadingKisi, setLoadingKisi] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadGameScores(teacher.id).then(setSavedGameScores);
  }, [teacher.id]);

  // Seed or sync KKTP gradebook with active class roster
  useEffect(() => {
    const classStudents = rosters[kelas] || [];
    setStudentGrades((prev) => {
      if (prev.length > 0 && initialDoc?.identity.kelas === kelas) return prev;
      const existingByName = new Map(prev.map((g) => [g.name, g]));
      return classStudents.map((name) => existingByName.get(name) || { name, score: 0, note: '' });
    });
  }, [kelas, rosters, initialDoc]);

  useEffect(() => {
    if (initialDoc) {
      const stripTag = (s: string) =>
        String(s || '').replace(/^\s*(?:[\[(]\s*(?:STS|SAS)\s*(?:No\.?)?\s*\d+\s*[\])]\s*)+/gi, '').trim();
      setDocId(initialDoc.id);
      setExamType(initialDoc.identity.examType);
      setKelas(initialDoc.identity.kelas);
      setPaperSize(initialDoc.identity.paperSize);
      setSemester(initialDoc.identity.semester);
      setTahunAjaran(initialDoc.identity.tahunAjaran);
      setMapel(initialDoc.identity.mapel);
      setTps(initialDoc.identity.tps);
      setComposition(initialDoc.composition);
      setDifficulty(initialDoc.difficulty);
      setKisiRows(initialDoc.kisiRows);
      setQuestions(
        (initialDoc.questions || []).map((q) => ({
          ...q,
          pertanyaan: stripTag(q.pertanyaan),
        }))
      );
      setKktp(initialDoc.kktp ?? 75);
      setStudentGrades(initialDoc.studentGrades || []);
      setStep(initialDoc.questions.length > 0 ? 3 : 2);
    } else if (prefillFromRpm) {
      setDocId(`asm_${Date.now()}`);
      setKelas(prefillFromRpm.kelas);
      setPaperSize(prefillFromRpm.paperSize);
      setSemester(prefillFromRpm.semester);
      setTahunAjaran(prefillFromRpm.tahunAjaran);
      setMapel(prefillFromRpm.mapel);
      if (prefillFromRpm.tps.length > 0) {
        setTps(prefillFromRpm.tps);
      }
      setKisiRows([]);
      setQuestions([]);
      setStep(1);
    }
  }, [initialDoc, prefillFromRpm]);

  const fase = getFaseByKelas(kelas);
  const totalQuestions =
    composition.pg + composition.isian + composition.uraian + composition.menjodohkan;
  const totalDifficultyPct = difficulty.mudah + difficulty.sedang + difficulty.sulit;
  const validTps = tps.map((t) => t.trim()).filter(Boolean);

  const handleTpCountChange = (targetCount: number) => {
    const safeCount = Math.min(Math.max(1, targetCount), 15);
    setTps((prev) => {
      if (safeCount > prev.length) {
        return [...prev, ...Array(safeCount - prev.length).fill('')];
      }
      return prev.slice(0, safeCount);
    });
  };

  const handleLoadSampleTps = () => {
    const samples = SAMPLE_TPS_BY_MAPEL[mapel] || [
      `Peserta didik dapat memahami konsep dasar ${mapel} Kelas ${kelas}.`,
      `Peserta didik dapat mengidentifikasi contoh penerapan ${mapel} dalam kehidupan sehari-hari.`,
      `Peserta didik dapat menganalisis permasalahan sederhana terkait materi ${mapel}.`,
    ];
    setTps(samples);
  };

  const handleGenerateKisi = async () => {
    setErrorMsg(null);
    if (validTps.length === 0) {
      setErrorMsg('Masukkan minimal 1 rumusan Tujuan Pembelajaran (TP) pada Langkah 1.');
      return;
    }
    if (totalQuestions <= 0) {
      setErrorMsg('Jumlah total soal minimal harus 1 butir.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const built = buildLocalAssessmentDraft({
        examType,
        kelas,
        mapel,
        tps: validTps,
        composition,
        difficulty,
      });
      setKisiRows(built.kisiRows);
      setQuestions(built.questions);
      setSaveSuccess(
        `Mode Offline — ${built.kisiRows.length} baris kisi-kisi & draf soal disusun otomatis secara lokal (Tanpa Kuota).`
      );
      setTimeout(() => setSaveSuccess(null), 5000);
      return;
    }

    setLoadingKisi(true);
    try {
      const res = await fetch('/api/ai/generate-kisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          kelas,
          fase,
          semester,
          tahunAjaran,
          mapel,
          tps: validTps,
          composition,
          difficulty,
        }),
      });
      const data = (await res.json()) as { kisiRows?: KisiKisiRow[]; error?: string };
      if (!res.ok || !data.kisiRows) {
        throw new Error(data.error || 'Gagal menyusun kisi-kisi.');
      }
      setKisiRows(data.kisiRows);
    } catch {
      const built = buildLocalAssessmentDraft({
        examType,
        kelas,
        mapel,
        tps: validTps,
        composition,
        difficulty,
      });
      setKisiRows(built.kisiRows);
      setQuestions(built.questions);
      const reason =
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Mode Offline'
          : 'Kuota AI sedang penuh';
      setSaveSuccess(
        `${reason} — sistem otomatis menyusun ${built.kisiRows.length} baris kisi-kisi & draf soal menggunakan Mesin Lokal (Tanpa Kuota).`
      );
      setTimeout(() => setSaveSuccess(null), 5000);
    } finally {
      setLoadingKisi(false);
    }
  };

  const handleUpdateKisiCell = (
    idx: number,
    field: keyof KisiKisiRow,
    value: string | number
  ) => {
    setKisiRows((prev) =>
      prev.map((row, rIdx) => {
        if (rIdx !== idx) return row;
        if (field === 'tpIndex') {
          const newTpIdx = Number(value) || 1;
          return {
            ...row,
            tpIndex: newTpIdx,
            tpText: validTps[newTpIdx - 1] || row.tpText,
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const handleGenerateQuestions = async () => {
    setErrorMsg(null);
    if (kisiRows.length === 0) {
      setErrorMsg('Susun tabel kisi-kisi terlebih dahulu sebelum membuat naskah soal.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const localQuestions = buildLocalQuestionsFromKisi({
        examType,
        kelas,
        mapel,
        kisiRows,
      });
      setQuestions(localQuestions);
      setStep(3);
      setSaveSuccess(
        `Mode Offline — ${localQuestions.length} butir soal & 3 lampiran disusun otomatis secara lokal (Tanpa Kuota).`
      );
      setTimeout(() => setSaveSuccess(null), 5000);
      return;
    }

    setLoadingQuestions(true);
    try {
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examType,
          kelas,
          fase,
          semester,
          mapel,
          kisiRows,
        }),
      });
      const data = (await res.json()) as { questions?: AssessmentQuestion[]; error?: string };
      if (!res.ok || !data.questions) {
        throw new Error(data.error || 'Gagal membuat naskah soal.');
      }
      setQuestions(data.questions);
      setStep(3);
    } catch {
      const localQuestions = buildLocalQuestionsFromKisi({
        examType,
        kelas,
        mapel,
        kisiRows,
      });
      setQuestions(localQuestions);
      setStep(3);
      const reason =
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Mode Offline'
          : 'Kuota AI sedang penuh';
      setSaveSuccess(
        `${reason} — sistem otomatis menyusun ${localQuestions.length} butir soal & 3 lampiran dari kisi-kisi menggunakan Mesin Lokal (Tanpa Kuota).`
      );
      setTimeout(() => setSaveSuccess(null), 5000);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleGenerateLocalQuestionsFromKisi = () => {
    setErrorMsg(null);
    if (kisiRows.length === 0) {
      setErrorMsg('Susun tabel kisi-kisi terlebih dahulu sebelum membuat naskah soal.');
      return;
    }
    const localQuestions = buildLocalQuestionsFromKisi({
      examType,
      kelas,
      mapel,
      kisiRows,
    });
    setQuestions(localQuestions);
    setStep(3);
    setSaveSuccess(
      `Berhasil menyusun ${localQuestions.length} butir soal cepat tanpa kuota. Silakan sunting atau tambah gambar jika perlu.`
    );
    setTimeout(() => setSaveSuccess(null), 4000);
  };

  const handleGenerateLocalDraft = () => {
    setErrorMsg(null);
    if (validTps.length === 0) {
      setErrorMsg('Masukkan minimal 1 rumusan Tujuan Pembelajaran (TP) pada Langkah 1.');
      return;
    }
    if (totalQuestions <= 0) {
      setErrorMsg('Jumlah total soal minimal harus 1 butir.');
      return;
    }
    const built = buildLocalAssessmentDraft({
      examType,
      kelas,
      mapel,
      tps: validTps,
      composition,
      difficulty,
    });
    setKisiRows(built.kisiRows);
    setQuestions(built.questions);
    setSaveSuccess(
      `Berhasil menyusun ${built.kisiRows.length} kisi-kisi & soal draf lokal (tanpa AI). Anda bisa langsung menyunting atau menambahkan gambar soal.`
    );
    setTimeout(() => setSaveSuccess(null), 4000);
  };

  const handleUpdateQuestion = (
    qId: string,
    updater: (q: AssessmentQuestion) => AssessmentQuestion
  ) => {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? updater(q) : q)));
  };

  const handleImportGameScores = (recordId: string) => {
    const rec = savedGameScores.find((r) => r.id === recordId);
    if (!rec) return;
    const byName = new Map(rec.entries.map((e) => [e.name.trim().toLowerCase(), e.accuracyPct]));
    setStudentGrades((prev) => {
      const existingNames = new Set(prev.map((p) => p.name.trim().toLowerCase()));
      const updated = prev.map((row) => {
        const pct = byName.get(row.name.trim().toLowerCase());
        return typeof pct === 'number'
          ? { ...row, score: pct, note: `Dari Game: ${rec.gameTitle}` }
          : row;
      });
      for (const e of rec.entries) {
        if (!existingNames.has(e.name.trim().toLowerCase())) {
          updated.push({
            name: e.name,
            score: e.accuracyPct,
            note: `Dari Game: ${rec.gameTitle}`,
          });
        }
      }
      return updated;
    });
    setSaveSuccess(`Nilai dari "${rec.gameTitle}" berhasil dimuat ke Analisis KKTP.`);
    setTimeout(() => setSaveSuccess(null), 3500);
  };

  const gradeStats = useMemo(() => {
    const scored = studentGrades.filter((s) => Number.isFinite(s.score));
    const total = scored.length;
    if (total === 0) {
      return { avg: 0, max: 0, min: 0, passed: [], remedial: [], passPct: 0 };
    }
    const vals = scored.map((s) => s.score);
    const sum = vals.reduce((a, b) => a + b, 0);
    const passed = scored.filter((s) => s.score >= kktp);
    const remedial = scored.filter((s) => s.score < kktp);
    return {
      avg: Math.round((sum / total) * 10) / 10,
      max: Math.max(...vals),
      min: Math.min(...vals),
      passed,
      remedial,
      passPct: Math.round((passed.length / total) * 100),
    };
  }, [studentGrades, kktp]);

  const handleExportGradesCsv = () => {
    const header = 'No,Nama Siswa,Nilai,KKTP,Status Ketuntasan,Catatan\n';
    const rows = studentGrades
      .map((s, idx) => {
        const status = s.score >= kktp ? 'Tuntas (Pengayaan)' : 'Belum Tuntas (Remedial)';
        return `${idx + 1},"${s.name.replace(/"/g, '""')}",${s.score},${kktp},"${status}","${(s.note || '').replace(/"/g, '""')}"`;
      })
      .join('\n');
    const blob = new Blob([`\uFEFF${header}${rows}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Analisis_KKTP_${examType}_${mapel}_Kls${kelas}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const currentDoc: AssessmentDoc = {
    id: docId,
    title: `${examType} ${mapel} Kelas ${kelas} (${semester} ${tahunAjaran})`,
    teacherId: teacher.id,
    teacherName: teacher.name,
    identity: {
      examType,
      kelas,
      fase,
      paperSize,
      semester,
      tahunAjaran,
      mapel,
      tps: validTps,
      namaPenyusun: initialDoc?.identity.namaPenyusun || teacher.name,
      nipPenyusun:
        schoolSettings?.teacherNips?.[teacher.id] ||
        initialDoc?.identity.nipPenyusun ||
        teacher.nip ||
        '',
      kepalaSekolah:
        schoolSettings?.kepalaSekolah || initialDoc?.identity.kepalaSekolah || '',
      nipKepalaSekolah:
        schoolSettings?.nipKepalaSekolah || initialDoc?.identity.nipKepalaSekolah || '',
    },
    composition,
    difficulty,
    kisiRows,
    questions,
    kktp,
    studentGrades,
    updatedAt: new Date().toISOString(),
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      const record: WorkspaceItemRecord = {
        id: docId,
        teacherId: teacher.id,
        itemType: 'assessment',
        title: currentDoc.title,
        mapel,
        kelas,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload: currentDoc,
      };
      await onSaveToFolder(record);
      setSaveSuccess('Perangkat asesmen berhasil disimpan ke Folder Saya.');
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan perangkat.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stepper Header */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-700">
            Modul 1 · Generator Perangkat Asesmen STS &amp; SAS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            {currentDoc.title}
          </h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {(
            [
              { n: 1, label: '1. Identitas & TP Manual' },
              { n: 2, label: '2. Komposisi & Kisi-Kisi' },
              { n: 3, label: '3. Naskah & 3 Lampiran' },
            ] as { n: 1 | 2 | 3; label: string }[]
          ).map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => {
                if (s.n === 3 && questions.length === 0) return;
                setStep(s.n);
              }}
              className={`touch-target px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                step === s.n
                  ? 'bg-sky-600 text-white'
                  : s.n === 3 && questions.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {simpleMode && (
        <SimpleGuideStrip
          heading="3 Langkah Membuat Soal Ujian (STS / SAS)"
          steps={[
            {
              title: '1. Pilih Mapel & Tulis TP',
              desc: 'Pilih STS/SAS, kelas, dan mapel, lalu tuliskan tujuan materi yang ingin diujikan.',
            },
            {
              title: '2. Susun Kisi-Kisi & Soal (Bisa Tanpa Kuota)',
              desc: 'Atur jumlah soal PG/Isian/Uraian, lalu klik tombol kuning "Susun Kisi & Soal Tanpa Kuota AI" atau tombol otomatis.',
            },
            {
              title: '3. Simpan & Unduh Word / PDF',
              desc: 'Periksa naskah soal, simpan ke Folder Saya, lalu unduh File Word (.doc) atau PDF kertas F4/A4.',
            },
          ]}
        />
      )}

      {/* LANGKAH 1: IDENTITAS & INPUT TP MANUAL (TANPA CP) */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Jenis Ujian
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['STS', 'SAS'] as ExamType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setExamType(t)}
                    className={`touch-target px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
                      examType === t
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {t === 'STS' ? 'STS (Tengah)' : 'SAS (Akhir)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Kelas &amp; Fase Otomatis
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={kelas}
                  onChange={(e) => setKelas(Number(e.target.value))}
                  className="flex-1 min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                >
                  {[1, 2, 3, 4, 5, 6].map((k) => (
                    <option key={k} value={k}>
                      Kelas {k}
                    </option>
                  ))}
                </select>
                <span className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 whitespace-nowrap">
                  {fase}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Ukuran Kertas Cetak
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['F4', 'A4'] as PaperSize[]).map((ps) => (
                  <button
                    key={ps}
                    type="button"
                    onClick={() => setPaperSize(ps)}
                    className={`touch-target px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      paperSize === ps
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {ps === 'F4' ? 'F4 (215×330mm)' : 'A4 (210×297mm)'}
                  </button>
                ))}
              </div>
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
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value as SemesterType)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Tahun Ajaran
              </label>
              <input
                type="text"
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                placeholder="2026/2027"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
          </div>

          {/* Direct Manual TP Input (without CP) */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Input Tujuan Pembelajaran (TP) Manual
                </h2>
                <p className="text-sm text-slate-500">
                  Langsung masukkan rumusan TP yang diujikan. Kisi-kisi dan soal akan disusun proporsional dari daftar TP ini.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-semibold text-slate-700">Jumlah TP:</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={tps.length}
                    onChange={(e) => handleTpCountChange(Number(e.target.value))}
                    className="w-14 px-2 py-1 text-sm font-mono text-center bg-white border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleTps}
                  className="touch-target px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Isi Contoh TP {mapel}
                </button>
                <button
                  type="button"
                  onClick={() => setTps((prev) => [...prev, ''])}
                  className="touch-target px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Tambah TP
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {tps.map((tp, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="min-h-[44px] px-3 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-700 shrink-0 tabular-nums">
                    TP {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={tp}
                    onChange={(e) =>
                      setTps((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))
                    }
                    placeholder={`Tuliskan rumusan Tujuan Pembelajaran ke-${idx + 1}...`}
                    className="flex-1 min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                  <button
                    type="button"
                    disabled={tps.length <= 1}
                    onClick={() => setTps((prev) => prev.filter((_, i) => i !== idx))}
                    className="touch-target px-3 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-xl hover:bg-rose-50 transition-colors shrink-0"
                    title="Hapus baris TP"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (validTps.length === 0) {
                  setErrorMsg('Minimal isi 1 rumusan Tujuan Pembelajaran (TP).');
                  return;
                }
                setErrorMsg(null);
                setStep(2);
              }}
              className="touch-target px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
            >
              Lanjut ke Komposisi &amp; Kisi-Kisi
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* LANGKAH 2: KOMPOSISI SOAL & KISI-KISI */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  Komposisi Bentuk Soal{' '}
                  <span className="font-mono text-sky-700 tabular-nums">
                    (Total: {totalQuestions} butir)
                  </span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      { key: 'pg', label: 'Pilihan Ganda' },
                      { key: 'isian', label: 'Isian Singkat' },
                      { key: 'menjodohkan', label: 'Menjodohkan' },
                      { key: 'uraian', label: 'Uraian' },
                    ] as { key: keyof QuestionComposition; label: string }[]
                  ).map((item) => (
                    <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {item.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={composition[item.key]}
                        onChange={(e) =>
                          setComposition((prev) => ({
                            ...prev,
                            [item.key]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-full min-h-[40px] px-2.5 text-base font-mono font-bold text-center bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  Proporsi Tingkat Kesulitan{' '}
                  <span
                    className={`font-mono tabular-nums ${
                      totalDifficultyPct === 100 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    (Total: {totalDifficultyPct}%)
                  </span>
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      { key: 'mudah', label: 'Mudah (%)' },
                      { key: 'sedang', label: 'Sedang (%)' },
                      { key: 'sulit', label: 'Sulit / HOTS (%)' },
                    ] as { key: keyof DifficultyProportion; label: string }[]
                  ).map((item) => (
                    <div key={item.key} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        {item.label}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={difficulty[item.key]}
                        onChange={(e) =>
                          setDifficulty((prev) => ({
                            ...prev,
                            [item.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-full min-h-[40px] px-2.5 text-base font-mono font-bold text-center bg-white border border-slate-300 rounded-lg tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Terdaftar <strong className="tabular-nums">{validTps.length} TP</strong> untuk {mapel} Kelas {kelas}.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateLocalDraft}
                  className="touch-target px-4 py-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <Zap className="w-4 h-4 text-amber-600" />
                  Susun Kisi &amp; Soal Draf (Tanpa AI)
                </button>
                <button
                  type="button"
                  onClick={handleGenerateKisi}
                  disabled={loadingKisi}
                  className="touch-target px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {loadingKisi
                    ? 'Menyusun Kisi-Kisi Otomatis...'
                    : kisiRows.length > 0
                    ? 'Susun Ulang Kisi-Kisi (AI)'
                    : 'Susun Kisi-Kisi Otomatis (AI)'}
                </button>
              </div>
            </div>
          </div>

          {/* Editable Kisi-Kisi Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Tabel Kisi-Kisi Asesmen (Dapat Diedit)
                </h3>
                <p className="text-sm text-slate-500">
                  Periksa atau sunting materi pokok, indikator soal, level kognitif, maupun bentuk soal sebelum menghasilkan naskah soal.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-500 tabular-nums">
                {kisiRows.length} baris kisi-kisi
              </div>
            </div>

            {kisiRows.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center text-sm text-slate-500">
                Klik tombol <strong>Susun Kisi-Kisi Otomatis (AI)</strong> di atas untuk membuat tabel kisi-kisi proporsional dari seluruh TP Anda.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="p-2.5 w-12 text-center">No</th>
                      <th className="p-2.5 w-24">TP</th>
                      <th className="p-2.5 min-w-[140px]">Materi Pokok</th>
                      <th className="p-2.5 min-w-[240px]">Indikator Soal</th>
                      <th className="p-2.5 w-20">Level</th>
                      <th className="p-2.5 w-28">Kesulitan</th>
                      <th className="p-2.5 w-32">Bentuk</th>
                      <th className="p-2.5 w-28 text-center">No. Soal Disajikan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {kisiRows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="p-2 text-center font-mono font-semibold tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="p-2">
                          <select
                            value={row.tpIndex}
                            onChange={(e) =>
                              handleUpdateKisiCell(idx, 'tpIndex', Number(e.target.value))
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          >
                            {validTps.map((_, tIdx) => (
                              <option key={tIdx + 1} value={tIdx + 1}>
                                TP {tIdx + 1}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.materiPokok}
                            onChange={(e) =>
                              handleUpdateKisiCell(idx, 'materiPokok', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.indikatorSoal}
                            onChange={(e) =>
                              handleUpdateKisiCell(idx, 'indikatorSoal', e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={row.levelKognitif}
                            onChange={(e) =>
                              handleUpdateKisiCell(
                                idx,
                                'levelKognitif',
                                e.target.value as 'L1' | 'L2' | 'L3'
                              )
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          >
                            <option value="L1">L1</option>
                            <option value="L2">L2</option>
                            <option value="L3">L3</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={row.kesulitan}
                            onChange={(e) =>
                              handleUpdateKisiCell(
                                idx,
                                'kesulitan',
                                e.target.value as DifficultyLevel
                              )
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          >
                            <option value="Mudah">Mudah</option>
                            <option value="Sedang">Sedang</option>
                            <option value="Sulit">Sulit</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={row.bentukSoal}
                            onChange={(e) =>
                              handleUpdateKisiCell(
                                idx,
                                'bentukSoal',
                                e.target.value as QuestionType
                              )
                            }
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          >
                            <option value="pg">Pilihan Ganda</option>
                            <option value="isian">Isian Singkat</option>
                            <option value="menjodohkan">Menjodohkan</option>
                            <option value="uraian">Uraian</option>
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="text-[11px] text-slate-500 font-medium">No.</span>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={row.noSoal}
                              onChange={(e) =>
                                handleUpdateKisiCell(
                                  idx,
                                  'noSoal',
                                  Math.max(1, Number(e.target.value) || 1)
                                )
                              }
                              className="w-14 px-1.5 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white text-xs tabular-nums"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="touch-target px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Langkah 1
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {questions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="touch-target px-4 py-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Buka Draf Soal Tersedia ({questions.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGenerateLocalQuestionsFromKisi}
                  disabled={kisiRows.length === 0}
                  className="touch-target px-4 py-3 bg-amber-50 border border-amber-300 hover:bg-amber-100 disabled:opacity-50 text-amber-900 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <Zap className="w-4 h-4 text-amber-600" />
                  Susun Soal Cepat (Tanpa Kuota)
                </button>
                <button
                  type="button"
                  onClick={handleGenerateQuestions}
                  disabled={loadingQuestions || kisiRows.length === 0}
                  className="touch-target px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  {loadingQuestions
                    ? 'Menyusun Naskah Soal & 3 Lampiran...'
                    : simpleMode
                    ? 'Buat Naskah Soal & Kunci Jawaban'
                    : 'Hasilkan Naskah Soal & 3 Lampiran (AI)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LANGKAH 3: NASKAH SOAL, SUNTING GAMBAR, ANALISIS KKTP & 3 LAMPIRAN */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="touch-target px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Edit Kisi-Kisi
              </button>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                {(['A4', 'F4'] as PaperSize[]).map((ps) => (
                  <button
                    key={ps}
                    type="button"
                    onClick={() => setPaperSize(ps)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      paperSize === ps
                        ? 'bg-white text-sky-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ps === 'A4' ? 'A4 (210×297)' : 'F4 (215×330)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="touch-target px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : 'Simpan File (Word & PDF)'}
              </button>
              <button
                type="button"
                onClick={() => downloadAssessmentPDF(currentDoc, rosters[kelas] || [], schoolSettings)}
                className="touch-target px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF ({paperSize})
              </button>
              <button
                type="button"
                onClick={() => downloadAssessmentWord(currentDoc, rosters[kelas] || [], schoolSettings)}
                className="touch-target px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Download Word (.doc)
              </button>
              <button
                type="button"
                onClick={() => printAssessmentWithIframe(currentDoc, rosters[kelas] || [], schoolSettings)}
                className="touch-target px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Cetak ({paperSize})
              </button>
            </div>
          </div>

          {/* Step 3 Sub-view Tabs */}
          <div className="no-print flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl">
            <button
              type="button"
              onClick={() => setStep3Tab('preview')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors ${
                step3Tab === 'preview'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Pratinjau &amp; Cetak Dokumen
            </button>
            <button
              type="button"
              onClick={() => setStep3Tab('edit-soal')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors ${
                step3Tab === 'edit-soal'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              Sunting Soal &amp; Sisipkan Gambar ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setStep3Tab('analisis')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors ${
                step3Tab === 'analisis'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Analisis Nilai &amp; Ketuntasan (KKTP)
            </button>
          </div>

          {step3Tab === 'preview' && (
            <AssessmentPrintPreview
              docData={currentDoc}
              students={rosters[kelas] || []}
              schoolSettings={schoolSettings}
            />
          )}

          {step3Tab === 'edit-soal' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Sunting Butir Soal &amp; Sisipkan Gambar Stimulus
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Anda dapat menyunting pertanyaan, {kelas <= 3 ? 'opsi A–C (khusus Kelas 1–3)' : 'opsi A–D'}, kunci jawaban, atau mengunggah gambar stimulus (otomatis dikompresi agar rapi tercetak di PDF/Word).
                </p>
              </div>
              <div className="space-y-4">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Soal No. <span className="font-mono">{q.nomor}</span> · {q.bentuk.toUpperCase()} · TP {q.tpIndex} · {q.kesulitan}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5">
                          <ImagePlus className="w-3.5 h-3.5 text-sky-600" />
                          <span>{q.imageDataUrl ? 'Ganti Gambar' : 'Sisipkan Gambar'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              try {
                                const compressed = await compressImageFile(file, {
                                  maxDim: 600,
                                  quality: 0.8,
                                  maxBytes: 78_000,
                                });
                                handleUpdateQuestion(q.id, (prev) => ({
                                  ...prev,
                                  imageDataUrl: compressed,
                                }));
                              } catch {
                                // ignore invalid image
                              }
                            }}
                          />
                        </label>
                        {q.imageDataUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuestion(q.id, (prev) => ({
                                ...prev,
                                imageDataUrl: undefined,
                              }))
                            }
                            className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus Gambar
                          </button>
                        )}
                      </div>
                    </div>

                    {q.imageDataUrl && (
                      <div className="bg-white border border-slate-200 rounded-xl p-2 inline-block">
                        <img
                          src={q.imageDataUrl}
                          alt={`Stimulus Soal ${q.nomor}`}
                          className="max-w-[260px] max-h-[160px] object-contain"
                        />
                      </div>
                    )}

                    <textarea
                      rows={2}
                      value={q.pertanyaan}
                      onChange={(e) =>
                        handleUpdateQuestion(q.id, (prev) => ({
                          ...prev,
                          pertanyaan: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                    />

                    {q.bentuk === 'pg' && q.opsi && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {((kelas <= 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']) as Array<'A' | 'B' | 'C' | 'D'>).map(
                          (letter) => (
                            <div key={letter} className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-600 w-5">{letter}.</span>
                              <input
                                type="text"
                                value={q.opsi?.[letter] || ''}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, (prev) => ({
                                    ...prev,
                                    opsi: {
                                      A: prev.opsi?.A || '',
                                      B: prev.opsi?.B || '',
                                      C: prev.opsi?.C || '',
                                      ...(kelas > 3 ? { D: prev.opsi?.D || '' } : {}),
                                      [letter]: e.target.value,
                                    },
                                  }))
                                }
                                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Kunci Jawaban
                        </label>
                        <input
                          type="text"
                          value={q.kunciJawaban}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, (prev) => ({
                              ...prev,
                              kunciJawaban: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Rubrik &amp; Skor Maksimal
                        </label>
                        <input
                          type="text"
                          value={q.rubrikSkor}
                          onChange={(e) =>
                            handleUpdateQuestion(q.id, (prev) => ({
                              ...prev,
                              rubrikSkor: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step3Tab === 'analisis' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Analisis Ketuntasan &amp; Nilai Kelas {kelas} ({mapel})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Masukkan nilai akhir siswa (skala 0–100) atau impor langsung dari Rekap Nilai Game Edukasi untuk melihat daftar Remedial dan Pengayaan.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    <label className="text-xs font-semibold text-slate-700">KKTP:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={kktp}
                      onChange={(e) =>
                        setKktp(Math.min(100, Math.max(1, Number(e.target.value) || 75)))
                      }
                      className="w-16 px-2 py-1 text-xs font-mono font-bold text-center border border-slate-300 rounded-lg bg-white tabular-nums"
                    />
                  </div>

                  {savedGameScores.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleImportGameScores(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="min-h-[36px] px-2.5 py-1.5 text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-xl"
                      >
                        <option value="">Impor Nilai dari Game...</option>
                        {savedGameScores.map((gs) => (
                          <option key={gs.id} value={gs.id}>
                            {gs.gameTitle} ({gs.entries.length} siswa)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleExportGradesCsv}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {simpleMode ? 'Unduh Daftar Nilai (Excel)' : 'Unduh CSV Analisis'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500">Rata-rata Kelas</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {gradeStats.avg}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-xs text-slate-500">Nilai Tertinggi / Terendah</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
                    {gradeStats.max} / {gradeStats.min}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                  <div className="text-xs text-emerald-700">Ketuntasan Klasikal</div>
                  <div className="text-2xl font-bold font-mono text-emerald-800 mt-1 tabular-nums">
                    {gradeStats.passPct}% ({gradeStats.passed.length}/{studentGrades.length})
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">
                  <div className="text-xs text-amber-800">Perlu Remedial (&lt; {kktp})</div>
                  <div className="text-2xl font-bold font-mono text-amber-900 mt-1 tabular-nums">
                    {gradeStats.remedial.length} Siswa
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="p-2.5 w-12 text-center">No</th>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5 w-28 text-center">Nilai (0–100)</th>
                      <th className="p-2.5 w-44">Keterangan KKTP ({kktp})</th>
                      <th className="p-2.5">Catatan Guru</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {studentGrades.map((row, idx) => {
                      const isPassed = row.score >= kktp;
                      return (
                        <tr key={`${row.name}_${idx}`} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-mono tabular-nums">{idx + 1}</td>
                          <td className="p-2.5 font-medium text-slate-900">{row.name}</td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={row.score}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                                setStudentGrades((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, score: val } : item))
                                );
                              }}
                              className="w-20 px-2 py-1 text-center font-mono font-bold border border-slate-300 rounded-lg bg-white tabular-nums"
                            />
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-xs font-semibold ${
                                isPassed ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {isPassed ? 'Tuntas (Pengayaan)' : 'Belum Tuntas (Remedial)'}
                            </span>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.note || ''}
                              onChange={(e) =>
                                setStudentGrades((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, note: e.target.value } : item
                                  )
                                )
                              }
                              placeholder="Opsional..."
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <div className="text-xs font-bold text-emerald-900 mb-1.5">
                    Kelompok Pengayaan ({gradeStats.passed.length} Siswa)
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {gradeStats.passed.length > 0
                      ? gradeStats.passed.map((s) => `${s.name} (${s.score})`).join(' · ')
                      : 'Belum ada siswa mencapai KKTP.'}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                  <div className="text-xs font-bold text-amber-900 mb-1.5">
                    Kelompok Remedial ({gradeStats.remedial.length} Siswa)
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {gradeStats.remedial.length > 0
                      ? gradeStats.remedial.map((s) => `${s.name} (${s.score})`).join(' · ')
                      : 'Seluruh siswa telah mencapai KKTP.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      <FloatingToast
        successMsg={saveSuccess}
        errorMsg={errorMsg}
        onDismissSuccess={() => setSaveSuccess(null)}
        onDismissError={() => setErrorMsg(null)}
      />
    </div>
  );
}
