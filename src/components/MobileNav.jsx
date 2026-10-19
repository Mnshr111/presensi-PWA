import { Home, Users, CalendarDays, BarChart3, UserCog } from 'lucide-react';

export default function MobileNav({ currentPage, setCurrentPage, isAdmin }) {
  const menuItems = [
    { key: 'home', icon: Home, label: 'Dashboard' },
    { key: 'students', icon: Users, label: 'Siswa' },
    { key: 'agenda', icon: CalendarDays, label: 'Agenda' },
    { key: 'detail', icon: BarChart3, label: 'Laporan' },
    { key: 'login', icon: UserCog, label: 'Akun' },
  ].filter((item) => isAdmin || item.key !== 'students');

  return (
    <nav 
      aria-label="Navigasi Mobile" 
      className="lg:hidden fixed bottom-6 left-6 right-6 backdrop-blur-xl bg-white/75 p-2 rounded-full flex justify-around items-center z-30 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60"
    >
      {menuItems.map((item) => {
        const isActive = currentPage === item.key;
        const IconComponent = item.icon;

        return (
          <button
            key={item.key}
            onClick={() => setCurrentPage(item.key)}
            aria-label={item.label}
            className={`relative flex items-center justify-center py-3 px-3 sm:px-5 rounded-full transition-all duration-300 ease-out ${
              isActive
                ? 'bg-black text-white shadow-md shadow-black/20 scale-105'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <IconComponent size={20} strokeWidth={isActive ? 2.5 : 2} />
          </button>
        );
      })}
    </nav>
  );
}