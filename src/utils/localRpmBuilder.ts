import { getBankForTemplate } from '../data/gameQuestionBank';
import {
  AssessmentQuestion,
  CpMateriEntry,
  DifficultyLevel,
  DifficultyProportion,
  ExamType,
  GameQuestionItem,
  GameTemplate,
  KisiKisiRow,
  MapelName,
  QuestionComposition,
  QuestionType,
  RpmAgendaRow,
  RpmAtpRow,
  RpmLessonPlan,
  RpmProsemRow,
  RpmProtaRow,
  RpmTeachingMode,
  RpmTpItem,
  SemesterType,
} from '../types/portal';

function cleanSegment(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function stripBabPrefix(text: string): string {
  return cleanSegment(
    text
      .replace(/^(bab|unit|tema|materi)\s*[ivxlcdm\d]*\s*[:.-]\s*/i, '')
      .replace(/\s*[([]\s*pertemuan\s*(?:ke[-\s]*)?\d+\s*[)\]]\s*$/i, '')
  );
}

export function cleanMeetingTopic(raw: string): string {
  const cleaned = stripBabPrefix(cleanSegment(raw || ''));
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function formatRpmTpLine(rawTp: string): string {
  const trimmed = cleanSegment(rawTp || '');
  if (!trimmed) return '';
  // Normalize "TP.3: 3. membaca..." -> "TP.3: membaca..."
  const tpCodeMatch = trimmed.match(/^(TP\.\d+(?:\s*[-–]\s*TP\.\d+)?)\s*[:.-]\s*(.*)$/i);
  if (tpCodeMatch) {
    const code = tpCodeMatch[1].toUpperCase();
    const body = cleanSegment(tpCodeMatch[2].replace(/^\d+[.)]\s*/, ''));
    return body ? `${code}: ${body}` : code;
  }
  return cleanSegment(trimmed.replace(/^\d+[.)]\s*/, ''));
}

const PROPER_NOUN_FIXES: Array<[RegExp, string]> = [
  [/\ballah(\s+swt\.?)?/gi, 'Allah Swt.'],
  [/\bnabi muhammad(\s+saw\.?)?/gi, 'Nabi Muhammad saw.'],
  [/\bal[- ]?qur['’]?an\b/gi, "Al-Qur'an"],
  [/\bal[- ]?fatihah\b/gi, 'Al-Fatihah'],
  [/\bq\.?\s?s\.?\s*/gi, 'Q.S. '],
  [/\bpancasila\b/gi, 'Pancasila'],
  [/\bnkri\b/gi, 'NKRI'],
  [/\buud\s*1945\b/gi, 'UUD 1945'],
  [/\bbhinneka tunggal ika\b/gi, 'Bhinneka Tunggal Ika'],
  [/\bindonesia\b/gi, 'Indonesia'],
  [/\basmaul\s*husna\b/gi, 'Asmaulhusna'],
  [/\bnabi\b/gi, 'Nabi'],
  [/\brasul\b/gi, 'Rasul'],
  [/\bramadan\b/gi, 'Ramadan'],
  [/\bsalat jumat\b/gi, 'salat Jumat'],
  [/\bfathah\b/gi, 'Fathah'],
  [/\bkasrah\b/gi, 'Kasrah'],
  [/\bdhammah\b/gi, 'Dhammah'],
  [/\blombok\b/gi, 'Lombok'],
  [/\bsasak\b/gi, 'Sasak'],
];

function formatTopicPhrase(raw: string): string {
  const cleaned = stripBabPrefix(raw).replace(/\.+$/, '');
  if (!cleaned) return 'materi pembelajaran';
  let lower = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  // Also lowercase mid-sentence common capitalized words from BAB titles while restoring proper nouns
  lower = lower
    .split(/\s+/)
    .map((word) => {
      if (/^[A-Z0-9-]{2,6}$/.test(word)) return word; // acronym like KPK, FPB, SPOK
      return word.charAt(0).toLowerCase() + word.slice(1);
    })
    .join(' ');
  for (const [pattern, replacement] of PROPER_NOUN_FIXES) {
    lower = lower.replace(pattern, replacement);
  }
  return cleanSegment(lower);
}

function normalizeCurriculumSpelling(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bhijaiyah\b/g, 'hijaiah')
    .replace(/\bharokat\b/g, 'harakat')
    .replace(/\bsholat\b/g, 'salat')
    .replace(/\badzan\b/g, 'azan')
    .replace(/\biqamah\b/g, 'ikamah');
}

/**
 * Picks the most specific sub-topic for a single meeting when an umbrella BAB title
 * was passed alongside a specific TP.
 */
export function focusMeetingTopic(materiPokok: string, tpRumusan?: string): string {
  const cleanFull = cleanMeetingTopic(materiPokok);
  if (!cleanFull) return '';
  const subTopics = splitTopLevelCommasAndConnectors(cleanFull);
  if (subTopics.length <= 1 || !tpRumusan) {
    return cleanFull;
  }
  const tpClean = normalizeCurriculumSpelling(formatRpmTpLine(tpRumusan));
  let bestTopic = cleanFull;
  let bestScore = -Infinity;
  for (const sub of subTopics) {
    const subNorm = normalizeCurriculumSpelling(sub);
    const words = subNorm
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !['mengenal', 'huruf', 'materi', 'tentang'].includes(w));
    let score = 0;
    for (const w of words) {
      const matchedDirect = tpClean.includes(w);
      const matchedAlias =
        (w === 'berharakat' && /\b(harakat|fathah|kasrah|dhammah)\b/.test(tpClean)) ||
        (w === 'bersambung' && /\b(sambung|merangkai|awal,?\s*tengah)\b/.test(tpClean));
      if (matchedDirect || matchedAlias) {
        score += 3;
      } else {
        score -= 2;
      }
    }
    if (tpClean.includes(subNorm)) score += 6;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = cleanMeetingTopic(sub);
    }
  }
  return bestScore > 0 ? bestTopic : cleanFull;
}

function extractCpAnchor(cpText: string, elemen: string, mapel: MapelName): string {
  const cleanCp = cleanSegment(cpText);
  const lowerElemen = cleanSegment(elemen).toLowerCase();

  if (lowerElemen.includes('akhlak') || /akhlak terhadap allah/i.test(cleanCp)) {
    return 'sebagai wujud akhlak kepada Allah Swt. dan diri sendiri';
  }
  if (lowerElemen.includes('akidah')) {
    return 'sebagai landasan keimanan dan ketakwaan kepada Allah Swt.';
  }
  if (lowerElemen.includes('qur') || lowerElemen.includes('hadis')) {
    return 'sesuai kaidah bacaan dan pesan pokok Al-Qur’an serta Hadis';
  }
  if (lowerElemen.includes('fikih')) {
    return 'sesuai ketentuan syariat Islam secara tertib';
  }
  if (lowerElemen.includes('sejarah') || lowerElemen.includes('spi')) {
    return 'sebagai keteladanan dalam kehidupan sehari-hari';
  }
  if (mapel === 'PKn') {
    return 'sesuai nilai-nilai Pancasila dalam kehidupan bermasyarakat';
  }
  if (mapel === 'Matematika') {
    return 'untuk menyelesaikan masalah kontekstual sehari-hari';
  }
  if (mapel === 'IPAS') {
    return 'berdasarkan pengamatan lingkungan alam dan sosial sekitar';
  }
  if (mapel === 'Bahasa Indonesia') {
    return 'sesuai kaidah kebahasaan yang baik dan santun';
  }
  if (mapel === 'PJOK') {
    return 'untuk menjaga kebugaran, keselamatan, dan sportivitas';
  }
  if (mapel === 'Seni Budaya') {
    return 'sebagai wujud apresiasi dan kreativitas berkarya';
  }
  if (mapel === 'Bahasa Inggris') {
    return 'dalam komunikasi sederhana sehari-hari';
  }
  if (mapel === 'Muatan Lokal') {
    return 'sebagai wujud pelestarian kearifan budaya lokal';
  }
  return 'sesuai capaian pembelajaran';
}

type TopicNature = 'procedural' | 'narrative' | 'conceptual';

function splitTopLevelCommasAndConnectors(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    else if ((ch === ')' || ch === ']') && depth > 0) depth--;

    if (depth === 0 && (ch === ',' || ch === ';' || ch === '/' || ch === '\n' || ch === '|')) {
      const trimmed = cleanSegment(current);
      if (trimmed) parts.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }
  const tail = cleanSegment(current);
  if (tail) parts.push(tail);

  // Split top-level " dan " / " serta " outside parentheses when each side is substantive
  const expanded: string[] = [];
  for (const part of parts) {
    if (part.includes('(') || part.includes('[')) {
      // Only split on " dan " / " serta " if outside parentheses
      const subParts: string[] = [];
      let buf = '';
      let pDepth = 0;
      const tokens = part.split(/(\s+)/);
      for (const tok of tokens) {
        for (const c of tok) {
          if (c === '(' || c === '[') pDepth++;
          else if ((c === ')' || c === ']') && pDepth > 0) pDepth--;
        }
        if (pDepth === 0 && /^(dan|serta)$/i.test(tok.trim()) && cleanSegment(buf).length >= 3) {
          subParts.push(cleanSegment(buf));
          buf = '';
        } else {
          buf += tok;
        }
      }
      const rem = cleanSegment(buf);
      if (rem) subParts.push(rem);
      expanded.push(...subParts.filter((s) => s.length >= 3));
    } else {
      const sub = part
        .split(/\s+(?:dan|serta)\s+/i)
        .map((s) => cleanSegment(s))
        .filter((s) => s.length >= 3);
      if (sub.length >= 2 && sub.every((s) => s.split(/\s+/).length >= 1)) {
        expanded.push(...sub);
      } else {
        expanded.push(part);
      }
    }
  }

  return expanded
    .map((s) => cleanSegment(s.replace(/^(dan|serta)\s+/i, '')))
    .filter((s) => s.length >= 3);
}

/**
 * Extracts distinct sub-topics from the teacher's Materi/BAB input (parentheses-safe),
 * falling back to CP only if Materi is empty.
 */
export function extractSubMateriTopics(materiBab: string, cpText = ''): string[] {
  const cleanMateri = stripBabPrefix(materiBab);
  if (cleanMateri) {
    const fromMateri = splitTopLevelCommasAndConnectors(cleanMateri);
    if (fromMateri.length >= 2) {
      return Array.from(new Set(fromMateri)).slice(0, 6);
    }
    return [cleanMateri];
  }

  const fromCp = splitTopLevelCommasAndConnectors(cpText)
    .map((s) =>
      cleanSegment(
        s.replace(/^(peserta didik|murid|siswa)\s+(mampu|dapat|memahami|menunjukkan|mengenal)\s+/i, '')
      )
    )
    .filter((s) => s.length >= 6);

  if (fromCp.length === 0) {
    return ['Materi Inti Pembelajaran'];
  }
  return Array.from(new Set(fromCp)).slice(0, 3);
}

function classifyTopicNature(
  topic: string,
  cpText: string,
  elemen: string,
  mapel: MapelName,
): TopicNature {
  const text = `${topic} ${elemen} ${cpText}`.toLowerCase();
  const topicOnly = topic.toLowerCase();

  if (
    /\b(kisah|sejarah|nabi|rasul|sahabat|keteladanan|perjuangan|pahlawan|proklamasi|biografi|cerita rakyat|budaya daerah|kearifan lokal|peristiwa)\b/i.test(
      topicOnly
    ) ||
    (mapel === 'PAI BP' && elemen.toLowerCase().includes('sejarah'))
  ) {
    return 'narrative';
  }

  if (
    /\b(wudu|bersuci|tayamum|salat|sholat|azan|adzan|ikamah|iqamah|zikir|doa|membaca|melafalkan|menulis|menghitung|operasi hitung|penjumlahan|pengurangan|perkalian|pembagian|pecahan|pengukuran|huruf hijaiah|hijaiyah|surah|surat|ayat|tajwid|gerak|senam|lari|lompat|lempar|permainan|menggambar|mewarnai|menyanyi|membuat|karya|percobaan|eksperimen|dialog|percakapan|wawancara|menyimak|berbicara|praktik|demonstrasi)\b/i.test(
      topicOnly
    ) ||
    mapel === 'PJOK' ||
    mapel === 'Seni Budaya' ||
    mapel === 'Bahasa Inggris'
  ) {
    return 'procedural';
  }

  if (/\b(mempraktikkan|mendemonstrasikan|menyajikan|menghitung|menulis|membaca|melafalkan)\b/i.test(text) && mapel === 'Matematika') {
    return 'procedural';
  }

  return 'conceptual';
}

function getFaseBand(kelas: number): 'A' | 'B' | 'C' {
  if (kelas <= 2) return 'A';
  if (kelas <= 4) return 'B';
  return 'C';
}

function stripLeadingActionWord(topic: string): string {
  return cleanSegment(
    topic.replace(
      /^(mengenal|memahami|mengetahui|membiasakan|menerapkan|mengaji dan mengkaji|mengaji|mengkaji|belajar|cara)\s+/i,
      ''
    )
  );
}

