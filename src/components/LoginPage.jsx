import { useState } from 'react';

export default function LoginPage({ user, onSignIn, onSignOut }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Gagal masuk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await onSignOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Gagal keluar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-4">
      <div className="glass-card p-8 rounded-3xl shadow-xl border border-white/80 bg-white/80">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-200 text-blue-600 flex items-center justify-center text-2xl shadow-inner">
          🔒
        </div>

        {user ? (
          <>
            <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Pengaturan Akun</h2>
            <p className="text-xs text-slate-500 text-center mb-6">Masuk sebagai {user.email}</p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-60"
            >
              {isSubmitting ? 'Memproses...' : 'Keluar'}
            </button>
            {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Masuk</h2>
            <p className="text-xs text-slate-500 text-center mb-6">Gunakan email akun yang terdaftar di Supabase.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="text-xs font-semibold text-slate-600 block mb-1">Kata Sandi</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-60"
              >
                {isSubmitting ? 'Memproses...' : 'Masuk'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
