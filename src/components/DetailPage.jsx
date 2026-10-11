import { useMemo, useState } from 'react';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function escapeCsv(value) {
  const rawText = String(value ?? '');
  const text = /^[\s]*[=+\-@]/.test(rawText) ? `'${rawText}` : rawText;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadReportCsv(month, rows) {
  const headers = [
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
  const csvRows = rows.map((student) => [
    month,
    student.nis,
    student.name,
    student.className,
    student.sessions,
    student.attendance.Hadir,
    student.attendance.Izin,
    student.attendance.Sakit,
    student.attendance.Alpa,
    student.attendance['Izin kelas lain'],
    student.averageGrade === null ? '' : student.averageGrade.toFixed(2),
    student.subjects
      .map((subject) => `${subject.subject}: ${subject.averageGrade.toFixed(2)}`)
      .join('; '),
  ].map(escapeCsv).join(','));
  const content = `\uFEFF${[headers.map(escapeCsv).join(','), ...csvRows].join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rapor-bulanan-${month}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function DetailPage({ students, onLoadReport }) {
  const [month, setMonth] = useState(currentMonth);
  const [className, setClassName] = useState('');
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const classOptions = useMemo(
    () => [...new Set(students.map((student) => student.className).filter(Boolean))].sort(),
    [students],
  );

  const generateReport = async (event) => {
    event.preventDefault();
    setError('');
    setReport(null);
    setIsLoading(true);
    try {
      const data = await onLoadReport({ month, className });
      setReport(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal mengambil rekap bulanan.');
    } finally {
      setIsLoading(false);
    }
  };

  const monthLabel = month
    ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))
    : '';

  return (
    <section>
      <div className="mb-8 border-b border-slate-200/60 pb-4">
        <h2 className="text-2xl font-bold text-slate-800">Rekap Bulanan & Rapor</h2>
        <p className="mt-1 text-sm text-slate-500">
          Rekap kehadiran dan rata-rata nilai siswa berdasarkan catatan di Google Spreadsheet.
        </p>
      </div>

      <form onSubmit={generateReport} className="glass-card mb-6 flex flex-col gap-4 rounded-2xl border border-white/80 bg-white/70 p-5 shadow-sm sm:flex-row sm:items-end">
        <div className="w-full sm:w-56">
          <label htmlFor="report-month" className="mb-1 block text-xs font-semibold text-slate-600">Bulan</label>
          <input
            id="report-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          />
        </div>
        <div className="w-full sm:w-64">
          <label htmlFor="report-class" className="mb-1 block text-xs font-semibold text-slate-600">Kelas</label>
          <select
            id="report-class"
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">Semua kelas</option>
            {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-60"
        >
          {isLoading ? 'Memuat rekap...' : 'Tampilkan Rekap'}
        </button>
      </form>

      {error && <p role="alert" className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {report && (
        <div className="print-report">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Rapor Bulan {monthLabel}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {className ? `Kelas ${className}` : 'Semua kelas'} · {report.length} siswa dengan catatan
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => downloadReportCsv(month, report)}
                disabled={report.length === 0}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Unduh CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={report.length === 0}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Cetak Rapor
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">No.</th>
                  <th className="px-3 py-3">NIS / Nama Siswa</th>
                  <th className="px-3 py-3">Kelas</th>
                  <th className="px-3 py-3">Pertemuan</th>
                  <th className="px-3 py-3">Hadir</th>
                  <th className="px-3 py-3">Izin</th>
                  <th className="px-3 py-3">Sakit</th>
                  <th className="px-3 py-3">Alpa</th>
                  <th className="px-3 py-3">Izin Kelas Lain</th>
                  <th className="px-3 py-3">Rata-rata Nilai</th>
                  <th className="min-w-56 px-3 py-3">Nilai per Mapel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.map((student, index) => (
                  <tr key={`${student.nis}-${student.className}`} className="align-top text-slate-700">
                    <td className="px-3 py-3">{index + 1}</td>
                    <td className="px-3 py-3">
                      <span className="font-semibold">{student.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{student.nis}</span>
                    </td>
                    <td className="px-3 py-3">{student.className}</td>
                    <td className="px-3 py-3">{student.sessions}</td>
                    <td className="px-3 py-3">{student.attendance.Hadir}</td>
                    <td className="px-3 py-3">{student.attendance.Izin}</td>
                    <td className="px-3 py-3">{student.attendance.Sakit}</td>
                    <td className="px-3 py-3">{student.attendance.Alpa}</td>
                    <td className="px-3 py-3">{student.attendance['Izin kelas lain']}</td>
                    <td className="px-3 py-3 font-semibold">
                      {student.averageGrade === null ? '—' : student.averageGrade.toFixed(2)}
                    </td>
                    <td className="px-3 py-3">
                      {student.subjects.length > 0
                        ? student.subjects.map((subject) => (
                          <span key={subject.subject} className="mb-1 block">
                            {subject.subject}: {subject.averageGrade.toFixed(2)}
                          </span>
                        ))
                        : 'Belum ada nilai'}
                    </td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-4 py-10 text-center text-slate-500">
                      Belum ada data presensi untuk bulan dan kelas ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400 print:hidden">
            Rata-rata dihitung dari nilai yang diisi pada pertemuan yang tersimpan di Spreadsheet.
          </p>
        </div>
      )}
    </section>
  );
}
