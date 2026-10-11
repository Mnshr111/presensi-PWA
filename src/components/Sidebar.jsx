export default function Sidebar({ currentPage, setCurrentPage }) {
  const menuItems = [
    { key: 'home', label: 'Dashboard Utama', icon: '🏠' },
    { key: 'students', label: 'Data Siswa', icon: '🎓' },
    { key: 'detail', label: 'Rekap & Laporan', icon: '📊' },
    { key: 'login', label: 'Pengaturan Akun', icon: '👤' },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-gradient-to-b from-slate-950 via-slate-800 to-slate-700 p-6 text-white justify-between shadow-2xl h-full">
      <div>
        <div className="flex items-center gap-3 mb-10 pb-4 border-b border-white/20">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-xl border border-white/30 shadow-md">
            🏫
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">Presensi PWA</h1>
            <p className="text-xs text-blue-100 font-medium">Panel Guru & Admin</p>
          </div>
        </div>

        <nav className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setCurrentPage(item.key)}
              className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                currentPage === item.key
                  ? 'bg-white text-blue-600 shadow-lg shadow-black/10'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <span className="text-lg">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white/15 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-xs">
        <p className="font-bold text-white">Sistem Aktif</p>
        <p className="text-emerald-200 font-medium mt-0.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span> Service Worker OK
        </p>
      </div>
    </aside>
  );
}
