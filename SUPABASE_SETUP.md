# Supabase setup guide

This takes about 20 minutes. At the end you will have:

- a Supabase database with all tables, security rules and default categories
- your **Finance** login (controls everything), plus as many **Finance** and **View only** logins as you need, created from the app
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

Open **SQL Editor** in the left menu. Run these six files **in this order**. For each one: open the file from the `supabase/migrations/` folder, copy everything, paste into a new query, click **Run**.

| Order | File | What it does |
|---|---|---|
| 1 | `20260924000001_schema.sql` | Tables, views, society settings |
| 2 | `20260924000002_security.sql` | Roles and row-level security |
| 3 | `20260924000003_functions.sql` | Functions that record money, receipt numbers, audit log |
| 4 | `20260924000004_default_categories.sql` | Donation, expense and aid categories |
| 5 | `20260925000005_delete_transactions.sql` | Lets Finance delete a transaction (keeps a copy in the audit log) |
| 6 | `20260926000006_accounts_and_event_delete.sql` | Several Finance / View-only accounts, and deleting events |

Each should end with "Success. No rows returned". If one fails, don't run the next. Read the error, fix it, and re-run that file on a fresh project if needed.

If you use the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push` runs all six.

## 3. Lock down sign-ups

Only the two officers should ever have accounts.

1. Go to **Authentication → Sign In / Providers**.
2. Turn **off** "Allow new users to sign up".
3. Keep the **Email** provider on.

Anyone who finds your site can't create an account now. You create accounts yourself in the next step.

## 4. Create your first login

This first account has to be made in Supabase. Every other account is created from the app later (step 11).

Go to **Authentication → Users → Add user → Create new user**:

- Email: your real email
- Password: 12+ characters
- Tick **Auto Confirm User**

## 5. Make it a Finance account

Every new login starts with **No access**. Give yours full access in the **SQL Editor** (replace the email and name):

```sql
update public.profiles
   set role = 'finance_secretary', full_name = 'Ali Farooqi'
 where email = 'you@example.com';

-- check
select full_name, email, role from public.profiles;
```

This is the only time you need SQL for accounts. What the role names mean:

| Role in the database | Shown in the app | Can do |
|---|---|---|
| `finance_secretary` | Finance · full access | Everything: record, edit, delete, accounts, settings |
| `president` | View only | See every page and number. Change nothing |
| `member` | No access | Sign in, see nothing |

## 6. Set the opening balance and society details

The balance is worked out as **opening balance + money in − expenses − aid**. The easiest way: once the app is connected (step 7), open **Settings** and fill in **Starting balance** and **Society details**. Or do it now in SQL:

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
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

The third key is the **service_role / secret** key from the same page. The app needs it only to create new logins from the Accounts page. It is read on the server, never sent to the browser.

3. Restart the dev server (`Ctrl+C`, then `npm run dev`). Env changes only load on start.
4. Open http://localhost:3000. The demo buttons disappear and the top bar shows **Live**. Sign in with the Finance account.

**Never** give the service_role key a `NEXT_PUBLIC_` prefix, paste it into code, or share it. With that prefix it would be sent to every visitor's browser, and it bypasses every security rule. The name must be exactly `SUPABASE_SERVICE_ROLE_KEY`.

## 8. Test the permissions (5 minutes, do it once)

Signed in with your **Finance** account:

- [ ] Create an event, add a vendor, collect a payment, print the slip
- [ ] Record a donation and an expense
- [ ] Open Settings and check the starting balance
- [ ] The balance on the dashboard changes by the right amount

Create a **View only** account on the Accounts page, then sign in with it in a private window:

- [ ] Dashboard and events show the same numbers
- [ ] Top bar shows **View only**, and there is no Record button, no Edit, no Collect, no Add vendor
- [ ] Opening a transaction shows no Void or Edit buttons

Hidden buttons are only the surface. The database itself refuses every write from the President: recording money, voiding, creating or editing events, vendors, settings, team or roles. The only row a President session adds is its own entry in the audit log ("signed in", "printed receipt"), so you can see who looked at what.

## 9. Deploy on Vercel

1. Push the project to a **private** GitHub repo. `.env.local` is already in `.gitignore`, so keys don't get uploaded.
2. Go to https://vercel.com → **Add New → Project** → import the repo. Framework is detected as Next.js.
3. Before clicking Deploy, open **Environment Variables** and add the same three:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Vercel keeps it server-side because it has no `NEXT_PUBLIC_` prefix)
4. Click **Deploy**. You get a URL like `arshs-finance.vercel.app`.
5. If you change an env var later, go to **Deployments → Redeploy**. Vercel doesn't pick up changes on its own.

## 10. Tell Supabase your site address

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL**: `https://arshs-finance.vercel.app` (your real Vercel URL)
- **Redirect URLs**: add the same URL and `http://localhost:3000`

