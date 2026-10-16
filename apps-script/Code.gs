const RESPONSE_TYPE = 'presensi-attendance-result';
const SHEET_NAME = 'Absensi';
const MEETING_SHEET_NAME = 'Rekap Pertemuan';
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
const MEETING_HEADERS = [
  'Tanggal',
  'Kode Tentor',
  'Nama Tentor',
  'Mata Pelajaran',
  'Materi Dibahas',
  'Materi Selanjutnya',
  'Kelas Pertemuan',
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
    const credentials = {
      accessToken: String(parameters.accessToken || ''),
      supabaseUrl: String(parameters.supabaseUrl || ''),
      supabaseAnonKey: String(parameters.supabaseAnonKey || ''),
    };
    verifySupabaseSession(credentials);

    const action = String(parameters.action || 'saveMeeting');
    if (action === 'saveMeeting') {
      const payload = JSON.parse(parameters.payload || '{}');
      validatePayload(payload);
      appendMeeting(payload);
      return createResponse(requestId, true, '', { savedRows: payload.attendance.length });
    }
    if (action === 'monthlyReport') {
      if (String(parameters.reportType || '') === 'agenda') {
        return createResponse(
          requestId,
          true,
          '',
          getClassAgenda({
            className: parameters.className,
            sinceRow: parameters.sinceRow,
          })
        );
      }
      const report = getMonthlyReport({
        month: parameters.month,
        className: parameters.className,
      });
      return createResponse(requestId, true, '', report);
    }
    throw new Error('Aksi tidak dikenal: ' + action);
  } catch (error) {
    return createResponse(
      requestId,
      false,
      error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses permintaan.',
      null
    );
  }
}

function verifySupabaseSession(credentials) {
  if (!credentials.accessToken) {
    throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');
  }
  if (!credentials.supabaseAnonKey) {
    throw new Error('Konfigurasi Supabase aplikasi belum lengkap.');
  }

  const supabaseUrl = credentials.supabaseUrl.replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(supabaseUrl)) {
    throw new Error('URL Supabase harus berupa URL proyek Supabase HTTPS yang valid.');
  }

  const response = UrlFetchApp.fetch(
    supabaseUrl + '/auth/v1/user',
    {
      method: 'get',
      headers: {
        apikey: credentials.supabaseAnonKey,
        Authorization: 'Bearer ' + credentials.accessToken,
      },
      muteHttpExceptions: true,
    }
  );
  if (response.getResponseCode() !== 200) {
    throw new Error('Sesi login tidak valid atau sudah kedaluwarsa. Silakan masuk kembali.');
  }
}

function validatePayload(payload) {
  const requiredFields = ['date', 'tentorCode', 'tentorName', 'subject', 'className'];
  if (
    !payload ||
    requiredFields.some(function (field) {
      return !String(payload[field] || '').trim();
    })
  ) {
    throw new Error('Tanggal, tentor, mata pelajaran, dan kelas wajib diisi.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    throw new Error('Format tanggal tidak valid.');
  }
  if (
    !Array.isArray(payload.attendance) ||
    payload.attendance.length === 0 ||
    payload.attendance.length > 200
  ) {
    throw new Error('Daftar siswa kosong atau melebihi batas 200 siswa.');
  }

  payload.attendance.forEach(function (row) {
    if (
      !row ||
      !String(row.nis || '').trim() ||
      !String(row.name || '').trim() ||
      !String(row.studentClass || '').trim() ||
      ATTENDANCE_VALUES.indexOf(row.attendance) < 0
    ) {
      throw new Error('Data siswa atau pilihan kehadiran tidak valid.');
    }
    if (
      row.grade !== '' &&
      (!Number.isFinite(Number(row.grade)) || Number(row.grade) < 0 || Number(row.grade) > 100)
    ) {
      throw new Error('Nilai untuk NIS ' + row.nis + ' harus berada pada rentang 0 sampai 100.');
    }
  });
}

function appendMeeting(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      throw new Error('Apps Script harus terhubung ke Google Spreadsheet.');
    }

    const attendanceSheet = getOrCreateSheet_(spreadsheet, SHEET_NAME, HEADERS, true);
    const meetingSheet = getOrCreateSheet_(spreadsheet, MEETING_SHEET_NAME, MEETING_HEADERS, false);
    const savedAt = new Date();

    const attendanceRows = payload.attendance.map(function (row) {
      return appendRowByHeaders_(attendanceSheet, HEADERS, [
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
      ], true);
    });
    const meetingRow = appendRowByHeaders_(meetingSheet, MEETING_HEADERS, [
      payload.date,
      payload.tentorCode,
      payload.tentorName,
      payload.subject,
      payload.topic || '',
      payload.nextTopic || '',
      payload.className,
      savedAt,
    ], false);

    attendanceSheet
      .getRange(attendanceSheet.getLastRow() + 1, 1, attendanceRows.length, attendanceSheet.getLastColumn())
      .setValues(attendanceRows);
    meetingSheet
      .getRange(meetingSheet.getLastRow() + 1, 1, 1, meetingSheet.getLastColumn())
      .setValues([meetingRow]);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet_(spreadsheet, sheetName, expectedHeaders, allowTopicHeaderTypo) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
  }

  getHeaderColumnMap_(sheet, expectedHeaders, allowTopicHeaderTypo);
  return sheet;
}

