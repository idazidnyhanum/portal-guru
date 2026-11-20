export interface TeacherProfile {
  id: string;
  name: string;
  nip?: string;
}

export interface SchoolTeacherSettings {
  pemerintah?: string;
  dinas?: string;
  namaSekolah: string;
  alamat?: string;
  logoDataUrl?: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  teacherNips: Record<string, string>;
}

export type MapelName =
  | 'PKn'
  | 'Muatan Lokal'
  | 'Matematika'
  | 'Bahasa Indonesia'
  | 'Seni Budaya'
  | 'PJOK'
  | 'Bahasa Inggris'
  | 'IPAS'
  | 'PAI BP';

export type ExamType = 'STS' | 'SAS';
export type PaperSize = 'A4' | 'F4';
export type SemesterType = 'Ganjil' | 'Genap';
export type QuestionType = 'pg' | 'isian' | 'uraian' | 'menjodohkan';
export type DifficultyLevel = 'Mudah' | 'Sedang' | 'Sulit';

export interface QuestionComposition {
  pg: number;
  isian: number;
  uraian: number;
  menjodohkan: number;
}

export interface DifficultyProportion {
  mudah: number;
  sedang: number;
  sulit: number;
}

export interface KisiKisiRow {
  id: string;
  noSoal: number;
  tpIndex: number;
  tpText: string;
  materiPokok: string;
  indikatorSoal: string;
  levelKognitif: 'L1' | 'L2' | 'L3';
  kesulitan: DifficultyLevel;
  bentukSoal: QuestionType;
}

export interface AssessmentQuestion {
  id: string;
  nomor: number;
  bentuk: QuestionType;
  kesulitan: DifficultyLevel;
  tpIndex: number;
  pertanyaan: string;
  imageDataUrl?: string;
  opsi?: {
    A: string;
    B: string;
    C: string;
    D?: string;
  };
  kunciJawaban: string;
  rubrikSkor: string;
  skorMaks: number;
}

export interface StudentGradeEntry {
  name: string;
  score: number;
  note?: string;
}

export interface AssessmentIdentity {
  examType: ExamType;
  kelas: number;
  fase: 'Fase A' | 'Fase B' | 'Fase C';
  paperSize: PaperSize;
  semester: SemesterType;
  tahunAjaran: string;
  mapel: MapelName;
  tps: string[];
  namaPenyusun?: string;
  nipPenyusun?: string;
  kepalaSekolah?: string;
  nipKepalaSekolah?: string;
}

export interface AssessmentDoc {
  id: string;
  title: string;
  teacherId: string;
  teacherName: string;
  identity: AssessmentIdentity;
  composition: QuestionComposition;
  difficulty: DifficultyProportion;
  kisiRows: KisiKisiRow[];
  questions: AssessmentQuestion[];
  kktp?: number;
  studentGrades?: StudentGradeEntry[];
  updatedAt: string;
}

export interface GameScoreEntry {
  name: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  accuracyPct: number;
}

export interface GameScoreRecord {
  id: string;
  teacherId: string;
  gameId: string;
  gameTitle: string;
  mapel: MapelName;
  kelas: number;
  roomCode: string;
  savedAt: string;
  entries: GameScoreEntry[];
}

export type GameTemplate = 'running-race' | 'crossword' | 'word-scramble' | 'horse-race';
export type GamePlayMode = 'single' | 'pid-multiplayer' | 'live-mobile';

export interface GameQuestionItem {
  id: string;
  prompt: string;
  answer: string;
  options?: string[];
  clue?: string;
}

export interface GameDoc {
  id: string;
  title: string;
  topic: string;
  teacherId: string;
  teacherName: string;
  mapel: MapelName;
  kelas: number;
  template: GameTemplate;
  playMode: GamePlayMode;
  items: GameQuestionItem[];
  players: string[];
  updatedAt: string;
}

export type RpmDocKind = 'suite' | 'tp-atp' | 'tp' | 'atp' | 'prota' | 'prosem' | 'rpm' | 'agenda';
export type RpmTeachingMode = 'per-tp' | 'combined';

export interface RpmTpItem {
  id: string;
  kode: string;
  materiTerkait: string;
  rumusan: string;
  kompetensi: string;
  jp: number;
}

export interface RpmAtpRow {
  id: string;
  urut: number;
  kodeTp: string;
  tujuanPembelajaran: string;
  materiPokok: string;
  dimensiProfil: string;
  alokasiJp: number;
  semester: string;
  indikatorKetercapaian: string;
}

export interface RpmProtaRow {
  id: string;
  no: number;
  semester: string;
  materiPokok: string;
  alokasiJp: number;
  bulanKeterangan: string;
}

