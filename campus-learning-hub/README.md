# Campus Learning Hub

A React + Vite educational dashboard with Supabase Auth/database and an n8n webhook chat integration.

## Features

- Student signup/login with name, email, password, school and class (1st–10th)
- Mock signup confirmation screen
- Teacher material publishing and management
- Student dashboard filtered by the student's class
- Campus AI chat wired to an n8n webhook
- Responsive layouts and Supabase Row Level Security policies
- Local preview mode when Supabase is not configured

## 1. Requirements

- Node.js 20+ recommended
- A Supabase project
- An n8n webhook configured to accept a JSON POST (for AI chat)

## 2. Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Fill `.env` with your Supabase project URL, anon key, and n8n webhook URL. Restart Vite after changing environment variables.

If signup reports that the email rate limit was exceeded, Supabase has temporarily limited outgoing auth emails. Wait before retrying; for a demo, disable email confirmation in Supabase Authentication settings, or configure custom SMTP and review your project's email limits for production.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_N8N_WEBHOOK_URL=https://YOUR_N8N_HOST/webhook/YOUR_WEBHOOK_ID
```

Only the Supabase anon/publishable key belongs in frontend variables. Never expose a Supabase `service_role` key.

## 3. Set up Supabase

1. Open Supabase Dashboard → SQL Editor.
2. Run `supabase/schema.sql`.
3. In Authentication → Providers / Email, disable **Confirm email** if you want signups to sign in immediately. The app's confirmation page is only a mock UI; it does not send or verify email.
4. Set up a trusted teacher account before production. The frontend demo bypass (`admin@gmail.com` / `admin`) is intentionally not a secure production login and does not satisfy the SQL admin JWT policy.
5. For production, create a real Supabase Auth user for the teacher and set `app_metadata.role = "admin"` using a trusted server-side Admin API or Supabase Dashboard. Never grant admin via user-editable metadata or expose service-role keys in the browser.
6. To enable the Google sign-in button, configure the Google provider under Authentication → Sign In / Providers with your Google OAuth client ID and secret. Add your app URL to Supabase's redirect URL allow list (for local preview, `http://127.0.0.1:4173/login`). In your Google OAuth client, add `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback` as an authorized redirect URI, replacing `YOUR_PROJECT_ID` with the Supabase project reference.

### Important profile / admin notes

- Students can insert their own profile with role `student`; students cannot create an admin profile through the provided insert policy.
- Admin policies rely on the signed JWT `app_metadata.role` claim.
- For a real teacher login, configure that account in Supabase Auth and set the trusted app metadata. You should then replace the demo bypass branch in `src/App.jsx` with regular Supabase Auth sign-in for the teacher.
- Supabase RLS policies are the real data boundary. UI routing alone is not security.

## 4. Configure n8n

Set `VITE_N8N_WEBHOOK_URL` to your n8n Webhook node's production URL and activate the workflow. An inactive workflow returns 404 for production webhook calls. A simple workflow:

1. **Webhook** node: POST, response mode configured to return the final result.
2. **LLM / AI Agent** node: use the incoming `message` or `chatInput` field as the student question.
3. **Respond to Webhook** node: return JSON such as:

```json
{ "output": "Here is a simple explanation..." }
```

For browser requests, set the Webhook node's **Allowed Origins (CORS)** to the app's origin (for local preview, `http://127.0.0.1:4173`; for deployment, the deployed site's origin). Activate the workflow and use its **Production URL**.

The app sends:

```json
{
  "message": "Explain fractions",
  "chatInput": "Explain fractions",
  "student": { "name": "Student Name", "school": "School", "class": "5" },
  "history": []
}
```

The chat accepts common response keys: `output`, `response`, `answer`, `text`, or `message`. Configure appropriate CORS on your n8n host if it is on another origin. Do not send sensitive student information to external AI workflows without appropriate permission and safeguards.

## 5. Admin demo credentials

- Open `/teacher-login` or use **Teacher access** on the student sign-in page.
- Email: `admin@gmail.com`
- Password: `123456`

**Demo only:** this is a client-side bypass, not secure authentication. Anyone who can inspect the frontend can discover the credentials, and it does not provide trusted Supabase admin claims. Do not deploy this bypass publicly. Replace it with real Supabase Auth credentials and trusted `app_metadata.role` before production.

## 6. Build

```bash
npm run build
npm run preview
```

## Project layout

```text
campus-learning-hub/
├── src/
│   ├── lib/
│   │   ├── classes.js
│   │   └── supabase.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   └── schema.sql
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
└── vite.config.js
```