function buildNaturalTpForTopic(params: {
  subTopic: string;
  nature: TopicNature;
  stage: 'L1' | 'L2' | 'L3';
  tpIndex: number;
  totalTps: number;
  kelas: number;
  mapel: MapelName;
  elemen: string;
  cpText: string;
  anchor: string;
}): string {
  const { subTopic, nature, stage, tpIndex, kelas, mapel, elemen, anchor } = params;
  const rawTopic = formatTopicPhrase(subTopic);
  const topic = stripLeadingActionWord(rawTopic) || rawTopic;
  const el = cleanSegment(elemen).toLowerCase();
  const fase = getFaseBand(kelas);
  const includeAnchor = tpIndex === 0;

  // 1. Topic-specific natural phrasing (feels written directly by an SD teacher)
  if (/rukun\s+iman/i.test(topic)) {
    if (stage === 'L1') return 'menyebutkan enam rukun iman secara berurutan';
    if (stage === 'L2') return 'memberikan contoh sikap beriman kepada Allah Swt. di rumah dan sekolah';
    return 'menunjukkan rasa syukur atas ciptaan Allah Swt. dalam keseharian';
  }
  if (/rukun\s+islam/i.test(topic)) {
    if (stage === 'L1') return 'menyebutkan lima rukun Islam secara urut';
    if (stage === 'L2') return 'memberikan contoh pelaksanaan rukun Islam bagi anak muslim';
    return 'membiasakan diri melaksanakan ibadah pokok sesuai rukun Islam';
  }
  if (/syahadat/i.test(topic)) {
    return 'melafalkan dua kalimat syahadat beserta artinya';
  }
  if (/\b(bersuci|wudu|tayamum)\b/i.test(topic)) {
    if (stage === 'L1') {
      return `menjelaskan kapan dan mengapa umat Islam melakukan ${topic}${includeAnchor ? ` ${anchor}` : ''}`;
    }
    if (stage === 'L2') {
      return `mengurutkan tata cara ${topic} agar sah dan tertib`;
    }
    return `memperagakan gerakan dan urutan ${topic} di depan kelas`;
  }
  if (/\bsalat\b/i.test(topic)) {
    if (stage === 'L1') return `menyebutkan nama dan jumlah rakaat ${topic}`;
    if (stage === 'L2') return `mengurutkan gerakan dan bacaan ${topic} secara runtut`;
    return `memperagakan gerakan serta bacaan ${topic} dengan tertib dan khusyuk`;
  }
  if (/\b(azan|ikamah|zikir|doa)\b/i.test(topic)) {
    if (stage === 'L1') return `mengenal lafaz dan kegunaan ${topic} dalam ibadah sehari-hari`;
    if (stage === 'L2') return `membedakan lafaz ${topic} serta adab saat mengucapkannya`;
    return `melafalkan ${topic} dengan fasih dan membiasakannya setelah ibadah`;
  }
  if (/huruf\s+hijaiah|hijaiyah/i.test(topic)) {
    if (/bersambung|sambung/i.test(topic)) {
      if (stage === 'L1') {
        return `mengenali perubahan bentuk ${topic} pada posisi awal, tengah, dan akhir kata`;
      }
      if (stage === 'L2') {
        return `membedakan huruf yang dapat disambung dengan yang hanya bersambung dari sebelah kanan`;
      }
      return `membaca dan merangkai ${topic} menjadi kata pendek secara lancar`;
    }
    if (/berharakat|harakat|fathah|kasrah|dhammah/i.test(topic)) {
      if (stage === 'L1') {
        return `mengenal tanda baca Fathah, Kasrah, dan Dhammah pada ${topic}`;
      }
      if (stage === 'L2') {
        return `membedakan bunyi vokal a, i, dan u pada ${topic} melalui kartu bacaan`;
      }
      return `membaca rangkaian ${topic} secara tepat dan lancar`;
    }
    if (stage === 'L1') {
      return `mengenal bentuk dan nama ${topic} tunggal secara berurutan`;
    }
    if (stage === 'L2') {
      return `membedakan bentuk ${topic} yang mirip beserta letak titiknya`;
    }
    return `melafalkan makhraj ${topic} dengan jelas serta meniru penulisannya secara rapi`;
  }
  if (/\b(surah|surat|ayat|q\.s\.|hadis)\b/i.test(topic)) {
    if (stage === 'L1') return `membaca ${topic} dengan pelafalan yang jelas`;
    if (stage === 'L2') return `menjelaskan pesan pokok yang terkandung dalam ${topic}`;
    return `membiasakan sikap terpuji sesuai pesan ${topic} di lingkungan sekolah`;
  }
  if (/asmaul\s*husna/i.test(topic)) {
    if (stage === 'L1') return `mengartikan ${topic} dengan bahasa yang sederhana`;
    if (stage === 'L2') return `menunjukkan contoh perilaku meneladani ${topic} bersama teman`;
    return `membiasakan sikap sesuai keteladanan ${topic} dalam kegiatan sehari-hari`;
  }
  if (/pecahan/i.test(topic)) {
    if (stage === 'L1') return `menunjukkan nilai ${topic} melalui gambar atau benda konkret`;
    if (stage === 'L2') return `membandingkan dan mengurutkan ${topic} dengan langkah yang runtut`;
    return `menyelesaikan soal cerita sehari-hari yang berkaitan dengan ${topic}`;
  }
  if (/keliling|luas|bangun\s+(datar|ruang)/i.test(topic)) {
    if (stage === 'L1') return `mengidentifikasi unsur dan sifat ${topic} pada benda di sekitar kelas`;
    if (stage === 'L2') return `menghitung ukuran ${topic} menggunakan satuan baku`;
    return `menyelesaikan masalah kontekstual yang melibatkan ${topic}`;
  }
  if (/penjumlahan|pengurangan|perkalian|pembagian|bilangan\s+cacah/i.test(topic)) {
    if (stage === 'L1') return `menentukan hasil ${topic} dengan bantuan benda atau garis bilangan`;
    if (stage === 'L2') return `menyelesaikan latihan hitung ${topic} secara runtut`;
    return `memecahkan soal cerita jual beli atau pembagian benda terkait ${topic}`;
  }
  if (/fotosintesis/i.test(topic)) {
    if (stage === 'L1') return 'menyebutkan bahan dan hasil dari proses fotosintesis pada tumbuhan';
    if (stage === 'L2') return 'menguraikan peran cahaya matahari, air, dan klorofil saat fotosintesis';
    return 'menyimpulkan pentingnya tumbuhan hijau bagi kelangsungan hidup makhluk di bumi';
  }
  if (/wujud\s+(zat|benda)/i.test(topic)) {
    if (stage === 'L1') return 'membedakan sifat benda padat, cair, dan gas di lingkungan sekolah';
    if (stage === 'L2') return 'mengelompokkan peristiwa mencair, membeku, dan menguap dalam keseharian';
    return 'menyimpulkan penyebab perubahan wujud benda melalui pengamatan kelompok';
  }
  if (/pancasila|gotong\s+royong/i.test(topic)) {
    if (stage === 'L1') return `mengenali makna nilai ${topic} dari gambar dan cerita`;
    if (stage === 'L2') return `memilih contoh sikap yang sesuai dengan ${topic} di rumah dan sekolah`;
    return `menerapkan perilaku ${topic} saat bekerja sama di kelas`;
  }
  if (/ide\s+pokok|kalimat\s+efektif|tanda\s+baca|teks/i.test(topic)) {
    if (stage === 'L1') return `menemukan informasi penting dari ${topic} yang dibaca`;
    if (stage === 'L2') return `memperbaiki kesalahan penggunaan huruf atau ejaan terkait ${topic}`;
    return `menyusun paragraf singkat tentang ${topic} dengan bahasa yang runtut`;
  }

  // 2. Narrative / Historical / Exemplary topics
  if (nature === 'narrative') {
    if (stage === 'L1') {
      return fase === 'A'
        ? `menceritakan kembali secara singkat kisah dalam ${topic}`
        : `menguraikan alur peristiwa penting dari ${topic}${includeAnchor ? ` ${anchor}` : ''}`;
    }
    if (stage === 'L2') {
      return `menyebutkan sikap terpuji tokoh pada ${topic} yang patut ditiru`;
    }
    return `menunjukkan contoh perilaku meneladani ${topic} di rumah dan sekolah`;
  }

  // 3. Procedural / Skill-based topics
  if (nature === 'procedural') {
    if (mapel === 'Matematika') {
      if (stage === 'L1') {
        return fase === 'A'
          ? `mengenal cara mengerjakan ${topic} menggunakan benda di sekitar`
          : `menjelaskan aturan dan langkah penyelesaian ${topic}`;
      }
      if (stage === 'L2') return `menghitung dan memeriksa hasil pengerjaan ${topic}`;
      return `menyelesaikan soal cerita sehari-hari tentang ${topic}`;
    }
    if (mapel === 'Bahasa Indonesia') {
      if (stage === 'L1') return `mengidentifikasi ciri utama dan contoh ${topic} pada bacaan`;
      if (stage === 'L2') return `memperbaiki atau melengkapi penggunaan ${topic} dalam kalimat`;
      return `menyusun serta membacakan hasil karya tentang ${topic} di depan kelas`;
    }
    if (mapel === 'Bahasa Inggris') {
      if (stage === 'L1') return `mengucapkan kosakata dan ungkapan sederhana tentang ${topic}`;
      if (stage === 'L2') return `mencocokkan ungkapan ${topic} dengan gambar atau situasi kelas`;
      return `melakukan percakapan singkat berpasangan mengenai ${topic}`;
    }
    if (mapel === 'PJOK') {
      if (stage === 'L1') return `menjelaskan manfaat serta aturan keselamatan saat melakukan ${topic}`;
      if (stage === 'L2') return `memperagakan tahapan gerak dasar ${topic} secara bertahap`;
      return `mempraktikkan gerak ${topic} dalam permainan kelompok secara sportif`;
    }
    if (mapel === 'Seni Budaya') {
      if (stage === 'L1') return `mengamati unsur bentuk, warna, atau bunyi pada karya ${topic}`;
      if (stage === 'L2') return `memilih alat dan bahan yang sesuai untuk membuat karya ${topic}`;
      return `membuat lalu menampilkan karya sederhana bertema ${topic}`;
    }
    if (mapel === 'PAI BP' && (el.includes('qur') || el.includes('hadis'))) {
      if (stage === 'L1') return `melafalkan bacaan ${topic} dengan jelas`;
      if (stage === 'L2') return `menggali pesan pokok dari ${topic} untuk kehidupan anak`;
      return `membiasakan perilaku sesuai ajaran ${topic} bersama teman dan keluarga`;
    }
    if (stage === 'L1') {
      return `mengenal ketentuan dasar sebelum melakukan ${topic}${includeAnchor ? ` ${anchor}` : ''}`;
    }
    if (stage === 'L2') return `mengurutkan langkah-langkah pelaksanaan ${topic}`;
    return `memperagakan ${topic} secara tertib bersama kelompok`;
  }

  // 4. Conceptual topics adapted by Fase A / B / C & subject
  if (mapel === 'IPAS') {
    if (stage === 'L1') {
      return fase === 'A'
        ? `menyebutkan ciri utama ${topic} dari pengamatan gambar`
        : `menguraikan konsep ${topic}${includeAnchor ? ` ${anchor}` : ''}`;
    }
    if (stage === 'L2') return `mengelompokkan contoh nyata ${topic} di lingkungan sekitar sekolah`;
    return fase === 'C'
      ? `menganalisis keterkaitan ${topic} dengan kehidupan sehari-hari melalui diskusi`
      : `menyajikan hasil pengamatan sederhana mengenai ${topic}`;
  }

  if (mapel === 'Matematika') {
    if (stage === 'L1') return `mengenal konsep ${topic} melalui contoh gambar dan benda konkret`;
    if (stage === 'L2') return `menentukan penyelesaian soal terkait ${topic}`;
    return `menggunakan pemahaman ${topic} untuk memecahkan masalah sehari-hari`;
  }

  // Rotate natural openings for general conceptual subjects (PAI BP, PKn, Muatan Lokal)
  if (stage === 'L1') {
    if (fase === 'A') return `mengenal arti ${topic}${includeAnchor ? ` ${anchor}` : ''}`;
    if (fase === 'C') return `menganalisis makna pokok ${topic}${includeAnchor ? ` ${anchor}` : ''}`;
    return `menjelaskan makna ${topic}${includeAnchor ? ` ${anchor}` : ''}`;
  }
  if (stage === 'L2') {
    return tpIndex % 2 === 0
      ? `membedakan perilaku yang sesuai dan kurang sesuai dengan ${topic}`
      : `memberikan contoh nyata penerapan ${topic} di lingkungan rumah dan sekolah`;
  }
  return `membiasakan sikap positif terkait ${topic} dalam pergaulan sehari-hari`;
}

function buildMateriDrivenTpsForEntry(
  mapel: MapelName,
  kelas: number,
  elemen: string,
  cpText: string,
  materiBab: string,
  tpPerSubMateri: 1 | 2 | 3 = 1,
): { tps: string[]; subTopicsUsed: string[] } {
  const anchor = extractCpAnchor(cpText, elemen, mapel);
  const subTopics = extractSubMateriTopics(materiBab, cpText);

  // Single focused materi -> 3 progressive cognitive stages (L1 -> L2 -> L3)
  if (subTopics.length <= 1) {
    const singleTopic = subTopics[0] || elemen || mapel;
    const nature = classifyTopicNature(singleTopic, cpText, elemen, mapel);
    const stages: Array<'L1' | 'L2' | 'L3'> = ['L1', 'L2', 'L3'];
    const tps = stages.map((stage, idx) => {
      const body = buildNaturalTpForTopic({
        subTopic: singleTopic,
        nature,
        stage,
        tpIndex: idx,
        totalTps: stages.length,
        kelas,
        mapel,
        elemen,
        cpText,
        anchor,
      });
      return `${idx + 1}. ${body}`;
    });
    return { tps, subTopicsUsed: [singleTopic, singleTopic, singleTopic] };
  }

  // Multiple sub-materi in 1 row -> 1, 2, or 3 sharp progressive TPs per sub-materi
  if (tpPerSubMateri === 2 || tpPerSubMateri === 3) {
    const stagesPerTopic: Array<'L1' | 'L2' | 'L3'> =
      tpPerSubMateri === 3 ? ['L1', 'L2', 'L3'] : ['L1', 'L3'];
    const totalExpected = subTopics.length * stagesPerTopic.length;
    const tps: string[] = [];
    const subTopicsUsed: string[] = [];

    subTopics.forEach((subTopic) => {
      const nature = classifyTopicNature(subTopic, cpText, elemen, mapel);
      stagesPerTopic.forEach((stage) => {
        const tpIndex = tps.length;
        const body = buildNaturalTpForTopic({
          subTopic,
          nature,
          stage,
          tpIndex,
          totalTps: totalExpected,
          kelas,
          mapel,
          elemen,
          cpText,
          anchor,
        });
        tps.push(`${tpIndex + 1}. ${body}`);
        subTopicsUsed.push(subTopic);
      });
    });

    return { tps, subTopicsUsed };
  }

  // Default 1 TP per sub-materi (ringkas)
  const tps = subTopics.map((subTopic, idx) => {
    const nature = classifyTopicNature(subTopic, cpText, elemen, mapel);
    const stage: 'L1' | 'L2' | 'L3' =
      nature === 'procedural'
        ? idx === 0
          ? 'L2'
          : 'L3'
        : idx === 0
        ? 'L1'
        : idx === subTopics.length - 1
        ? 'L3'
        : 'L2';
    const body = buildNaturalTpForTopic({
      subTopic,
      nature,
      stage,
      tpIndex: idx,
      totalTps: subTopics.length,
      kelas,
      mapel,
      elemen,
      cpText,
      anchor,
    });
    return `${idx + 1}. ${body}`;
  });

  return { tps, subTopicsUsed: subTopics };
}

function stripLeadingNumber(tpText: string): string {
  return cleanSegment(tpText.replace(/^\d+[.)]\s*/, ''));
}

/**
 * Deterministic local builder for CP & Materi Bank rows (No AI required).
 * Materi-driven, CP-aligned, Fase-adapted & anti-template:
 * - Breaks multi-topic Materi into 1, 2, or 3 focused TPs per sub-topic, or 3 progressive TPs (L1->L2->L3) for single topics.
 * - Uses content-specific KKO and natural Indonesian phrasing without repetitive boilerplate endings.
 * - Aligns ATP 1-to-1 with hierarchical codes "<kelas>.<row>.<urut> Murid dapat/mampu ...".
 */
