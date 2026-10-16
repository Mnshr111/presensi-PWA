import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CalendarDays, ChevronRight, Users } from 'lucide-react';

const AGENDA_CACHE_VERSION = 1;

function agendaCacheKey(userId, className) {
  return `presensi-class-agenda-v${AGENDA_CACHE_VERSION}:${userId}:${encodeURIComponent(className)}`;
}

function readAgendaCache(userId, className) {
  const cachedValue = localStorage.getItem(agendaCacheKey(userId, className));
  if (!cachedValue) return null;

  const cached = JSON.parse(cachedValue);
  if (
    cached.version !== AGENDA_CACHE_VERSION ||
    !Number.isInteger(cached.lastRow) ||
    cached.lastRow < 1 ||
    !Array.isArray(cached.records) ||
    cached.records.some((record) => (
      !record ||
      typeof record.id !== 'string' ||
      typeof record.className !== 'string' ||
      typeof record.subject !== 'string'
    ))
  ) {
    throw new Error('Cache agenda tidak valid dan perlu disinkronkan ulang.');
  }
  return cached;
}

function normalizeAgendaRecords(records, className) {
  if (!Array.isArray(records)) {
    throw new Error('Format agenda yang diterima dari Google Spreadsheet tidak valid.');
  }
  return records.filter((meeting) => (
    meeting &&
    typeof meeting === 'object' &&
    meeting.className === className &&
    typeof meeting.subject === 'string' &&
    meeting.subject.trim()
  )).map((meeting, index) => ({
    id: String(meeting.id || `${meeting.date || 'agenda'}-${index}`),
    date: typeof meeting.date === 'string' ? meeting.date : '',
    className: meeting.className,
    subject: meeting.subject.trim(),
    tentorName: String(meeting.tentorName || ''),
    tentorCode: String(meeting.tentorCode || ''),
    topic: String(meeting.topic || ''),
    nextTopic: String(meeting.nextTopic || ''),
  }));
}

function compareNewestMeetings(left, right) {
  const dateOrder = right.date.localeCompare(left.date);
  if (dateOrder !== 0) return dateOrder;

  const leftRow = Number(left.id);
  const rightRow = Number(right.id);
  if (Number.isFinite(leftRow) && Number.isFinite(rightRow)) {
    return rightRow - leftRow;
  }
  return right.id.localeCompare(left.id);
}

function formatMeetingDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Tanggal tidak tersedia';
  }
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) {
    return 'Tanggal tidak tersedia';
  }
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

