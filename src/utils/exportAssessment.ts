import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AssessmentDoc, AssessmentQuestion, QuestionType, SchoolTeacherSettings } from '../types/portal';
import { getPdfImageFormat } from './imageUtils';
import { buildHtmlKop, drawPdfKop, getEffectiveKop } from './schoolKop';

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function buildMatchingPool(questions: AssessmentQuestion[]) {
  const items = questions.filter((q) => q.bentuk === 'menjodohkan');
  if (items.length === 0) return [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const sorted = [...items]
    .map((q, idx) => ({ q, sortKey: (idx * 7 + 3) % Math.max(1, items.length) }))
    .sort((a, b) => a.sortKey - b.sortKey);
  return sorted.map((entry, idx) => ({
    code: letters[idx] || String(idx + 1),
    answerText: entry.q.kunciJawaban,
    questionNomor: entry.q.nomor,
  }));
}

function stripExamTag(raw: string): string {
  return String(raw || '')
    .replace(/^\s*(?:[\[(]\s*(?:STS|SAS)\s*(?:No\.?)?\s*\d+\s*[\])]\s*)+/gi, '')
    .trim();
}

function getRomanParts(questions: AssessmentQuestion[], kelas: number) {
  const isLowerGrade = kelas <= 3;
  const byType: Record<QuestionType, AssessmentQuestion[]> = {
    pg: [],
    isian: [],
    menjodohkan: [],
    uraian: [],
  };
  for (const q of questions) {
    byType[q.bentuk]?.push(q);
  }
  const order: { type: QuestionType; title: string; instruction: string }[] = [
    {
      type: 'pg',
      title: 'Pilihan Ganda',
      instruction: isLowerGrade
        ? 'Berilah tanda silang (X) pada huruf A, B, atau C di depan jawaban yang paling tepat!'
        : 'Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!',
    },
    {
      type: 'isian',
      title: 'Isian Singkat',
      instruction: 'Isilah titik-titik di bawah ini dengan jawaban yang singkat dan benar!',
    },
    {
      type: 'menjodohkan',
      title: 'Menjodohkan',
      instruction: 'Pasangkan pernyataan pada Kolom A dengan jawaban yang tepat pada Kolom B!',
    },
    {
      type: 'uraian',
      title: 'Uraian',
      instruction: 'Jawablah pertanyaan di bawah ini dengan jelas dan lengkap!',
    },
  ];
  const numerals = ['I', 'II', 'III', 'IV'];
  let rIdx = 0;
  return order
    .filter((o) => byType[o.type].length > 0)
    .map((o) => ({
      ...o,
      roman: numerals[rIdx++] || String(rIdx),
      items: byType[o.type],
    }));
}

function formatBentukLabel(bentuk: QuestionType): string {
  switch (bentuk) {
    case 'pg':
      return 'Pilihan Ganda';
    case 'isian':
      return 'Isian Singkat';
    case 'menjodohkan':
      return 'Menjodohkan';
    default:
      return 'Uraian';
  }
}

export function downloadAssessmentPDF(
  docData: AssessmentDoc,
  students: string[],
  schoolSettings?: SchoolTeacherSettings
): void {
  const { identity, kisiRows, questions } = docData;
  const kop = getEffectiveKop(schoolSettings);
  const pageFormat: [number, number] =
    identity.paperSize === 'F4' ? [215, 330] : [210, 297];

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageFormat,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 15;
  const contentW = pageW - marginX * 2;
  const examFullLabel =
    identity.examType === 'STS'
      ? 'SUMATIF TENGAH SEMESTER (STS)'
      : 'SUMATIF AKHIR SEMESTER (SAS)';

  const drawKop = (subJudul: string): number =>
    drawPdfKop(pdf, {
      marginX,
      pageW,
      subJudul,
      schoolSettings,
    });

  const ensureSpace = (y: number, needed: number): number => {
    if (y + needed > pageH - 16) {
      pdf.addPage(pageFormat, 'portrait');
      return 16;
    }
    return y;
  };

  // --- HALAMAN 0: KISI-KISI SOAL (dengan No. Soal Disajikan) ---
  let y = 14;
  if (kisiRows.length > 0) {
    y = drawKop(`KISI-KISI SOAL ${examFullLabel}`);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(10);
    pdf.text(
      `Mata Pelajaran: ${identity.mapel}   |   Kelas / Fase: ${identity.kelas} / ${identity.fase}   |   Semester: ${identity.semester} (${identity.tahunAjaran})`,
      marginX,
      y
    );
    y += 4;

    autoTable(pdf, {
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: {
        font: 'times',
        fontSize: 9,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        cellPadding: 1.8,
      },
      headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
      head: [
        ['No', 'TP', 'Materi Pokok', 'Indikator Soal', 'Level', 'Kesulitan', 'Bentuk', 'No. Soal Disajikan'],
      ],
      body: kisiRows.map((row, idx) => [
        String(idx + 1),
        `TP ${row.tpIndex}`,
        row.materiPokok,
        row.indikatorSoal,
        row.levelKognitif,
        row.kesulitan,
        formatBentukLabel(row.bentukSoal),
        `Soal No. ${row.noSoal}`,
      ]),
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 17, halign: 'center' },
        7: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      },
    });
    pdf.addPage(pageFormat, 'portrait');
  }

  // --- HALAMAN NASKAH SOAL (TANPA NAMA GURU) ---
  y = drawKop(`NASKAH SOAL ${examFullLabel}`);

  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.rect(marginX, y, contentW, 18);
  pdf.setFontSize(10);
  pdf.setFont('times', 'normal');
  const col2X = marginX + contentW / 2 + 4;
  pdf.text(`Mata Pelajaran : ${identity.mapel}`, marginX + 3, y + 5.5);
  pdf.text(`Nama Siswa    : ........................................`, col2X, y + 5.5);
  pdf.text(`Kelas / Fase     : ${identity.kelas} / ${identity.fase}`, marginX + 3, y + 10.5);
  pdf.text(`No. Absen     : ........................................`, col2X, y + 10.5);
  pdf.text(
    `Semester          : ${identity.semester} (${identity.tahunAjaran})`,
    marginX + 3,
    y + 15.5
  );
  pdf.text(`Hari / Tanggal : ........................................`, col2X, y + 15.5);
  y += 24;

  const isLowerGrade = identity.kelas <= 3;
  const matchingPool = buildMatchingPool(questions);
  const romanParts = getRomanParts(questions, identity.kelas);

  for (const part of romanParts) {
    y = ensureSpace(y, 14);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    pdf.text(`${part.roman}. ${part.title}`, marginX, y);
    y += 4.8;
    pdf.setFont('times', 'italic');
    pdf.setFontSize(10);
    const instrLines = pdf.splitTextToSize(part.instruction, contentW) as string[];
    pdf.text(instrLines, marginX, y);
    y += instrLines.length * 4.5 + 2;

    if (part.type === 'menjodohkan') {
      autoTable(pdf, {
        startY: y,
        margin: { left: marginX, right: marginX },
        styles: {
          font: 'times',
          fontSize: 10,
          textColor: [0, 0, 0],
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          cellPadding: 2,
        },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
        head: [['No', 'Kolom A (Pernyataan)', 'Jawab', 'Kolom B (Pilihan Pasangan)']],
        body: part.items.map((q, idx) => {
          const opt = matchingPool[idx];
          return [
            `${q.nomor}.`,
            stripExamTag(q.pertanyaan),
            '( ...... )',
            opt ? `${opt.code}. ${opt.answerText}` : '',
          ];
        }),
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { cellWidth: 18, halign: 'center' },
        },
      });
      const lastTable = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      y = (lastTable?.finalY ?? y) + 6;
    } else {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(10.5);
      for (const q of part.items) {
        const qLines = pdf.splitTextToSize(`${q.nomor}. ${stripExamTag(q.pertanyaan)}`, contentW - 4) as string[];
        const imgExtra = q.imageDataUrl ? 40 : 0;
        const neededH =
          qLines.length * 4.8 + imgExtra + (q.bentuk === 'pg' ? 12 : q.bentuk === 'uraian' ? 12 : 4);
        y = ensureSpace(y, neededH);
        pdf.text(qLines, marginX, y);
        y += qLines.length * 4.8;

        if (q.imageDataUrl) {
          y = ensureSpace(y, 40);
          try {
            pdf.addImage(
              q.imageDataUrl,
              getPdfImageFormat(q.imageDataUrl),
              marginX + 6,
              y + 1,
              54,
              35
            );
            y += 38;
          } catch {
            // ignore unsupported image
          }
        }

        if (q.bentuk === 'pg' && q.opsi) {
          const halfW = (contentW - 10) / 2;
          const optA = pdf.splitTextToSize(`A. ${q.opsi.A}`, halfW) as string[];
          const optB = pdf.splitTextToSize(`B. ${q.opsi.B}`, halfW) as string[];
          const optC = pdf.splitTextToSize(`C. ${q.opsi.C}`, halfW) as string[];
          const hasD = !isLowerGrade && Boolean(q.opsi.D);
          const optD = hasD ? (pdf.splitTextToSize(`D. ${q.opsi.D || ''}`, halfW) as string[]) : [];

          const row1Lines = Math.max(optA.length, optB.length);
          y = ensureSpace(y, row1Lines * 4.6 + 2);
          pdf.text(optA, marginX + 6, y);
          pdf.text(optB, marginX + 8 + halfW, y);
          y += row1Lines * 4.6;

          const row2Lines = hasD ? Math.max(optC.length, optD.length) : optC.length;
          y = ensureSpace(y, row2Lines * 4.6 + 3);
          pdf.text(optC, marginX + 6, y);
          if (hasD) {
            pdf.text(optD, marginX + 8 + halfW, y);
          }
          y += row2Lines * 4.6 + 2.5;
        } else if (q.bentuk === 'uraian') {
          y += 2;
          pdf.setDrawColor(140);
          pdf.line(marginX + 6, y + 3, pageW - marginX, y + 3);
          pdf.line(marginX + 6, y + 9, pageW - marginX, y + 9);
          pdf.setDrawColor(0);
          y += 13;
        } else {
          y += 2.5;
        }
      }
      y += 2;
    }
  }

  // --- LAMPIRAN 1: KUNCI JAWABAN ---
  pdf.addPage(pageFormat, 'portrait');
  y = drawKop(`LAMPIRAN 1: KUNCI JAWABAN ${examFullLabel}`);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);
  pdf.text(
    `Mata Pelajaran: ${identity.mapel}   |   Kelas / Fase: ${identity.kelas} / ${identity.fase}   |   Semester: ${identity.semester} (${identity.tahunAjaran})`,
    marginX,
    y
  );
  y += 4;

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
    head: [['No', 'Bentuk Soal', 'TP', 'Kunci Jawaban']],
    body: questions.map((q) => {
      const matchedCode =
        q.bentuk === 'menjodohkan'
          ? matchingPool.find((m) => m.questionNomor === q.nomor)?.code
          : undefined;
      return [
        String(q.nomor),
        formatBentukLabel(q.bentuk),
        `TP ${q.tpIndex}`,
        matchedCode ? `${matchedCode}. ${q.kunciJawaban}` : q.kunciJawaban,
      ];
    }),
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 18, halign: 'center' },
    },
  });

  // --- LAMPIRAN 2: RUBRIK PENSKORAN ---
  const maxTotalScore = questions.reduce((acc, q) => acc + (q.skorMaks || 1), 0);
  pdf.addPage(pageFormat, 'portrait');
  y = drawKop('LAMPIRAN 2: RUBRIK PENSKORAN & FORMAT PEMERIKSAAN');
  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);
  pdf.text(
    `Mata Pelajaran: ${identity.mapel}   |   Kelas / Fase: ${identity.kelas} / ${identity.fase}   |   Skor Maksimal: ${maxTotalScore}`,
    marginX,
    y
  );
  y += 5;
  pdf.setFont('times', 'bold');
  pdf.text(`Rumus Nilai Akhir = (Jumlah Skor Diperoleh / ${maxTotalScore}) x 100`, marginX, y);
  y += 4;

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
    head: [['No', 'Bentuk', 'Level', 'Kriteria Pemeriksaan / Rubrik Skor', 'Skor Maks']],
    body: [
      ...questions.map((q) => [
        String(q.nomor),
        q.bentuk.toUpperCase(),
        q.kesulitan,
        q.rubrikSkor,
        String(q.skorMaks),
      ]),
      ['', '', '', 'Total Skor Maksimal', String(maxTotalScore)],
    ],
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 26 },
      2: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
    },
  });

  // --- LAMPIRAN 3: DAFTAR NILAI SISWA ---
  pdf.addPage(pageFormat, 'portrait');
  y = drawKop(`LAMPIRAN 3: FORMAT DAFTAR NILAI SISWA ${identity.examType}`);
  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);
  pdf.text(
    `Mata Pelajaran: ${identity.mapel}   |   Kelas / Fase: ${identity.kelas} / ${identity.fase}   |   Semester: ${identity.semester} (${identity.tahunAjaran})`,
    marginX,
    y
  );
  y += 4;

  const rosterRows = students.length > 0 ? students : ['(Belum ada siswa terdaftar)'];
  const qHeaders = questions.map((q) => String(q.nomor));
  const headRow = ['No', 'Nama Siswa', ...qHeaders, 'Jml', 'Nilai'];

  autoTable(pdf, {
    startY: y,
    margin: { left: marginX, right: marginX },
    styles: {
      font: 'times',
      fontSize: questions.length > 18 ? 7 : 8.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      cellPadding: 1.4,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    head: [headRow],
    body: rosterRows.map((name, idx) => [
      String(idx + 1),
      name,
      ...questions.map(() => ''),
      '',
      '',
    ]),
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42 },
    },
  });

  if (identity.kepalaSekolah || identity.namaPenyusun || identity.nipPenyusun) {
    const finalY = ((pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y) + 10;
    const sigY = finalY > pageH - 40 ? (pdf.addPage(pageFormat, 'portrait'), 24) : finalY;
    const leftX = marginX + contentW * 0.23;
    const rightX = marginX + contentW * 0.77;
    pdf.setFont('times', 'normal');
    pdf.setFontSize(9.5);
    pdf.text('Mengetahui,', leftX, sigY, { align: 'center' });
    pdf.text(`Kepala ${kop.namaSekolah}`, leftX, sigY + 4.5, { align: 'center' });
    pdf.text('Lendang Telaga, ...................', rightX, sigY, { align: 'center' });
    pdf.text('Guru Mata Pelajaran / Kelas', rightX, sigY + 4.5, { align: 'center' });
    pdf.setFont('times', 'bold');
    pdf.text(identity.kepalaSekolah || '....................................', leftX, sigY + 21, { align: 'center' });
    pdf.text(identity.namaPenyusun || docData.teacherName, rightX, sigY + 21, { align: 'center' });
    pdf.setFont('times', 'normal');
    pdf.text(`NIP. ${identity.nipKepalaSekolah || '-'}`, leftX, sigY + 25.5, { align: 'center' });
    pdf.text(`NIP. ${identity.nipPenyusun || '-'}`, rightX, sigY + 25.5, { align: 'center' });
  }

  const fileName = `${sanitizeFilename(docData.title)}_${identity.paperSize}.pdf`;
  pdf.save(fileName);
}

