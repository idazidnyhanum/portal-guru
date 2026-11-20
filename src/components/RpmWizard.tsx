import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  Eraser,
  Eye,
  FileDown,
  FolderPlus,
  Layers,
  Package,
  PenLine,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getFaseByKelas, MAPEL_LIST, SCHOOL_INFO } from '../constants/school';
import {
  buildDetailedRpmSteps,
  buildLocalLkpd,
  buildLocalRpmSuite,
  buildLocalSumatifWithQuestions,
  buildProtaAndProsemFromTpAtp,
  cleanMeetingTopic,
  focusMeetingTopic,
  formatRpmTpLine,
  getDefaultRpmCrossAndDigital,
  selectDimensiProfilLulusan,
} from '../utils/localRpmBuilder';
import {
  MapelName,
  PaperSize,
  RpmAgendaRow,
  RpmAtpRow,
  RpmDocKind,
  RpmLessonPlan,
  RpmProsemRow,
  RpmProtaRow,
  RpmSuiteDoc,
  RpmTeachingMode,
  RpmTpItem,
  SchoolTeacherSettings,
  SemesterType,
  TeacherProfile,
  WorkspaceItemRecord,
} from '../types/portal';
import {
  downloadAllRpmSeparateZip,
  downloadRpmPdf,
  downloadRpmWord,
  getDocKindLabel,
  getProsemMonths,
  getRpmPlans,
  printRpmWithIframe,
} from '../utils/exportRpm';
import { FloatingToast } from './FloatingToast';
import { RpmPrintPreview } from './RpmPrintPreview';
import { SimpleGuideStrip } from './SimpleGuideStrip';

export type RpmSectionTab = 'tp-atp' | 'prota' | 'prosem' | 'rpm' | 'agenda';

interface RpmWizardProps {
  teacher: TeacherProfile;
  suiteDoc: RpmSuiteDoc;
  onChangeSuiteDoc: (next: RpmSuiteDoc) => void;
  activeSection: RpmSectionTab;
  onChangeSection: (section: RpmSectionTab) => void;
  schoolSettings: SchoolTeacherSettings;
  onSaveSchoolSettings: (next: SchoolTeacherSettings) => Promise<void>;
  onOpenCpMateriBank?: () => void;
  onContinueToAssessment?: () => void;
  onSaveToFolder: (record: WorkspaceItemRecord) => Promise<void>;
  simpleMode?: boolean;
}

const SAMPLE_CP_MATERI: Partial<Record<MapelName, { cp: string; materi: string[] }>> = {
  'PAI BP': {
    cp: 'Murid memahami sifat-sifat Allah Swt., beberapa asmaulhusna, iman kepada kitab-kitab Allah Swt., dan rasul-rasul Allah Swt.',
    materi: [
      "Teladan Mulia Asmaul Husna (Al-Malik, Al-Aziz, Al-Quddus, As-Salam, Al-Mu'min)",
    ],
  },
  IPAS: {
    cp: 'Murid memahami bentuk dan fungsi pancaindra, siklus hidup makhluk hidup, wujud zat dan perubahannya, serta sumber dan bentuk energi dalam kehidupan sehari-hari.',
    materi: [
      'Bagian Tubuh Tumbuhan dan Proses Fotosintesis',
      'Perubahan Wujud Benda di Sekitar Kita',
    ],
  },
  Matematika: {
    cp: 'Murid menunjukkan pemahaman dan intuisi bilangan pada bilangan cacah sampai 10.000, melakukan operasi penjumlahan, pengurangan, perkalian, pembagian, serta mengenal pecahan sederhana.',
    materi: [
      'Pecahan Senilai dan Perbandingan Pecahan Sederhana',
      'Operasi Hitung Bilangan Cacah dalam Soal Cerita',
    ],
  },
  'Bahasa Indonesia': {
    cp: 'Murid mampu memahami ide pokok dan ide pendukung pada teks informatif serta menulis teks narasi dan deskripsi menggunakan kosakata baku dan kalimat efektif.',
    materi: ['Menemukan Ide Pokok dan Kalimat Efektif dalam Teks Bacaan'],
  },
  PKn: {
    cp: 'Murid mengidentifikasi makna sila-sila Pancasila dan menerapkannya dalam kehidupan di lingkungan keluarga, sekolah, dan masyarakat sekitar.',
    materi: ['Penerapan Nilai-Nilai Pancasila dan Gotong Royong di Lingkungan Sekolah'],
  },
};

export function createEmptyRpmLessonPlan(
  cpText: string,
  overrides?: Partial<RpmLessonPlan> & {
    mapel?: MapelName | string;
    kelas?: number;
    totalPertemuan?: number;
    alokasiWaktu?: string;
  }
): RpmLessonPlan {
  const {
    mapel = 'PAI BP',
    kelas = 4,
    totalPertemuan = 1,
    alokasiWaktu,
    ...planOverrides
  } = overrides || {};

  const firstTp = planOverrides.tujuanPembelajaran?.[0];
  const rawTitle = planOverrides.judulPertemuan || '';
  const focusedTitle = focusMeetingTopic(rawTitle, firstTp) || cleanMeetingTopic(rawTitle);
  const displayTopic = focusedTitle || `Materi ${mapel}`;
  const kodeTp = planOverrides.kodeTp || 'TP.1';

  const crossDigital = getDefaultRpmCrossAndDigital(mapel, displayTopic, kelas);
  const dimensi = selectDimensiProfilLulusan(mapel, displayTopic, firstTp);
  const detailedSteps = buildDetailedRpmSteps({
    mapel,
    kelas,
    materiPokok: displayTopic,
    kodeTp,
    tpRumusan: firstTp,
    pertemuanKe: planOverrides.pertemuanKe ?? 1,
    totalPertemuan,
    alokasiWaktu,
  });
  const lkpd = buildLocalLkpd({
    mapel,
    kelas,
    materiPokok: displayTopic,
    tpRumusan: firstTp,
  });
  const asesmenSumatif = buildLocalSumatifWithQuestions({
    mapel,
    materiPokok: displayTopic,
    kodeTp,
    tpRumusan: firstTp,
  });

  const cleanTpList = (planOverrides.tujuanPembelajaran ?? []).map(formatRpmTpLine);

  return {
    pertemuanKe: planOverrides.pertemuanKe ?? 1,
    kodeTp,
    capaianPembelajaran: cpText,
    dimensiProfilLulusan: dimensi,
    lintasDisiplinIlmu: crossDigital.lintasDisiplinIlmu,
    pemanfaatanDigital: crossDigital.pemanfaatanDigital,
    pendekatanModel:
      'Deep Learning (Mindful, Meaningful, Joyful Learning), Problem Based Learning (PBL), permainan edukatif, dan diskusi studi kasus.',
    saranaMedia: focusedTitle
      ? `Buku Siswa ${mapel} Kelas ${kelas}, Kartu Konsep/Media Konkret ${focusedTitle}, Papan Tulis/PID, LKPD.`
      : 'LKPD, papan tulis, spidol warna, kartu belajar, dan proyektor.',
    kegiatanAwal: detailedSteps.kegiatanAwal,
    kegiatanInti: detailedSteps.kegiatanInti,
    kegiatanPenutup: detailedSteps.kegiatanPenutup,
    asesmenAwal: 'Pertanyaan pemantik lisan saat apersepsi untuk mengecek pengetahuan awal murid.',
    asesmenFormatif: 'Observasi keaktifan diskusi kelompok dan penilaian LKPD studi kasus.',
    asesmenSumatif,
    tindakLanjutPengayaan:
      'Murid yang tuntas cepat diberi tantangan membuat contoh penerapan lanjutan.',
    tindakLanjutRemedial:
      'Pendampingan khusus kelompok kecil menggunakan kartu bantu konsep.',
    lkpd,
    rubrikRows: [
      {
        aspek: 'Pemahaman Konsep',
        skor4: 'Menjelaskan konsep dengan sangat tepat dan lengkap beserta contoh nyata.',
        skor3: 'Menjelaskan konsep dengan tepat namun contoh masih terbatas.',
        skor2: 'Menjelaskan sebagian konsep dengan bantuan teman atau guru.',
        skor1: 'Belum mampu menjelaskan konsep inti, perlu bimbingan intensif.',
      },
      {
        aspek: 'Bernalar Kritis (Studi Kasus)',
        skor4: 'Menganalisis masalah secara mendalam dan memberi solusi logis.',
        skor3: 'Menganalisis masalah dan memberi solusi yang sesuai.',
        skor2: 'Solusi masih umum dan kurang mengaitkan konsep materi.',
        skor1: 'Belum mampu mengidentifikasi inti permasalahan pada kasus.',
      },
      {
        aspek: 'Kolaborasi & Komunikasi (Diskusi)',
        skor4: 'Aktif berdiskusi, menghargai pendapat teman, dan membantu kelompok.',
        skor3: 'Aktif berdiskusi dan bekerja sama dalam kelompok.',
        skor2: 'Sesekali berpartisipasi jika diminta teman atau guru.',
        skor1: 'Pasif dalam diskusi kelompok, perlu diarahkan guru.',
      },
    ],
    ...planOverrides,
    judulPertemuan: planOverrides.judulPertemuan !== undefined ? focusedTitle : '',
    tujuanPembelajaran: cleanTpList,
  };
}

export function createInitialRpmSuite(
  teacher: TeacherProfile,
  settings: SchoolTeacherSettings,
  overrides?: {
    mapel?: MapelName;
    kelas?: number;
    semester?: SemesterType;
    tahunAjaran?: string;
    elemen?: string;
    cpText?: string;
    materiList?: string[];
  }
): RpmSuiteDoc {
  const mapel = overrides?.mapel || 'PAI BP';
  const kelas = overrides?.kelas || 4;
  const semester = overrides?.semester || 'Ganjil';
  const tahunAjaran = overrides?.tahunAjaran || '2026/2027';
  const cpText =
    overrides?.cpText ||
    'Murid memahami sifat-sifat Allah Swt., beberapa asmaulhusna, iman kepada kitab-kitab Allah Swt., dan rasul-rasul Allah Swt.';
  const materiList =
    overrides?.materiList && overrides.materiList.length > 0
      ? overrides.materiList
      : ["Teladan Mulia Asmaul Husna (Al-Malik, Al-Aziz, Al-Quddus, As-Salam, Al-Mu'min)"];
  const materiPokok = materiList.join('; ');
  const firstPlan = createEmptyRpmLessonPlan(cpText, {
    mapel,
    kelas,
    pertemuanKe: 1,
    kodeTp: 'TP.1',
    judulPertemuan: materiList[0] || materiPokok,
  });

  return {
    id: `rpm_${Date.now()}`,
    docKind: 'suite',
    teachingMode: 'per-tp',
    title: `Perangkat RPM ${mapel} Kelas ${kelas} (${materiPokok.slice(0, 60)})`,
    teacherId: teacher.id,
    teacherName: teacher.name,
    identity: {
      namaPenyusun: teacher.name,
      nipPenyusun: settings.teacherNips[teacher.id] || teacher.nip || '',
      instansi: settings.namaSekolah || SCHOOL_INFO.namaSekolah,
      kepalaSekolah: settings.kepalaSekolah || '',
      nipKepalaSekolah: settings.nipKepalaSekolah || '',
      kotaTanggal: 'Lendang Telaga, ........................ 2026',
      tahunAjaran,
      semester,
      kelas,
      fase: getFaseByKelas(kelas),
      mapel,
      elemen: overrides?.elemen,
      materiPokok,
      materiList,
      cpText,
      alokasiWaktu: '2 x 35 Menit (Fleksibel sesuai ketercapaian)',
      paperSize: 'F4',
    },
    tps: [],
    atps: [],
    protas: [],
    prosems: [],
    rpm: firstPlan,
    rpmList: [firstPlan],
    agendaHarian: [],
    updatedAt: new Date().toISOString(),
  };
}

const SECTION_META: Record<
  RpmSectionTab,
  { badge: string; title: string; subtitle: string }
