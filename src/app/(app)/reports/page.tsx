"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarRange, Download, FileText, HandHeart, HeartHandshake, Printer, Store, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/store";
import { useLookups } from "@/lib/hooks";
import { categoryBreakdown, eventSummary, monthlySeries, posted } from "@/lib/finance";
import { EVENT_STATUS_LABEL, EVENT_TYPE_META, METHOD_LABEL, RECIPIENT_TYPE_LABEL } from "@/lib/constants";
import { cn, downloadCSV, formatDate, formatPKR, sum } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Table, THead, TH, TD } from "@/components/ui/table";
import { DonutChart } from "@/components/charts/charts";
import { CashflowChart } from "@/components/charts/charts";
import { PeriodPicker, useAnchorDate, usePeriod, type PeriodPreset } from "@/components/filters";

type Tab = "monthly" | "events" | "donations" | "aid" | "vendors";
const n = (v: number) => v.toLocaleString("en-PK");

export default function ReportsPage() {
  const data = useApp((s) => s.data);
  const anchor = useAnchorDate();
  const [tab, setTab] = useState<Tab>("monthly");
  const [preset, setPreset] = useState<PeriodPreset>("12m");
  const [custom, setCustom] = useState({ from: `${anchor.slice(0, 4)}-01-01`, to: anchor });
  const period = usePeriod(preset, custom);
  const inPeriod = useMemo(() => posted(data.transactions).filter((t) => t.date >= period.from && t.date <= period.to), [data.transactions, period.from, period.to]);

  return (
    <div className="space-y-6">
      {/* Reports have wide tables, so they print in landscape */}
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <PageHeader
        title="Reports"
        description="Summaries you can print or export for meetings and audits."
        actions={
          <Button variant="secondary" onClick={() => window.print()} className="no-print">
            <Printer className="h-4 w-4" /> Print
          </Button>
        }
      />
      <div className="no-print flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "monthly", label: <><TrendingUp className="h-3.5 w-3.5" /> Monthly</> },
            { value: "events", label: <><CalendarRange className="h-3.5 w-3.5" /> Events</> },
            { value: "donations", label: <><HandHeart className="h-3.5 w-3.5" /> Donations</> },
            { value: "aid", label: <><HeartHandshake className="h-3.5 w-3.5" /> Aid</> },
            { value: "vendors", label: <><Store className="h-3.5 w-3.5" /> Vendors</> },
          ]}
        />
        <PeriodPicker value={preset} onChange={setPreset} custom={custom} onCustom={setCustom} />
      </div>
      <p className="hidden text-sm print:block">
        {data.settings.societyName} · {formatDate(period.from)} to {formatDate(period.to)}
      </p>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="space-y-4">
          {tab === "monthly" && <Monthly from={period.from} to={period.to} />}
          {tab === "events" && <Events from={period.from} to={period.to} />}
          {tab === "donations" && <Donations txns={inPeriod.filter((t) => t.kind === "donation")} />}
          {tab === "aid" && <Aid txns={inPeriod.filter((t) => t.kind === "distribution")} />}
          {tab === "vendors" && <Vendors from={period.from} to={period.to} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Summary({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i, k) => (
        <motion.div key={i.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }}>
          <Card className="print-card p-4">
            <p className="text-[12.5px] text-muted">{i.label}</p>
            <p className={cn("num mt-1 font-display text-[20px] font-semibold tracking-tight", i.tone)}>{i.value}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick} className="no-print">
      <Download className="h-3.5 w-3.5" /> CSV
    </Button>
  );
}

