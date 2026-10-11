import { useState } from 'react';
import { parseStudentCsv } from '../utils/parseStudentCsv';

const emptyForm = { nis: '', name: '', className: '', school: '' };

export default function StudentDataPage({ students, isLoading, onAddStudent, onImportStudents }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const student = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()]),
    );

    if (Object.values(student).some((value) => !value)) {
      setError('Semua kolom wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!await onAddStudent(student)) {
        setError(`NIS ${student.nis} sudah terdaftar.`);
        return;
      }

      setForm(emptyForm);
      setMessage(`Data ${student.name} berhasil ditambahkan.`);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Gagal menyimpan data siswa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvImport = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      const result = parseStudentCsv(await file.text());
      if (result.errors.length > 0 && result.students.length === 0) {
        setError(result.errors.join(' '));
        return;
      }

      const importResult = await onImportStudents(result.students);
      const details = [
        `${importResult.addedCount} data ditambahkan`,
        importResult.duplicateNis.length > 0
          ? `${importResult.duplicateNis.length} NIS dilewati karena sudah terdaftar`
          : '',
      ].filter(Boolean);
      setMessage(`${details.join('. ')}.`);
      if (result.errors.length > 0) {
        setError(result.errors.join(' '));
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'CSV tidak dapat dibaca.');
    } finally {
      setIsSubmitting(false);
      input.value = '';
    }
  };

  const fields = [
    { key: 'nis', label: 'NIS', placeholder: 'Masukkan NIS' },
    { key: 'name', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
    { key: 'className', label: 'Kelas', placeholder: 'Contoh: 6 SD REG A' },
    { key: 'school', label: 'Asal Sekolah', placeholder: 'Masukkan asal sekolah' },
  ];

  return (
    <section>
      <div className="mb-8 border-b border-slate-200/60 pb-4">
        <h2 className="text-2xl font-bold text-slate-800">Data Siswa</h2>
        <p className="mt-1 text-sm text-slate-500">Tambahkan data siswa secara manual atau impor dari file CSV.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl border border-white/80 bg-white/70 p-6 shadow-sm">
          <h3 className="mb-5 text-lg font-bold text-slate-800">Tambah Manual</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="mb-1 block text-xs font-semibold text-slate-600">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  name={field.key}
                  value={form[field.key]}
                  onChange={updateField}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            ))}
          </div>
          <button type="submit" disabled={isSubmitting || isLoading} className="mt-5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-60">
            {isSubmitting ? 'Menyimpan...' : 'Tambah Siswa'}
          </button>
        </form>

        <div className="glass-card rounded-2xl border border-white/80 bg-white/70 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800">Impor dari CSV</h3>
          <p className="mt-2 text-sm text-slate-500">
            Gunakan judul kolom <span className="font-semibold text-slate-700">NIS, Nama Lengkap, Kelas, Asal Sekolah</span>.
            Data dengan NIS yang sudah ada akan dilewati.
          </p>
          <label htmlFor="student-csv" className="mt-5 inline-flex cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20">
            Pilih File CSV
          </label>
          <input
            id="student-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvImport}
            disabled={isSubmitting || isLoading}
            className="sr-only"
          />
          <p className="mt-3 text-xs text-slate-400">Contoh baris: 1029386, Rina Putri, XII RPL 1, SMK Negeri 1</p>
        </div>
      </div>

      {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Daftar Siswa</h3>
          <span className="text-sm text-slate-500">{students.length} siswa</span>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">NIS</th>
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Asal Sekolah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-slate-500">Memuat data siswa...</td>
                </tr>
              )}
              {!isLoading && students.map((student) => (
                <tr key={student.id} className="text-slate-700">
                  <td className="px-4 py-3">{student.nis}</td>
                  <td className="px-4 py-3 font-medium">{student.name}</td>
                  <td className="px-4 py-3">{student.className}</td>
                  <td className="px-4 py-3">{student.school}</td>
                </tr>
              ))}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-8 text-center text-slate-500">Belum ada data siswa.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
