import { useState } from 'react';

export default function LoginPage({
  user,
  isAnonymous = false,
  role = 'tentor',
  profile,
  profileLoading = false,
  profileError = '',
  onSaveProfile,
  onSignIn,
  onSignOut,
  onAnonymousSignIn,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [tentorCode, setTentorCode] = useState(profile?.tentor_code || '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      await onSaveProfile({ displayName, tentorCode });
      setMessage('Profil berhasil disimpan.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan profil.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-4">
      <div className="glass-card p-8 rounded-3xl shadow-xl border border-white/80 bg-white/80">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-2xl shadow-inner">
          🔒
        </div>

        {user ? (
          <>
            <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Profil & Akun</h2>
            <p className="text-xs text-slate-500 text-center mb-4">
              {isAnonymous ? 'Profil tentor tanpa akun login.' : `Masuk sebagai ${user.email || 'pengguna'}`}
            </p>
            <div className="mb-5 rounded-xl bg-cyan-50 px-4 py-3 text-center text-sm font-semibold text-cyan-900">
              Role: {role === 'admin' ? 'Admin' : 'Tentor'}
            </div>
            {profileLoading ? (
              <p role="status" className="py-4 text-center text-sm text-slate-500">Memuat profil...</p>
            ) : (
              <form onSubmit={handleSaveProfile} className="mb-5 space-y-4">
                <div>
                  <label htmlFor="profile-display-name" className="mb-1 block text-xs font-semibold text-slate-600">
                    Nama Lengkap
                  </label>
                  <input
                    id="profile-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    maxLength={120}
                    className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  />
                </div>
                {role !== 'admin' && (
                  <div>
                    <label htmlFor="profile-tentor-code" className="mb-1 block text-xs font-semibold text-slate-600">
                      Kode Tentor
                    </label>
                    <input
                      id="profile-tentor-code"
                      value={tentorCode}
                      onChange={(event) => setTentorCode(event.target.value)}
                      maxLength={50}
                      className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || profileLoading}
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </form>
            )}
            {profileError && <p role="alert" className="mb-4 text-sm text-rose-700">Gagal memuat profil: {profileError}</p>}
            {message && <p role="status" className="mb-4 text-sm text-emerald-700">{message}</p>}
            {error && <p role="alert" className="mb-4 text-sm text-rose-700">{error}</p>}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-black text-white font-bold text-sm shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
            >
              {isSubmitting ? 'Memproses...' : isAnonymous ? 'Keluar dari sesi tentor' : 'Keluar'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-800 text-center mb-1">Masuk</h2>
            <p className="text-xs text-slate-500 text-center mb-6">
              Admin masuk dengan email. Tentor dapat melanjutkan tanpa akun dengan akses terbatas.
            </p>

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
                  className="w-full py-3 px-4 rounded-xl bg-white border border-sky-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
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
                  className="w-full py-3 px-4 rounded-xl bg-white border border-sky-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-black text-white font-bold text-sm shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
              >
                {isSubmitting ? 'Memproses...' : 'Masuk'}
              </button>
            </form>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              atau
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <button
              type="button"
              onClick={async () => {
                setError('');
                setIsSubmitting(true);
                try {
                  await onAnonymousSignIn();
                } catch (signInError) {
                  setError(signInError instanceof Error ? signInError.message : 'Gagal masuk sebagai tentor.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
            >
              {isSubmitting ? 'Memproses...' : 'Masuk sebagai Tentor (Tanpa Akun)'}
            </button>
            {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
