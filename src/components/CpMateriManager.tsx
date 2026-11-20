import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Download,
  Eye,
  FileDown,
  Maximize2,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getFaseByKelas, MAPEL_LIST } from '../constants/school';
import { getBskapPresets, getRecommendedElementCount } from '../data/bankCpBskap';
import {
  CpMateriBankDoc,
  CpMateriEntry,
  MapelName,
  PaperSize,
  TeacherProfile,
  WorkspaceItemRecord,
} from '../types/portal';
import {
  downloadCpTpAtpPdf,
  downloadCpTpAtpWord,
  printCpTpAtpWithIframe,
} from '../utils/exportCpTpAtp';
import {
  buildLocalTpAtpForEntries,
  extractSubMateriTopics,
} from '../utils/localRpmBuilder';
import { FloatingToast } from './FloatingToast';
import { SimpleGuideStrip } from './SimpleGuideStrip';

export interface RpmPrefillRowMeta {
  elemen: string;
  materiBab: string;
  semester: 'I' | 'II';
  alokasiJp: number;
  tps: string[];
  atps: string[];
}

export interface RpmPrefillPayload {
  mapel: MapelName;
  kelas: number;
  semester: 'Ganjil' | 'Genap';
  tahunAjaran: string;
  elemen: string;
  cpText: string;
  materiList: string[];
  tps?: string[];
  atps?: string[];
  selectedRows?: RpmPrefillRowMeta[];
  targetSection?: 'tp-atp' | 'rpm';
  autoGenerate?: boolean;
}

interface CpMateriManagerProps {
  teacher: TeacherProfile;
  workspaceItems: WorkspaceItemRecord[];
  initialBank?: CpMateriBankDoc | null;
  onSaveToFolder: (record: WorkspaceItemRecord) => Promise<void>;
  onSendToRpmGenerator: (prefill: RpmPrefillPayload) => void;
  onOpenRpmWizard?: () => void;
  simpleMode?: boolean;
}

function buildBankId(teacherId: string, mapel: MapelName, kelas: number): string {
  const safeMapel = mapel.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `cpbank_${teacherId}_${safeMapel}_kls${kelas}`.slice(0, 120);
}

