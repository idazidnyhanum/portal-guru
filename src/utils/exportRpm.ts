import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { RpmDocKind, RpmLessonPlan, RpmSuiteDoc } from '../types/portal';
import {
  cleanMeetingTopic,
  formatRpmTpLine,
  getDefaultRpmCrossAndDigital,
} from './localRpmBuilder';
import { buildHtmlKop, drawPdfKop } from './schoolKop';

function sanitizeFilename(raw: string): string {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getProsemMonths(semester: 'Ganjil' | 'Genap'): string[] {
  return semester === 'Genap'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun']
    : ['Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
}

export function getRpmPlans(docData: RpmSuiteDoc, meetingIndex?: number): RpmLessonPlan[] {
  const list =
    Array.isArray(docData.rpmList) && docData.rpmList.length > 0
      ? docData.rpmList
      : docData.rpm
      ? [docData.rpm]
      : [];
  if (typeof meetingIndex === 'number' && list.length > 0) {
    const safeIdx = Math.min(Math.max(0, meetingIndex), list.length - 1);
    return [list[safeIdx]];
  }
  return list;
}

export interface PairedTpAtpRow {
  no: number;
  kode: string;
  materiPokok: string;
  tpText: string;
  atpText: string;
  jp: number;
}

export function buildPairedTpAtpRows(docData: RpmSuiteDoc): PairedTpAtpRow[] {
  const tps = Array.isArray(docData.tps) ? docData.tps : [];
  const atps = Array.isArray(docData.atps) ? docData.atps : [];
  const count = Math.max(tps.length, atps.length);
  const rows: PairedTpAtpRow[] = [];
  const kelas = docData.identity?.kelas || 1;

  for (let i = 0; i < count; i++) {
    const tp = tps[i];
    const matchedAtp =
      (tp && atps.find((a) => a.kodeTp && a.kodeTp === tp.kode)) || atps[i];

    const rawTp = (tp?.rumusan || matchedAtp?.tujuanPembelajaran || '').trim();
    const tpText = rawTp
      ? /^\d+[.)]\s/.test(rawTp)
        ? rawTp
        : `${i + 1}. ${rawTp}`
      : '-';

    let atpText = (matchedAtp?.tujuanPembelajaran || '').trim();
    const isAlreadyReferenceAtp =
      /^\d+\.\d+\.\d+\s+/.test(atpText) || /^Murid\s+(dapat|mampu)\s+/i.test(atpText);

    if (!atpText || (atpText === rawTp && !isAlreadyReferenceAtp)) {
      const cleanBody = rawTp.replace(/^\d+[.)]\s*/, '').trim();
      const actor = i === count - 1 ? 'Murid mampu' : 'Murid dapat';
      atpText = cleanBody
        ? `${kelas}.1.${i + 1} ${actor} ${cleanBody}`
        : '-';
    }

    rows.push({
      no: matchedAtp?.urut || i + 1,
      kode:
        (matchedAtp?.kodeTp && /^\d+\.\d+\.\d+$/.test(matchedAtp.kodeTp)
          ? matchedAtp.kodeTp
          : tp?.kode || matchedAtp?.kodeTp) || `${kelas}.1.${i + 1}`,
      materiPokok:
        tp?.materiTerkait ||
        matchedAtp?.materiPokok ||
        docData.identity.materiPokok ||
        '-',
      tpText,
      atpText,
      jp: tp?.jp ?? matchedAtp?.alokasiJp ?? 2,
    });
  }

  return rows;
}

export function getDocKindLabel(kind: RpmDocKind): string {
  switch (kind) {
    case 'tp':
    case 'atp':
    case 'tp-atp':
      return '1 & 2. TP & ATP (1 Lembar)';
    case 'prota':
      return '3. Program Tahunan (PROTA)';
    case 'prosem':
      return '4. Program Semester (PROSEM)';
    case 'rpm':
      return '5. Rencana Pembelajaran Mendalam (RPM)';
    case 'agenda':
      return '6. Agenda Harian Mengajar';
    default:
      return 'Paket Lengkap Perangkat Pembelajaran';
  }
}

function getFilePrefix(kind: RpmDocKind, meetingIndex?: number): string {
  switch (kind) {
    case 'tp':
    case 'atp':
    case 'tp-atp':
      return '01_02_TP_dan_ATP';
    case 'prota':
      return '03_PROTA';
    case 'prosem':
      return '04_PROSEM';
    case 'rpm':
      return typeof meetingIndex === 'number'
        ? `05_RPM_Pertemuan_${meetingIndex + 1}`
        : '05_RPM_Lengkap';
    case 'agenda':
      return '06_Agenda_Harian';
    default:
      return 'Paket_Perangkat_RPM';
  }
}

export function getRpmExportFileName(
  docData: RpmSuiteDoc,
  targetKind: RpmDocKind,
  ext: 'pdf' | 'doc',
  meetingIndex?: number
): string {
  return `${getFilePrefix(targetKind, meetingIndex)}_${sanitizeFilename(
    docData.identity.mapel
  )}_Kls${docData.identity.kelas}_${docData.identity.paperSize}.${ext}`;
}

