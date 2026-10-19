# Presensi PWA

## Supabase setup

1. Install project dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project's API settings.
3. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql) to create the students table and role-aware row-level security policies. Run it again for an existing installation to apply the admin-only write policies.
4. Create admin accounts under **Authentication → Users**. In each admin user's `app_metadata`, set `role` to `admin` (do not use editable `user_metadata`), then have the admin sign out and back in so the new role is included in its session. Every other account has tentor access.
5. Under **Authentication → Providers → Anonymous Sign-Ins**, enable anonymous sign-ins. Tentors can then enter without email/password; Supabase creates a persistent anonymous session on that browser/device. Consider enabling CAPTCHA/rate limits to reduce automated anonymous sign-ins.
6. Restart the Vite development server after changing environment variables.

Only the Supabase publishable/anon key belongs in the frontend environment. Never put a `service_role` key in `.env.local` or client-side code. Signed-in and anonymous tentor sessions can read the shared student roster for attendance and agenda. Only users with the admin role in `app_metadata` can add, edit, or delete student records; the database enforces this through row-level security.

Admins can use every menu, including **Data Siswa**. Tentors (including anonymous sessions) can use **Dashboard**, **Agenda Kelas**, and **Rekap & Laporan** to record attendance, view agendas, and export attendance reports. Anonymous access is a Supabase anonymous session rather than an email account, so it remains on that browser/device until the tentor signs out or clears site storage.

## Google Spreadsheet attendance setup

1. Open the target Google Spreadsheet and choose **Extensions → Apps Script**.
2. Replace the Apps Script editor contents with [`apps-script/Code.gs`](./apps-script/Code.gs) and save. It defines both `doGet` and `doPost`, validates the Supabase session, saves student rows to `Absensi`, saves one meeting summary to `Rekap Pertemuan`, and serves monthly reports.
3. Choose **Deploy → New deployment → Web app**, execute as your account, and allow access to anyone. The endpoint verifies the signed-in Supabase session before writing; do not remove that verification.
4. Copy the deployed `/exec` URL into `VITE_GOOGLE_APPS_SCRIPT_URL` in `.env.local`, then restart the Vite server.
5. After changing `Code.gs`, choose **Deploy → Manage deployments → Edit → New version → Deploy**. The existing `/exec` URL remains usable.

The dashboard appends one row per student to `Absensi`, including meeting information, attendance, grade, and notes, then appends one summary row per meeting to `Rekap Pertemuan`. Both sheets and headers are created if needed. Existing required headers are matched independent of column order and letter case; spaces/punctuation are ignored, and `Mater Dibahas` or `Mater Diabahas` are accepted as alternate spellings for the topic column in `Absensi`. Additional columns are left blank. Student master data remains in Supabase; meeting data is written to Google Spreadsheet.

The app sends the Supabase project URL, publishable/anon key, and current user's access token with each request. Apps Script validates the token against Supabase before reading or writing. Never put a `service_role` key in the frontend or Apps Script. The app's attendance form already sends all meeting fields and student attendance rows; no frontend configuration change is needed.

The **Rekap & Laporan** page reads the selected month and class from `Absensi`, summarizes attendance and average grades (overall and by subject), and supports CSV download and printing.

The **Agenda Kelas** page uses class names from the student roster. It caches each account's class agenda in browser storage, displays cached records immediately, and asks the authenticated `monthlyReport` Apps Script action only for sheet rows added after its saved row marker. It checks for new rows in the background every five minutes while the page is open, and checks again when returning to the tab; background checks do not block the agenda display. It resynchronizes from the beginning if the summary sheet has been reset. The subjects shown are derived from that class's saved meeting records. Deploy the current `apps-script/Code.gs` for this incremental agenda action to work. The cache is local to the browser/device.

To verify the deployment URL before submitting attendance, open it in a browser. It responds with `{"ok":true,"message":"Presensi Spreadsheet API aktif."}`.