> = {
  'tp-atp': {
    badge: 'Perangkat 1 & 2 (1 Lembar)',
    title: 'Tujuan Pembelajaran (TP) & Alur Tujuan Pembelajaran (ATP)',
    subtitle:
      'TP dan kolom ATP tersusun bersebelahan dalam satu lembar siap cetak/simpan sebagai File Word (.doc) atau PDF (.pdf).',
  },
  prota: {
    badge: 'Perangkat 3',
    title: 'Program Tahunan (PROTA)',
    subtitle:
      'Susun distribusi unit materi dan alokasi Jam Pelajaran (JP) selama 1 Tahun Pelajaran (Ganjil & Genap).',
  },
  prosem: {
    badge: 'Perangkat 4',
    title: 'Program Semester (PROSEM) — 5 Minggu / Bulan',
    subtitle:
      'Distribusi minggu pembelajaran per bulan (Minggu 1–5). PROSEM dibiarkan kosong secara default; klik sel hanya jika ingin menandai jadwal.',
  },
  rpm: {
    badge: 'Perangkat 5',
    title: 'Rencana Pembelajaran Mendalam (RPM) + LKPD + Rubrik',
    subtitle:
      'Mendukung 1 TP untuk 1 Kali Pertemuan (atau gabungan) lengkap dengan langkah Mindful, Meaningful, Joyful Learning, LKPD, dan Rubrik 4 Skala.',
  },
  agenda: {
    badge: 'Perangkat 6',
    title: 'Agenda Harian Mengajar Guru',
    subtitle:
      'Jurnal pelaksanaan pembelajaran harian per pertemuan yang terhubung dengan TP dan RPM.',
  },
};