function buildPdfInstance(
  docData: RpmSuiteDoc,
  targetKind: RpmDocKind,
  meetingIndex?: number
): jsPDF {
  const { identity } = docData;
  const tps = Array.isArray(docData.tps) ? docData.tps : [];
  const atps = Array.isArray(docData.atps) ? docData.atps : [];
  const protas = Array.isArray(docData.protas) ? docData.protas : [];
  const prosems = Array.isArray(docData.prosems) ? docData.prosems : [];
  const agendaHarian = Array.isArray(docData.agendaHarian) ? docData.agendaHarian : [];
  const rpmPlans = getRpmPlans(docData, meetingIndex);

  const pageFormat: [number, number] =
    identity.paperSize === 'F4' ? [215, 330] : [210, 297];

  const initialOrientation: 'portrait' | 'landscape' =
    targetKind === 'prosem' ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation: initialOrientation,
    unit: 'mm',
    format: pageFormat,
  });

  const getPageW = () => pdf.internal.pageSize.getWidth();
  const getPageH = () => pdf.internal.pageSize.getHeight();
  const marginX = 15;
  const contentW = getPageW() - marginX * 2;
  let isFirstPage = true;
  let currentOrientation: 'portrait' | 'landscape' = initialOrientation;

  const startSectionPage = (orient: 'portrait' | 'landscape' = 'portrait') => {
    currentOrientation = orient;
    if (!isFirstPage) {
      pdf.addPage(pageFormat, orient);
    }
    isFirstPage = false;
  };

  const drawKop = (subJudul: string, extraSub?: string, customMarginX = marginX): number =>
    drawPdfKop(pdf, {
      marginX: customMarginX,
      pageW: getPageW(),
      subJudul,
      extraSub,
      fallbackInstansi: identity.instansi,
    });

  const drawMetaStrip = (y: number, customLeftMargin = marginX): number => {
    pdf.setFont('times', 'normal');
    pdf.setFontSize(9.5);
    const infoLine = `Mata Pelajaran: ${identity.mapel}   |   Kelas / Fase: ${identity.kelas} / ${identity.fase}   |   Semester: ${identity.semester} (${identity.tahunAjaran})`;
    pdf.text(infoLine, customLeftMargin, y);
    return y + 5;
  };

  const drawSignatureBlock = (startY: number, customMarginX = marginX): number => {
    const curPageW = getPageW();
    const curPageH = getPageH();
    let y = startY + 8;
    if (y + 34 > curPageH - 12) {
      pdf.addPage(pageFormat, currentOrientation);
      y = 18;
    }
    const leftX = customMarginX + 6;
    const rightX = curPageW / 2 + 12;

    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.text('Mengetahui,', leftX, y);
    pdf.text(identity.kotaTanggal || 'Lendang Telaga, ........................ 2026', rightX, y);
    y += 4.8;
    pdf.text('Kepala Sekolah', leftX, y);
    pdf.text(`Guru ${identity.mapel}`, rightX, y);
    y += 18;
    pdf.setFont('times', 'bold');
    pdf.text(
      identity.kepalaSekolah ? identity.kepalaSekolah : '(..........................................)',
      leftX,
      y
    );
    pdf.text(
      identity.namaPenyusun ? identity.namaPenyusun : '(..........................................)',
      rightX,
      y
    );
    y += 4.5;
    pdf.setFont('times', 'normal');
    pdf.text(`NIP. ${identity.nipKepalaSekolah || '....................................'}`, leftX, y);
    pdf.text(`NIP. ${identity.nipPenyusun || '....................................'}`, rightX, y);
    return y + 6;
  };

  const include = (k: 'tp-atp' | 'prota' | 'prosem' | 'rpm' | 'agenda') =>
    targetKind === 'suite' ||
    targetKind === k ||
    (k === 'tp-atp' && (targetKind === 'tp' || targetKind === 'atp'));

  // 1 & 2. TP DAN ATP DALAM SATU LEMBAR (KOLOM ATP DI SEBELAH KOLOM TP)
  if (include('tp-atp')) {
    const pairedRows = buildPairedTpAtpRows(docData);
    startSectionPage();
    let y = drawKop(
      'TUJUAN PEMBELAJARAN (TP) & ALUR TUJUAN PEMBELAJARAN (ATP)',
      `${identity.mapel.toUpperCase()} — KELAS ${identity.kelas} (${identity.fase})`
    );
    y = drawMetaStrip(y);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(9.5);
    pdf.text('Capaian Pembelajaran (CP):', marginX, y);
    y += 4.2;
    pdf.setFont('times', 'normal');
    const cpLines = pdf.splitTextToSize(identity.cpText || '-', contentW) as string[];
    pdf.text(cpLines, marginX, y);
    y += cpLines.length * 4.3 + 4;

    autoTable(pdf, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: {
        font: 'times',
        fontSize: 8.8,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        cellPadding: 1.8,
      },
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
      head: [
        [
          'No',
          'Kode',
          'Materi Pokok',
          'Tujuan Pembelajaran (TP)',
          'Alur Tujuan Pembelajaran (ATP) & Indikator',
          'JP',
        ],
      ],
      body:
        pairedRows.length > 0
          ? pairedRows.map((r) => [
              String(r.no),
              r.kode,
              r.materiPokok,
              r.tpText,
              r.atpText,
              String(r.jp),
            ])
          : [['-', '-', '-', 'Belum ada data TP.', 'Belum ada data ATP.', '-']],
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 28 },
        3: { cellWidth: 57 },
        4: { cellWidth: 62 },
        5: { cellWidth: 10, halign: 'center' },
      },
    });
    const finalY =
      (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
    drawSignatureBlock(finalY);
  }

  // 3. PROTA
  if (include('prota')) {
    startSectionPage();
    let y = drawKop('PROGRAM TAHUNAN (PROTA)', `TAHUN PELAJARAN ${identity.tahunAjaran}`);
    y = drawMetaStrip(y);
    const totalJp = protas.reduce((acc, r) => acc + (r.alokasiJp || 0), 0);

    autoTable(pdf, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: {
        font: 'times',
        fontSize: 9.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        cellPadding: 2,
      },
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
      head: [['No', 'Semester', 'Materi Pokok / Unit Pembelajaran', 'Alokasi Waktu (JP)', 'Bulan / Keterangan']],
      body: [
        ...protas.map((p) => [
          String(p.no),
          p.semester,
          p.materiPokok,
          `${p.alokasiJp} JP`,
          p.bulanKeterangan,
        ]),
        ['', '', 'Total Alokasi Waktu Tahunan', `${totalJp} JP`, ''],
      ],
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      },
    });
    const finalY =
      (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
    drawSignatureBlock(finalY);
  }

  // 4. PROSEM (Landscape F4/A4, 5 Minggu tiap Bulan)
  if (include('prosem')) {
    startSectionPage('landscape');
    const prosemMarginX = 12;
    const landscapeW = getPageW();
    let y = drawKop(
      `PROGRAM SEMESTER (PROSEM) — SEMESTER ${identity.semester.toUpperCase()}`,
      `TAHUN PELAJARAN ${identity.tahunAjaran}`,
      prosemMarginX
    );
    y = drawMetaStrip(y, prosemMarginX);

    const months = getProsemMonths(identity.semester);
    const totalWeekCols = months.length * 5;
    const weekColW = 5.4;
    const noColW = 8;
    const kodeColW = 16;
    const jpColW = 9;
    const materiColW = Math.max(
      55,
      landscapeW - prosemMarginX * 2 - (noColW + kodeColW + jpColW + totalWeekCols * weekColW)
    );

    const headRow1: Array<
      string | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> }
    > = [
      { content: 'No', rowSpan: 2 },
      { content: 'Kode TP', rowSpan: 2 },
      { content: 'Materi Pokok', rowSpan: 2 },
      { content: 'JP', rowSpan: 2 },
      ...months.map((m) => ({ content: m, colSpan: 5, styles: { halign: 'center' } })),
    ];
    const headRow2 = months.flatMap(() => ['1', '2', '3', '4', '5']);

    autoTable(pdf, {
      startY: y,
      margin: { left: prosemMarginX, right: prosemMarginX },
      styles: {
        font: 'times',
        fontSize: 8.2,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: 1.0,
      },
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      head: [headRow1 as never, headRow2],
      body:
        prosems.length > 0
          ? prosems.map((row) => {
              const marks = Array.isArray(row.bulanMinggu) ? row.bulanMinggu : [];
              const weekMarks = months.flatMap((m) =>
                [1, 2, 3, 4, 5].map((w) => (marks.includes(`${m}-M${w}`) ? 'V' : ''))
              );
              return [String(row.no), row.kodeTp, row.materiPokok, String(row.alokasiJp), ...weekMarks];
            })
          : [['-', '-', 'Belum ada data PROSEM.', '-', ...Array.from({ length: totalWeekCols }, () => '')]],
      columnStyles: {
        0: { cellWidth: noColW, halign: 'center' },
        1: { cellWidth: kodeColW, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: materiColW },
        3: { cellWidth: jpColW, halign: 'center' },
        ...Object.fromEntries(
          Array.from({ length: totalWeekCols }, (_, idx) => [
            idx + 4,
            { cellWidth: weekColW, halign: 'center', fontStyle: 'bold' },
          ])
        ),
      },
    });
    const finalY =
      (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
    drawSignatureBlock(finalY, prosemMarginX);
  }

  // 5. RPM (Mendukung 1 TP = 1 Pertemuan lewat rpmList maupun mode gabungan)
  if (include('rpm')) {
    const totalMeetings = rpmPlans.length;
    rpmPlans.forEach((plan, pIdx) => {
      startSectionPage();
      const meetingNum = plan.pertemuanKe ?? pIdx + 1;
      const meetingHeaderExtra =
        totalMeetings > 1 || plan.kodeTp
          ? `${identity.mapel.toUpperCase()} — PERTEMUAN KE-${meetingNum}${
              plan.kodeTp ? ` (${plan.kodeTp})` : ''
            }`
          : identity.mapel.toUpperCase();

      let y = drawKop('RENCANA PEMBELAJARAN MENDALAM (RPM)', meetingHeaderExtra);

      // A. IDENTITAS UMUM
      pdf.setFont('times', 'bold');
      pdf.setFontSize(10.5);
      pdf.text('A. IDENTITAS UMUM', marginX, y);
      y += 2.5;

      const materiBaris = cleanMeetingTopic(plan.judulPertemuan || identity.materiPokok);

      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        theme: 'plain',
        styles: { font: 'times', fontSize: 10, textColor: [0, 0, 0], cellPadding: 1.2 },
        body: [
          ['Nama Penyusun', `: ${identity.namaPenyusun}`],
          ['NIP Penyusun', `: ${identity.nipPenyusun || '-'}`],
          ['Instansi', `: ${identity.instansi}`],
          ['Tahun Pelajaran', `: ${identity.tahunAjaran}`],
          ['Fase / Kelas', `: ${identity.fase} / Kelas ${identity.kelas} SD`],
          ['Mata Pelajaran', `: ${identity.mapel}`],
          ...(totalMeetings > 1 || plan.kodeTp
            ? [['Pertemuan / Kode TP', `: Pertemuan ke-${meetingNum} (${plan.kodeTp || `TP.${meetingNum}`})`]]
            : []),
          ['Materi Pokok', `: ${materiBaris}`],
          ['Alokasi Waktu', `: ${identity.alokasiWaktu}`],
        ],
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
        },
      });
      y =
        ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          y + 25) + 4;

      // B. KOMPONEN PEMBELAJARAN MENDALAM
      pdf.setFont('times', 'bold');
      pdf.setFontSize(10.5);
      pdf.text('B. KOMPONEN PEMBELAJARAN MENDALAM', marginX, y);
      y += 2.5;

      const tpFormatted = (plan.tujuanPembelajaran || [])
        .map((tp, idx) => `${idx + 1}. ${formatRpmTpLine(tp)}`)
        .join('\n');
      const fallbackCrossDigital = getDefaultRpmCrossAndDigital(
        identity.mapel,
        materiBaris,
        identity.kelas
      );

      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          font: 'times',
          fontSize: 9.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          cellPadding: 2,
        },
        body: [
          ['Capaian Pembelajaran (CP)', plan.capaianPembelajaran || identity.cpText || '-'],
          ['Tujuan Pembelajaran (TP)', tpFormatted || '-'],
          ['Dimensi Profil Lulusan', plan.dimensiProfilLulusan || '-'],
          [
            'Lintas Disiplin Ilmu',
            plan.lintasDisiplinIlmu || fallbackCrossDigital.lintasDisiplinIlmu,
          ],
          [
            'Pemanfaatan Digital',
            plan.pemanfaatanDigital || fallbackCrossDigital.pemanfaatanDigital,
          ],
          ['Pendekatan & Model', plan.pendekatanModel || '-'],
          ['Sarana & Media Belajar', plan.saranaMedia || '-'],
        ],
        columnStyles: {
          0: { cellWidth: 46, fontStyle: 'bold', fillColor: [248, 250, 252] },
        },
      });
      y =
        ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          y + 35) + 5;

      const pageH = getPageH();
      const pageW = getPageW();
      // C. LANGKAH-LANGKAH KEGIATAN PEMBELAJARAN
      if (y + 20 > pageH - 16) {
        pdf.addPage(pageFormat, 'portrait');
        y = 16;
      }
      pdf.setFont('times', 'bold');
      pdf.setFontSize(10.5);
      pdf.text('C. LANGKAH-LANGKAH KEGIATAN PEMBELAJARAN', marginX, y);
      y += 2.5;

      const formatSteps = (steps: string[] = []) =>
        steps.map((s, idx) => (/^\d+\./.test(s.trim()) ? s : `${idx + 1}. ${s}`)).join('\n') || '-';

      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          font: 'times',
          fontSize: 9.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          cellPadding: 2.2,
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
        head: [['Tahap & Waktu', 'Deskripsi Kegiatan Pembelajaran']],
        body: [
          [
            `Kegiatan Awal\n(${plan.kegiatanAwal?.durasi || '10 Menit'})\n${plan.kegiatanAwal?.label || 'Mindful & Joyful'}`,
            formatSteps(plan.kegiatanAwal?.langkah),
          ],
          [
            `Kegiatan Inti\n(${plan.kegiatanInti?.durasi || '50 Menit'})\n${plan.kegiatanInti?.label || 'Meaningful & Deep Learning'}`,
            formatSteps(plan.kegiatanInti?.langkah),
          ],
          [
            `Kegiatan Penutup\n(${plan.kegiatanPenutup?.durasi || '10 Menit'})\n${plan.kegiatanPenutup?.label || 'Refleksi'}`,
            formatSteps(plan.kegiatanPenutup?.langkah),
          ],
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
        },
      });
      y =
        ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          y + 40) + 5;

      // D. ASESMEN & TINDAK LANJUT
      if (y + 28 > pageH - 16) {
        pdf.addPage(pageFormat, 'portrait');
        y = 16;
      }
      pdf.setFont('times', 'bold');
      pdf.setFontSize(10.5);
      pdf.text('D. ASESMEN & TINDAK LANJUT', marginX, y);
      y += 2.5;

      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          font: 'times',
          fontSize: 9.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          cellPadding: 2,
        },
        body: [
          ['Asesmen Awal', plan.asesmenAwal || '-'],
          ['Asesmen Formatif', plan.asesmenFormatif || '-'],
          ['Asesmen Sumatif', plan.asesmenSumatif || '-'],
          [
            'Tindak Lanjut',
            `• Pengayaan: ${plan.tindakLanjutPengayaan || '-'}\n• Remedial: ${plan.tindakLanjutRemedial || '-'}`,
          ],
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold', fillColor: [248, 250, 252] },
        },
      });
      y =
        (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
      drawSignatureBlock(y);

      // LAMPIRAN 1: LKPD
      const lkpd = plan.lkpd;
      pdf.addPage(pageFormat, 'portrait');
      y = 16;
      pdf.setFont('times', 'bold');
      pdf.setFontSize(11.5);
      pdf.text(
        `LAMPIRAN 1: LEMBAR KERJA MURID (LKPD)${totalMeetings > 1 ? ` — PERTEMUAN ${meetingNum}` : ''}`,
        marginX,
        y
      );
      y += 5.5;
      pdf.setFont('times', 'normal');
      pdf.setFontSize(10);
      pdf.text('Nama Kelompok / Siswa : ....................................................', marginX, y);
      y += 4.8;
      pdf.text(`Kelas / Materi         : Kelas ${identity.kelas} / ${materiBaris}`, marginX, y);
      y += 6.5;

      pdf.setFont('times', 'bold');
      pdf.text(lkpd?.judulAktivitas1 || 'Aktivitas 1: Pemahaman Konsep', marginX, y);
      y += 2.5;

      const act1Rows = Array.isArray(lkpd?.aktivitas1Rows) ? lkpd.aktivitas1Rows : [];
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          font: 'times',
          fontSize: 9.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          cellPadding: 2.2,
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
        head: [['No', lkpd?.kolomHeader1 || 'Konsep / Materi', lkpd?.kolomHeader2 || 'Penjelasan']],
        body:
          act1Rows.length > 0
            ? act1Rows.map((r) => [String(r.no), r.item, r.promptIsian])
            : [['1', '-', '........................................................................']],
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 44, fontStyle: 'bold' },
        },
      });
      y =
        ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          y + 30) + 6;

      if (y + 30 > pageH - 16) {
        pdf.addPage(pageFormat, 'portrait');
        y = 16;
      }
      pdf.setFont('times', 'bold');
      pdf.setFontSize(10);
      pdf.text(lkpd?.judulAktivitas2 || 'Aktivitas 2: Analisis Studi Kasus', marginX, y);
      y += 2.5;

      const act2Cases = Array.isArray(lkpd?.aktivitas2Cases) ? lkpd.aktivitas2Cases : [];
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          font: 'times',
          fontSize: 9.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          cellPadding: 2.2,
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
        head: [['Cerita Masalah', 'Hasil Analisis & Solusi Kelompok']],
        body:
          act2Cases.length > 0
            ? act2Cases.map((c) => [
                `${c.judulKasus}:\n${c.ceritaMasalah}`,
                `1. ${c.pertanyaan1}\n    Jawab: ........................................................................\n2. ${c.pertanyaan2}\n    Jawab: ........................................................................`,
              ])
            : [['Belum ada studi kasus.', 'Jawab: ........................................................................']],
        columnStyles: {
          0: { cellWidth: 68 },
        },
      });
      y =
        ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
          y + 30) + 6;

      if (y + 24 > pageH - 16) {
        pdf.addPage(pageFormat, 'portrait');
        y = 16;
      }
      pdf.setFont('times', 'bold');
      pdf.setFontSize(10);
      pdf.text(lkpd?.judulAktivitas3 || 'Aktivitas 3: Komitmen Aksi Nyata Individu', marginX, y);
      y += 4.8;
      pdf.setFont('times', 'normal');
      const act3Lines = pdf.splitTextToSize(
        lkpd?.promptAktivitas3 || 'Satu kebiasaan baik yang akan langsung saya praktikkan hari ini:',
        contentW
      ) as string[];
      pdf.text(act3Lines, marginX, y);
      y += act3Lines.length * 4.5 + 3;
      pdf.line(marginX, y + 3, pageW - marginX, y + 3);
      pdf.line(marginX, y + 9, pageW - marginX, y + 9);
      y += 16;

      // LAMPIRAN 2: RUBRIK PENILAIAN
      if (y + 42 > pageH - 16) {
        pdf.addPage(pageFormat, 'portrait');
        y = 16;
      }
      pdf.setFont('times', 'bold');
      pdf.setFontSize(11);
      pdf.text('LAMPIRAN 2: RUBRIK PENILAIAN DISKUSI & LKPD', marginX, y);
      y += 3;

      const rubrikRows = Array.isArray(plan.rubrikRows) ? plan.rubrikRows : [];
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          font: 'times',
          fontSize: 8.5,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          cellPadding: 1.8,
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
        head: [
          [
            'Aspek Penilaian',
            'Skor 4 (Sangat Baik)',
            'Skor 3 (Baik)',
            'Skor 2 (Cukup)',
            'Skor 1 (Perlu Bimbingan)',
          ],
        ],
        body:
          rubrikRows.length > 0
            ? rubrikRows.map((r) => [r.aspek, r.skor4, r.skor3, r.skor2, r.skor1])
            : [['Pemahaman Konsep', 'Sangat baik', 'Baik', 'Cukup', 'Perlu bimbingan']],
        columnStyles: {
          0: { cellWidth: 34, fontStyle: 'bold' },
        },
      });
    });
  }

  // 6. AGENDA HARIAN
  if (include('agenda')) {
    startSectionPage();
    let y = drawKop(
      'AGENDA HARIAN MENGAJAR GURU',
      `${identity.mapel.toUpperCase()} — KELAS ${identity.kelas} (${identity.semester} ${identity.tahunAjaran})`
    );
    y = drawMetaStrip(y);

    autoTable(pdf, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: {
        font: 'times',
        fontSize: 8.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        cellPadding: 1.8,
      },
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
      head: [
        [
          'Pert.',
          'Hari / Tanggal',
          'Alokasi',
          'Materi Pokok',
          'Ringkasan Kegiatan Inti',
          'Media / LKPD',
          'Catatan / Ketercapaian',
        ],
      ],
      body:
        agendaHarian.length > 0
          ? agendaHarian.map((ag) => [
              String(ag.pertemuanKe),
              ag.hariTanggal,
              ag.jamAlokasi,
              ag.materiPokok,
              ag.kegiatanIntiRingkas,
              ag.mediaLkpd,
              ag.catatanKetercapaian,
            ])
          : [['1', '-', '-', identity.materiPokok, 'Belum ada entri agenda harian.', '-', '-']],
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 22 },
      },
    });
    const finalY =
      (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
    drawSignatureBlock(finalY);
  }

  return pdf;
}