export function buildLocalTpAtpForEntries(
  mapel: MapelName,
  kelas: number,
  entries: CpMateriEntry[],
  tpPerSubMateri: 1 | 2 | 3 = 1,
): CpMateriEntry[] {
  return entries.map((entry, rowIdx) => {
    const rowNum = rowIdx + 1;
    const hasContent = Boolean(
      cleanSegment(entry.cpText) || cleanSegment(entry.materiBab) || cleanSegment(entry.elemen)
    );
    if (!hasContent) {
      return {
        ...entry,
        tps: [],
        atps: [],
      };
    }

    const { tps } = buildMateriDrivenTpsForEntry(
      mapel,
      kelas,
      entry.elemen,
      entry.cpText,
      entry.materiBab,
      tpPerSubMateri,
    );
    const atps = tps.map((tp, idx) => {
      const body = stripLeadingNumber(tp);
      const actor = idx === tps.length - 1 ? 'Murid mampu' : 'Murid dapat';
      return `${kelas}.${rowNum}.${idx + 1} ${actor} ${body}`;
    });

    return {
      ...entry,
      tps,
      atps,
    };
  });
}

function normalizeSemesterLabel(raw: string | undefined, fallback: SemesterType): SemesterType {
  const val = cleanSegment(raw || '').toLowerCase();
  if (val === 'genap' || val === 'ii' || val === '2') return 'Genap';
  if (val === 'ganjil' || val === 'i' || val === '1') return 'Ganjil';
  return fallback;
}

/**
 * Automatically builds PROTA and PROSEM rows from populated TP and ATP items.
 * Preserves any existing PROSEM weekly checkmarks (bulanMinggu).
 */
export function buildProtaAndProsemFromTpAtp(params: {
  tps: RpmTpItem[];
  atps: RpmAtpRow[];
  kelas: number;
  defaultSemester: SemesterType;
  materiPokokFallback?: string;
  existingProsems?: RpmProsemRow[];
}): {
  protas: RpmProtaRow[];
  prosems: RpmProsemRow[];
} {
  const {
    tps,
    atps,
    kelas,
    defaultSemester,
    materiPokokFallback = 'Materi Pokok Pembelajaran',
    existingProsems = [],
  } = params;

  const count = Math.max(tps.length, atps.length);
  if (count === 0) {
    return { protas: [], prosems: [] };
  }

  interface UnitItem {
    kodeTp: string;
    baseMateri: string;
    focusText: string;
    jp: number;
    semester: SemesterType;
  }

  const items: UnitItem[] = [];
  for (let i = 0; i < count; i++) {
    const tp = tps[i];
    const matchedAtp =
      (tp && atps.find((a) => a.kodeTp && a.kodeTp === tp.kode)) || atps[i];

    const rawMateri = cleanSegment(
      tp?.materiTerkait || matchedAtp?.materiPokok || materiPokokFallback
    ) || `Unit Pembelajaran ${i + 1}`;
    const rawFocus = stripLeadingNumber(
      tp?.rumusan || matchedAtp?.tujuanPembelajaran || ''
    ).replace(/^\d+\.\d+\.\d+\s+/, '').replace(/^Murid\s+(dapat|mampu)\s+/i, '');

    const rawCode =
      (matchedAtp?.kodeTp && /^\d+\.\d+\.\d+$/.test(matchedAtp.kodeTp)
        ? matchedAtp.kodeTp
        : matchedAtp?.kodeTp || tp?.kode) || `${kelas}.1.${i + 1}`;

    const jp = Math.max(1, Number(tp?.jp ?? matchedAtp?.alokasiJp) || 2);
    const sem = normalizeSemesterLabel(matchedAtp?.semester, defaultSemester);

    items.push({
      kodeTp: rawCode,
      baseMateri: rawMateri,
      focusText: cleanSegment(rawFocus),
      jp,
      semester: sem,
    });
  }

  // Count duplicate baseMateri names so PROSEM shows a short distinguishing focus when needed
  const materiCounts = new Map<string, number>();
  for (const it of items) {
    const key = it.baseMateri.toLowerCase();
    materiCounts.set(key, (materiCounts.get(key) || 0) + 1);
  }

  // PROSEM: 1 row per TP/ATP, preserving any manual weekly checkmarks
  const prosems: RpmProsemRow[] = items.map((it, idx) => {
    const isSharedMateri = (materiCounts.get(it.baseMateri.toLowerCase()) || 0) > 1;
    let displayMateri = it.baseMateri;
    if (isSharedMateri && it.focusText) {
      const shortFocus =
        it.focusText.length > 56 ? `${it.focusText.slice(0, 56).trim()}...` : it.focusText;
      displayMateri = `${it.baseMateri} — ${shortFocus}`;
    }

    const prevMatch =
      existingProsems.find((p) => p.kodeTp && p.kodeTp === it.kodeTp) || existingProsems[idx];

    return {
      id: prevMatch?.id || `auto-prosem-${idx + 1}`,
      no: idx + 1,
      semester: it.semester,
      kodeTp: it.kodeTp,
      materiPokok: displayMateri,
      alokasiJp: it.jp,
      bulanMinggu: Array.isArray(prevMatch?.bulanMinggu) ? [...prevMatch.bulanMinggu] : [],
    };
  });

  // PROTA: Group matching (baseMateri, semester) units cleanly & sum their JP
  const protaGroups: Array<{
    semester: SemesterType;
    materiPokok: string;
    alokasiJp: number;
  }> = [];

  for (const it of items) {
    const existingGroup = protaGroups.find(
      (g) =>
        g.semester === it.semester &&
        g.materiPokok.toLowerCase() === it.baseMateri.toLowerCase()
    );
    if (existingGroup) {
      existingGroup.alokasiJp += it.jp;
    } else {
      protaGroups.push({
        semester: it.semester,
        materiPokok: it.baseMateri,
        alokasiJp: it.jp,
      });
    }
  }

  const protas: RpmProtaRow[] = protaGroups.map((grp, idx) => ({
    id: `auto-prota-${idx + 1}`,
    no: idx + 1,
    semester: grp.semester,
    materiPokok: grp.materiPokok,
    alokasiJp: grp.alokasiJp,
    bulanKeterangan: grp.semester === 'Ganjil' ? 'Juli - Desember' : 'Januari - Juni',
  }));

  return { protas, prosems };
}

/**
 * Selects 3 relevant dimensions from the 8 Dimensi Profil Lulusan based on mapel & topic.
 */
export function selectDimensiProfilLulusan(
  mapel: MapelName | string,
  materiPokok: string,
  tpRumusan = '',
): string {
  const text = `${materiPokok} ${tpRumusan}`.toLowerCase();

  if (mapel === 'PAI BP') {
    if (/\b(huruf|hijaiah|hijaiyah|baca|lafal|surah|surat|ayat|alquran|al-qur)\b/i.test(text)) {
      return 'Keimanan dan Ketakwaan terhadap Tuhan YME, Kemandirian, Komunikasi';
    }
    if (/\b(wudu|bersuci|tayamum|salat|sholat|ibadah)\b/i.test(text)) {
      return 'Keimanan dan Ketakwaan terhadap Tuhan YME, Kesehatan, Kemandirian';
    }
    if (/\b(kisah|nabi|rasul|teladan)\b/i.test(text)) {
      return 'Keimanan dan Ketakwaan terhadap Tuhan YME, Penalaran Kritis, Komunikasi';
    }
    return 'Keimanan dan Ketakwaan terhadap Tuhan YME, Kolaborasi, Komunikasi';
  }
  if (mapel === 'PKn') {
    return 'Kewargaan, Penalaran Kritis, Kolaborasi';
  }
  if (mapel === 'Matematika') {
    return 'Penalaran Kritis, Kemandirian, Kreativitas';
  }
  if (mapel === 'IPAS') {
    return /\b(sehat|tubuh|gizi|kebersihan|olahraga|penyakit)\b/i.test(text)
      ? 'Penalaran Kritis, Kesehatan, Kolaborasi'
      : 'Penalaran Kritis, Kreativitas, Kolaborasi';
  }
  if (mapel === 'Bahasa Indonesia') {
    return 'Komunikasi, Penalaran Kritis, Kreativitas';
  }
  if (mapel === 'PJOK') {
    return 'Kesehatan, Kolaborasi, Kemandirian';
  }
  if (mapel === 'Seni Budaya') {
    return 'Kreativitas, Kemandirian, Komunikasi';
  }
  if (mapel === 'Bahasa Inggris') {
    return 'Komunikasi, Kemandirian, Kolaborasi';
  }
  if (mapel === 'Muatan Lokal') {
    return 'Kewargaan, Kreativitas, Komunikasi';
  }
  return 'Penalaran Kritis, Kolaborasi, Kemandirian';
}

function parseTotalMinutesFromAlokasi(alokasiWaktu?: string): number {
  const raw = cleanSegment(alokasiWaktu || '');
  if (!raw) return 70;
  const jpMatch = raw.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (jpMatch) {
    const jp = Math.max(1, Number(jpMatch[1]) || 2);
    const perJp = Math.max(25, Number(jpMatch[2]) || 35);
    return Math.min(210, Math.max(35, jp * perJp));
  }
  const singleMin = raw.match(/(\d+)\s*menit/i);
  if (singleMin) {
    const mins = Number(singleMin[1]) || 70;
    return Math.min(210, Math.max(35, mins));
  }
  const jpOnly = raw.match(/(\d+)\s*jp/i);
  if (jpOnly) {
    return Math.min(210, Math.max(35, (Number(jpOnly[1]) || 2) * 35));
  }
  return 70;
}

function computeStepMinutes(alokasiWaktu?: string): {
  awal: number;
  inti: number;
  penutup: number;
  awalParts: [number, number, number, number];
  intiParts: [number, number, number, number, number];
  penutupParts: [number, number, number, number];
} {
  const total = parseTotalMinutesFromAlokasi(alokasiWaktu);
  if (total === 70) {
    return {
      awal: 10,
      inti: 50,
      penutup: 10,
      awalParts: [3, 2, 3, 2],
      intiParts: [10, 10, 12, 10, 8],
      penutupParts: [3, 3, 2, 2],
    };
  }
  if (total === 105) {
    return {
      awal: 15,
      inti: 75,
      penutup: 15,
      awalParts: [3, 3, 5, 4],
      intiParts: [15, 15, 18, 15, 12],
      penutupParts: [4, 4, 4, 3],
    };
  }
  if (total === 140) {
    return {
      awal: 15,
      inti: 110,
      penutup: 15,
      awalParts: [3, 3, 5, 4],
      intiParts: [20, 22, 25, 25, 18],
      penutupParts: [4, 4, 4, 3],
    };
  }

  const awal = Math.max(8, Math.round(total * 0.14));
  const penutup = Math.max(8, Math.round(total * 0.14));
  const inti = Math.max(20, total - awal - penutup);

  const a1 = Math.max(2, Math.round(awal * 0.3));
  const a2 = Math.max(2, Math.round(awal * 0.2));
  const a3 = Math.max(2, Math.round(awal * 0.3));
  const a4 = Math.max(2, awal - a1 - a2 - a3);

  const i1 = Math.max(4, Math.round(inti * 0.2));
  const i2 = Math.max(4, Math.round(inti * 0.2));
  const i3 = Math.max(5, Math.round(inti * 0.24));
  const i4 = Math.max(4, Math.round(inti * 0.2));
  const i5 = Math.max(4, inti - i1 - i2 - i3 - i4);

  const p1 = Math.max(2, Math.round(penutup * 0.3));
  const p2 = Math.max(2, Math.round(penutup * 0.3));
  const p3 = Math.max(2, Math.round(penutup * 0.2));
  const p4 = Math.max(2, penutup - p1 - p2 - p3);

  return {
    awal,
    inti,
    penutup,
    awalParts: [a1, a2, a3, a4],
    intiParts: [i1, i2, i3, i4, i5],
    penutupParts: [p1, p2, p3, p4],
  };
}

/**
 * Deterministic cross-disciplinary & digital utilization recommendations per SD subject.
 */
export function getDefaultRpmCrossAndDigital(
  mapel: MapelName | string,
  materiPokok: string,
  kelas: number,
): { lintasDisiplinIlmu: string; pemanfaatanDigital: string } {
  const topik = formatTopicPhrase(materiPokok) || `materi ${mapel}`;

  const crossByMapel: Record<string, string> = {
    'PAI BP':
      'Bahasa Indonesia (membaca pemahaman dan menuliskan pesan moral), Pendidikan Pancasila/PKn (menerapkan nilai jujur, santun, dan gotong royong), serta Seni Budaya (membuat kartu kata/kaligrafi sederhana).',
    PKn:
      'Bahasa Indonesia (menyampaikan pendapat santun dan membaca teks aturan), IPAS (mengenal keragaman sosial budaya masyarakat sekitar), serta Matematika (menghitung data hasil musyawarah/voting kelas).',
    'Bahasa Indonesia':
      'IPAS (menggali informasi pengetahuan alam/sosial dari teks bacaan), PKn (berkomunikasi santun saat berdiskusi kelompok), serta Seni Budaya (ilustrasi cerita dan tata letak poster infografis sederhana).',
    Matematika:
      'IPAS (pengukuran panjang/berat/waktu dan pencatatan data pengamatan sekitar), Bahasa Indonesia (memahami makna soal cerita kontekstual), serta Seni Budaya (mengenal pola bilangan dan simetri bangun pada karya).',
    IPAS:
      'Matematika (mengolah data pengamatan, grafik sederhana, dan pengukuran), Bahasa Indonesia (menyusun laporan hasil eksperimen/observasi), serta PKn & Seni Budaya (kampanye peduli lingkungan sekolah).',
    'Seni Budaya':
      'Matematika (mengukur proporsi, pola ritme, dan bentuk geometris karya), Bahasa Indonesia (menceritakan makna karya secara lisan/tertulis), serta Muatan Lokal/IPAS (mengenal bahan alam dan motif budaya Lombok).',
    PJOK:
      'IPAS (memahami fungsi organ tubuh, gerak otot, dan kesehatan kebugaran), Matematika (menghitung skor, jarak, dan catatan waktu), serta PKn (menumbuhkan sportivitas dan kerja sama tim).',
    'Bahasa Inggris':
      'Bahasa Indonesia (membandingkan kosakata dan struktur kalimat sederhana), Seni Budaya (bernyanyi lagu edukatif dan membuat kartu gambar kosakata), serta Matematika (pengenalan angka, waktu, dan berhitung dalam Bahasa Inggris).',
    'Muatan Lokal':
      'Bahasa Indonesia (menerjemahkan kosakata dan makna kearifan lokal), Seni Budaya (mengenal lagu, aksara, atau kerajinan khas Lombok), serta PKn (pelestarian budaya santun dan gotong royong masyarakat).',
  };

  const digitalByMapel: Record<string, string> = {
    'PAI BP': `Penayangan media visual dan audio pelafalan materi ${topik} melalui PID/Proyektor kelas serta kuis interaktif Game Edukasi Portal lewat QR Code.`,
    PKn: `Tayangan video situasi sehari-hari di lingkungan siswa tentang ${topik} melalui PID/Proyektor, kuis interaktif Game Edukasi Portal QR, serta dokumentasi aksi kolaborasi kelas.`,
    'Bahasa Indonesia': `Tampilan teks/cerita bergambar digital di layar PID/Proyektor tentang ${topik}, permainan kosakata melalui Game Edukasi Portal QR, serta rekaman audio latihan membaca.`,
    Matematika: `Visualisasi media hitung dan simulasi konsep ${topik} pada layar PID/Proyektor, dilanjutkan tantangan hitung cepat melalui Game Edukasi Portal QR.`,
    IPAS: `Pemutaran video fenomena alam/percobaan singkat tentang ${topik} pada PID/Proyektor, pengamatan gambar/diagram digital, serta kuis Game Edukasi Portal melalui QR Code.`,
    'Seni Budaya': `Apresiasi contoh karya/lagu/gerak terkait ${topik} via video & audio di PID/Proyektor kelas serta dokumentasi foto hasil karya murid Kelas ${kelas}.`,
    PJOK: `Pemutaran video peragaan teknik gerak ${topik} di PID kelas sebelum praktik lapangan, stopwatch digital, serta kuis aturan permainan pada Game Edukasi Portal QR.`,
    'Bahasa Inggris': `Pemutaran audio pelafalan dan lagu anak terkait ${topik} di PID/Proyektor, serta permainan kuis kosakata melalui Game Edukasi Portal QR.`,
    'Muatan Lokal': `Tayangan video budaya atau cerita rakyat Lombok terkait ${topik} di layar PID/Proyektor, audio pelafalan bahasa daerah, serta kuis interaktif Game Edukasi Portal QR.`,
  };

  return {
    lintasDisiplinIlmu:
      crossByMapel[mapel] ||
      `Bahasa Indonesia (literasi membaca dan menulis kesimpulan materi ${topik}), PKn (sikap kolaborasi dan tanggung jawab), serta Seni Budaya (penyajian karya visual sederhana).`,
    pemanfaatanDigital:
      digitalByMapel[mapel] ||
      `Penayangan materi dan ilustrasi ${topik} pada PID/Proyektor kelas serta kuis interaktif Game Edukasi Portal melalui QR Code untuk murid Kelas ${kelas}.`,
  };
}

