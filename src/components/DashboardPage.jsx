import { useMemo, useState } from 'react';

const attendanceOptions = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Izin kelas lain'];
const subjectOptions = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'IPA',
  'IPS',
  'Fisika',
  'Kimia',
  'Biologi',
  'Matematika Lanjut',
  'Sejarah',
  'Geografi',
  'Ekonomi',
  'Sosilogi',
  'PKN',


];

const DRAFT_VERSION = 1;

function todayLocalDate() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-600';

function createEmptyDraft() {
  return {
    meeting: {
      date: todayLocalDate(),
      tentorCode: '',
      tentorName: '',
      subject: '',
      customSubject: '',
      topic: '',
      nextTopic: '',
      className: '',
    },
    additionalStudentIds: [],
    attendanceById: {},
  };
}

function readDraft(userId) {
  if (!userId) return { draft: createEmptyDraft(), warning: '' };
  try {
    const cached = localStorage.getItem(`presensi-meeting-draft-v${DRAFT_VERSION}:${userId}`);
    if (!cached) return { draft: createEmptyDraft(), warning: '' };

    const parsed = JSON.parse(cached);
    if (
      parsed.version !== DRAFT_VERSION ||
      !parsed.draft ||
      typeof parsed.draft.meeting !== 'object' ||
      parsed.draft.meeting === null ||
      Array.isArray(parsed.draft.meeting) ||
      !Array.isArray(parsed.draft.additionalStudentIds) ||
      typeof parsed.draft.attendanceById !== 'object' ||
      parsed.draft.attendanceById === null ||
      Array.isArray(parsed.draft.attendanceById)
    ) {
      console.warn('Draft presensi diabaikan karena format cache tidak valid.');
      return { draft: createEmptyDraft(), warning: 'Cache draft tidak valid dan tidak dapat dipulihkan.' };
    }

    const emptyDraft = createEmptyDraft();
    return {
      draft: {
        meeting: { ...emptyDraft.meeting, ...parsed.draft.meeting },
        additionalStudentIds: parsed.draft.additionalStudentIds,
        attendanceById: parsed.draft.attendanceById,
      },
      warning: '',
    };
  } catch (error) {
    console.warn('Draft presensi tidak dapat dipulihkan dari penyimpanan browser.', error);
    return {
      draft: createEmptyDraft(),
      warning: 'Draft sebelumnya tidak dapat dipulihkan dari penyimpanan browser.',
    };
  }
}