export function downloadRpmPdf(
  docData: RpmSuiteDoc,
  targetKind: RpmDocKind,
  meetingIndex?: number
): void {
  const pdf = buildPdfInstance(docData, targetKind, meetingIndex);
  const fileName = getRpmExportFileName(docData, targetKind, 'pdf', meetingIndex);
  pdf.save(fileName);
}

export function buildRpmPrintHtml(
  docData: RpmSuiteDoc,
  targetKind: RpmDocKind,
  meetingIndex?: number
): string {
  const { identity } = docData;
  const tps = Array.isArray(docData.tps) ? docData.tps : [];
  const atps = Array.isArray(docData.atps) ? docData.atps : [];
  const protas = Array.isArray(docData.protas) ? docData.protas : [];
  const prosems = Array.isArray(docData.prosems) ? docData.prosems : [];
  const agendaHarian = Array.isArray(docData.agendaHarian) ? docData.agendaHarian : [];
  const rpmPlans = getRpmPlans(docData, meetingIndex);

  const pageSizeCss = identity.paperSize === 'F4' ? '215mm 330mm' : '210mm 297mm';
  const months = getProsemMonths(identity.semester);

  const include = (k: 'tp-atp' | 'prota' | 'prosem' | 'rpm' | 'agenda') =>
    targetKind === 'suite' ||
    targetKind === k ||
    (k === 'tp-atp' && (targetKind === 'tp' || targetKind === 'atp'));

  const kopHtml = (sub: string, extra?: string) =>
    buildHtmlKop(sub, extra, undefined, identity.instansi);

  const metaStrip = `
    <p class="meta-strip">
      <strong>Mata Pelajaran:</strong> ${escapeHtml(identity.mapel)} &nbsp;|&nbsp;
      <strong>Kelas / Fase:</strong> ${identity.kelas} / ${escapeHtml(identity.fase)} &nbsp;|&nbsp;
      <strong>Semester:</strong> ${escapeHtml(identity.semester)} (${escapeHtml(identity.tahunAjaran)})
    </p>
  `;

  const signatureHtml = `
    <table class="sig-table">
      <tr>
        <td width="50%">
          Mengetahui,<br/>
          Kepala Sekolah<br/><br/><br/><br/>
          <strong>${escapeHtml(identity.kepalaSekolah || '(..........................................)')}</strong><br/>
          NIP. ${escapeHtml(identity.nipKepalaSekolah || '....................................')}
        </td>
        <td width="50%">
          ${escapeHtml(identity.kotaTanggal || 'Lendang Telaga, ........................ 2026')}<br/>
          Guru ${escapeHtml(identity.mapel)}<br/><br/><br/><br/>
          <strong>${escapeHtml(identity.namaPenyusun || '(..........................................)')}</strong><br/>
          NIP. ${escapeHtml(identity.nipPenyusun || '....................................')}
        </td>
      </tr>
    </table>
  `;

  const sections: string[] = [];

  if (include('tp-atp')) {
    const pairedRows = buildPairedTpAtpRows(docData);
    sections.push(`
      <section>
        ${kopHtml('TUJUAN PEMBELAJARAN (TP) & ALUR TUJUAN PEMBELAJARAN (ATP)', `${identity.mapel.toUpperCase()} — KELAS ${identity.kelas} (${identity.fase})`)}
        ${metaStrip}
        <div class="cp-box"><strong>Capaian Pembelajaran (CP):</strong><br/>${escapeHtml(identity.cpText)}</div>
        <table>
          <thead>
            <tr>
              <th width="28">No</th>
              <th width="54">Kode</th>
              <th width="110">Materi Pokok</th>
              <th>Tujuan Pembelajaran (TP)</th>
              <th>Alur Tujuan Pembelajaran (ATP) &amp; Indikator</th>
              <th width="34">JP</th>
            </tr>
          </thead>
          <tbody>
            ${
              pairedRows.length > 0
                ? pairedRows
                    .map(
                      (r) => `<tr>
                        <td class="center">${r.no}</td>
                        <td class="center"><strong>${escapeHtml(r.kode)}</strong></td>
                        <td>${escapeHtml(r.materiPokok)}</td>
                        <td>${escapeHtml(r.tpText).replace(/\n/g, '<br/>')}</td>
                        <td>${escapeHtml(r.atpText).replace(/\n/g, '<br/>')}</td>
                        <td class="center">${r.jp}</td>
                      </tr>`
                    )
                    .join('')
                : '<tr><td colspan="6" class="center">Belum ada data TP &amp; ATP.</td></tr>'
            }
          </tbody>
        </table>
        ${signatureHtml}
      </section>
    `);
  }

  if (include('prota')) {
    const totalJp = protas.reduce((acc, p) => acc + (p.alokasiJp || 0), 0);
    sections.push(`
      <section class="${sections.length > 0 ? 'page-break' : ''}">
        ${kopHtml('PROGRAM TAHUNAN (PROTA)', `TAHUN PELAJARAN ${identity.tahunAjaran}`)}
        ${metaStrip}
        <table>
          <thead>
            <tr>
              <th width="36">No</th>
              <th width="80">Semester</th>
              <th>Materi Pokok / Unit Pembelajaran</th>
              <th width="90">Alokasi Waktu</th>
              <th>Bulan / Keterangan</th>
            </tr>
          </thead>
          <tbody>
            ${protas
              .map(
                (p) => `<tr>
                  <td class="center">${p.no}</td>
                  <td class="center">${escapeHtml(p.semester)}</td>
                  <td>${escapeHtml(p.materiPokok)}</td>
                  <td class="center"><strong>${p.alokasiJp} JP</strong></td>
                  <td>${escapeHtml(p.bulanKeterangan)}</td>
                </tr>`
              )
              .join('')}
            <tr>
              <td colspan="3" style="text-align:right"><strong>Total Alokasi Waktu Tahunan</strong></td>
              <td class="center"><strong>${totalJp} JP</strong></td>
              <td></td>
            </tr>
          </tbody>
        </table>
        ${signatureHtml}
      </section>
    `);
  }

  if (include('prosem')) {
    sections.push(`
      <section class="prosem-landscape-section ${sections.length > 0 ? 'page-break' : ''}">
        ${kopHtml(`PROGRAM SEMESTER (PROSEM) — SEMESTER ${identity.semester.toUpperCase()}`, `TAHUN PELAJARAN ${identity.tahunAjaran}`)}
        ${metaStrip}
        <table class="prosem-table">
          <thead>
            <tr>
              <th rowspan="2" width="24">No</th>
              <th rowspan="2" width="46">Kode TP</th>
              <th rowspan="2">Materi Pokok</th>
              <th rowspan="2" width="26">JP</th>
              ${months.map((m) => `<th colspan="5" class="center">${m}</th>`).join('')}
            </tr>
            <tr>
              ${months.map(() => '<th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>').join('')}
            </tr>
          </thead>
          <tbody>
            ${prosems
              .map((r) => {
                const marks = Array.isArray(r.bulanMinggu) ? r.bulanMinggu : [];
                return `<tr>
                  <td class="center">${r.no}</td>
                  <td class="center"><strong>${escapeHtml(r.kodeTp)}</strong></td>
                  <td>${escapeHtml(r.materiPokok)}</td>
                  <td class="center">${r.alokasiJp}</td>
                  ${months
                    .flatMap((m) =>
                      [1, 2, 3, 4, 5].map((w) =>
                        marks.includes(`${m}-M${w}`)
                          ? '<td class="center"><strong>&check;</strong></td>'
                          : '<td></td>'
                      )
                    )
                    .join('')}
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
        ${signatureHtml}
      </section>
    `);
  }

  if (include('rpm')) {
    const formatList = (items: string[] = []) =>
      items
        .map((s, idx) => {
          const line = /^\d+\./.test(s.trim()) ? s : `${idx + 1}. ${s}`;
          return `<div>${escapeHtml(line)}</div>`;
        })
        .join('');

    const totalMeetings = rpmPlans.length;
    rpmPlans.forEach((plan, pIdx) => {
      const meetingNum = plan.pertemuanKe ?? pIdx + 1;
      const materiBaris = cleanMeetingTopic(plan.judulPertemuan || identity.materiPokok);
      const meetingExtra =
        totalMeetings > 1 || plan.kodeTp
          ? `${identity.mapel.toUpperCase()} — PERTEMUAN KE-${meetingNum}${
              plan.kodeTp ? ` (${plan.kodeTp})` : ''
            }`
          : identity.mapel.toUpperCase();

      sections.push(`
        <section class="${sections.length > 0 ? 'page-break' : ''}">
          ${kopHtml('RENCANA PEMBELAJARAN MENDALAM (RPM)', meetingExtra)}

          <div class="sec-heading">A. IDENTITAS UMUM</div>
          <table class="plain-table">
            <tr><td width="155">Nama Penyusun</td><td>: ${escapeHtml(identity.namaPenyusun)}</td></tr>
            <tr><td>NIP Penyusun</td><td>: ${escapeHtml(identity.nipPenyusun || '-')}</td></tr>
            <tr><td>Instansi</td><td>: ${escapeHtml(identity.instansi)}</td></tr>
            <tr><td>Tahun Pelajaran</td><td>: ${escapeHtml(identity.tahunAjaran)}</td></tr>
            <tr><td>Fase / Kelas</td><td>: ${escapeHtml(identity.fase)} / Kelas ${identity.kelas} SD</td></tr>
            <tr><td>Mata Pelajaran</td><td>: ${escapeHtml(identity.mapel)}</td></tr>
            ${
              totalMeetings > 1 || plan.kodeTp
                ? `<tr><td>Pertemuan / Kode TP</td><td>: Pertemuan ke-${meetingNum} (${escapeHtml(plan.kodeTp || `TP.${meetingNum}`)})</td></tr>`
                : ''
            }
            <tr><td>Materi Pokok</td><td>: ${escapeHtml(materiBaris)}</td></tr>
            <tr><td>Alokasi Waktu</td><td>: ${escapeHtml(identity.alokasiWaktu)}</td></tr>
          </table>

          <div class="sec-heading">B. KOMPONEN PEMBELAJARAN MENDALAM</div>
          <table>
            <tr><th width="165">Capaian Pembelajaran (CP)</th><td>${escapeHtml(plan.capaianPembelajaran || identity.cpText)}</td></tr>
            <tr><th>Tujuan Pembelajaran (TP)</th><td>${(plan.tujuanPembelajaran || []).map((tp, i) => `<div>${i + 1}. ${escapeHtml(formatRpmTpLine(tp))}</div>`).join('')}</td></tr>
            <tr><th>Dimensi Profil Lulusan</th><td>${escapeHtml(plan.dimensiProfilLulusan)}</td></tr>
            <tr><th>Lintas Disiplin Ilmu</th><td>${escapeHtml(plan.lintasDisiplinIlmu || getDefaultRpmCrossAndDigital(identity.mapel, materiBaris, identity.kelas).lintasDisiplinIlmu)}</td></tr>
            <tr><th>Pemanfaatan Digital</th><td>${escapeHtml(plan.pemanfaatanDigital || getDefaultRpmCrossAndDigital(identity.mapel, materiBaris, identity.kelas).pemanfaatanDigital)}</td></tr>
            <tr><th>Pendekatan &amp; Model</th><td>${escapeHtml(plan.pendekatanModel)}</td></tr>
            <tr><th>Sarana &amp; Media Belajar</th><td>${escapeHtml(plan.saranaMedia)}</td></tr>
          </table>

          <div class="sec-heading">C. LANGKAH-LANGKAH KEGIATAN PEMBELAJARAN</div>
          <table>
            <thead>
              <tr><th width="145">Tahap &amp; Waktu</th><th>Deskripsi Kegiatan Pembelajaran</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Kegiatan Awal</strong><br/>(${escapeHtml(plan.kegiatanAwal?.durasi || '10 Menit')})<br/><em>${escapeHtml(plan.kegiatanAwal?.label || 'Mindful & Joyful')}</em></td>
                <td>${formatList(plan.kegiatanAwal?.langkah)}</td>
              </tr>
              <tr>
                <td><strong>Kegiatan Inti</strong><br/>(${escapeHtml(plan.kegiatanInti?.durasi || '50 Menit')})<br/><em>${escapeHtml(plan.kegiatanInti?.label || 'Meaningful & Deep Learning')}</em></td>
                <td>${formatList(plan.kegiatanInti?.langkah)}</td>
              </tr>
              <tr>
                <td><strong>Kegiatan Penutup</strong><br/>(${escapeHtml(plan.kegiatanPenutup?.durasi || '10 Menit')})<br/><em>${escapeHtml(plan.kegiatanPenutup?.label || 'Refleksi')}</em></td>
                <td>${formatList(plan.kegiatanPenutup?.langkah)}</td>
              </tr>
            </tbody>
          </table>

          <div class="sec-heading">D. ASESMEN &amp; TINDAK LANJUT</div>
          <table>
            <tr><th width="145">Asesmen Awal</th><td>${escapeHtml(plan.asesmenAwal)}</td></tr>
            <tr><th>Asesmen Formatif</th><td>${escapeHtml(plan.asesmenFormatif)}</td></tr>
            <tr><th>Asesmen Sumatif</th><td>${escapeHtml(plan.asesmenSumatif).replace(/\n/g, '<br/>')}</td></tr>
            <tr><th>Tindak Lanjut</th><td><div>&bull; <strong>Pengayaan:</strong> ${escapeHtml(plan.tindakLanjutPengayaan)}</div><div>&bull; <strong>Remedial:</strong> ${escapeHtml(plan.tindakLanjutRemedial)}</div></td></tr>
          </table>

          ${signatureHtml}

          <div class="page-break"></div>
          <div class="sec-heading" style="font-size:11.5pt;margin-top:0;">LAMPIRAN 1: LEMBAR KERJA MURID (LKPD)${totalMeetings > 1 ? ` — PERTEMUAN ${meetingNum}` : ''}</div>
          <div style="margin-bottom:8px;">
            <div>Nama Kelompok / Siswa : ....................................................</div>
            <div>Kelas / Materi &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: Kelas ${identity.kelas} / ${escapeHtml(materiBaris)}</div>
          </div>

          <p><strong>${escapeHtml(plan.lkpd?.judulAktivitas1)}</strong></p>
          <table>
            <thead>
              <tr><th width="34">No</th><th width="140">${escapeHtml(plan.lkpd?.kolomHeader1)}</th><th>${escapeHtml(plan.lkpd?.kolomHeader2)}</th></tr>
            </thead>
            <tbody>
              ${(plan.lkpd?.aktivitas1Rows || [])
                .map(
                  (r) => `<tr>
                    <td class="center">${r.no}</td>
                    <td><strong>${escapeHtml(r.item)}</strong></td>
                    <td>${escapeHtml(r.promptIsian)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>

          <p style="margin-top:12px;"><strong>${escapeHtml(plan.lkpd?.judulAktivitas2)}</strong></p>
          <table>
            <thead>
              <tr><th width="42%">Cerita Masalah</th><th>Hasil Analisis &amp; Solusi Kelompok</th></tr>
            </thead>
            <tbody>
              ${(plan.lkpd?.aktivitas2Cases || [])
                .map(
                  (c) => `<tr>
                    <td><strong>${escapeHtml(c.judulKasus)}:</strong><br/>${escapeHtml(c.ceritaMasalah)}</td>
                    <td>
                      1. ${escapeHtml(c.pertanyaan1)}<br/>&nbsp;&nbsp;&nbsp;Jawab: ........................................................................<br/>
                      2. ${escapeHtml(c.pertanyaan2)}<br/>&nbsp;&nbsp;&nbsp;Jawab: ........................................................................
                    </td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>

          <p style="margin-top:12px;"><strong>${escapeHtml(plan.lkpd?.judulAktivitas3)}</strong></p>
          <div>${escapeHtml(plan.lkpd?.promptAktivitas3)}</div>
          <div class="dotted-line"></div>
          <div class="dotted-line"></div>

          <div class="sec-heading" style="font-size:11.5pt;margin-top:18px;">LAMPIRAN 2: RUBRIK PENILAIAN DISKUSI &amp; LKPD</div>
          <table>
            <thead>
              <tr>
                <th>Aspek Penilaian</th>
                <th>Skor 4 (Sangat Baik)</th>
                <th>Skor 3 (Baik)</th>
                <th>Skor 2 (Cukup)</th>
                <th>Skor 1 (Perlu Bimbingan)</th>
              </tr>
            </thead>
            <tbody>
              ${(plan.rubrikRows || [])
                .map(
                  (rb) => `<tr>
                    <td><strong>${escapeHtml(rb.aspek)}</strong></td>
                    <td>${escapeHtml(rb.skor4)}</td>
                    <td>${escapeHtml(rb.skor3)}</td>
                    <td>${escapeHtml(rb.skor2)}</td>
                    <td>${escapeHtml(rb.skor1)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </section>
      `);
    });
  }

  if (include('agenda')) {
    sections.push(`
      <section class="${sections.length > 0 ? 'page-break' : ''}">
        ${kopHtml('AGENDA HARIAN MENGAJAR GURU', `${identity.mapel.toUpperCase()} — KELAS ${identity.kelas} (${identity.semester} ${identity.tahunAjaran})`)}
        ${metaStrip}
        <table>
          <thead>
            <tr>
              <th width="36">Pert.</th>
              <th width="95">Hari / Tanggal</th>
              <th width="85">Alokasi</th>
              <th width="120">Materi Pokok</th>
              <th>Ringkasan Kegiatan Inti</th>
              <th width="110">Media / LKPD</th>
              <th width="110">Catatan / Ketercapaian</th>
            </tr>
          </thead>
          <tbody>
            ${agendaHarian
              .map(
                (ag) => `<tr>
                  <td class="center">${ag.pertemuanKe}</td>
                  <td>${escapeHtml(ag.hariTanggal)}</td>
                  <td>${escapeHtml(ag.jamAlokasi)}</td>
                  <td>${escapeHtml(ag.materiPokok)}</td>
                  <td>${escapeHtml(ag.kegiatanIntiRingkas)}</td>
                  <td>${escapeHtml(ag.mediaLkpd)}</td>
                  <td>${escapeHtml(ag.catatanKetercapaian)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
        ${signatureHtml}
      </section>
    `);
  }

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docData.title)} - ${escapeHtml(getDocKindLabel(targetKind))}</title>
  <style>
    @page { size: ${pageSizeCss}${targetKind === 'prosem' ? ' landscape; mso-page-orientation: landscape' : ''}; margin: ${targetKind === 'prosem' ? '12mm 14mm' : '14mm 15mm'}; }
    @page prosemPage { size: ${pageSizeCss} landscape; mso-page-orientation: landscape; margin: 12mm 14mm; }
    .prosem-landscape-section { page: prosemPage; }
    body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; line-height: 1.42; }
    .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
    .kop-top { font-weight: bold; font-size: 10.5pt; }
    .kop-school { font-weight: bold; font-size: 14pt; margin-top: 2px; }
    .kop-addr { font-size: 9pt; margin-top: 2px; }
    .kop-sub { font-weight: bold; font-size: 11.5pt; text-decoration: underline; margin-top: 8px; }
    .kop-extra { font-weight: bold; font-size: 10.5pt; margin-top: 2px; }
    .meta-strip { margin: 0 0 8px 0; font-size: 10pt; }
    .cp-box { border: 1px solid #000; padding: 6px 8px; margin-bottom: 10px; background: #f8fafc; font-size: 10pt; }
    .sec-heading { font-weight: bold; font-size: 10.5pt; margin: 12px 0 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 9.5pt; }
    th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: bold; }
    table.prosem-table { font-size: 8.5pt; }
    table.prosem-table th, table.prosem-table td { padding: 3px 2.5px; }
    .plain-table, .plain-table td { border: none !important; padding: 2px 4px; font-size: 10pt; }
    .sig-table, .sig-table td { border: none !important; margin-top: 20px; font-size: 10pt; page-break-inside: avoid; }
    .center { text-align: center; }
    .dotted-line { border-bottom: 1px dotted #444; height: 18px; margin-top: 4px; }
    .page-break { page-break-before: always; break-before: page; }
  </style>
</head>
<body>
  ${sections.join('\n')}
</body>
</html>`;
}

export function downloadRpmWord(
  docData: RpmSuiteDoc,
  targetKind: RpmDocKind,
  meetingIndex?: number
): void {
  const html = buildRpmPrintHtml(docData, targetKind, meetingIndex);
  const blob = new Blob([`\uFEFF${html}`], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getRpmExportFileName(docData, targetKind, 'doc', meetingIndex);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printRpmWithIframe(
  docData: RpmSuiteDoc,
  targetKind: RpmDocKind,
  meetingIndex?: number
): void {
  const html = buildRpmPrintHtml(docData, targetKind, meetingIndex);
  const existing = document.getElementById('sdn-lt-rpm-print-frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'sdn-lt-rpm-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc || !iframe.contentWindow) {
    window.print();
    return;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.print();
    }
  }, 250);
}

export async function downloadAllRpmSeparateZip(
  docData: RpmSuiteDoc,
  format: 'word' | 'pdf' | 'both' = 'both'
): Promise<void> {
  const zip = new JSZip();
  const kinds: Array<'tp-atp' | 'prota' | 'prosem' | 'rpm' | 'agenda'> = [
    'tp-atp',
    'prota',
    'prosem',
    'rpm',
    'agenda',
  ];
  const baseTag = `${sanitizeFilename(docData.identity.mapel)}_Kls${docData.identity.kelas}_${docData.identity.paperSize}`;

  for (const kind of kinds) {
    const prefix = getFilePrefix(kind);
    if (format === 'word' || format === 'both') {
      const html = buildRpmPrintHtml(docData, kind);
      zip.file(`Word/${prefix}_${baseTag}.doc`, `\uFEFF${html}`);
    }
    if (format === 'pdf' || format === 'both') {
      const pdf = buildPdfInstance(docData, kind);
      const buffer = pdf.output('arraybuffer');
      zip.file(`PDF/${prefix}_${baseTag}.pdf`, buffer);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Perangkat_RPM_Word_PDF_${baseTag}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
