import { jsPDF } from 'jspdf';
import { SCHOOL_INFO } from '../constants/school';
import { SchoolTeacherSettings } from '../types/portal';
import { getPdfImageFormat } from './imageUtils';

const LS_SETTINGS_KEY = 'sdn_lt_school_settings_v1';

export interface EffectiveKopData {
  pemerintah: string;
  dinas: string;
  namaSekolah: string;
  alamat: string;
  logoDataUrl: string;
}

export function getEffectiveKop(
  override?: SchoolTeacherSettings,
  fallbackInstansi?: string,
): EffectiveKopData {
  let cached: Partial<SchoolTeacherSettings> = {};
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (raw) {
      cached = JSON.parse(raw) as Partial<SchoolTeacherSettings>;
    }
  } catch {
    // ignore
  }
  return {
    pemerintah:
      (override?.pemerintah || cached.pemerintah || SCHOOL_INFO.pemerintah).trim() ||
      SCHOOL_INFO.pemerintah,
    dinas:
      (override?.dinas || cached.dinas || SCHOOL_INFO.dinas).trim() ||
      SCHOOL_INFO.dinas,
    namaSekolah:
      (fallbackInstansi || override?.namaSekolah || cached.namaSekolah || SCHOOL_INFO.namaSekolah).trim() ||
      SCHOOL_INFO.namaSekolah,
    alamat:
      (override?.alamat ?? cached.alamat ?? SCHOOL_INFO.alamat).trim() ||
      SCHOOL_INFO.alamat,
    logoDataUrl: (override?.logoDataUrl ?? cached.logoDataUrl ?? '').trim(),
  };
}

export function escapeKopHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildHtmlKop(
  subJudul: string,
  extraSub?: string,
  override?: SchoolTeacherSettings,
  fallbackInstansi?: string,
): string {
  const kop = getEffectiveKop(override, fallbackInstansi);
  const logoHtml = kop.logoDataUrl
    ? `<img src="${kop.logoDataUrl}" alt="Logo Sekolah" style="width:54px;height:54px;object-fit:contain;" />`
    : '';

  return `
    <div class="kop">
      <div class="kop-header-row" style="display:flex;align-items:center;justify-content:center;gap:12px;position:relative;">
        ${logoHtml ? `<div style="position:absolute;left:4px;top:0;">${logoHtml}</div>` : ''}
        <div style="text-align:center;flex:1;padding:${logoHtml ? '0 58px' : '0'};">
          <div class="kop-top">${escapeKopHtml(kop.pemerintah)}</div>
          <div class="kop-top">${escapeKopHtml(kop.dinas)}</div>
          <div class="kop-school">${escapeKopHtml(kop.namaSekolah)}</div>
          <div class="kop-addr">${escapeKopHtml(kop.alamat)}</div>
        </div>
      </div>
      <div class="kop-line" style="border-top:2px solid #000;border-bottom:1px solid #000;height:2px;margin:6px 0 8px 0;"></div>
      <div class="kop-sub">${escapeKopHtml(subJudul)}</div>
      ${extraSub ? `<div class="kop-extra">${escapeKopHtml(extraSub)}</div>` : ''}
    </div>
  `;
}

export function drawPdfKop(
  pdf: jsPDF,
  params: {
    marginX: number;
    pageW: number;
    subJudul: string;
    extraSub?: string;
    schoolSettings?: SchoolTeacherSettings;
    fallbackInstansi?: string;
  },
): number {
  const { marginX, pageW, subJudul, extraSub, schoolSettings, fallbackInstansi } = params;
  const kop = getEffectiveKop(schoolSettings, fallbackInstansi);
  let y = 14;

  if (kop.logoDataUrl) {
    try {
      pdf.addImage(kop.logoDataUrl, getPdfImageFormat(kop.logoDataUrl), marginX + 1, 10, 17, 17);
    } catch {
      // ignore invalid image data cleanly
    }
  }

  pdf.setFont('times', 'bold');
  pdf.setFontSize(10.5);
  pdf.text(kop.pemerintah, pageW / 2, y, { align: 'center' });
  y += 4.8;
  pdf.text(kop.dinas, pageW / 2, y, { align: 'center' });
  y += 5.2;
  pdf.setFontSize(13.5);
  pdf.text(kop.namaSekolah, pageW / 2, y, { align: 'center' });
  y += 4.5;
  pdf.setFont('times', 'normal');
  pdf.setFontSize(9);
  pdf.text(kop.alamat, pageW / 2, y, { align: 'center' });
  y += 3;
  pdf.setLineWidth(0.7);
  pdf.line(marginX, y, pageW - marginX, y);
  pdf.setLineWidth(0.25);
  pdf.line(marginX, y + 1, pageW - marginX, y + 1);
  y += 6.5;

  if (subJudul) {
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11.5);
    pdf.text(subJudul, pageW / 2, y, { align: 'center' });
    if (extraSub) {
      y += 5;
      pdf.setFontSize(10.5);
      pdf.text(extraSub, pageW / 2, y, { align: 'center' });
    }
    return y + 6;
  }
  return y;
}