export default function ClassAgendaPage({ userId, students, onLoadAgenda }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [showAllMeetings, setShowAllMeetings] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const requestIdRef = useRef(0);
  const selectedClassRef = useRef('');
  const syncingClassesRef = useRef(new Map());

  const classes = useMemo(
    () => [...new Set(students.map((student) => student.className).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'id-ID'))
      .map((className) => ({
        name: className,
        studentCount: students.filter((student) => student.className === className).length,
      })),
    [students],
  );

  const classSubjects = useMemo(
    () => [...new Set(meetings.map((meeting) => meeting.subject.trim()))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'id-ID')),
    [meetings],
  );
  const subjectMeetings = meetings.filter((meeting) => meeting.subject.trim() === selectedSubject);
  const visibleSubjectMeetings = showAllMeetings ? subjectMeetings : subjectMeetings.slice(0, 3);

  const syncClassAgenda = useCallback((className) => {
    const activeSync = syncingClassesRef.current.get(className);
    if (activeSync) return activeSync;

    const syncPromise = (async () => {
      let cached = null;
      let cacheReadError = false;
      let wasReset = false;
      try {
        cached = readAgendaCache(userId, className);
      } catch (cacheError) {
        console.warn('Cache agenda tidak dapat dibaca; agenda akan dimuat ulang.', cacheError);
        cacheReadError = true;
      }

      let response = await onLoadAgenda(className, cached?.lastRow || 1);
      if (
        !response ||
        typeof response !== 'object' ||
        !Array.isArray(response.records) ||
        !Number.isInteger(response.lastRow) ||
        response.lastRow < 1
      ) {
        throw new Error('Respons sinkronisasi agenda dari Spreadsheet tidak valid.');
      }
      if (cached && response.lastRow < cached.lastRow) {
        response = await onLoadAgenda(className, 1);
        if (
          !response ||
          typeof response !== 'object' ||
          !Array.isArray(response.records) ||
          !Number.isInteger(response.lastRow) ||
          response.lastRow < 1
        ) {
          throw new Error('Respons sinkronisasi ulang agenda dari Spreadsheet tidak valid.');
        }
        cached = null;
        wasReset = true;
      }

      const newMeetings = normalizeAgendaRecords(response.records, className);
      const mergedMeetings = new Map((cached?.records || []).map((meeting) => [meeting.id, meeting]));
      newMeetings.forEach((meeting) => mergedMeetings.set(meeting.id, meeting));
      const records = [...mergedMeetings.values()].sort(compareNewestMeetings);
      const cache = {
        version: AGENDA_CACHE_VERSION,
        lastRow: response.lastRow,
        records,
      };
      try {
        localStorage.setItem(agendaCacheKey(userId, className), JSON.stringify(cache));
      } catch (cacheError) {
        console.error('Cache agenda gagal disimpan ke penyimpanan browser.', cacheError);
        throw new Error('Agenda berhasil dimuat, tetapi cache browser tidak dapat diperbarui.', { cause: cacheError });
      }

      return {
        records,
        newCount: newMeetings.length,
        wasReset,
        cacheReadError,
      };
    })().finally(() => {
      syncingClassesRef.current.delete(className);
    });
    syncingClassesRef.current.set(className, syncPromise);
    return syncPromise;
  }, [onLoadAgenda, userId]);

  const openClass = async (className) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    selectedClassRef.current = className;
    setSelectedClass(className);
    setSelectedSubject('');
    setShowAllMeetings(false);
    setError('');
    setSyncMessage('');
    let cached = null;
    let cacheReadError = false;
    try {
      cached = readAgendaCache(userId, className);
      setMeetings(cached?.records || []);
    } catch (cacheError) {
      console.warn('Cache agenda tidak dapat dibaca; agenda akan dimuat ulang.', cacheError);
      setMeetings([]);
      cacheReadError = true;
    }
    setIsLoading(!cached);
    try {
      const result = await syncClassAgenda(className);
      if (requestId !== requestIdRef.current) return;
      setMeetings(result.records);
      setError('');
      if (result.wasReset) {
        setSyncMessage('Data agenda disinkronkan ulang karena sheet diperbarui.');
      } else if (result.cacheReadError || cacheReadError) {
        setSyncMessage('Agenda terbaru berhasil dimuat.');
      } else if (cached) {
        setSyncMessage(result.newCount > 0
          ? `${result.newCount} agenda baru disinkronkan.`
          : 'Agenda sudah terbaru.');
      } else {
        setSyncMessage(`${result.records.length} agenda dimuat dan disimpan ke cache.`);
      }
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        cached
          ? `Sinkronisasi gagal. Menampilkan agenda tersimpan. ${loadError instanceof Error ? loadError.message : ''}`
          : `${cacheReadError ? 'Cache agenda tidak dapat dibaca. ' : ''}${loadError instanceof Error ? loadError.message : 'Gagal memuat agenda dari Spreadsheet.'}`,
      );
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (classes.length === 0) return undefined;
    let active = true;

    const syncAllClasses = async () => {
      if (!active || document.visibilityState !== 'visible') return;
      await Promise.all(classes.map(async ({ name }) => {
        try {
          const result = await syncClassAgenda(name);
          if (active && selectedClassRef.current === name) {
            setMeetings(result.records);
            setError('');
          }
        } catch (syncError) {
          console.warn(`Sinkronisasi agenda latar untuk kelas ${name} gagal.`, syncError);
          if (active && selectedClassRef.current === name) {
            setSyncMessage('Pemeriksaan data baru di latar gagal. Agenda tersimpan tetap ditampilkan.');
          }
        }
      }));
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncAllClasses();
    };

    void syncAllClasses();
    const intervalId = window.setInterval(() => void syncAllClasses(), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [classes, syncClassAgenda]);

  const backToClasses = () => {
    requestIdRef.current += 1;
    selectedClassRef.current = '';
    setSelectedClass('');
    setSelectedSubject('');
    setShowAllMeetings(false);
    setMeetings([]);
    setError('');
    setSyncMessage('');
  };

  return (
    <section>
      <div className="mb-8 border-b border-slate-200/60 pb-4">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
          <CalendarDays size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Agenda Kelas</h2>
        <p className="mt-1 text-sm text-slate-500">
          {selectedClass
            ? `Pilih mata pelajaran yang tercatat untuk kelas ${selectedClass}.`
            : 'Pilih kelas untuk melihat agenda berdasarkan mata pelajaran.'}
        </p>
      </div>

      {selectedClass ? (
        <div>
          <button
            type="button"
            onClick={backToClasses}
            className="mb-5 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <ArrowLeft size={16} />
            Semua Kelas
          </button>

          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
              <Users size={21} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Agenda untuk kelas</p>
              <h3 className="font-bold text-slate-800">{selectedClass}</h3>
            </div>
          </div>

          {isLoading && (
            <p role="status" className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-slate-600">
              {meetings.length > 0
                ? 'Agenda tersimpan ditampilkan. Memeriksa data baru...'
                : 'Memuat agenda dari Google Spreadsheet...'}
            </p>
          )}
          {!isLoading && syncMessage && (
            <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {syncMessage}
            </p>
          )}
          {error && (
            <p role="alert" className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {classSubjects.map((subject, index) => (
              <Fragment key={subject}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubject(selectedSubject === subject ? '' : subject);
                    setShowAllMeetings(false);
                  }}
                  disabled={isLoading}
                  aria-expanded={selectedSubject === subject}
                  aria-controls={selectedSubject === subject ? `agenda-subject-${index}` : undefined}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60 ${
                    selectedSubject === subject
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-white/80 bg-white/85 text-slate-800'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    selectedSubject === subject
                      ? 'bg-white/15 text-white'
                      : index % 3 === 0
                        ? 'bg-cyan-50 text-cyan-700'
                        : index % 3 === 1
                          ? 'bg-violet-50 text-violet-600'
                          : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    <BookOpen size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{subject}</span>
                    <span className={`mt-0.5 block text-xs ${
                      selectedSubject === subject ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      {meetings.filter((meeting) => meeting.subject.trim() === subject).length} pertemuan
                    </span>
                  </span>
                  <ChevronRight
                    size={18}
                    className={`text-slate-400 transition-transform ${selectedSubject === subject ? 'rotate-90 text-white' : ''}`}
                  />
                </button>

                {selectedSubject === subject && (
                  <section
                    id={`agenda-subject-${index}`}
                    aria-label={`Agenda ${selectedSubject} kelas ${selectedClass}`}
                    className="col-span-full rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm sm:p-5"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="font-bold text-slate-800">{selectedSubject} · {selectedClass}</h4>
                      <span className="text-xs text-slate-500">{subjectMeetings.length} pertemuan</span>
                    </div>
                    {subjectMeetings.length > 0 ? (
                      <ol className="space-y-3">
                        {visibleSubjectMeetings.map((meeting, meetingIndex) => (
                          <li
                            key={`${meeting.id || `${meeting.date}-${meeting.tentorCode}`}-${meetingIndex}`}
                            className="rounded-2xl border border-white/80 bg-white p-4 shadow-sm sm:p-5"
                          >
                            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                              <div>
                                <p className="text-sm font-bold text-slate-800">{formatMeetingDate(meeting.date)}</p>
                                <p className="mt-1 text-xs text-slate-500">{meeting.subject} · {meeting.className}</p>
                              </div>
                              <div className="rounded-xl bg-sky-50 px-3 py-2 text-right text-xs text-slate-600">
                                <p className="font-bold text-slate-800">{meeting.tentorName || 'Tentor tidak dicatat'}</p>
                                {meeting.tentorCode && <p>Kode: {meeting.tentorCode}</p>}
                              </div>
                            </div>
                            <dl className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Materi dibahas</dt>
                                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{meeting.topic || 'Tidak dicatat'}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Materi selanjutnya</dt>
                                <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{meeting.nextTopic || 'Belum ditentukan'}</dd>
                              </div>
                            </dl>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                        Belum ada agenda untuk mata pelajaran ini.
                      </p>
                    )}
                    {subjectMeetings.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllMeetings((showAll) => !showAll)}
                        className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        {showAllMeetings
                          ? 'Tampilkan lebih sedikit'
                          : `Tampilkan semua (${subjectMeetings.length - 3} lainnya)`}
                      </button>
                    )}
                  </section>
                )}
              </Fragment>
            ))}
          </div>

          {!isLoading && !error && classSubjects.length === 0 && (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              Belum ada data pertemuan untuk kelas ini di sheet Rekap Pertemuan.
            </p>
          )}
        </div>
      ) : classes.length > 0 ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800">Pilih Kelas</h3>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500">
              {classes.length} kelas
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {classes.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onClick={() => openClass(item.name)}
                className="group rounded-2xl border border-white/80 bg-white/85 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-cyan-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    index % 3 === 0
                      ? 'bg-cyan-50 text-cyan-700'
                      : index % 3 === 1
                        ? 'bg-violet-50 text-violet-600'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    <Users size={23} />
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {item.studentCount} siswa
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-800">{item.name}</h4>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Lihat mata pelajaran</span>
                  <ChevronRight size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-cyan-700" />
                </div>
              </button>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-slate-400">
            Daftar kelas mengikuti data siswa. Riwayat pertemuan dan mapel dibaca dari sheet Rekap Pertemuan.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <Users size={22} />
          </div>
          <h3 className="font-bold text-slate-800">Belum ada kelas</h3>
          <p className="mt-1 text-sm text-slate-500">
            Tambahkan data siswa terlebih dahulu untuk menampilkan kelas di sini.
          </p>
        </div>
      )}
    </section>
  );
}
