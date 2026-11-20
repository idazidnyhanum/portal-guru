import { onAuthStateChanged, User } from 'firebase/auth';
import {
  BookOpen,
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Cloud,
  Download,
  FileText,
  FolderOpen,
  Gamepad2,
  ImagePlus,
  ListChecks,
  LogIn,
  LogOut,
  PenLine,
  Save,
  ShieldCheck,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AssessmentWizard } from './components/AssessmentWizard';
import { CpMateriManager, RpmPrefillPayload } from './components/CpMateriManager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingToast } from './components/FloatingToast';
import { FolderSayaView } from './components/FolderSayaView';
import { GameArenaModal } from './components/GameArenaModal';
import { GameBuilder } from './components/GameBuilder';
import { OfflineIndicator } from './components/OfflineIndicator';
import { RosterManager } from './components/RosterManager';
import {
  createEmptyRpmLessonPlan,
  createInitialRpmSuite,
  RpmSectionTab,
  RpmWizard,
} from './components/RpmWizard';
import { SimpleGuideStrip } from './components/SimpleGuideStrip';
import { StudentPlayView } from './components/StudentPlayView';
import { TeacherHelpModal } from './components/TeacherHelpModal';
import { TeacherSelector } from './components/TeacherSelector';
import { ActiveTab, TopBar, WorkspaceSidebar } from './components/TopBar';
import {
  createDefaultRosters,
  getFaseByKelas,
  SDN_LENDANG_TELAGA_TEACHERS,
} from './constants/school';
import { auth, signInWithGoogle, signOutGoogle } from './firebase';
import {
  createDefaultSchoolSettings,
  deleteWorkspaceItem,
  loadSchoolSettings,
  loadTeacherRosters,
  loadWorkspaceItems,
  saveClassRoster,
  saveSchoolSettings,
  saveWorkspaceItem,
} from './services/storageService';
import {
  downloadAssessmentPDF,
  downloadAssessmentWord,
} from './utils/exportAssessment';
import { compressImageFile } from './utils/imageUtils';
import {
  buildProtaAndProsemFromTpAtp,
  cleanMeetingTopic,
  extractSubMateriTopics,
  focusMeetingTopic,
  formatRpmTpLine,
  selectDimensiProfilLulusan,
} from './utils/localRpmBuilder';
import {
  AssessmentDoc,
  ClassRosterMap,
  CpMateriBankDoc,
  GameDoc,
  RpmSuiteDoc,
  SchoolTeacherSettings,
  TeacherProfile,
  WorkspaceItemRecord,
} from './types/portal';

function isRpmSectionTab(tab: ActiveTab): tab is RpmSectionTab {
  return (
    tab === 'tp-atp' ||
    tab === 'prota' ||
    tab === 'prosem' ||
    tab === 'rpm' ||
    tab === 'agenda'
  );
}

function mapDocKindToTab(docKind?: RpmSuiteDoc['docKind']): ActiveTab {
  switch (docKind) {
    case 'tp':
    case 'atp':
    case 'tp-atp':
      return 'tp-atp';
    case 'prota':
      return 'prota';
    case 'prosem':
      return 'prosem';
    case 'agenda':
      return 'agenda';
    default:
      return 'rpm';
  }
}

