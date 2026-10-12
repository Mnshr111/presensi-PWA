export default function StatCard({ label, value, tone, unit }) {
  const toneClasses = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-violet-500',
  };

  return (
    <div className="glass-card p-5 rounded-2xl shadow-sm border border-white/80 flex flex-col justify-between bg-white/80">
      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-extrabold mt-2 ${toneClasses[tone] || 'text-slate-700'}`}>
        {value} <span className="text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