function getNaturalApersepsi(params: {
  mapel: MapelName | string;
  topik: string;
  kelas: number;
  stage: 'intro' | 'deepen' | 'practice';
}): string {
  const { mapel, topik, kelas, stage } = params;

  if (stage === 'deepen') {
    return `Guru mengajak murid mengingat kembali inti pelajaran pada pertemuan sebelumnya melalui tanya jawab singkat 2–3 pertanyaan, lalu menayangkan contoh lanjutan mengenai ${topik} sebagai jembatan menuju kegiatan hari ini.`;
  }
  if (stage === 'practice') {
    return `Guru memandu murid mengulas sekilas konsep dasar dari pertemuan sebelumnya, lalu memperlihatkan tantangan praktik mengenai ${topik} agar murid siap memperagakan dan menerapkannya secara langsung.`;
  }

  // Stage 'intro' tailored by subject & topic so it never sounds awkward
  if (mapel === 'PAI BP') {
    if (/huruf\s+hijaiah|hijaiyah|harakat/i.test(topik)) {
      return `Guru menunjukkan kartu huruf atau mushaf Al-Qur'an di papan tulis, lalu mengajak murid Kelas ${kelas} menyebutkan huruf yang sudah mereka kenal dan mendengarkan bunyi huruf bersama dengan antusias.`;
    }
    if (/\b(surah|surat|ayat|hadis|doa|zikir|azan|ikamah)\b/i.test(topik)) {
      return `Guru memperdengarkan lantunan ${topik} secara singkat dan bertanya kapan biasanya bacaan tersebut dibaca atau didengar murid di rumah maupun musala.`;
    }
    if (/\b(wudu|bersuci|tayamum|salat|sholat)\b/i.test(topik)) {
      return `Guru menanyakan pengalaman murid saat bersiap melaksanakan ibadah di rumah atau musala, lalu menampilkan gambar urutan singkat mengenai ${topik} sebagai pemantik rasa ingin tahu.`;
    }
    return `Guru menceritakan situasi sehari-hari yang dekat dengan kehidupan anak SD di rumah atau sekolah terkait ${topik}, kemudian mengajukan dua pertanyaan pemantik untuk menggali pemahaman awal murid.`;
  }

  if (mapel === 'Matematika') {
    return `Guru membawa benda nyata yang ada di kelas (seperti potongan kertas, lidi, uang mainan, atau penggaris) untuk memantik rasa ingin tahu murid tentang ${topik} dalam kehidupan sehari-hari.`;
  }

  if (mapel === 'IPAS') {
    return `Guru menampilkan gambar atau benda nyata dari lingkungan sekitar rumah dan sekolah yang berkaitan dengan ${topik}, lalu mengajak murid mengamati dan menyampaikan dugaan awalnya secara lisan.`;
  }

  if (mapel === 'Bahasa Indonesia') {
    return `Guru menampilkan sebuah contoh kalimat atau bacaan pendek yang berkaitan dengan ${topik} di papan tulis, lalu mengajak murid membaca bersama dan menebak bagian yang menarik atau perlu diperbaiki.`;
  }

  if (mapel === 'PJOK') {
    return `Guru mengajak murid melakukan peregangan ringan di lapangan/kelas sambil mengamati contoh gerakan ${topik}, lalu menanyakan manfaat gerakan tersebut bagi kebugaran tubuh.`;
  }

  return `Guru menampilkan gambar atau cerita pendek yang dekat dengan keseharian murid Kelas ${kelas} mengenai ${topik}, lalu mengajukan pertanyaan pemantik lisan untuk menggali pengalaman awal murid.`;
}

function getNaturalOrientationAndExplore(params: {
  mapel: MapelName | string;
  topik: string;
  tpClean: string;
  stage: 'intro' | 'deepen' | 'practice';
  i1: number;
  i2: number;
  i3: number;
}): [string, string, string] {
  const { mapel, topik, tpClean, stage, i1, i2, i3 } = params;
  const targetGoal = tpClean || `menguasai ${topik}`;

  if (mapel === 'PAI BP' && /huruf\s+hijaiah|hijaiyah|harakat/i.test(topik)) {
    if (stage === 'intro') {
      return [
        `Tahap Memahami — Pengamatan & Pelafalan Bersama (${i1} Menit): Guru menayangkan poster/kartu ${topik} pada layar PID/Proyektor atau papan tulis dan mencontohkan pelafalannya secara perlahan. Murid menirukan secara klasikal lalu bergantian per kelompok agar dapat ${targetGoal}.`,
        `Tahap Memahami — Eksplorasi Bentuk & Bunyi pada LKPD (${i2} Menit): Dalam kelompok kecil (3–4 murid), anak mengamati ciri bentuk huruf pada LKPD Aktivitas 1, memasangkan huruf dengan bunyinya, dan saling menyimak bacaan teman.`,
        `Tahap Mengaplikasi — Tantangan Kartu Huruf Berkelompok (${i3} Menit): Murid mengerjakan LKPD Aktivitas 2 berupa pencocokan dan penyusunan rangkaian kartu huruf sesuai topik ${topik} dengan bimbingan guru berkeliling.`,
      ];
    }
    if (stage === 'deepen') {
      return [
        `Tahap Memahami — Membandingkan Bentuk & Tanda Baca (${i1} Menit): Guru menampilkan dua contoh huruf/tanda baca terkait ${topik} di layar PID dan memandu murid menemukan perbedaan bunyi serta bentuknya sehingga murid siap ${targetGoal}.`,
        `Tahap Memahami — Latihan Memilah Kartu pada LKPD (${i2} Menit): Secara berkelompok, murid menandai perbedaan harakat atau bentuk huruf pada tabel LKPD Aktivitas 1 sambil berlatih melafalkannya dengan jelas.`,
        `Tahap Mengaplikasi — Pemecahan Masalah Bacaan pada LKPD (${i3} Menit): Kelompok memeriksa contoh bacaan pada LKPD Aktivitas 2, menemukan huruf atau harakat yang tertukar, lalu membetulkannya bersama.`,
      ];
    }
    return [
      `Tahap Memahami — Review Kaidah & Contoh Rangkaian (${i1} Menit): Guru memodelkan cara menyambung dan membaca ${topik} langkah demi langkah di papan tulis/PID sebagai bekal agar murid mampu ${targetGoal}.`,
      `Tahap Mengaplikasi — Eksplorasi Perubahan Bentuk Huruf (${i2} Menit): Murid berpasangan mencermati posisi awal, tengah, dan akhir huruf pada LKPD Aktivitas 1 serta berlatih membaca suku kata sederhana.`,
      `Tahap Mengaplikasi — Praktik Membaca & Kasus Belajar (${i3} Menit): Melalui LKPD Aktivitas 2, murid membantu menuntaskan tantangan bacaan beruntun di kelompoknya dan membaca kartu huruf secara bergantian.`,
    ];
  }

  if (mapel === 'Matematika') {
    if (stage === 'practice') {
      return [
        `Tahap Memahami — Bedah Contoh Soal Kontekstual (${i1} Menit): Guru menayangkan satu permasalahan nyata sehari-hari yang membutuhkan ${topik} di PID/papan tulis, lalu memandu murid memahami langkah menyelesaikannya agar mampu ${targetGoal}.`,
        `Tahap Mengaplikasi — Latihan Bertahap dengan Media Bantu (${i2} Menit): Murid bekerja berpasangan atau berkelompok menyelesaikan tabel langkah hitung pada LKPD Aktivitas 1 menggunakan benda konkret atau gambar.`,
        `Tahap Mengaplikasi — Pemecahan Soal Cerita pada LKPD (${i3} Menit): Kelompok berdiskusi memecahkan soal cerita kontekstual pada LKPD Aktivitas 2, memeriksa kembali hasil hitungan, dan menuliskan kesimpulan jawabannya.`,
      ];
    }
    return [
      `Tahap Memahami — Demonstrasi Konsep Konkret (${i1} Menit): Guru memperagakan konsep dasar ${topik} menggunakan media konkret atau visual di PID kelas agar murid mudah memahami cara ${targetGoal}.`,
      `Tahap Memahami — Eksplorasi Pola & Langkah Hitung (${i2} Menit): Dalam kelompok kecil, murid mengisi latihan terbimbing pada LKPD Aktivitas 1 untuk menemukan pola atau aturan penyelesaian dari beberapa contoh soal.`,
      `Tahap Mengaplikasi — Tantangan Kasus Matematika (${i3} Menit): Murid menyelesaikan permasalahan kehidupan anak SD pada LKPD Aktivitas 2 secara bersama-sama dengan menuliskan cara pengerjaannya secara runtut.`,
    ];
  }

  if (stage === 'deepen') {
    return [
      `Tahap Memahami — Pendalaman Materi & Analisis Contoh (${i1} Menit): Guru menayangkan contoh nyata terkait ${topik} pada PID/papan tulis dan mengajukan pertanyaan terarah agar murid mampu ${targetGoal}.`,
      `Tahap Memahami — Diskusi Pembandingan pada LKPD (${i2} Menit): Murid berkelompok (3–4 anak) menelaah persamaan, perbedaan, atau urutan penting ${topik} pada LKPD Aktivitas 1 sambil saling memberi masukan.`,
      `Tahap Mengaplikasi — Penyelesaian Studi Kasus LKPD (${i3} Menit): Kelompok membaca studi kasus pada LKPD Aktivitas 2, mengidentifikasi inti permasalahan, dan merumuskan solusi yang paling masuk akal.`,
    ];
  }

  if (stage === 'practice') {
    return [
      `Tahap Memahami — Pemodelan Praktik & Penguatan Konsep (${i1} Menit): Guru mendemonstrasikan contoh penerapan ${topik} secara utuh sebagai acuan agar murid terampil dan mampu ${targetGoal}.`,
      `Tahap Mengaplikasi — Uji Coba Terbimbing pada LKPD (${i2} Menit): Murid bersama kelompoknya melengkapi panduan kerja pada LKPD Aktivitas 1 sebagai persiapan sebelum praktik atau presentasi.`,
      `Tahap Mengaplikasi — Simulasi & Pemecahan Masalah Nyata (${i3} Menit): Kelompok menganalisis tantangan pada LKPD Aktivitas 2 dan menyiapkan peragaan atau penyelesaian nyata untuk ditampilkan di kelas.`,
    ];
  }

  return [
    `Tahap Memahami — Pengamatan & Stimulasi Visual (${i1} Menit): Guru menayangkan ilustrasi atau video singkat mengenai ${topik} melalui PID/Proyektor atau media gambar di papan tulis. Murid mengamati dengan saksama dan menjawab pertanyaan penuntun agar dapat ${targetGoal}.`,
    `Tahap Memahami — Eksplorasi Konsep pada LKPD (${i2} Menit): Guru membentuk kelompok kecil (3–4 murid) dan membagikan LKPD Aktivitas 1. Murid membaca petunjuk, mendiskusikan temuan awal terkait ${topik}, serta mengaitkannya dengan pelajaran lain.`,
    `Tahap Mengaplikasi — Diskusi Studi Kasus Kontekstual (${i3} Menit): Kelompok mengerjakan LKPD Aktivitas 2 dengan berbagi peran (pembaca, pencatat, penyampai) untuk memecahkan persoalan sehari-hari sesuai materi.`,
  ];
}