This is used for password reset emails.

## 11. Day-to-day admin

**New accounts (President, auditor, another Finance person):** in the app, open **Accounts → New account**. Choose **View only** or **Finance · full access**, enter name, email and a password (or tap Generate), and send them the details privately. No SQL needed.

**Change or remove access:** Accounts page, pick a new level from the dropdown next to the person. **No access** locks them out; their past entries stay in the ledger under their name. You can't change your own access, and the last Finance account can't be removed, so you can't lock everyone out.

**Forgot password:** Supabase → Authentication → Users → click the user → **Send password recovery**.

**Deleting an event:** open the event → **Delete**. It removes the event with all its transactions, stall bookings and receipts, after you type the event name to confirm. One summary line stays in the activity log.

**Where the history is:** every change is written to `audit_logs`. To read the last 50 actions:

```sql
select created_at, actor_name, action, summary from public.audit_logs order by id desc limit 50;
```

## 12. Test with demo data, then wipe it

Two files in `supabase/demo/` let you try everything on the live database:

| File | What it does |
|---|---|
| `demo_load.sql` | Adds 11 events, 27 vendors, 36 stall bookings and about 170 transactions. Every demo code starts with `DEMO-` |
| `demo_wipe.sql` | Removes all of it, plus anything you recorded against demo events or demo vendors while testing |

1. Finish steps 1 to 5 first (the load needs your Finance account; demo entries are credited to it).
2. SQL Editor → paste `demo_load.sql` → **Run**. The last line should show `demo_events = 11`. Refresh the app.
3. Test freely: collect payments, delete things, print slips and reports.
4. SQL Editor → paste `demo_wipe.sql` → **Run**. The last line should show three zeros. Refresh the app.

Things to know:

- Your real events, vendors and transactions are never touched by either file. This was tested with real entries in the same database: after the wipe, the real balance, entries and settings were exactly as before.
- The load temporarily sets the opening balance to the demo value (PKR 18,500 from 1 Aug 2025). The wipe puts your own settings back.
- Payments you record during testing use real receipt numbers (VR-2026-0001 and so on). The wipe removes those entries, so your real numbering will start a few numbers higher. Nothing breaks; there is just a gap.
- Accounts you create while testing are real logins and are not wiped. Set them to **No access** or delete them in Authentication → Users.
- Running the load twice stops with "Demo data is already loaded". Wipe first.

## 13. Security notes

- **The anon key is meant to be public.** Anyone can see it in the browser. That is fine, because row-level security decides what each logged-in user can read or write.
- **Void or delete.** Void keeps a wrong entry visible but stops it counting. Delete removes it completely, including its receipt. Both need a reason, and a delete still leaves a full copy in `audit_logs`.
- **Receipt numbers** (VR-2026-0001, DR-2026-0001) come from the database, so two people can't get the same number.
- **Free plan pauses** a project after about a week with no activity. Open the app at least weekly, or restore it from the Supabase dashboard if it pauses. Your data is kept.
- **Backups:** the free plan has limited backups. Once a month, go to **Database → Backups**, or run `supabase db dump` and keep the file somewhere safe. For a society's accounts, this is worth the 2 minutes.

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| Login works but shows "No access" | The role is still `member`. Run step 5. |
| "Only the Finance Secretary can record money" | You're signed in with a View-only account, or step 5 wasn't run. |
| Still shows demo login buttons | `.env.local` missing or the dev server wasn't restarted. On Vercel, env vars missing or no redeploy. |
| "Invalid login credentials" | Wrong password, or the user wasn't auto-confirmed. Tick **Auto Confirm** or confirm them in Authentication → Users. |
| Forms show no categories | Migration 4 wasn't run. |
| Deleting a transaction says the function doesn't exist | Migration 5 wasn't run. |
| Deleting an event, or changing someone's access, says the function doesn't exist or "Only the Finance Secretary can change roles" | Migration 6 wasn't run. |
| New account: "Account creation is not set up" | `SUPABASE_SERVICE_ROLE_KEY` is missing from `.env.local` or Vercel. Add it and restart / redeploy. |
| A vendor payment is refused | The amount is more than the vendor still owes. Check the booking's day fees. |