export interface RpmProsemRow {
  id: string;
  no: number;
  semester: string;
  kodeTp: string;
  materiPokok: string;
  alokasiJp: number;
  bulanMinggu: string[];
}

export interface RpmLkpdActivity1Row {
  no: number;
  item: string;
  promptIsian: string;
}

export interface RpmLkpdCase {
  judulKasus: string;
  ceritaMasalah: string;
  pertanyaan1: string;
  pertanyaan2: string;
}

export interface RpmRubricRow {
  aspek: string;
  skor4: string;
  skor3: string;
  skor2: string;
  skor1: string;
}

export interface RpmLessonPlan {
  pertemuanKe?: number;
  kodeTp?: string;
  judulPertemuan?: string;
  capaianPembelajaran: string;
  tujuanPembelajaran: string[];
  dimensiProfilLulusan: string;
  lintasDisiplinIlmu?: string;
  pemanfaatanDigital?: string;
  pendekatanModel: string;
  saranaMedia: string;
  kegiatanAwal: {
    durasi: string;
    label: string;
    langkah: string[];
  };
  kegiatanInti: {
    durasi: string;
    label: string;
    langkah: string[];
  };
  kegiatanPenutup: {
    durasi: string;
    label: string;
    langkah: string[];
  };
  asesmenAwal: string;
  asesmenFormatif: string;
  asesmenSumatif: string;
  tindakLanjutPengayaan: string;
  tindakLanjutRemedial: string;
  lkpd: {
    judulAktivitas1: string;
    kolomHeader1: string;
    kolomHeader2: string;
    aktivitas1Rows: RpmLkpdActivity1Row[];
    judulAktivitas2: string;
    aktivitas2Cases: RpmLkpdCase[];
    judulAktivitas3: string;
    promptAktivitas3: string;
  };
  rubrikRows: RpmRubricRow[];
}

export interface RpmAgendaRow {
  id: string;
  pertemuanKe: number;
  hariTanggal: string;
  jamAlokasi: string;
  kelas: string;
  mapel: string;
  materiPokok: string;
  kegiatanIntiRingkas: string;
  mediaLkpd: string;
  catatanKetercapaian: string;
}

export interface CpMateriEntry {
  id: string;
  elemen: string;
  cpText: string;
  materiBab: string;
  semester: 'I' | 'II';
  alokasiJp: number;
  tps: string[];
  atps: string[];
}

export interface CpMateriBankDoc {
  id: string;
  teacherId: string;
  kelas: number;
  fase: 'Fase A' | 'Fase B' | 'Fase C';
  mapel: MapelName;
  tahunAjaran: string;
  entries: CpMateriEntry[];
  updatedAt: string;
}

export interface RpmIdentity {
  namaPenyusun: string;
  nipPenyusun: string;
  instansi: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  kotaTanggal: string;
  tahunAjaran: string;
  semester: SemesterType;
  kelas: number;
  fase: 'Fase A' | 'Fase B' | 'Fase C';
  mapel: MapelName;
  elemen?: string;
  materiPokok: string;
  materiList: string[];
  cpText: string;
  alokasiWaktu: string;
  paperSize: PaperSize;
}

export interface RpmSuiteDoc {
  id: string;
  docKind: RpmDocKind;
  teachingMode?: RpmTeachingMode;
  title: string;
  teacherId: string;
  teacherName: string;
  identity: RpmIdentity;
  tps: RpmTpItem[];
  atps: RpmAtpRow[];
  protas: RpmProtaRow[];
  prosems: RpmProsemRow[];
  rpm: RpmLessonPlan;
  rpmList?: RpmLessonPlan[];
  agendaHarian: RpmAgendaRow[];
  updatedAt: string;
}

export type WorkspaceItemType = 'assessment' | 'game' | 'rpm' | 'cp-materi';

export interface WorkspaceItemRecord {
  id: string;
  teacherId: string;
  itemType: WorkspaceItemType;
  title: string;
  mapel: MapelName;
  kelas: number;
  createdAt: string;
  updatedAt: string;
  payload: AssessmentDoc | GameDoc | RpmSuiteDoc | CpMateriBankDoc;
}

export type ClassRosterMap = Record<number, string[]>;

export interface LivePlayerState {
  playerId: string;
  name: string;
  score: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  progress: number;
  streak: number;
  turboActive: boolean;
  finished: boolean;
  finishTimeMs: number | null;
  connected: boolean;
  lastAction?: string;
}

export interface LiveRoomEvent {
  id: string;
  time: string;
  message: string;
}

export interface LiveRoomState {
  roomCode: string;
  gameId: string;
  gameTitle: string;
  template: GameTemplate;
  status: 'waiting' | 'playing' | 'finished';
  resetVersion?: number;
  players: LivePlayerState[];
  events?: LiveRoomEvent[];
  updatedAt: number;
}
