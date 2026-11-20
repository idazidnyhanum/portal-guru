import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CpMateriBankDoc, PaperSize, SchoolTeacherSettings } from '../types/portal';

function sanitizeFilename(raw: string): string {
  return raw
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

function getSemesterText(bank: CpMateriBankDoc): string {
  const semestersPresent = Array.from(
    new Set(bank.entries.map((e) => e.semester).filter(Boolean))
  );
  if (semestersPresent.length === 1) return semestersPresent[0];
  if (semestersPresent.length === 2) return 'I dan II';
  return 'I / II';
}

export function downloadCpTpAtpPdf(
  bank: CpMateriBankDoc,
  penyusunName: string,
  paperSize: PaperSize = 'F4',
  _schoolSettings?: SchoolTeacherSettings
): void {
  const pageFormat: [number, number] = paperSize === 'F4' ? [215, 330] : [210, 297];
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: pageFormat,
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const marginX = 14;
  const contentW = pageW - marginX * 2;
  let y = 16;

  // Title matching reference: centered, bold, underlined Times New Roman
  const titleText = `CP, TP, ATP ${bank.mapel.toUpperCase()}`;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(13);
  pdf.text(titleText, pageW / 2, y, { align: 'center' });
  const titleW = pdf.getTextWidth(titleText);
  pdf.setLineWidth(0.35);
  pdf.line((pageW - titleW) / 2, y + 1.2, (pageW + titleW) / 2, y + 1.2);
  y += 10;

  // Clean 2-line left metadata block matching reference PDF
  pdf.setFont('times', 'bold');
  pdf.setFontSize(10.5);
  pdf.text('Penyusun', marginX, y);
  pdf.text(`: ${penyusunName}`, marginX + 35, y);
  y += 5.2;

  const semText = getSemesterText(bank);
  pdf.text('Kelas/semester', marginX, y);
  pdf.text(`: ${bank.kelas} / ${semText}`, marginX + 35, y);
  y += 5.5;

  const bodyRows = bank.entries.map((entry) => {
    const cleanTps = (entry.tps || []).map((t) => t.trim()).filter(Boolean);
    const cleanAtps = (entry.atps || []).map((a) => a.trim()).filter(Boolean);
    return [
      entry.elemen.trim() || '-',
      entry.cpText.trim(),
      cleanTps.length > 0 ? cleanTps.join('\n\n') : '-',
      cleanAtps.length > 0 ? cleanAtps.join('\n\n') : '-',
      entry.materiBab.trim(),
      entry.semester || 'I',
    ];
  });

  autoTable(pdf, {
    startY: y,
    margin: { left: marginX, right: marginX },
    styles: {
      font: 'times',
      fontSize: 9.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      cellPadding: 2.4,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      valign: 'top',
    },
    head: [
      [
        'ELEMEN',
        'CAPAIAN PEMBELAJARAN',
        'TUJUAN PEMBELAJARAN',
        'ALUR TUJUAN PEMBELAJARAN',
        'MATERI',
        'Semester',
      ],
    ],
    body: bodyRows,
    columnStyles: {
      0: { cellWidth: contentW * 0.105 },
      1: { cellWidth: contentW * 0.2 },
      2: { cellWidth: contentW * 0.245 },
      3: { cellWidth: contentW * 0.255 },
      4: { cellWidth: contentW * 0.12 },
      5: { cellWidth: contentW * 0.075, halign: 'center', fontStyle: 'bold' },
    },
  });

  const fileName = `CP_TP_ATP_${sanitizeFilename(bank.mapel)}_Kelas${bank.kelas}_${paperSize}.pdf`;
  pdf.save(fileName);
}

export function buildCpTpAtpHtml(
  bank: CpMateriBankDoc,
  penyusunName: string,
  paperSize: PaperSize = 'F4',
  _schoolSettings?: SchoolTeacherSettings
): string {
  const pageSizeCss = paperSize === 'F4' ? '330mm 215mm' : '297mm 210mm';
  const semText = getSemesterText(bank);

  const rowsHtml = bank.entries
    .map((entry) => {
      const cleanTps = (entry.tps || []).map((t) => t.trim()).filter(Boolean);
      const cleanAtps = (entry.atps || []).map((a) => a.trim()).filter(Boolean);
      const tpsHtml =
        cleanTps.length > 0
          ? cleanTps.map((tp) => `<div class="list-item">${escapeHtml(tp)}</div>`).join('')
          : '-';
      const atpsHtml =
        cleanAtps.length > 0
          ? cleanAtps.map((atp) => `<div class="list-item">${escapeHtml(atp)}</div>`).join('')
          : '-';
      return `<tr>
        <td>${escapeHtml(entry.elemen.trim() || '-')}</td>
        <td>${escapeHtml(entry.cpText.trim())}</td>
        <td>${tpsHtml}</td>
        <td>${atpsHtml}</td>
        <td>${escapeHtml(entry.materiBab.trim())}</td>
        <td class="center"><strong>${escapeHtml(entry.semester || 'I')}</strong></td>
      </tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>CP, TP, ATP ${escapeHtml(bank.mapel)} Kelas ${bank.kelas}</title>
  <style>
    @page { size: ${pageSizeCss}; margin: 14mm 14mm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #000; margin: 0; padding: 0; line-height: 1.4; }
    .doc-title { text-align: center; font-weight: bold; font-size: 13pt; text-decoration: underline; margin-bottom: 14px; }
    .meta-table { border-collapse: collapse; margin-bottom: 12px; font-weight: bold; font-size: 10.5pt; }
    .meta-table td { border: none; padding: 2px 8px 2px 0; }
    table.main { width: 100%; border-collapse: collapse; font-size: 9.5pt; table-layout: fixed; }
    table.main th, table.main td { border: 1px solid #000; padding: 6px 7px; vertical-align: top; text-align: left; word-wrap: break-word; }
    table.main th { font-weight: bold; background: #fff; text-transform: none; }
    .center { text-align: center !important; }
    .list-item { margin-bottom: 8px; }
    .list-item:last-child { margin-bottom: 0; }
  </style>
</head>
<body>
  <div class="doc-title">CP, TP, ATP ${escapeHtml(bank.mapel.toUpperCase())}</div>
  <table class="meta-table">
    <tr><td width="130">Penyusun</td><td>: ${escapeHtml(penyusunName)}</td></tr>
    <tr><td>Kelas/semester</td><td>: ${bank.kelas} / ${escapeHtml(semText)}</td></tr>
  </table>
  <table class="main">
    <thead>
      <tr>
        <th width="10.5%">ELEMEN</th>
        <th width="20%">CAPAIAN PEMBELAJARAN</th>
        <th width="24.5%">TUJUAN PEMBELAJARAN</th>
        <th width="25.5%">ALUR TUJUAN PEMBELAJARAN</th>
        <th width="12%">MATERI</th>
        <th width="7.5%" class="center">Semester</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;
}

export function downloadCpTpAtpWord(
  bank: CpMateriBankDoc,
  penyusunName: string,
  paperSize: PaperSize = 'F4',
  schoolSettings?: SchoolTeacherSettings
): void {
  const html = buildCpTpAtpHtml(bank, penyusunName, paperSize, schoolSettings);
  const blob = new Blob([`\uFEFF${html}`], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CP_TP_ATP_${sanitizeFilename(bank.mapel)}_Kelas${bank.kelas}_${paperSize}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printCpTpAtpWithIframe(
  bank: CpMateriBankDoc,
  penyusunName: string,
  paperSize: PaperSize = 'F4',
  schoolSettings?: SchoolTeacherSettings
): void {
  const html = buildCpTpAtpHtml(bank, penyusunName, paperSize, schoolSettings);
  const existing = document.getElementById('sdn-lt-cptpatp-print-frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'sdn-lt-cptpatp-print-frame';
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
