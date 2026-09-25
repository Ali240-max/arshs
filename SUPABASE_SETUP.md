# Supabase setup guide

This takes about 20 minutes. At the end you will have:

- a Supabase database with all tables, security rules and default categories
- two logins: **Finance Secretary** (controls everything) and **President** (sees everything, changes nothing)
- the app running on your laptop and on Vercel

Supabase renames menu items from time to time. If a label below doesn't match exactly, look for the closest one.

---

## 1. Create the project

1. Go to https://supabase.com and sign in.
2. Click **New project**.
3. Name: `arshs-finance`. Pick the region closest to Pakistan (Mumbai `ap-south-1` if offered, otherwise Singapore).
4. Set a strong database password and save it in your password manager. You rarely need it, but you can't see it again.
5. Wait 1 to 2 minutes for the project to start.

## 2. Create the database

Open **SQL Editor** in the left menu. Run these four files **in this order**. For each one: open the file from the `supabase/migrations/` folder, copy everything, paste into a new query, click **Run**.

| Order | File | What it does |
|---|---|---|
| 1 | `20260924000001_schema.sql` | Tables, views, society settings |
| 2 | `20260924000002_security.sql` | Roles and row-level security |
| 3 | `20260924000003_functions.sql` | Functions that record money, receipt numbers, audit log |
| 4 | `20260924000004_default_categories.sql` | Donation, expense and aid categories |

Each should end with "Success. No rows returned". If one fails, don't run the next. Read the error, fix it, and re-run that file on a fresh project if needed.

If you use the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push` runs all four.

## 3. Lock down sign-ups

Only the two officers should ever have accounts.

1. Go to **Authentication → Sign In / Providers**.
2. Turn **off** "Allow new users to sign up".
3. Keep the **Email** provider on.

Anyone who finds your site can't create an account now. You create accounts yourself in the next step.

## 4. Create the two logins

Go to **Authentication → Users → Add user → Create new user**. Do this twice:

| Account | Email | Tick |
|---|---|---|
| Finance Secretary | your real email | Auto Confirm User |
| President | the President's email | Auto Confirm User |

Use strong passwords (12+ characters). Send the President their password privately, not in a group chat.

## 5. Give each login its role

Every new account starts as a plain `member`, which can't see any money. Promote both in the **SQL Editor** (replace the emails):

```sql
update public.profiles
   set role = 'finance_secretary', full_name = 'Ali Farooqi'
 where email = 'finance@example.com';

update public.profiles
   set role = 'president', full_name = 'President Name'
 where email = 'president@example.com';

-- check
select full_name, email, role from public.profiles;
```

This only works from the SQL Editor. Inside the app, the President can't change roles, and nobody can promote themselves.

## 6. Set the opening balance and society details

The balance is worked out as **opening balance + money in − expenses − aid**. Set the opening balance to the cash the society actually held on the day you start using the app:

```sql
update public.society_settings
   set opening_balance      = 18500,          -- cash in hand + bank on the start date
       opening_balance_date = '2026-10-01',   -- the day you start recording in the app
       society_name         = 'Adeeb Rizvi Serving Humanity Society',
       subtitle             = 'Finance Office',
       receipt_footer       = 'Thank you for supporting our welfare work. This receipt is valid only with both signatures.'
 where id = 1;
```

Don't back-date entries before `opening_balance_date`. Those amounts are already inside the opening balance.

## 7. Connect the app on your laptop

1. In Supabase, open **Project Settings → API** (or **API Keys**) and copy:
   - **Project URL**, like `https://abcdxyz.supabase.co`
   - **anon / publishable key**, the long key marked safe for the browser
2. In the project folder, copy `.env.example` to `.env.local` and fill it:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

3. Restart the dev server (`Ctrl+C`, then `npm run dev`). Env changes only load on start.
4. Open http://localhost:3000. The demo buttons disappear and the top bar shows **Live**. Sign in with the Finance account.

