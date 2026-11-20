import { ArrowRight, Cloud, LogIn, LogOut, School, ShieldCheck } from 'lucide-react';
import {
  getInitials,
  SCHOOL_INFO,
  SDN_LENDANG_TELAGA_TEACHERS,
  TEACHER_ACCENT_COLORS,
} from '../constants/school';
import { SchoolTeacherSettings, TeacherProfile } from '../types/portal';
import { PWAInstallButton } from './PWAInstallButton';

interface TeacherSelectorProps {
  onSelectTeacher: (teacher: TeacherProfile) => void;
  firebaseUser: User | null;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  authLoading: boolean;
  schoolSettings?: SchoolTeacherSettings;
}

import { User } from 'firebase/auth';

export function TeacherSelector({
  onSelectTeacher,
  firebaseUser,
  onGoogleSignIn,
  onGoogleSignOut,
  authLoading,
  schoolSettings,
}: TeacherSelectorProps) {
  const schoolName = schoolSettings?.namaSekolah || SCHOOL_INFO.namaSekolah;
  const schoolAddr = schoolSettings?.alamat || SCHOOL_INFO.alamat;
  const logoUrl = schoolSettings?.logoDataUrl || '';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* School Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-900 via-sky-800 to-teal-800 text-white p-6 sm:p-8 shadow-sm">
          {/* Subtle architectural accent pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 w-72 h-72 rounded-full bg-teal-400/15 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -bottom-24 w-64 h-64 rounded-full bg-sky-300/10 blur-2xl"
          />

          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white border border-white/20 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`Logo ${schoolName}`}
                    className="w-14 h-14 object-contain"
                  />
                ) : (
                  <School className="w-8 h-8 text-sky-700" />
                )}
              </div>
              <div>
                <div className="text-xs sm:text-sm font-medium text-sky-100 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-white">{schoolName}</span>
                  <span aria-hidden="true">·</span>
                  <span>Tahun Pelajaran 2026/2027</span>
                  <span aria-hidden="true">·</span>
                  <span>Ruang Kerja Digital Terpadu</span>
                </div>
                <h1 className="mt-1.5 text-2xl sm:text-4xl font-bold tracking-tight text-white max-w-2xl text-balance">
                  Pilih Profil Guru untuk Masuk Ruang Kerja
                </h1>
                <p className="mt-2.5 text-sm sm:text-base text-sky-100/90 max-w-2xl leading-relaxed">
                  Ketuk nama Anda untuk mengakses CP &amp; Materi BSKAP, TP &amp; ATP, PROTA, PROSEM, RPM, Agenda Harian, Asesmen STS/SAS, Game Edukasi, dan Folder Saya.
                </p>
                <div className="mt-3 text-xs text-sky-100/80 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{schoolAddr}</span>
                  {schoolSettings?.kepalaSekolah && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Kepala Sekolah: {schoolSettings.kepalaSekolah}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <div className="self-start sm:self-auto">
                <PWAInstallButton />
              </div>
              <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3.5 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white shrink-0">
                    {firebaseUser ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-300" />
                    ) : (
                      <Cloud className="w-5 h-5 text-sky-200" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {firebaseUser ? 'Cloud Firestore Aktif' : 'Sinkronisasi Cloud Opsional'}
                    </div>
                    <div className="text-xs text-sky-100/80 max-w-[210px] truncate">
                      {firebaseUser
                        ? firebaseUser.email || firebaseUser.displayName
                        : 'Cadangkan ke akun Google atau pakai langsung'}
                    </div>
                  </div>
                </div>
                {firebaseUser ? (
                  <button
                    type="button"
                    onClick={onGoogleSignOut}
                    disabled={authLoading}
                    className="touch-target px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-sky-50 rounded-xl transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar Google
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    disabled={authLoading}
                    className="touch-target px-4 py-2 text-xs font-semibold text-sky-950 bg-white hover:bg-sky-50 rounded-xl transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-4 h-4 text-sky-700" />
                    {authLoading ? 'Menghubungkan...' : 'Masuk Google'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7" aria-label="Daftar Guru SDN Lendang Telaga">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
              Daftar Profil Guru ({SDN_LENDANG_TELAGA_TEACHERS.length} Guru)
            </h2>
            <span className="text-xs text-slate-500">
              Pilih kartu nama untuk membuka perangkat mengajar
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {SDN_LENDANG_TELAGA_TEACHERS.map((teacher, idx) => {
              const accentClass = TEACHER_ACCENT_COLORS[idx % TEACHER_ACCENT_COLORS.length];
              const savedNip = schoolSettings?.teacherNips?.[teacher.id];
              return (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => onSelectTeacher(teacher)}
                  className="group text-left bg-white border border-slate-200 hover:border-sky-500 hover:shadow-md hover:-translate-y-0.5 rounded-2xl p-5 transition-all duration-150 flex flex-col justify-between min-h-[148px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-base shrink-0 shadow-xs ${accentClass}`}
                    >
                      {getInitials(teacher.name)}
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-400 group-hover:text-sky-600 transition-colors tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="font-display font-semibold text-base text-slate-900 group-hover:text-sky-700 transition-colors leading-snug">
                      {teacher.name}
                    </div>
                    {savedNip && (
                      <div className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums">
                        NIP. {savedNip}
                      </div>
                    )}
                    <div className="mt-2.5 text-xs font-semibold text-sky-600 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Masuk Ruang Kerja</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {schoolName} · {schoolAddr}
          </span>
          <span>Ramah Papan Interaktif Digital (PID), Laptop, dan HP Siswa</span>
        </div>
      </footer>
    </div>
  );
}
