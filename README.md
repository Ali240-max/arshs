# ARSHS Finance (dashboard + events)

Finance and event dashboard for the Adeeb Rizvi Serving Humanity Society.
This version ships the **Dashboard** and **Events** modules. Other modules (ledger, reports, activity log, users) come next.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys it runs on demo data saved in your browser.

Demo accounts (password `demo1234`), or use the one-click buttons on the login page:

| Role | Email | Can do |
|---|---|---|
| Finance Secretary | finance@arshs.demo | Everything |
| President | president@arshs.demo | View everything, change nothing |

In demo mode the top bar has a Finance / President switch so you can see both views.

## What works

- **Dashboard:** balance shown as Opening + Money in − Expenses − Aid, 8 stat cards, filters (period, event, type, category), 5 charts, "fees still owed" strip with one-tap Collect for Finance (read-only for the President).
- **Events:** list with filters, create/edit, detail page with Overview (timeline chart, target/budget), Vendors table (per-day fees, one day by default with an Add day button, paid/partial/pending, collect, edit, remove, bulk print slips), Money in, Money out, Team.
- **Recording money:** vendor payment, donation, other income, expense, aid. All from the Record button or the event page.
- **Receipts:** `/print/receipts`, A4 with vendor and society copies, or 80mm thermal slip, amount in words, signature lines.
- **Search:** Ctrl+K for events, vendors, TXN codes, donors, receipt numbers.
- Dark mode, animations (respect reduced motion), transaction void with reason, audit trail per transaction.

## Supabase

Full step-by-step guide: **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)**.
