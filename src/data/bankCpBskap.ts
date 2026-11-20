import { MapelName } from '../types/portal';

/**
 * Bank CP Resmi Kurikulum Merdeka SD
 * Acuan: Keputusan Kepala BSKAP Nomor 046/H/KR/2025 (16 Juli 2025, tindak lanjut Permendikdasmen No. 13 Tahun 2025),
 * menggantikan SK BSKAP Nomor 032/H/KR/2024 dan menggunakan istilah subjek belajar "Murid".
 */
export interface BskapCpPreset {
  id: string;
  mapel: MapelName;
  fase: 'Fase A' | 'Fase B' | 'Fase C';
  kelasList: number[];
  elemen: string;
  cpText: string;
  materiBab: string;
  semester: 'I' | 'II';
  alokasiJp: number;
}

export const BANK_CP_BSKAP: BskapCpPreset[] = [
  // ========================
  // 1. PAI BP (5 ELEMEN — Acuan BSKAP 046/H/KR/2025)
  // ========================
  // Fase A (Kelas 1 & 2)
  {
    id: 'pai-a-1',
    mapel: 'PAI BP',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Al-Qur’an dan Hadis',
    cpText:
      'Murid memahami huruf hijaiah berharakat, huruf hijaiah bersambung, Surah al-Fātiḥah, beberapa surah pendek Al-Qur’an, dan hadis tentang kebersihan.',
    materiBab: 'BAB 1: Mengenal Huruf Hijaiah, Surah al-Fātiḥah, dan Hadis Kebersihan',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pai-a-2',
    mapel: 'PAI BP',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Akidah',
    cpText:
      'Murid memahami rukun iman, iman kepada Allah Swt., beberapa asmaulhusna, dan iman kepada malaikat.',
    materiBab: 'BAB 2: Rukun Iman dan Mengenal Asmaulhusna',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'pai-a-3',
    mapel: 'PAI BP',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Akhlak',
    cpText:
      'Murid memahami akhlak terhadap Allah Swt. dengan menyucikan dan memuji-Nya serta akhlak terhadap diri sendiri.',
    materiBab: 'BAB 3: Membiasakan Basmalah, Hamdalah, dan Akhlak Mulia terhadap Diri Sendiri',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'pai-a-4',
    mapel: 'PAI BP',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Fikih',
    cpText:
      'Murid memahami rukun Islam, syahadatain, tata cara bersuci, salat fardu, azan, ikamah, zikir, dan doa setelah salat.',
    materiBab: 'BAB 4: Rukun Islam, Tata Cara Bersuci (Wudu), Salat Fardu, Zikir, dan Doa',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pai-a-5',
    mapel: 'PAI BP',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Sejarah Peradaban Islam',
    cpText:
      'Murid memahami kisah beberapa nabi dan rasul.',
    materiBab: 'BAB 5: Meneladani Kisah Nabi Adam a.s., Nabi Nuh a.s., Nabi Ibrahim a.s., dan Nabi Muhammad saw.',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase B (Kelas 3 & 4)
  {
    id: 'pai-b-1',
    mapel: 'PAI BP',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Al-Qur’an dan Hadis',
    cpText:
      'Murid memahami beberapa surah pendek, ayat Al-Qur’an, dan hadis tentang kewajiban salat dan menjaga hubungan baik dengan sesama.',
    materiBab: 'BAB 1: Mengaji Q.S. Al-Ḥujurāt/49:13 dan Hadis Kewajiban Salat & Hubungan Baik Sesama',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pai-b-2',
    mapel: 'PAI BP',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Akidah',
    cpText:
      'Murid memahami sifat-sifat Allah Swt., beberapa asmaulhusna, iman kepada kitab-kitab Allah Swt., dan rasul-rasul Allah Swt.',
    materiBab: 'BAB 2: Teladan Mulia Asmaulhusna serta Iman kepada Kitab dan Rasul Allah Swt.',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'pai-b-3',
    mapel: 'PAI BP',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Akhlak',
    cpText:
      'Murid memahami akhlak terhadap Allah Swt. dengan berbaik sangka kepada-Nya, akhlak terhadap orang tua, keluarga, dan guru, serta keragaman sebagai sunnatullah.',
    materiBab: 'BAB 3: Berbaik Sangka kepada Allah, Hormat Orang Tua/Guru, dan Keragaman sebagai Sunnatullah',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'pai-b-4',
    mapel: 'PAI BP',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Fikih',
    cpText:
      'Murid memahami puasa, salat Jumat dan salat sunah, serta tanda-tanda balig dan tanggung jawab yang menyertainya (taklīf).',
    materiBab: 'BAB 4: Menyambut Usia Balig (Taklīf), Ketentuan Puasa, Salat Jumat, dan Salat Sunah',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pai-b-5',
    mapel: 'PAI BP',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Sejarah Peradaban Islam',
    cpText:
      'Murid memahami kisah Nabi Muhammad saw. sebelum dan sesudah menjadi rasul periode Makkah.',
    materiBab: 'BAB 5: Kisah Keteladanan Nabi Muhammad saw. Periode Makkah',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'pai-c-1',
    mapel: 'PAI BP',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Al-Qur’an dan Hadis',
    cpText:
      'Murid memahami beberapa surah pendek dan ayat Al-Qur’an serta hadis tentang keragaman.',
    materiBab: 'BAB 1: Mengaji Surah Pendek/Ayat Al-Qur’an dan Hadis tentang Keragaman',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pai-c-2',
    mapel: 'PAI BP',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Akidah',
    cpText:
      'Murid memahami beberapa asmaulhusna, iman kepada hari akhir, serta qadāʾ dan qadr.',
    materiBab: 'BAB 2: Mengenal Asmaulhusna, Iman kepada Hari Akhir, serta Qadāʾ dan Qadr',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'pai-c-3',
    mapel: 'PAI BP',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Akhlak',
    cpText:
      'Murid memahami akhlak terhadap Allah Swt. dengan berdoa dan bertawakal kepada-Nya, serta akhlak terhadap teman, tetangga, nonmuslim, hewan, dan tumbuhan.',
    materiBab: 'BAB 3: Berdoa & Tawakal kepada Allah serta Akhlak Mulia kepada Sesama dan Lingkungan',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'pai-c-4',
    mapel: 'PAI BP',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Fikih',
    cpText:
      'Murid memahami puasa sunah, zakat, infak, sedekah, hadiah, makanan dan minuman yang halal dan haram.',
    materiBab: 'BAB 4: Puasa Sunah, Zakat, Infak, Sedekah, Hadiah, dan Makanan-Minuman Halal-Haram',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pai-c-5',
    mapel: 'PAI BP',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Sejarah Peradaban Islam',
    cpText:
      'Murid memahami kisah Nabi Muhammad saw. periode Madinah dan khulafaurasyidin.',
    materiBab: 'BAB 5: Kisah Nabi Muhammad saw. Periode Madinah dan Keteladanan Khulafaurasyidin',
    semester: 'II',
    alokasiJp: 6,
  },

  // ========================
  // 2. PKn / PENDIDIKAN PANCASILA (4 ELEMEN)
  // ========================
  // Fase A (Kelas 1 & 2)
  {
    id: 'pkn-a-1',
    mapel: 'PKn',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Pancasila',
    cpText:
      'Murid mengenal bendera negara, lagu kebangsaan, simbol dan sila-sila Pancasila dalam lambang negara Garuda Pancasila serta nilai penerapannya di rumah.',
    materiBab: 'BAB 1: Mengenal Simbol Sila Pancasila dan Lambang Garuda Pancasila',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pkn-a-2',
    mapel: 'PKn',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Undang-Undang Dasar NRI Tahun 1945',
    cpText:
      'Murid mengenal aturan di lingkungan keluarga dan sekolah, menceritakan contoh sikap mematuhi aturan, serta menunjukkan perilaku disiplin di rumah dan kelas.',
    materiBab: 'BAB 2: Aku Anak Patuh Aturan di Lingkungan Keluarga dan Sekolah',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pkn-a-3',
    mapel: 'PKn',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Bhinneka Tunggal Ika',
    cpText:
      'Murid mengidentifikasi dan menghargai identitas dirinya sesuai jenis kelamin, hobi, bahasa, serta agama dan kepercayaan di lingkungan rumah dan sekolah.',
    materiBab: 'BAB 3: Mengenal Keberagaman Identitas Diri, Keluarga, dan Teman Sekelas',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pkn-a-4',
    mapel: 'PKn',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Negara Kesatuan Republik Indonesia',
    cpText:
      'Murid mengenal karakteristik lingkungan tempat tinggal dan sekolah sebagai bagian dari wilayah NKRI serta mempraktikkan sikap kerja sama menjaga kebersihan.',
    materiBab: 'BAB 4: Peduli Lingkungan Rumah & Sekolah dengan Sikap Gotong Royong',
    semester: 'II',
    alokasiJp: 8,
  },

  // Fase B (Kelas 3 & 4)
  {
    id: 'pkn-b-1',
    mapel: 'PKn',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Pancasila',
    cpText:
      'Murid menunjukkan makna sila-sila Pancasila dan penerapannya dalam kehidupan sehari-hari serta mengenal karakter para perumus Pancasila.',
    materiBab: 'BAB 1: Makna Sila Pancasila, Nilai Keteladanan Perumus, dan Penerapannya',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pkn-b-2',
    mapel: 'PKn',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Undang-Undang Dasar NRI Tahun 1945',
    cpText:
      'Murid mengidentifikasi dan melaksanakan aturan di sekolah dan lingkungan tempat tinggal serta menyeimbangkan hak dan kewajiban sebagai anak dan warga sekolah.',
    materiBab: 'BAB 2: Aturan Bermasyarakat, Hak, dan Kewajiban sebagai Anggota Keluarga & Murid',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pkn-b-3',
    mapel: 'PKn',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Bhinneka Tunggal Ika',
    cpText:
      'Murid membedakan dan menghargai identitas diri, keluarga, dan teman-temannya sesuai budaya, suku bangsa, bahasa, serta agama dan kepercayaannya.',
    materiBab: 'BAB 3: Membangun Jati Diri dan Menghargai Keragaman Budaya Nusantara',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pkn-b-4',
    mapel: 'PKn',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Negara Kesatuan Republik Indonesia',
    cpText:
      'Murid mengidentifikasi lingkungan tempat tinggal (RT, RW, desa/kelurahan, kecamatan) sebagai bagian dari NKRI dan menunjukkan sikap kerja sama dalam keberagaman.',
    materiBab: 'BAB 4: Negaraku Indonesia, Mengenal Wilayah Sekitar, dan Budaya Gotong Royong',
    semester: 'II',
    alokasiJp: 8,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'pkn-c-1',
    mapel: 'PKn',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Pancasila',
    cpText:
      'Murid memahami kronologi sejarah kelahiran Pancasila, meneladani sikap para perumus Pancasila, serta menghubungkan nilai sila-sila Pancasila sebagai satu kesatuan.',
    materiBab: 'BAB 1: Sejarah Kelahiran Pancasila dan Pengamalan Nilai Pancasila dalam Keseharian',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pkn-c-2',
    mapel: 'PKn',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Undang-Undang Dasar NRI Tahun 1945',
    cpText:
      'Murid menyajikan hasil identifikasi bentuk-bentuk norma, hak, dan kewajiban dalam kedudukannya sebagai anggota keluarga, warga sekolah, dan warga negara serta mempraktikkan musyawarah.',
    materiBab: 'BAB 2: Norma dalam Masyarakat, Hak-Kewajiban Warga Negara, dan Musyawarah Mufakat',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pkn-c-3',
    mapel: 'PKn',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Bhinneka Tunggal Ika',
    cpText:
      'Murid menyajikan hasil identifikasi sikap menghormati, menjaga, dan melestarikan keberagaman budaya dalam bingkai Bhinneka Tunggal Ika di lingkungan sekitar.',
    materiBab: 'BAB 3: Menjaga Keberagaman Suku, Agama, dan Budaya di Indonesia',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pkn-c-4',
    mapel: 'PKn',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Negara Kesatuan Republik Indonesia',
    cpText:
      'Murid mengenal wilayahnya dalam konteks kabupaten/kota, provinsi sebagai bagian NKRI, serta menunjukkan perilaku gotong royong dan bela negara menjaga persatuan.',
    materiBab: 'BAB 4: Mengenal Provinsi di Indonesia, Bela Negara, dan Persatuan NKRI',
    semester: 'II',
    alokasiJp: 8,
  },

  // ========================
  // 3. BAHASA INDONESIA (4 ELEMEN)
  // ========================
  // Fase A (Kelas 1 & 2)
  {
    id: 'bind-a-1',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Menyimak',
    cpText:
      'Murid mampu bersikap menjadi pendengar yang penuh perhatian, menunjukkan minat pada tuturan yang didengar, serta memahami pesan lisan dan instruksi sederhana.',
    materiBab: 'BAB 1: Menyimak Cerita Pendek, Bunyi Bahasa, dan Instruksi Lisan Sehari-hari',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'bind-a-2',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Membaca dan Memirsa',
    cpText:
      'Murid mampu bersikap menjadi pembaca dan pemirsa yang menunjukkan minat terhadap teks, membaca kata-kata sederhana dari suku kata dasar, dan memahami bacaan bergambar.',
    materiBab: 'BAB 2: Membaca Suku Kata Dasar, Kata Sehari-hari, dan Cerita Bergambar',
    semester: 'I',
    alokasiJp: 12,
  },
  {
    id: 'bind-a-3',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Berbicara dan Mempresentasikan',
    cpText:
      'Murid mampu berbicara dengan santun menggunakan volume dan intonasi yang tepat, menanggapi komentar orang lain, serta menceritakan kembali isi cerita sederhana.',
    materiBab: 'BAB 3: Mengungkapkan Perasaan, Ungkapan Santun, dan Bercerita di Depan Kelas',
    semester: 'II',
    alokasiJp: 10,
  },
  {
    id: 'bind-a-4',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Menulis',
    cpText:
      'Murid mampu menunjukkan keterampilan menulis permulaan dengan benar (cara memegang alat tulis, jarak mata, menebalkan huruf) dan menulis kalimat sederhana tentang diri dan lingkungan.',
    materiBab: 'BAB 4: Menulis Permulaan, Huruf Kapital, Tanda Titik, dan Kalimat Sederhana',
    semester: 'II',
    alokasiJp: 12,
  },

  // Fase B (Kelas 3 & 4)
  {
    id: 'bind-b-1',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Menyimak',
    cpText:
      'Murid mampu memahami ide pokok (gagasan) suatu pesan lisan, informasi dari media audio, teks aural (teks yang dibacakan dan/atau didengar), dan instruksi lisan.',
    materiBab: 'BAB 1: Menyimak Informasi Lisan, Ide Pokok Bacaan Aural, dan Petunjuk Arah',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'bind-b-2',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Membaca dan Memirsa',
    cpText:
      'Murid mampu memahami pesan dan informasi tentang kehidupan sehari-hari, teks narasi, dan puisi anak dalam bentuk cetak atau elektronik serta memaknai kosakata baru.',
    materiBab: 'BAB 2: Ide Pokok & Ide Pendukung, Kalimat Transitif-Intransitif, dan Kosakata Baru',
    semester: 'I',
    alokasiJp: 12,
  },
  {
    id: 'bind-b-3',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Berbicara dan Mempresentasikan',
    cpText:
      'Murid mampu berbicara dengan pilihan kata dan sikap tubuh/gestur yang santun, mengajukan dan menanggapi pertanyaan dalam diskusi, serta menceritakan kembali informasi.',
    materiBab: 'BAB 3: Wawancara Sederhana, Diskusi Santun, dan Presentasi Hasil Pengamatan',
    semester: 'II',
    alokasiJp: 10,
  },
  {
    id: 'bind-b-4',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Menulis',
    cpText:
      'Murid mampu menulis teks narasi, teks deskripsi, teks rekon, teks prosedur, dan teks eksposisi dengan rangkaian kalimat yang beragam serta kaidah EYD sederhana.',
    materiBab: 'BAB 4: Menulis Teks Deskripsi, Prosedur, Paragraf Narasi, dan Kalimat Efektif SPOK',
    semester: 'II',
    alokasiJp: 12,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'bind-c-1',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Menyimak',
    cpText:
      'Murid mampu menganalisis informasi berupa fakta, prosedur dengan mengidentifikasikan ciri objek dan urutan proses kejadian, serta nilai-nilai dari berbagai tipe teks aural.',
    materiBab: 'BAB 1: Menyimak Berita, Membedakan Fakta-Opini, dan Urutan Informasi Lisan',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'bind-c-2',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Membaca dan Memirsa',
    cpText:
      'Murid mampu membaca kata-kata dengan berbagai pola kombinasi huruf dengan fasih dan indah serta menganalisis informasi dan majas dari teks fiksi maupun nonfiksi.',
    materiBab: 'BAB 2: Unsur Intrinsik Cerita, Majas, Teks Eksplanasi, dan Grafik Informasi',
    semester: 'I',
    alokasiJp: 12,
  },
  {
    id: 'bind-c-3',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Berbicara dan Mempresentasikan',
    cpText:
      'Murid mampu menyampaikan informasi secara lisan untuk tujuan menghibur dan meyakinkan mitra tutur sesuai kaidah, berdiskusi aktif, serta membacakan pidato persuasif.',
    materiBab: 'BAB 3: Menyampaikan Pidato Persuasif, Presentasi Hasil Riset, dan Debat Santun',
    semester: 'II',
    alokasiJp: 10,
  },
  {
    id: 'bind-c-4',
    mapel: 'Bahasa Indonesia',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Menulis',
    cpText:
      'Murid mampu menulis berbagai teks sederhana berdasarkan gagasan, hasil pengamatan, dan imajinasi (formulir, surat resmi/pribadi, ringkasan, dan teks eksplanasi) sesuai EYD.',
    materiBab: 'BAB 4: Menulis Formulir, Surat Pribadi/Resmi, Ringkasan, dan Teks Pidato',
    semester: 'II',
    alokasiJp: 12,
  },

  // ========================
  // 4. MATEMATIKA (5 ELEMEN)
  // ========================
  // Fase A (Kelas 1 & 2)
  {
    id: 'mat-a-1',
    mapel: 'Matematika',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Bilangan',
    cpText:
      'Murid menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 100 serta melakukan operasi penjumlahan dan pengurangan menggunakan benda konkret.',
    materiBab: 'BAB 1: Bilangan Cacah 1–100, Nilai Tempat, Penjumlahan, dan Pengurangan',
    semester: 'I',
    alokasiJp: 12,
  },
  {
    id: 'mat-a-2',
    mapel: 'Matematika',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Aljabar',
    cpText:
      'Murid dapat menunjukkan pemahaman makna simbol matematika "=" dalam suatu kalimat matematika yang terkait dengan penjumlahan dan pengurangan serta mengenali pola gambar/bilangan.',
    materiBab: 'BAB 2: Kalimat Matematika Penjumlahan-Pengurangan dan Pola Bilangan Sederhana',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'mat-a-3',
    mapel: 'Matematika',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Pengukuran',
    cpText:
      'Murid dapat membandingkan panjang dan berat benda secara langsung, membandingkan durasi waktu, dan mengukur panjang benda menggunakan satuan tidak baku.',
    materiBab: 'BAB 3: Membandingkan Panjang, Berat Benda, dan Membaca Jam/Waktu',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'mat-a-4',
    mapel: 'Matematika',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Geometri',
    cpText:
      'Murid dapat mengenal berbagai bangun datar (segitiga, segiempat, lingkaran) dan bangun ruang (balok, kubus, kerucut, bola) serta menyusun komposisi bentuk.',
    materiBab: 'BAB 4: Mengenal Bangun Datar, Bangun Ruang, dan Posisi Benda',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'mat-a-5',
    mapel: 'Matematika',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Analisis Data dan Peluang',
    cpText:
      'Murid dapat mengurutkan, menyortir, mengelompokkan, membandingkan, dan menyajikan data dari banyak benda dengan menggunakan turus dan piktogram paling banyak 4 kategori.',
    materiBab: 'BAB 5: Mengelompokkan Benda dan Membaca Diagram Gambar Sederhana (Turus)',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase B (Kelas 3 & 4)
  {
    id: 'mat-b-1',
    mapel: 'Matematika',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Bilangan',
    cpText:
      'Murid menunjukkan pemahaman bilangan cacah sampai 10.000, melakukan operasi hitung perkalian dan pembagian, serta membandingkan dan mengurutkan berbagai pecahan senilai.',
    materiBab: 'BAB 1: Bilangan Cacah sampai 10.000, Perkalian-Pembagian, dan Pecahan Senilai',
    semester: 'I',
    alokasiJp: 12,
  },
  {
    id: 'mat-b-2',
    mapel: 'Matematika',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Aljabar',
    cpText:
      'Murid dapat mengisi nilai yang belum diketahui dalam sebuah kalimat matematika berkaitan dengan penjumlahan dan pengurangan serta mengidentifikasi pola gambar atau bilangan membesar/mengecil.',
    materiBab: 'BAB 2: Pola Gambar, Pola Bilangan, dan Kalimat Matematika Nilai yang Belum Diketahui',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'mat-b-3',
    mapel: 'Matematika',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Pengukuran',
    cpText:
      'Murid dapat mengukur panjang dan berat benda menggunakan satuan baku, menentukan hubungan antarsatuan baku panjang, serta mengukur luas dan volume menggunakan satuan tidak baku dan baku.',
    materiBab: 'BAB 3: Pengukuran Panjang-Berat Satuan Baku serta Luas & Volume Persegi',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'mat-b-4',
    mapel: 'Matematika',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Geometri',
    cpText:
      'Murid dapat mendeskripsikan ciri berbagai bentuk bangun datar (segiempat, segitiga, segibanyak) serta menyusun (komposisi) dan mengurai (dekomposisi) berbagai bangun datar.',
    materiBab: 'BAB 4: Ciri Bangun Datar, Keliling-Luas Persegi Panjang, dan Komposisi Bangun',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'mat-b-5',
    mapel: 'Matematika',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Analisis Data dan Peluang',
    cpText:
      'Murid dapat mengurutkan, membandingkan, menyajikan, menganalisis, dan menginterpretasi data dalam bentuk tabel, diagram gambar (piktogram), dan diagram batang skala satu satuan.',
    materiBab: 'BAB 5: Penyajian Data dalam Tabel, Piktogram, dan Diagram Batang',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'mat-c-1',
    mapel: 'Matematika',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Bilangan',
    cpText:
      'Murid memahami bilangan cacah sampai 1.000.000, menentukan KPK dan FPB, serta melakukan operasi penjumlahan, pengurangan, perkalian, dan pembagian pecahan, desimal, dan persen.',
    materiBab: 'BAB 1: Bilangan Cacah hingga 1.000.000, KPK-FPB, dan Operasi Pecahan-Desimal',
    semester: 'I',
    alokasiJp: 12,
  },
  {
    id: 'mat-c-2',
    mapel: 'Matematika',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Aljabar',
    cpText:
      'Murid dapat mengisi nilai yang belum diketahui dalam kalimat matematika, mengidentifikasi dan mengembangkan pola bilangan, serta bernalar secara proporsional menyelesaikan rasio dan perbandingan.',
    materiBab: 'BAB 2: Rasio, Perbandingan Senilai, Skala Sederhana, dan Pola Bilangan',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'mat-c-3',
    mapel: 'Matematika',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Pengukuran',
    cpText:
      'Murid dapat menentukan keliling dan luas berbagai bentuk bangun datar (segitiga, segiempat, gabungan) serta menghitung durasi waktu dan mengukur besar sudut menggunakan busur derajat.',
    materiBab: 'BAB 3: Pengukuran Besar Sudut, Keliling & Luas Bangun Datar Gabungan',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'mat-c-4',
    mapel: 'Matematika',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Geometri',
    cpText:
      'Murid dapat mengonstruksi dan mengurai bangun ruang (kubus, balok, dan gabungannya), mengenali visualisasi spasial, membandingkan karakteristik bangun, serta menentukan lokasi pada peta berpetak.',
    materiBab: 'BAB 4: Konstruksi Kubus & Balok, Volume Bangun Ruang, dan Koordinat Peta Berpetak',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'mat-c-5',
    mapel: 'Matematika',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Analisis Data dan Peluang',
    cpText:
      'Murid dapat mengurutkan, membandingkan, menyajikan, dan menganalisis data menggunakan tabel frekuensi dan diagram batang, serta menentukan kejadian dengan kemungkinan lebih besar dalam percobaan acak.',
    materiBab: 'BAB 5: Analisis Data Rata-Rata/Diagram Batang dan Peluang Kejadian Sederhana',
    semester: 'II',
    alokasiJp: 6,
  },

  // ========================
  // 5. IPAS (4 ELEMEN)
  // ========================
  // Fase B (Kelas 3 & 4)
  {
    id: 'ipas-b-1',
    mapel: 'IPAS',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Pemahaman IPAS (Makhluk Hidup & Lingkungan)',
    cpText:
      'Murid memahami bentuk dan fungsi pancaindra, siklus hidup makhluk hidup dan upaya pelestariannya, serta bagian tubuh tumbuhan dan proses fotosintesis.',
    materiBab: 'BAB 1: Tumbuhan Sumber Kehidupan, Pancaindra, dan Siklus Hidup Makhluk Hidup',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'ipas-b-2',
    mapel: 'IPAS',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Pemahaman IPAS (Materi, Energi & Gaya)',
    cpText:
      'Murid memahami wujud zat dan perubahannya, masalah berkaitan perubahan wujud benda, sumber dan bentuk energi, serta pengaruh gaya terhadap benda di sekitar.',
    materiBab: 'BAB 2: Wujud Zat & Perubahannya, Gaya Magnet/Gravitasi, dan Transformasi Energi',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'ipas-b-3',
    mapel: 'IPAS',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Pemahaman IPAS (Sosial, Budaya & Ekonomi)',
    cpText:
      'Murid memahami ragam bentang alam, keanekaragaman budaya daerah dan kearifan lokal, sejarah masyarakat sekitar, serta peran dan kegiatan ekonomi memenuhi kebutuhan.',
    materiBab: 'BAB 3: Daerahku & Kekayaan Alamnya, Kearifan Lokal, serta Kegiatan Ekonomi',
    semester: 'II',
    alokasiJp: 10,
  },
  {
    id: 'ipas-b-4',
    mapel: 'IPAS',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Keterampilan Proses Sains & Sosial',
    cpText:
      'Murid mengamati fenomena secara sederhana, mempertanyakan dan memprediksi, merencanakan penyelidikan, mengolah data hasil pengamatan, serta mengomunikasikan kesimpulan.',
    materiBab: 'BAB 4: Proyek Penyelidikan Sederhana Mengamati Lingkungan & Perubahan Energi',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'ipas-c-1',
    mapel: 'IPAS',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Pemahaman IPAS (Organ Tubuh & Ekosistem)',
    cpText:
      'Murid memahami sistem organ tubuh manusia (pernapasan, pencernaan, gerak, peredaran darah) dan cara menjaga kesehatan, serta hubungan antarkomponen biotik-abiotik dalam ekosistem.',
    materiBab: 'BAB 1: Sistem Organ Tubuh Manusia, Jaring-Jaring Makanan, dan Ekosistem Harmonis',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'ipas-c-2',
    mapel: 'IPAS',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Pemahaman IPAS (Energi, Listrik & Tata Surya)',
    cpText:
      'Murid memahami fenomena gelombang bunyi dan cahaya dalam kehidupan sehari-hari, kemagnetan, rangkaian listrik sederhana, pemanfaatan energi terbarukan, dan sistem tata surya.',
    materiBab: 'BAB 2: Sifat Cahaya & Bunyi, Listrik-Magnet, dan Menjelajah Bumi & Tata Surya',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'ipas-c-3',
    mapel: 'IPAS',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Pemahaman IPAS (Sejarah, Geografi & Ekonomi)',
    cpText:
      'Murid memahami letak dan kondisi geografis Indonesia sebagai negara maritim dan agraris, sejarah perjuangan kemerdekaan bangsa Indonesia, serta interaksi global dan kegiatan ekonomi.',
    materiBab: 'BAB 3: Indonesia Negara Maritim-Agraris, Perjuangan Kemerdekaan, dan Ekonomi Kreatif',
    semester: 'II',
    alokasiJp: 10,
  },
  {
    id: 'ipas-c-4',
    mapel: 'IPAS',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Keterampilan Proses Sains & Sosial',
    cpText:
      'Murid melakukan penyelidikan ilmiah secara kolaboratif: merumuskan hipotesis, melakukan percobaan dengan alat bantu sederhana, mengevaluasi data, dan mempresentasikan proyek solusi lingkungan.',
    materiBab: 'BAB 4: Proyek Akhir IPAS — Bumi Kita Terancam Bahaya & Solusi Ramah Lingkungan',
    semester: 'II',
    alokasiJp: 6,
  },

  // ========================
  // 6. SENI BUDAYA (5 ELEMEN)
  // ========================
  // Fase A (Kelas 1 & 2)
  {
    id: 'sbd-a-1',
    mapel: 'Seni Budaya',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Mengalami',
    cpText:
      'Murid mampu mengamati, mengenal, merekam, dan menuangkan pengalaman kesehariannya secara visual/auditif menggunakan unsur garis, bentuk, warna dasar, serta pola irama sederhana.',
    materiBab: 'BAB 1: Mengamati Garis, Bentuk, Warna Primer, dan Bunyi Irama di Sekitar',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'sbd-a-2',
    mapel: 'Seni Budaya',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Merefleksikan',
    cpText:
      'Murid mampu mengenali dan menceritakan fokus dari karya yang diciptakan atau dilihatnya (dari diri sendiri, teman sekelas, dan karya seni sekitar) serta perasaan yang dirasakan.',
    materiBab: 'BAB 2: Bercerita tentang Karya Gambar dan Lagu Anak yang Disukai',
    semester: 'I',
    alokasiJp: 4,
  },
  {
    id: 'sbd-a-3',
    mapel: 'Seni Budaya',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Berpikir dan Bekerja Artistik',
    cpText:
      'Murid mampu mengenali dan membiasakan diri dengan berbagai prosedur dasar sederhana untuk berkarya dengan aneka pilihan media yang tersedia di lingkungan sekolah dan rumah.',
    materiBab: 'BAB 3: Mengenal Alat Gambar, Bahan Lipat/Gunting, dan Alat Musik Ritmis Sederhana',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'sbd-a-4',
    mapel: 'Seni Budaya',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Menciptakan',
    cpText:
      'Murid mampu menciptakan karya seni rupa 2D/3D sederhana dengan mengeksplorasi elemen rupa dasar atau menirukan pola irama lagu anak-anak dan gerak tari bertema alam.',
    materiBab: 'BAB 4: Membuat Karya Kolase/Cetak Stempel dan Menyanyikan Lagu Anak Berirama',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'sbd-a-5',
    mapel: 'Seni Budaya',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Berdampak',
    cpText:
      'Murid mampu menciptakan karya sendiri yang sesuai dengan perasaan atau minatnya sehingga menumbuhkan rasa percaya diri, kecintaan terhadap kebersihan, dan keindahan kelas.',
    materiBab: 'BAB 5: Pameran Mini Hasil Karya Kelas dan Menghias Sudut Baca',
    semester: 'II',
    alokasiJp: 4,
  },

  // Fase B (Kelas 3 & 4)
  {
    id: 'sbd-b-1',
    mapel: 'Seni Budaya',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Mengalami',
    cpText:
      'Murid memahami unsur rupa dan prinsip desain di lingkungan sekitarnya serta mengenal tinggi-rendah nada, tempo, dan gerak tari daerah dengan pengamatan langsung.',
    materiBab: 'BAB 1: Eksplorasi Tekstur, Warna Sekunder, Motif Dekoratif, dan Pola Irama Daerah',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'sbd-b-2',
    mapel: 'Seni Budaya',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Merefleksikan',
    cpText:
      'Murid mampu menilai karya dan penciptaan karya seni dengan menggunakan kosa kata seni rupa, musik, atau tari yang telah dipelajari secara santun dan apresiatif.',
    materiBab: 'BAB 2: Apresiasi Karya Seni Teman dan Mengulas Lagu/Tari Daerah Nusantara',
    semester: 'I',
    alokasiJp: 4,
  },
  {
    id: 'sbd-b-3',
    mapel: 'Seni Budaya',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Berpikir dan Bekerja Artistik',
    cpText:
      'Murid mulai terbiasa secara mandiri menggunakan berbagai prosedur dasar sederhana untuk berkarya menggunakan bahan alam maupun bahan daur ulang ramah lingkungan.',
    materiBab: 'BAB 3: Merancang Sketsa Karya 3D dari Bahan Daur Ulang dan Alat Musik Ritmis',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'sbd-b-4',
    mapel: 'Seni Budaya',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Menciptakan',
    cpText:
      'Murid mampu menciptakan karya seni rupa 2D/3D (mozaik, gambar dekoratif, layang-layang/kriya daur ulang) serta menampilkan gerak tari bertema atau menyanyikan lagu daerah.',
    materiBab: 'BAB 4: Membuat Mozaik Bahan Alam, Gambar Dekoratif, dan Pentas Lagu Daerah',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'sbd-b-5',
    mapel: 'Seni Budaya',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Berdampak',
    cpText:
      'Murid memberikan respons terhadap kejadian sehari-hari dan keadaan lingkungan sekitar melalui karya seni yang memberi dampak positif bagi diri sendiri dan lingkungan sekolah.',
    materiBab: 'BAB 5: Karya Poster Peduli Lingkungan dan Pajangan Kreatif Sekolah',
    semester: 'II',
    alokasiJp: 4,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'sbd-c-1',
    mapel: 'Seni Budaya',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Mengalami',
    cpText:
      'Murid mampu mengamati, mengenal, merekam, dan menuangkan pengalaman kesehariannya secara visual dengan konsep prinsip keseimbangan, ritme, proporsi rupa, serta harmoni musik/tari.',
    materiBab: 'BAB 1: Prinsip Keseimbangan & Ritme Rupa serta Mengenal Tangga Nada & Ansambel',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'sbd-c-2',
    mapel: 'Seni Budaya',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Merefleksikan',
    cpText:
      'Murid mampu menghargai dan menjelaskan pesan estetik serta nilai budaya dalam karya seni rupa, musik, maupun tari tradisional daerah setempat dan Nusantara.',
    materiBab: 'BAB 2: Apresiasi Nilai Budaya pada Batik, Anyaman, dan Musik Tradisional',
    semester: 'I',
    alokasiJp: 4,
  },
  {
    id: 'sbd-c-3',
    mapel: 'Seni Budaya',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Berpikir dan Bekerja Artistik',
    cpText:
      'Murid mampu menggunakan pengalaman, keterampilan, dan pengetahuan yang diperoleh dalam mata pelajaran lain sebagai sumber gagasan dalam merancang karya seni terapan.',
    materiBab: 'BAB 3: Merancang Pola Makrame, Anyaman Sederhana, atau Aransemen Musik Kelompok',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'sbd-c-4',
    mapel: 'Seni Budaya',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Menciptakan',
    cpText:
      'Murid mampu membuat karya seni rupa terapan (simpul makrame, anyaman kertas/bambu, motif batik sederhana) serta memainkan alat musik ritmis/melodis secara harmonis.',
    materiBab: 'BAB 4: Praktik Membuat Makrame/Anyaman/Batik Sasak dan Bermain Ansambel Kelas',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'sbd-c-5',
    mapel: 'Seni Budaya',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Berdampak',
    cpText:
      'Murid mampu menciptakan karya sendiri yang sesuai perasaan, minat, atau konteks lingkungan sebagai pesan sosial/kampanye positif dalam pameran atau pertunjukan sekolah.',
    materiBab: 'BAB 5: Pameran Karya Terapan & Pertunjukan Seni Akhir Semester',
    semester: 'II',
    alokasiJp: 4,
  },

  // ========================
  // 7. PJOK (4 ELEMEN)
  // ========================
  // Fase A (Kelas 1 & 2)
  {
    id: 'pjok-a-1',
    mapel: 'PJOK',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Terampil Bergerak',
    cpText:
      'Murid mempraktikkan keterampilan gerak fundamental (lokomotor, non-lokomotor, manipulatif) serta menerapkannya dalam berbagai situasi gerak sederhana.',
    materiBab: 'BAB 1: Gerak Dasar Jalan, Lari, Lompat, Mengayun, dan Melempar-Menangkap Bola',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'pjok-a-2',
    mapel: 'PJOK',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Belajar Melalui Gerak',
    cpText:
      'Murid menaati aturan untuk menumbuhkan fair play di dalam berbagai aktivitas jasmani serta menerapkan strategi kolaborasi sederhana ketika berpartisipasi dalam permainan kelompok.',
    materiBab: 'BAB 2: Bermain Kelompok Tertib Aturan, Sportif, dan Senam Irama Anak',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pjok-a-3',
    mapel: 'PJOK',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Bergaya Hidup Aktif',
    cpText:
      'Murid berpartisipasi di dalam berbagai aktivitas jasmani dan mengeksplorasi manfaat bergerak aktif bagi kebugaran tubuh dan keceriaan bersama teman.',
    materiBab: 'BAB 3: Aktivitas Kebugaran Jasmani, Keseimbangan, dan Permainan Tradisional Aktif',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pjok-a-4',
    mapel: 'PJOK',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Memilih Hidup yang Menyehatkan',
    cpText:
      'Murid mengenali gaya hidup aktif dan sehat, manfaat makanan bergizi seimbang, kebersihan bagian tubuh, serta menjaga keselamatan diri saat bermain.',
    materiBab: 'BAB 4: Mengenal Bagian Tubuh, Kebersihan Diri, dan Makanan Bergizi Seimbang',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase B (Kelas 3 & 4)
  {
    id: 'pjok-b-1',
    mapel: 'PJOK',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Terampil Bergerak',
    cpText:
      'Murid menghaluskan keterampilan gerak fundamental (variasi dan kombinasi lokomotor, non-lokomotor, manipulatif) dalam permainan bola besar, bola kecil, dan senam lantai.',
    materiBab: 'BAB 1: Variasi Gerak Permainan Bola Besar/Kecil dan Senam Lantai Dasar',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'pjok-b-2',
    mapel: 'PJOK',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Belajar Melalui Gerak',
    cpText:
      'Murid menerapkan strategi gerak sederhana, menumbuhkan kepemimpinan, komunikasi positif, dan menunjukkan perilaku fair play dalam aktivitas permainan beregu.',
    materiBab: 'BAB 2: Permainan Beregu, Kerja Sama Tim, dan Aktivitas Gerak Berirama',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pjok-b-3',
    mapel: 'PJOK',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Bergaya Hidup Aktif',
    cpText:
      'Murid berpartisipasi dalam berbagai aktivitas jasmani dan menggambarkan pengaruh aktivitas jasmani teratur terhadap daya tahan dan kebugaran tubuh.',
    materiBab: 'BAB 3: Latihan Kekuatan, Kelentukan, Daya Tahan, dan Kebugaran Jasmani',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pjok-b-4',
    mapel: 'PJOK',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Memilih Hidup yang Menyehatkan',
    cpText:
      'Murid mengenali risiko kesehatan akibat gaya hidup kurang gerak, memilih makanan bergizi dan jajanan sehat, serta mempraktikkan pertolongan pertama cedera ringan.',
    materiBab: 'BAB 4: Kebiasaan Hidup Sehat, Memilih Jajanan Bergizi, dan Pencegahan Cedera',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'pjok-c-1',
    mapel: 'PJOK',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Terampil Bergerak',
    cpText:
      'Murid menyesuaikan dan memodifikasi keterampilan gerak melintasi berbagai situasi gerak olahraga permainan invasi, net, lapangan, atletik dasar, serta bela diri pencak silat.',
    materiBab: 'BAB 1: Modifikasi Permainan Bola Basket/Voli/Kasti, Atletik, dan Pencak Silat Dasar',
    semester: 'I',
    alokasiJp: 10,
  },
  {
    id: 'pjok-c-2',
    mapel: 'PJOK',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Belajar Melalui Gerak',
    cpText:
      'Murid memprediksi dan menguji efektivitas strategi gerak, berperan aktif sebagai pemimpin tim, serta menegakkan etika sportivitas dan inklusi selama bertanding.',
    materiBab: 'BAB 2: Strategi Permainan Tim, Senam Irama Kreasi, dan Sportivitas Olahraga',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'pjok-c-3',
    mapel: 'PJOK',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Bergaya Hidup Aktif',
    cpText:
      'Murid berpartisipasi dalam aktivitas jasmani untuk menggambarkan pengaruh aktivitas terhadap kesehatan fisik-mental serta mengukur tingkat kebugaran jasmani mandiri.',
    materiBab: 'BAB 3: Pengukuran Kebugaran Jasmani Siswa dan Program Aktivitas Fisik Harian',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'pjok-c-4',
    mapel: 'PJOK',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Memilih Hidup yang Menyehatkan',
    cpText:
      'Murid mengidentifikasi risiko kesehatan dan cara pencegahannya, menjaga kebersihan alat reproduksi pada masa pubertas, serta memahami bahaya merokok, minuman keras, dan NAPZA.',
    materiBab: 'BAB 4: Pemeliharaan Kebersihan Pubertas, P3K Dasar, dan Bahaya Rokok/NAPZA',
    semester: 'II',
    alokasiJp: 6,
  },

  // ========================
  // 8. BAHASA INGGRIS (4 ELEMEN)
  // ========================
  // Fase A (Kelas 1 & 2)
  {
    id: 'bing-a-1',
    mapel: 'Bahasa Inggris',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Menyimak - Berbicara (Listening - Speaking)',
    cpText:
      'Murid menggunakan bahasa Inggris sederhana untuk berinteraksi dalam situasi sosial dan kelas yang lazim seperti menyapa, berpamitan, dan memperkenalkan diri.',
    materiBab: 'Unit 1: Greetings, Partings, and Introducing Myself (Hello & My Name Is...)',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'bing-a-2',
    mapel: 'Bahasa Inggris',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Kosakata Angka & Warna (Vocabulary Focus)',
    cpText:
      'Murid mengenal, melafalkan, dan merespons instruksi lisan atau visual sederhana mengenai angka 1–10, warna-warna dasar, dan jumlah benda di dalam kelas.',
    materiBab: 'Unit 2: Numbers 1–10, Basic Colors, and My Classroom Things',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'bing-a-3',
    mapel: 'Bahasa Inggris',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Membaca - Memirsa (Reading - Viewing)',
    cpText:
      'Murid merespons secara lisan maupun nonverbal terhadap teks visual bergambar sangat pendek yang familiar dengan menirukan ucapan guru dan mengenali kata benda sekitar.',
    materiBab: 'Unit 3: My Family, Animals Around Us, and Favorite Fruits (Picture Reading)',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'bing-a-4',
    mapel: 'Bahasa Inggris',
    fase: 'Fase A',
    kelasList: [1, 2],
    elemen: 'Menulis - Mempresentasikan (Writing - Presenting)',
    cpText:
      'Murid menebalkan, menyalin, dan melengkapi huruf atau kata bahasa Inggris sangat sederhana dengan bantuan gambar serta menyebutkan artinya di depan teman.',
    materiBab: 'Unit 4: Copying Simple English Words & Naming Pictures in Class',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase B (Kelas 3 & 4)
  {
    id: 'bing-b-1',
    mapel: 'Bahasa Inggris',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Menyimak - Berbicara (Listening - Speaking)',
    cpText:
      'Murid menggunakan bahasa Inggris untuk berinteraksi dalam lingkup situasi sosial dan kelas yang makin luas dengan pola kalimat terprediksi mengenai aktivitas sehari-hari dan waktu.',
    materiBab: 'Unit 1: My Daily Activities, Hobbies, and Telling the Time',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'bing-b-2',
    mapel: 'Bahasa Inggris',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Membaca - Memirsa (Reading - Viewing)',
    cpText:
      'Murid memahami kata-kata yang sering digunakan sehari-hari dengan bantuan gambar/ilustrasi serta membaca dan memberikan respons terhadap teks pendek dan sederhana.',
    materiBab: 'Unit 2: Food & Drinks, Rooms in My House, and Reading Short Picture Dialogues',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'bing-b-3',
    mapel: 'Bahasa Inggris',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Menulis - Mempresentasikan (Writing - Presenting)',
    cpText:
      'Murid mengomunikasikan ide dan pengalamannya melalui gambar dan salinan tulisan, serta menghasilkan teks deskripsi dan prosedur sederhana menggunakan kosakata dasar.',
    materiBab: 'Unit 3: Writing Simple Sentences about My Favorite Food & Daily Schedule',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'bing-b-4',
    mapel: 'Bahasa Inggris',
    fase: 'Fase B',
    kelasList: [3, 4],
    elemen: 'Kosakata & Pola Kalimat Kontekstual (Language Use)',
    cpText:
      'Murid menggunakan pola kalimat sederhana (Simple Present, can/cannot, numbers 20–100, dan preposition of place) dalam permainan kelas dan dialog berpasangan.',
    materiBab: 'Unit 4: Numbers 20–100, Things at School, and Transportation in My Town',
    semester: 'II',
    alokasiJp: 6,
  },

  // Fase C (Kelas 5 & 6)
  {
    id: 'bing-c-1',
    mapel: 'Bahasa Inggris',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Menyimak - Berbicara (Listening - Speaking)',
    cpText:
      'Murid menggunakan kalimat bahasa Inggris sesuai pola tertentu untuk berinteraksi tentang pengalaman masa lampau, bagian tubuh & kesehatan, serta rencana masa depan.',
    materiBab: 'Unit 1: Talking about Past Holidays, Health Problems, and Future Dreams',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'bing-c-2',
    mapel: 'Bahasa Inggris',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Membaca - Memirsa (Reading - Viewing)',
    cpText:
      'Murid memahami kata-kata dan ide pokok teks narasi, deskripsi, atau prosedur pendek dalam bentuk cetak maupun digital dengan mengidentifikasi informasi tersurat.',
    materiBab: 'Unit 2: Reading Short Recount & Narrative Stories (Last Holiday & Folktales)',
    semester: 'I',
    alokasiJp: 8,
  },
  {
    id: 'bing-c-3',
    mapel: 'Bahasa Inggris',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Menulis - Mempresentasikan (Writing - Presenting)',
    cpText:
      'Murid mengomunikasikan ide dan pengalamannya melalui teks tertulis sederhana (paragraf pengalaman pribadi, deskripsi perbandingan, dan poster ajakan) lalu mempresentasikannya.',
    materiBab: 'Unit 3: Writing Simple Past Paragraphs & Comparative Descriptions (Degrees of Comparison)',
    semester: 'II',
    alokasiJp: 8,
  },
  {
    id: 'bing-c-4',
    mapel: 'Bahasa Inggris',
    fase: 'Fase C',
    kelasList: [5, 6],
    elemen: 'Tata Bahasa & Kosakata Terapan (Grammar in Context)',
    cpText:
      'Murid mempraktikkan penggunaan Simple Past Tense (was/were, verb-2), Future Tense (will / be going to), dan ungkapan sopan (asking for permission/help) dalam konteks sekolah.',
    materiBab: 'Unit 4: Simple Past Verbs, Future Plans (Will / Going to), and Polite Requests',
    semester: 'II',
    alokasiJp: 6,
  },

  // ========================
  // 9. MUATAN LOKAL (4 ELEMEN)
  // ========================
  {
    id: 'mulok-all-1',
    mapel: 'Muatan Lokal',
    fase: 'Fase B',
    kelasList: [1, 2, 3, 4, 5, 6],
    elemen: 'Bahasa Sasak & Tata Krama (Basa Alus)',
    cpText:
      'Murid mengenal, memahami, dan menggunakan kosakata bahasa daerah Sasak serta ungkapan tata krama (basa jamaq dan basa alus) saat berbicara kepada orang tua, guru, dan teman.',
    materiBab: 'BAB 1: Kosakata Sehari-hari Bahasa Sasak dan Ungkapan Tata Krama (Basa Alus)',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'mulok-all-2',
    mapel: 'Muatan Lokal',
    fase: 'Fase B',
    kelasList: [1, 2, 3, 4, 5, 6],
    elemen: 'Sastra, Pantun & Cerita Rakyat Lombok',
    cpText:
      'Murid menyimak, membaca, dan menceritakan kembali cerita rakyat khas Lombok/NTB (seperti Putri Mandalika, Batu Golog) serta menyusun lelakaq/pantun Sasak bertema budi pekerti.',
    materiBab: 'BAB 2: Cerita Rakyat Lombok (Putri Mandalika) dan Mengenal Lelakaq (Pantun Sasak)',
    semester: 'I',
    alokasiJp: 6,
  },
  {
    id: 'mulok-all-3',
    mapel: 'Muatan Lokal',
    fase: 'Fase B',
    kelasList: [1, 2, 3, 4, 5, 6],
    elemen: 'Permainan Tradisional & Seni Daerah',
    cpText:
      'Murid mengenal dan mempraktikkan permainan tradisional daerah Lombok (selodor, peresean anak/ketangkasan, begasingan) serta lagu dan tari daerah Sasak.',
    materiBab: 'BAB 3: Permainan Tradisional Anak Sasak dan Apresiasi Lagu/Tari Daerah Lombok',
    semester: 'II',
    alokasiJp: 6,
  },
  {
    id: 'mulok-all-4',
    mapel: 'Muatan Lokal',
    fase: 'Fase B',
    kelasList: [1, 2, 3, 4, 5, 6],
    elemen: 'Kearifan Lokal, Adat & Kerajinan NTB',
    cpText:
      'Murid mengenal tradisi gotong royong masyarakat Sasak (begibung, besiru, nyongkolan santun), kuliner tradisional, dan kerajinan anyaman/tenun khas Lombok Tengah.',
    materiBab: 'BAB 4: Budaya Begibung, Kerajinan Tenun/Anyaman Ketak, dan Kuliner Khas Lombok',
    semester: 'II',
    alokasiJp: 6,
  },
];

export function getBskapPresets(mapel: MapelName, kelas: number): BskapCpPreset[] {
  const exact = BANK_CP_BSKAP.filter(
    (item) => item.mapel === mapel && item.kelasList.includes(kelas),
  );
  if (exact.length > 0) return exact;

  const sameMapel = BANK_CP_BSKAP.filter((item) => item.mapel === mapel);
  if (sameMapel.length > 0) {
    // Return up to the first fase group (4-5 elements) of that mapel
    const firstFase = sameMapel[0].fase;
    return sameMapel.filter((item) => item.fase === firstFase);
  }
  return BANK_CP_BSKAP.slice(0, 5);
}

export function getRecommendedElementCount(mapel: MapelName): number {
  if (mapel === 'PAI BP' || mapel === 'Matematika' || mapel === 'Seni Budaya') {
    return 5;
  }
  return 4;
}