function getSampleEntriesFor(mapel: MapelName, kelas: number): CpMateriEntry[] {
  const ts = Date.now();
  if (mapel === 'PAI BP' && kelas === 1) {
    return [
      {
        id: `cpm_${ts}_1`,
        elemen: 'akhlak',
        cpText:
          'murid memahami akhlak terhadap Allah Swt. dengan menyucikan dan memuji-Nya, serta akhlak terhadap diri sendiri, orang tua, guru, dan sesama melalui pembiasaan perilaku jujur, bertanggung jawab, santun, berterima kasih, kasih sayang, dan hidup bersih',
        materiBab: 'bersuci',
        semester: 'I',
        alokasiJp: 6,
        tps: [
          '1. menjelaskan pengertian bersuci dan pentingnya hidup bersih sebagai wujud akhlak kepada Allah Swt. dan diri sendiri dengan benar',
          '2. mengidentifikasi tata cara bersuci dan menjaga kebersihan badan serta pakaian dalam kehidupan sehari-hari dengan tepat',
          '3. mempraktikkan pembiasaan hidup bersih dan bersuci dalam aktivitas sehari-hari secara mandiri dan bertanggung jawab',
        ],
        atps: [
          '1.1.1 Murid dapat menjelaskan pengertian bersuci dan pentingnya hidup bersih sebagai wujud akhlak kepada Allah Swt. dan diri sendiri dengan benar',
          '1.1.2 Murid dapat mengidentifikasi tata cara bersuci dan menjaga kebersihan badan serta pakaian dalam kehidupan sehari-hari dengan tepat',
          '1.1.3 Murid mampu mempraktikkan pembiasaan hidup bersih dan bersuci dalam aktivitas sehari-hari secara mandiri dan bertanggung jawab',
        ],
      },
      {
        id: `cpm_${ts}_2`,
        elemen: 'Al-Qur’an dan Hadis',
        cpText:
          'Murid memahami huruf hijaiah berharakat, huruf hijaiah bersambung, Surah al-Fatihah, beberapa surah pendek Al-Qur’an, dan hadis tentang kebersihan.',
        materiBab: 'Huruf hijaiah dan huruf hijaiah berharakat',
        semester: 'I',
        alokasiJp: 6,
        tps: [
          '1. melafalkan huruf-huruf hijaiah sesuai dengan makharijul huruf secara tepat',
          '2. mengidentifikasi dan membedakan bentuk huruf hijaiah tunggal berharakat dengan benar',
          '3. mempraktikkan membaca huruf hijaiah berharakat Fathah, Kasrah, dan Dhammah secara lancar dan mandiri',
        ],
        atps: [
          '1.2.1 Murid dapat melafalkan huruf-huruf hijaiah sesuai dengan makharijul huruf secara tepat',
          '1.2.2 Murid dapat mengidentifikasi dan membedakan bentuk huruf hijaiah tunggal berharakat dengan benar',
          '1.2.3 Murid mampu mempraktikkan membaca huruf hijaiah berharakat Fathah, Kasrah, dan Dhammah secara lancar dan mandiri',
        ],
      },
      {
        id: `cpm_${ts}_3`,
        elemen: 'Akidah',
        cpText:
          'Murid memahami rukun iman, iman kepada Allah Swt., beberapa asmaulhusna, dan iman kepada malaikat.',
        materiBab: 'Rukun Iman',
        semester: 'II',
        alokasiJp: 4,
        tps: [
          '1. menjelaskan pengertian dan enam rukun iman secara urut dengan benar',
          '2. mengidentifikasi contoh perilaku beriman kepada Allah Swt. dan ciptaan-Nya dalam kehidupan sehari-hari dengan tepat',
          '3. membiasakan sikap syukur dan percaya kepada Allah Swt. dalam aktivitas sehari-hari secara mandiri dan bertanggung jawab',
        ],
        atps: [
          '1.3.1 Murid dapat menjelaskan pengertian dan enam rukun iman secara urut dengan benar',
          '1.3.2 Murid dapat mengidentifikasi contoh perilaku beriman kepada Allah Swt. dan ciptaan-Nya dalam kehidupan sehari-hari dengan tepat',
          '1.3.3 Murid mampu membiasakan sikap syukur dan percaya kepada Allah Swt. dalam aktivitas sehari-hari secara mandiri dan bertanggung jawab',
        ],
      },
    ];
  }

  if (mapel === 'PAI BP' && kelas === 4) {
    return [
      {
        id: `cpm_${ts}_1`,
        elemen: 'Akidah',
        cpText:
          'Murid memahami sifat-sifat Allah Swt., beberapa asmaulhusna, iman kepada kitab-kitab Allah Swt., dan rasul-rasul Allah Swt.',
        materiBab:
          "Teladan Mulia Asmaul Husna (Al-Malik, Al-Aziz, Al-Quddus, As-Salam, Al-Mu'min)",
        semester: 'I',
        alokasiJp: 6,
        tps: [
          "1. menjelaskan arti lima Asmaul Husna (Al-Malik, Al-Aziz, Al-Quddus, As-Salam, dan Al-Mu'min) dengan benar",
          '2. mengidentifikasi contoh perilaku nyata di sekolah dan rumah sebagai cerminan meneladani kelima Asmaul Husna tersebut dengan tepat',
          '3. mempraktikkan sikap mulia sesuai keteladanan Asmaul Husna dalam aktivitas sehari-hari secara mandiri dan bertanggung jawab',
        ],
        atps: [
          "4.1.1 Murid dapat menjelaskan arti lima Asmaul Husna (Al-Malik, Al-Aziz, Al-Quddus, As-Salam, dan Al-Mu'min) dengan benar",
          '4.1.2 Murid dapat mengidentifikasi contoh perilaku nyata di sekolah dan rumah sebagai cerminan meneladani kelima Asmaul Husna tersebut dengan tepat',
          '4.1.3 Murid mampu mempraktikkan sikap mulia sesuai keteladanan Asmaul Husna dalam aktivitas sehari-hari secara mandiri dan bertanggung jawab',
        ],
      },
      {
        id: `cpm_${ts}_2`,
        elemen: 'Al-Qur’an dan Hadis',
        cpText:
          'Murid memahami beberapa surah pendek, ayat Al-Qur’an, dan hadis tentang kewajiban salat dan menjaga hubungan baik dengan sesama.',
        materiBab: 'Mengaji dan Mengkaji Q.S. Al-Hujurat/49:13',
        semester: 'I',
        alokasiJp: 6,
        tps: [
          '1. menjelaskan pesan pokok keragaman dan saling menghargai sesuai Q.S. Al-Hujurat ayat 13 dengan benar',
          '2. mengidentifikasi hukum bacaan tajwid pada Q.S. Al-Hujurat ayat 13 dengan tepat',
          '3. mempraktikkan membaca Q.S. Al-Hujurat ayat 13 secara tartil dan mandiri',
        ],
        atps: [
          '4.2.1 Murid dapat menjelaskan pesan pokok keragaman dan saling menghargai sesuai Q.S. Al-Hujurat ayat 13 dengan benar',
          '4.2.2 Murid dapat mengidentifikasi hukum bacaan tajwid pada Q.S. Al-Hujurat ayat 13 dengan tepat',
          '4.2.3 Murid mampu mempraktikkan membaca Q.S. Al-Hujurat ayat 13 secara tartil dan mandiri',
        ],
      },
    ];
  }

  return [
    {
      id: `cpm_${ts}_1`,
      elemen: `Elemen Utama ${mapel}`,
      cpText: `Murid memahami konsep inti ${mapel} pada ${getFaseByKelas(kelas)} Kelas ${kelas} dan mampu menerapkannya dalam konteks kehidupan sehari-hari.`,
      materiBab: `Materi Pokok ${mapel} Kelas ${kelas} Semester I`,
      semester: 'I',
      alokasiJp: 4,
      tps: [
        `1. menjelaskan pengertian dan konsep dasar ${mapel} kelas ${kelas} dengan benar`,
        `2. mengidentifikasi contoh dan penerapan materi ${mapel} dalam kehidupan sehari-hari dengan tepat`,
        `3. mempraktikkan pemahaman ${mapel} melalui aktivitas pemecahan masalah secara mandiri dan bertanggung jawab`,
      ],
      atps: [
        `${kelas}.1.1 Murid dapat menjelaskan pengertian dan konsep dasar ${mapel} kelas ${kelas} dengan benar`,
        `${kelas}.1.2 Murid dapat mengidentifikasi contoh dan penerapan materi ${mapel} dalam kehidupan sehari-hari dengan tepat`,
        `${kelas}.1.3 Murid mampu mempraktikkan pemahaman ${mapel} melalui aktivitas pemecahan masalah secara mandiri dan bertanggung jawab`,
      ],
    },
    {
      id: `cpm_${ts}_2`,
      elemen: `Elemen Lanjutan ${mapel}`,
      cpText: `Murid menganalisis permasalahan sederhana terkait ${mapel} dan menyajikan hasil pengamatan atau karya secara mandiri dan kolaboratif.`,
      materiBab: `Penerapan ${mapel} Kelas ${kelas} Semester II`,
      semester: 'II',
      alokasiJp: 4,
      tps: [],
      atps: [],
    },
  ];
}

