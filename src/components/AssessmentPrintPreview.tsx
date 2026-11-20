import { useEffect, useMemo, useState } from 'react';
import {
  AssessmentDoc,
  AssessmentQuestion,
  QuestionType,
  SchoolTeacherSettings,
} from '../types/portal';
import { getEffectiveKop } from '../utils/schoolKop';

interface AssessmentPrintPreviewProps {
  docData: AssessmentDoc;
  students: string[];
  schoolSettings?: SchoolTeacherSettings;
}

type PreviewSection = 'all' | 'kisi' | 'soal' | 'kunci' | 'rubrik' | 'nilai';

export function AssessmentPrintPreview({
  docData,
  students,
  schoolSettings,
}: AssessmentPrintPreviewProps) {
  const [activeView, setActiveView] = useState<PreviewSection>('all');
  const kop = getEffectiveKop(schoolSettings);

  const { identity, kisiRows, questions } = docData;
  const isLowerGrade = identity.kelas <= 3;
  const paperClass = identity.paperSize === 'F4' ? 'paper-sheet-f4' : 'paper-sheet-a4';
  const stripExamTag = (raw: string) =>
    String(raw || '').replace(/^\s*(?:[\[(]\s*(?:STS|SAS)\s*(?:No\.?)?\s*\d+\s*[\])]\s*)+/gi, '').trim();

  // Inject dynamic @page rule for exact A4 vs F4 printing
  useEffect(() => {
    const styleId = 'dynamic-print-page-size';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const pageSize = identity.paperSize === 'F4' ? '215mm 330mm' : '210mm 297mm';
    styleEl.textContent = `@media print { @page { size: ${pageSize}; margin: 14mm 15mm; } }`;
  }, [identity.paperSize]);

  const grouped = useMemo(() => {
    const byType: Record<QuestionType, AssessmentQuestion[]> = {
      pg: [],
      isian: [],
      menjodohkan: [],
      uraian: [],
    };
    for (const q of questions) {
      byType[q.bentuk]?.push(q);
    }
    return byType;
  }, [questions]);

  const matchingPool = useMemo(() => {
    const items = grouped.menjodohkan;
    if (items.length === 0) return [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    // Deterministic shuffle so column B isn't trivially aligned row-by-row
    const sorted = [...items]
      .map((q, idx) => ({ q, sortKey: (idx * 7 + 3) % Math.max(1, items.length) }))
      .sort((a, b) => a.sortKey - b.sortKey);
    return sorted.map((entry, idx) => ({
      code: letters[idx] || String(idx + 1),
      answerText: entry.q.kunciJawaban,
      questionNomor: entry.q.nomor,
    }));
  }, [grouped.menjodohkan]);

  const maxTotalScore = useMemo(
    () => questions.reduce((acc, q) => acc + (q.skorMaks || 1), 0),
    [questions]
  );

  const romanParts = useMemo(() => {
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
      .filter((o) => grouped[o.type].length > 0)
      .map((o) => ({
        ...o,
        roman: numerals[rIdx++] || String(rIdx),
        items: grouped[o.type],
      }));
  }, [grouped, isLowerGrade]);

  const rosterRows = students.length > 0 ? students : ['(Belum ada siswa terdaftar di kelas ini)'];

  const renderKop = (subJudul: string) => (
    <div className="border-b-[3px] border-double border-black pb-2.5 mb-4 text-center">
      <div className="relative flex items-center justify-center">
        {kop.logoDataUrl && (
          <img
            src={kop.logoDataUrl}
            alt="Logo Sekolah"
            className="w-14 h-14 object-contain sm:absolute sm:left-1 sm:top-0"
          />
        )}
        <div className={kop.logoDataUrl ? 'sm:px-16' : ''}>
          <div className="text-[10.5pt] font-bold tracking-wide uppercase">
            {kop.pemerintah}
          </div>
          <div className="text-[10.5pt] font-bold tracking-wide uppercase">
            {kop.dinas}
          </div>
          <div className="text-[14pt] font-extrabold tracking-wide uppercase mt-0.5">
            {kop.namaSekolah}
          </div>
          <div className="text-[8.5pt] text-slate-700 mt-0.5">{kop.alamat}</div>
        </div>
      </div>
      <div className="text-[10.5pt] font-bold uppercase mt-1.5 underline underline-offset-4">
        {subJudul}
      </div>
    </div>
  );

  const examFullLabel =
    identity.examType === 'STS'
      ? 'SUMATIF TENGAH SEMESTER (STS)'
      : 'SUMATIF AKHIR SEMESTER (SAS)';

  const showSection = (sec: PreviewSection) => activeView === 'all' || activeView === sec;

  return (
    <div className="space-y-4">
      {/* Screen-only Section Tabs + Paper Info */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100 p-2 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'Semua Dokumen (5 Bagian)' },
              { id: 'kisi', label: '0. Kisi-Kisi Soal' },
              { id: 'soal', label: 'Naskah Soal' },
              { id: 'kunci', label: '1. Kunci Jawaban' },
              { id: 'rubrik', label: '2. Rubrik Penskoran' },
              { id: 'nilai', label: '3. Daftar Nilai Siswa' },
            ] as { id: PreviewSection; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                activeView === tab.id
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="text-xs font-mono text-slate-600 px-2 shrink-0 tabular-nums">
          Kertas: {identity.paperSize} ({identity.paperSize === 'F4' ? '215×330mm' : '210×297mm'}) ·{' '}
          {questions.length} Soal
        </div>
      </div>

      <div className="paper-preview-wrapper">
        {/* KISI-KISI SOAL */}
        {showSection('kisi') && kisiRows.length > 0 && (
          <section className={`paper-sheet ${paperClass}`}>
            {renderKop(`KISI-KISI SOAL ${examFullLabel}`)}

            <div className="text-[10.5pt] mb-3 flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>Mata Pelajaran:</strong> {identity.mapel}</span>
              <span><strong>Kelas / Fase:</strong> {identity.kelas} / {identity.fase}</span>
              <span><strong>Semester:</strong> {identity.semester} ({identity.tahunAjaran})</span>
            </div>

            <table className="w-full border-collapse border border-black text-[9.5pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black px-2 py-1.5 w-10 text-center">No</th>
                  <th className="border border-black px-2 py-1.5 w-16 text-center">TP</th>
                  <th className="border border-black px-2 py-1.5 text-left">Materi Pokok</th>
                  <th className="border border-black px-2 py-1.5 text-left">Indikator Soal</th>
                  <th className="border border-black px-2 py-1.5 w-14 text-center">Level</th>
                  <th className="border border-black px-2 py-1.5 w-20 text-center">Kesulitan</th>
                  <th className="border border-black px-2 py-1.5 w-24 text-left">Bentuk Soal</th>
                  <th className="border border-black px-2 py-1.5 w-20 text-center">No. Soal Disajikan</th>
                </tr>
              </thead>
              <tbody>
                {kisiRows.map((row, rIdx) => (
                  <tr key={row.id} className="avoid-break">
                    <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                      {rIdx + 1}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                      TP {row.tpIndex}
                    </td>
                    <td className="border border-black px-2 py-1.5">{row.materiPokok}</td>
                    <td className="border border-black px-2 py-1.5">{row.indikatorSoal}</td>
                    <td className="border border-black px-2 py-1.5 text-center">{row.levelKognitif}</td>
                    <td className="border border-black px-2 py-1.5 text-center">{row.kesulitan}</td>
                    <td className="border border-black px-2 py-1.5 uppercase text-[8.5pt]">
                      {row.bentukSoal === 'pg'
                        ? 'Pilihan Ganda'
                        : row.bentukSoal === 'isian'
                        ? 'Isian Singkat'
                        : row.bentukSoal === 'menjodohkan'
                        ? 'Menjodohkan'
                        : 'Uraian'}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center font-bold tabular-nums">
                      Soal No. {row.noSoal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(identity.kepalaSekolah || identity.namaPenyusun || identity.nipPenyusun) && (
              <div className="mt-8 grid grid-cols-2 gap-8 text-[10pt] avoid-break">
                <div className="text-center">
                  <div>Mengetahui,</div>
                  <div>Kepala {kop.namaSekolah}</div>
                  <div className="h-14" />
                  <div className="font-bold underline">
                    {identity.kepalaSekolah || '........................................'}
                  </div>
                  <div>NIP. {identity.nipKepalaSekolah || '-'}</div>
                </div>
                <div className="text-center">
                  <div>Lendang Telaga, ....................</div>
                  <div>Guru Penyusun</div>
                  <div className="h-14" />
                  <div className="font-bold underline">
                    {identity.namaPenyusun || docData.teacherName}
                  </div>
                  <div>NIP. {identity.nipPenyusun || '-'}</div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* NASKAH SOAL */}
        {showSection('soal') && (
          <section className={`paper-sheet ${paperClass} ${activeView === 'all' && kisiRows.length > 0 ? 'print-page-break' : ''}`}>
            {renderKop(`NASKAH SOAL ${examFullLabel}`)}

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10.5pt] mb-4 border border-black p-2.5">
              <div className="flex">
                <span className="w-32 shrink-0">Mata Pelajaran</span>
                <span className="mr-2">:</span>
                <span className="font-semibold">{identity.mapel}</span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0">Nama Siswa</span>
                <span className="mr-2">:</span>
                <span className="border-b border-dotted border-black flex-1" />
              </div>
              <div className="flex">
                <span className="w-32 shrink-0">Kelas / Fase</span>
                <span className="mr-2">:</span>
                <span>
                  {identity.kelas} / {identity.fase}
                </span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0">No. Absen</span>
                <span className="mr-2">:</span>
                <span className="border-b border-dotted border-black flex-1" />
              </div>
              <div className="flex">
                <span className="w-32 shrink-0">Semester</span>
                <span className="mr-2">:</span>
                <span>
                  {identity.semester} ({identity.tahunAjaran})
                </span>
              </div>
              <div className="flex">
                <span className="w-28 shrink-0">Hari / Tanggal</span>
                <span className="mr-2">:</span>
                <span className="border-b border-dotted border-black flex-1" />
              </div>
            </div>

            <div className="space-y-5">
              {romanParts.map((part) => (
                <div key={part.type} className="space-y-2.5">
                  <div className="font-bold text-[11pt] avoid-break">
                    {part.roman}. {part.title}
                    <div className="font-normal italic text-[10pt] mt-0.5">{part.instruction}</div>
                  </div>

                  {part.type === 'menjodohkan' ? (
                    <table className="w-full border-collapse border border-black text-[10.5pt] mt-2">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-black px-2 py-1.5 w-10 text-center">No</th>
                          <th className="border border-black px-2.5 py-1.5 text-left">Kolom A (Pernyataan)</th>
                          <th className="border border-black px-2 py-1.5 w-16 text-center">Jawab</th>
                          <th className="border border-black px-2.5 py-1.5 text-left">Kolom B (Pilihan Pasangan)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {part.items.map((q, idx) => {
                          const opt = matchingPool[idx];
                          return (
                            <tr key={q.id} className="avoid-break">
                              <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                                {q.nomor}.
                              </td>
                              <td className="border border-black px-2.5 py-1.5">{stripExamTag(q.pertanyaan)}</td>
                              <td className="border border-black px-2 py-1.5 text-center font-mono">
                                ( ...... )
                              </td>
                              <td className="border border-black px-2.5 py-1.5">
                                {opt ? (
                                  <span>
                                    <strong>{opt.code}.</strong> {opt.answerText}
                                  </span>
                                ) : (
                                  ''
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="space-y-3">
                      {part.items.map((q) => (
                        <div key={q.id} className="avoid-break pl-1">
                          <div className="flex items-start gap-2">
                            <span className="font-semibold w-6 shrink-0 tabular-nums">{q.nomor}.</span>
                            <div className="flex-1">
                              <div>{stripExamTag(q.pertanyaan)}</div>
                              {q.imageDataUrl && (
                                <div className="my-2">
                                  <img
                                    src={q.imageDataUrl}
                                    alt={`Gambar Soal ${q.nomor}`}
                                    className="max-w-[260px] max-h-[170px] object-contain border border-slate-300 rounded"
                                  />
                                </div>
                              )}
                              {q.bentuk === 'pg' && q.opsi && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 mt-1 pl-1">
                                  <div>A. {q.opsi.A}</div>
                                  <div>B. {q.opsi.B}</div>
                                  <div>C. {q.opsi.C}</div>
                                  {!isLowerGrade && q.opsi.D && <div>D. {q.opsi.D}</div>}
                                </div>
                              )}
                              {q.bentuk === 'uraian' && (
                                <div className="mt-2 space-y-2 pr-4">
                                  <div className="border-b border-dotted border-slate-400 h-4" />
                                  <div className="border-b border-dotted border-slate-400 h-4" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </section>
        )}

        {/* LAMPIRAN 1: KUNCI JAWABAN */}
        {showSection('kunci') && (
          <section className={`paper-sheet ${paperClass} ${activeView === 'all' ? 'print-page-break' : ''}`}>
            {renderKop(`LAMPIRAN 1: KUNCI JAWABAN ${examFullLabel}`)}

            <div className="text-[10.5pt] mb-3 flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>Mata Pelajaran:</strong> {identity.mapel}</span>
              <span><strong>Kelas / Fase:</strong> {identity.kelas} / {identity.fase}</span>
              <span><strong>Semester:</strong> {identity.semester} ({identity.tahunAjaran})</span>
            </div>

            <table className="w-full border-collapse border border-black text-[10pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black px-2 py-1.5 w-12 text-center">No</th>
                  <th className="border border-black px-2.5 py-1.5 w-28 text-left">Bentuk Soal</th>
                  <th className="border border-black px-2 py-1.5 w-16 text-center">TP</th>
                  <th className="border border-black px-2.5 py-1.5 text-left">Kunci Jawaban</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => {
                  const matchedCode =
                    q.bentuk === 'menjodohkan'
                      ? matchingPool.find((m) => m.questionNomor === q.nomor)?.code
                      : undefined;
                  return (
                    <tr key={q.id} className="avoid-break">
                      <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                        {q.nomor}
                      </td>
                      <td className="border border-black px-2.5 py-1.5 uppercase text-[9pt]">
                        {q.bentuk === 'pg'
                          ? 'Pilihan Ganda'
                          : q.bentuk === 'isian'
                          ? 'Isian Singkat'
                          : q.bentuk === 'menjodohkan'
                          ? 'Menjodohkan'
                          : 'Uraian'}
                      </td>
                      <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                        TP {q.tpIndex}
                      </td>
                      <td className="border border-black px-2.5 py-1.5 font-semibold">
                        {matchedCode ? `${matchedCode}. ${q.kunciJawaban}` : q.kunciJawaban}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

          </section>
        )}

        {/* LAMPIRAN 2: FORMAT PEMERIKSAAN / RUBRIK PENSKORAN */}
        {showSection('rubrik') && (
          <section className={`paper-sheet ${paperClass} ${activeView === 'all' ? 'print-page-break' : ''}`}>
            {renderKop(`LAMPIRAN 2: RUBRIK PENSKORAN & FORMAT PEMERIKSAAN`)}

            <div className="text-[10.5pt] mb-3 flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>Mata Pelajaran:</strong> {identity.mapel}</span>
              <span><strong>Kelas / Fase:</strong> {identity.kelas} / {identity.fase}</span>
              <span><strong>Skor Maksimal Total:</strong> {maxTotalScore}</span>
            </div>

            <div className="border border-black p-3 mb-4 text-[10pt] bg-slate-50">
              <div className="font-bold mb-1">Pedoman Konversi Nilai Akhir:</div>
              <div className="font-mono">
                Nilai Akhir = (Jumlah Skor Diperoleh / {maxTotalScore}) × 100
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-[9.5pt]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-black px-2 py-1.5 w-10 text-center">No</th>
                  <th className="border border-black px-2 py-1.5 w-24 text-left">Bentuk</th>
                  <th className="border border-black px-2 py-1.5 w-20 text-center">Level</th>
                  <th className="border border-black px-2.5 py-1.5 text-left">Kriteria Pemeriksaan / Rubrik Skor</th>
                  <th className="border border-black px-2 py-1.5 w-20 text-center">Skor Maks</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} className="avoid-break">
                    <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                      {q.nomor}
                    </td>
                    <td className="border border-black px-2 py-1.5 uppercase text-[8.5pt]">
                      {q.bentuk}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center">{q.kesulitan}</td>
                    <td className="border border-black px-2.5 py-1.5">{q.rubrikSkor}</td>
                    <td className="border border-black px-2 py-1.5 text-center font-bold tabular-nums">
                      {q.skorMaks}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={4} className="border border-black px-2.5 py-1.5 text-right">
                    Total Skor Maksimal
                  </td>
                  <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                    {maxTotalScore}
                  </td>
                </tr>
              </tbody>
            </table>

          </section>
        )}

        {/* LAMPIRAN 3: FORMAT DAFTAR NILAI SISWA */}
        {showSection('nilai') && (
          <section className={`paper-sheet ${paperClass} ${activeView === 'all' ? 'print-page-break' : ''}`}>
            {renderKop(`LAMPIRAN 3: FORMAT DAFTAR NILAI SISWA ${identity.examType}`)}

            <div className="text-[10.5pt] mb-3 flex flex-wrap gap-x-6 gap-y-1">
              <span><strong>Mata Pelajaran:</strong> {identity.mapel}</span>
              <span><strong>Kelas / Fase:</strong> {identity.kelas} / {identity.fase}</span>
              <span><strong>Semester:</strong> {identity.semester} ({identity.tahunAjaran})</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-black text-[8.5pt]">
                <thead>
                  <tr className="bg-slate-100">
                    <th rowSpan={2} className="border border-black px-1.5 py-1 text-center w-8">
                      No
                    </th>
                    <th rowSpan={2} className="border border-black px-2 py-1 text-left min-w-[140px]">
                      Nama Siswa
                    </th>
                    <th colSpan={questions.length} className="border border-black px-1 py-1 text-center">
                      Nomor Soal &amp; Skor Diperoleh
                    </th>
                    <th rowSpan={2} className="border border-black px-1.5 py-1 text-center w-12">
                      Jml Skor
                    </th>
                    <th rowSpan={2} className="border border-black px-1.5 py-1 text-center w-14">
                      Nilai Akhir
                    </th>
                  </tr>
                  <tr className="bg-slate-50">
                    {questions.map((q) => (
                      <th key={q.id} className="border border-black px-1 py-1 text-center tabular-nums min-w-[20px]">
                        {q.nomor}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rosterRows.map((studentName, sIdx) => (
                    <tr key={`${studentName}_${sIdx}`} className="avoid-break">
                      <td className="border border-black px-1.5 py-1.5 text-center tabular-nums">
                        {sIdx + 1}
                      </td>
                      <td className="border border-black px-2 py-1.5 font-medium">{studentName}</td>
                      {questions.map((q) => (
                        <td key={q.id} className="border border-black px-1 py-1.5 text-center" />
                      ))}
                      <td className="border border-black px-1.5 py-1.5 text-center" />
                      <td className="border border-black px-1.5 py-1.5 text-center" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(identity.kepalaSekolah || identity.namaPenyusun || identity.nipPenyusun) && (
              <div className="mt-8 grid grid-cols-2 gap-8 text-[10pt] avoid-break">
                <div className="text-center">
                  <div>Mengetahui,</div>
                  <div>Kepala {kop.namaSekolah}</div>
                  <div className="h-14" />
                  <div className="font-bold underline">
                    {identity.kepalaSekolah || '........................................'}
                  </div>
                  <div>NIP. {identity.nipKepalaSekolah || '-'}</div>
                </div>
                <div className="text-center">
                  <div>Lendang Telaga, ....................</div>
                  <div>Guru Mata Pelajaran / Kelas</div>
                  <div className="h-14" />
                  <div className="font-bold underline">
                    {identity.namaPenyusun || docData.teacherName}
                  </div>
                  <div>NIP. {identity.nipPenyusun || '-'}</div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
