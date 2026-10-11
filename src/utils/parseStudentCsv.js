function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && character === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (!inQuotes && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (inQuotes) throw new Error('CSV memiliki tanda kutip yang tidak berpasangan.');

  row.push(field.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(header) {
  return header
    .toLocaleLowerCase('id-ID')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function parseStudentCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const firstLine = cleanText.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = parseRows(cleanText, delimiter);

  if (rows.length < 2) {
    return { students: [], errors: ['CSV harus berisi judul kolom dan minimal satu data siswa.'] };
  }

  const headers = rows[0].map(normalizeHeader);
  const headerAliases = {
    nis: ['nis'],
    name: ['namalengkap', 'nama'],
    className: ['kelas'],
    school: ['asalsekolah', 'sekolahasal', 'sekolah'],
  };
  const columnIndexes = Object.fromEntries(
    Object.entries(headerAliases).map(([key, aliases]) => [
      key,
      headers.findIndex((header) => aliases.includes(header)),
    ]),
  );
  const missingHeaders = Object.entries(columnIndexes)
    .filter(([, index]) => index === -1)
    .map(([key]) => ({ nis: 'NIS', name: 'Nama Lengkap', className: 'Kelas', school: 'Asal Sekolah' })[key]);

  if (missingHeaders.length > 0) {
    return {
      students: [],
      errors: [`Kolom wajib tidak ditemukan: ${missingHeaders.join(', ')}.`],
    };
  }

  const students = [];
  const errors = [];
  const seenNis = new Set();

  rows.slice(1).forEach((row, index) => {
    const student = {
      nis: row[columnIndexes.nis] || '',
      name: row[columnIndexes.name] || '',
      className: row[columnIndexes.className] || '',
      school: row[columnIndexes.school] || '',
    };
    const rowNumber = index + 2;
    const missingValues = Object.entries(student)
      .filter(([, value]) => !value)
      .map(([key]) => ({ nis: 'NIS', name: 'Nama Lengkap', className: 'Kelas', school: 'Asal Sekolah' })[key]);

    if (missingValues.length > 0) {
      errors.push(`Baris ${rowNumber}: ${missingValues.join(', ')} wajib diisi.`);
    } else if (seenNis.has(student.nis)) {
      errors.push(`Baris ${rowNumber}: NIS ${student.nis} duplikat di dalam file.`);
    } else {
      seenNis.add(student.nis);
      students.push(student);
    }
  });

  return { students, errors };
}
