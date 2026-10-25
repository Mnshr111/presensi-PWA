import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function createReportPdf(reportType, monthLabel, className, rows) {
  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // 1. Palet Warna Pastel
  const colorBgSoft = [252, 249, 244];       // Latar belakang krem pastel hangat
  const colorTextDark = [45, 55, 72];        // Warna teks gelap utama
  const colorTextMuted = [113, 128, 150];    // Teks sekunder/abu-abu
  const colorBorder = [232, 224, 212];       // Garis batas tabel pastel

  // Latar Belakang Halaman Penuh
  const applyBackground = () => {
    pdf.setFillColor(colorBgSoft[0], colorBgSoft[1], colorBgSoft[2]);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  // Terapkan background awal di halaman 1
  applyBackground();

  // 2. Header Kiri: Judul & Subjudul
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(colorTextDark[0], colorTextDark[1], colorTextDark[2]);
  pdf.text('Laporan Presensi Siswa', 14, 15);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
  pdf.text(
    reportType === 'daily'
      ? 'Rekap kehadiran harian siswa'
      : 'Rekap kehadiran dan nilai siswa',
    14,
    21,
  );

  pdf.setFillColor(221, 234, 254);
  pdf.roundedRect(14, 25, 110, 6, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(30, 64, 175);
  pdf.text(`Periode ${monthLabel.toUpperCase()}`, 17, 29);
  if (className) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(colorTextMuted[0], colorTextMuted[1], colorTextMuted[2]);
    pdf.text(`Kelas ${className}`, 128, 29);
  }

  autoTable(pdf, {
    startY: 34,
    margin: { left: 14, right: 14, top: 34, bottom: 15 }, // Batasan margin yang jelas
    head: [reportType === 'daily' ? [
      'No.',
      'Tanggal',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Kehadiran',
      'Catatan',
    ] : [
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
      'Lain',
      'Rata-rata',
      'Nilai per Mapel',
    ]],
    body: reportType === 'daily' ? rows.map((student, index) => [
      index + 1,
      student.date || '-',
      student.nis || '-',
      student.name || '-',
      student.className || '-',
      student.status || '-',
      student.note || '-',
    ]) : rows.map((student, index) => [
      index + 1,
      student.nis || '-',
      student.name || '-',
      student.className || '-',
      student.sessions || 0,
      student.attendance?.Hadir || 0,
      student.attendance?.Izin || 0,
      student.attendance?.Sakit || 0,
      student.attendance?.Alpa || 0,
      student.attendance?.['Izin kelas lain'] || 0,
      '-',
      student.averageGrade === null ? '-' : student.averageGrade.toFixed(2),
      student.subjects && student.subjects.length > 0
        ? student.subjects.map((subject) => `${subject.subject}: ${subject.averageGrade.toFixed(2)}`).join('\n')
        : 'Belum ada nilai',
    ]),
    styles: { 
      fontSize: 6.5, 
      cellPadding: 2, 
      overflow: 'linebreak',
      textColor: [45, 55, 72],
      lineColor: colorBorder,
      lineWidth: 0.15,
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        const headerPastelMap = {
          0: [226, 232, 240],  // No
          1: [254, 226, 226],  // NIS
          2: [254, 215, 215],  // Nama Siswa
          3: [221, 234, 254],  // Kelas
          4: [230, 242, 255],  // Pertemuan
          5: [198, 246, 213],  // Hadir
          6: [254, 235, 226],  // Izin
          7: [254, 215, 215],  // Sakit
          8: [237, 242, 247],  // Alpa
          9: [221, 214, 254],  // Izin Kelas Lain
          10: [237, 233, 254], // Lain
          11: [254, 243, 199], // Rata-rata
          12: [254, 226, 226], // Nilai per Mapel
        };
        if (headerPastelMap[data.column.index]) {
          data.cell.styles.fillColor = headerPastelMap[data.column.index];
        }
      }
    },
    headStyles: { 
      textColor: [45, 55, 72], 
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    // Penyesuaian lebar kolom agar pas dan tidak terpotong di kanan
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 20 },
      2: { cellWidth: 40, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', cellWidth: 12 },
      9: { halign: 'center', cellWidth: 20 },
      10: { halign: 'center', cellWidth: 12 },
      11: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      12: { cellWidth: 'auto' }, // Biarkan otomatis menyesuaikan sisa lebar halaman
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    // Gunakan willDrawPage untuk mewarnai background halaman baru SEBELUM konten tabel digambar
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        applyBackground();
      }
    },
    // Handler untuk footer/nomor halaman
    didDrawPage: (data) => {
      const pageCount = pdf.getNumberOfPages();
      pdf.setFontSize(8);
      pdf.setTextColor(113, 128, 150);
      pdf.text(
        `Laporan Presensi | ${monthLabel} — Halaman ${data.pageNumber} dari ${pageCount}`,
        14,
        pageHeight - 6,
      );
      pdf.text('Presensi Siswa', pageWidth - 35, pageHeight - 6);
    },
  });

  return pdf.output('blob');
}