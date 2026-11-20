import { BookOpen, CheckCircle2, FileDown, Gamepad2, HelpCircle, X, Zap } from 'lucide-react';

interface TeacherHelpModalProps {
  open: boolean;
  onClose: () => void;
  simpleMode: boolean;
  onToggleSimpleMode: () => void;
}

export function TeacherHelpModal({
  open,
  onClose,
  simpleMode,
  onToggleSimpleMode,
}: TeacherHelpModalProps) {
  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Panduan Penggunaan Portal Guru"
    >
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-slate-900">
                Panduan Singkat untuk Guru
              </h2>
              <p className="text-xs text-slate-500">
                Cara mudah menyusun perangkat ajar, soal ujian, dan game kelas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Tutup Bantuan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm text-slate-700">
          {/* 3 Langkah Utama */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide text-sky-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-700" />
              3 Langkah Dasar Membuat Perangkat Ajar
            </div>
            <ol className="space-y-2 text-xs text-slate-700 leading-relaxed list-decimal list-inside">
              <li>
                <strong>Pilih Kelas &amp; Mapel di Menu CP &amp; Materi:</strong> Klik tombol biru{' '}
                <strong>Bank CP BSKAP (4–5 Elemen)</strong> untuk langsung memuat CP, Materi, TP, dan ATP lengkap tanpa mengetik dari nol.
              </li>
              <li>
                <strong>Kirim ke Menu TP &amp; ATP / RPM:</strong> Klik{' '}
                <strong>Lanjut ke TP &amp; ATP</strong>, lalu klik tombol kuning{' '}
                <strong>Susun Cepat Tanpa Kuota</strong> (atau tombol otomatis) untuk membuat 1 Lembar TP-ATP, PROTA, PROSEM, RPM, dan Agenda Harian sekaligus.
              </li>
              <li>
                <strong>Simpan &amp; Unduh Word / PDF:</strong> Klik tombol hijau{' '}
                <strong>Simpan</strong> agar tersimpan di <strong>Folder Saya</strong>, lalu unduh menjadi file <strong>Word (.doc)</strong> jika ingin diedit, atau <strong>PDF</strong> jika langsung dicetak pada kertas F4/A4.
              </li>
            </ol>
          </div>

          {/* Penjelasan Tanpa Kuota */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-amber-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-700" />
              Cara Kerja Tanpa Kuota / Tanpa Batas Limit
            </div>
            <p className="text-xs text-amber-950 leading-relaxed">
              Seluruh menu di portal ini dilengkapi <strong>Mesin Lokal Tanpa Kuota</strong>. Artinya:
            </p>
            <ul className="space-y-1.5 text-xs text-amber-950 list-disc list-inside leading-relaxed">
              <li>
                Jika suatu saat kuota bantuan AI harian habis, Bapak/Ibu tetap bisa menggunakan tombol kuning{' '}
                <strong>Susun Cepat Lokal (Tanpa AI)</strong> maupun{' '}
                <strong>Bank CP BSKAP (4–5 Elemen)</strong> dan <strong>150 Bank Soal Game</strong> tanpa batas waktu.
              </li>
              <li>
                Bahkan jika tombol AI diklik saat kuota penuh, portal akan{' '}
                <strong>otomatis beralih ke Mesin Lokal</strong> sehingga pekerjaan tidak pernah gagal atau macet.
              </li>
              <li>
                Simpan data, edit teks, unduh Word/PDF, cetak kertas F4/A4, dan permainan QR kelas{' '}
                <strong>100% gratis dan bebas kuota selamanya</strong>.
              </li>
            </ul>
          </div>

          {/* Arti Warna Tombol & Game QR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileDown className="w-4 h-4 text-sky-600" />
                Arti Warna Tombol di Portal
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <strong className="text-emerald-700">Tombol Hijau:</strong> Menyimpan hasil kerja ke Folder Saya.
                </li>
                <li>
                  <strong className="text-sky-700">Tombol Biru / Hitam:</strong> Mengunduh file Word (.doc), PDF (.pdf), atau mencetak.
                </li>
                <li>
                  <strong className="text-amber-700">Tombol Kuning:</strong> Susun cepat langsung tanpa kuota AI.
                </li>
                <li>
                  <strong className="text-rose-700">Tombol Merah:</strong> Menghapus baris atau file.
                </li>
              </ul>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-emerald-600" />
                Game Kelas &amp; Scan QR Siswa
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Di menu <strong>Game Edukasi</strong>, klik <strong>Barcode / QR Scan</strong> untuk menampilkan kode QR di layar PID/proyektor. Siswa tinggal memindai lewat kamera HP, memilih nama kelasnya, dan nilai otomatis masuk ke{' '}
                <strong>Rekap Nilai Game</strong> di Folder Saya (bisa diunduh Word/PDF).
              </p>
            </div>
          </div>

          {/* Mode Tampilan Switch */}
          <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Mode Tampilan Saat Ini: {simpleMode ? 'Mode Sederhana (Ramah Pemula)' : 'Mode Lengkap'}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Mode Sederhana menampilkan panduan 3 langkah, bahasa tombol yang lebih mudah dipahami, dan panel lipat yang ringkas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleSimpleMode}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-colors"
            >
              {simpleMode ? 'Beralih ke Mode Lengkap' : 'Aktifkan Mode Sederhana'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