export function CpMateriManager({
  teacher,
  workspaceItems,
  initialBank,
  onSaveToFolder,
  onSendToRpmGenerator,
  onOpenRpmWizard,
  simpleMode = true,
}: CpMateriManagerProps) {
  const [kelas, setKelas] = useState<number>(initialBank?.kelas || 1);
  const [mapel, setMapel] = useState<MapelName>(initialBank?.mapel || 'PAI BP');
  const [tahunAjaran, setTahunAjaran] = useState<string>(initialBank?.tahunAjaran || '2026/2027');
  const [paperSize, setPaperSize] = useState<PaperSize>('F4');
  const [tpPerSubMateri, setTpPerSubMateri] = useState<1 | 2 | 3>(2);
  const [entries, setEntries] = useState<CpMateriEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [generatingTpAtp, setGeneratingTpAtp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<'fit' | 0.8 | 1>('fit');
  const [fitScale, setFitScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const previewSheetRef = useRef<HTMLDivElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!showDocPreview) return;
    const updateScale = () => {
      const container = previewContainerRef.current;
      const sheet = previewSheetRef.current;
      if (!container || !sheet) return;
      const available = Math.max(280, container.clientWidth - 24);
      const natural = Math.max(820, sheet.scrollWidth || 820);
      setFitScale(Math.min(1, Math.max(0.45, available / natural)));
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (previewContainerRef.current) ro.observe(previewContainerRef.current);
    return () => ro.disconnect();
  }, [showDocPreview, entries.length]);

  useEffect(() => {
    if (initialBank) {
      setKelas(initialBank.kelas);
      setMapel(initialBank.mapel);
      if (initialBank.tahunAjaran) {
        setTahunAjaran(initialBank.tahunAjaran);
      }
    }
  }, [initialBank]);

  const fase = getFaseByKelas(kelas);

  // Map saved CP-Materi banks per class & mapel from workspaceItems
  const savedBanksByClass = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const bankByKey = new Map<string, CpMateriBankDoc>();
    for (const item of workspaceItems) {
      if (item.itemType === 'cp-materi') {
        const bank = item.payload as CpMateriBankDoc;
        if (bank && Array.isArray(bank.entries)) {
          bankByKey.set(buildBankId(teacher.id, bank.mapel, bank.kelas), bank);
          if (bank.mapel === mapel) {
            counts[bank.kelas] = bank.entries.length;
          }
        }
      }
    }
    return { counts, bankByKey };
  }, [mapel, teacher.id, workspaceItems]);

  // Load entries whenever kelas or mapel changes
  useEffect(() => {
    const id = buildBankId(teacher.id, mapel, kelas);
    const existing = savedBanksByClass.bankByKey.get(id);
    if (existing) {
      setEntries(existing.entries);
      setTahunAjaran(existing.tahunAjaran || '2026/2027');
      setSelectedIds(existing.entries.map((e) => e.id));
    } else {
      const initialRow: CpMateriEntry = {
        id: `cpm_${Date.now()}_1`,
        elemen: '',
        cpText: '',
        materiBab: '',
        semester: 'I',
        alokasiJp: 4,
        tps: [],
        atps: [],
      };
      setEntries([initialRow]);
      setSelectedIds([initialRow.id]);
    }
    setErrorMsg(null);
  }, [kelas, mapel, savedBanksByClass.bankByKey, teacher.id]);

  const currentBank: CpMateriBankDoc = {
    id: buildBankId(teacher.id, mapel, kelas),
    teacherId: teacher.id,
    kelas,
    fase,
    mapel,
    tahunAjaran,
    entries,
    updatedAt: new Date().toISOString(),
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const recommendedElemCount = getRecommendedElementCount(mapel);

  const handleAddRow = () => {
    const newRow: CpMateriEntry = {
      id: `cpm_${Date.now()}_${entries.length + 1}`,
      elemen: '',
      cpText: '',
      materiBab: '',
      semester: 'I',
      alokasiJp: 4,
      tps: [],
      atps: [],
    };
    setEntries((prev) => [...prev, newRow]);
    setSelectedIds((prev) => [...prev, newRow.id]);
  };

  const handlePrepareMultiElementSlots = (targetCount: number) => {
    setErrorMsg(null);
    const ts = Date.now();
    const presets = getBskapPresets(mapel, kelas);
    const nextRows: CpMateriEntry[] = Array.from({ length: targetCount }, (_, idx) => {
      const existing = entries[idx];
      if (existing && (existing.elemen.trim() || existing.cpText.trim() || existing.materiBab.trim())) {
        return existing;
      }
      const preset = presets[idx];
      return {
        id: `cpm_${ts}_${idx + 1}`,
        elemen: preset?.elemen || `Elemen ${idx + 1}`,
        cpText: preset?.cpText || '',
        materiBab: preset?.materiBab || '',
        semester: idx >= Math.ceil(targetCount / 2) ? 'II' : 'I',
        alokasiJp: preset?.alokasiJp || 6,
        tps: [],
        atps: [],
      };
    });
    setEntries(nextRows);
    setSelectedIds(nextRows.map((r) => r.id));
    showToast(`Siap ${nextRows.length} baris elemen untuk ${mapel} Kelas ${kelas}.`);
  };

  const persistBankEntries = async (nextEntries: CpMateriEntry[], baseMsg: string) => {
    const nonEmpty = nextEntries.filter(
      (e) => e.cpText.trim() || e.materiBab.trim() || e.elemen.trim()
    );
    if (nonEmpty.length === 0) {
      showToast(baseMsg);
      return;
    }
    try {
      const payload: CpMateriBankDoc = {
        ...currentBank,
        entries: nonEmpty,
        updatedAt: new Date().toISOString(),
      };
      await onSaveToFolder({
        id: payload.id,
        teacherId: teacher.id,
        itemType: 'cp-materi',
        title: `Bank CP & Materi ${mapel} Kelas ${kelas} (${nonEmpty.length} BAB/Elemen)`,
        mapel,
        kelas,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload,
      });
      showToast(`${baseMsg} Otomatis tersimpan ke Folder Saya.`);
    } catch {
      showToast(`${baseMsg} Tersimpan sementara di editor.`);
    }
  };

  const handleLoadSample = () => {
    const sample = getSampleEntriesFor(mapel, kelas);
    setEntries(sample);
    setSelectedIds(sample.map((s) => s.id));
    void persistBankEntries(
      sample,
      `Contoh referensi CP, TP, ATP & Materi (${mapel} Kelas ${kelas}) dimuat.`
    );
  };

  const handleLoadBskapBank = () => {
    const presets = getBskapPresets(mapel, kelas);
    const ts = Date.now();
    const mapped: CpMateriEntry[] = presets.map((p, idx) => ({
      id: `bskap_${ts}_${idx + 1}`,
      elemen: p.elemen,
      cpText: p.cpText,
      materiBab: p.materiBab,
      semester: p.semester,
      alokasiJp: p.alokasiJp,
      tps: [],
      atps: [],
    }));
    const enriched = buildLocalTpAtpForEntries(mapel, kelas, mapped, tpPerSubMateri);
    setEntries(enriched);
    setSelectedIds(enriched.map((e) => e.id));
    void persistBankEntries(
      enriched,
      `Bank CP BSKAP ${mapel} Kelas ${kelas} (${enriched.length} elemen · ${tpPerSubMateri} TP/sub-materi) berhasil disusun.`
    );
  };

  const handleGenerateLocalTpAtp = () => {
    setErrorMsg(null);
    const valid = entries.filter((e) => e.cpText.trim() || e.materiBab.trim());
    if (valid.length === 0) {
      setErrorMsg('Isi kolom Capaian Pembelajaran (CP) atau Materi minimal pada 1 baris.');
      return;
    }
    const nextEntries = buildLocalTpAtpForEntries(mapel, kelas, entries, tpPerSubMateri);
    setEntries(nextEntries);
    void persistBankEntries(
      nextEntries,
      `TP & ATP rinci (${tpPerSubMateri} TP/sub-materi) untuk ${nextEntries.length} elemen berhasil disusun (tanpa kuota).`
    );
  };

  const handleGenerateSingleRowLocal = (rowIdx: number) => {
    setErrorMsg(null);
    const target = entries[rowIdx];
    if (!target || (!target.cpText.trim() && !target.materiBab.trim())) {
      setErrorMsg(`Isi Materi atau CP pada Baris ${rowIdx + 1} terlebih dahulu.`);
      return;
    }
    const rebuilt = buildLocalTpAtpForEntries(mapel, kelas, entries, tpPerSubMateri);
    const nextEntries = entries.map((r, i) => (i === rowIdx ? rebuilt[i] : r));
    setEntries(nextEntries);
    void persistBankEntries(
      nextEntries,
      `TP & ATP Baris ${rowIdx + 1} (${tpPerSubMateri} TP/sub-materi) berhasil disusun otomatis.`
    );
  };

  const handleSaveBank = async () => {
    const nonEmpty = entries.filter((e) => e.cpText.trim() || e.materiBab.trim() || e.elemen.trim());
    if (nonEmpty.length === 0) {
      setErrorMsg('Isi minimal 1 baris CP dan Materi sebelum menyimpan.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: CpMateriBankDoc = {
        ...currentBank,
        entries: nonEmpty,
      };
      await onSaveToFolder({
        id: payload.id,
        teacherId: teacher.id,
        itemType: 'cp-materi',
        title: `Bank CP & Materi ${mapel} Kelas ${kelas} (${nonEmpty.length} BAB/Elemen)`,
        mapel,
        kelas,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload,
      });
      showToast(`Bank CP & Materi ${mapel} Kelas ${kelas} berhasil disimpan ke Folder Saya.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan Bank CP & Materi.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTpAtp = async () => {
    setErrorMsg(null);
    const valid = entries.filter((e) => e.cpText.trim() && e.materiBab.trim());
    if (valid.length === 0) {
      setErrorMsg('Isi kolom Capaian Pembelajaran (CP) dan Materi minimal pada 1 baris.');
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const nextEntries = buildLocalTpAtpForEntries(mapel, kelas, entries, tpPerSubMateri);
      setEntries(nextEntries);
      await persistBankEntries(
        nextEntries,
        `Mode Offline — TP & ATP (${tpPerSubMateri} TP/sub-materi) untuk ${nextEntries.length} elemen disusun otomatis menggunakan Mesin Lokal.`
      );
      return;
    }

    setGeneratingTpAtp(true);
    try {
      const res = await fetch('/api/ai/generate-cp-tp-atp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapel,
          kelas,
          fase,
          tpPerSubMateri,
          entries: valid.map((e) => ({
            id: e.id,
            elemen: e.elemen,
            cpText: e.cpText,
            materiBab: e.materiBab,
            semester: e.semester,
          })),
        }),
      });
      const data = (await res.json()) as {
        results?: Array<{ id: string; tps: string[]; atps: string[] }>;
        error?: string;
      };
      if (!res.ok || !data.results) {
        throw new Error(data.error || 'Gagal menyusun TP & ATP.');
      }
      const byId = new Map(data.results.map((r) => [r.id, r]));
      const nextEntries = entries.map((row) => {
        const gen = byId.get(row.id);
        return gen ? { ...row, tps: gen.tps, atps: gen.atps } : row;
      });
      setEntries(nextEntries);
      await persistBankEntries(
        nextEntries,
        `TP & ATP (${tpPerSubMateri} TP/sub-materi) untuk ${valid.length} elemen berhasil dibuat otomatis.`
      );
    } catch {
      // Seamless Zero-Quota Auto-Fallback to Local Builder
      const nextEntries = buildLocalTpAtpForEntries(mapel, kelas, entries, tpPerSubMateri);
      setEntries(nextEntries);
      const reason =
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Mode Offline'
          : 'Kuota AI sedang penuh';
      await persistBankEntries(
        nextEntries,
        `${reason} — sistem otomatis menyusun TP & ATP (${tpPerSubMateri} TP/sub-materi) menggunakan Mesin Lokal (Tanpa Kuota).`
      );
    } finally {
      setGeneratingTpAtp(false);
    }
  };

  const handleSendRowToRpm = (row: CpMateriEntry, targetSection: 'tp-atp' | 'rpm' = 'tp-atp') => {
    if (!row.cpText.trim() || !row.materiBab.trim()) {
      setErrorMsg('Lengkapi Capaian Pembelajaran (CP) dan Materi pada baris ini terlebih dahulu.');
      return;
    }
    onSendToRpmGenerator({
      mapel,
      kelas,
      semester: row.semester === 'II' ? 'Genap' : 'Ganjil',
      tahunAjaran,
      elemen: row.elemen,
      cpText: row.cpText.trim(),
      materiList: [row.materiBab.trim()],
      tps: row.tps.map((t) => t.trim()).filter(Boolean),
      atps: row.atps.map((a) => a.trim()).filter(Boolean),
      selectedRows: [
        {
          elemen: row.elemen.trim(),
          materiBab: row.materiBab.trim(),
          semester: row.semester,
          alokasiJp: row.alokasiJp || 4,
          tps: row.tps.map((t) => t.trim()).filter(Boolean),
          atps: row.atps.map((a) => a.trim()).filter(Boolean),
        },
      ],
      targetSection,
    });
  };

  const handleSendSelectedToRpm = (targetSection: 'tp-atp' | 'rpm' = 'tp-atp') => {
    const picked = entries.filter(
      (e) => selectedIds.includes(e.id) && e.cpText.trim() && e.materiBab.trim()
    );
    const targetRows =
      picked.length > 0
        ? picked
        : entries.filter((e) => e.cpText.trim() && e.materiBab.trim());
    if (targetRows.length === 0) {
      setErrorMsg('Pilih atau isi minimal 1 baris CP dan Materi untuk dikirim ke TP & ATP / RPM.');
      return;
    }
    const combinedCp = Array.from(new Set(targetRows.map((r) => r.cpText.trim()))).join('\n');
    const combinedElemen = Array.from(
      new Set(targetRows.map((r) => r.elemen.trim()).filter(Boolean))
    ).join(', ');
    const firstSem = targetRows[0].semester === 'II' ? 'Genap' : 'Ganjil';
    const collectedTps = targetRows.flatMap((r) => r.tps.map((t) => t.trim()).filter(Boolean));
    const collectedAtps = targetRows.flatMap((r) => r.atps.map((a) => a.trim()).filter(Boolean));

    onSendToRpmGenerator({
      mapel,
      kelas,
      semester: firstSem,
      tahunAjaran,
      elemen: combinedElemen,
      cpText: combinedCp,
      materiList: targetRows.map((r) => r.materiBab.trim()),
      tps: collectedTps,
      atps: collectedAtps,
      selectedRows: targetRows.map((r) => ({
        elemen: r.elemen.trim(),
        materiBab: r.materiBab.trim(),
        semester: r.semester,
        alokasiJp: r.alokasiJp || 4,
        tps: r.tps.map((t) => t.trim()).filter(Boolean),
        atps: r.atps.map((a) => a.trim()).filter(Boolean),
      })),
      targetSection,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-teal-700">
            Halaman Khusus Guru · Bank CP &amp; Materi Seluruh Kelas (1–6)
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-teal-600" />
            Input CP, Materi, TP &amp; ATP Semua Kelas
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Kelola Capaian Pembelajaran (CP) dan Materi/BAB per Elemen untuk Kelas 1 sampai Kelas 6, susun tabel CP-TP-ATP siap cetak, simpan ke Folder Saya, atau kirim ke menu TP &amp; ATP dan Generator RPM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenRpmWizard && (
            <button
              type="button"
              onClick={onOpenRpmWizard}
              className="touch-target px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors"
            >
              Buka Menu TP &amp; ATP
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSendSelectedToRpm('tp-atp')}
            className="touch-target px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <span>
              {simpleMode
                ? 'Lanjut Buat TP-ATP, PROTA & RPM'
                : 'Lanjut ke TP & ATP / Generate 6 Perangkat'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {simpleMode && (
        <SimpleGuideStrip
          heading="3 Langkah Mengisi CP, TP & ATP (Bisa 4–5 Elemen Tanpa Kuota)"
          steps={[
            {
              title: '1. Pilih Kelas & Mapel',
              desc: `Klik Kelas (1–6) lalu pilih Mata Pelajaran. Klik tombol "Bank CP BSKAP (${recommendedElemCount} Elemen)" untuk isi instan.`,
            },
            {
              title: '2. Susun TP & ATP Tanpa Kuota',
              desc: 'Jika mengetik CP sendiri, klik tombol kuning "Susun Cepat Tanpa Kuota AI" untuk menyusun 4–5 elemen sekaligus.',
            },
            {
              title: '3. Simpan / Lanjut ke RPM',
              desc: 'Klik tombol hijau Simpan untuk arsip, atau klik "Lanjut Buat TP-ATP, PROTA & RPM" untuk membuat semua perangkat.',
            },
          ]}
        />
      )}

      <FloatingToast
        successMsg={successMsg}
        errorMsg={errorMsg}
        onDismissSuccess={() => setSuccessMsg(null)}
        onDismissError={() => setErrorMsg(null)}
      />

      {/* Class Switcher (Kelas 1 - 6) & Mapel Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {[1, 2, 3, 4, 5, 6].map((k) => {
              const count = savedBanksByClass.counts[k] || 0;
              const isActive = kelas === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKelas(k)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Kelas {k}</span>
                  {count > 0 && (
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={mapel}
              onChange={(e) => setMapel(e.target.value as MapelName)}
              className="min-h-[40px] px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded-xl bg-white"
            >
              {MAPEL_LIST.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
              {fase}
            </span>

            <input
              type="text"
              value={tahunAjaran}
              onChange={(e) => setTahunAjaran(e.target.value)}
              className="w-28 min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl"
              title="Tahun Pelajaran"
            />

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(['F4', 'A4'] as PaperSize[]).map((ps) => (
                <button
                  key={ps}
                  type="button"
                  onClick={() => setPaperSize(ps)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${
                    paperSize === ps ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {ps}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rincian TP per Sub-Materi Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Rincian TP per Sub-Materi:
            </span>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {([
                { val: 1, label: 'Ringkas (1 TP / Sub-Materi)' },
                { val: 2, label: 'Rinci (2 TP / Sub-Materi)' },
                { val: 3, label: 'Sangat Rinci (3 TP / Sub-Materi)' },
              ] as const).map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setTpPerSubMateri(opt.val)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    tpPerSubMateri === opt.val
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-[11px] text-slate-500">
            Contoh: 3 sub-materi pada mode <strong>{tpPerSubMateri} TP</strong> akan otomatis diurai menjadi{' '}
            <strong>{3 * tpPerSubMateri} TP</strong> berjenjang.
          </span>
        </div>

        {/* Grouped Action Toolbars */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
          {/* Cluster 1: Susun & Kelola Elemen */}
          <div className="xl:col-span-7 bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 space-y-2">
            <div className="text-[11px] font-semibold text-slate-500 px-1">
              1. Susun &amp; Kelola Elemen CP/Materi
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleLoadBskapBank}
                className="touch-target px-3 py-2 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                title="Acuan CP Resmi Terbaru: Keputusan Kepala BSKAP Nomor 046/H/KR/2025 (16 Juli 2025)"
              >
                <BookMarked className="w-4 h-4" />
                Bank CP BSKAP ({recommendedElemCount} Elemen)
              </button>

              <button
                type="button"
                onClick={handleAddRow}
                className="touch-target px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Tambah Elemen
              </button>

              <button
                type="button"
                onClick={() => handlePrepareMultiElementSlots(5)}
                className="touch-target px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                title="Siapkan 5 baris elemen sekaligus"
              >
                <Plus className="w-3.5 h-3.5" />
                Siapkan 5 Baris
              </button>

              <button
                type="button"
                onClick={handleLoadSample}
                className="touch-target px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                title="Muat contoh format resmi CP, TP, ATP sesuai dokumen referensi"
              >
                Contoh Format
              </button>

              <button
                type="button"
                onClick={handleGenerateLocalTpAtp}
                className="touch-target px-3 py-2 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <Zap className="w-4 h-4 text-amber-600" />
                {simpleMode ? `Tanpa Kuota (${entries.length})` : 'Susun Lokal'}
              </button>

              <button
                type="button"
                onClick={handleGenerateTpAtp}
                disabled={generatingTpAtp}
                className="touch-target px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {generatingTpAtp
                  ? 'Menyusun...'
                  : simpleMode
                  ? 'Buat TP & ATP Otomatis'
                  : 'Generate AI'}
              </button>
            </div>
          </div>

          {/* Cluster 2: Simpan & Ekspor */}
          <div className="xl:col-span-5 bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 space-y-2 flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 px-1">
              2. Simpan Arsip &amp; Ekspor Dokumen
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveBank}
                disabled={saving}
                className="touch-target px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan...' : `Simpan Kelas ${kelas}`}
              </button>

              <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => downloadCpTpAtpPdf(currentBank, teacher.name, paperSize)}
                  className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => downloadCpTpAtpWord(currentBank, teacher.name, paperSize)}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Word
                </button>
                <button
                  type="button"
                  onClick={() => printCpTpAtpWithIframe(currentBank, teacher.name, paperSize)}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak
                </button>
                <button
                  type="button"
                  onClick={() => setShowDocPreview((prev) => !prev)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors ${
                    showDocPreview
                      ? 'bg-sky-100 text-sky-900'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showDocPreview ? 'Tutup' : 'Pratinjau'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exact Reference PDF Preview Sheet with Scale Controls */}
      {showDocPreview && (
        <div
          ref={previewContainerRef}
          className="bg-slate-100 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
              <span>
                Pratinjau Tabel CP, TP, ATP ({paperSize}) · Skala:{' '}
                {Math.round((previewZoom === 'fit' ? fitScale : previewZoom) * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
              {(
                [
                  { id: 'fit', label: 'Pas Layar' },
                  { id: 0.8, label: '80%' },
                  { id: 1, label: '100%' },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.id)}
                  type="button"
                  onClick={() => setPreviewZoom(opt.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    previewZoom === opt.id
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div
              ref={previewSheetRef}
              className="bg-white border border-slate-300 shadow-sm mx-auto p-6 sm:p-8 text-black min-w-[820px] origin-top-left transition-transform duration-150"
              style={{
                fontFamily: '"Times New Roman", Times, serif',
                zoom: previewZoom === 'fit' ? fitScale : previewZoom,
              }}
            >
            <div className="text-center font-bold text-[15px] underline mb-4">
              CP, TP, ATP {mapel.toUpperCase()}
            </div>
            <table className="mb-3 font-bold text-[13px] border-collapse">
              <tbody>
                <tr>
                  <td className="pr-4 py-0.5 w-32">Penyusun</td>
                  <td className="py-0.5">: {teacher.name}</td>
                </tr>
                <tr>
                  <td className="pr-4 py-0.5">Kelas/semester</td>
                  <td className="py-0.5">
                    : {kelas} /{' '}
                    {(() => {
                      const sems = Array.from(
                        new Set(entries.map((e) => e.semester).filter(Boolean))
                      );
                      if (sems.length === 1) return sems[0];
                      return 'I dan II';
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="w-full border-collapse border border-black text-[12px] leading-snug">
              <thead>
                <tr className="bg-white">
                  <th className="border border-black px-2 py-2 text-left font-bold w-[10.5%]">
                    ELEMEN
                  </th>
                  <th className="border border-black px-2 py-2 text-left font-bold w-[20%]">
                    CAPAIAN PEMBELAJARAN
                  </th>
                  <th className="border border-black px-2 py-2 text-left font-bold w-[24.5%]">
                    TUJUAN PEMBELAJARAN
                  </th>
                  <th className="border border-black px-2 py-2 text-left font-bold w-[25.5%]">
                    ALUR TUJUAN PEMBELAJARAN
                  </th>
                  <th className="border border-black px-2 py-2 text-left font-bold w-[12%]">
                    MATERI
                  </th>
                  <th className="border border-black px-2 py-2 text-center font-bold w-[7.5%]">
                    Semester
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const cleanTps = (entry.tps || []).map((t) => t.trim()).filter(Boolean);
                  const cleanAtps = (entry.atps || []).map((a) => a.trim()).filter(Boolean);
                  return (
                    <tr key={`prev_${entry.id}`}>
                      <td className="border border-black px-2 py-2 align-top">
                        {entry.elemen.trim() || '-'}
                      </td>
                      <td className="border border-black px-2 py-2 align-top">
                        {entry.cpText.trim()}
                      </td>
                      <td className="border border-black px-2 py-2 align-top space-y-2">
                        {cleanTps.length > 0
                          ? cleanTps.map((tp, i) => <div key={i}>{tp}</div>)
                          : '-'}
                      </td>
                      <td className="border border-black px-2 py-2 align-top space-y-2">
                        {cleanAtps.length > 0
                          ? cleanAtps.map((atp, i) => <div key={i}>{atp}</div>)
                          : '-'}
                      </td>
                      <td className="border border-black px-2 py-2 align-top">
                        {entry.materiBab.trim()}
                      </td>
                      <td className="border border-black px-2 py-2 align-top text-center font-bold">
                        {entry.semester || 'I'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* CP, TP, ATP & Materi Table Editor (Matches Reference Format) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <div className="font-display font-bold text-base text-slate-900">
              CP, TP, ATP {mapel.toUpperCase()} — Kelas {kelas} ({fase}) · {entries.length} Elemen
            </div>
            <div className="text-xs text-slate-500">
              Penyusun: {teacher.name} · Centang baris elemen yang ingin dikirim ke menu TP &amp; ATP atau Generator RPM.
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setSelectedIds(
                selectedIds.length === entries.length ? [] : entries.map((e) => e.id)
              )
            }
            className="text-xs font-semibold text-sky-700 hover:underline self-start sm:self-auto"
          >
            {selectedIds.length === entries.length ? 'Batal Pilih Semua' : 'Pilih Semua Baris'}
          </button>
        </div>

        <div className="space-y-4">
          {entries.map((row, idx) => {
            const isChecked = selectedIds.includes(row.id);
            return (
              <div
                key={row.id}
                className={`border rounded-xl p-4 space-y-3 transition-colors ${
                  isChecked ? 'border-teal-400 bg-teal-50/20' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(row.id)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                    />
                    <span>Baris {idx + 1}</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateSingleRowLocal(idx)}
                      className="px-3 py-1.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                      title="Susun TP & ATP otomatis khusus baris ini berdasarkan Materi & CP (Tanpa Kuota)"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Susun TP &amp; ATP Baris Ini</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendRowToRpm(row)}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <span>Buat 6 Perangkat RPM / TP-ATP</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={entries.length <= 1}
                      onClick={() => {
                        setEntries((prev) => prev.filter((_, i) => i !== idx));
                        setSelectedIds((prev) => prev.filter((x) => x !== row.id));
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-rose-50"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3 space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        ELEMEN
                      </label>
                      <input
                        type="text"
                        value={row.elemen}
                        onChange={(e) =>
                          setEntries((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, elemen: e.target.value } : r))
                          )
                        }
                        placeholder="Mis. Alquran hadits, Akidah, Bilangan..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        MATERI / BAB (Dasar Utama TP)
                      </label>
                      <textarea
                        rows={3}
                        value={row.materiBab}
                        onChange={(e) =>
                          setEntries((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, materiBab: e.target.value } : r
                            )
                          )
                        }
                        placeholder="Pisahkan sub-materi dengan koma/baris baru, mis: Rukun Islam, Tata Cara Wudu, Salat Fardu"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                      />
                      {row.materiBab.trim() && (() => {
                        const detected = extractSubMateriTopics(row.materiBab, row.cpText);
                        return (
                          <div className="mt-1 text-[11px] text-teal-700 leading-snug">
                            {detected.length >= 2
                              ? `Terdeteksi ${detected.length} sub-materi → ${detected.length * tpPerSubMateri} TP (${tpPerSubMateri} TP/sub-materi: ${detected.join(' · ')})`
                              : '1 topik utama → 3 TP berjenjang (Konsep → Pemahaman → Praktik)'}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Semester
                        </label>
                        <select
                          value={row.semester}
                          onChange={(e) =>
                            setEntries((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, semester: e.target.value as 'I' | 'II' }
                                  : r
                              )
                            )
                          }
                          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white font-semibold"
                        >
                          <option value="I">I (Ganjil)</option>
                          <option value="II">II (Genap)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Alokasi JP
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={row.alokasiJp}
                          onChange={(e) =>
                            setEntries((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      alokasiJp: Math.max(1, Number(e.target.value) || 1),
                                    }
                                  : r
                              )
                            )
                          }
                          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl bg-white text-center font-mono tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      CAPAIAN PEMBELAJARAN (CP)
                    </label>
                    <textarea
                      rows={7}
                      value={row.cpText}
                      onChange={(e) =>
                        setEntries((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, cpText: e.target.value } : r))
                        )
                      }
                      placeholder="Ketik atau tempel bunyi Capaian Pembelajaran untuk Elemen/BAB ini..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      TUJUAN PEMBELAJARAN (1 baris = 1 poin)
                    </label>
                    <textarea
                      rows={7}
                      value={row.tps.join('\n')}
                      onChange={(e) =>
                        setEntries((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? { ...r, tps: e.target.value.split('\n') }
                              : r
                          )
                        )
                      }
                      placeholder="1. menjelaskan pengertian ... dengan benar&#10;2. mengidentifikasi tata cara ... dengan tepat&#10;3. mempraktikkan pembiasaan ... secara mandiri dan bertanggung jawab"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      ALUR TUJUAN PEMBELAJARAN (1 baris = 1 poin)
                    </label>
                    <textarea
                      rows={7}
                      value={row.atps.join('\n')}
                      onChange={(e) =>
                        setEntries((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? { ...r, atps: e.target.value.split('\n') }
                              : r
                          )
                        )
                      }
                      placeholder={`${kelas}.1.1 Murid dapat ...\n${kelas}.1.2 Murid dapat ...\n${kelas}.1.3 Murid mampu ...`}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