function appendRowByHeaders_(sheet, expectedHeaders, values, allowTopicHeaderTypo) {
  const columnMap = getHeaderColumnMap_(sheet, expectedHeaders, allowTopicHeaderTypo);
  const result = Array(sheet.getLastColumn()).fill('');
  values.forEach(function (value, index) {
    result[columnMap[index]] = safeCellValue(value);
  });
  return result;
}

function getHeaderColumnMap_(sheet, expectedHeaders, allowTopicHeaderTypo) {
  const lastColumn = sheet.getLastColumn();
  const actualHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (header) { return normalizeHeader_(header); });
  const aliases = {
    'Materi Dibahas': allowTopicHeaderTypo
      ? ['materidibahas', 'materdibahas', 'materdiabahas']
      : ['materidibahas'],
  };
  const columnMap = expectedHeaders.map(function (header) {
    const acceptedHeaders = aliases[header] || [normalizeHeader_(header)];
    return actualHeaders.findIndex(function (actualHeader) {
      return acceptedHeaders.indexOf(actualHeader) >= 0;
    });
  });
  const missingHeaders = expectedHeaders.filter(function (_, index) {
    return columnMap[index] < 0;
  });
  if (missingHeaders.length > 0) {
    throw new Error(
      'Header sheet "' + sheet.getName() + '" tidak sesuai. Kolom tidak ditemukan: ' +
      missingHeaders.join(', ') + '. Header terbaca: ' +
      actualHeaders.join(' | ') + '. Periksa ejaan header pada baris pertama.'
    );
  }
  return columnMap;
}

function normalizeHeader_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getMonthlyReport(filters) {
  const month = String(filters.month || '').trim();
  const className = String(filters.className || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Format bulan rekap tidak valid.');
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Apps Script harus terhubung ke Google Spreadsheet.');
  }
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return String(header).trim(); });
  const column = {};
  [
    'Tanggal',
    'Mata Pelajaran',
    'Kelas Pertemuan',
    'NIS',
    'Nama Siswa',
    'Kelas Siswa',
    'Kehadiran',
    'Nilai',
  ].forEach(function (header) {
    column[header] = headers.indexOf(header);
    if (column[header] < 0) {
      throw new Error('Kolom "' + header + '" tidak ditemukan pada sheet Absensi.');
    }
  });

  const students = new Map();
  values.slice(1).forEach(function (row) {
    const date = sheetDate_(row[column['Tanggal']]);
    const meetingClass = String(row[column['Kelas Pertemuan']] || '').trim();
    const studentClass = String(row[column['Kelas Siswa']] || '').trim();
    if (!date || date.slice(0, 7) !== month || (className && meetingClass !== className)) return;

    const nis = String(row[column.NIS] || '').trim();
    const name = String(row[column['Nama Siswa']] || '').trim();
    if (!nis || !name) return;
    const key = nis + '|' + studentClass;
    if (!students.has(key)) {
      students.set(key, {
        nis: nis,
        name: name,
        className: studentClass,
        sessions: 0,
        attendance: {
          Hadir: 0,
          Izin: 0,
          Sakit: 0,
          Alpa: 0,
          'Izin kelas lain': 0,
        },
        gradeTotal: 0,
        gradeCount: 0,
        subjects: new Map(),
      });
    }

    const student = students.get(key);
    student.sessions += 1;
    const attendance = String(row[column.Kehadiran] || '');
    if (Object.prototype.hasOwnProperty.call(student.attendance, attendance)) {
      student.attendance[attendance] += 1;
    }

    const gradeValue = row[column.Nilai];
    if (gradeValue !== '' && gradeValue !== null && Number.isFinite(Number(gradeValue))) {
      const grade = Number(gradeValue);
      student.gradeTotal += grade;
      student.gradeCount += 1;
      const subject = String(row[column['Mata Pelajaran']] || '').trim() || 'Tanpa mata pelajaran';
      const subjectGrades = student.subjects.get(subject) || { total: 0, count: 0 };
      subjectGrades.total += grade;
      subjectGrades.count += 1;
      student.subjects.set(subject, subjectGrades);
    }
  });

  return Array.from(students.values())
    .map(function (student) {
      return {
        nis: student.nis,
        name: student.name,
        className: student.className,
        sessions: student.sessions,
        attendance: student.attendance,
        averageGrade: student.gradeCount
          ? student.gradeTotal / student.gradeCount
          : null,
        subjects: Array.from(student.subjects.entries())
          .map(function (entry) {
            return {
              subject: entry[0],
              averageGrade: entry[1].total / entry[1].count,
            };
          })
          .sort(function (left, right) { return left.subject.localeCompare(right.subject); }),
      };
    })
    .sort(function (left, right) {
      return left.className.localeCompare(right.className) || left.name.localeCompare(right.name);
    });
}

