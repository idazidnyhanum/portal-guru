import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GameScoreRecord, SchoolTeacherSettings } from '../types/portal';
import { buildHtmlKop, drawPdfKop, escapeKopHtml } from './schoolKop';

function sanitizeFilename(raw: string): string {
  return String(raw || '')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

export function getGameScoresExportFileName(
  rec: GameScoreRecord,
  ext: 'pdf' | 'doc'
): string {
  const base = sanitizeFilename(rec.gameTitle || rec.mapel || 'Rekap_Nilai_Game').slice(0, 40);
  return `Rekap_Nilai_${base}_Kls${rec.kelas}_${rec.roomCode}.${ext}`;
}

export function downloadGameScoresPdf(
  rec: GameScoreRecord,
  schoolSettings?: SchoolTeacherSettings
): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [215, 330],
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const marginX = 15;
  let y = drawPdfKop(pdf, {
    marginX,
    pageW,
    subJudul: 'REKAPITULASI NILAI GAME EDUKASI SISWA',
    extraSub: `${rec.mapel.toUpperCase()} — KELAS ${rec.kelas}`,
    schoolSettings,
  });

  const savedDate = new Date(rec.savedAt).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  pdf.setFont('times', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Nama Game   : ${rec.gameTitle}`, marginX, y);
  y += 4.8;
  pdf.text(`Kode Room   : ${rec.roomCode}   |   Waktu Simpan: ${savedDate}`, marginX, y);
  y += 5;

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
    head: [['Peringkat', 'Nama Siswa', 'Skor', 'Jawaban Benar', 'Akurasi (%)']],
    body:
      rec.entries.length > 0
        ? rec.entries.map((entry, idx) => [
            `#${idx + 1}`,
            entry.name,
            String(entry.score),
            `${entry.correctCount}/${entry.totalQuestions}`,
            `${entry.accuracyPct}%`,
          ])
        : [['-', 'Belum ada data peserta', '-', '-', '-']],
    columnStyles: {
      0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
    },
  });

  pdf.save(getGameScoresExportFileName(rec, 'pdf'));
}

export function downloadGameScoresWord(
  rec: GameScoreRecord,
  schoolSettings?: SchoolTeacherSettings
): void {
  const savedDate = new Date(rec.savedAt).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const kop = buildHtmlKop(
    'REKAPITULASI NILAI GAME EDUKASI SISWA',
    `${rec.mapel.toUpperCase()} — KELAS ${rec.kelas}`,
    schoolSettings
  );

  const rowsHtml =
    rec.entries.length > 0
      ? rec.entries
          .map(
            (entry, idx) => `<tr>
              <td class="center"><strong>#${idx + 1}</strong></td>
              <td>${escapeKopHtml(entry.name)}</td>
              <td class="center"><strong>${entry.score}</strong></td>
              <td class="center">${entry.correctCount}/${entry.totalQuestions}</td>
              <td class="center">${entry.accuracyPct}%</td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="5" class="center">Belum ada data peserta</td></tr>';

  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Rekap Nilai - ${escapeKopHtml(rec.gameTitle)}</title>
  <style>
    @page { size: 215mm 330mm; margin: 14mm 15mm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; }
    .kop { text-align: center; margin-bottom: 12px; }
    .kop-top { font-weight: bold; font-size: 10.5pt; }
    .kop-school { font-weight: bold; font-size: 14pt; margin-top: 2px; }
    .kop-addr { font-size: 9pt; margin-top: 2px; }
    .kop-sub { font-weight: bold; font-size: 11.5pt; text-decoration: underline; margin-top: 8px; }
    .kop-extra { font-weight: bold; font-size: 10.5pt; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10pt; }
    th, td { border: 1px solid #000; padding: 5px 7px; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .center { text-align: center; }
  </style>
</head>
<body>
  ${kop}
  <p><strong>Nama Game:</strong> ${escapeKopHtml(rec.gameTitle)}<br/>
  <strong>Kode Room:</strong> ${escapeKopHtml(rec.roomCode)} &nbsp;|&nbsp; <strong>Waktu Simpan:</strong> ${escapeKopHtml(savedDate)}</p>
  <table>
    <thead>
      <tr>
        <th width="65" class="center">Peringkat</th>
        <th>Nama Siswa</th>
        <th width="65" class="center">Skor</th>
        <th width="95" class="center">Jawaban Benar</th>
        <th width="80" class="center">Akurasi (%)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([`\uFEFF${html}`], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getGameScoresExportFileName(rec, 'doc');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
