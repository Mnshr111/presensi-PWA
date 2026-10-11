const RESPONSE_TYPE = 'presensi-attendance-result';
const SHEET_NAME = 'Absensi';
const HEADERS = [
  'Tanggal',
  'Kode Tentor',
  'Nama Tentor',
  'Mata Pelajaran',
  'Materi Dibahas',
  'Materi Selanjutnya',
  'Kelas Pertemuan',
  'NIS',
  'Nama Siswa',
  'Kelas Siswa',
  'Kehadiran',
  'Nilai',
  'Catatan',
  'Waktu Simpan',
];
const ATTENDANCE_VALUES = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Izin kelas lain'];

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Presensi Spreadsheet API aktif.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  const requestId = String(parameters.requestId || '');
  try {
    verifySupabaseSession(
      parameters.accessToken || '',
      parameters.supabaseUrl || '',
      parameters.supabaseAnonKey || '',
    );
    if (parameters.action === 'monthlyReport') {
      const report = getMonthlyReport(parameters.month || '', parameters.className || '');
      return createResponse(requestId, true, '', report);
    }

    const payload = JSON.parse(parameters.payload || '{}');
    validatePayload(payload);
    appendMeeting(payload);
    return createResponse(requestId, true, '', null);
  } catch (error) {
    return createResponse(
      requestId,
      false,
      error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data.',
    );
  }
}

function getMonthlyReport(month, className) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Format bulan rekap tidak valid.');

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Apps Script harus terhubung ke Google Spreadsheet.');
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getDisplayValues();
  const students = new Map();
  rows.forEach((row) => {
    const rowMonth = String(row[0] || '').slice(0, 7);
    const meetingClass = String(row[6] || '').trim();
    if (rowMonth !== month || (className && meetingClass !== className)) return;

    const nis = String(row[7] || '').trim();
    const name = String(row[8] || '').trim();
    const studentClass = String(row[9] || '').trim();
    const attendance = String(row[10] || '').trim();
    if (!nis || !name || !studentClass) return;

    const key = `${nis}:${studentClass}`;
    if (!students.has(key)) {
      students.set(key, {
        nis,
        name,
        className: studentClass,
        sessions: 0,
        attendance: { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0, 'Izin kelas lain': 0 },
        gradeTotal: 0,
        gradeCount: 0,
        subjects: {},
      });
    }

    const summary = students.get(key);
    summary.sessions += 1;
    if (Object.prototype.hasOwnProperty.call(summary.attendance, attendance)) {
      summary.attendance[attendance] += 1;
    }

    const subject = String(row[3] || '').trim();
    const gradeText = String(row[11] || '').trim();
    if (gradeText !== '' && Number.isFinite(Number(gradeText))) {
      const grade = Number(gradeText);
      summary.gradeTotal += grade;
      summary.gradeCount += 1;
      if (subject) {
        if (!summary.subjects[subject]) summary.subjects[subject] = { total: 0, count: 0 };
        summary.subjects[subject].total += grade;
        summary.subjects[subject].count += 1;
      }
    }
  });

  return Array.from(students.values())
    .map((summary) => ({
      nis: summary.nis,
      name: summary.name,
      className: summary.className,
      sessions: summary.sessions,
      attendance: summary.attendance,
      averageGrade: summary.gradeCount ? summary.gradeTotal / summary.gradeCount : null,
      subjects: Object.entries(summary.subjects)
        .map(([subject, values]) => ({
          subject,
          averageGrade: values.total / values.count,
          gradeCount: values.count,
        }))
        .sort((a, b) => a.subject.localeCompare(b.subject)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function verifySupabaseSession(accessToken, supabaseUrl, anonKey) {
  const url = String(supabaseUrl || '').trim().replace(/\/+$/, '');
  const key = String(anonKey || '').trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(url) || !key) {
    throw new Error('Konfigurasi Supabase tidak lengkap. Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada aplikasi.');
  }
  if (!accessToken) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');

  const response = UrlFetchApp.fetch(`${url}/auth/v1/user`, {
    method: 'get',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Sesi login tidak valid atau sudah kedaluwarsa. Silakan masuk kembali.');
  }
}

function validatePayload(payload) {
  const requiredFields = ['date', 'tentorCode', 'tentorName', 'subject', 'className'];
  if (!payload || requiredFields.some((field) => !String(payload[field] || '').trim())) {
    throw new Error('Tanggal, tentor, mata pelajaran, dan kelas wajib diisi.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error('Format tanggal tidak valid.');
  }
  if (!Array.isArray(payload.attendance) || payload.attendance.length === 0 || payload.attendance.length > 200) {
    throw new Error('Daftar siswa kosong atau melebihi batas 200 siswa.');
  }

  payload.attendance.forEach((row) => {
    if (
      !row ||
      !String(row.nis || '').trim() ||
      !String(row.name || '').trim() ||
      !String(row.studentClass || '').trim() ||
      !ATTENDANCE_VALUES.includes(row.attendance)
    ) {
      throw new Error('Data siswa atau pilihan kehadiran tidak valid.');
    }
    if (row.grade !== '' && (!Number.isFinite(Number(row.grade)) || Number(row.grade) < 0 || Number(row.grade) > 100)) {
      throw new Error(`Nilai untuk NIS ${row.nis} harus berada pada rentang 0 sampai 100.`);
    }
  });
}

function appendMeeting(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) throw new Error('Apps Script harus terhubung ke Google Spreadsheet.');

    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }

    const savedAt = new Date();
    const values = payload.attendance.map((row) => [
      payload.date,
      payload.tentorCode,
      payload.tentorName,
      payload.subject,
      payload.topic || '',
      payload.nextTopic || '',
      payload.className,
      row.nis,
      row.name,
      row.studentClass,
      row.attendance,
      row.grade === '' ? '' : Number(row.grade),
      row.note || '',
      savedAt,
    ].map(safeCellValue));

    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, HEADERS.length).setValues(values);
  } finally {
    lock.releaseLock();
  }
}

function safeCellValue(value) {
  if (typeof value !== 'string') return value;
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function createResponse(requestId, ok, error, data) {
  const result = JSON.stringify({
    type: RESPONSE_TYPE,
    requestId,
    ok,
    error,
    data: data === undefined ? null : data,
  }).replace(/</g, '\\u003c');
  const html = "<script>window.top.postMessage(" + result + ", '*');</script>";
  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
