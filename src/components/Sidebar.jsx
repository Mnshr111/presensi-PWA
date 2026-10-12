export default function Sidebar({ currentPage, setCurrentPage }) {
  const menuItems = [
    { key: 'home', label: 'Dashboard Utama', icon: '🏠' },
    { key: 'students', label: 'Data Siswa', icon: '🎓' },
    { key: 'detail', label: 'Rekap & Laporan', icon: '📊' },
    { key: 'login', label: 'Pengaturan Akun', icon: '👤' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-white p-6 text-slate-800 justify-between shadow-2xl h-full border-r border-slate-200">
      <div>
        {/* Bagian Header / Logo */}
        <div className="flex items-center gap-3 mb-10 pb-4 border-b border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-bold text-xl border border-slate-200 shadow-md">
            🏫
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight text-slate-900">Presensi PWA</h1>
            <p className="text-xs text-slate-500 font-medium">Panel Guru & Admin</p>
          </div>
        </div>

        {/* Menu Navigasi */}
        <nav className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setCurrentPage(item.key)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                currentPage === item.key
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Bagian Status di Bawah */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
        <p className="font-bold text-slate-900">Sistem Aktif</p>
        <p className="text-emerald-600 font-medium mt-0.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Service Worker OK
        </p>
      </div>
    </aside>
  );
}