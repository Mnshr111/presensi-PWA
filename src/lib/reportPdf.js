import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function createReportPdf(month, monthLabel, className, rows) {
  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
  pdf.setFontSize(16);
  pdf.text('Rapor Bulanan - ' + monthLabel, 14, 15);
  pdf.setFontSize(10);
  pdf.text('Kelas: ' + (className || 'Semua kelas') + ' | Jumlah siswa: ' + rows.length, 14, 22);

  autoTable(pdf, {
    startY: 28,
    head: [[
      'No.',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Pertemuan',
      'Hadir',
      'Izin',
      'Sakit',
      'Alpa',
      'Izin Kelas Lain',
      'Rata-rata',
      'Nilai per Mapel',
    ]],
    body: rows.map((student, index) => [
      index + 1,
      student.nis,
      student.name,
      student.className,
      student.sessions,
      student.attendance.Hadir,
      student.attendance.Izin,
      student.attendance.Sakit,
      student.attendance.Alpa,
      student.attendance['Izin kelas lain'],
      student.averageGrade === null ? '-' : student.averageGrade.toFixed(2),
      student.subjects.length > 0
        ? student.subjects.map((subject) => `${subject.subject}: ${subject.averageGrade.toFixed(2)}`).join('\n')
        : 'Belum ada nilai',
    ]),
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55] },
    columnStyles: {
      2: { cellWidth: 34 },
      11: { cellWidth: 54 },
    },
    didDrawPage: () => {
      const pageCount = pdf.getNumberOfPages();
      pdf.setFontSize(8);
      pdf.text(
        `Presensi PWA | ${month} | Halaman ${pageCount}`,
        14,
        pdf.internal.pageSize.getHeight() - 7,
      );
    },
  });

  return pdf.output('blob');
}