function getClassAgenda(filters) {
  const className = String(filters.className || '').trim();
  if (!className) {
    throw new Error('Kelas wajib dipilih untuk melihat agenda.');
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Apps Script harus terhubung ke Google Spreadsheet.');
  }
  const sheet = spreadsheet.getSheetByName(MEETING_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return { records: [], lastRow: 1 };

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const requestedSinceRow = Number(filters.sinceRow);
  const sinceRow = Number.isInteger(requestedSinceRow) && requestedSinceRow >= 1
    ? Math.min(requestedSinceRow, lastRow)
    : 1;
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const column = {};
  MEETING_HEADERS.forEach(function (header) {
    const aliases = header === 'Materi Dibahas'
      ? ['materidibahas', 'materdibahas', 'materdiabahas']
      : [normalizeHeader_(header)];
    column[header] = headers.findIndex(function (actualHeader) {
      return aliases.indexOf(normalizeHeader_(actualHeader)) >= 0;
    });
    if (column[header] < 0) {
      throw new Error(
        'Kolom "' + header + '" tidak ditemukan pada sheet "' + MEETING_SHEET_NAME + '".'
      );
    }
  });

  if (sinceRow >= lastRow) {
    return { records: [], lastRow: lastRow };
  }

  const rows = sheet.getRange(sinceRow + 1, 1, lastRow - sinceRow, lastColumn).getValues();
  const meetings = [];
  rows.forEach(function (row, index) {
    const meetingClass = String(row[column['Kelas Pertemuan']] || '').trim();
    if (meetingClass !== className) return;

    const date = sheetDate_(row[column.Tanggal]);
    meetings.push({
      id: String(sinceRow + 1 + index),
      rowNumber: sinceRow + 1 + index,
      date: date,
      tentorCode: String(row[column['Kode Tentor']] || ''),
      tentorName: String(row[column['Nama Tentor']] || ''),
      subject: String(row[column['Mata Pelajaran']] || '').trim(),
      topic: String(row[column['Materi Dibahas']] || ''),
      nextTopic: String(row[column['Materi Selanjutnya']] || ''),
      className: meetingClass,
    });
  });

  const records = meetings
    .sort(function (left, right) {
      return right.date.localeCompare(left.date) || right.rowNumber - left.rowNumber;
    })
    .map(function (meeting) {
      const record = Object.assign({}, meeting);
      delete record.rowNumber;
      return record;
    });
  return { records: records, lastRow: lastRow };
}

function sheetDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function safeCellValue(value) {
  if (typeof value !== 'string') return value;
  return /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
}

function createResponse(requestId, ok, error, data) {
  const result = JSON.stringify({
    type: RESPONSE_TYPE,
    requestId: requestId,
    ok: ok,
    error: error,
    data: data === undefined ? null : data,
  }).replace(/</g, '\\u003c');
  const html = '<script>window.top.postMessage(' + result + ', \'*\');</script>';
  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