export function buildDetailedRpmSteps(params: {
  mapel: MapelName | string;
  kelas: number;
  materiPokok: string;
  kodeTp?: string;
  tpRumusan?: string;
  pertemuanKe?: number;
  totalPertemuan?: number;
  alokasiWaktu?: string;
}): {
  kegiatanAwal: { durasi: string; label: string; langkah: string[] };
  kegiatanInti: { durasi: string; label: string; langkah: string[] };
  kegiatanPenutup: { durasi: string; label: string; langkah: string[] };
} {
  const {
    mapel,
    kelas,
    materiPokok,
    kodeTp = 'TP.1',
    tpRumusan,
    pertemuanKe = 1,
    totalPertemuan = 1,
    alokasiWaktu,
  } = params;

  const focusedTitle = focusMeetingTopic(materiPokok, tpRumusan) || `Materi ${mapel}`;
  const topik = formatTopicPhrase(focusedTitle);
  const tpClean = cleanSegment(
    formatRpmTpLine(tpRumusan || '')
      .replace(/^TP\.\d+(?:\s*[-–]\s*TP\.\d+)?\s*:\s*/i, '')
      .replace(/^(murid|peserta didik|siswa)\s+(dapat|mampu)\s+/i, '')
  );

  const stage: 'intro' | 'deepen' | 'practice' =
    totalPertemuan > 1 && pertemuanKe >= totalPertemuan
      ? 'practice'
      : pertemuanKe > 1
      ? 'deepen'
      : 'intro';

  const timing = computeStepMinutes(alokasiWaktu);
  const [a1, a2, a3, a4] = timing.awalParts;
  const [i1, i2, i3, i4, i5] = timing.intiParts;
  const [p1, p2, p3, p4] = timing.penutupParts;

  const apersepsiStep = getNaturalApersepsi({ mapel, topik, kelas, stage });
  const [stepInti1, stepInti2, stepInti3] = getNaturalOrientationAndExplore({
    mapel,
    topik,
    tpClean,
    stage,
    i1,
    i2,
    i3,
  });

  const joyfulPracticeByMapel: Record<string, string> = {
    'PAI BP': /huruf\s+hijaiah|hijaiyah|harakat/i.test(topik)
      ? `Tahap Mengaplikasi — Praktik Pelafalan & Kuis Interaktif (${i4} Menit): Murid bergiliran membaca kartu ${topik} dengan suara jelas dan intonasi tepat bersama kelompoknya, dilanjutkan kuis cepat Game Edukasi Portal melalui QR Code.`
      : `Tahap Mengaplikasi — Praktik Terbimbing & Kuis Interaktif (${i4} Menit): Murid memperagakan praktik nyata terkait ${topik} (seperti simulasi tata cara, pelafalan, atau bermain peran sikap terpuji), lalu mengikuti tantangan cepat pada Game Edukasi Portal melalui QR Code.`,
    PKn: `Tahap Mengaplikasi — Simulasi & Bermain Peran (${i4} Menit): Murid bermain peran situasi nyata di kelas atau keluarga (seperti musyawarah mufakat, berbagi tugas piket, atau menaati aturan bersama) sesuai topik ${topik}, kemudian mengikuti kuis Game Edukasi Portal.`,
    'Bahasa Indonesia': `Tahap Mengaplikasi — Praktik Berbahasa & Permainan Kata (${i4} Menit): Murid mempraktikkan keterampilan membaca nyaring, menyusun kalimat, atau menyunting teks tentang ${topik} menggunakan kartu kata, lalu bermain Susun Kata/Kuis di Game Edukasi Portal.`,
    Matematika: `Tahap Mengaplikasi — Praktik Media Konkret & Permainan Hitung (${i4} Menit): Murid menyelesaikan soal tantangan menggunakan alat peraga (kartu bilangan, garis bilangan, atau bangun datar) terkait ${topik}, lalu berlomba ketepatan lewat Game Edukasi Portal.`,
    IPAS: `Tahap Mengaplikasi — Pengamatan / Percobaan Mini (${i4} Menit): Murid melakukan pengamatan langsung atau percobaan sederhana menggunakan benda sekitar untuk membuktikan konsep ${topik}, mencatat hasilnya di LKPD, dan menjawab kuis cepat Game Edukasi Portal.`,
    'Seni Budaya': `Tahap Mengaplikasi — Praktik Berkarya Sederhana (${i4} Menit): Murid mempraktikkan pembuatan sketsa, karya rupa, pola ritme, atau gerak tari bertema ${topik} memakai alat yang tersedia secara rapi, kreatif, dan aman.`,
    PJOK: `Tahap Mengaplikasi — Pemanasan & Praktik Gerak Bertahap (${i4} Menit): Setelah pemanasan dinamis 3 menit, murid mempraktikkan variasi gerak ${topik} secara berpasangan maupun kelompok kecil dengan menjaga keselamatan dan sportivitas.`,
    'Bahasa Inggris': `Tahap Mengaplikasi — Latihan Pelafalan & Dialog Singkat (${i4} Menit): Murid menirukan pelafalan melalui audio/video di PID, lalu berlatih dialog pendek berpasangan menggunakan kartu gambar bertema ${topik} serta kuis Game Edukasi Portal.`,
    'Muatan Lokal': `Tahap Mengaplikasi — Praktik Bahasa Daerah & Budaya Lokal (${i4} Menit): Murid mempraktikkan dialog sederhana berbahasa Sasak atau memperagakan unsur budaya lokal terkait ${topik} dengan santun dan percaya diri.`,
  };

  const stepInti4 =
    joyfulPracticeByMapel[mapel] ||
    `Tahap Mengaplikasi — Praktik Terbimbing & Joyful Learning (${i4} Menit): Murid menerapkan pemahaman tentang ${topik} melalui peragaan langsung, permainan kartu konsep, atau kuis interaktif Game Edukasi Portal melalui QR Code.`;

  const goalSummaryText = tpClean
    ? `bahwa hari ini mereka belajar untuk ${tpClean}`
    : `tujuan pertemuan ${kodeTp} mengenai ${topik}`;

  return {
    kegiatanAwal: {
      durasi: `${timing.awal} Menit`,
      label: 'Mindful & Berkesadaran',
      langkah: [
        `Salam, Doa, dan Pengondisian (${a1} Menit): Guru menyapa murid Kelas ${kelas} dengan ramah, mengajak ketua kelas memimpin doa bersama, memeriksa kehadiran, serta memastikan kesiapan alat tulis dan kenyamanan ruang kelas.`,
        `Mindful Check-in / Kesadaran Penuh (${a2} Menit): Guru memandu murid duduk tegak dengan rileks, menarik napas dalam tiga hitungan lalu mengembuskannya perlahan sebanyak tiga kali agar pikiran tenang dan siap belajar.`,
        `Apersepsi & Pemantik (${a3} Menit): ${apersepsiStep}`,
        `Penyampaian Tujuan & Kesepakatan Belajar (${a4} Menit): Guru menyampaikan ${goalSummaryText} dengan bahasa yang mudah dipahami anak, menjelaskan alur kerja kelompok serta kuis hari ini, lalu menyepakati aturan tertib bersama.`,
      ],
    },
    kegiatanInti: {
      durasi: `${timing.inti} Menit`,
      label: 'Meaningful & Joyful (Memahami – Mengaplikasi – Merefleksi)',
      langkah: [
        stepInti1,
        stepInti2,
        stepInti3,
        stepInti4,
        `Tahap Merefleksi — Presentasi, Apresiasi & Penguatan (${i5} Menit): Perwakilan 2–3 kelompok menyampaikan hasil kerja LKPD di depan kelas, sementara kelompok lain memberi tanggapan santun dan tepuk apresiasi. Guru meluruskan hal yang masih keliru serta menegaskan kembali inti pelajaran ${topik}.`,
      ],
    },
    kegiatanPenutup: {
      durasi: `${timing.penutup} Menit`,
      label: 'Refleksi & Tindak Lanjut',
      langkah: [
        `Menyimpulkan Materi Bersama (${p1} Menit): Guru membimbing murid merangkum poin-poin penting mengenai ${topik} sesuai capaian ${kodeTp} menggunakan kata-kata murid sendiri.`,
        `Refleksi Diri & Komitmen Aksi Nyata (${p2} Menit): Murid mengisi kolom refleksi singkat pada LKPD Aktivitas 3 mengenai satu hal baru yang dipahami dan kebiasaan baik yang akan langsung dicoba hari ini.`,
        `Evaluasi Singkat & Umpan Balik (${p3} Menit): Murid mengerjakan 3 soal cek pemahaman singkat sebagai bahan evaluasi pertemuan ini, dilanjutkan pujian atas kerja sama seluruh kelompok.`,
        `Tindak Lanjut & Penutup (${p4} Menit): Guru menyampaikan pesan pengayaan/pendampingan ringan serta gambaran kegiatan pada pertemuan berikutnya, mengajak murid merapikan perlengkapan belajar, lalu menutup pelajaran dengan doa dan salam.`,
      ],
    },
  };
}

