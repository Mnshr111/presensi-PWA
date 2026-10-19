import { useState } from 'react';
import { parseStudentCsv } from '../utils/parseStudentCsv';

const emptyForm = { nis: '', name: '', className: '', school: '' };

export default function StudentDataPage({
  students,
  isLoading,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteAllStudents,
  onImportStudents,
}) {
  const [form, setForm] = useState(emptyForm);
  const [editingStudentId, setEditingStudentId] = useState('');
  const [editForm, setEditForm] = useState(emptyForm);
  const [studentSearch, setStudentSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const startEditing = (student) => {
    setEditingStudentId(student.id);
    setEditForm({
      nis: student.nis,
      name: student.name,
      className: student.className,
      school: student.school,
    });
    setMessage('');
    setError('');
  };

  const cancelEditing = () => {
    setEditingStudentId('');
    setEditForm(emptyForm);
  };

  const handleEditField = (event) => {
    setEditForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleUpdateStudent = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    const student = Object.fromEntries(
      Object.entries(editForm).map(([key, value]) => [key, value.trim()]),
    );

    if (Object.values(student).some((value) => !value)) {
      setError('Semua kolom data siswa wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!await onUpdateStudent(editingStudentId, student)) {
        setError(`NIS ${student.nis} sudah digunakan siswa lain.`);
        return;
      }

      setMessage(`Data ${student.name} berhasil diperbarui.`);
      cancelEditing();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal memperbarui data siswa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = (student) => {
    setMessage('');
    setError('');
    setDeleteConfirmation({ type: 'student', student });
  };

  const handleDeleteAllStudents = () => {
    setMessage('');
    setError('');
    setDeleteConfirmation({ type: 'all' });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    setIsSubmitting(true);
    try {
      if (deleteConfirmation.type === 'all') {
        await onDeleteAllStudents();
        setStudentSearch('');
        cancelEditing();
        setMessage('Semua data siswa berhasil dihapus. Daftar baru dapat ditambahkan untuk tahun ajaran berikutnya.');
      } else {
        await onDeleteStudent(deleteConfirmation.student.id);
        if (editingStudentId === deleteConfirmation.student.id) cancelEditing();
        setMessage(`Data ${deleteConfirmation.student.name} berhasil dihapus.`);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : deleteConfirmation.type === 'all'
            ? 'Gagal menghapus semua data siswa.'
            : 'Gagal menghapus data siswa.',
      );
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmation(null);
    }
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
  const searchQuery = studentSearch.trim().toLocaleLowerCase('id-ID');
  const filteredStudents = searchQuery
    ? students.filter((student) =>
      [student.nis, student.name, student.className, student.school]
        .some((value) => value.toLocaleLowerCase('id-ID').includes(searchQuery)),
    )
    : students;

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
                  className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                />
              </div>
            ))}
          </div>
          <button type="submit" disabled={isSubmitting || isLoading} className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60">
            {isSubmitting ? 'Menyimpan...' : 'Tambah Siswa'}
          </button>
        </form>

        <div className="glass-card rounded-2xl border border-white/80 bg-white/70 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800">Impor dari CSV</h3>
          <p className="mt-2 text-sm text-slate-500">
            Gunakan judul kolom <span className="font-semibold text-slate-700">NIS, Nama Lengkap, Kelas, Asal Sekolah</span>.
            Data dengan NIS yang sudah ada akan dilewati.
          </p>
          <label htmlFor="student-csv" className="mt-5 inline-flex cursor-pointer rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800">
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
          <p className="mt-3 text-xs text-slate-400">Contoh baris: 1029386, Rina Putri, 12 SMA REG A, SMA Negeri 1 Jakarta</p>
        </div>
      </div>

      {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirmation-title"
            aria-describedby="delete-confirmation-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 id="delete-confirmation-title" className="text-lg font-bold text-slate-900">
              Konfirmasi penghapusan
            </h3>
            <p id="delete-confirmation-description" className="mt-3 text-sm leading-6 text-slate-600">
              {deleteConfirmation.type === 'all'
                ? `Anda akan menghapus semua ${students.length} data siswa dari Data base. Daftar ini digunakan bersama dan akan terhapus untuk semua pengguna.`
                : `Anda akan menghapus data ${deleteConfirmation.student.name} (NIS ${deleteConfirmation.student.nis}) dari Data base.`}
              {' '}Tindakan ini tidak dapat dibatalkan. Lanjutkan?
            </p>
            <div className="mt-6 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isSubmitting}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-60"
              >
                {isSubmitting ? 'Menghapus...' : 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800">Daftar Siswa</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500">
              {searchQuery ? `${filteredStudents.length} dari ${students.length} siswa` : `${students.length} siswa`}
            </span>
            <button
              type="button"
              onClick={handleDeleteAllStudents}
              disabled={isSubmitting || isLoading || students.length === 0}
              className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Menghapus...' : 'Hapus Semua'}
            </button>
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="student-search" className="sr-only">Cari siswa</label>
          <input
            id="student-search"
            type="search"
            value={studentSearch}
            onChange={(event) => setStudentSearch(event.target.value)}
            placeholder="Cari berdasarkan NIS, nama, kelas, atau asal sekolah..."
            className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 sm:max-w-md"
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-sky-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">NIS</th>
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Asal Sekolah</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">Memuat data siswa...</td>
                </tr>
              )}
              {!isLoading && filteredStudents.map((student) => {
                const isEditing = editingStudentId === student.id;
                return (
                  <tr key={student.id} className="text-slate-700">
                    {isEditing ? (
                      <>
                        {fields.map((field) => (
                          <td key={field.key} className="px-2 py-3">
                            <input
                              aria-label={`${field.label} ${student.name}`}
                              name={field.key}
                              value={editForm[field.key]}
                              onChange={handleEditField}
                              className="w-full min-w-28 rounded-lg border border-sky-100 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
                              required
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleUpdateStudent}
                              disabled={isSubmitting}
                              className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              disabled={isSubmitting}
                              className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                            >
                              Batal
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">{student.nis}</td>
                        <td className="px-4 py-3 font-medium">{student.name}</td>
                        <td className="px-4 py-3">{student.className}</td>
                        <td className="px-4 py-3">{student.school}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditing(student)}
                              disabled={isSubmitting}
                              className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(student)}
                              disabled={isSubmitting}
                              className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">Belum ada data siswa.</td>
                </tr>
              )}
              {!isLoading && students.length > 0 && filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                    Tidak ada siswa yang cocok dengan pencarian “{studentSearch.trim()}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