function PortalWorkspace() {
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [schoolSettings, setSchoolSettings] = useState<SchoolTeacherSettings>(() =>
    createDefaultSchoolSettings()
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [showSchoolSettingsForm, setShowSchoolSettingsForm] = useState(false);
  const [showAllTeacherNips, setShowAllTeacherNips] = useState(false);

  const [rosters, setRosters] = useState<ClassRosterMap>(() => createDefaultRosters());
  const [rosterKelas, setRosterKelas] = useState<number>(4);
  const [workspaceItems, setWorkspaceItems] = useState<WorkspaceItemRecord[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);

  const [rpmSuite, setRpmSuite] = useState<RpmSuiteDoc>(() =>
    createInitialRpmSuite(
      selectedTeacher || SDN_LENDANG_TELAGA_TEACHERS[0],
      createDefaultSchoolSettings()
    )
  );

  const [editingAssessment, setEditingAssessment] = useState<AssessmentDoc | null>(null);
  const [assessmentPrefill, setAssessmentPrefill] = useState<{
    mapel: RpmSuiteDoc['identity']['mapel'];
    kelas: number;
    semester: RpmSuiteDoc['identity']['semester'];
    tahunAjaran: string;
    paperSize: RpmSuiteDoc['identity']['paperSize'];
    tps: string[];
  } | null>(null);
  const [editingCpBank, setEditingCpBank] = useState<CpMateriBankDoc | null>(null);
  const [editingGame, setEditingGame] = useState<GameDoc | null>(null);
  const [activeArenaGame, setActiveArenaGame] = useState<GameDoc | null>(null);
  const [arenaInitialView, setArenaInitialView] = useState<'play' | 'monitor'>('play');
  const [simpleMode, setSimpleMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('portal_guru_simple_mode') !== 'false';
    } catch {
      return true;
    }
  });
  const [helpOpen, setHelpOpen] = useState(false);

  const toggleSimpleMode = () => {
    setSimpleMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('portal_guru_simple_mode', String(next));
      } catch {
        // ignore storage error
      }
      return next;
    });
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsub();
  }, []);

  // Load persisted school settings (Kepala Sekolah & Teacher NIPs)
  useEffect(() => {
    let active = true;
    loadSchoolSettings().then((loaded) => {
      if (!active) return;
      setSchoolSettings(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  // Load rosters and saved workspace files for active teacher
  useEffect(() => {
    if (!selectedTeacher) return;
    let active = true;
    setLoadingWorkspace(true);
    Promise.all([
      loadTeacherRosters(selectedTeacher.id),
      loadWorkspaceItems(selectedTeacher.id),
    ])
      .then(([loadedRosters, loadedItems]) => {
        if (!active) return;
        setRosters(loadedRosters);
        setWorkspaceItems(loadedItems);
      })
      .finally(() => {
        if (active) setLoadingWorkspace(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTeacher, firebaseUser?.uid]);

  // Keep rpmSuite teacher & NIP/Kepala Sekolah identity synced with selectedTeacher & schoolSettings
  useEffect(() => {
    if (!selectedTeacher) return;
    const teacherNip =
      schoolSettings.teacherNips[selectedTeacher.id] || selectedTeacher.nip || '';
    setRpmSuite((prev) => ({
      ...prev,
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      identity: {
        ...prev.identity,
        namaPenyusun: selectedTeacher.name,
        nipPenyusun: teacherNip,
        kepalaSekolah: schoolSettings.kepalaSekolah,
        nipKepalaSekolah: schoolSettings.nipKepalaSekolah,
      },
    }));
  }, [selectedTeacher, schoolSettings]);

  const handleSaveSchoolSettings = async (next: SchoolTeacherSettings) => {
    setSavingSettings(true);
    try {
      const saved = await saveSchoolSettings(next);
      setSchoolSettings(saved);
      setSettingsSavedMsg('Nama Kepala Sekolah & NIP berhasil disimpan.');
      setTimeout(() => setSettingsSavedMsg(null), 3500);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSelectTeacher = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setActiveTab('dashboard');
    setEditingAssessment(null);
    setEditingCpBank(null);
    setEditingGame(null);
    setRpmSuite(createInitialRpmSuite(teacher, schoolSettings));
  };

  const handleSwitchTeacher = () => {
    setSelectedTeacher(null);
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/unauthorized-domain' && typeof window !== 'undefined') {
        setAuthErrorMsg(
          `Domain "${window.location.hostname}" belum ditambahkan di Firebase Console > Authentication > Settings > Authorized domains. Tanpa login Google, QR & Link Game tetap berfungsi.`
        );
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthErrorMsg('Login Google gagal atau diblokir browser. Data tetap tersimpan lokal di perangkat.');
      }
      console.error('Google Sign-In dibatalkan atau gagal:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOutGoogle();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveRoster = async (kelas: number, students: string[]) => {
    if (!selectedTeacher) return;
    const updated = await saveClassRoster(selectedTeacher.id, kelas, students);
    setRosters(updated);
  };

  const handleSaveToFolder = async (record: WorkspaceItemRecord) => {
    const updated = await saveWorkspaceItem(record);
    setWorkspaceItems(updated);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedTeacher) return;
    const updated = await deleteWorkspaceItem(selectedTeacher.id, itemId);
    setWorkspaceItems(updated);
  };

  const handleReceiveCpMateriPrefill = (prefill: RpmPrefillPayload) => {
    if (!selectedTeacher) return;
    const fase = getFaseByKelas(prefill.kelas);
    const cleanedTps = (prefill.tps || []).map((t) => t.trim()).filter(Boolean);
    const cleanedAtps = (prefill.atps || []).map((a) => a.trim()).filter(Boolean);
    const materiPokok = prefill.materiList.join('; ');

    setRpmSuite((prev) => {
      const ts = Date.now();

      let nextTps = prev.tps;
      let nextAtps = prev.atps;

      if (prefill.selectedRows && prefill.selectedRows.length > 0) {
        const builtTps: typeof prev.tps = [];
        const builtAtps: typeof prev.atps = [];
        let globalIdx = 0;

        prefill.selectedRows.forEach((rowMeta, rowIdx) => {
          const rowNum = rowIdx + 1;
          const rowSem = rowMeta.semester === 'II' ? 'Genap' : 'Ganjil';
          const rowTps = rowMeta.tps.filter(Boolean);
          const rowAtps = rowMeta.atps.filter(Boolean);
          const countInRow = Math.max(rowTps.length, rowAtps.length);
          const jpPerItem = Math.max(
            1,
            countInRow > 0 ? Math.round((rowMeta.alokasiJp || 4) / countInRow) : rowMeta.alokasiJp || 2
          );

          for (let j = 0; j < countInRow; j++) {
            globalIdx += 1;
            const rawTp = rowTps[j] || '';
            const rawAtp = rowAtps[j] || '';
            const body = (rawTp || rawAtp)
              .replace(/^\d+\.\d+\.\d+\s+/, '')
              .replace(/^(Murid|Peserta didik)\s+(dapat|mampu)\s+/i, '')
              .replace(/^\d+[.)]\s*/, '')
              .trim();
            const numberedTp = rawTp
              ? /^\d+[.)]\s/.test(rawTp)
                ? rawTp
                : `${globalIdx}. ${body}`
              : `${globalIdx}. ${body}`;

            const codeMatch = rawAtp.match(/^(\d+\.\d+\.\d+)\s+/);
            const kodeAtp = codeMatch ? codeMatch[1] : `${prefill.kelas}.${rowNum}.${j + 1}`;
            const actor = j === countInRow - 1 ? 'Murid mampu' : 'Murid dapat';
            const finalAtp = rawAtp || `${kodeAtp} ${actor} ${body}`;

            const rowSubTopics = extractSubMateriTopics(rowMeta.materiBab || materiPokok, '');
            const focusedMateri =
              rowSubTopics.length === countInRow && rowSubTopics[j]
                ? cleanMeetingTopic(rowSubTopics[j])
                : focusMeetingTopic(rowMeta.materiBab || materiPokok, numberedTp) ||
                  cleanMeetingTopic(rowMeta.materiBab || materiPokok);
            const dimProfil = selectDimensiProfilLulusan(prefill.mapel, focusedMateri, numberedTp);

            builtTps.push({
              id: `tp_${ts}_${globalIdx}`,
              kode: `TP.${globalIdx}`,
              materiTerkait: focusedMateri,
              rumusan: numberedTp,
              kompetensi:
                j === 0
                  ? 'Memahami (L1)'
                  : j === countInRow - 1
                  ? 'Menerapkan / Mempraktikkan (L3)'
                  : 'Mengidentifikasi (L2)',
              jp: jpPerItem,
            });

            builtAtps.push({
              id: `atp_${ts}_${globalIdx}`,
              urut: globalIdx,
              kodeTp: kodeAtp,
              tujuanPembelajaran: finalAtp,
              materiPokok: focusedMateri,
              dimensiProfil: dimProfil,
              alokasiJp: jpPerItem,
              semester: rowSem,
              indikatorKetercapaian: finalAtp,
            });
          }
        });

        if (builtTps.length > 0) nextTps = builtTps;
        if (builtAtps.length > 0) nextAtps = builtAtps;
      } else {
        nextTps =
          cleanedTps.length > 0
            ? cleanedTps.map((rawTp, idx) => {
                const body = rawTp.replace(/^\d+[.)]\s*/, '').trim();
                return {
                  id: `tp_${ts}_${idx + 1}`,
                  kode: `TP.${idx + 1}`,
                  materiTerkait: materiPokok,
                  rumusan: `${idx + 1}. ${body}`,
                  kompetensi:
                    idx === 0
                      ? 'Memahami (L1)'
                      : idx === cleanedTps.length - 1
                      ? 'Menerapkan / Mempraktikkan (L3)'
                      : 'Mengidentifikasi (L2)',
                  jp: 2,
                };
              })
            : prev.tps;

        nextAtps =
          cleanedAtps.length > 0
            ? cleanedAtps.map((alur, idx) => {
                const codeMatch = alur.match(/^(\d+\.\d+\.\d+)\s+/);
                const extractedCode = codeMatch ? codeMatch[1] : `${prefill.kelas}.1.${idx + 1}`;
                return {
                  id: `atp_${ts}_${idx + 1}`,
                  urut: idx + 1,
                  kodeTp: extractedCode,
                  tujuanPembelajaran: alur,
                  materiPokok,
                  dimensiProfil: 'Bernalar Kritis, Mandiri, Gotong Royong',
                  alokasiJp: 2,
                  semester: prefill.semester,
                  indikatorKetercapaian: nextTps[idx]?.rumusan || alur,
                };
              })
            : cleanedTps.length > 0
            ? nextTps.map((tp, idx) => {
                const body = tp.rumusan.replace(/^\d+[.)]\s*/, '').trim();
                const actor = idx === nextTps.length - 1 ? 'Murid mampu' : 'Murid dapat';
                const kodeAtp = `${prefill.kelas}.1.${idx + 1}`;
                return {
                  id: `atp_${ts}_${idx + 1}`,
                  urut: idx + 1,
                  kodeTp: kodeAtp,
                  tujuanPembelajaran: `${kodeAtp} ${actor} ${body}`,
                  materiPokok,
                  dimensiProfil: 'Bernalar Kritis, Mandiri, Gotong Royong',
                  alokasiJp: tp.jp || 2,
                  semester: prefill.semester,
                  indikatorKetercapaian: `${actor} ${body}`,
                };
              })
            : prev.atps;
      }

      const hasTpOrAtp = nextTps.length > 0 || nextAtps.length > 0;
      const syncedSchedule = hasTpOrAtp
        ? buildProtaAndProsemFromTpAtp({
            tps: nextTps,
            atps: nextAtps,
            kelas: prefill.kelas,
            defaultSemester: prefill.semester,
            materiPokokFallback: materiPokok,
          })
        : { protas: prev.protas, prosems: prev.prosems };

      const baseRpmList =
        prev.rpmList && prev.rpmList.length > 0 ? prev.rpmList : [prev.rpm];

      const nextRpmList =
        nextTps.length > 0
          ? nextTps.map((tp, idx) => {
              const meetingTopic =
                focusMeetingTopic(tp.materiTerkait || materiPokok, tp.rumusan) ||
                cleanMeetingTopic(materiPokok);
              return createEmptyRpmLessonPlan(prefill.cpText, {
                mapel: prefill.mapel,
                kelas: prefill.kelas,
                pertemuanKe: idx + 1,
                totalPertemuan: nextTps.length,
                alokasiWaktu: prev.identity.alokasiWaktu,
                kodeTp: tp.kode,
                judulPertemuan: meetingTopic,
                capaianPembelajaran: prefill.cpText,
                tujuanPembelajaran: [formatRpmTpLine(`${tp.kode}: ${tp.rumusan}`)],
              });
            })
          : baseRpmList.map((plan) => ({
              ...plan,
              capaianPembelajaran: prefill.cpText,
            }));

      const nextAgenda =
        nextRpmList.length > 0
          ? nextRpmList.map((plan, idx) => ({
              id: `agenda_${ts}_${idx + 1}`,
              pertemuanKe: idx + 1,
              hariTanggal: '.... / ............ 20..',
              jamAlokasi: prev.identity.alokasiWaktu || '2 x 35 Menit',
              kelas: `Kelas ${prefill.kelas}`,
              mapel: prefill.mapel,
              materiPokok: plan.judulPertemuan || cleanMeetingTopic(materiPokok),
              kegiatanIntiRingkas:
                formatRpmTpLine(plan.tujuanPembelajaran?.[0] || '') ||
                `Pembelajaran mendalam & diskusi LKPD materi ${plan.judulPertemuan || cleanMeetingTopic(materiPokok)}`,
              mediaLkpd: plan.saranaMedia || 'Buku Siswa, Media Konkret, LKPD',
              catatanKetercapaian: 'Terlaksana sesuai alokasi waktu; refleksi & formatif tercapai.',
            }))
          : prev.agendaHarian;

      return {
        ...prev,
        id: `rpm_${ts}`,
        title: `Perangkat RPM ${prefill.mapel} Kelas ${prefill.kelas} (${cleanMeetingTopic(materiPokok).slice(0, 60)})`,
        identity: {
          ...prev.identity,
          kelas: prefill.kelas,
          fase,
          mapel: prefill.mapel,
          semester: prefill.semester,
          tahunAjaran: prefill.tahunAjaran,
          elemen: prefill.elemen || prev.identity.elemen || '',
          cpText: prefill.cpText,
          materiList: prefill.materiList,
          materiPokok,
        },
        tps: nextTps,
        atps: nextAtps,
        protas: syncedSchedule.protas,
        prosems: syncedSchedule.prosems,
        rpm: nextRpmList[0] || prev.rpm,
        rpmList: nextRpmList,
        agendaHarian: nextAgenda,
        updatedAt: new Date().toISOString(),
      };
    });

    setActiveTab(prefill.targetSection || 'tp-atp');
  };

  if (!selectedTeacher) {
    return (
      <TeacherSelector
        onSelectTeacher={handleSelectTeacher}
        firebaseUser={firebaseUser}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        authLoading={authLoading}
        schoolSettings={schoolSettings}
      />
    );
  }

  const activeTeacherNip =
    schoolSettings.teacherNips[selectedTeacher.id] || selectedTeacher.nip || '';
  const assessmentCount = workspaceItems.filter((i) => i.itemType === 'assessment').length;
  const cpBankCount = workspaceItems.filter((i) => i.itemType === 'cp-materi').length;
  const rpmCount = workspaceItems.filter((i) => i.itemType === 'rpm').length;
  const gameCount = workspaceItems.filter((i) => i.itemType === 'game').length;
  const totalStudentsCount = Object.values(rosters).reduce((acc, list) => acc + list.length, 0);

  const workflowReady = {
    cpMateri: cpBankCount > 0 || Boolean(rpmSuite.identity.cpText?.trim()),
    tpAtp: rpmSuite.tps.length > 0 || rpmSuite.atps.length > 0,
    prota: rpmSuite.protas.length > 0,
    prosem: rpmSuite.prosems.length > 0,
    rpm: (rpmSuite.rpmList?.length || 0) > 0 && rpmSuite.tps.length > 0,
    agenda: rpmSuite.agendaHarian.length > 0,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar
        teacher={selectedTeacher}
        teacherNip={activeTeacherNip}
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab === 'assessment') {
            setEditingAssessment(null);
            setAssessmentPrefill(null);
          }
          if (tab === 'cp-materi') setEditingCpBank(null);
          if (tab === 'game') setEditingGame(null);
          setActiveTab(tab);
        }}
        onSwitchTeacher={handleSwitchTeacher}
        simpleMode={simpleMode}
        onToggleSimpleMode={toggleSimpleMode}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
        <WorkspaceSidebar
          activeTab={activeTab}
          onChangeTab={(tab) => {
            if (tab === 'assessment') {
              setEditingAssessment(null);
              setAssessmentPrefill(null);
            }
            if (tab === 'cp-materi') setEditingCpBank(null);
            if (tab === 'game') setEditingGame(null);
            setActiveTab(tab);
          }}
          counts={{
            cpMateri: cpBankCount,
            assessment: assessmentCount,
            game: gameCount,
            folder: workspaceItems.length,
          }}
          workflowReady={workflowReady}
        />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Teacher Workspace Header */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  {schoolSettings.logoDataUrl && (
                    <img
                      src={schoolSettings.logoDataUrl}
                      alt="Logo Sekolah"
                      className="w-14 h-14 object-contain rounded-xl border border-slate-200 p-1 bg-slate-50 shrink-0"
                    />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-sky-700">
                      {schoolSettings.namaSekolah || 'SD Negeri Lendang Telaga'} · Ruang Kerja Guru
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                      Guru: {selectedTeacher.name}
                    </h1>
                  <div className="text-xs font-mono text-slate-600 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      NIP Guru: {activeTeacherNip || 'Belum diisi (atur di panel bawah)'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Kepala Sekolah: {schoolSettings.kepalaSekolah || 'Belum diisi'}{' '}
                      {schoolSettings.nipKepalaSekolah
                        ? `(NIP. ${schoolSettings.nipKepalaSekolah})`
                        : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                    Alur kerja terstruktur dari input CP &amp; Materi, penyusunan TP &amp; ATP, PROTA, PROSEM (5 minggu/bulan), RPM (1 TP = 1 Pertemuan), Agenda Harian, Asesmen STS/SAS, hingga Game Edukasi dan Folder Saya.
                  </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {firebaseUser ? (
                    <button
                      type="button"
                      onClick={handleGoogleSignOut}
                      disabled={authLoading}
                      className="touch-target px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl inline-flex items-center gap-2 hover:bg-emerald-100 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Cloud Aktif ({firebaseUser.email?.split('@')[0]})</span>
                      <LogOut className="w-3.5 h-3.5 ml-1" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={authLoading}
                      className="touch-target px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                    >
                      <Cloud className="w-4 h-4 text-sky-600" />
                      <span>{authLoading ? 'Menghubungkan...' : 'Hubungkan Cloud Google'}</span>
                      <LogIn className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {!simpleMode && (
                    <a
                      href="/api/export-code"
                      download="portal-guru-sdn-lendang-telaga.zip"
                      className="touch-target px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Unduh Semua Kode (.zip)
                    </a>
                  )}
                </div>
              </div>

              {simpleMode && (
                <SimpleGuideStrip
                  heading="Cara Memakai Portal dalam 3 Langkah Mudah"
                  steps={[
                    {
                      title: '1. Buka CP & Materi',
                      desc: 'Pilih Kelas & Mapel, lalu klik tombol Bank CP BSKAP (4–5 Elemen) agar terisi otomatis.',
                    },
                    {
                      title: '2. Susun Perangkat / Soal',
                      desc: 'Gunakan tombol kuning "Tanpa Kuota" atau tombol otomatis untuk membuat TP-ATP, PROTA, PROSEM, RPM, atau Soal Ujian.',
                    },
                    {
                      title: '3. Simpan & Unduh Word / PDF',
                      desc: 'Klik tombol hijau Simpan, lalu unduh File Word (.doc) untuk diedit atau PDF siap cetak kertas F4/A4.',
                    },
                  ]}
                  tip="Tenang Bapak/Ibu: semua tombol kuning dan Bank CP BSKAP berjalan tanpa kuota dan tanpa batas limit. Jika butuh bantuan kapan saja, klik tombol Bantuan di pojok kanan atas."
                />
              )}

              {/* Status Alur Perangkat Aktif (Mini Stepper 1–6) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="text-xs font-bold text-slate-900">
                    Alur Perangkat Aktif ({rpmSuite.identity.mapel} · Kelas {rpmSuite.identity.kelas})
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Ketuk langkah untuk langsung membuka
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[
                    { id: 'cp-materi' as const, num: 1, label: 'CP & Materi', ready: workflowReady.cpMateri },
                    { id: 'tp-atp' as const, num: 2, label: 'TP & ATP', ready: workflowReady.tpAtp },
                    { id: 'prota' as const, num: 3, label: 'PROTA', ready: workflowReady.prota },
                    { id: 'prosem' as const, num: 4, label: 'PROSEM', ready: workflowReady.prosem },
                    { id: 'rpm' as const, num: 5, label: 'RPM', ready: workflowReady.rpm },
                    { id: 'agenda' as const, num: 6, label: 'Agenda Harian', ready: workflowReady.agenda },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setActiveTab(st.id)}
                      className={`px-3 py-2 rounded-xl border text-left transition-colors flex items-center gap-2 ${
                        st.ready
                          ? 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-50 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md text-[11px] font-mono font-bold flex items-center justify-center shrink-0 tabular-nums ${
                          st.ready
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-500'
                        }`}
                      >
                        {st.ready ? <Check className="w-3 h-3" /> : st.num}
                      </span>
                      <span className="text-xs font-semibold truncate">{st.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Principal & Teacher NIP Settings Card (Compact & Collapsible by Default) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-display font-bold text-sm sm:text-base text-slate-900 truncate">
                        Identitas Sekolah, Kop Surat, Logo &amp; NIP Guru
                      </h2>
                      <p className="text-xs text-slate-500 truncate">
                        {schoolSettings.namaSekolah || 'SD Negeri Lendang Telaga'}
                        {schoolSettings.kepalaSekolah
                          ? ` · Kepsek: ${schoolSettings.kepalaSekolah}`
                          : ''}
                        {activeTeacherNip ? ` · NIP Anda: ${activeTeacherNip}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {showSchoolSettingsForm && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowAllTeacherNips((v) => !v)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                        >
                          <span>NIP Semua Guru ({SDN_LENDANG_TELAGA_TEACHERS.length})</span>
                          {showAllTeacherNips ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveSchoolSettings(schoolSettings)}
                          disabled={savingSettings}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {savingSettings ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowSchoolSettingsForm((v) => !v)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 border transition-colors ${
                        showSchoolSettingsForm
                          ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      <span>{showSchoolSettingsForm ? 'Tutup Pengaturan' : 'Edit Kop & NIP'}</span>
                      {showSchoolSettingsForm ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {showSchoolSettingsForm && (
                  <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Instansi / Pemerintah Daerah
                    </label>
                    <input
                      type="text"
                      value={schoolSettings.pemerintah || ''}
                      onChange={(e) =>
                        setSchoolSettings((prev) => ({
                          ...prev,
                          pemerintah: e.target.value,
                        }))
                      }
                      placeholder="PEMERINTAH KABUPATEN LOMBOK TENGAH"
                      className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Dinas Pendidikan
                    </label>
                    <input
                      type="text"
                      value={schoolSettings.dinas || ''}
                      onChange={(e) =>
                        setSchoolSettings((prev) => ({
                          ...prev,
                          dinas: e.target.value,
                        }))
                      }
                      placeholder="DINAS PENDIDIKAN DAN KEBUDAYAAN"
                      className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Sekolah
                    </label>
                    <input
                      type="text"
                      value={schoolSettings.namaSekolah}
                      onChange={(e) =>
                        setSchoolSettings((prev) => ({
                          ...prev,
                          namaSekolah: e.target.value,
                        }))
                      }
                      placeholder="SD NEGERI LENDANG TELAGA"
                      className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Alamat Sekolah (Kop Surat)
                    </label>
                    <input
                      type="text"
                      value={schoolSettings.alamat || ''}
                      onChange={(e) =>
                        setSchoolSettings((prev) => ({
                          ...prev,
                          alamat: e.target.value,
                        }))
                      }
                      placeholder="Lendang Telaga, Kec. Kopang, Kab. Lombok Tengah"
                      className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Logo Sekolah (Kop Surat)
                    </label>
                    <div className="flex items-center gap-2.5">
                      {schoolSettings.logoDataUrl && (
                        <img
                          src={schoolSettings.logoDataUrl}
                          alt="Preview Logo"
                          className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-slate-50 p-0.5 shrink-0"
                        />
                      )}
                      <label className="cursor-pointer px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5">
                        <ImagePlus className="w-4 h-4 text-sky-600" />
                        <span>{schoolSettings.logoDataUrl ? 'Ganti Logo' : 'Unggah Logo'}</span>
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
                                maxDim: 220,
                                preserveTransparency: true,
                                maxBytes: 75_000,
                              });
                              setSchoolSettings((prev) => ({ ...prev, logoDataUrl: compressed }));
                            } catch {
                              // ignore invalid file
                            }
                          }}
                        />
                      </label>
                      {schoolSettings.logoDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setSchoolSettings((prev) => ({ ...prev, logoDataUrl: '' }))
                          }
                          title="Hapus Logo"
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={schoolSettings.kepalaSekolah}
                      onChange={(e) =>
                        setSchoolSettings((prev) => ({
                          ...prev,
                          kepalaSekolah: e.target.value,
                        }))
                      }
                      placeholder="Contoh: H. Ahmad Fauzi, S.Pd."
                      className="w-full min-h-[40px] px-3 py-2 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NIP Kepala Sekolah
                    </label>
                    <input
                      type="text"
                      value={schoolSettings.nipKepalaSekolah}
                      onChange={(e) =>
                        setSchoolSettings((prev) => ({
                          ...prev,
                          nipKepalaSekolah: e.target.value,
                        }))
                      }
                      placeholder="19xxxxxxxxxxxxxx"
                      className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      NIP Guru Aktif ({selectedTeacher.name})
                    </label>
                    <input
                      type="text"
                      value={schoolSettings.teacherNips[selectedTeacher.id] || ''}
                      onChange={(e) =>
                        setSchoolSettings((prev) => ({
                          ...prev,
                          teacherNips: {
                            ...prev.teacherNips,
                            [selectedTeacher.id]: e.target.value,
                          },
                        }))
                      }
                      placeholder="Masukkan NIP guru..."
                      className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>

                {showAllTeacherNips && (
                  <div className="pt-3 border-t border-slate-200">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Daftar NIP Seluruh Guru SDN Lendang Telaga
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {SDN_LENDANG_TELAGA_TEACHERS.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 border border-slate-200 rounded-xl bg-slate-50 flex flex-col gap-1"
                        >
                          <label className="text-xs font-semibold text-slate-800">{t.name}</label>
                          <input
                            type="text"
                            value={schoolSettings.teacherNips[t.id] || ''}
                            onChange={(e) =>
                              setSchoolSettings((prev) => ({
                                ...prev,
                                teacherNips: {
                                  ...prev.teacherNips,
                                  [t.id]: e.target.value,
                                },
                              }))
                            }
                            placeholder="NIP Guru (opsional)"
                            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                  </>
                )}
              </div>

              {/* Ordered Module Launch Cards matching Workspace Menu */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCpBank(null);
                    setActiveTab('cp-materi');
                  }}
                  className="text-left bg-white border border-slate-200 hover:border-teal-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {cpBankCount} bank tersimpan
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      1. CP dan Materi (Kelas 1–6)
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Input manual CP &amp; Materi per elemen untuk seluruh kelas, generate tabel CP-TP-ATP.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-teal-700">Buka CP &amp; Materi &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tp-atp')}
                  className="text-left bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                      <ListChecks className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {rpmSuite.tps.length} TP · {rpmSuite.atps.length} ATP
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      2. TP dan ATP
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Generate otomatis Tujuan Pembelajaran (TP) &amp; Alur Tujuan Pembelajaran (ATP) siap simpan/cetak.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700">Buka TP &amp; ATP &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('prota')}
                  className="text-left bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                      <CalendarRange className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {rpmSuite.protas.length} baris
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      3. PROTA (Program Tahunan)
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Pembagian semester, materi pokok, dan total alokasi JP dalam satu tahun pelajaran.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700">Buka PROTA &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('prosem')}
                  className="text-left bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      5 minggu/bulan
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      4. PROSEM (Program Semester)
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Matriks 5 minggu tiap bulan tanpa centang otomatis (bebas centang manual sesuai kalender sekolah).
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700">Buka PROSEM &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('rpm')}
                  className="text-left bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                      <BookOpenCheck className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {(rpmSuite.rpmList?.length || 1)} pertemuan · {rpmCount} arsip
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      5. RPM (Pembelajaran Mendalam)
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Mendukung 1 TP = 1 Kali Pertemuan (atau gabungan), lengkap LKPD &amp; Rubrik 4 skala.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700">Buka RPM &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('agenda')}
                  className="text-left bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {rpmSuite.agendaHarian.length} pertemuan
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      6. Agenda Harian Guru
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Jurnal pelaksanaan harian per pertemuan beserta kolom refleksi dan tindak lanjut.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-700">Buka Agenda Harian &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingAssessment(null);
                    setAssessmentPrefill(null);
                    setActiveTab('assessment');
                  }}
                  className="text-left bg-white border border-slate-200 hover:border-sky-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {assessmentCount} tersimpan
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      7. Asesmen STS &amp; SAS
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Kisi-kisi, naskah soal, kunci jawaban, rubrik penskoran, dan daftar nilai siap cetak A4/F4.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-sky-700">Buka Asesmen &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingGame(null);
                    setActiveTab('game');
                  }}
                  className="text-left bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {gameCount} tersimpan
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      8. Game Edukasi Interaktif
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Lomba Lari, Teka-Teki Silang, Susun Kata, &amp; Pacuan Kuda untuk PID &amp; HP siswa.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700">Buka Game Edukasi &rarr;</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('folder')}
                  className="text-left bg-white border border-slate-200 hover:border-amber-500 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                      {workspaceItems.length} file · {totalStudentsCount} siswa
                    </span>
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base text-slate-900">
                      9. Folder Saya
                    </h2>
                    <p className="text-xs text-slate-600 mt-1">
                      Semua file kerja guru tersimpan rapi untuk dibuka kembali, diunduh PDF/Word/ZIP, atau dicetak.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-amber-700">Buka Folder Saya &rarr;</span>
                </button>
              </div>

              {loadingWorkspace && (
                <div className="text-xs text-slate-500">Menyinkronkan data ruang kerja...</div>
              )}

              {/* Integrated Class Roster Manager (Kelas 1-6) */}
              <RosterManager
                rosters={rosters}
                selectedKelas={rosterKelas}
                onSelectKelas={setRosterKelas}
                onSaveRoster={handleSaveRoster}
              />
            </div>
          )}

          {activeTab === 'cp-materi' && (
            <CpMateriManager
              teacher={selectedTeacher}
              workspaceItems={workspaceItems}
              initialBank={editingCpBank}
              onSaveToFolder={handleSaveToFolder}
              onSendToRpmGenerator={handleReceiveCpMateriPrefill}
              onOpenRpmWizard={() => setActiveTab('tp-atp')}
              simpleMode={simpleMode}
            />
          )}

          {isRpmSectionTab(activeTab) && (
            <RpmWizard
              teacher={selectedTeacher}
              suiteDoc={rpmSuite}
              onChangeSuiteDoc={setRpmSuite}
              activeSection={activeTab}
              onChangeSection={(sec) => setActiveTab(sec)}
              schoolSettings={schoolSettings}
              onSaveSchoolSettings={handleSaveSchoolSettings}
              onOpenCpMateriBank={() => setActiveTab('cp-materi')}
              onContinueToAssessment={() => {
                const rawTps =
                  rpmSuite.tps.length > 0
                    ? rpmSuite.tps.map((t) => t.rumusan.replace(/^\d+[.)]\s*/, '').trim())
                    : rpmSuite.atps.map((a) =>
                        a.tujuanPembelajaran
                          .replace(/^\d+\.\d+\.\d+\s+/, '')
                          .replace(/^(Murid|Peserta didik)\s+(dapat|mampu)\s+/i, '')
                          .trim()
                      );
                const cleanTps = rawTps
                  .filter(Boolean)
                  .map((body) =>
                    /^(murid|peserta didik|siswa)\s/i.test(body) ? body : `Murid mampu ${body}`
                  );
                setEditingAssessment(null);
                setAssessmentPrefill({
                  mapel: rpmSuite.identity.mapel,
                  kelas: rpmSuite.identity.kelas,
                  semester: rpmSuite.identity.semester,
                  tahunAjaran: rpmSuite.identity.tahunAjaran,
                  paperSize: rpmSuite.identity.paperSize,
                  tps: cleanTps,
                });
                setActiveTab('assessment');
              }}
              onSaveToFolder={handleSaveToFolder}
              simpleMode={simpleMode}
            />
          )}

          {activeTab === 'assessment' && (
            <AssessmentWizard
              teacher={selectedTeacher}
              rosters={rosters}
              initialDoc={editingAssessment}
              prefillFromRpm={assessmentPrefill}
              schoolSettings={schoolSettings}
              onSaveToFolder={handleSaveToFolder}
              simpleMode={simpleMode}
            />
          )}

          {activeTab === 'game' && (
            <GameBuilder
              teacher={selectedTeacher}
              rosters={rosters}
              initialGame={editingGame}
              onSaveToFolder={handleSaveToFolder}
              onLaunchGame={(game, initialView) => {
                setArenaInitialView(
                  initialView || (game.playMode === 'live-mobile' ? 'monitor' : 'play')
                );
                setActiveArenaGame(game);
              }}
              simpleMode={simpleMode}
            />
          )}

          {activeTab === 'folder' && (
            <FolderSayaView
              teacher={selectedTeacher}
              schoolSettings={schoolSettings}
              items={workspaceItems}
              simpleMode={simpleMode}
              onEditAssessment={(doc) => {
                setEditingAssessment(doc);
                setActiveTab('assessment');
              }}
              onPrintAssessment={(doc) => {
                setEditingAssessment(doc);
                setActiveTab('assessment');
              }}
              onDownloadAssessmentPDF={(doc) =>
                downloadAssessmentPDF(doc, rosters[doc.identity.kelas] || [], schoolSettings)
              }
              onDownloadAssessmentWord={(doc) =>
                downloadAssessmentWord(doc, rosters[doc.identity.kelas] || [], schoolSettings)
              }
              onEditRpm={(doc) => {
                const normalized: RpmSuiteDoc = {
                  ...doc,
                  teachingMode: doc.teachingMode || 'per-tp',
                  rpmList:
                    doc.rpmList && doc.rpmList.length > 0 ? doc.rpmList : [doc.rpm],
                };
                setRpmSuite(normalized);
                setActiveTab(mapDocKindToTab(doc.docKind));
              }}
              onOpenCpMateri={(bank) => {
                setEditingCpBank(bank);
                setActiveTab('cp-materi');
              }}
              onEditGame={(game) => {
                setEditingGame(game);
                setActiveTab('game');
              }}
              onPlayGame={(game) => {
                setArenaInitialView(game.playMode === 'live-mobile' ? 'monitor' : 'play');
                setActiveArenaGame(game);
              }}
              onMonitorGame={(game) => {
                setArenaInitialView('monitor');
                setActiveArenaGame(game);
              }}
              onDeleteItem={handleDeleteItem}
            />
          )}
        </main>
      </div>

      {activeArenaGame && (
        <GameArenaModal
          game={activeArenaGame}
          teacherId={selectedTeacher.id}
          initialView={arenaInitialView}
          onClose={() => setActiveArenaGame(null)}
        />
      )}

      <TeacherHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        simpleMode={simpleMode}
        onToggleSimpleMode={toggleSimpleMode}
      />

      <FloatingToast
        successMsg={settingsSavedMsg}
        errorMsg={authErrorMsg}
        onDismissSuccess={() => setSettingsSavedMsg(null)}
        onDismissError={() => setAuthErrorMsg(null)}
      />
    </div>
  );
}

export default function App() {
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const playGameId = searchParams?.get('play');
  const playRoomCode = searchParams?.get('room') || '';

  return (
    <ErrorBoundary>
      {playGameId ? (
        <StudentPlayView gameId={playGameId} roomCode={playRoomCode} />
      ) : (
        <PortalWorkspace />
      )}
      <OfflineIndicator />
    </ErrorBoundary>
  );
}