export function buildLocalLkpd(params: {
  mapel: MapelName | string;
  kelas: number;
  materiPokok: string;
  tpRumusan?: string;
}): RpmLessonPlan['lkpd'] {
  const { mapel, kelas, materiPokok, tpRumusan } = params;
  const displayTopic = focusMeetingTopic(materiPokok, tpRumusan) || `Materi ${mapel}`;
  const topik = formatTopicPhrase(displayTopic);

  if (mapel === 'PAI BP' && /huruf\s+hijaiah|hijaiyah|harakat/i.test(topik)) {
    const isHarokat = /harakat|fathah|kasrah|dhammah/i.test(topik);
    const isSambung = /bersambung|rangkaian|sambung/i.test(topik);
    return {
      judulAktivitas1: `Aktivitas 1 — Latihan Mengenal ${displayTopic}`,
      kolomHeader1: 'Bagian Latihan',
      kolomHeader2: 'Tugas & Isian Kelompok',
      aktivitas1Rows: isSambung
        ? [
            {
              no: 1,
              item: 'Huruf di Awal, Tengah, dan Akhir',
              promptIsian: 'Tuliskan kembali 3 contoh bentuk huruf hijaiah ketika disambung di awal dan tengah kata...',
            },
            {
              no: 2,
              item: 'Memilah Huruf yang Tidak Bisa Disambung ke Kiri',
              promptIsian: 'Lingkari huruf pada kartu yang hanya dapat disambung dari sebelah kanan (mis. ا, د, ذ, ر, ز, و)...',
            },
            {
              no: 3,
              item: 'Membaca Rangkaian Kata Pendek',
              promptIsian: 'Pasangkan kartu kata bersambung dengan cara bacanya, lalu bacakan bergantian di kelompok...',
            },
          ]
        : isHarokat
        ? [
            {
              no: 1,
              item: 'Tanda Harakat Fathah, Kasrah, dan Dhammah',
              promptIsian: 'Gambarkan posisi ketiga harakat pada garis huruf dan tuliskan bunyi vokalnya (a, i, u)...',
            },
            {
              no: 2,
              item: 'Membedakan Bunyi Huruf Berharakat',
              promptIsian: 'Tuliskan cara baca 4 huruf berharakat yang terdapat pada kartu bacaan kelompokmu...',
            },
            {
              no: 3,
              item: 'Meniru Penulisan & Pelafalan',
              promptIsian: 'Salin 3 huruf berharakat dengan rapi lalu praktikkan membacanya bersama teman sebangku...',
            },
          ]
        : [
            {
              no: 1,
              item: 'Mengenali Bentuk Dasar Huruf Hijaiah',
              promptIsian: 'Cocokkan 5 kartu huruf hijaiah dengan nama hurufnya secara tepat...',
            },
            {
              no: 2,
              item: 'Membedakan Huruf yang Mirip Bentuknya',
              promptIsian: 'Jelaskan letak perbedaan titik pada kelompok huruf (ب ت ث) atau (ج ح خ)...',
            },
            {
              no: 3,
              item: 'Latihan Pelafalan Huruf',
              promptIsian: 'Ucapkan tiap huruf dengan jelas secara berpasangan lalu beri tanda centang jika sudah lancar...',
            },
          ],
      judulAktivitas2: 'Aktivitas 2 — Memecahkan Masalah Bacaan Bersama Kelompok',
      aktivitas2Cases: [
        {
          judulKasus: 'Membantu Teman Membaca Kartu Kata',
          ceritaMasalah: `Saat mengaji bersama di kelas ${kelas}, Siti ragu membaca kartu kata yang memuat ${topik} karena ada huruf yang bentuk dan titiknya terlihat hampir sama.`,
          pertanyaan1: 'Petunjuk apa yang dapat kalian berikan agar Siti mudah mengenali bentuk huruf atau tandanya?',
          pertanyaan2: 'Tuliskan langkah sederhana agar kelompok kalian semua lancar membaca kartu latihan tersebut!',
        },
      ],
      judulAktivitas3: 'Aktivitas 3 — Refleksi & Kebiasaan Baik Mengaji',
      promptAktivitas3: `Tuliskan huruf atau bacaan ${topik} yang paling sudah kamu kuasai hari ini, dan kapan kamu akan melatih membacanya kembali di rumah:`,
    };
  }

  if (mapel === 'PAI BP' && /\b(wudu|bersuci|tayamum|salat|sholat)\b/i.test(topik)) {
    return {
      judulAktivitas1: `Aktivitas 1 — Urutan & Ketentuan ${displayTopic}`,
      kolomHeader1: 'Aspek yang Diperiksa',
      kolomHeader2: 'Hasil Diskusi Kelompok',
      aktivitas1Rows: [
        {
          no: 1,
          item: `Syarat & Persiapan ${displayTopic}`,
          promptIsian: 'Tuliskan hal-hal yang harus diperhatikan sebelum melaksanakan ibadah ini...',
        },
        {
          no: 2,
          item: 'Urutan Gerakan / Langkah yang Tertib',
          promptIsian: 'Susun urutan langkah mulai dari awal hingga akhir secara berurutan (1, 2, 3...)...',
        },
        {
          no: 3,
          item: 'Hal yang Membatalkan / Perlu Dihindari',
          promptIsian: 'Sebutkan 2 hal yang dapat membatalkan atau membuat ibadah menjadi tidak sah...',
        },
      ],
      judulAktivitas2: 'Aktivitas 2 — Studi Kasus Praktik Ibadah',
      aktivitas2Cases: [
        {
          judulKasus: `Kasus Praktik ${displayTopic}`,
          ceritaMasalah: `Ketika waktu ibadah hampir tiba, Ahmad baru menyadari dirinya belum hafal betul urutan ${topik} dan sempat lupa satu langkah di tengah praktik.`,
          pertanyaan1: 'Bagian penting mana yang tidak boleh terlewat agar ibadah tetap sah?',
          pertanyaan2: 'Apa yang sebaiknya dilakukan Ahmad untuk memperbaiki kekeliruannya?',
        },
      ],
      judulAktivitas3: 'Aktivitas 3 — Refleksi & Pembiasaan Ibadah',
      promptAktivitas3: `Tuliskan satu komitmen perbaikan tata cara ${topik} yang akan kamu praktikkan di rumah dan musala sekolah:`,
    };
  }

  if (mapel === 'Matematika') {
    return {
      judulAktivitas1: `Aktivitas 1 — Eksplorasi Hitung ${displayTopic}`,
      kolomHeader1: 'Tahap Pengerjaan',
      kolomHeader2: 'Contoh Penyelesaian / Gambar Kerja Kelompok',
      aktivitas1Rows: [
        {
          no: 1,
          item: 'Menggambarkan dengan Media Konkret / Sketsa',
          promptIsian: `Gambarkan model atau ilustrasi sederhana yang menunjukkan konsep ${topik}...`,
        },
        {
          no: 2,
          item: 'Menuliskan Cara & Langkah Hitung',
          promptIsian: 'Selesaikan 2 contoh soal di papan tulis dengan menuliskan langkah pengerjaannya secara urut...',
        },
        {
          no: 3,
          item: 'Memeriksa Kembali Hasil Hitungan',
          promptIsian: 'Tuliskan cara kalian mengecek apakah jawaban yang diperoleh sudah benar...',
        },
      ],
      judulAktivitas2: 'Aktivitas 2 — Pemecahan Soal Cerita Kontekstual',
      aktivitas2Cases: [
        {
          judulKasus: `Masalah Sehari-hari Tentang ${displayTopic}`,
          ceritaMasalah: `Pengurus kelas ${kelas} sedang menyiapkan perlengkapan kegiatan kelas (buku tulis, pensil, atau kue pembagian kelompok) yang jumlahnya harus dihitung menggunakan aturan ${topik}.`,
          pertanyaan1: 'Data angka apa saja yang diketahui dan apa yang perlu dicari?',
          pertanyaan2: 'Tuliskan kalimat matematika, proses menghitung, dan kesimpulan jawabannya!',
        },
      ],
      judulAktivitas3: 'Aktivitas 3 — Refleksi Belajar Matematika',
      promptAktivitas3: `Bagian mana dari ${topik} yang menurutmu paling mudah, dan soal seperti apa yang masih perlu kamu latih lagi?`,
    };
  }

  if (mapel === 'IPAS') {
    return {
      judulAktivitas1: `Aktivitas 1 — Lembar Pengamatan ${displayTopic}`,
      kolomHeader1: 'Objek / Bagian yang Diamati',
      kolomHeader2: 'Ciri, Fungsi & Hasil Pengamatan Murid',
      aktivitas1Rows: [
        {
          no: 1,
          item: `Ciri & Unsur Utama ${displayTopic}`,
          promptIsian: 'Catat ciri yang kalian amati langsung dari gambar, video, atau benda di sekitar kelas...',
        },
        {
          no: 2,
          item: 'Proses atau Perubahan yang Terjadi',
          promptIsian: 'Jelaskan bagaimana proses atau hubungan sebab-akibat berlangsung pada topik ini...',
        },
        {
          no: 3,
          item: 'Manfaat bagi Makhluk Hidup / Lingkungan',
          promptIsian: 'Tuliskan 2 manfaat atau dampak nyata dalam kehidupan sehari-hari...',
        },
      ],
      judulAktivitas2: 'Aktivitas 2 — Studi Kasus Alam & Lingkungan',
      aktivitas2Cases: [
        {
          judulKasus: `Pengamatan Lingkungan Terkait ${displayTopic}`,
          ceritaMasalah: `Di halaman sekolah SDN Lendang Telaga, murid kelas ${kelas} menemukan kondisi alam yang berkaitan langsung dengan peristiwa ${topik}. Kelompokmu diminta meneliti penyebab serta cara menjaganya.`,
          pertanyaan1: 'Mengapa peristiwa atau gejala alam tersebut bisa terjadi?',
          pertanyaan2: 'Tindakan nyata apa yang dapat dilakukan murid di sekolah untuk menjaganya?',
        },
      ],
      judulAktivitas3: 'Aktivitas 3 — Refleksi & Aksi Peduli Lingkungan',
      promptAktivitas3: `Tuliskan 1 fakta menarik tentang ${topik} dan 1 kebiasaan peduli lingkungan yang akan kamu lakukan:`,
    };
  }

  if (mapel === 'Bahasa Indonesia') {
    return {
      judulAktivitas1: `Aktivitas 1 — Telaah Bacaan (${displayTopic})`,
      kolomHeader1: 'Unsur yang Dianalisis',
      kolomHeader2: 'Temuan Kelompok pada Teks Bacaan',
      aktivitas1Rows: [
        {
          no: 1,
          item: 'Kata Kunci / Kosakata Penting',
          promptIsian: 'Catat 3 kata baru dari teks bacaan hari ini beserta artinya...',
        },
        {
          no: 2,
          item: `Analisis Inti (${displayTopic})`,
          promptIsian: `Temukan bagian kalimat atau paragraf yang menunjukkan unsur ${topik}...`,
        },
        {
          no: 3,
          item: 'Penyusunan / Perbaikan Kalimat',
          promptIsian: 'Tuliskan kembali 2 kalimat menggunakan bahasamu sendiri sesuai kaidah yang rapi...',
        },
      ],
      judulAktivitas2: 'Aktivitas 2 — Menyunting & Menyampaikan Gagasan',
      aktivitas2Cases: [
        {
          judulKasus: 'Pengumuman Mading Kelas yang Belum Rapi',
          ceritaMasalah: `Beni menulis draf tulisan bertema kebersihan kelas, tetapi beberapa kalimatnya masih belum jelas pesannya dan belum menerapkan kaidah ${topik}.`,
          pertanyaan1: 'Kesalahan atau kekurangan apa saja yang perlu diperbaiki pada tulisan tersebut?',
          pertanyaan2: 'Tuliskan hasil perbaikan singkat versi kelompok kalian agar mudah dibaca teman!',
        },
      ],
      judulAktivitas3: 'Aktivitas 3 — Refleksi Keterampilan Berbahasa',
      promptAktivitas3: `Tuliskan 1 kalimat baru yang baik dan santun tentang kegiatan sekolah dengan menerapkan ${topik}:`,
    };
  }

  // Default contextual LKPD for PKn, Seni Budaya, PJOK, Bahasa Inggris, Muatan Lokal, or other PAI BP topics
  return {
    judulAktivitas1: `Aktivitas 1 — Eksplorasi ${displayTopic}`,
    kolomHeader1: 'Hal yang Dibahas',
    kolomHeader2: 'Hasil Diskusi & Contoh dari Kelompok',
    aktivitas1Rows: [
      {
        no: 1,
        item: `Pokok Penting ${displayTopic}`,
        promptIsian: `Jelaskan dengan bahasamu sendiri hal utama yang kamu pahami tentang ${topik}...`,
      },
      {
        no: 2,
        item: 'Contoh Penerapan Nyata',
        promptIsian: 'Berikan 2 contoh sikap, kegiatan, atau karya nyata yang sesuai dengan materi hari ini...',
      },
      {
        no: 3,
        item: 'Dampak Positif jika Dipraktikkan',
        promptIsian: 'Tuliskan manfaat yang dirasakan diri sendiri dan teman di kelas...',
      },
    ],
    judulAktivitas2: 'Aktivitas 2 — Analisis Situasi Nyata di Sekolah',
    aktivitas2Cases: [
      {
        judulKasus: `Tantangan Penerapan ${displayTopic}`,
        ceritaMasalah: `Saat berkegiatan bersama di sekolah, beberapa teman di kelas ${kelas} menghadapi perbedaan pendapat yang berkaitan dengan pelaksanaan ${topik}. Kelompokmu diminta memberi saran yang adil dan bijak.`,
        pertanyaan1: 'Sikap apa yang sebaiknya dihindari dan sikap apa yang perlu dikedepankan?',
        pertanyaan2: 'Langkah nyata apa yang paling tepat dilakukan agar seluruh teman merasa nyaman?',
      },
    ],
    judulAktivitas3: 'Aktivitas 3 — Refleksi & Komitmen Diri',
    promptAktivitas3: `Satu hal baru tentang ${topik} yang saya pahami hari ini dan siap langsung saya praktikkan adalah:`,
  };
}

export function buildLocalSumatifWithQuestions(params: {
  mapel: MapelName | string;
  materiPokok: string;
  kodeTp: string;
  tpRumusan?: string;
}): string {
  const { mapel, materiPokok, kodeTp, tpRumusan } = params;
  const displayTopic = focusMeetingTopic(materiPokok, tpRumusan) || `Materi ${mapel}`;
  const topik = formatTopicPhrase(displayTopic);
  const tpClean = cleanSegment(
    formatRpmTpLine(tpRumusan || '')
      .replace(/^TP\.\d+(?:\s*[-–]\s*TP\.\d+)?\s*:\s*/i, '')
      .replace(/^(murid|peserta didik|siswa)\s+(dapat|mampu)\s+/i, '')
  );

  let q1 = `1) Jelaskan secara singkat inti materi tentang ${topik}!`;
  let q2 = `2) Berikan satu contoh penerapan ${topik} di lingkungan sekolah atau rumah!`;
  let q3 = `3) Mengapa kita perlu memahami dan menerapkan ${topik} dalam keseharian?`;
  let kunci = `Kunci ringkas: (1) Sesuai pemahaman konsep ${topik}; (2) Contoh sikap/praktik relevan; (3) Menunjang kebaikan dan keterampilan belajar.`;

  if (mapel === 'PAI BP' && /huruf\s+hijaiah|hijaiyah|harakat/i.test(topik)) {
    q1 = `1) Tunjukkan atau sebutkan 3 huruf yang termasuk dalam materi ${topik}!`;
    q2 = `2) Bagaimana cara membedakan bunyi atau bentuk huruf pada ${topik}?`;
    q3 = `3) Praktikkan membaca 2 kartu huruf/kata sesuai ${topik} di hadapan guru atau teman!`;
    kunci = `Kunci ringkas: (1) Minimal 3 huruf sesuai kartu; (2) Memperhatikan titik huruf, tanda harakat, atau sambungan huruf; (3) Pelafalan jelas dan lancar.`;
  } else if (mapel === 'PAI BP' && /\b(wudu|bersuci|tayamum|salat|sholat)\b/i.test(topik)) {
    q1 = `1) Apa tujuan dan syarat utama sebelum melakukan ${topik}?`;
    q2 = `2) Sebutkan 3 urutan langkah penting dalam pelaksanaan ${topik}!`;
    q3 = `3) Apa yang harus dilakukan jika terjadi hal yang membatalkan ${topik}?`;
    kunci = `Kunci ringkas: (1) Niat suci/memenuhi syarat sah; (2) Urutan gerakan runtut sesuai tuntunan; (3) Mengulang dari awal dengan tertib.`;
  } else if (mapel === 'Matematika') {
    q1 = `1) Tuliskan langkah pertama yang perlu dilakukan saat menyelesaikan soal ${topik}!`;
    q2 = `2) Selesaikan latihan hitung sederhana terkait ${topik} yang dituliskan guru di papan tulis!`;
    q3 = `3) Buatlah 1 contoh soal cerita pendek beserta jawabannya tentang ${topik}!`;
    kunci = `Kunci ringkas: (1) Memahami angka/soal yang diketahui; (2) Perhitungan runtut & akurat; (3) Soal cerita sesuai konteks serta hasil tepat.`;
  } else if (mapel === 'IPAS') {
    q1 = `1) Sebutkan 2 ciri atau fakta penting hasil pengamatan tentang ${topik}!`;
    q2 = `2) Bagaimana proses atau hubungan sebab-akibat yang terjadi pada ${topik}?`;
    q3 = `3) Apa tindakan nyata yang dapat kamu lakukan terkait ${topik} di lingkungan sekitar?`;
    kunci = `Kunci ringkas: (1) Menyebut 2 ciri akurat; (2) Penjelasan proses logis; (3) Aksi peduli lingkungan/keseharian.`;
  }

  const headerLine = tpClean
    ? `Tes lisan/tertulis singkat (${kodeTp}) untuk mengukur kemampuan murid dalam ${tpClean}.`
    : `Evaluasi tertulis/unjuk kerja individu sesuai indikator ${kodeTp}.`;

  return `${headerLine}\nSoal Cek Cepat:\n${q1}\n${q2}\n${q3}\n${kunci}`;
}

function createLocalLessonPlan(params: {
  pertemuanKe: number;
  totalPertemuan?: number;
  kodeTp: string;
  judulPertemuan: string;
  materiPokok: string;
  cpText: string;
  tps: RpmTpItem[];
  mapel: MapelName;
  kelas: number;
  alokasiWaktu: string;
}): RpmLessonPlan {
  const {
    pertemuanKe,
    totalPertemuan = 1,
    kodeTp,
    judulPertemuan,
    materiPokok,
    cpText,
    tps,
    mapel,
    kelas,
    alokasiWaktu,
  } = params;

  const focusedTitle =
    focusMeetingTopic(judulPertemuan || materiPokok, tps[0]?.rumusan) ||
    cleanMeetingTopic(materiPokok) ||
    `Materi ${mapel}`;
  const tpList = tps.map((t) => formatRpmTpLine(`${t.kode}: ${t.rumusan}`));
  const crossDigital = getDefaultRpmCrossAndDigital(mapel, focusedTitle, kelas);
  const dimensi = selectDimensiProfilLulusan(mapel, focusedTitle, tps[0]?.rumusan);
  const detailedSteps = buildDetailedRpmSteps({
    mapel,
    kelas,
    materiPokok: focusedTitle,
    kodeTp,
    tpRumusan: tps[0]?.rumusan,
    pertemuanKe,
    totalPertemuan,
    alokasiWaktu,
  });
  const lkpd = buildLocalLkpd({
    mapel,
    kelas,
    materiPokok: focusedTitle,
    tpRumusan: tps[0]?.rumusan,
  });
  const asesmenSumatif = buildLocalSumatifWithQuestions({
    mapel,
    materiPokok: focusedTitle,
    kodeTp,
    tpRumusan: tps[0]?.rumusan,
  });

  const topicPhrase = formatTopicPhrase(focusedTitle);

  return {
    pertemuanKe,
    kodeTp,
    judulPertemuan: focusedTitle,
    capaianPembelajaran: cpText,
    tujuanPembelajaran: tpList,
    dimensiProfilLulusan: dimensi,
    lintasDisiplinIlmu: crossDigital.lintasDisiplinIlmu,
    pemanfaatanDigital: crossDigital.pemanfaatanDigital,
    pendekatanModel: 'Deep Learning (Mindful, Meaningful, Joyful) dengan Problem Based Learning (PBL)',
    saranaMedia: `Buku Siswa ${mapel} Kelas ${kelas}, Kartu Konsep/Media Konkret ${focusedTitle}, Papan Tulis/PID, LKPD`,
    kegiatanAwal: detailedSteps.kegiatanAwal,
    kegiatanInti: detailedSteps.kegiatanInti,
    kegiatanPenutup: detailedSteps.kegiatanPenutup,
    asesmenAwal: `Tanya jawab lisan dan observasi pengetahuan awal murid mengenai ${topicPhrase} sebelum inti pembelajaran.`,
    asesmenFormatif: `Penilaian proses diskusi kelompok, ketepatan pengisian LKPD (${alokasiWaktu}), dan presentasi/praktik singkat.`,
    asesmenSumatif,
    tindakLanjutPengayaan: `Murid yang telah melampaui KKTP diberikan tantangan proyek mini atau soal penerapan lanjutan tentang ${topicPhrase}.`,
    tindakLanjutRemedial: `Murid yang belum mencapai ketuntasan dibimbing ulang secara bertahap dengan contoh konkret sederhana tentang ${topicPhrase}.`,
    lkpd,
    rubrikRows: [
      {
        aspek: `Pemahaman Konsep (${focusedTitle})`,
        skor4: 'Menjelaskan konsep dengan sangat lengkap, akurat, dan memberi contoh nyata yang tepat.',
        skor3: 'Menjelaskan konsep dengan benar namun contoh masih terbatas.',
        skor2: 'Memahami sebagian konsep dengan bantuan arahan guru.',
        skor1: 'Belum memahami konsep dasar dan memerlukan pendampingan khusus.',
      },
      {
        aspek: 'Keterampilan Mengerjakan LKPD & Pemecahan Masalah',
        skor4: 'Menyelesaikan seluruh bagian LKPD secara runtut, kritis, dan solusi sangat logis.',
        skor3: 'Menyelesaikan hampir seluruh LKPD dengan jawaban cukup runtut.',
        skor2: 'Menyelesaikan sebagian aktivitas dengan beberapa kekeliruan konsep.',
        skor1: 'Belum mampu menyelesaikan aktivitas LKPD tanpa bimbingan penuh.',
      },
      {
        aspek: 'Kolaborasi & Komunikasi Presentasi',
        skor4: 'Aktif bekerja sama, menghargai pendapat teman, dan menyampaikan hasil dengan percaya diri.',
        skor3: 'Terlibat baik dalam kelompok dan berani menyampaikan hasil.',
        skor2: 'Cukup terlibat namun masih pasif saat diskusi atau presentasi.',
        skor1: 'Kurang berpartisipasi dalam kerja kelompok maupun tanya jawab.',
      },
    ],
  };
}

