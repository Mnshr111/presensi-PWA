export default function MobileNav({ currentPage, setCurrentPage }) {
  const menuItems = [
    { key: 'home', icon: '🏠' },
    { key: 'students', icon: '🎓' },
    { key: 'detail', icon: '📊' },
    { key: 'login', icon: '👤' },
  ];

  return (
    <nav aria-label="Navigasi Mobile" className="lg:hidden absolute bottom-4 left-4 right-4 glass-card p-2 rounded-3xl flex justify-around items-center z-30 shadow-xl border border-white/80 bg-white/90">
      {menuItems.map((item) => (
        <button
          key={item.key}
          onClick={() => setCurrentPage(item.key)}
          aria-label={item.key === 'students' ? 'Data Siswa' : item.key === 'home' ? 'Dashboard Utama' : item.key === 'detail' ? 'Rekap dan Laporan' : 'Pengaturan Akun'}
          title={item.key === 'students' ? 'Data Siswa' : undefined}
          className={`p-3 rounded-2xl transition ${
            currentPage === item.key ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500'
          }`}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}
