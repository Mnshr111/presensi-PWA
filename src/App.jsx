import { useEffect, useState } from 'react';
import DashboardPage from './components/DashboardPage';
import DetailPage from './components/DetailPage';
import LoginPage from './components/LoginPage';
import MobileNav from './components/MobileNav';
import StudentDataPage from './components/StudentDataPage';
import Sidebar from './components/Sidebar';
import { loadMonthlyReportFromAppsScript, saveMeetingToAppsScript } from './lib/googleAppsScript';
import { supabase, supabaseAnonKey, supabaseUrl } from './lib/supabase';

const appsScriptUrl = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL;

function mapStudent(row) {
  return {
    id: row.id,
    nis: row.nis,
    name: row.name,
    className: row.class_name,
    school: row.school,
    status: row.status,
    time: row.time,
  };
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(supabase));
  const authLoading = Boolean(supabase) && isCheckingSession;
  const [authError, setAuthError] = useState('');
  const [siswaList, setSiswaList] = useState([]);
  const [loadedStudentsKey, setLoadedStudentsKey] = useState('');
  const [studentsError, setStudentsError] = useState('');
  const [studentsRefreshToken, setStudentsRefreshToken] = useState(0);
  const userId = session?.user.id;
  const studentsLoadKey = userId ? `${userId}:${studentsRefreshToken}` : '';
  const studentsLoading = Boolean(studentsLoadKey && loadedStudentsKey !== studentsLoadKey);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setIsCheckingSession(false);
      setAuthError('');
      if (event === 'SIGNED_IN') setCurrentPage('home');
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAuthError(error.message);
      setSession(data.session);
      setIsCheckingSession(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return undefined;

    let active = true;
    const loadKey = `${userId}:${studentsRefreshToken}`;

    supabase
      .from('students')
      .select('id, nis, name, class_name, school, status, time')
      .order('name')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStudentsError(error.message);
        } else {
          setSiswaList(data.map(mapStudent));
          setStudentsError('');
        }
        setLoadedStudentsKey(loadKey);
      });

    return () => {
      active = false;
    };
  }, [userId, studentsRefreshToken]);

  const addStudent = async (student) => {
    if (siswaList.some((item) => item.nis === student.nis)) return false;

    const { data, error } = await supabase
      .from('students')
      .insert({
        nis: student.nis,
        name: student.name,
        class_name: student.className,
        school: student.school,
      })
      .select('id, nis, name, class_name, school, status, time')
      .single();

    if (error?.code === '23505') return false;
    if (error) throw new Error(error.message);

    setSiswaList((previous) =>
      [...previous, mapStudent(data)].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return true;
  };

  const importStudents = async (students) => {
    const knownNis = new Set(siswaList.map((student) => student.nis));
    const duplicateNis = [];
    const newStudents = students.filter((student) => {
      if (knownNis.has(student.nis)) {
        duplicateNis.push(student.nis);
        return false;
      }
      knownNis.add(student.nis);
      return true;
    });

    if (newStudents.length === 0) return { addedCount: 0, duplicateNis };

    const { data, error } = await supabase
      .from('students')
      .insert(newStudents.map((student) => ({
        nis: student.nis,
        name: student.name,
        class_name: student.className,
        school: student.school,
      })))
      .select('id, nis, name, class_name, school, status, time');

    if (error) throw new Error(error.message);

    setSiswaList((previous) =>
      [...previous, ...data.map(mapStudent)].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return { addedCount: data.length, duplicateNis };
  };

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  };

  const saveMeeting = async (meeting) => {
    if (!supabase) throw new Error('Konfigurasi Supabase belum tersedia.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');

    await saveMeetingToAppsScript(appsScriptUrl, meeting, {
      accessToken: data.session.access_token,
      supabaseUrl,
      supabaseAnonKey,
    });
  };

  const loadMonthlyReport = async (filters) => {
    if (!supabase) throw new Error('Konfigurasi Supabase belum tersedia.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.');

    return loadMonthlyReportFromAppsScript(appsScriptUrl, filters, {
      accessToken: data.session.access_token,
      supabaseUrl,
      supabaseAnonKey,
    });
  };

  const configurationMessage = !supabase
    ? 'Buat file .env.local dari .env.example, isi URL dan anon key proyek, lalu mulai ulang aplikasi.'
    : '';

  let content;
  if (configurationMessage) {
    content = (
      <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h2 className="mb-2 text-lg font-bold">Supabase belum dikonfigurasi</h2>
        <p>{configurationMessage}</p>
      </div>
    );
  } else if (authLoading) {
    content = <p className="py-8 text-center text-sm text-slate-500">Memeriksa sesi masuk...</p>;
  } else if (authError) {
    content = <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</p>;
  } else if (!session) {
    content = <LoginPage onSignIn={signIn} />;
  } else {
    content = (
      <>
        {studentsError && (
          <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>Gagal memuat atau menyimpan data siswa: {studentsError}</span>
            <button onClick={() => setStudentsRefreshToken((current) => current + 1)} className="font-bold underline">
              Muat ulang data
            </button>
          </div>
        )}
        {currentPage === 'home' && studentsLoading && (
          <p role="status" className="py-8 text-center text-sm text-slate-500">Memuat dashboard dari Supabase...</p>
        )}
        {currentPage === 'home' && !studentsLoading && (
          <DashboardPage
            key={userId}
            userId={userId}
            students={siswaList}
            studentsLoading={studentsLoading}
            onSaveMeeting={saveMeeting}
          />
        )}
        {currentPage === 'detail' && (
          <DetailPage students={siswaList} onLoadReport={loadMonthlyReport} />
        )}
        {currentPage === 'students' && (
          <StudentDataPage
            students={siswaList}
            isLoading={studentsLoading}
            onAddStudent={addStudent}
            onImportStudents={importStudents}
          />
        )}
        {currentPage === 'login' && <LoginPage user={session.user} onSignOut={signOut} />}
      </>
    );
  }

  return (
    <div className="w-screen h-screen flex p-0 m-0 bg-gradient-to-br from-slate-200 via-slate-100 to-white overflow-hidden">
      <div className="w-full h-full bg-slate-50/90 backdrop-blur-2xl flex flex-col lg:flex-row shadow-none border-none">
        {session && <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />}

        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <header className="lg:hidden bg-gradient-to-r from-slate-900 to-slate-700 p-5 text-white shadow-md flex justify-between items-center">
            <div>
              <p className="text-xs text-blue-100">Portal Presensi</p>
              <h1 className="font-bold text-base">Siswa PWA</h1>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold">
              👨‍🏫
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-10 pb-28 lg:pb-8">
            {content}
          </div>

          {session && <MobileNav currentPage={currentPage} setCurrentPage={setCurrentPage} />}
        </main>
      </div>
    </div>
  );
}