export function buildLocalRpmSuite(params: {
  cpText: string;
  materiList: string[];
  mapel: MapelName;
  kelas: number;
  semester: SemesterType;
  alokasiWaktu: string;
  teachingMode: RpmTeachingMode;
  tpPerSubMateri?: 1 | 2 | 3;
}): {
  tps: RpmTpItem[];
  atps: RpmAtpRow[];
  protas: RpmProtaRow[];
  prosems: RpmProsemRow[];
  rpm: RpmLessonPlan;
  rpmList: RpmLessonPlan[];
  agendaHarian: RpmAgendaRow[];
} {
  const {
    cpText,
    materiList,
    mapel,
    kelas,
    semester,
    alokasiWaktu,
    teachingMode,
    tpPerSubMateri = 1,
  } = params;
  const cleanMaterials = materiList.map(cleanSegment).filter(Boolean);
  const topics =
    cleanMaterials.length > 0
      ? cleanMaterials.flatMap((m) => extractSubMateriTopics(m, cpText)).slice(0, 6)
      : extractSubMateriTopics('', cpText);

  const jpPerTp = Math.max(2, Number(alokasiWaktu.match(/\d+/)?.[0]) || 2);

  let rawTpStrings: string[] = [];
  let tpTopics: string[] = [];

  if (topics.length <= 1) {
    const built = buildMateriDrivenTpsForEntry(
      mapel,
      kelas,
      '',
      cpText,
      topics[0] || 'Materi Inti',
      tpPerSubMateri
    );
    rawTpStrings = built.tps;
    tpTopics = built.subTopicsUsed;
  } else {
    const built = buildMateriDrivenTpsForEntry(
      mapel,
      kelas,
      '',
      cpText,
      topics.join('; '),
      tpPerSubMateri
    );
    rawTpStrings = built.tps;
    tpTopics = built.subTopicsUsed;
  }

  const tps: RpmTpItem[] = rawTpStrings.map((rawTp, idx) => {
    const cleanBody = stripLeadingNumber(rawTp);
    const rawSubTopic = tpTopics[Math.min(idx, tpTopics.length - 1)] || topics[0];
    const materiTerkait = cleanMeetingTopic(rawSubTopic) || rawSubTopic;
    return {
      id: `local-tp-${idx + 1}`,
      kode: `TP.${idx + 1}`,
      materiTerkait,
      rumusan: `${idx + 1}. ${cleanBody}`,
      kompetensi:
        idx === 0
          ? 'Memahami (L1)'
          : idx === rawTpStrings.length - 1
          ? 'Menerapkan / Mempraktikkan (L3)'
          : 'Mengidentifikasi / Menganalisis (L2)',
      jp: jpPerTp,
    };
  });

  const atps: RpmAtpRow[] = tps.map((tp, idx) => {
    const cleanBody = stripLeadingNumber(tp.rumusan);
    const actor = idx === tps.length - 1 ? 'Murid mampu' : 'Murid dapat';
    const kodeAtp = `${kelas}.1.${idx + 1}`;
    return {
      id: `local-atp-${idx + 1}`,
      urut: idx + 1,
      kodeTp: kodeAtp,
      tujuanPembelajaran: `${kodeAtp} ${actor} ${cleanBody}`,
      materiPokok: tp.materiTerkait,
      dimensiProfil: selectDimensiProfilLulusan(mapel, tp.materiTerkait, tp.rumusan),
      alokasiJp: tp.jp,
      semester,
      indikatorKetercapaian: `${actor} ${cleanBody}`,
    };
  });

  const { protas, prosems } = buildProtaAndProsemFromTpAtp({
    tps,
    atps,
    kelas,
    defaultSemester: semester,
    materiPokokFallback: topics.map(cleanMeetingTopic).join(', '),
  });

  const rpmList: RpmLessonPlan[] =
    teachingMode === 'per-tp'
      ? tps.map((tp, idx) =>
          createLocalLessonPlan({
            pertemuanKe: idx + 1,
            totalPertemuan: tps.length,
            kodeTp: tp.kode,
            judulPertemuan: tp.materiTerkait,
            materiPokok: tp.materiTerkait,
            cpText,
            tps: [tp],
            mapel,
            kelas,
            alokasiWaktu,
          }),
        )
      : [
          createLocalLessonPlan({
            pertemuanKe: 1,
            totalPertemuan: 1,
            kodeTp: tps.map((t) => t.kode).join(', '),
            judulPertemuan: topics.map(cleanMeetingTopic).join(' & '),
            materiPokok: topics.map(cleanMeetingTopic).join(', '),
            cpText,
            tps,
            mapel,
            kelas,
            alokasiWaktu,
          }),
        ];

  const agendaHarian: RpmAgendaRow[] = rpmList.map((plan, idx) => {
    const cleanFocus = cleanMeetingTopic(plan.judulPertemuan || topics[idx] || topics[0]);
    return {
      id: `local-agenda-${idx + 1}`,
      pertemuanKe: idx + 1,
      hariTanggal: '.... / ............ 20..',
      jamAlokasi: alokasiWaktu || `${jpPerTp} x 35 Menit`,
      kelas: `Kelas ${kelas}`,
      mapel,
      materiPokok: cleanFocus,
      kegiatanIntiRingkas: `Eksplorasi bermakna, diskusi LKPD, dan praktik terarah mengenai ${formatTopicPhrase(cleanFocus)}.`,
      mediaLkpd: `Buku ${mapel}, Media Konkret, LKPD ${plan.kodeTp || ''}`.trim(),
      catatanKetercapaian: 'Terlaksana sesuai alokasi waktu; refleksi & formatif tercapai.',
    };
  });

  return {
    tps,
    atps,
    protas,
    prosems,
    rpm: rpmList[0],
    rpmList,
    agendaHarian,
  };
}

function extractCoreTopicFromTp(tpText: string, mapel: MapelName): string {
  const cleaned = cleanSegment(tpText || '')
    .replace(/^\d+(\.\d+)*[.)]?\s*/, '')
    .replace(/^(TP\.\d+\s*[:.-]\s*)/i, '')
    .replace(/^(peserta didik|murid|siswa)\s+(dapat|mampu)\s+/i, '')
    .replace(
      /^(menyebutkan|mengidentifikasi|menunjukkan|mengartikan|menjelaskan|menguraikan|membedakan|mengelompokkan|mengurutkan|membandingkan|menganalisis|menyimpulkan|menceritakan kembali|menceritakan|membaca|melafalkan|menulis|menghitung|menentukan|memecahkan|menyelesaikan|memperagakan|mempraktikkan|menerapkan|membiasakan|meneladani|mengenal|memahami|mengetahui)\s+/i,
      ''
    )
    .replace(/\s+(dengan tepat|dengan benar|secara urut|secara runtut|secara lancar|secara tartil|dalam keseharian|di lingkungan sekolah|di rumah dan sekolah)\.?$/i, '')
    .trim();

  if (!cleaned) return mapel;
  const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return formatted.length > 64 ? `${formatted.slice(0, 64).trim()}...` : formatted;
}

function buildNaturalIndikatorSoal(params: {
  tpText: string;
  materiPokok: string;
  mapel: MapelName;
  levelKognitif: 'L1' | 'L2' | 'L3';
  bentuk: QuestionType;
  variantIdx: number;
}): string {
  const { tpText, materiPokok, mapel, levelKognitif, bentuk, variantIdx } = params;
  const cleanGoal = cleanSegment(tpText || '')
    .replace(/^\d+(\.\d+)*[.)]?\s*/, '')
    .replace(/^(TP\.\d+\s*[:.-]\s*)/i, '')
    .replace(/^(peserta didik|murid|siswa)\s+(dapat|mampu)\s+/i, '')
    .replace(/\.$/, '');
  const topicPhrase = formatTopicPhrase(materiPokok || cleanGoal || mapel);

  if (bentuk === 'menjodohkan') {
    const matchVariants = [
      `Disajikan daftar pernyataan dan pasangan konsep tentang ${topicPhrase} dalam dua lajur, murid dapat memasangkan keduanya secara sesuai.`,
      `Disajikan beberapa istilah penting terkait ${topicPhrase} beserta arti atau contohnya, murid dapat menjodohkan pasangan yang tepat.`,
    ];
    return matchVariants[variantIdx % matchVariants.length];
  }

  if (bentuk === 'isian') {
    if (levelKognitif === 'L1') {
      return variantIdx % 2 === 0
        ? `Disajikan pernyataan rumpang mengenai ${topicPhrase}, murid dapat melengkapi kata atau istilah kuncinya dengan tepat.`
        : `Disajikan sebuah petunjuk singkat tentang ${topicPhrase}, murid dapat menuliskan jawaban singkatnya secara benar.`;
    }
    if (levelKognitif === 'L2') {
      return mapel === 'Matematika'
        ? `Disajikan satu soal cerita sederhana tentang ${topicPhrase}, murid dapat menuliskan hasil perhitungannya dengan tepat.`
        : `Disajikan ilustrasi kegiatan sehari-hari mengenai ${topicPhrase}, murid dapat menuliskan contoh sikap atau jawaban yang sesuai.`;
    }
    return `Disajikan sebuah permasalahan singkat terkait ${topicPhrase}, murid dapat menentukan kesimpulan atau langkah penyelesaian yang paling tepat.`;
  }

  if (bentuk === 'uraian') {
    if (levelKognitif === 'L1') {
      return `Disajikan pertanyaan mengenai konsep dasar ${topicPhrase}, murid dapat menjelaskan pengertian beserta contohnya dengan bahasa sendiri secara jelas.`;
    }
    if (levelKognitif === 'L2') {
      return mapel === 'Matematika'
        ? `Disajikan soal cerita kontekstual tentang ${topicPhrase}, murid dapat menuliskan cara pengerjaan dan hasil akhirnya secara runtut.`
        : `Disajikan situasi nyata di lingkungan rumah atau sekolah tentang ${topicPhrase}, murid dapat menjelaskan langkah penerapan yang tepat.`;
    }
    return variantIdx % 2 === 0
      ? `Disajikan sebuah kasus permasalahan anak SD terkait ${topicPhrase}, murid dapat menganalisis penyebabnya serta merumuskan solusi yang bijak dan logis.`
      : `Disajikan dua contoh perilaku berbeda mengenai ${topicPhrase}, murid dapat membandingkan dampaknya serta memberikan alasan yang logis.`;
  }

  // Pilihan Ganda ('pg')
  if (levelKognitif === 'L1') {
    const l1PgVariants = [
      cleanGoal
        ? `Disajikan beberapa pernyataan mengenai ${topicPhrase}, murid dapat ${cleanGoal.charAt(0).toLowerCase() + cleanGoal.slice(1)} dengan tepat.`
        : `Disajikan pernyataan sederhana tentang ${topicPhrase}, murid dapat mengidentifikasi ciri atau maknanya dengan tepat.`,
      `Disajikan sebuah ilustrasi atau kartu informasi tentang ${topicPhrase}, murid dapat menentukan konsep pokok yang sesuai secara tepat.`,
      `Disajikan empat pilihan pernyataan mengenai ${topicPhrase}, murid dapat menyebutkan hal yang paling benar dengan tepat.`,
    ];
    return l1PgVariants[variantIdx % l1PgVariants.length];
  }

  if (levelKognitif === 'L2') {
    if (mapel === 'Matematika') {
      return variantIdx % 2 === 0
        ? `Disajikan gambar atau data bilangan terkait ${topicPhrase}, murid dapat menghitung hasil yang sesuai dengan tepat.`
        : `Disajikan soal cerita kehidupan sehari-hari tentang ${topicPhrase}, murid dapat menentukan penyelesaian yang benar.`;
    }
    if (/wudu|bersuci|salat|langkah|urutan|tata cara/i.test(topicPhrase)) {
      return `Disajikan beberapa langkah ${topicPhrase} secara acak, murid dapat mengurutkan tahapan yang benar secara runtut.`;
    }
    return variantIdx % 2 === 0
      ? `Disajikan ilustrasi kegiatan di sekolah atau rumah terkait ${topicPhrase}, murid dapat memilih contoh perilaku yang paling tepat.`
      : `Disajikan penggalan percakapan singkat tentang ${topicPhrase}, murid dapat menentukan penerapan yang sesuai.`;
  }

  // L3 PG
  return variantIdx % 2 === 0
    ? `Disajikan sebuah kisah masalah sehari-hari mengenai ${topicPhrase}, murid dapat menganalisis solusi terbaik yang harus diambil.`
    : `Disajikan tabel atau beberapa contoh peristiwa terkait ${topicPhrase}, murid dapat menyimpulkan pernyataan yang paling logis dan tepat.`;
}

