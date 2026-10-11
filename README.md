# Presensi PWA

## Supabase setup

1. Install project dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project's API settings.
3. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql) to create the students table and authenticated-only row-level security policies.
4. Create teacher/admin accounts in the Supabase dashboard under **Authentication → Users**. The app uses email and password sign-in; public sign-up is not exposed.
5. Restart the Vite development server after changing environment variables.

Only the Supabase publishable/anon key belongs in the frontend environment. Never put a `service_role` key in `.env.local` or client-side code. Student reads and writes require a signed-in Supabase user.

## Google Spreadsheet attendance setup

1. Open the target Google Spreadsheet and choose **Extensions → Apps Script**.
2. Replace the editor contents with [`apps-script/Code.gs`](./apps-script/Code.gs) and save.
3. Choose **Deploy → New deployment → Web app**, execute as your account, and allow access to anyone. The endpoint verifies the signed-in Supabase session before writing; do not remove that verification.
4. Copy the deployed `/exec` URL into `VITE_GOOGLE_APPS_SCRIPT_URL` in `.env.local`, then restart the Vite server.
5. After changing `Code.gs`, choose **Deploy → Manage deployments → Edit → New version → Deploy**. The existing `/exec` URL remains usable.

The dashboard appends one row per student to an `Absensi` sheet, including meeting information, attendance, grade, and notes. It creates the sheet and header row if needed. Student master data remains in Supabase; meeting attendance is written to Google Spreadsheet.

The app sends its Supabase Project URL and publishable/anon key along with the current user's access token. The anon key is designed for browser use; never use a `service_role` key. Apps Script validates the token against Supabase before writing.

The **Rekap & Laporan** page reads the selected month and class from the same `Absensi` sheet, summarizes attendance and average grades (overall and by subject), and supports CSV download and printing. Redeploy as a new version whenever `Code.gs` changes so the monthly report action is included.

To verify the deployment URL before submitting attendance, open it in a browser. It responds with `{"ok":true,"message":"Presensi Spreadsheet API aktif."}`.
