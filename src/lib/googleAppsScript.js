const responseMessageType = 'presensi-attendance-result';

function postAppsScriptRequest(endpoint, fields) {
  if (!endpoint) {
    return Promise.reject(new Error('URL Google Apps Script belum dikonfigurasi di VITE_GOOGLE_APPS_SCRIPT_URL.'));
  }

  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return Promise.reject(new Error('URL Google Apps Script tidak valid.'));
  }

  if (endpointUrl.protocol !== 'https:') {
    return Promise.reject(new Error('URL Google Apps Script harus menggunakan HTTPS.'));
  }

  return new Promise((resolve, reject) => {
    const requestId = globalThis.crypto.randomUUID();
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const timeout = window.setTimeout(() => finish(new Error('Waktu tunggu Google Apps Script habis.')), 45_000);
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
      form.remove();
      iframe.remove();
    };

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result);
    };

    const handleMessage = (event) => {
      if (event.data?.type !== responseMessageType || event.data?.requestId !== requestId) return;
      if (event.data.ok !== true) {
        finish(new Error(typeof event.data.error === 'string' ? event.data.error : 'Google Apps Script gagal menyimpan data.'));
        return;
      }
      finish(null, event.data.data);
    };

    iframe.name = `presensi-submit-${requestId}`;
    iframe.hidden = true;
    iframe.title = 'Hasil penyimpanan absensi';
    iframe.setAttribute('aria-hidden', 'true');
    form.method = 'POST';
    form.action = endpointUrl.href;
    form.target = iframe.name;
    form.hidden = true;

    Object.entries({ requestId, ...fields }).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = typeof value === 'string' ? value : JSON.stringify(value);
      form.append(input);
    });

    window.addEventListener('message', handleMessage);
    document.body.append(iframe, form);
    form.submit();
  });
}

function authFields({ accessToken, supabaseUrl, supabaseAnonKey }) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Konfigurasi Supabase aplikasi belum lengkap.');
  }
  return { accessToken, supabaseUrl, supabaseAnonKey };
}

export function saveMeetingToAppsScript(endpoint, payload, credentials) {
  return postAppsScriptRequest(endpoint, {
    ...authFields(credentials),
    action: 'saveMeeting',
    payload,
  });
}

export function loadMonthlyReportFromAppsScript(endpoint, filters, credentials) {
  return postAppsScriptRequest(endpoint, {
    ...authFields(credentials),
    action: 'monthlyReport',
    month: filters.month,
    className: filters.className,
  });
}
