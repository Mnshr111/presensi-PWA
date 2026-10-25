import { useEffect, useMemo, useRef, useState } from 'react';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function currentDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function escapeCsv(value) {
  const rawText = String(value ?? '');
  const safeText = /^[\s]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function formatMonthLabel(m) {
  if (!m) return '';
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${m}-01T00:00:00`));
}

function downloadReportCsv(reportType, monthLabel, rows) {
  let headers = [];
  let csvRows = [];

  if (reportType === 'daily') {
    headers = ['Tanggal', 'NIS', 'Nama Lengkap', 'Kelas', 'Status Kehadiran', 'Keterangan/Nilai'];
    csvRows = rows.map((r) => [
      r.date,
      r.nis,
      r.name,
      r.className,
      r.status,
      r.note || '',
    ].map(escapeCsv).join(','));
  } else {
    headers = [
      'Bulan',
      'NIS',
      'Nama Lengkap',
      'Kelas',
      'Jumlah Pertemuan',
      'Hadir',
      'Izin',
      'Sakit',
      'Alpa',
      'Izin kelas lain',
      'Rata-rata Nilai',
      'Rata-rata per Mapel',
    ];
    csvRows = rows.map((r) => [
      r.month || monthLabel,
      r.nis,
      r.name,
      r.className,
      r.sessions,
      r.attendance?.Hadir || 0,
      r.attendance?.Izin || 0,
      r.attendance?.Sakit || 0,
      r.attendance?.Alpa || 0,
      r.attendance?.['Izin kelas lain'] || 0,
      r.averageGrade === null || r.averageGrade === undefined ? '' : r.averageGrade.toFixed(2),
      r.subjects
        ? r.subjects.map((sub) => `${sub.subject}: ${sub.averageGrade.toFixed(2)}`).join('; ')
        : '',
    ].map(escapeCsv).join(','));
  }

  const content = `\uFEFF${[headers.map(escapeCsv).join(','), ...csvRows].join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rekap-${reportType}-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function DetailPage({ students = [], onLoadReport }) {
  const pdfToolsPromise = useRef(null);
  const pdfToolsError = useRef(null);

  const [reportType, setReportType] = useState('monthly'); // 'daily' | 'monthly' | 'student'
  const [month, setMonth] = useState(currentMonth);
  const [date, setDate] = useState(currentDate);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [selectedNis, setSelectedNis] = useState('');
  const [className, setClassName] = useState('');

  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    pdfToolsPromise.current = import('../lib/reportPdf').catch((loadError) => {
      if (active) pdfToolsError.current = loadError;
      return null;
    });
    return () => {
      active = false;
    };
  }, []);

  const classOptions = useMemo(
    () => [...new Set(students.map((student) => student.className).filter(Boolean))].sort(),
    [students],
  );

  const studentOptions = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );

  const monthLabel = useMemo(() => {
    if (reportType === 'monthly') {
      return formatMonthLabel(month);
    }
    if (reportType === 'student') {
      return `${formatMonthLabel(startMonth)} s.d. ${formatMonthLabel(endMonth)}`;
    }
    return date;
  }, [reportType, month, startMonth, endMonth, date]);

  const generateReport = async (event) => {
    event.preventDefault();
    setError('');
    setReport(null);
    setIsLoading(true);

    try {
      const payload = {
        type: reportType,
        className,
      };

      if (reportType === 'daily') {
        payload.date = date;
      } else if (reportType === 'monthly') {
        payload.month = month;
      } else if (reportType === 'student') {
        if (!selectedNis) {
          throw new Error('Silakan pilih siswa terlebih dahulu.');
        }
        if (startMonth > endMonth) {
          throw new Error('Bulan awal tidak boleh lebih besar dari bulan akhir.');
        }
        payload.nis = selectedNis;
        payload.startMonth = startMonth;
        payload.endMonth = endMonth;
      }

      const data = await onLoadReport(payload);
      setReport(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal mengambil data rekap.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!report || report.length === 0) return;
    setError('');
    setExportMessage('');
    setIsExportingPdf(true);

    try {
      const pdfTools = await pdfToolsPromise.current;
      if (!pdfTools) {
        throw new Error(pdfToolsError.current instanceof Error
          ? pdfToolsError.current.message
          : 'Fitur pembuatan PDF gagal dimuat. Muat ulang halaman lalu coba lagi.');
      }
      const blob = pdfTools.createReportPdf(reportType, month, monthLabel, className, report);
      const filename = `rekap-${reportType}-${month || Date.now()}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Rekap ${monthLabel}` });
        setExportMessage('PDF siap dibagikan atau disimpan.');
      } else {
        downloadPdf(blob, filename);
        setExportMessage('PDF berhasil dibuat. Buka file unduhan untuk menyimpan atau mencetak.');
      }
    } catch (exportError) {
      if (exportError instanceof Error && exportError.name === 'AbortError') return;
      setError(exportError instanceof Error ? exportError.message : 'Gagal membuat PDF rekap.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <section>
      <div className="mb-8 border-b border-slate-200/60 pb-4">
        <h2 className="text-2xl font-bold text-slate-800">Rekap Presensi & Rapor</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pilih rekap harian, bulanan, atau rekap per siswa berdasarkan rentang bulan.
        </p>
      </div>

      {/* Tab Menu */}
      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => { setReportType('monthly'); setReport(null); }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${reportType === 'monthly' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
           Rekap Harian
        </button>
        <button
          type="button"
          onClick={() => { setReportType('student'); setReport(null); }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${reportType === 'student' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Rekap Per Siswa (Rentang Bulan)
        </button>
      </div>

      {/* Form Filter */}
      <form onSubmit={generateReport} className="glass-card mb-6 flex flex-col gap-4 rounded-2xl border border-white/80 bg-white/70 p-5 shadow-sm sm:flex-row sm:items-end">
        {reportType === 'daily' && (
          <div className="w-full sm:w-56">
            <label htmlFor="report-date" className="mb-1 block text-xs font-semibold text-slate-600">Tanggal</label>
            <input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
        )}

        {reportType === 'monthly' && (
          <div className="w-full sm:w-56">
            <label htmlFor="report-month" className="mb-1 block text-xs font-semibold text-slate-600">Bulan</label>
            <input
              id="report-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
              className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>
        )}

        {reportType === 'student' && (
          <>
            <div className="w-full sm:w-72">
              <label htmlFor="select-student" className="mb-1 block text-xs font-semibold text-slate-600">Pilih Siswa</label>
              <select
                id="select-student"
                value={selectedNis}
                onChange={(e) => setSelectedNis(e.target.value)}
                required
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <option value="">-- Pilih Siswa --</option>
                {studentOptions.map((s) => (
                  <option key={s.nis} value={s.nis}>
                    {s.name} ({s.nis}) - {s.className}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="start-month" className="mb-1 block text-xs font-semibold text-slate-600">Dari Bulan</label>
              <input
                id="start-month"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                required
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="end-month" className="mb-1 block text-xs font-semibold text-slate-600">Sampai Bulan</label>
              <input
                id="end-month"
                type="month"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                required
                className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
              />
            </div>
          </>
        )}

        {reportType !== 'student' && (
          <div className="w-full sm:w-64">
            <label htmlFor="report-class" className="mb-1 block text-xs font-semibold text-slate-600">Kelas</label>
            <select
              id="report-class"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="">Semua kelas</option>
              {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
        >
          {isLoading ? 'Memuat rekap...' : 'Tampilkan Rekap'}
        </button>
      </form>

      {error && <p role="alert" className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {report && (
        <div className="print-report">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {reportType === 'daily' && `Rekap Harian Tanggal ${monthLabel}`}
                {reportType === 'monthly' && `Rapor Bulan ${monthLabel}`}
                {reportType === 'student' && `Rekap Perkembangan Siswa (${monthLabel})`}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {reportType !== 'student' && (className ? `Kelas ${className}` : 'Semua kelas')}
                {reportType === 'student' && `Riwayat siswa terpilih`} · {report.length} catatan
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={exportPdf}
                disabled={report.length === 0 || isExportingPdf}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
              >
                {isExportingPdf ? 'Membuat PDF...' : 'PDF / Simpan'}
              </button>
              <button
                type="button"
                onClick={() => downloadReportCsv(reportType, monthLabel, report)}
                disabled={report.length === 0}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
              >
                Unduh CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={report.length === 0}
                className="rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-50"
              >
                Cetak Rapor
              </button>
            </div>
          </div>

          {/* Tabel Hasil */}
          <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white/90 shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-sky-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">No.</th>
                  {reportType === 'daily' ? (
                    <>
                      <th className="px-3 py-3">NIS / Nama Siswa</th>
                      <th className="px-3 py-3">Kelas</th>
                      <th className="px-3 py-3">Status Kehadiran</th>
                      <th className="px-3 py-3">Keterangan</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-3">Bulan</th>
                      <th className="px-3 py-3">NIS / Nama Siswa</th>
                      <th className="px-3 py-3">Kelas</th>
                      <th className="px-3 py-3">Pertemuan</th>
                      <th className="px-3 py-3">Hadir</th>
                      <th className="px-3 py-3">Izin</th>
                      <th className="px-3 py-3">Sakit</th>
                      <th className="px-3 py-3">Alpa</th>
                      <th className="px-3 py-3">Izin Kelas Lain</th>
                      <th className="px-3 py-3">Rata-rata Nilai</th>
                      <th className="px-3 py-3">Nilai per Mapel</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.map((row, index) => (
                  <tr key={index} className="align-top text-slate-700">
                    <td className="px-3 py-3">{index + 1}</td>
                    {reportType === 'daily' ? (
                      <>
                        <td className="px-3 py-3">
                          <span className="font-semibold">{row.name}</span>
                          <span className="block text-xs text-slate-400">{row.nis}</span>
                        </td>
                        <td className="px-3 py-3">{row.className}</td>
                        <td className="px-3 py-3 font-semibold text-cyan-700">{row.status}</td>
                        <td className="px-3 py-3">{row.note || '—'}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3">{row.month || monthLabel}</td>
                        <td className="px-3 py-3">
                          <span className="font-semibold">{row.name}</span>
                          <span className="block text-xs text-slate-400">{row.nis}</span>
                        </td>
                        <td className="px-3 py-3">{row.className}</td>
                        <td className="px-3 py-3">{row.sessions}</td>
                        <td className="px-3 py-3">{row.attendance?.Hadir || 0}</td>
                        <td className="px-3 py-3">{row.attendance?.Izin || 0}</td>
                        <td className="px-3 py-3">{row.attendance?.Sakit || 0}</td>
                        <td className="px-3 py-3">{row.attendance?.Alpa || 0}</td>
                        <td className="px-3 py-3">{row.attendance?.['Izin kelas lain'] || 0}</td>
                        <td className="px-3 py-3 font-semibold">
                          {row.averageGrade === null || row.averageGrade === undefined ? '—' : row.averageGrade.toFixed(2)}
                        </td>
                        <td className="px-3 py-3">
                          {row.subjects && row.subjects.length > 0
                            ? row.subjects.map((sub) => (
                              <span key={sub.subject} className="mb-1 block">
                                {sub.subject}: {sub.averageGrade.toFixed(2)}
                              </span>
                            ))
                            : 'Belum ada nilai'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr>
                    <td colSpan={reportType === 'daily' ? 5 : 12} className="px-3 py-10 text-center text-slate-500">
                      Belum ada data untuk filter yang dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {exportMessage && (
            <p role="status" className="mt-3 text-sm text-emerald-700 print:hidden">{exportMessage}</p>
          )}
        </div>
      )}
    </section>
  );
}