function createQuestionFromKisiRow(params: {
  row: KisiKisiRow;
  idx: number;
  kelas: number;
  mapel: MapelName;
}): AssessmentQuestion {
  const { row, idx, kelas, mapel } = params;
  const noSoal = row.noSoal || idx + 1;
  const bentuk = row.bentukSoal || 'pg';
  const kesulitan = row.kesulitan || 'Sedang';
  const level = row.levelKognitif || (kesulitan === 'Mudah' ? 'L1' : kesulitan === 'Sulit' ? 'L3' : 'L2');
  const tpIndex = row.tpIndex || 1;
  const cleanMateri = cleanMeetingTopic(row.materiPokok || row.tpText || mapel);
  const topicPhrase = formatTopicPhrase(cleanMateri || mapel);
  const isLowerGrade = kelas <= 3;

  if (bentuk === 'pg') {
    const letters: Array<'A' | 'B' | 'C' | 'D'> = isLowerGrade ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
    const answerLetters: Array<'A' | 'B' | 'C' | 'D'> = isLowerGrade ? ['B', 'C', 'A'] : ['B', 'C', 'A', 'D'];
    const correctLetter = answerLetters[idx % answerLetters.length];

    let pertanyaan = '';
    let correctOpt = '';
    let distractors: [string, string, string] = ['', '', ''];

    if (level === 'L1') {
      pertanyaan =
        idx % 2 === 0
          ? `Perhatikan pernyataan mengenai ${topicPhrase}. Manakah pernyataan yang paling tepat tentang ${topicPhrase}?`
          : `Dalam pembelajaran ${mapel} tentang ${topicPhrase}, hal pokok yang perlu dipahami pertama kali adalah ....`;
      correctOpt = `Ciri utama dan makna yang sesuai dengan konsep ${topicPhrase}`;
      distractors = [
        `Kegiatan yang bertentangan dengan aturan ${topicPhrase}`,
        `Hal lain yang tidak berkaitan dengan topik ${topicPhrase}`,
        `Pendapat keliru yang mengabaikan pokok materi ${topicPhrase}`,
      ];
    } else if (level === 'L2') {
      pertanyaan =
        mapel === 'Matematika'
          ? `Ibu guru menyiapkan alat peraga untuk berlatih ${topicPhrase}. Langkah paling tepat yang harus dilakukan murid saat mengerjakan soal tersebut adalah ....`
          : `Di lingkungan sekolah, temanmu mengajak mempraktikkan pelajaran tentang ${topicPhrase}. Contoh sikap atau penerapan yang paling tepat adalah ....`;
      correctOpt = `Melaksanakan ${topicPhrase} secara runtut sesuai aturan dan contoh yang dipelajari`;
      distractors = [
        `Mengerjakan secara tergesa-gesa tanpa memperhatikan urutan langkah`,
        `Membiarkan teman bekerja sendiri tanpa mau ikut mencoba`,
        `Mengubah ketentuan dasar ${topicPhrase} sesuka hati`,
      ];
    } else {
      pertanyaan = `Bacalah ilustrasi berikut! Saat berdiskusi di kelas, terdapat dua pendapat berbeda ketika menerapkan ${topicPhrase}. Sikap dan keputusan terbaik agar tujuan belajar tercapai dengan baik adalah ....`;
      correctOpt = `Menganalisis masalah dengan tenang lalu mengambil keputusan yang sesuai prinsip ${topicPhrase}`;
      distractors = [
        `Memaksakan pendapat pribadi tanpa mendengarkan alasan teman`,
        `Menghindari penyelesaian masalah dan membiarkan perbedaan berlarut`,
        `Menyalahkan teman kelompok karena hasil tidak sesuai keinginan sendiri`,
      ];
    }

    const opsiMap: { A: string; B: string; C: string; D?: string } = { A: '', B: '', C: '' };
    let dIdx = 0;
    for (const l of letters) {
      if (l === correctLetter) {
        opsiMap[l] = correctOpt;
      } else {
        opsiMap[l] = distractors[dIdx++];
      }
    }

    return {
      id: `local-q-${noSoal}-${idx}`,
      nomor: noSoal,
      bentuk: 'pg',
      kesulitan,
      tpIndex,
      pertanyaan,
      opsi: opsiMap,
      kunciJawaban: correctLetter,
      rubrikSkor: 'Benar = 1, Salah = 0',
      skorMaks: 1,
    };
  }

  if (bentuk === 'isian') {
    const isianStem =
      level === 'L1'
        ? `Hal penting yang menjadi inti pembahasan pada materi ${topicPhrase} adalah ....`
        : level === 'L2'
        ? `Contoh penerapan nyata dari ${topicPhrase} yang dapat langsung dilakukan di kelas adalah ....`
        : `Kesimpulan terbaik yang dapat diambil dari peristiwa berkaitan dengan ${topicPhrase} adalah ....`;
    return {
      id: `local-q-${noSoal}-${idx}`,
      nomor: noSoal,
      bentuk: 'isian',
      kesulitan,
      tpIndex,
      pertanyaan: isianStem,
      kunciJawaban: `Jawaban singkat tepat yang merujuk pada ${topicPhrase}`,
      rubrikSkor: 'Jawaban tepat = 2, Mendekati = 1, Salah = 0',
      skorMaks: 2,
    };
  }

  if (bentuk === 'uraian') {
    const uraianStem =
      level === 'L3'
        ? `Perhatikan kasus di sekolah: seorang murid belum terbiasa menerapkan ${topicPhrase} bersama teman-temannya. Jelaskan dampak yang dapat terjadi serta 2 langkah perbaikan yang sebaiknya dilakukan!`
        : `Jelaskan pemahamanmu mengenai ${topicPhrase} dan tuliskan 2 contoh penerapannya dalam kehidupan sehari-hari!`;
    return {
      id: `local-q-${noSoal}-${idx}`,
      nomor: noSoal,
      bentuk: 'uraian',
      kesulitan,
      tpIndex,
      pertanyaan: uraianStem,
      kunciJawaban: `Memuat penjelasan akurat tentang ${topicPhrase} disertai alasan logis / 2 contoh penerapan nyata yang relevan.`,
      rubrikSkor: 'Skor 4: Lengkap + contoh/alasan tepat; Skor 3: Cukup lengkap; Skor 2: Kurang contoh; Skor 1: Tidak lengkap',
      skorMaks: 4,
    };
  }

  return {
    id: `local-q-${noSoal}-${idx}`,
    nomor: noSoal,
    bentuk: 'menjodohkan',
    kesulitan,
    tpIndex,
    pertanyaan: `Konsep utama maupun contoh perilaku yang tepat terkait ${topicPhrase}`,
    kunciJawaban: `Penerapan dan makna yang sesuai pada ${topicPhrase}`,
    rubrikSkor: 'Benar = 1, Salah = 0',
    skorMaks: 1,
  };
}

export function buildLocalQuestionsFromKisi(params: {
  examType: ExamType;
  kelas: number;
  mapel: MapelName;
  kisiRows: KisiKisiRow[];
}): AssessmentQuestion[] {
  const { kelas, mapel, kisiRows } = params;
  return kisiRows.map((row, idx) =>
    createQuestionFromKisiRow({ row, idx, kelas, mapel })
  );
}

export function buildLocalAssessmentDraft(params: {
  examType: ExamType;
  kelas: number;
  mapel: MapelName;
  tps: string[];
  composition: QuestionComposition;
  difficulty: DifficultyProportion;
}): {
  kisiRows: KisiKisiRow[];
  questions: AssessmentQuestion[];
} {
  const { examType, kelas, mapel, tps, composition, difficulty } = params;
  const validTps = tps.map(cleanSegment).filter(Boolean);
  const safeTps =
    validTps.length > 0
      ? validTps
      : [`Murid mampu memahami materi inti ${mapel} Kelas ${kelas} sesuai capaian pembelajaran.`];

  const types: QuestionType[] = [
    ...Array<QuestionType>(Math.max(0, composition.pg)).fill('pg'),
    ...Array<QuestionType>(Math.max(0, composition.isian)).fill('isian'),
    ...Array<QuestionType>(Math.max(0, composition.menjodohkan)).fill('menjodohkan'),
    ...Array<QuestionType>(Math.max(0, composition.uraian)).fill('uraian'),
  ];

  const total = types.length;
  const mudahCount = Math.round((total * difficulty.mudah) / 100);
  const sedangCount = Math.round((total * difficulty.sedang) / 100);

  const kisiRows: KisiKisiRow[] = [];

  types.forEach((bentuk, idx) => {
    const noSoal = idx + 1;
    const tpIndex = idx % safeTps.length;
    const tpText = safeTps[tpIndex];
    const kesulitan: DifficultyLevel =
      idx < mudahCount ? 'Mudah' : idx < mudahCount + sedangCount ? 'Sedang' : 'Sulit';
    const levelKognitif: 'L1' | 'L2' | 'L3' =
      kesulitan === 'Mudah' ? 'L1' : kesulitan === 'Sedang' ? 'L2' : 'L3';

    const materiPokok = extractCoreTopicFromTp(tpText, mapel);
    const indikatorSoal = buildNaturalIndikatorSoal({
      tpText,
      materiPokok,
      mapel,
      levelKognitif,
      bentuk,
      variantIdx: idx,
    });

    kisiRows.push({
      id: `local-kisi-${noSoal}`,
      noSoal,
      tpIndex: tpIndex + 1,
      tpText,
      materiPokok,
      indikatorSoal,
      levelKognitif,
      kesulitan,
      bentukSoal: bentuk,
    });
  });

  const questions = buildLocalQuestionsFromKisi({
    examType,
    kelas,
    mapel,
    kisiRows,
  });

  return { kisiRows, questions };
}

/**
 * Local Game Question Builder (No AI / Zero Quota).
 * Matches existing 150-item bank by topic & mapel keywords and fills remaining slots cleanly.
 */
export function buildLocalGameDraft(params: {
  mapel: MapelName;
  kelas: number;
  template: GameTemplate;
  topic: string;
  count?: number;
}): GameQuestionItem[] {
  const { mapel, kelas, template, topic, count = 10 } = params;
  const isWordTemplate = template === 'crossword' || template === 'word-scramble';
  const bank = getBankForTemplate(template);
  const cleanTopic = cleanSegment(topic) || mapel;

  const keywords = Array.from(
    new Set(
      `${cleanTopic} ${mapel}`
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((w) => w.length >= 3 && !['dan', 'atau', 'kelas', 'sd', 'materi', 'yang', 'untuk'].includes(w))
    )
  );

  // Score bank items by keyword match
  const scored = bank.map((item) => {
    const hay = `${item.prompt} ${item.answer} ${item.clue || ''}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (hay.includes(kw)) score += 2;
    }
    return { item, score };
  });

  const matched = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);

  const selected: GameQuestionItem[] = [];
  const usedIds = new Set<string>();

  for (const item of matched) {
    if (selected.length >= count) break;
    if (isWordTemplate && !/^[A-Z]{4,10}$/.test(item.answer.trim().toUpperCase())) continue;
    selected.push({ ...item, id: `local_gq_${Date.now()}_${selected.length + 1}` });
    usedIds.add(item.id);
  }

  // Extract clean A-Z words from topic or mapel defaults if word template needs more items
  if (isWordTemplate && selected.length < count) {
    const topicWords = cleanTopic
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter((w) => w.length >= 4 && w.length <= 10);

    const mapelFallbackWords: Record<string, Array<[string, string, string]>> = {
      'PAI BP': [
        ['AMANAH', 'Sifat dapat dipercaya dan menjaga titipan dengan baik', 'Sifat terpuji'],
        ['JUJUR', 'Berkata dan berbuat sesuai dengan kenyataan sebenarnya', 'Lawan dari bohong'],
        ['WUDU', 'Bersuci menggunakan air sebelum melaksanakan salat', 'Syarat sah salat'],
        ['IKHLAS', 'Beribadah dan berbuat baik semata-mata karena Allah', 'Hati yang tulus'],
        ['ZAKAT', 'Harta wajib yang dikeluarkan untuk orang yang berhak', 'Rukun Islam'],
      ],
      Matematika: [
        ['PERSEGI', 'Bangun datar yang memiliki empat sisi sama panjang', 'Empat sudut siku-siku'],
        ['SEGITIGA', 'Bangun datar yang memiliki tiga sisi dan tiga sudut', 'Jumlah sudut 180 derajat'],
        ['PECAHAN', 'Bilangan yang terdiri dari pembilang dan penyebut', 'Bagian dari keseluruhan'],
        ['KELILING', 'Jumlah panjang seluruh sisi yang membatasi bangun datar', 'Ukuran tepi bangun'],
        ['BILANGAN', 'Konsep matematika untuk mencacah dan mengukur', 'Terdiri dari angka'],
      ],
      IPAS: [
        ['AKAR', 'Bagian tumbuhan yang menyerap air dari dalam tanah', 'Tumbuh ke bawah'],
        ['ENERGI', 'Kemampuan untuk melakukan kerja atau usaha', 'Contohnya panas dan gerak'],
        ['MAGNET', 'Benda yang dapat menarik logam besi atau baja', 'Memiliki kutub utara-selatan'],
        ['EKOSISTEM', 'Hubungan timbal balik antara makhluk hidup dan lingkungannya', 'Biotik dan abiotik'],
        ['CAHAYA', 'Energi gelombang yang membuat mata dapat melihat benda', 'Merambat lurus'],
      ],
      PKn: [
        ['PANCASILA', 'Dasar negara Republik Indonesia yang terdiri atas lima sila', 'Lambangnya Garuda'],
        ['TOLERANSI', 'Sikap saling menghargai perbedaan agama dan budaya', 'Memperkuat persatuan'],
        ['ATURAN', 'Ketentuan yang harus dipatuhi demi ketertiban bersama', 'Ada di rumah dan sekolah'],
        ['MUSYAWARAH', 'Berdiskusi bersama untuk mencapai keputusan mufakat', 'Sila keempat'],
        ['GOTONG', 'Bekerja bersama-sama meringankan beban sesama warga', 'Pasangan kata royong'],
      ],
    };

    const extraCandidates: Array<[string, string, string]> = [
      ...topicWords.map((w): [string, string, string] => [
        w,
        `Kata kunci penting pada topik ${cleanTopic} (${mapel} Kelas ${kelas})`,
        `Materi ${mapel}`,
      ]),
      ...(mapelFallbackWords[mapel] || []),
    ];

    const usedAnswers = new Set(selected.map((s) => s.answer.toUpperCase()));
    for (const [word, prompt, clue] of extraCandidates) {
      if (selected.length >= count) break;
      if (usedAnswers.has(word)) continue;
      usedAnswers.add(word);
      selected.push({
        id: `local_gq_${Date.now()}_${selected.length + 1}`,
        prompt,
        answer: word,
        clue,
      });
    }
  }

  // Top up remaining slots from general bank for that template
  for (const item of bank) {
    if (selected.length >= count) break;
    if (usedIds.has(item.id)) continue;
    if (isWordTemplate && !/^[A-Z]{4,10}$/.test(item.answer.trim().toUpperCase())) continue;
    selected.push({ ...item, id: `local_gq_${Date.now()}_${selected.length + 1}` });
    usedIds.add(item.id);
  }

  return selected.slice(0, count);
}