export function RpmWizard({
  teacher,
  suiteDoc,
  onChangeSuiteDoc,
  activeSection,
  onChangeSection,
  schoolSettings,
  onSaveSchoolSettings,
  onOpenCpMateriBank,
  onContinueToAssessment,
  onSaveToFolder,
  simpleMode = true,
}: RpmWizardProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [setupExpanded, setSetupExpanded] = useState<boolean>(
    () => (suiteDoc.tps?.length || 0) === 0
  );
  const [tpPerSubMateri, setTpPerSubMateri] = useState<1 | 2 | 3>(2);
  const [activeMeetingIdx, setActiveMeetingIdx] = useState<number>(0);
  const [showMergeTpDrawer, setShowMergeTpDrawer] = useState<boolean>(false);
  const [selectedMergeTpIds, setSelectedMergeTpIds] = useState<string[]>([]);
  const [openRpmSections, setOpenRpmSections] = useState<Record<'b' | 'c' | 'd' | 'lampiran', boolean>>(() => ({
    b: true,
    c: !simpleMode,
    d: !simpleMode,
    lampiran: !simpleMode,
  }));

  const toggleRpmAccordion = (key: 'b' | 'c' | 'd' | 'lampiran') => {
    setOpenRpmSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [generating, setGenerating] = useState(false);
  const [savingKind, setSavingKind] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [protaManualEdited, setProtaManualEdited] = useState(false);
  const [prosemManualEdited, setProsemManualEdited] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const identity = suiteDoc.identity;
  const tps = Array.isArray(suiteDoc.tps) ? suiteDoc.tps : [];
  const atps = Array.isArray(suiteDoc.atps) ? suiteDoc.atps : [];
  const protas = Array.isArray(suiteDoc.protas) ? suiteDoc.protas : [];
  const prosems = Array.isArray(suiteDoc.prosems) ? suiteDoc.prosems : [];
  const agendaHarian = Array.isArray(suiteDoc.agendaHarian) ? suiteDoc.agendaHarian : [];
  const rpmList = getRpmPlans(suiteDoc);
  const safeMeetingIdx = Math.min(activeMeetingIdx, Math.max(0, rpmList.length - 1));
  const currentRpm = rpmList[safeMeetingIdx] || createEmptyRpmLessonPlan(identity.cpText);
  const teachingMode: RpmTeachingMode = suiteDoc.teachingMode || 'per-tp';

  const months = getProsemMonths(identity.semester);
  const materiList =
    Array.isArray(identity.materiList) && identity.materiList.length > 0
      ? identity.materiList
      : [identity.materiPokok || ''];
  const cleanMateri = materiList.map((m) => m.trim()).filter(Boolean);
  const materiPokokSummary = cleanMateri.join('; ') || `Materi ${identity.mapel}`;

  useEffect(() => {
    setProtaManualEdited(false);
    setProsemManualEdited(false);
  }, [suiteDoc.id]);

  // Auto-fill PROTA and PROSEM automatically whenever TP/ATP are populated and PROTA/PROSEM are still empty
  useEffect(() => {
    const hasTpOrAtp =
      tps.some((t) => t.rumusan.trim() || t.materiTerkait.trim()) ||
      atps.some((a) => a.tujuanPembelajaran.trim() || a.materiPokok.trim());
    if (!hasTpOrAtp) return;

    const needProta = !protaManualEdited && protas.length === 0;
    const needProsem = !prosemManualEdited && prosems.length === 0;
    if (!needProta && !needProsem) return;

    const synced = buildProtaAndProsemFromTpAtp({
      tps,
      atps,
      kelas: identity.kelas,
      defaultSemester: identity.semester,
      materiPokokFallback: materiPokokSummary,
      existingProsems: prosems,
    });

    onChangeSuiteDoc({
      ...suiteDoc,
      protas: needProta ? synced.protas : protas,
      prosems: needProsem ? synced.prosems : prosems,
      updatedAt: new Date().toISOString(),
    });
  }, [
    atps,
    identity.kelas,
    identity.semester,
    materiPokokSummary,
    onChangeSuiteDoc,
    prosemManualEdited,
    prosems,
    protaManualEdited,
    protas,
    suiteDoc,
    tps,
  ]);

  useEffect(() => {
    if (activeMeetingIdx >= rpmList.length && rpmList.length > 0) {
      setActiveMeetingIdx(rpmList.length - 1);
    }
  }, [activeMeetingIdx, rpmList.length]);

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const updateTpAtpAndSync = (patch: { tps?: RpmTpItem[]; atps?: RpmAtpRow[] }) => {
    const nextTps = patch.tps !== undefined ? patch.tps : tps;
    const nextAtps = patch.atps !== undefined ? patch.atps : atps;
    const hasTpOrAtp =
      nextTps.some((t) => t.rumusan.trim() || t.materiTerkait.trim()) ||
      nextAtps.some((a) => a.tujuanPembelajaran.trim() || a.materiPokok.trim());

    if (!hasTpOrAtp) {
      onChangeSuiteDoc({
        ...suiteDoc,
        tps: nextTps,
        atps: nextAtps,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const synced = buildProtaAndProsemFromTpAtp({
      tps: nextTps,
      atps: nextAtps,
      kelas: identity.kelas,
      defaultSemester: identity.semester,
      materiPokokFallback: materiPokokSummary,
      existingProsems: prosems,
    });

    onChangeSuiteDoc({
      ...suiteDoc,
      tps: nextTps,
      atps: nextAtps,
      protas: !protaManualEdited ? synced.protas : protas,
      prosems: !prosemManualEdited ? synced.prosems : prosems,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateIdentity = (patch: Partial<RpmSuiteDoc['identity']>) => {
    const nextIdentity = {
      ...identity,
      ...patch,
    };
    if (patch.kelas !== undefined) {
      nextIdentity.fase = getFaseByKelas(patch.kelas);
    }
    if (patch.materiList) {
      nextIdentity.materiPokok =
        patch.materiList
          .map((m) => m.trim())
          .filter(Boolean)
          .join('; ') || `Materi ${nextIdentity.mapel}`;
    }

    let nextRpmList = rpmList;
    if (patch.mapel !== undefined || patch.kelas !== undefined) {
      nextRpmList = rpmList.map((plan) => {
        const autoFilled = getDefaultRpmCrossAndDigital(
          nextIdentity.mapel,
          plan.judulPertemuan || nextIdentity.materiPokok,
          nextIdentity.kelas
        );
        return {
          ...plan,
          lintasDisiplinIlmu: autoFilled.lintasDisiplinIlmu,
          pemanfaatanDigital: autoFilled.pemanfaatanDigital,
        };
      });
    }

    onChangeSuiteDoc({
      ...suiteDoc,
      identity: nextIdentity,
      rpm: nextRpmList[0] || suiteDoc.rpm,
      rpmList: nextRpmList,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateRpmList = (nextList: RpmLessonPlan[]) => {
    const safeList =
      nextList.length > 0 ? nextList : [createEmptyRpmLessonPlan(identity.cpText)];
    onChangeSuiteDoc({
      ...suiteDoc,
      rpmList: safeList,
      rpm: safeList[0],
      updatedAt: new Date().toISOString(),
    });
  };

  const updateActiveRpm = (updater: (prev: RpmLessonPlan) => RpmLessonPlan) => {
    const updated = rpmList.map((plan, idx) => (idx === safeMeetingIdx ? updater(plan) : plan));
    updateRpmList(updated);
  };

  const handleSaveIdentityDefaults = async () => {
    setSavingSettings(true);
    setErrorMsg(null);
    try {
      await onSaveSchoolSettings({
        ...schoolSettings,
        namaSekolah: identity.instansi.trim() || SCHOOL_INFO.namaSekolah,
        kepalaSekolah: identity.kepalaSekolah.trim(),
        nipKepalaSekolah: identity.nipKepalaSekolah.trim(),
        teacherNips: {
          ...schoolSettings.teacherNips,
          [teacher.id]: identity.nipPenyusun.trim(),
        },
      });
      showToast('Data Kepala Sekolah & NIP berhasil disimpan sebagai pengaturan sekolah.');
    } catch {
      setErrorMsg('Gagal menyimpan pengaturan Kepala Sekolah & NIP.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLoadSample = () => {
    const sample = SAMPLE_CP_MATERI[identity.mapel];
    if (sample) {
      updateIdentity({
        cpText: sample.cp,
        materiList: sample.materi,
        materiPokok: sample.materi.join('; '),
      });
    } else {
      const mText = `Konsep Dasar dan Penerapan ${identity.mapel} Kelas ${identity.kelas}`;
      updateIdentity({
        cpText: `Murid memahami konsep pokok ${identity.mapel} pada ${identity.fase} Kelas ${identity.kelas} serta menerapkannya secara bermakna dalam kehidupan sehari-hari.`,
        materiList: [mText],
        materiPokok: mText,
      });
    }
    showToast(`Contoh CP & Materi (${identity.mapel}) berhasil dimuat.`);
  };

  const autoPersistGeneratedSuite = async (
    nextSuite: RpmSuiteDoc,
    kind: RpmDocKind,
    toastBase: string
  ) => {
    try {
      const shortMateri = materiPokokSummary.slice(0, 55);
      const recordId = kind === 'suite' ? nextSuite.id : `${nextSuite.id}_${kind}`;
      const recordTitle = `${getDocKindLabel(kind)} · ${nextSuite.identity.mapel} Kls ${nextSuite.identity.kelas} (${shortMateri})`;
      const payloadDoc: RpmSuiteDoc = {
        ...nextSuite,
        id: recordId,
        docKind: kind,
        title: recordTitle,
        updatedAt: new Date().toISOString(),
      };
      await onSaveToFolder({
        id: recordId,
        teacherId: teacher.id,
        itemType: 'rpm',
        title: recordTitle,
        mapel: nextSuite.identity.mapel,
        kelas: nextSuite.identity.kelas,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload: payloadDoc,
      });
      showToast(`${toastBase} Otomatis tersimpan ke Folder Saya.`);
    } catch {
      showToast(toastBase);
    }
  };

  const handleGenerateAll = async () => {
    setErrorMsg(null);
    if (!identity.cpText.trim() || cleanMateri.length === 0) {
      setErrorMsg(
        'Mohon isi Capaian Pembelajaran (CP) dan minimal 1 Materi Pembelajaran terlebih dahulu.'
      );
      setSetupExpanded(true);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const built = buildLocalRpmSuite({
        cpText: identity.cpText.trim(),
        materiList: cleanMateri,
        mapel: identity.mapel,
        kelas: identity.kelas,
        semester: identity.semester,
        alokasiWaktu: identity.alokasiWaktu,
        teachingMode,
        tpPerSubMateri,
      });
      setProtaManualEdited(false);
      setProsemManualEdited(false);
      const nextSuite: RpmSuiteDoc = {
        ...suiteDoc,
        teachingMode,
        tps: built.tps,
        atps: built.atps,
        protas: built.protas,
        prosems: built.prosems,
        rpm: built.rpm,
        rpmList: built.rpmList,
        agendaHarian: built.agendaHarian,
        updatedAt: new Date().toISOString(),
      };
      onChangeSuiteDoc(nextSuite);
      setActiveMeetingIdx(0);
      setSetupExpanded(false);
      void autoPersistGeneratedSuite(
        nextSuite,
        activeSection,
        `Mode Offline — sistem otomatis menyusun 6 perangkat (${built.rpmList.length} pertemuan RPM) secara lokal.`
      );
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-rpm-suite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpText: identity.cpText.trim(),
          materiList: cleanMateri,
          mapel: identity.mapel,
          kelas: identity.kelas,
          fase: identity.fase,
          semester: identity.semester,
          tahunAjaran: identity.tahunAjaran,
          alokasiWaktu: identity.alokasiWaktu,
          teachingMode,
          tpPerSubMateri,
        }),
      });
      const data = (await res.json()) as {
        suite?: {
          teachingMode?: RpmTeachingMode;
          tps: RpmTpItem[];
          atps: RpmAtpRow[];
          protas: RpmProtaRow[];
          prosems: RpmProsemRow[];
          rpm: RpmLessonPlan;
          rpmList?: RpmLessonPlan[];
          agendaHarian: RpmAgendaRow[];
        };
        error?: string;
      };
      if (!res.ok || !data.suite) {
        throw new Error(data.error || 'Gagal menghasilkan 6 perangkat pembelajaran.');
      }

      const generatedList =
        Array.isArray(data.suite.rpmList) && data.suite.rpmList.length > 0
          ? data.suite.rpmList
          : [data.suite.rpm];

      // Pastikan PROSEM tidak dicentang otomatis
      const cleanProsems = (data.suite.prosems || []).map((ps) => ({
        ...ps,
        bulanMinggu: [],
      }));

      setProtaManualEdited(false);
      setProsemManualEdited(false);
      const nextSuite: RpmSuiteDoc = {
        ...suiteDoc,
        teachingMode: data.suite.teachingMode || teachingMode,
        tps: data.suite.tps || [],
        atps: data.suite.atps || [],
        protas: data.suite.protas || [],
        prosems: cleanProsems,
        rpm: generatedList[0],
        rpmList: generatedList,
        agendaHarian: data.suite.agendaHarian || [],
        updatedAt: new Date().toISOString(),
      };
      onChangeSuiteDoc(nextSuite);
      setActiveMeetingIdx(0);
      setSetupExpanded(false);
      void autoPersistGeneratedSuite(
        nextSuite,
        activeSection,
        `Berhasil menyusun 6 perangkat otomatis (${generatedList.length} pertemuan RPM, PROSEM kosong siap tanda manual).`
      );
    } catch {
      // Seamless Zero-Quota Auto-Fallback to Local Builder
      const built = buildLocalRpmSuite({
        cpText: identity.cpText.trim(),
        materiList: cleanMateri,
        mapel: identity.mapel,
        kelas: identity.kelas,
        semester: identity.semester,
        alokasiWaktu: identity.alokasiWaktu,
        teachingMode,
        tpPerSubMateri,
      });
      setProtaManualEdited(false);
      setProsemManualEdited(false);
      const nextSuite: RpmSuiteDoc = {
        ...suiteDoc,
        teachingMode,
        tps: built.tps,
        atps: built.atps,
        protas: built.protas,
        prosems: built.prosems,
        rpm: built.rpm,
        rpmList: built.rpmList,
        agendaHarian: built.agendaHarian,
        updatedAt: new Date().toISOString(),
      };
      onChangeSuiteDoc(nextSuite);
      setActiveMeetingIdx(0);
      setSetupExpanded(false);
      const reason =
        typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Mode Offline'
          : 'Kuota AI sedang penuh';
      void autoPersistGeneratedSuite(
        nextSuite,
        activeSection,
        `${reason} — sistem otomatis menyusun 6 perangkat lengkap (${built.rpmList.length} pertemuan RPM) menggunakan Mesin Lokal (Tanpa Kuota).`
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateLocalAll = () => {
    setErrorMsg(null);
    if (!identity.cpText.trim() || cleanMateri.length === 0) {
      setErrorMsg(
        'Mohon isi Capaian Pembelajaran (CP) dan minimal 1 Materi Pembelajaran terlebih dahulu.'
      );
      setSetupExpanded(true);
      return;
    }
    const built = buildLocalRpmSuite({
      cpText: identity.cpText.trim(),
      materiList: cleanMateri,
      mapel: identity.mapel,
      kelas: identity.kelas,
      semester: identity.semester,
      alokasiWaktu: identity.alokasiWaktu,
      teachingMode,
      tpPerSubMateri,
    });
    setProtaManualEdited(false);
    setProsemManualEdited(false);
    const nextSuite: RpmSuiteDoc = {
      ...suiteDoc,
      teachingMode,
      tps: built.tps,
      atps: built.atps,
      protas: built.protas,
      prosems: built.prosems,
      rpm: built.rpm,
      rpmList: built.rpmList,
      agendaHarian: built.agendaHarian,
      updatedAt: new Date().toISOString(),
    };
    onChangeSuiteDoc(nextSuite);
    setActiveMeetingIdx(0);
    setSetupExpanded(false);
    void autoPersistGeneratedSuite(
      nextSuite,
      activeSection,
      `Berhasil menyusun 6 perangkat cepat tanpa AI (${built.rpmList.length} pertemuan RPM, PROSEM siap centang manual).`
    );
  };

  const handleSyncRpmPerTp = () => {
    if (tps.length === 0) {
      setErrorMsg('Isi atau generate minimal 1 TP terlebih dahulu sebelum membuat 1 RPM per TP.');
      return;
    }
    const nextList: RpmLessonPlan[] = tps.map((tp, idx) => {
      const existing = rpmList[idx];
      const rawTopik = tp.materiTerkait || existing?.judulPertemuan || materiPokokSummary;
      const topik = focusMeetingTopic(rawTopik, tp.rumusan) || cleanMeetingTopic(rawTopik);
      const formattedTp = tp.rumusan ? formatRpmTpLine(`${tp.kode}: ${tp.rumusan}`) : '';
      const autoCross = getDefaultRpmCrossAndDigital(identity.mapel, topik, identity.kelas);
      if (existing) {
        const detailedSteps = buildDetailedRpmSteps({
          mapel: identity.mapel,
          kelas: identity.kelas,
          materiPokok: topik,
          kodeTp: tp.kode,
          tpRumusan: tp.rumusan,
          pertemuanKe: idx + 1,
          totalPertemuan: tps.length,
          alokasiWaktu: identity.alokasiWaktu,
        });
        return {
          ...existing,
          pertemuanKe: idx + 1,
          kodeTp: tp.kode,
          judulPertemuan: topik,
          capaianPembelajaran: identity.cpText,
          tujuanPembelajaran: formattedTp ? [formattedTp] : existing.tujuanPembelajaran,
          dimensiProfilLulusan: selectDimensiProfilLulusan(identity.mapel, topik, tp.rumusan),
          lintasDisiplinIlmu: autoCross.lintasDisiplinIlmu,
          pemanfaatanDigital: autoCross.pemanfaatanDigital,
          kegiatanAwal: detailedSteps.kegiatanAwal,
          kegiatanInti: detailedSteps.kegiatanInti,
          kegiatanPenutup: detailedSteps.kegiatanPenutup,
          lkpd: buildLocalLkpd({
            mapel: identity.mapel,
            kelas: identity.kelas,
            materiPokok: topik,
            tpRumusan: tp.rumusan,
          }),
          asesmenSumatif: buildLocalSumatifWithQuestions({
            mapel: identity.mapel,
            materiPokok: topik,
            kodeTp: tp.kode,
            tpRumusan: tp.rumusan,
          }),
        };
      }
      return createEmptyRpmLessonPlan(identity.cpText, {
        mapel: identity.mapel,
        kelas: identity.kelas,
        pertemuanKe: idx + 1,
        totalPertemuan: tps.length,
        alokasiWaktu: identity.alokasiWaktu,
        kodeTp: tp.kode,
        judulPertemuan: topik,
        tujuanPembelajaran: formattedTp ? [formattedTp] : [],
      });
    });

    const nextAgenda: RpmAgendaRow[] = tps.map((tp, idx) => {
      const existingAg = agendaHarian[idx];
      const cleanTopik =
        focusMeetingTopic(tp.materiTerkait || materiPokokSummary, tp.rumusan) ||
        cleanMeetingTopic(materiPokokSummary);
      const cleanTpSummary = formatRpmTpLine(tp.rumusan || '');
      return {
        id: existingAg?.id || `ag_${Date.now()}_${idx + 1}`,
        pertemuanKe: idx + 1,
        hariTanggal: existingAg?.hariTanggal || `Pertemuan ${idx + 1}`,
        jamAlokasi: existingAg?.jamAlokasi || identity.alokasiWaktu,
        kelas: `Kelas ${identity.kelas}`,
        mapel: identity.mapel,
        materiPokok: `${tp.kode}: ${cleanTopik}`,
        kegiatanIntiRingkas:
          cleanTpSummary || existingAg?.kegiatanIntiRingkas || 'Pembelajaran mendalam & diskusi LKPD',
        mediaLkpd: existingAg?.mediaLkpd || nextList[idx]?.saranaMedia || 'LKPD & papan tulis',
        catatanKetercapaian: existingAg?.catatanKetercapaian || 'Terlaksana / Sesuai Rencana',
      };
    });

    onChangeSuiteDoc({
      ...suiteDoc,
      teachingMode: 'per-tp',
      rpm: nextList[0],
      rpmList: nextList,
      agendaHarian: nextAgenda,
      updatedAt: new Date().toISOString(),
    });
    setActiveMeetingIdx(0);
    showToast(`RPM & Agenda disinkronkan menjadi ${nextList.length} pertemuan (1 TP = 1 Pertemuan).`);
  };

  const buildMergedPlanFromTps = (
    groupTps: RpmTpItem[],
    pertemuanKe: number,
    totalPertemuan: number
  ): RpmLessonPlan => {
    const cleanTopics = Array.from(
      new Set(
        groupTps
          .map((tp) =>
            focusMeetingTopic(tp.materiTerkait || materiPokokSummary, tp.rumusan) ||
            cleanMeetingTopic(tp.materiTerkait || materiPokokSummary)
          )
          .filter(Boolean)
      )
    );
    const mergedTitle = cleanTopics.join(' & ') || cleanMeetingTopic(materiPokokSummary) || `Materi ${identity.mapel}`;
    const mergedCodes = groupTps.map((t) => t.kode.trim()).filter(Boolean);
    const kodeLabel =
      mergedCodes.length >= 3
        ? `${mergedCodes[0]}–${mergedCodes[mergedCodes.length - 1]}`
        : mergedCodes.join(' & ') || `TP.${pertemuanKe}`;
    const tpLines = groupTps
      .map((t) => (t.rumusan ? formatRpmTpLine(`${t.kode}: ${t.rumusan}`) : ''))
      .filter(Boolean);
    const combinedGoalSummary = groupTps
      .map((t) => t.rumusan.replace(/^\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .join(', serta ');

    return createEmptyRpmLessonPlan(identity.cpText, {
      mapel: identity.mapel,
      kelas: identity.kelas,
      pertemuanKe,
      totalPertemuan,
      alokasiWaktu: identity.alokasiWaktu,
      kodeTp: kodeLabel,
      judulPertemuan: mergedTitle,
      tujuanPembelajaran: tpLines,
      capaianPembelajaran: identity.cpText,
      dimensiProfilLulusan: selectDimensiProfilLulusan(identity.mapel, mergedTitle, combinedGoalSummary),
      ...(() => {
        const steps = buildDetailedRpmSteps({
          mapel: identity.mapel,
          kelas: identity.kelas,
          materiPokok: mergedTitle,
          kodeTp: kodeLabel,
          tpRumusan: combinedGoalSummary,
          pertemuanKe,
          totalPertemuan,
          alokasiWaktu: identity.alokasiWaktu,
        });
        return {
          kegiatanAwal: steps.kegiatanAwal,
          kegiatanInti: steps.kegiatanInti,
          kegiatanPenutup: steps.kegiatanPenutup,
        };
      })(),
      lkpd: buildLocalLkpd({
        mapel: identity.mapel,
        kelas: identity.kelas,
        materiPokok: mergedTitle,
        tpRumusan: combinedGoalSummary,
      }),
      asesmenSumatif: buildLocalSumatifWithQuestions({
        mapel: identity.mapel,
        materiPokok: mergedTitle,
        kodeTp: kodeLabel,
        tpRumusan: combinedGoalSummary,
      }),
    });
  };

  const buildAgendaFromPlans = (plans: RpmLessonPlan[]): RpmAgendaRow[] =>
    plans.map((plan, idx) => {
      const existingAg = agendaHarian[idx];
      const cleanTopik = cleanMeetingTopic(plan.judulPertemuan || materiPokokSummary);
      const tpRingkas = (plan.tujuanPembelajaran || [])
        .map((line) => formatRpmTpLine(line))
        .filter(Boolean)
        .join('; ');
      return {
        id: existingAg?.id || `ag_${Date.now()}_${idx + 1}`,
        pertemuanKe: plan.pertemuanKe ?? idx + 1,
        hariTanggal: existingAg?.hariTanggal || `Pertemuan ${idx + 1}`,
        jamAlokasi: existingAg?.jamAlokasi || identity.alokasiWaktu,
        kelas: `Kelas ${identity.kelas}`,
        mapel: identity.mapel,
        materiPokok: plan.kodeTp ? `${plan.kodeTp}: ${cleanTopik}` : cleanTopik,
        kegiatanIntiRingkas:
          tpRingkas || existingAg?.kegiatanIntiRingkas || 'Pembelajaran mendalam & diskusi LKPD',
        mediaLkpd: existingAg?.mediaLkpd || plan.saranaMedia || 'LKPD & papan tulis',
        catatanKetercapaian: existingAg?.catatanKetercapaian || 'Terlaksana / Sesuai Rencana',
      };
    });

  const handleSyncRpmByMateri = () => {
    if (tps.length < 2) {
      setErrorMsg('Minimal perlu 2 TP untuk dikelompokkan ke dalam 1 RPM.');
      return;
    }
    setErrorMsg(null);
    const groups: RpmTpItem[][] = [];
    for (const tp of tps) {
      const key = (
        focusMeetingTopic(tp.materiTerkait || materiPokokSummary, tp.rumusan) ||
        cleanMeetingTopic(tp.materiTerkait || materiPokokSummary)
      ).toLowerCase();
      const lastGroup = groups[groups.length - 1];
      const lastKey = lastGroup
        ? (
            focusMeetingTopic(
              lastGroup[0].materiTerkait || materiPokokSummary,
              lastGroup[0].rumusan
            ) || cleanMeetingTopic(lastGroup[0].materiTerkait || materiPokokSummary)
          ).toLowerCase()
        : '';
      if (lastGroup && key && key === lastKey && lastGroup.length < 3) {
        lastGroup.push(tp);
      } else {
        groups.push([tp]);
      }
    }

    // If every group ended up with length 1 (different topics), pair 2 TPs per meeting so grouping still merges
    const finalGroups: RpmTpItem[][] =
      groups.every((g) => g.length === 1) && tps.length >= 2
        ? Array.from({ length: Math.ceil(tps.length / 2) }, (_, i) =>
            tps.slice(i * 2, i * 2 + 2)
          )
        : groups;

    const nextList = finalGroups.map((grp, idx) =>
      buildMergedPlanFromTps(grp, idx + 1, finalGroups.length)
    );
    const nextAgenda = buildAgendaFromPlans(nextList);

    onChangeSuiteDoc({
      ...suiteDoc,
      teachingMode: nextList.length === 1 ? 'combined' : 'per-tp',
      rpm: nextList[0],
      rpmList: nextList,
      agendaHarian: nextAgenda,
      updatedAt: new Date().toISOString(),
    });
    setActiveMeetingIdx(0);
    setShowMergeTpDrawer(false);
    showToast(
      `${tps.length} TP berhasil dikelompokkan menjadi ${nextList.length} pertemuan RPM (2–3 TP per pertemuan).`
    );
  };

  const handleApplyMergedTps = (target: 'replace-current' | 'add-new') => {
    const picked = tps.filter((tp) => selectedMergeTpIds.includes(tp.id));
    if (picked.length < 2) {
      setErrorMsg('Centang minimal 2 TP yang ingin digabung menjadi 1 pertemuan RPM.');
      return;
    }
    setErrorMsg(null);
    if (target === 'add-new') {
      const nextNum = rpmList.length + 1;
      const newPlan = buildMergedPlanFromTps(picked, nextNum, nextNum);
      const nextList = [...rpmList, newPlan];
      const nextAgenda = buildAgendaFromPlans(nextList);
      onChangeSuiteDoc({
        ...suiteDoc,
        rpm: nextList[0],
        rpmList: nextList,
        agendaHarian: nextAgenda,
        updatedAt: new Date().toISOString(),
      });
      setActiveMeetingIdx(nextList.length - 1);
      setShowMergeTpDrawer(false);
      showToast(
        `${picked.length} TP (${picked.map((t) => t.kode).join(', ')}) digabung ke Pertemuan ${nextNum} RPM baru.`
      );
      return;
    }

    const mergedPlan = buildMergedPlanFromTps(
      picked,
      currentRpm.pertemuanKe ?? safeMeetingIdx + 1,
      rpmList.length
    );
    const nextList = rpmList.map((p, idx) => (idx === safeMeetingIdx ? mergedPlan : p));
    const nextAgenda = buildAgendaFromPlans(nextList);
    onChangeSuiteDoc({
      ...suiteDoc,
      rpm: nextList[0],
      rpmList: nextList,
      agendaHarian: nextAgenda,
      updatedAt: new Date().toISOString(),
    });
    setShowMergeTpDrawer(false);
    showToast(
      `Pertemuan ${mergedPlan.pertemuanKe} kini menggabungkan ${picked.length} TP (${mergedPlan.kodeTp}).`
    );
  };

  const handleCopyTpsToAtp = () => {
    if (tps.length === 0) return;
    const nextAtps: RpmAtpRow[] = tps.map((t, idx) => {
      const cleanBody = t.rumusan.replace(/^\d+[.)]\s*/, '').trim();
      const actor = idx === tps.length - 1 ? 'Murid mampu' : 'Murid dapat';
      const kodeAtp = `${identity.kelas}.1.${idx + 1}`;
      return {
        id: `atp_${Date.now()}_${idx + 1}`,
        urut: idx + 1,
        kodeTp: kodeAtp,
        tujuanPembelajaran: cleanBody ? `${kodeAtp} ${actor} ${cleanBody}` : '',
        materiPokok: t.materiTerkait || materiPokokSummary,
        dimensiProfil: 'Bernalar kritis, kemandirian, gotong royong',
        alokasiJp: t.jp || 2,
        semester: identity.semester,
        indikatorKetercapaian: cleanBody ? `${actor} ${cleanBody}` : '',
      };
    });
    updateTpAtpAndSync({ atps: nextAtps });
    showToast('Daftar TP berhasil disalin ke ATP (PROTA & PROSEM ikut diperbarui otomatis).');
  };

  const handleResyncProtaFromTpAtp = () => {
    if (tps.length === 0 && atps.length === 0) {
      setErrorMsg('Isi TP atau ATP terlebih dahulu sebelum menyinkronkan PROTA.');
      return;
    }
    const synced = buildProtaAndProsemFromTpAtp({
      tps,
      atps,
      kelas: identity.kelas,
      defaultSemester: identity.semester,
      materiPokokFallback: materiPokokSummary,
      existingProsems: prosems,
    });
    setProtaManualEdited(false);
    onChangeSuiteDoc({
      ...suiteDoc,
      protas: synced.protas,
      updatedAt: new Date().toISOString(),
    });
    showToast('PROTA berhasil disinkronkan ulang dari data TP & ATP.');
  };

  const handleResyncProsemFromTpAtp = () => {
    if (tps.length === 0 && atps.length === 0) {
      setErrorMsg('Isi TP atau ATP terlebih dahulu sebelum menyinkronkan PROSEM.');
      return;
    }
    const synced = buildProtaAndProsemFromTpAtp({
      tps,
      atps,
      kelas: identity.kelas,
      defaultSemester: identity.semester,
      materiPokokFallback: materiPokokSummary,
      existingProsems: prosems,
    });
    setProsemManualEdited(false);
    onChangeSuiteDoc({
      ...suiteDoc,
      prosems: synced.prosems,
      updatedAt: new Date().toISOString(),
    });
    showToast('PROSEM berhasil disinkronkan ulang dari TP & ATP (centang minggu tetap dipertahankan).');
  };

  const saveRecord = async (kind: RpmDocKind) => {
    setSavingKind(kind);
    setErrorMsg(null);
    try {
      const shortMateri = materiPokokSummary.slice(0, 55);
      const recordId = kind === 'suite' ? suiteDoc.id : `${suiteDoc.id}_${kind}`;
      const recordTitle =
        kind === 'suite'
          ? `Paket Lengkap RPM · ${identity.mapel} Kls ${identity.kelas} (${shortMateri})`
          : `${getDocKindLabel(kind)} · ${identity.mapel} Kls ${identity.kelas} (${shortMateri})`;

      const payloadDoc: RpmSuiteDoc = {
        ...suiteDoc,
        id: recordId,
        docKind: kind,
        title: recordTitle,
        updatedAt: new Date().toISOString(),
      };

      await onSaveToFolder({
        id: recordId,
        teacherId: teacher.id,
        itemType: 'rpm',
        title: recordTitle,
        mapel: identity.mapel,
        kelas: identity.kelas,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload: payloadDoc,
      });
      showToast(
        `"${recordTitle}" berhasil disimpan ke Folder Saya dan siap diunduh sebagai File Word (.doc) atau PDF (.pdf).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan file ke Folder Saya.');
    } finally {
      setSavingKind(null);
    }
  };

  const handleSaveAllSixSeparate = async () => {
    setSavingKind('all6');
    setErrorMsg(null);
    try {
      const kinds: Array<'tp-atp' | 'prota' | 'prosem' | 'rpm' | 'agenda'> = [
        'tp-atp',
        'prota',
        'prosem',
        'rpm',
        'agenda',
      ];
      const shortMateri = materiPokokSummary.slice(0, 55);
      for (const kind of kinds) {
        const recordId = `${suiteDoc.id}_${kind}`;
        const recordTitle = `${getDocKindLabel(kind)} · ${identity.mapel} Kls ${identity.kelas} (${shortMateri})`;
        const payloadDoc: RpmSuiteDoc = {
          ...suiteDoc,
          id: recordId,
          docKind: kind,
          title: recordTitle,
          updatedAt: new Date().toISOString(),
        };
        await onSaveToFolder({
          id: recordId,
          teacherId: teacher.id,
          itemType: 'rpm',
          title: recordTitle,
          mapel: identity.mapel,
          kelas: identity.kelas,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payload: payloadDoc,
        });
      }
      showToast(
        'Seluruh dokumen (TP & ATP 1 Lembar, PROTA, PROSEM, RPM, Agenda Harian) berhasil disimpan ke Folder Saya sebagai File Word & PDF.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan dokumen terpisah.');
    } finally {
      setSavingKind(null);
    }
  };

  const handleDownloadZip = async () => {
    setZipLoading(true);
    try {
      await downloadAllRpmSeparateZip(suiteDoc, 'both');
    } finally {
      setZipLoading(false);
    }
  };

  const toggleProsemWeek = (rowIdx: number, monthWeekCode: string) => {
    const nextProsems = prosems.map((row, idx) => {
      if (idx !== rowIdx) return row;
      const current = Array.isArray(row.bulanMinggu) ? row.bulanMinggu : [];
      const exists = current.includes(monthWeekCode);
      return {
        ...row,
        bulanMinggu: exists
          ? current.filter((m) => m !== monthWeekCode)
          : [...current, monthWeekCode],
      };
    });
    onChangeSuiteDoc({ ...suiteDoc, prosems: nextProsems, updatedAt: new Date().toISOString() });
  };

  const handleClearAllProsemChecks = () => {
    const cleared = prosems.map((r) => ({ ...r, bulanMinggu: [] }));
    onChangeSuiteDoc({ ...suiteDoc, prosems: cleared, updatedAt: new Date().toISOString() });
    showToast('Seluruh tanda centang pada PROSEM dikosongkan.');
  };

  const sectionMeta = SECTION_META[activeSection];
  const activeExportKind: RpmDocKind = activeSection;

  const STEP_FLOW: Record<
    RpmSectionTab,
    {
      prevLabel?: string;
      onPrev?: () => void;
      nextLabel: string;
      nextHint: string;
      onNext?: () => void;
    }
  > = {
    'tp-atp': {
      prevLabel: onOpenCpMateriBank ? 'Kembali ke CP & Materi' : undefined,
      onPrev: onOpenCpMateriBank,
      nextLabel: 'Lanjut ke PROTA',
      nextHint: 'Atur distribusi unit materi & alokasi JP tahunan',
      onNext: () => onChangeSection('prota'),
    },
    prota: {
      prevLabel: 'Kembali ke TP & ATP',
      onPrev: () => onChangeSection('tp-atp'),
      nextLabel: 'Lanjut ke PROSEM (Landscape)',
      nextHint: 'Tandai minggu efektif 5 minggu/bulan pada kertas landscape',
      onNext: () => onChangeSection('prosem'),
    },
    prosem: {
      prevLabel: 'Kembali ke PROTA',
      onPrev: () => onChangeSection('prota'),
      nextLabel: 'Lanjut ke RPM',
      nextHint: 'Susun langkah Pembelajaran Mendalam, LKPD & Rubrik',
      onNext: () => onChangeSection('rpm'),
    },
    rpm: {
      prevLabel: 'Kembali ke PROSEM',
      onPrev: () => onChangeSection('prosem'),
      nextLabel: 'Lanjut ke Agenda Harian',
      nextHint: 'Cek jurnal harian mengajar per pertemuan',
      onNext: () => onChangeSection('agenda'),
    },
    agenda: {
      prevLabel: 'Kembali ke RPM',
      onPrev: () => onChangeSection('rpm'),
      nextLabel: 'Lanjut ke Asesmen STS/SAS',
      nextHint: 'Buat kisi-kisi & soal ujian langsung dari TP aktif ini',
      onNext: onContinueToAssessment,
    },
  };

  const stepFlow = STEP_FLOW[activeSection];

  return (
    <div className="space-y-5">
      {/* Section Header & Grouped Mode / Export / Next Actions */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-sky-700">{sectionMeta.badge}</div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {sectionMeta.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">{sectionMeta.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Cluster 1: Mode & Kertas */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  viewMode === 'edit'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenLine className="w-3.5 h-3.5" />
                {simpleMode ? 'Ubah Isi' : 'Sunting'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  viewMode === 'preview'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {simpleMode ? 'Lihat Kertas' : 'Pratinjau'}
              </button>
              <span className="h-4 w-px bg-slate-300 mx-0.5" aria-hidden="true" />
              {(['F4', 'A4'] as PaperSize[]).map((ps) => (
                <button
                  key={ps}
                  type="button"
                  onClick={() => updateIdentity({ paperSize: ps })}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    identity.paperSize === ps
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ps}
                </button>
              ))}
            </div>

            {/* Cluster 2: Simpan & Ekspor */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-50 border border-slate-200 rounded-xl">
              <button
                type="button"
                disabled={Boolean(savingKind)}
                onClick={() => saveRecord(activeExportKind)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                {savingKind === activeExportKind ? 'Menyimpan...' : 'Simpan'}
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadRpmPdf(
                    suiteDoc,
                    activeExportKind,
                    activeSection === 'rpm' && rpmList.length > 1 ? safeMeetingIdx : undefined
                  )
                }
                className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadRpmWord(
                    suiteDoc,
                    activeExportKind,
                    activeSection === 'rpm' && rpmList.length > 1 ? safeMeetingIdx : undefined
                  )
                }
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
              >
                <FileDown className="w-3.5 h-3.5" />
                Word
              </button>

              <button
                type="button"
                onClick={() =>
                  printRpmWithIframe(
                    suiteDoc,
                    activeExportKind,
                    activeSection === 'rpm' && rpmList.length > 1 ? safeMeetingIdx : undefined
                  )
                }
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak
              </button>
            </div>

            {/* Cluster 3: Langkah Berikutnya */}
            {stepFlow.onNext && (
              <button
                type="button"
                onClick={stepFlow.onNext}
                className="touch-target px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                title={stepFlow.nextHint}
              >
                <span>{stepFlow.nextLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {simpleMode && (
        <SimpleGuideStrip
          heading="3 Langkah Menyusun Perangkat Ajar"
          steps={[
            {
              title: '1. Isi CP & Materi (Atau Ambil dari Menu CP)',
              desc: 'Buka panel biru di bawah jika ingin mengganti mapel, kelas, CP, atau daftar materi.',
            },
            {
              title: '2. Susun 6 Perangkat Tanpa Kuota',
              desc: 'Klik tombol kuning "Susun Cepat Lokal (Tanpa AI)" untuk langsung membuat TP-ATP 1 Lembar, PROTA, PROSEM, RPM, dan Agenda.',
            },
            {
              title: '3. Simpan & Unduh Word / PDF',
              desc: 'Klik tombol hijau "Simpan", lalu klik PDF untuk langsung dicetak atau Word jika ingin mengedit.',
            },
          ]}
        />
      )}

      {/* Collapsible CP & Materi + Kepala Sekolah & NIP Setup Panel */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-slate-900">
              {identity.mapel} · Kelas {identity.kelas} ({identity.fase}) · Semester {identity.semester} ({identity.tahunAjaran})
            </span>
            <span className="text-slate-500">
              Penyusun: {identity.namaPenyusun || teacher.name}
              {identity.nipPenyusun ? ` (NIP. ${identity.nipPenyusun})` : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!simpleMode && (
              <>
                <button
                  type="button"
                  onClick={handleSaveAllSixSeparate}
                  disabled={Boolean(savingKind)}
                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  {savingKind === 'all6' ? 'Menyimpan File...' : 'Simpan Semua File (Word & PDF)'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={zipLoading}
                  className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Package className="w-3.5 h-3.5" />
                  {zipLoading ? 'Menyiapkan ZIP...' : 'Unduh Paket ZIP (Word & PDF)'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setSetupExpanded((p) => !p)}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {setupExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {setupExpanded ? 'Tutup Panel CP, Materi & Identitas' : 'Ubah CP, Materi & Kepala Sekolah/NIP'}
            </button>
          </div>
        </div>

        {setupExpanded && (
          <div className="p-5 space-y-5">
            {/* Identitas & NIP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Mata Pelajaran
                </label>
                <select
                  value={identity.mapel}
                  onChange={(e) => updateIdentity({ mapel: e.target.value as MapelName })}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {MAPEL_LIST.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Kelas &amp; Fase
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={identity.kelas}
                    onChange={(e) => updateIdentity({ kelas: Number(e.target.value) })}
                    className="flex-1 min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map((k) => (
                      <option key={k} value={k}>
                        Kelas {k}
                      </option>
                    ))}
                  </select>
                  <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                    {identity.fase}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Semester &amp; Tahun Pelajaran
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={identity.semester}
                    onChange={(e) => updateIdentity({ semester: e.target.value as SemesterType })}
                    className="min-h-[40px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                  <input
                    type="text"
                    value={identity.tahunAjaran}
                    onChange={(e) => updateIdentity({ tahunAjaran: e.target.value })}
                    className="min-h-[40px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Alokasi Waktu per Pertemuan
                </label>
                <input
                  type="text"
                  value={identity.alokasiWaktu}
                  onChange={(e) => updateIdentity({ alokasiWaktu: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Nama Penyusun / Guru
                </label>
                <input
                  type="text"
                  value={identity.namaPenyusun}
                  onChange={(e) => updateIdentity({ namaPenyusun: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  NIP Guru Penyusun
                </label>
                <input
                  type="text"
                  value={identity.nipPenyusun}
                  onChange={(e) => updateIdentity({ nipPenyusun: e.target.value })}
                  placeholder="Mis. 19850101 201001 1 001"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Nama Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={identity.kepalaSekolah}
                  onChange={(e) => updateIdentity({ kepalaSekolah: e.target.value })}
                  placeholder="Nama lengkap & gelar Kepala Sekolah"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  NIP Kepala Sekolah
                </label>
                <input
                  type="text"
                  value={identity.nipKepalaSekolah}
                  onChange={(e) => updateIdentity({ nipKepalaSekolah: e.target.value })}
                  placeholder="NIP Kepala Sekolah"
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-xl"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Kota &amp; Tanggal Tanda Tangan
                </label>
                <input
                  type="text"
                  value={identity.kotaTanggal}
                  onChange={(e) => updateIdentity({ kotaTanggal: e.target.value })}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Model Pertemuan RPM
                </label>
                <select
                  value={teachingMode}
                  onChange={(e) =>
                    onChangeSuiteDoc({
                      ...suiteDoc,
                      teachingMode: e.target.value as RpmTeachingMode,
                    })
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
                >
                  <option value="per-tp">1 TP = 1 Pertemuan (Terpisah)</option>
                  <option value="combined">Gabungan Semua TP (1 RPM)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Rincian TP per Sub-Materi
                </label>
                <select
                  value={tpPerSubMateri}
                  onChange={(e) =>
                    setTpPerSubMateri(Number(e.target.value) as 1 | 2 | 3)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
                >
                  <option value={1}>Ringkas (1 TP / Sub-Materi)</option>
                  <option value={2}>Rinci (2 TP / Sub-Materi)</option>
                  <option value={3}>Sangat Rinci (3 TP / Sub-Materi)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSaveIdentityDefaults}
                  disabled={savingSettings}
                  className="w-full min-h-[40px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  {savingSettings ? 'Menyimpan...' : 'Simpan Kepala Sekolah & NIP'}
                </button>
              </div>
            </div>

            {/* CP & Materi Inputs */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Input CP &amp; Materi Pembelajaran untuk Generate 6 Perangkat (AI)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dari CP dan Materi ini, AI menyusun 1. TP, 2. ATP, 3. PROTA, 4. PROSEM (5 minggu/bulan, kosong tidak dicentang), 5. RPM per TP/Pertemuan, dan 6. Agenda Harian.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenCpMateriBank && (
                    <button
                      type="button"
                      onClick={onOpenCpMateriBank}
                      className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-xl"
                    >
                      Ambil dari Menu CP &amp; Materi
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    Isi Contoh ({identity.mapel})
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Capaian Pembelajaran (CP)
                </label>
                <textarea
                  rows={2}
                  value={identity.cpText}
                  onChange={(e) => updateIdentity({ cpText: e.target.value })}
                  placeholder="Tuliskan bunyi Capaian Pembelajaran (CP)..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-800">
                      Daftar Materi Pembelajaran / Pokok Materi (Dasar Utama TP &amp; ATP)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Tips: Pisahkan sub-materi dengan koma atau tambah baris Materi agar setiap sub-materi otomatis menjadi TP yang fokus &amp; terarah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateIdentity({ materiList: [...materiList, ''] })}
                    className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Materi
                  </button>
                </div>

                {materiList.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-mono font-semibold text-slate-700 shrink-0 tabular-nums">
                      Materi {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={m}
                      onChange={(e) =>
                        updateIdentity({
                          materiList: materiList.map((item, i) => (i === idx ? e.target.value : item)),
                        })
                      }
                      placeholder={`Pokok materi ke-${idx + 1} (mis. Rukun Islam, Wudu, Salat Fardu)...`}
                      className="flex-1 min-h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-xl"
                    />
                    <button
                      type="button"
                      disabled={materiList.length <= 1}
                      onClick={() =>
                        updateIdentity({
                          materiList: materiList.filter((_, i) => i !== idx),
                        })
                      }
                      className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateLocalAll}
                  className="touch-target px-4 py-2.5 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <Zap className="w-4 h-4 text-amber-600" />
                  Susun Cepat Lokal (Tanpa AI)
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAll}
                  disabled={generating}
                  className="touch-target px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {generating
                    ? 'Menghasilkan 6 Perangkat Otomatis...'
                    : `Generate 6 Perangkat Otomatis AI (${
                        teachingMode === 'per-tp' ? '1 TP = 1 Pertemuan' : 'Gabungan'
                      })`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW MODE */}
      {viewMode === 'preview' && (
        <RpmPrintPreview
          docData={suiteDoc}
          activeView={activeSection === 'tp-atp' ? 'tp-atp' : activeSection}
          onChangeView={() => {}}
          onSaveSingleFile={(kind) => saveRecord(kind)}
          savingKind={savingKind}
          hideFileCardsPanel={false}
          initialMeetingIdx={activeSection === 'rpm' ? safeMeetingIdx : null}
          schoolSettings={schoolSettings}
        />
      )}

      {/* EDIT MODE PER SECTION */}
      {viewMode === 'edit' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6">
          {/* 1 & 2. TP DAN ATP EDITOR */}
          {activeSection === 'tp-atp' && (
            <div className="space-y-8">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-sky-900">
                    Output Gabungan 1 Lembar (Kolom ATP di Sebelah Kolom TP)
                  </div>
                  <p className="text-xs text-sky-800 mt-0.5">
                    Saat dicetak atau diunduh ke PDF/Word, tabel TP dan ATP otomatis tampil bersebelahan pada satu lembar yang sama.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveRecord('tp-atp')}
                    disabled={Boolean(savingKind)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan TP &amp; ATP
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadRpmPdf(suiteDoc, 'tp-atp')}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF 1 Lembar
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadRpmWord(suiteDoc, 'tp-atp')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Word (.doc)
                  </button>
                </div>
              </div>

              {/* 1. TP */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      1. Tujuan Pembelajaran (TP)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Tambahkan atau sunting baris TP. Setiap TP dapat dijadikan 1 pertemuan khusus di menu RPM.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateTpAtpAndSync({
                          tps: [
                            ...tps,
                            {
                              id: `tp_${Date.now()}`,
                              kode: `TP.${tps.length + 1}`,
                              materiTerkait: materiPokokSummary,
                              rumusan: '',
                              kompetensi: 'Memahami',
                              jp: 2,
                            },
                          ],
                        })
                      }
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah TP
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="p-2.5 w-20">Kode</th>
                        <th className="p-2.5 w-44">Materi Terkait</th>
                        <th className="p-2.5 min-w-[260px]">Rumusan TP</th>
                        <th className="p-2.5 w-28">Kompetensi</th>
                        <th className="p-2.5 w-16 text-center">JP</th>
                        <th className="p-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {tps.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500">
                            Belum ada TP. Klik &ldquo;Tambah TP&rdquo; untuk input manual atau klik &ldquo;Generate 6 Perangkat Otomatis&rdquo; di panel atas.
                          </td>
                        </tr>
                      ) : (
                        tps.map((tp, idx) => (
                          <tr key={tp.id}>
                            <td className="p-2">
                              <input
                                type="text"
                                value={tp.kode}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    tps: tps.map((r, i) =>
                                      i === idx ? { ...r, kode: e.target.value } : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={tp.materiTerkait}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    tps: tps.map((r, i) =>
                                      i === idx ? { ...r, materiTerkait: e.target.value } : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                              />
                            </td>
                            <td className="p-2">
                              <textarea
                                rows={2}
                                value={tp.rumusan}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    tps: tps.map((r, i) =>
                                      i === idx ? { ...r, rumusan: e.target.value } : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={tp.kompetensi}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    tps: tps.map((r, i) =>
                                      i === idx ? { ...r, kompetensi: e.target.value } : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={1}
                                value={tp.jp}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    tps: tps.map((r, i) =>
                                      i === idx
                                        ? { ...r, jp: Math.max(1, Number(e.target.value) || 1) }
                                        : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-center font-mono tabular-nums"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  updateTpAtpAndSync({
                                    tps: tps.filter((_, i) => i !== idx),
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. ATP */}
              <div className="pt-6 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">
                      2. Alur Tujuan Pembelajaran (ATP)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Urutan logis pembelajaran per TP lengkap dengan Dimensi Profil Lulusan dan Indikator Ketercapaian.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tps.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCopyTpsToAtp}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Salin dari TP
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateTpAtpAndSync({
                          atps: [
                            ...atps,
                            {
                              id: `atp_${Date.now()}`,
                              urut: atps.length + 1,
                              kodeTp: `${identity.kelas}.1.${atps.length + 1}`,
                              tujuanPembelajaran: '',
                              materiPokok: materiPokokSummary,
                              dimensiProfil: 'Bernalar kritis, gotong royong',
                              alokasiJp: 2,
                              semester: identity.semester,
                              indikatorKetercapaian: '',
                            },
                          ],
                        })
                      }
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Baris ATP
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="p-2 w-12 text-center">Urut</th>
                        <th className="p-2 w-20">Kode</th>
                        <th className="p-2 min-w-[200px]">Tujuan Pembelajaran</th>
                        <th className="p-2 min-w-[140px]">Materi Pokok</th>
                        <th className="p-2 min-w-[140px]">Dimensi Profil</th>
                        <th className="p-2 min-w-[160px]">Indikator Ketercapaian</th>
                        <th className="p-2 w-16 text-center">JP</th>
                        <th className="p-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {atps.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-slate-500">
                            Belum ada baris ATP. Klik &ldquo;Salin dari TP&rdquo;, &ldquo;Tambah Baris ATP&rdquo;, atau generate otomatis.
                          </td>
                        </tr>
                      ) : (
                        atps.map((row, idx) => (
                          <tr key={row.id}>
                            <td className="p-2">
                              <input
                                type="number"
                                value={row.urut}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    atps: atps.map((r, i) =>
                                      i === idx
                                        ? { ...r, urut: Number(e.target.value) || idx + 1 }
                                        : r
                                    ),
                                  })
                                }
                                className="w-full px-1.5 py-1.5 border border-slate-300 rounded-lg text-center font-mono tabular-nums"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.kodeTp}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    atps: atps.map((r, i) =>
                                      i === idx ? { ...r, kodeTp: e.target.value } : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-semibold"
                              />
                            </td>
                            <td className="p-2">
                              <textarea
                                rows={2}
                                value={row.tujuanPembelajaran}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    atps: atps.map((r, i) =>
                                      i === idx
                                        ? { ...r, tujuanPembelajaran: e.target.value }
                                        : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.materiPokok}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    atps: atps.map((r, i) =>
                                      i === idx ? { ...r, materiPokok: e.target.value } : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.dimensiProfil}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    atps: atps.map((r, i) =>
                                      i === idx ? { ...r, dimensiProfil: e.target.value } : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                              />
                            </td>
                            <td className="p-2">
                              <textarea
                                rows={2}
                                value={row.indikatorKetercapaian}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    atps: atps.map((r, i) =>
                                      i === idx
                                        ? { ...r, indikatorKetercapaian: e.target.value }
                                        : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={1}
                                value={row.alokasiJp}
                                onChange={(e) =>
                                  updateTpAtpAndSync({
                                    atps: atps.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            alokasiJp: Math.max(1, Number(e.target.value) || 1),
                                          }
                                        : r
                                    ),
                                  })
                                }
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-center font-mono tabular-nums"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  updateTpAtpAndSync({
                                    atps: atps.filter((_, i) => i !== idx),
                                  })
                                }
                                className="p-1.5 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. PROTA EDITOR */}
          {activeSection === 'prota' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Program Tahunan (PROTA) — Tahun Pelajaran {identity.tahunAjaran}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {protaManualEdited
                      ? 'Mode Edit Manual aktif — perubahan Anda aman dan dapat diedit bebas. Klik "Sinkronkan dari TP & ATP" jika ingin mengambil ulang dari TP/ATP.'
                      : 'Terisi otomatis dari TP & ATP — guru tetap bebas mengedit kolom Semester, Materi, JP, atau menambah/menghapus baris secara manual.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(tps.length > 0 || atps.length > 0) && (
                    <button
                      type="button"
                      onClick={handleResyncProtaFromTpAtp}
                      className="px-3 py-2 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sinkronkan dari TP &amp; ATP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setProtaManualEdited(true);
                      onChangeSuiteDoc({
                        ...suiteDoc,
                        protas: [
                          ...protas,
                          {
                            id: `prota_${Date.now()}`,
                            no: protas.length + 1,
                            semester: identity.semester,
                            materiPokok: '',
                            alokasiJp: 4,
                            bulanKeterangan:
                              identity.semester === 'Genap' ? 'Januari - Juni' : 'Juli - Desember',
                          },
                        ],
                      });
                    }}
                    className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris PROTA
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="p-2 w-12 text-center">No</th>
                      <th className="p-2 w-28">Semester</th>
                      <th className="p-2 min-w-[240px]">Materi Pokok / Unit Pembelajaran</th>
                      <th className="p-2 w-24 text-center">Alokasi JP</th>
                      <th className="p-2 min-w-[180px]">Bulan / Keterangan</th>
                      <th className="p-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {protas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          Belum ada baris PROTA. Isi TP &amp; ATP agar terisi otomatis, atau klik &ldquo;Tambah Baris PROTA&rdquo; untuk input manual.
                        </td>
                      </tr>
                    ) : (
                      protas.map((row, idx) => (
                        <tr key={row.id}>
                          <td className="p-2 text-center font-mono tabular-nums">{row.no}</td>
                          <td className="p-2">
                            <select
                              value={row.semester}
                              onChange={(e) => {
                                setProtaManualEdited(true);
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  protas: protas.map((r, i) =>
                                    i === idx ? { ...r, semester: e.target.value } : r
                                  ),
                                });
                              }}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="Ganjil">Ganjil</option>
                              <option value="Genap">Genap</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.materiPokok}
                              onChange={(e) => {
                                setProtaManualEdited(true);
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  protas: protas.map((r, i) =>
                                    i === idx ? { ...r, materiPokok: e.target.value } : r
                                  ),
                                });
                              }}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={row.alokasiJp}
                              onChange={(e) => {
                                setProtaManualEdited(true);
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  protas: protas.map((r, i) =>
                                    i === idx
                                      ? { ...r, alokasiJp: Math.max(1, Number(e.target.value) || 1) }
                                      : r
                                  ),
                                });
                              }}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-center font-mono tabular-nums"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.bulanKeterangan}
                              onChange={(e) => {
                                setProtaManualEdited(true);
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  protas: protas.map((r, i) =>
                                    i === idx ? { ...r, bulanKeterangan: e.target.value } : r
                                  ),
                                });
                              }}
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setProtaManualEdited(true);
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  protas: protas
                                    .filter((_, i) => i !== idx)
                                    .map((r, i) => ({ ...r, no: i + 1 })),
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. PROSEM EDITOR (5 MINGGU / BULAN, TIDAK DICENTANG OTOMATIS) */}
          {activeSection === 'prosem' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Program Semester (PROSEM) — Semester {identity.semester} (5 Minggu / Bulan)
                  </h2>
                  <p className="text-xs text-slate-500">
                    {prosemManualEdited
                      ? 'Mode Edit Manual aktif — perubahan teks/JP & tanda centang minggu Anda tetap tersimpan. Klik "Sinkronkan dari TP & ATP" bila ingin memperbarui dari TP/ATP.'
                      : 'Baris PROSEM terisi otomatis dari TP & ATP (centang minggu 1–5 tetap kosong agar guru menandai sendiri dan semua kolom tetap bebas diedit manual).'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(tps.length > 0 || atps.length > 0) && (
                    <button
                      type="button"
                      onClick={handleResyncProsemFromTpAtp}
                      className="px-3 py-2 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sinkronkan dari TP &amp; ATP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClearAllProsemChecks}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Kosongkan Semua Centang
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProsemManualEdited(true);
                      onChangeSuiteDoc({
                        ...suiteDoc,
                        prosems: [
                          ...prosems,
                          {
                            id: `prosem_${Date.now()}`,
                            no: prosems.length + 1,
                            semester: identity.semester,
                            kodeTp: `${identity.kelas}.1.${prosems.length + 1}`,
                            materiPokok: materiPokokSummary,
                            alokasiJp: 2,
                            bulanMinggu: [],
                          },
                        ],
                      });
                    }}
                    className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris PROSEM
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <th rowSpan={2} className="p-2 w-10 text-center">No</th>
                      <th rowSpan={2} className="p-2 w-20">Kode TP</th>
                      <th rowSpan={2} className="p-2 min-w-[180px]">Materi Pokok</th>
                      <th rowSpan={2} className="p-2 w-14 text-center">JP</th>
                      {months.map((m) => (
                        <th key={m} colSpan={5} className="p-1.5 text-center border-l border-slate-200">
                          {m}
                        </th>
                      ))}
                      <th rowSpan={2} className="p-2 w-10" />
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500">
                      {months.flatMap((m) =>
                        [1, 2, 3, 4, 5].map((w) => (
                          <th key={`${m}-${w}`} className="p-1 text-center border-l border-slate-200 w-6">
                            {w}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {prosems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5 + months.length * 5}
                          className="p-4 text-center text-slate-500"
                        >
                          Belum ada baris PROSEM. Isi TP &amp; ATP agar terisi otomatis, atau klik &ldquo;Tambah Baris PROSEM&rdquo; untuk input manual.
                        </td>
                      </tr>
                    ) : (
                      prosems.map((row, idx) => {
                        const marks = Array.isArray(row.bulanMinggu) ? row.bulanMinggu : [];
                        return (
                          <tr key={row.id}>
                            <td className="p-1.5 text-center font-mono tabular-nums">{row.no}</td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.kodeTp}
                                onChange={(e) => {
                                  setProsemManualEdited(true);
                                  onChangeSuiteDoc({
                                    ...suiteDoc,
                                    prosems: prosems.map((r, i) =>
                                      i === idx ? { ...r, kodeTp: e.target.value } : r
                                    ),
                                  });
                                }}
                                className="w-full px-1.5 py-1 border border-slate-300 rounded font-mono"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.materiPokok}
                                onChange={(e) => {
                                  setProsemManualEdited(true);
                                  onChangeSuiteDoc({
                                    ...suiteDoc,
                                    prosems: prosems.map((r, i) =>
                                      i === idx ? { ...r, materiPokok: e.target.value } : r
                                    ),
                                  });
                                }}
                                className="w-full px-1.5 py-1 border border-slate-300 rounded"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                min={1}
                                value={row.alokasiJp}
                                onChange={(e) => {
                                  setProsemManualEdited(true);
                                  onChangeSuiteDoc({
                                    ...suiteDoc,
                                    prosems: prosems.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            alokasiJp: Math.max(1, Number(e.target.value) || 1),
                                          }
                                        : r
                                    ),
                                  });
                                }}
                                className="w-full px-1 py-1 border border-slate-300 rounded text-center font-mono tabular-nums"
                              />
                            </td>
                            {months.flatMap((m) =>
                              [1, 2, 3, 4, 5].map((w) => {
                                const code = `${m}-M${w}`;
                                const active = marks.includes(code);
                                return (
                                  <td
                                    key={code}
                                    className="p-0.5 text-center border-l border-slate-200"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleProsemWeek(idx, code)}
                                      className={`w-6 h-7 rounded text-[11px] font-bold transition-colors ${
                                        active
                                          ? 'bg-sky-600 text-white'
                                          : 'bg-slate-50 text-slate-300 hover:bg-slate-200 hover:text-slate-600'
                                      }`}
                                      title={`${m} Minggu ${w}`}
                                    >
                                      {active ? '✓' : ''}
                                    </button>
                                  </td>
                                );
                              })
                            )}
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setProsemManualEdited(true);
                                  onChangeSuiteDoc({
                                    ...suiteDoc,
                                    prosems: prosems
                                      .filter((_, i) => i !== idx)
                                      .map((r, i) => ({ ...r, no: i + 1 })),
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. RPM + LKPD + RUBRIK EDITOR (MULTI PERTEMUAN / 1 TP = 1 PERTEMUAN) */}
          {activeSection === 'rpm' && (
            <div className="space-y-6">
              {/* Pertemuan Switcher Bar */}
              <div className="border border-slate-200 bg-slate-50 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Daftar Pertemuan RPM ({rpmList.length} Pertemuan ·{' '}
                      {teachingMode === 'per-tp' ? 'Mode 1 TP = 1 Pertemuan' : 'Mode Gabungan'})
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Pilih pertemuan yang ingin disunting atau sinkronkan 1 pertemuan untuk setiap TP (TP.1 = Pertemuan 1, TP.2 = Pertemuan 2, dst.).
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tps.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSyncRpmPerTp}
                        className="px-3 py-1.5 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {simpleMode
                          ? `Samakan Pertemuan dengan TP (${tps.length})`
                          : `Sinkronkan 1 Pertemuan per TP (${tps.length})`}
                      </button>
                    )}
                    {tps.length >= 2 && (
                      <>
                        <button
                          type="button"
                          onClick={handleSyncRpmByMateri}
                          className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                          title="Otomatis menggabungkan 2–3 TP yang materinya sama ke dalam 1 RPM"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Gabung per Materi (2–3 TP)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!showMergeTpDrawer && selectedMergeTpIds.length === 0) {
                              setSelectedMergeTpIds(tps.slice(0, Math.min(2, tps.length)).map((t) => t.id));
                            }
                            setShowMergeTpDrawer((v) => !v);
                          }}
                          className={`px-3 py-1.5 border text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition-colors ${
                            showMergeTpDrawer
                              ? 'bg-amber-100 border-amber-300 text-amber-900'
                              : 'bg-amber-50 border-amber-200 hover:bg-amber-100 text-amber-900'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Pilih &amp; Gabung TP Manual
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const nextNum = rpmList.length + 1;
                        const nextTp = tps[rpmList.length];
                        const newPlan = createEmptyRpmLessonPlan(identity.cpText, {
                          mapel: identity.mapel,
                          kelas: identity.kelas,
                          pertemuanKe: nextNum,
                          totalPertemuan: Math.max(nextNum, tps.length),
                          alokasiWaktu: identity.alokasiWaktu,
                          kodeTp: nextTp?.kode || `TP.${nextNum}`,
                          judulPertemuan: nextTp?.materiTerkait || materiPokokSummary,
                          tujuanPembelajaran: nextTp?.rumusan
                            ? [formatRpmTpLine(`${nextTp.kode}: ${nextTp.rumusan}`)]
                            : [],
                        });
                        updateRpmList([...rpmList, newPlan]);
                        setActiveMeetingIdx(rpmList.length);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Pertemuan
                    </button>
                  </div>
                </div>

                {showMergeTpDrawer && tps.length >= 2 && (
                  <div className="bg-white border border-amber-200 rounded-xl p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Gabungkan 2 atau 3 TP Menjadi 1 Pertemuan RPM
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Centang 2–3 TP yang ingin diajarkan bersama dalam 1 kali pertemuan, lalu pilih terapkan ke pertemuan aktif atau buat pertemuan baru.
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        {selectedMergeTpIds.length} TP dipilih
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                      {tps.map((tp) => {
                        const checked = selectedMergeTpIds.includes(tp.id);
                        return (
                          <label
                            key={tp.id}
                            className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                              checked
                                ? 'bg-sky-50 border-sky-300 text-slate-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedMergeTpIds((prev) =>
                                  prev.includes(tp.id)
                                    ? prev.filter((id) => id !== tp.id)
                                    : [...prev, tp.id]
                                )
                              }
                              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-600 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">
                                {tp.kode} · <span className="text-sky-700">{tp.materiTerkait}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 line-clamp-2">
                                {formatRpmTpLine(tp.rumusan)}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowMergeTpDrawer(false)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg"
                      >
                        Tutup
                      </button>
                      <button
                        type="button"
                        disabled={selectedMergeTpIds.length < 2}
                        onClick={() => handleApplyMergedTps('replace-current')}
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg"
                      >
                        Terapkan ke Pertemuan {currentRpm.pertemuanKe ?? safeMeetingIdx + 1}
                      </button>
                      <button
                        type="button"
                        disabled={selectedMergeTpIds.length < 2}
                        onClick={() => handleApplyMergedTps('add-new')}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg"
                      >
                        Buat Jadi 1 Pertemuan Baru
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  {rpmList.map((plan, idx) => (
                    <button
                      key={`tab_pert_${idx}`}
                      type="button"
                      onClick={() => setActiveMeetingIdx(idx)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        safeMeetingIdx === idx
                          ? 'bg-white border-sky-600 text-sky-700 shadow-sm'
                          : 'bg-white/70 border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pertemuan {plan.pertemuanKe ?? idx + 1}
                      {plan.kodeTp ? ` · ${plan.kodeTp}` : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Pertemuan Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white border border-slate-200 rounded-xl p-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pertemuan Ke-
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={currentRpm.pertemuanKe ?? safeMeetingIdx + 1}
                    onChange={(e) =>
                      updateActiveRpm((p) => ({
                        ...p,
                        pertemuanKe: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl text-center"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kode TP Terkait
                  </label>
                  <input
                    type="text"
                    value={currentRpm.kodeTp || ''}
                    onChange={(e) =>
                      updateActiveRpm((p) => ({ ...p, kodeTp: e.target.value }))
                    }
                    placeholder="TP.1"
                    className="w-full px-3 py-2 text-xs font-mono font-semibold border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul / Materi Pokok Pertemuan Ini
                  </label>
                  <input
                    type="text"
                    value={currentRpm.judulPertemuan || ''}
                    onChange={(e) =>
                      updateActiveRpm((p) => ({ ...p, judulPertemuan: e.target.value }))
                    }
                    placeholder={materiPokokSummary}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    disabled={rpmList.length <= 1}
                    onClick={() => {
                      const filtered = rpmList.filter((_, i) => i !== safeMeetingIdx);
                      updateRpmList(filtered);
                      setActiveMeetingIdx(Math.max(0, safeMeetingIdx - 1));
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 rounded-xl inline-flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus
                  </button>
                </div>
              </div>

              {/* B. Komponen */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRpmAccordion('b')}
                    className="flex items-center gap-2 text-left text-sm font-bold text-slate-800 hover:text-sky-700"
                  >
                    {openRpmSections.b ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>
                      B. Komponen Pembelajaran Mendalam (Pertemuan {currentRpm.pertemuanKe ?? safeMeetingIdx + 1})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const autoFilled = getDefaultRpmCrossAndDigital(
                        identity.mapel,
                        currentRpm.judulPertemuan || materiPokokSummary,
                        identity.kelas
                      );
                      updateActiveRpm((prev) => ({
                        ...prev,
                        lintasDisiplinIlmu: autoFilled.lintasDisiplinIlmu,
                        pemanfaatanDigital: autoFilled.pemanfaatanDigital,
                      }));
                      showToast(
                        `Lintas Disiplin Ilmu & Pemanfaatan Digital disesuaikan otomatis untuk ${identity.mapel} Kelas ${identity.kelas}.`
                      );
                    }}
                    className="px-3 py-1 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Isi Otomatis Lintas Mapel &amp; Digital
                  </button>
                </div>
                {openRpmSections.b && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tujuan Pembelajaran (1 baris = 1 poin)
                    </label>
                    <textarea
                      rows={4}
                      value={(currentRpm.tujuanPembelajaran || []).join('\n')}
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({
                          ...prev,
                          tujuanPembelajaran: e.target.value.split('\n'),
                        }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dimensi Profil Lulusan
                    </label>
                    <textarea
                      rows={4}
                      value={currentRpm.dimensiProfilLulusan}
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({
                          ...prev,
                          dimensiProfilLulusan: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lintas Disiplin Ilmu (Terisi Otomatis Mapel Lain)
                    </label>
                    <textarea
                      rows={3}
                      value={
                        currentRpm.lintasDisiplinIlmu ??
                        getDefaultRpmCrossAndDigital(
                          identity.mapel,
                          currentRpm.judulPertemuan || materiPokokSummary,
                          identity.kelas
                        ).lintasDisiplinIlmu
                      }
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({
                          ...prev,
                          lintasDisiplinIlmu: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pemanfaatan Digital (Otomatis Sesuai Materi)
                    </label>
                    <textarea
                      rows={3}
                      value={
                        currentRpm.pemanfaatanDigital ??
                        getDefaultRpmCrossAndDigital(
                          identity.mapel,
                          currentRpm.judulPertemuan || materiPokokSummary,
                          identity.kelas
                        ).pemanfaatanDigital
                      }
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({
                          ...prev,
                          pemanfaatanDigital: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Pendekatan &amp; Model
                    </label>
                    <textarea
                      rows={2}
                      value={currentRpm.pendekatanModel}
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({ ...prev, pendekatanModel: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sarana &amp; Media Belajar
                    </label>
                    <textarea
                      rows={2}
                      value={currentRpm.saranaMedia}
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({ ...prev, saranaMedia: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
                )}
              </div>

              {/* C. Langkah-Langkah Kegiatan */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRpmAccordion('c')}
                    className="flex items-center gap-2 text-left text-sm font-bold text-slate-800 hover:text-sky-700"
                  >
                    {openRpmSections.c ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>C. Langkah-Langkah Kegiatan Pembelajaran (Awal, Inti, Penutup)</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const rawTopic = currentRpm.judulPertemuan || materiPokokSummary;
                        const focusedTopic =
                          focusMeetingTopic(rawTopic, currentRpm.tujuanPembelajaran?.[0]) ||
                          cleanMeetingTopic(rawTopic);
                        const meetingNum = currentRpm.pertemuanKe ?? safeMeetingIdx + 1;
                        const detailed = buildDetailedRpmSteps({
                          mapel: identity.mapel,
                          kelas: identity.kelas,
                          materiPokok: focusedTopic,
                          kodeTp: currentRpm.kodeTp || `TP.${meetingNum}`,
                          tpRumusan: currentRpm.tujuanPembelajaran?.[0],
                          pertemuanKe: meetingNum,
                          totalPertemuan: rpmList.length,
                          alokasiWaktu: identity.alokasiWaktu,
                        });
                        updateActiveRpm((prev) => ({
                          ...prev,
                          judulPertemuan: focusedTopic || prev.judulPertemuan,
                          tujuanPembelajaran: (prev.tujuanPembelajaran || []).map(formatRpmTpLine),
                          kegiatanAwal: detailed.kegiatanAwal,
                          kegiatanInti: detailed.kegiatanInti,
                          kegiatanPenutup: detailed.kegiatanPenutup,
                        }));
                        if (!openRpmSections.c) {
                          toggleRpmAccordion('c');
                        }
                        showToast(
                          `Langkah pembelajaran rinci diperbarui otomatis untuk Pertemuan ${meetingNum} (${identity.mapel} Kelas ${identity.kelas}).`
                        );
                      }}
                      className="px-3 py-1 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1"
                      title="Otomatis menyusun rincian langkah Kegiatan Awal, Inti (Memahami–Mengaplikasi–Merefleksi), dan Penutup tanpa kuota AI"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Perinci Langkah Otomatis
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRpmAccordion('c')}
                      className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                      {openRpmSections.c ? 'Tutup' : 'Buka Untuk Ubah'}
                    </button>
                  </div>
                </div>
                {openRpmSections.c && (
                <div className="p-4 space-y-4">
                  {(
                    [
                      { key: 'kegiatanAwal', title: 'Kegiatan Awal' },
                      { key: 'kegiatanInti', title: 'Kegiatan Inti' },
                      { key: 'kegiatanPenutup', title: 'Kegiatan Penutup' },
                    ] as const
                  ).map((sec) => {
                    const block = currentRpm[sec.key] || { durasi: '', label: '', langkah: [] };
                    return (
                      <div key={sec.key} className="border border-slate-200 rounded-xl p-4 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="text-xs font-bold text-slate-900 flex items-center">
                            {sec.title}
                          </div>
                          <input
                            type="text"
                            value={block.durasi}
                            onChange={(e) =>
                              updateActiveRpm((prev) => ({
                                ...prev,
                                [sec.key]: { ...block, durasi: e.target.value },
                              }))
                            }
                            placeholder="Durasi (mis. 10 Menit)"
                            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={block.label}
                            onChange={(e) =>
                              updateActiveRpm((prev) => ({
                                ...prev,
                                [sec.key]: { ...block, label: e.target.value },
                              }))
                            }
                            placeholder="Label pendekatan"
                            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                          />
                        </div>
                        <textarea
                          rows={sec.key === 'kegiatanInti' ? 9 : 5}
                          value={(block.langkah || []).join('\n')}
                          onChange={(e) =>
                            updateActiveRpm((prev) => ({
                              ...prev,
                              [sec.key]: { ...block, langkah: e.target.value.split('\n') },
                            }))
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl leading-relaxed"
                        />
                      </div>
                    );
                  })}
                </div>
                )}
              </div>

              {/* D. Asesmen & Tindak Lanjut */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => toggleRpmAccordion('d')}
                  className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-left text-sm font-bold text-slate-800 hover:text-sky-700"
                >
                  <span className="flex items-center gap-2">
                    {openRpmSections.d ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>D. Asesmen &amp; Tindak Lanjut (Pengayaan / Remedial)</span>
                  </span>
                  <span className="text-xs font-semibold text-sky-700">
                    {openRpmSections.d ? 'Tutup' : 'Buka Untuk Ubah'}
                  </span>
                </button>
                {openRpmSections.d && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Asesmen Awal
                    </label>
                    <textarea
                      rows={2}
                      value={currentRpm.asesmenAwal}
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({ ...prev, asesmenAwal: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Asesmen Formatif
                    </label>
                    <textarea
                      rows={2}
                      value={currentRpm.asesmenFormatif}
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({ ...prev, asesmenFormatif: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Asesmen Sumatif
                    </label>
                    <textarea
                      rows={2}
                      value={currentRpm.asesmenSumatif}
                      onChange={(e) =>
                        updateActiveRpm((prev) => ({ ...prev, asesmenSumatif: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tindak Lanjut — Pengayaan
                      </label>
                      <input
                        type="text"
                        value={currentRpm.tindakLanjutPengayaan}
                        onChange={(e) =>
                          updateActiveRpm((prev) => ({
                            ...prev,
                            tindakLanjutPengayaan: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tindak Lanjut — Remedial
                      </label>
                      <input
                        type="text"
                        value={currentRpm.tindakLanjutRemedial}
                        onChange={(e) =>
                          updateActiveRpm((prev) => ({
                            ...prev,
                            tindakLanjutRemedial: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                )}
              </div>

              {/* Lampiran 1 LKPD & Lampiran 2 Rubrik */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRpmAccordion('lampiran')}
                    className="flex items-center gap-2 text-left text-sm font-bold text-slate-800 hover:text-sky-700"
                  >
                    {openRpmSections.lampiran ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span>Lampiran 1 (LKPD) &amp; Lampiran 2 (Rubrik Penilaian)</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const rawTopic = currentRpm.judulPertemuan || materiPokokSummary;
                        const focusedTopic =
                          focusMeetingTopic(rawTopic, currentRpm.tujuanPembelajaran?.[0]) ||
                          cleanMeetingTopic(rawTopic);
                        const meetingNum = currentRpm.pertemuanKe ?? safeMeetingIdx + 1;
                        const nextLkpd = buildLocalLkpd({
                          mapel: identity.mapel,
                          kelas: identity.kelas,
                          materiPokok: focusedTopic,
                          tpRumusan: currentRpm.tujuanPembelajaran?.[0],
                        });
                        const nextSumatif = buildLocalSumatifWithQuestions({
                          mapel: identity.mapel,
                          materiPokok: focusedTopic,
                          kodeTp: currentRpm.kodeTp || `TP.${meetingNum}`,
                          tpRumusan: currentRpm.tujuanPembelajaran?.[0],
                        });
                        updateActiveRpm((prev) => ({
                          ...prev,
                          lkpd: nextLkpd,
                          asesmenSumatif: nextSumatif,
                        }));
                        if (!openRpmSections.lampiran) {
                          toggleRpmAccordion('lampiran');
                        }
                        showToast(
                          `LKPD & soal cek cepat diperbarui sesuai materi Pertemuan ${meetingNum}.`
                        );
                      }}
                      className="px-3 py-1 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1"
                      title="Sesuaikan isi LKPD dan soal cek cepat Asesmen Sumatif sesuai materi pertemuan ini"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Sesuaikan LKPD &amp; Soal
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleRpmAccordion('lampiran')}
                      className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                      {openRpmSections.lampiran ? 'Tutup' : 'Buka Untuk Ubah'}
                    </button>
                  </div>
                </div>
                {openRpmSections.lampiran && (
                <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={currentRpm.lkpd?.judulAktivitas1 || ''}
                    onChange={(e) =>
                      updateActiveRpm((prev) => ({
                        ...prev,
                        lkpd: { ...prev.lkpd, judulAktivitas1: e.target.value },
                      }))
                    }
                    className="px-3 py-2 text-xs border border-slate-300 rounded-xl font-semibold"
                  />
                  <input
                    type="text"
                    value={currentRpm.lkpd?.promptAktivitas3 || ''}
                    onChange={(e) =>
                      updateActiveRpm((prev) => ({
                        ...prev,
                        lkpd: { ...prev.lkpd, promptAktivitas3: e.target.value },
                      }))
                    }
                    placeholder="Prompt Komitmen Aksi Nyata Individu"
                    className="px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-semibold">
                        <th className="p-2 w-10 text-center">No</th>
                        <th className="p-2 w-48">{currentRpm.lkpd?.kolomHeader1 || 'Konsep'}</th>
                        <th className="p-2">{currentRpm.lkpd?.kolomHeader2 || 'Isian Murid'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(currentRpm.lkpd?.aktivitas1Rows || []).map((r, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-center font-mono tabular-nums">{r.no}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={r.item}
                              onChange={(e) =>
                                updateActiveRpm((prev) => ({
                                  ...prev,
                                  lkpd: {
                                    ...prev.lkpd,
                                    aktivitas1Rows: (prev.lkpd.aktivitas1Rows || []).map((x, i) =>
                                      i === idx ? { ...x, item: e.target.value } : x
                                    ),
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 border border-slate-300 rounded"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={r.promptIsian}
                              onChange={(e) =>
                                updateActiveRpm((prev) => ({
                                  ...prev,
                                  lkpd: {
                                    ...prev.lkpd,
                                    aktivitas1Rows: (prev.lkpd.aktivitas1Rows || []).map((x, i) =>
                                      i === idx ? { ...x, promptIsian: e.target.value } : x
                                    ),
                                  },
                                }))
                              }
                              className="w-full px-2 py-1 border border-slate-300 rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
                )}
              </div>
            </div>
          )}

          {/* 6. AGENDA HARIAN EDITOR */}
          {activeSection === 'agenda' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Agenda Harian Mengajar Guru
                  </h2>
                  <p className="text-xs text-slate-500">
                    Jurnal pelaksanaan harian per pertemuan yang terhubung dengan TP &amp; RPM.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {tps.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSyncRpmPerTp}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sinkronkan dari TP/RPM
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSuiteDoc({
                        ...suiteDoc,
                        agendaHarian: [
                          ...agendaHarian,
                          {
                            id: `ag_${Date.now()}`,
                            pertemuanKe: agendaHarian.length + 1,
                            hariTanggal: `Pertemuan ${agendaHarian.length + 1}`,
                            jamAlokasi: identity.alokasiWaktu,
                            kelas: `Kelas ${identity.kelas}`,
                            mapel: identity.mapel,
                            materiPokok: materiPokokSummary,
                            kegiatanIntiRingkas: '',
                            mediaLkpd: currentRpm.saranaMedia,
                            catatanKetercapaian: 'Terlaksana / Sesuai Rencana',
                          },
                        ],
                      })
                    }
                    className="px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Pertemuan
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                      <th className="p-2 w-12 text-center">Pert.</th>
                      <th className="p-2 w-36">Hari / Tanggal</th>
                      <th className="p-2 w-32">Alokasi</th>
                      <th className="p-2 min-w-[150px]">Materi Pokok</th>
                      <th className="p-2 min-w-[200px]">Ringkasan Kegiatan Inti</th>
                      <th className="p-2 min-w-[140px]">Media / LKPD</th>
                      <th className="p-2 min-w-[140px]">Catatan Ketercapaian</th>
                      <th className="p-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {agendaHarian.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-500">
                          Belum ada entri Agenda Harian. Klik &ldquo;Tambah Pertemuan&rdquo; atau &ldquo;Generate 6 Perangkat Otomatis&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      agendaHarian.map((ag, idx) => (
                        <tr key={ag.id}>
                          <td className="p-2 text-center font-mono tabular-nums">
                            {ag.pertemuanKe}
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={ag.hariTanggal}
                              onChange={(e) =>
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  agendaHarian: agendaHarian.map((r, i) =>
                                    i === idx ? { ...r, hariTanggal: e.target.value } : r
                                  ),
                                })
                              }
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={ag.jamAlokasi}
                              onChange={(e) =>
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  agendaHarian: agendaHarian.map((r, i) =>
                                    i === idx ? { ...r, jamAlokasi: e.target.value } : r
                                  ),
                                })
                              }
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={ag.materiPokok}
                              onChange={(e) =>
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  agendaHarian: agendaHarian.map((r, i) =>
                                    i === idx ? { ...r, materiPokok: e.target.value } : r
                                  ),
                                })
                              }
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2">
                            <textarea
                              rows={2}
                              value={ag.kegiatanIntiRingkas}
                              onChange={(e) =>
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  agendaHarian: agendaHarian.map((r, i) =>
                                    i === idx
                                      ? { ...r, kegiatanIntiRingkas: e.target.value }
                                      : r
                                  ),
                                })
                              }
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={ag.mediaLkpd}
                              onChange={(e) =>
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  agendaHarian: agendaHarian.map((r, i) =>
                                    i === idx ? { ...r, mediaLkpd: e.target.value } : r
                                  ),
                                })
                              }
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={ag.catatanKetercapaian}
                              onChange={(e) =>
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  agendaHarian: agendaHarian.map((r, i) =>
                                    i === idx
                                      ? { ...r, catatanKetercapaian: e.target.value }
                                      : r
                                  ),
                                })
                              }
                              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                onChangeSuiteDoc({
                                  ...suiteDoc,
                                  agendaHarian: agendaHarian.filter((_, i) => i !== idx),
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chained Bottom Step Navigation Bar (Visible in both Edit & Preview modes) */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {stepFlow.onPrev && stepFlow.prevLabel ? (
            <button
              type="button"
              onClick={stepFlow.onPrev}
              className="touch-target px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{stepFlow.prevLabel}</span>
            </button>
          ) : (
            <div className="text-xs text-slate-500">
              Alur Terhubung: TP &amp; ATP &rarr; PROTA &rarr; PROSEM &rarr; RPM &rarr; Agenda Harian &rarr; Asesmen
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span className="text-xs text-slate-500 hidden md:inline">{stepFlow.nextHint}</span>
          {stepFlow.onNext && (
            <button
              type="button"
              onClick={stepFlow.onNext}
              className="touch-target px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors shadow-sm"
            >
              <span>{stepFlow.nextLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <FloatingToast
        successMsg={successMsg}
        errorMsg={errorMsg}
        onDismissSuccess={() => setSuccessMsg(null)}
        onDismissError={() => setErrorMsg(null)}
      />
    </div>
  );
}