**Never** put the `service_role` / secret key in `.env.local` or anywhere in the frontend. It bypasses every security rule.

## 8. Test the permissions (5 minutes, do it once)

Signed in as **Finance Secretary**:

- [ ] Create an event, add a vendor, collect a payment, print the slip
- [ ] Record a donation and an expense
- [ ] The balance on the dashboard changes by the right amount

Signed in as **President** (use a private window):

- [ ] Dashboard and events show the same numbers
- [ ] Top bar shows **View only**, and there is no Record button, no Edit, no Collect, no Add vendor
- [ ] Opening a transaction shows no Void or Edit buttons

Hidden buttons are only the surface. The database itself refuses every write from the President: recording money, voiding, creating or editing events, vendors, settings, team or roles. The only row a President session adds is its own entry in the audit log ("signed in", "printed receipt"), so you can see who looked at what.

## 9. Deploy on Vercel

1. Push the project to a **private** GitHub repo. `.env.local` is already in `.gitignore`, so keys don't get uploaded.
2. Go to https://vercel.com → **Add New → Project** → import the repo. Framework is detected as Next.js.
3. Before clicking Deploy, open **Environment Variables** and add the same two:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. You get a URL like `arshs-finance.vercel.app`.
5. If you change an env var later, go to **Deployments → Redeploy**. Vercel doesn't pick up changes on its own.

## 10. Tell Supabase your site address

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL**: `https://arshs-finance.vercel.app` (your real Vercel URL)
- **Redirect URLs**: add the same URL and `http://localhost:3000`

This is used for password reset emails.

## 11. Day-to-day admin

**Forgot password:** Supabase → Authentication → Users → click the user → **Send password recovery**.

**Handing over to a new Finance Secretary:**

```sql
-- after creating their account in step 4
update public.profiles set role = 'finance_secretary' where email = 'new@example.com';
update public.profiles set role = 'member'            where email = 'old@example.com';
```

Then delete or ban the old account in Authentication → Users. Their past entries stay in the ledger under their name.

**Where the history is:** every change is written to `audit_logs`. To read the last 50 actions:

```sql
select created_at, actor_name, action, summary from public.audit_logs order by id desc limit 50;
```

## 12. Demo data vs real data

- The demo data you played with lives only in your browser. It does **not** move to Supabase.
- `supabase/seed.sql` loads the same demo data into a database. Use it only on a separate **test** project, never on the real one. It expects users `finance@arshs.demo` and `president@arshs.demo` to exist first, with roles set as in step 5.
- To start fresh on the real project, skip the seed. Steps 1 to 6 are all you need.

## 13. Security notes

- **The anon key is meant to be public.** Anyone can see it in the browser. That is fine, because row-level security decides what each logged-in user can read or write.
- **Money is never deleted.** A wrong entry is voided with a reason. It stays visible and stops counting toward totals.
- **Receipt numbers** (VR-2026-0001, DR-2026-0001) come from the database, so two people can't get the same number.
- **Free plan pauses** a project after about a week with no activity. Open the app at least weekly, or restore it from the Supabase dashboard if it pauses. Your data is kept.
- **Backups:** the free plan has limited backups. Once a month, go to **Database → Backups**, or run `supabase db dump` and keep the file somewhere safe. For a society's accounts, this is worth the 2 minutes.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| Login works but shows "No access" | The role is still `member`. Run step 5. |
| "Only the Finance Secretary can record money" | You're signed in as the President, or step 5 wasn't run. |
| Still shows demo login buttons | `.env.local` missing or the dev server wasn't restarted. On Vercel, env vars missing or no redeploy. |
| "Invalid login credentials" | Wrong password, or the user wasn't auto-confirmed. Tick **Auto Confirm** or confirm them in Authentication → Users. |
| Forms show no categories | Migration 4 wasn't run. |
| A vendor payment is refused | The amount is more than the vendor still owes. Check the booking's day fees. |