export function buildStandalonePrintHtml(
  docData: AssessmentDoc,
  students: string[],
  schoolSettings?: SchoolTeacherSettings
): string {
  const { identity, kisiRows, questions } = docData;
  const kop = getEffectiveKop(schoolSettings);
  const pageSizeCss = identity.paperSize === 'F4' ? '215mm 330mm' : '210mm 297mm';
  const examFullLabel =
    identity.examType === 'STS'
      ? 'SUMATIF TENGAH SEMESTER (STS)'
      : 'SUMATIF AKHIR SEMESTER (SAS)';
  const isLowerGrade = identity.kelas <= 3;
  const matchingPool = buildMatchingPool(questions);
  const romanParts = getRomanParts(questions, identity.kelas);
  const maxTotalScore = questions.reduce((acc, q) => acc + (q.skorMaks || 1), 0);
  const rosterRows = students.length > 0 ? students : ['(Belum ada siswa terdaftar)'];

  const kopHtml = (subJudul: string) => buildHtmlKop(subJudul, undefined, schoolSettings);

  const kisiHtml =
    kisiRows.length > 0
      ? `<section>
      ${kopHtml(`KISI-KISI SOAL ${examFullLabel}`)}
      <p><strong>Mata Pelajaran:</strong> ${identity.mapel} &nbsp;|&nbsp; <strong>Kelas / Fase:</strong> ${identity.kelas} / ${identity.fase} &nbsp;|&nbsp; <strong>Semester:</strong> ${identity.semester} (${identity.tahunAjaran})</p>
      <table>
        <thead>
          <tr>
            <th width="32">No</th>
            <th width="45">TP</th>
            <th>Materi Pokok</th>
            <th>Indikator Soal</th>
            <th width="42">Level</th>
            <th width="60">Kesulitan</th>
            <th width="80">Bentuk Soal</th>
            <th width="85">No. Soal Disajikan</th>
          </tr>
        </thead>
        <tbody>
          ${kisiRows
            .map(
              (row, i) => `<tr>
                <td class="center">${i + 1}</td>
                <td class="center">TP ${row.tpIndex}</td>
                <td>${row.materiPokok}</td>
                <td>${row.indikatorSoal}</td>
                <td class="center">${row.levelKognitif}</td>
                <td class="center">${row.kesulitan}</td>
                <td>${formatBentukLabel(row.bentukSoal)}</td>
                <td class="center"><strong>Soal No. ${row.noSoal}</strong></td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>`
      : '';

  const soalHtml = romanParts
    .map((part) => {
      if (part.type === 'menjodohkan') {
        const rows = part.items
          .map((q, idx) => {
            const opt = matchingPool[idx];
            return `<tr>
              <td class="center">${q.nomor}.</td>
              <td>${stripExamTag(q.pertanyaan)}</td>
              <td class="center">( ...... )</td>
              <td>${opt ? `<strong>${opt.code}.</strong> ${opt.answerText}` : ''}</td>
            </tr>`;
          })
          .join('');
        return `<div class="part">
          <div class="part-title">${part.roman}. ${part.title}</div>
          <div class="part-instr">${part.instruction}</div>
          <table>
            <thead><tr><th width="36">No</th><th>Kolom A (Pernyataan)</th><th width="70">Jawab</th><th>Kolom B (Pilihan Pasangan)</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      }
      const itemsHtml = part.items
        .map((q) => {
          const imgHtml = q.imageDataUrl
            ? `<div style="margin:6px 0;"><img src="${q.imageDataUrl}" alt="Gambar Soal ${q.nomor}" style="max-width:260px;max-height:170px;border:1px solid #cbd5e1;border-radius:4px;" /></div>`
            : '';
          const opsiHtml =
            q.bentuk === 'pg' && q.opsi
              ? `<div class="opsi-grid">
                  <div>A. ${q.opsi.A}</div>
                  <div>B. ${q.opsi.B}</div>
                  <div>C. ${q.opsi.C}</div>
                  ${!isLowerGrade && q.opsi.D ? `<div>D. ${q.opsi.D}</div>` : ''}
                </div>`
              : q.bentuk === 'uraian'
              ? `<div class="uraian-lines"><div></div><div></div></div>`
              : '';
          return `<div class="q-item">
            <div class="q-row"><span class="q-no">${q.nomor}.</span><div><div>${stripExamTag(q.pertanyaan)}</div>${imgHtml}${opsiHtml}</div></div>
          </div>`;
        })
        .join('');
      return `<div class="part">
        <div class="part-title">${part.roman}. ${part.title}</div>
        <div class="part-instr">${part.instruction}</div>
        ${itemsHtml}
      </div>`;
    })
    .join('');

  const kunciRows = questions
    .map((q) => {
      const matchedCode =
        q.bentuk === 'menjodohkan'
          ? matchingPool.find((m) => m.questionNomor === q.nomor)?.code
          : undefined;
      return `<tr>
        <td class="center">${q.nomor}</td>
        <td>${formatBentukLabel(q.bentuk)}</td>
        <td class="center">TP ${q.tpIndex}</td>
        <td><strong>${matchedCode ? `${matchedCode}. ${q.kunciJawaban}` : q.kunciJawaban}</strong></td>
      </tr>`;
    })
    .join('');

  const rubrikRows = questions
    .map(
      (q) => `<tr>
        <td class="center">${q.nomor}</td>
        <td>${q.bentuk.toUpperCase()}</td>
        <td class="center">${q.kesulitan}</td>
        <td>${q.rubrikSkor}</td>
        <td class="center"><strong>${q.skorMaks}</strong></td>
      </tr>`
    )
    .join('');

  const nilaiHeaders = questions.map((q) => `<th>${q.nomor}</th>`).join('');
  const nilaiRows = rosterRows
    .map(
      (s, i) => `<tr>
        <td class="center">${i + 1}</td>
        <td>${s}</td>
        ${questions.map(() => `<td></td>`).join('')}
        <td></td>
        <td></td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${docData.title}</title>
  <style>
    @page { size: ${pageSizeCss}; margin: 14mm 15mm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #000; margin: 0; padding: 0; line-height: 1.4; }
    .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
    .kop-top { font-weight: bold; font-size: 10.5pt; }
    .kop-school { font-weight: bold; font-size: 14pt; margin-top: 2px; }
    .kop-addr { font-size: 9pt; margin-top: 2px; }
    .kop-sub { font-weight: bold; font-size: 11pt; text-decoration: underline; margin-top: 8px; }
    .meta-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 14px; font-size: 10.5pt; }
    .meta-table { width: 100%; border-collapse: collapse; border: none; }
    .meta-table td { border: none; padding: 2px 4px; width: 50%; }
    .part { margin-bottom: 14px; }
    .part-title { font-weight: bold; font-size: 11pt; }
    .part-instr { font-style: italic; font-size: 10pt; margin-bottom: 8px; }
    .q-item { margin-bottom: 8px; page-break-inside: avoid; }
    .q-row { display: flex; gap: 6px; }
    .q-no { font-weight: bold; min-width: 22px; }
    .opsi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; margin-top: 4px; }
    .uraian-lines div { border-bottom: 1px dotted #666; height: 18px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
    th, td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
    th { background: #f1f5f9; }
    .center { text-align: center; }
    .page-break { page-break-before: always; break-before: page; }
    .formula { border: 1px solid #000; padding: 6px 10px; margin: 8px 0; background: #f8fafc; font-weight: bold; font-size: 10pt; }
  </style>
</head>
<body>
  ${kisiHtml}

  <section class="${kisiRows.length > 0 ? 'page-break' : ''}">
    ${kopHtml(`NASKAH SOAL ${examFullLabel}`)}
    <div class="meta-box">
      <table class="meta-table">
        <tr><td>Mata Pelajaran : <strong>${identity.mapel}</strong></td><td>Nama Siswa : .................................</td></tr>
        <tr><td>Kelas / Fase : ${identity.kelas} / ${identity.fase}</td><td>No. Absen : .................................</td></tr>
        <tr><td>Semester : ${identity.semester} (${identity.tahunAjaran})</td><td>Hari / Tanggal : .................................</td></tr>
      </table>
    </div>
    ${soalHtml}
  </section>

  <section class="page-break">
    ${kopHtml(`LAMPIRAN 1: KUNCI JAWABAN ${examFullLabel}`)}
    <p><strong>Mata Pelajaran:</strong> ${identity.mapel} &nbsp;|&nbsp; <strong>Kelas / Fase:</strong> ${identity.kelas} / ${identity.fase} &nbsp;|&nbsp; <strong>Semester:</strong> ${identity.semester} (${identity.tahunAjaran})</p>
    <table>
      <thead><tr><th width="40">No</th><th width="110">Bentuk</th><th width="60">TP</th><th>Kunci Jawaban</th></tr></thead>
      <tbody>${kunciRows}</tbody>
    </table>
  </section>

  <section class="page-break">
    ${kopHtml('LAMPIRAN 2: RUBRIK PENSKORAN & FORMAT PEMERIKSAAN')}
    <p><strong>Mata Pelajaran:</strong> ${identity.mapel} &nbsp;|&nbsp; <strong>Kelas / Fase:</strong> ${identity.kelas} / ${identity.fase}</p>
    <div class="formula">Nilai Akhir = (Jumlah Skor Diperoleh / ${maxTotalScore}) &times; 100</div>
    <table>
      <thead><tr><th width="40">No</th><th width="90">Bentuk</th><th width="70">Level</th><th>Kriteria Pemeriksaan / Rubrik Skor</th><th width="70">Skor Maks</th></tr></thead>
      <tbody>
        ${rubrikRows}
        <tr><td colspan="4" style="text-align:right"><strong>Total Skor Maksimal</strong></td><td class="center"><strong>${maxTotalScore}</strong></td></tr>
      </tbody>
    </table>
  </section>

  <section class="page-break">
    ${kopHtml(`LAMPIRAN 3: FORMAT DAFTAR NILAI SISWA ${identity.examType}`)}
    <p><strong>Mata Pelajaran:</strong> ${identity.mapel} &nbsp;|&nbsp; <strong>Kelas / Fase:</strong> ${identity.kelas} / ${identity.fase} &nbsp;|&nbsp; <strong>Semester:</strong> ${identity.semester} (${identity.tahunAjaran})</p>
    <table>
      <thead>
        <tr>
          <th rowspan="2" width="30">No</th>
          <th rowspan="2">Nama Siswa</th>
          <th colspan="${questions.length}" class="center">Nomor Soal &amp; Skor Diperoleh</th>
          <th rowspan="2" width="45">Jml Skor</th>
          <th rowspan="2" width="50">Nilai Akhir</th>
        </tr>
        <tr>${nilaiHeaders}</tr>
      </thead>
      <tbody>${nilaiRows}</tbody>
    </table>
    ${
      identity.kepalaSekolah || identity.namaPenyusun || identity.nipPenyusun
        ? `<table style="width:100%; border:none; margin-top:22px;">
            <tr>
              <td style="border:none; width:50%; text-align:center;">
                Mengetahui,<br/>Kepala ${kop.namaSekolah}<br/><br/><br/><br/>
                <strong><u>${identity.kepalaSekolah || '........................................'}</u></strong><br/>
                NIP. ${identity.nipKepalaSekolah || '-'}
              </td>
              <td style="border:none; width:50%; text-align:center;">
                Lendang Telaga, ....................<br/>Guru Mata Pelajaran / Kelas<br/><br/><br/><br/>
                <strong><u>${identity.namaPenyusun || docData.teacherName}</u></strong><br/>
                NIP. ${identity.nipPenyusun || '-'}
              </td>
            </tr>
          </table>`
        : ''
    }
  </section>
</body>
</html>`;
}

export function downloadAssessmentWord(
  docData: AssessmentDoc,
  students: string[],
  schoolSettings?: SchoolTeacherSettings
): void {
  const html = buildStandalonePrintHtml(docData, students, schoolSettings);
  const wordHtml = `\uFEFF${html}`;
  const blob = new Blob([wordHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(docData.title)}_${docData.identity.paperSize}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printAssessmentWithIframe(
  docData: AssessmentDoc,
  students: string[],
  schoolSettings?: SchoolTeacherSettings
): void {
  const html = buildStandalonePrintHtml(docData, students, schoolSettings);
  const existing = document.getElementById('sdn-lt-print-frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'sdn-lt-print-frame';
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