// ------------------------------------------------------------------ Monthly
function Monthly({ from, to }: { from: string; to: string }) {
  const data = useApp((s) => s.data);
  const rows = useMemo(() => monthlySeries(data, from, to), [data, from, to]);
  const vendorByMonth = useMemo(() => {
    const m = new Map<string, number>();
    posted(data.transactions)
      .filter((t) => t.kind === "vendor_payment")
      .forEach((t) => m.set(t.date.slice(0, 7), (m.get(t.date.slice(0, 7)) ?? 0) + t.amount));
    return m;
  }, [data.transactions]);
  const tot = { in: sum(rows, (r) => r.income), exp: sum(rows, (r) => r.expense), aid: sum(rows, (r) => r.aid) };
  const opening = rows.length ? rows[0].balance - rows[0].net : 0;
  const closing = rows.length ? rows[rows.length - 1].balance : 0;

  return (
    <>
      <Summary
        items={[
          { label: "Balance at start", value: formatPKR(opening) },
          { label: "Money in", value: formatPKR(tot.in), tone: "text-inflow" },
          { label: "Money out", value: formatPKR(tot.exp + tot.aid), tone: "text-coral" },
          { label: "Balance at end", value: formatPKR(closing) },
        ]}
      />
      <Card className="print-card no-print">
        <CardHeader title="Income vs expenses" />
        <div className="px-3 pb-4 pt-3 sm:px-5">
          <CashflowChart data={rows} height={260} />
        </div>
      </Card>
      <Card className="print-card overflow-hidden">
        <CardHeader
          title="Month by month"
          action={
            <ExportBtn
              onClick={() =>
                downloadCSV(
                  `monthly-${from}-to-${to}.csv`,
                  rows.map((r) => ({ Month: r.label, "Vendor fees": vendorByMonth.get(r.key) ?? 0, Donations: r.donations, "Other income": r.income - r.donations - (vendorByMonth.get(r.key) ?? 0), "Money in": r.income, Expenses: r.expense, Aid: r.aid, Net: r.net, "Closing balance": r.balance })),
                )
              }
            />
          }
        />
        <Table className="mt-3">
          <THead>
            <tr>
              <TH>Month</TH>
              <TH align="right">Vendor fees</TH>
              <TH align="right">Donations</TH>
              <TH align="right">Other income</TH>
              <TH align="right">Expenses</TH>
              <TH align="right">Aid</TH>
              <TH align="right">Net</TH>
              <TH align="right">Closing balance</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => {
              const v = vendorByMonth.get(r.key) ?? 0;
              return (
                <tr key={r.key} className="hover:bg-surface-2">
                  <TD className="font-medium">{r.label}</TD>
                  <TD align="right" className="num">{n(v)}</TD>
                  <TD align="right" className="num">{n(r.donations)}</TD>
                  <TD align="right" className="num">{n(r.income - r.donations - v)}</TD>
                  <TD align="right" className="num text-coral">{n(r.expense)}</TD>
                  <TD align="right" className="num text-violet">{n(r.aid)}</TD>
                  <TD align="right" className={cn("num font-medium", r.net < 0 ? "text-coral" : "text-inflow")}>{formatPKR(r.net, { sign: true })}</TD>
                  <TD align="right" className="num font-semibold">{n(r.balance)}</TD>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <TD>Total</TD>
              <TD align="right" className="num">{n(sum(rows, (r) => vendorByMonth.get(r.key) ?? 0))}</TD>
              <TD align="right" className="num">{n(sum(rows, (r) => r.donations))}</TD>
              <TD align="right" className="num">{n(sum(rows, (r) => r.income - r.donations - (vendorByMonth.get(r.key) ?? 0)))}</TD>
              <TD align="right" className="num">{n(tot.exp)}</TD>
              <TD align="right" className="num">{n(tot.aid)}</TD>
              <TD align="right" className="num">{formatPKR(tot.in - tot.exp - tot.aid, { sign: true })}</TD>
              <TD align="right" className="num">{n(closing)}</TD>
            </tr>
          </tfoot>
        </Table>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ Events
function Events({ from, to }: { from: string; to: string }) {
  const data = useApp((s) => s.data);
  const rows = useMemo(
    () =>
      data.events
        .filter((e) => e.endDate >= from && e.startDate <= to)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((e) => ({ e, s: eventSummary(data, e.id) })),
    [data, from, to],
  );
  const tot = { in: sum(rows, (r) => r.s.revenue), out: sum(rows, (r) => r.s.spend), owed: sum(rows, (r) => r.s.outstanding) };
  return (
    <>
      <Summary
        items={[
          { label: "Events", value: String(rows.length) },
          { label: "Raised", value: formatPKR(tot.in), tone: "text-inflow" },
          { label: "Spent", value: formatPKR(tot.out), tone: "text-coral" },
          { label: "Net", value: formatPKR(tot.in - tot.out, { sign: true }) },
        ]}
      />
      <Card className="print-card overflow-hidden">
        <CardHeader
          title="Event results"
          description="Open the full report for any event to see every vendor and receipt."
          action={
            <ExportBtn
              onClick={() =>
                downloadCSV(
                  `events-${from}-to-${to}.csv`,
                  rows.map(({ e, s }) => ({ Event: e.name, Code: e.code, Type: EVENT_TYPE_META[e.type].short, Start: e.startDate, Status: EVENT_STATUS_LABEL[e.status], Vendors: s.vendorCount, "Vendor fees": s.vendorRevenue, "Other income": s.donations + s.otherIncome, Expenses: s.expenses, Aid: s.aid, Net: s.net, "Still owed": s.outstanding })),
                )
              }
            />
          }
        />
        <Table className="mt-3">
          <THead>
            <tr>
              <TH>Event</TH>
              <TH>Status</TH>
              <TH align="right">Vendor fees</TH>
              <TH align="right">Other income</TH>
              <TH align="right">Out</TH>
              <TH align="right">Net</TH>
              <TH align="right">Still owed</TH>
              <TH align="right"> </TH>
            </tr>
          </THead>
          <tbody>
            {rows.map(({ e, s }) => (
              <tr key={e.id} className="hover:bg-surface-2">
                <TD>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-[12px] text-muted">
                    {formatDate(e.startDate)} · {EVENT_TYPE_META[e.type].short}
                  </p>
                </TD>
                <TD className="text-[13px]">{EVENT_STATUS_LABEL[e.status]}</TD>
                <TD align="right" className="num">{n(s.vendorRevenue)}</TD>
                <TD align="right" className="num">{n(s.donations + s.otherIncome)}</TD>
                <TD align="right" className="num text-coral">{n(s.spend)}</TD>
                <TD align="right" className={cn("num font-semibold", s.net < 0 ? "text-coral" : "text-inflow")}>{formatPKR(s.net, { sign: true })}</TD>
                <TD align="right" className="num">{s.outstanding ? n(s.outstanding) : "–"}</TD>
                <TD align="right">
                  <Button size="sm" variant="ghost" className="no-print" onClick={() => window.open(`/print/event-report?id=${e.id}`, "_blank")}>
                    <FileText className="h-3.5 w-3.5" /> Report
                  </Button>
                </TD>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <TD colSpan={2}>Total</TD>
              <TD align="right" className="num">{n(sum(rows, (r) => r.s.vendorRevenue))}</TD>
              <TD align="right" className="num">{n(sum(rows, (r) => r.s.donations + r.s.otherIncome))}</TD>
              <TD align="right" className="num">{n(tot.out)}</TD>
              <TD align="right" className="num">{formatPKR(tot.in - tot.out, { sign: true })}</TD>
              <TD align="right" className="num">{n(tot.owed)}</TD>
              <TD> </TD>
            </tr>
          </tfoot>
        </Table>
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ Donations
function Donations({ txns }: { txns: Transaction[] }) {
  const data = useApp((s) => s.data);
  const L = useLookups();
  const rows = [...txns].sort((a, b) => b.date.localeCompare(a.date));
  const byType = categoryBreakdown(rows, data.categories, ["donation"]);
  const donors = new Set(rows.map((t) => L.donationByTxn.get(t.id)).filter((d) => d && !d.isAnonymous).map((d) => d!.donorName?.toLowerCase()));
  const total = sum(rows, (t) => t.amount);
  return (
    <>
      <Summary
        items={[
          { label: "Donations received", value: formatPKR(total), tone: "text-marigold-700 dark:text-amber-300" },
          { label: "Number of donations", value: String(rows.length) },
          { label: "Named donors", value: String(donors.size) },
          { label: "Average donation", value: formatPKR(rows.length ? Math.round(total / rows.length) : 0) },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="print-card">
          <CardHeader title="By type" />
          <div className="p-5">
            <DonutChart data={byType} totalLabel="Donations" />
          </div>
        </Card>
        <Card className="print-card overflow-hidden lg:col-span-2">
          <CardHeader
            title="All donations"
            action={
              <ExportBtn
                onClick={() =>
                  downloadCSV(
                    "donations.csv",
                    rows.map((t) => {
                      const d = L.donationByTxn.get(t.id);
                      return { Date: t.date, Receipt: d?.receiptNo ?? "", Donor: d?.isAnonymous ? "Anonymous" : (d?.donorName ?? ""), Phone: d?.donorPhone ?? "", Purpose: d?.purpose ?? "", Type: L.category.get(t.categoryId)?.name ?? "", Campaign: t.eventId ? (L.event.get(t.eventId)?.name ?? "") : "", Method: METHOD_LABEL[t.method], Amount: t.amount };
                    }),
                  )
                }
              />
            }
          />
          <Table className="mt-3">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Donor</TH>
                <TH>Purpose</TH>
                <TH>Receipt</TH>
                <TH align="right">Amount</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((t) => {
                const d = L.donationByTxn.get(t.id);
                return (
                  <tr key={t.id} className="hover:bg-surface-2">
                    <TD className="whitespace-nowrap text-[13px] text-muted">{formatDate(t.date)}</TD>
                    <TD className="font-medium">{d?.isAnonymous ? <span className="italic text-muted">Anonymous</span> : d?.donorName}</TD>
                    <TD className="text-[13px] text-ink-2">{d?.purpose}</TD>
                    <TD className="num text-[12.5px] text-muted">{d?.receiptNo}</TD>
                    <TD align="right" className="num font-medium">{n(t.amount)}</TD>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <TD colSpan={4}>Total ({rows.length})</TD>
                <TD align="right" className="num">{n(total)}</TD>
              </tr>
            </tfoot>
          </Table>
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Aid
function Aid({ txns }: { txns: Transaction[] }) {
  const data = useApp((s) => s.data);
  const L = useLookups();
  const rows = [...txns].sort((a, b) => b.date.localeCompare(a.date));
  const byCat = categoryBreakdown(rows, data.categories, ["distribution"]);
  const people = sum(rows, (t) => L.distributionByTxn.get(t.id)?.beneficiaryCount ?? 0);
  const total = sum(rows, (t) => t.amount);
  return (
    <>
      <Summary
        items={[
          { label: "Aid given", value: formatPKR(total), tone: "text-violet" },
          { label: "Payments", value: String(rows.length) },
          { label: "People helped", value: n(people) },
          { label: "Average per person", value: formatPKR(people ? Math.round(total / people) : 0) },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="print-card">
          <CardHeader title="By category" />
          <div className="p-5">
            <DonutChart data={byCat} totalLabel="Aid" />
          </div>
        </Card>
        <Card className="print-card overflow-hidden lg:col-span-2">
          <CardHeader
            title="All aid payments"
            action={
              <ExportBtn
                onClick={() =>
                  downloadCSV(
                    "aid.csv",
                    rows.map((t) => {
                      const d = L.distributionByTxn.get(t.id);
                      return { Date: t.date, Reference: d?.referenceNo ?? "", Recipient: d?.recipientName ?? "", Type: d ? RECIPIENT_TYPE_LABEL[d.recipientType] : "", People: d?.beneficiaryCount ?? 0, Category: L.category.get(t.categoryId)?.name ?? "", Reason: t.description, Method: METHOD_LABEL[t.method], Amount: t.amount };
                    }),
                  )
                }
              />
            }
          />
          <Table className="mt-3">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Recipient</TH>
                <TH>Category</TH>
                <TH align="right">People</TH>
                <TH align="right">Amount</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((t) => {
                const d = L.distributionByTxn.get(t.id);
                return (
                  <tr key={t.id} className="hover:bg-surface-2">
                    <TD className="whitespace-nowrap text-[13px] text-muted">{formatDate(t.date)}</TD>
                    <TD>
                      <p className="font-medium">{d?.recipientName}</p>
                      <p className="max-w-[280px] truncate text-[12px] text-muted">{t.description}</p>
                    </TD>
                    <TD className="text-[13px]">{L.category.get(t.categoryId)?.name}</TD>
                    <TD align="right" className="num">{d?.beneficiaryCount}</TD>
                    <TD align="right" className="num font-medium">{n(t.amount)}</TD>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <TD colSpan={3}>Total ({rows.length})</TD>
                <TD align="right" className="num">{n(people)}</TD>
                <TD align="right" className="num">{n(total)}</TD>
              </tr>
            </tfoot>
          </Table>
        </Card>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Vendors
function Vendors({ from, to }: { from: string; to: string }) {
  const L = useLookups();
  const data = useApp((s) => s.data);
  const rows = useMemo(() => {
    const inScope = new Set(data.events.filter((e) => e.endDate >= from && e.startDate <= to).map((e) => e.id));
    const by = new Map<string, { events: number; agreed: number; paid: number; owed: number; last?: string }>();
    for (const l of L.ledger) {
      if (!inScope.has(l.booking.eventId)) continue;
      const r = by.get(l.booking.vendorId) ?? { events: 0, agreed: 0, paid: 0, owed: 0 };
      r.events++;
      r.agreed += l.agreed;
      r.paid += l.paid;
      r.owed += l.remaining;
      if (l.lastPaymentDate && (!r.last || l.lastPaymentDate > r.last)) r.last = l.lastPaymentDate;
      by.set(l.booking.vendorId, r);
    }
    return [...by.entries()].map(([id, r]) => ({ v: L.vendor.get(id)!, ...r })).sort((a, b) => b.paid - a.paid);
  }, [L, data.events, from, to]);
  const tot = { agreed: sum(rows, (r) => r.agreed), paid: sum(rows, (r) => r.paid), owed: sum(rows, (r) => r.owed) };
  return (
    <>
      <Summary
        items={[
          { label: "Vendors", value: String(rows.length) },
          { label: "Fees agreed", value: formatPKR(tot.agreed) },
          { label: "Collected", value: formatPKR(tot.paid), tone: "text-inflow" },
          { label: "Still owed", value: formatPKR(tot.owed), tone: tot.owed ? "text-marigold-700 dark:text-amber-300" : undefined },
        ]}
      />
      <Card className="print-card overflow-hidden">
        <CardHeader
          title="Vendor performance"
          description="Across all events in this period. Vendors who come back are counted once."
          action={
            <ExportBtn
              onClick={() =>
                downloadCSV(
                  "vendors.csv",
                  rows.map((r) => ({ Vendor: r.v.businessName, Code: r.v.code, Owner: r.v.ownerName ?? "", Phone: r.v.phone ?? "", Events: r.events, Agreed: r.agreed, Paid: r.paid, Owed: r.owed, "Last payment": r.last ?? "" })),
                )
              }
            />
          }
        />
        <Table className="mt-3">
          <THead>
            <tr>
              <TH>Vendor</TH>
              <TH align="right">Events</TH>
              <TH align="right">Agreed</TH>
              <TH align="right">Paid</TH>
              <TH align="right">Still owed</TH>
              <TH>Last paid</TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.v.id} className="hover:bg-surface-2">
                <TD>
                  <p className="font-medium">{r.v.businessName}</p>
                  <p className="text-[12px] text-muted">{[r.v.ownerName, r.v.phone].filter(Boolean).join(" · ") || r.v.code}</p>
                </TD>
                <TD align="right" className="num">{r.events}</TD>
                <TD align="right" className="num">{n(r.agreed)}</TD>
                <TD align="right" className="num font-medium text-inflow">{n(r.paid)}</TD>
                <TD align="right" className={cn("num", r.owed && "font-semibold text-marigold-700 dark:text-amber-300")}>{r.owed ? n(r.owed) : "–"}</TD>
                <TD className="whitespace-nowrap text-[13px] text-muted">{r.last ? formatDate(r.last) : "–"}</TD>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <TD>Total ({rows.length})</TD>
              <TD align="right" className="num">{sum(rows, (r) => r.events)}</TD>
              <TD align="right" className="num">{n(tot.agreed)}</TD>
              <TD align="right" className="num">{n(tot.paid)}</TD>
              <TD align="right" className="num">{n(tot.owed)}</TD>
              <TD> </TD>
            </tr>
          </tfoot>
        </Table>
      </Card>
    </>
  );
}
