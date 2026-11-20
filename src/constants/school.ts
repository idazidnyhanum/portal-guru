import { ClassRosterMap, MapelName, TeacherProfile } from '../types/portal';

export const SCHOOL_INFO = {
  pemerintah: 'PEMERINTAH KABUPATEN LOMBOK TENGAH',
  dinas: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
  namaSekolah: 'SD NEGERI LENDANG TELAGA',
  alamat: 'Lendang Telaga, Kecamatan Kopang, Kabupaten Lombok Tengah, NTB',
};

// Daftar khusus 10 guru SDN Lendang Telaga (hanya nama lengkap, tanpa keterangan jabatan)
export const SDN_LENDANG_TELAGA_TEACHERS: TeacherProfile[] = [
  { id: 'asiah', name: 'Asiah, S.Pd' },
  { id: 'baiq-muslihati', name: 'Baiq Muslihati, S.Pd' },
  { id: 'zuhratul-aini', name: 'Zuhratul Aini, S.Pd' },
  { id: 'mukminah', name: 'Mukminah, S.Pd' },
  { id: 'lita-sumiyarti', name: 'Lita Sumiyarti, S.Pd' },
  { id: 'baiq-aprilianingsih', name: 'Baiq Aprilianingsih, S.Pd' },
  { id: 'd-syahminan-zidny', name: 'D. Syahminan Zidny, S.Pd.I' },
  { id: 'muhamad-subayyil', name: 'Muhamad Subayyil, S.Pd' },
  { id: 'pihirman', name: 'Pihirman, S.Pd' },
  { id: 'zurriatun-thoyyibah', name: 'Zurriatun Thoyyibah, S.Pd' },
];

export const MAPEL_LIST: MapelName[] = [
  'PKn',
  'Muatan Lokal',
  'Matematika',
  'Bahasa Indonesia',
  'Seni Budaya',
  'PJOK',
  'Bahasa Inggris',
  'IPAS',
  'PAI BP',
];

export function getFaseByKelas(kelas: number): 'Fase A' | 'Fase B' | 'Fase C' {
  if (kelas <= 2) return 'Fase A';
  if (kelas <= 4) return 'Fase B';
  return 'Fase C';
}

export function getInitials(name: string): string {
  const clean = name.replace(/,.*$/, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const TEACHER_ACCENT_COLORS = [
  'bg-sky-600 text-white',
  'bg-emerald-600 text-white',
  'bg-amber-600 text-white',
  'bg-indigo-600 text-white',
  'bg-rose-600 text-white',
  'bg-teal-600 text-white',
  'bg-cyan-700 text-white',
  'bg-orange-600 text-white',
  'bg-blue-700 text-white',
  'bg-violet-600 text-white',
];

export function createDefaultRosters(): ClassRosterMap {
  return {
    1: [
      'Ahmad Fauzan',
      'Baiq Alya Zahira',
      'Lalu Rizky Pratama',
      'Nayla Putri Azzahra',
      'Muhammad Rafa',
      'Siti Khadijah',
      'Zidan Alfarizi',
      'Aisyah Rahmadani',
    ],
    2: [
      'Arkanza Putra',
      'Baiq Nabila Safitri',
      'Fajar Ramadhan',
      'Hafizah Nurul Aini',
      'Lalu Adrian Maulana',
      'Miftahul Jannah',
      'Rizwan Hadi',
      'Syifa Kamila',
    ],
    3: [
      'Ahmad Zaki Mubarak',
      'Baiq Cinta Lestari',
      'Daffa Al-Ghazali',
      'Fitriani Hasanah',
      'Haikal Saputra',
      'Khadijah Azkia',
      'Lalu Gilang Permana',
      'Zahra Humaira',
    ],
    4: [
      'Alif Naufal',
      'Baiq Raisya Amelia',
      'Dimas Kurniawan',
      'Intan Permata Sari',
      'Lalu Fadlan Hakim',
      'Nadia Safira',
      'Rendi Wijaya',
      'Salwa Maulida',
    ],
    5: [
      'Aditya Pratama',
      'Baiq Kartika Putri',
      'Farhan Hidayat',
      'Keysia Ananda',
      'Lalu Bagus Setiawan',
      'Mutiara Salsabila',
      'Rifqi Al-Faruq',
      'Wulan Ramadhani',
    ],
    6: [
      'Akbar Maulana',
      'Baiq Syakira Azzahra',
      'Farel Putra Utama',
      'Husna Aulia',
      'Lalu Nabil Alamsyah',
      'Putri Maharani',
      'Raka Dwi Saputra',
      'Tasya Nurhaliza',
    ],
  };
}