export default function DashboardPage({ userId, students, onSaveMeeting, studentsLoading }) {
  const [initialDraft] = useState(() => readDraft(userId));
  const [draft, setDraft] = useState(initialDraft.draft);
  const [studentSearch, setStudentSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draftWarning, setDraftWarning] = useState(initialDraft.warning);
  const { meeting, additionalStudentIds, attendanceById } = draft;

  const updateDraft = (patch) => {
    const updated = { ...draft, ...patch };
    setDraft(updated);
    try {
      localStorage.setItem(
        `presensi-meeting-draft-v${DRAFT_VERSION}:${userId}`,
        JSON.stringify({ version: DRAFT_VERSION, draft: updated }),
      );
      setDraftWarning('');
    } catch (storageError) {
      console.error('Draft presensi gagal disimpan ke penyimpanan browser.', storageError);
      setDraftWarning('Draft tidak dapat disimpan di browser ini. Jangan tutup halaman sebelum menyalin data.');
    }
  };

  const classOptions = useMemo(
    () => [...new Set(students.map((student) => student.className).filter(Boolean))].sort(),
    [students],
  );
  const classStudents = useMemo(
    () => students.filter((student) => student.className === meeting.className),
    [students, meeting.className],
  );
  const includedIds = useMemo(
    () => new Set([...classStudents.map((student) => student.id), ...additionalStudentIds]),
    [classStudents, additionalStudentIds],
  );
  const participants = useMemo(
    () => students.filter((student) => includedIds.has(student.id)),
    [students, includedIds],
  );
  const availableStudents = students.filter((student) => !includedIds.has(student.id));
  const matchingStudents = availableStudents.filter((student) => {
    const query = studentSearch.trim().toLocaleLowerCase('id-ID');
    if (!query) return false;
    return [student.name, student.nis, student.className, student.school]
      .some((value) => value.toLocaleLowerCase('id-ID').includes(query));
  }).slice(0, 8);

  const updateMeeting = (event) => {
    const { name, value } = event.target;
    const updatedValue = name === 'tentorCode' || name === 'tentorName'
      ? value.toLocaleUpperCase('id-ID')
      : value;
    updateDraft({ meeting: { ...meeting, [name]: updatedValue } });
    setError('');
    setMessage('');
  };

  const addStudent = (studentId) => {
    updateDraft({
      additionalStudentIds: additionalStudentIds.includes(studentId)
        ? additionalStudentIds
        : [...additionalStudentIds, studentId],
    });
    setStudentSearch('');
  };

  const removeAdditionalStudent = (studentId) => {
    updateDraft({
      additionalStudentIds: additionalStudentIds.filter((id) => id !== studentId),
    });
  };

  const updateAttendance = (studentId, field, value) => {
    updateDraft({
      attendanceById: {
        ...attendanceById,
        [studentId]: {
          attendance: 'Hadir',
          grade: '',
          note: '',
          ...attendanceById[studentId],
          [field]: value,
        },
      },
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const subject = meeting.subject === 'Lainnya' ? meeting.customSubject.trim() : meeting.subject;
    if (!meeting.date || !meeting.tentorCode.trim() || !meeting.tentorName.trim() || !subject || !meeting.className) {
      setError('Lengkapi tanggal, kode tentor, nama tentor, mata pelajaran, dan kelas.');
      return;
    }
    if (meeting.subject === 'Lainnya' && !subject) {
      setError('Isi mata pelajaran lainnya.');
      return;
    }
    if (participants.length === 0) {
      setError('Tidak ada siswa di kelas ini. Tambahkan siswa dari data siswa terlebih dahulu.');
      return;
    }

    const rows = participants.map((student) => {
      const record = attendanceById[student.id] || {};
      return {
        nis: student.nis,
        name: student.name,
        studentClass: student.className,
        attendance: record.attendance || 'Hadir',
        grade: record.grade === '' || record.grade === undefined ? '' : Number(record.grade),
        note: (record.note || '').trim(),
      };
    });

    if (rows.some((row) => row.grade !== '' && (!Number.isFinite(row.grade) || row.grade < 0 || row.grade > 100))) {
      setError('Nilai harus berupa angka dari 0 sampai 100.');
      return;
    }

    setIsSaving(true);
    try {
      await onSaveMeeting({
        date: meeting.date,
        tentorCode: meeting.tentorCode.trim().toLocaleUpperCase('id-ID'),
        tentorName: meeting.tentorName.trim().toLocaleUpperCase('id-ID'),
        subject,
        topic: meeting.topic.trim(),
        nextTopic: meeting.nextTopic.trim(),
        className: meeting.className,
        attendance: rows,
      });
      setDraft(createEmptyDraft());
      try {
        localStorage.removeItem(`presensi-meeting-draft-v${DRAFT_VERSION}:${userId}`);
        setDraftWarning('');
      } catch (storageError) {
        console.error('Draft tersimpan tetapi cache browser gagal dihapus.', storageError);
        setDraftWarning('Presensi berhasil disimpan, tetapi cache draft browser gagal dihapus.');
      }
      setStudentSearch('');
      setMessage(`Pertemuan berhasil disimpan ke Spreadsheet (${rows.length} siswa).`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan pertemuan.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section>
      <div className="mb-8 border-b border-slate-200/60 pb-4">
        <h2 className="text-2xl font-bold text-slate-800">Dashboard Pertemuan</h2>
        <p className="mt-1 text-sm text-slate-500">Isi materi dan absensi kelas, lalu simpan ke Google Spreadsheet.</p>
        <p className="mt-2 text-xs text-slate-500">
          Draft disimpan otomatis di browser perangkat ini sampai presensi berhasil dikirim ke Spreadsheet.
        </p>
      </div>

      {studentsLoading && (
        <p role="status" className="mb-5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Memuat data siswa...
        </p>
      )}
      {draftWarning && (
        <p role="alert" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {draftWarning}
        </p>
      )}

      <form onSubmit={handleSave}>
        <div className="glass-card mb-6 rounded-2xl border border-white/80 bg-white/70 p-6 shadow-sm">
          <h3 className="mb-5 text-lg font-bold text-slate-800">Informasi Pertemuan</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="meeting-date">Tanggal</label>
              <input id="meeting-date" name="date" type="date" value={meeting.date} onChange={updateMeeting} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="tentor-code">Kode Tentor</label>
              <input id="tentor-code" name="tentorCode" value={meeting.tentorCode} onChange={updateMeeting} placeholder="Contoh: MNS" className={inputClass} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="tentor-name">Nama Tentor</label>
              <input id="tentor-name" name="tentorName" value={meeting.tentorName} onChange={updateMeeting} placeholder="Nama tentor" className={inputClass} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="meeting-subject">Mata Pelajaran</label>
              <select id="meeting-subject" name="subject" value={meeting.subject} onChange={updateMeeting} className={inputClass} required>
                <option value="">Pilih mata pelajaran</option>
                {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </div>
            {meeting.subject === 'Lainnya' && (
              <div>
                <label className={labelClass} htmlFor="custom-subject">Mata Pelajaran Lainnya</label>
                <input id="custom-subject" name="customSubject" value={meeting.customSubject} onChange={updateMeeting} placeholder="Masukkan mata pelajaran" className={inputClass} required />
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="meeting-class">Pilih Kelas</label>
              <select id="meeting-class" name="className" value={meeting.className} onChange={updateMeeting} className={inputClass} required disabled={studentsLoading}>
                <option value="">Pilih kelas</option>
                {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
              <label className={labelClass} htmlFor="meeting-topic">Materi yang Dibahas</label>
              <textarea id="meeting-topic" name="topic" value={meeting.topic} onChange={updateMeeting} rows="2" className={inputClass} placeholder="Tuliskan materi pertemuan ini" />
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
              <label className={labelClass} htmlFor="meeting-next-topic">Materi Selanjutnya</label>
              <textarea id="meeting-next-topic" name="nextTopic" value={meeting.nextTopic} onChange={updateMeeting} rows="2" className={inputClass} placeholder="Tuliskan rencana materi pertemuan berikutnya" />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-white/80 bg-white/70 p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Daftar Kehadiran</h3>
              <p className="mt-1 text-sm text-slate-500">
                {meeting.className ? `Kelas ${meeting.className} · ${participants.length} siswa` : 'Pilih kelas untuk menampilkan siswa.'}
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <label htmlFor="additional-student-search" className="sr-only">Cari siswa untuk ditambahkan</label>
              <input
                id="additional-student-search"
                type="search"
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder={meeting.className ? 'Cari nama, NIS, atau kelas siswa...' : 'Pilih kelas terlebih dahulu'}
                className={inputClass}
                disabled={!meeting.className || availableStudents.length === 0}
                autoComplete="off"
              />
              {meeting.className && studentSearch.trim() && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {matchingStudents.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => addStudent(student.id)}
                        className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                      >
                        <span className="block text-sm font-semibold text-slate-800">{student.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          NIS {student.nis} · Kelas {student.className}
                        </span>
                      </button>
                    </li>
                  ))}
                  {matchingStudents.length === 0 && (
                    <li className="px-3 py-3 text-sm text-slate-500">Siswa tidak ditemukan.</li>
                  )}
                  {matchingStudents.length === 8 && (
                    <li className="px-3 py-2 text-xs text-slate-400">Hasil dibatasi 8 siswa. Perjelas pencarian.</li>
                  )}
                </ul>
              )}
              {meeting.className && availableStudents.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">Semua siswa sudah ada di daftar presensi.</p>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="w-14 px-3 py-3">No.</th>
                  <th className="px-3 py-3">Nama Siswa</th>
                  <th className="px-3 py-3">Kehadiran</th>
                  <th className="w-28 px-3 py-3">Nilai (0–100)</th>
                  <th className="px-3 py-3">Catatan</th>
                  <th className="w-20 px-3 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participants.map((student, index) => {
                  const record = attendanceById[student.id] || {};
                  const isAdditional = additionalStudentIds.includes(student.id);
                  return (
                    <tr key={student.id} className="text-slate-700">
                      <td className="px-3 py-3">{index + 1}</td>
                      <td className="px-3 py-3">
                        <span className="font-medium">{student.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{student.nis} · {student.className}</span>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          aria-label={`Kehadiran ${student.name}`}
                          value={record.attendance || 'Hadir'}
                          onChange={(event) => updateAttendance(student.id, 'attendance', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                        >
                          {attendanceOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Nilai ${student.name}`}
                          type="number"
                          min="0"
                          max="100"
                          value={record.grade ?? ''}
                          onChange={(event) => updateAttendance(student.id, 'grade', event.target.value)}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-2"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          aria-label={`Catatan ${student.name}`}
                          value={record.note || ''}
                          onChange={(event) => updateAttendance(student.id, 'note', event.target.value)}
                          className="w-full min-w-40 rounded-lg border border-slate-200 px-2 py-2"
                          placeholder="Catatan"
                        />
                      </td>
                      <td className="px-3 py-3">
                        {isAdditional && (
                          <button type="button" onClick={() => removeAdditionalStudent(student.id)} className="font-semibold text-rose-600 hover:underline">
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {participants.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                      {meeting.className ? 'Belum ada siswa di kelas ini.' : 'Pilih kelas untuk memuat daftar siswa.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={isSaving || studentsLoading} className="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-60">
              {isSaving ? 'Menyimpan ke Spreadsheet...' : 'Simpan Pertemuan'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
