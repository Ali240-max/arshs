"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  HandHeart,
  HeartHandshake,
  MapPin,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Scale,
  Search,
  Store,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import type { EventStatus, VendorPaymentStatus } from "@/lib/types";
import { useApp, useMe } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { can } from "@/lib/permissions";
import { openReceipts, useLookups } from "@/lib/hooks";
import { eventSummary, posted } from "@/lib/finance";
import { EVENT_STATUS_LABEL, EVENT_TYPE_META, FLOW_COLORS } from "@/lib/constants";
import { cn, formatDate, formatPKR, sum } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TD } from "@/components/ui/table";
import { TxnList } from "@/components/txn-list";
import { EventTimelineChart } from "@/components/charts/charts";
import { EventStatusBadge, EventTypeIcon } from "@/components/event-bits";
import { errorMessage } from "@/components/forms/shared";

type Tab = "overview" | "vendors" | "in" | "out" | "team";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe()!;
  const data = useApp((s) => s.data);
  const e = data.events.find((x) => x.id === id);
  const officer = me.role !== "member";

  if (!e || (!officer && e.status === "cancelled"))
    return (
      <EmptyState
        icon={<CalendarDays className="h-6 w-6" />}
        title="Event not found"
        description="It may have been removed, or the link is wrong."
        action={<Link href="/events"><Button variant="secondary">All events</Button></Link>}
      />
    );

  return officer ? <OfficerEvent id={id} /> : <MemberEvent id={id} />;
}

function EventHeader({ id, actions }: { id: string; actions?: React.ReactNode }) {
  const e = useApp((s) => s.data.events.find((x) => x.id === id))!;
  return (
    <div className="space-y-4">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All events
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-4">
          <EventTypeIcon type={e.type} className="h-12 w-12 rounded-2xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] md:text-[30px]">{e.name}</h1>
              <EventStatusBadge status={e.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(e.startDate)}
                {e.endDate !== e.startDate ? ` to ${formatDate(e.endDate)}` : ""} · {e.days} day{e.days > 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {e.location}
              </span>
              <span>
                {EVENT_TYPE_META[e.type].short} · {e.code}
              </span>
            </p>
          </div>
        </motion.div>
        {actions && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex flex-wrap gap-2">{actions}</motion.div>}
      </div>
    </div>
  );
}

// =====================================================================================
function OfficerEvent({ id }: { id: string }) {
  const me = useMe()!;
  const data = useApp((s) => s.data);
  const open = useUI((s) => s.open);
  const L = useLookups();
  const e = data.events.find((x) => x.id === id)!;
  const s = useMemo(() => eventSummary(data, id), [data, id]);
  const write = can(me.role, "finance.write");
  const [tab, setTab] = useState<Tab>(e.type === "fundraiser" ? "vendors" : "overview");

  const txns = useMemo(() => data.transactions.filter((t) => t.eventId === id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [data.transactions, id]);
  const ins = txns.filter((t) => t.direction === "in");
  const outs = txns.filter((t) => t.direction === "out");
  const team = data.eventMembers.filter((m) => m.eventId === id);

  const timeline = useMemo(() => {
    const byDate = new Map<string, { in: number; out: number }>();
    for (const t of posted(txns)) {
      const d = byDate.get(t.date) ?? { in: 0, out: 0 };
      if (t.direction === "in") d.in += t.amount;
      else d.out += t.amount;
      byDate.set(t.date, d);
    }
    let ci = 0;
    let co = 0;
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => {
        ci += v.in;
        co += v.out;
        return { label: formatDate(date).replace(/ \d{4}$/, ""), cumIn: ci, cumOut: co, net: ci - co };
      });
  }, [txns]);

  async function setStatus(status: EventStatus) {
    try {
      await useApp.getState().updateEvent(id, { status });
      toast.success(`Marked as ${EVENT_STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const primary =
    e.type === "fundraiser" ? (
      <Button onClick={() => open({ kind: "vendorPayment", eventId: id })}>
        <ReceiptText className="h-4 w-4" /> Collect payment
      </Button>
    ) : e.type === "expenditure" ? (
      <Button variant="danger" onClick={() => open({ kind: "ledger", ledgerKind: "expense", eventId: id })}>
        <ArrowUpRight className="h-4 w-4" /> Record expense
      </Button>
    ) : (
      <Button variant="marigold" onClick={() => open({ kind: "donation", eventId: id })}>
        <HandHeart className="h-4 w-4" /> Record donation
      </Button>
    );

  const actions = write ? (
    <>
      <select
        aria-label="Event status"
        value={e.status}
        onChange={(ev) => setStatus(ev.target.value as EventStatus)}
        className="h-10 rounded-xl border border-line bg-surface px-3 text-sm outline-none hover:border-line-strong"
      >
        {Object.entries(EVENT_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Button variant="secondary" onClick={() => open({ kind: "event", eventId: id })}>
        <Pencil className="h-4 w-4" /> Edit
      </Button>
      {primary}
    </>
  ) : undefined;

  const target = e.type === "expenditure" ? e.budget : e.targetAmount;
  const progressValue = e.type === "expenditure" ? s.expenses : s.revenue;

  const stats =
    e.type === "fundraiser"
      ? [
          { label: "Vendor revenue", value: s.vendorRevenue, icon: <Store className="h-4 w-4" />, accent: "#0E6B57", sub: `${formatPKR(s.agreedTotal)} agreed` },
          { label: "Other income", value: s.donations + s.otherIncome, icon: <ArrowDownLeft className="h-4 w-4" />, accent: FLOW_COLORS.in, sub: "Student stalls, donations" },
          { label: "Expenses", value: s.spend, icon: <ArrowUpRight className="h-4 w-4" />, accent: FLOW_COLORS.expense, sub: e.budget ? `Budget ${formatPKR(e.budget)}` : "Event costs" },
          { label: "Net", value: s.net, icon: <Scale className="h-4 w-4" />, accent: s.net >= 0 ? "#0E6B57" : FLOW_COLORS.expense, sub: "Revenue minus costs" },
          { label: "Vendors", value: s.vendorCount, icon: <Users className="h-4 w-4" />, accent: "#5EA8D6", sub: `${s.paidVendors} paid · ${s.partialVendors} partial · ${s.pendingVendors} pending`, format: (n: number) => String(Math.round(n)) },
          { label: "Still owed", value: s.outstanding, icon: <Wallet className="h-4 w-4" />, accent: FLOW_COLORS.marigold, sub: s.outstanding ? "Collect before the event closes" : "All vendors settled" },
        ]
      : [
          { label: "Money in", value: s.revenue, icon: <ArrowDownLeft className="h-4 w-4" />, accent: FLOW_COLORS.in, sub: `${posted(ins).length} entries` },
          { label: "Expenses", value: s.expenses, icon: <ArrowUpRight className="h-4 w-4" />, accent: FLOW_COLORS.expense, sub: e.budget ? `of ${formatPKR(e.budget)} budget` : "Running costs" },
          { label: "Aid given", value: s.aid, icon: <HeartHandshake className="h-4 w-4" />, accent: FLOW_COLORS.aid, sub: `${posted(outs).filter((t) => t.kind === "distribution").length} recipients` },
          { label: "Net", value: s.net, icon: <Scale className="h-4 w-4" />, accent: s.net >= 0 ? "#0E6B57" : FLOW_COLORS.expense, sub: "In minus out" },
        ];

  const tabs = [
    { value: "overview" as Tab, label: "Overview" },
    ...(e.type === "fundraiser" ? [{ value: "vendors" as Tab, label: "Vendors", count: s.vendorCount }] : []),
    { value: "in" as Tab, label: "Money in", count: ins.length },
    { value: "out" as Tab, label: "Money out", count: outs.length },
    { value: "team" as Tab, label: "Team", count: team.length },
  ];

  return (
    <div className="space-y-6">
      <EventHeader id={id} actions={actions} />

      <div className={cn("grid grid-cols-2 gap-3 md:gap-4", stats.length === 6 ? "md:grid-cols-3 xl:grid-cols-6" : "xl:grid-cols-4")}>
        {stats.map((st, i) => (
          <StatCard key={st.label} index={i} {...st} />
        ))}
      </div>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
          {tab === "overview" && (
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader title="Financial timeline" description="Running totals from the first entry to the latest" />
                <div className="px-3 pb-4 pt-3 sm:px-5">
                  <EventTimelineChart data={timeline} />
                </div>
              </Card>
              <div className="space-y-4">
                {target ? (
                  <Card className="p-5">
                    <p className="text-[13px] text-muted">{e.type === "expenditure" ? "Budget used" : "Target reached"}</p>
                    <p className="mt-1 font-display text-[22px] font-semibold">
                      {formatPKR(progressValue)} <span className="text-[14px] font-normal text-muted">of {formatPKR(target)}</span>
                    </p>
                    <Progress className="mt-3 h-2.5" value={progressValue} max={target} color={e.type === "expenditure" && progressValue > target ? FLOW_COLORS.expense : FLOW_COLORS.in} />
                    <p className="mt-2 text-[12.5px] text-muted">
                      {e.type === "expenditure"
                        ? progressValue > target
                          ? `${formatPKR(progressValue - target)} over budget`
                          : `${formatPKR(target - progressValue)} left to spend`
                        : progressValue >= target
                          ? "Target met"
                          : `${formatPKR(target - progressValue)} to go`}
                    </p>
                  </Card>
                ) : null}
                <Card className="p-5">
                  <p className="text-[13px] font-medium">Event summary</p>
                  <dl className="mt-3 space-y-2 text-[13.5px]">
                    {[
                      ["Vendor revenue", s.vendorRevenue],
                      ["Donations", s.donations],
                      ["Other income", s.otherIncome],
                      ["Expenses", -s.expenses],
                      ["Aid given", -s.aid],
                    ]
                      .filter(([, v]) => v !== 0)
                      .map(([k, v]) => (
                        <div key={k as string} className="flex justify-between">
                          <dt className="text-muted">{k}</dt>
                          <dd className={`num font-medium ${(v as number) < 0 ? "text-coral" : ""}`}>{formatPKR(v as number)}</dd>
                        </div>
                      ))}
                    <div className="flex justify-between border-t border-line pt-2 font-semibold">
                      <dt>Net</dt>
                      <dd className={`num ${s.net < 0 ? "text-coral" : "text-inflow"}`}>{formatPKR(s.net, { sign: true })}</dd>
                    </div>
                  </dl>
                  {e.description && <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-2">{e.description}</p>}
                </Card>
                {write && (
                  <Card className="p-5">
                    <p className="mb-3 text-[13px] font-medium">Record for this event</p>
                    <div className="grid grid-cols-2 gap-2">
                      {e.type === "fundraiser" && (
                        <Button size="sm" variant="secondary" onClick={() => open({ kind: "booking", eventId: id })}>
                          <Plus className="h-3.5 w-3.5" /> Add vendor
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => open({ kind: "ledger", ledgerKind: "income", eventId: id })}>
                        <ArrowDownLeft className="h-3.5 w-3.5" /> Income
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => open({ kind: "donation", eventId: id })}>
                        <HandHeart className="h-3.5 w-3.5" /> Donation
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => open({ kind: "ledger", ledgerKind: "expense", eventId: id })}>
                        <ArrowUpRight className="h-3.5 w-3.5" /> Expense
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => open({ kind: "distribution", eventId: id })}>
                        <HeartHandshake className="h-3.5 w-3.5" /> Aid
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {tab === "vendors" && <VendorsTab eventId={id} />}

          {tab === "in" && (
            <Card className="overflow-hidden">
              <CardHeader title="Money in" description={`${formatPKR(s.revenue)} posted`} />
              <div className="mt-3">
                <TxnList txns={ins} empty="No money received for this event yet." />
              </div>
            </Card>
          )}
          {tab === "out" && (
            <Card className="overflow-hidden">
              <CardHeader title="Money out" description={`${formatPKR(s.spend)} posted (expenses ${formatPKR(s.expenses)}, aid ${formatPKR(s.aid)})`} />
              <div className="mt-3">
                <TxnList txns={outs} empty="No expenses or aid recorded for this event." />
              </div>
            </Card>
          )}
          {tab === "team" && (
            <Card className="p-5">
              {team.length === 0 ? (
                <EmptyState icon={<Users className="h-6 w-6" />} title="No team assigned" description="Members assigned to this event will show here." className="py-8" />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {team.map((m) => {
                    const p = L.profile.get(m.profileId);
                    return (
                      <li key={m.profileId} className="flex items-center gap-3 rounded-xl border border-line p-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[12px] font-semibold text-white">
                          {p?.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p?.fullName ?? "Member"}</span>
                          <span className="block truncate text-[12px] text-muted">{p?.email}</span>
                        </span>
                        <Badge tone="brand">{m.duty}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------------------------------
function VendorsTab({ eventId }: { eventId: string }) {
  const me = useMe()!;
  const L = useLookups();
  const open = useUI((s) => s.open);
  const write = can(me.role, "finance.write");
  const [status, setStatus] = useState<"all" | VendorPaymentStatus>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => L.ledger.filter((l) => l.booking.eventId === eventId).sort((a, b) => a.booking.stallNo.localeCompare(b.booking.stallNo, undefined, { numeric: true })),
    [L.ledger, eventId],
  );
  const shown = rows.filter((r) => {
    const v = L.vendor.get(r.booking.vendorId);
    return (status === "all" || r.status === status) && (!q || `${v?.businessName} ${v?.ownerName ?? ""} ${v?.phone ?? ""} ${r.booking.stallNo}`.toLowerCase().includes(q.toLowerCase()));
  });
  const slipIds = (ids: string[]) =>
    rows.filter((r) => ids.includes(r.booking.id)).flatMap((r) => r.payments.filter((p) => p.txn.status === "posted").map((p) => p.payment.id));
  const allSlips = slipIds(rows.map((r) => r.booking.id));
  const selectedSlips = slipIds([...selected]);
  const days = Math.max(1, ...rows.map((r) => r.booking.dayFees.length));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function remove(bookingId: string, name: string) {
    if (!confirm(`Remove ${name} from this event?`)) return;
    try {
      await useApp.getState().removeBooking(bookingId);
      toast.success(`${name} removed`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (!rows.length)
    return (
      <Card>
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="No vendors yet"
          description="Add each stall with its per-day fee. Payments and printed slips come after."
          action={write ? <Button onClick={() => open({ kind: "booking", eventId })}><Plus className="h-4 w-4" /> Add vendor</Button> : undefined}
        />
      </Card>
    );

  const totals = { agreed: sum(shown, (r) => r.agreed), paid: sum(shown, (r) => r.paid), remaining: sum(shown, (r) => r.remaining) };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <Tabs
          size="sm"
          value={status}
          onChange={setStatus}
          items={[
            { value: "all", label: "All", count: rows.length },
            { value: "paid", label: "Paid", count: rows.filter((r) => r.status === "paid").length },
            { value: "partial", label: "Partial", count: rows.filter((r) => r.status === "partial").length },
            { value: "pending", label: "Pending", count: rows.filter((r) => r.status === "pending").length },
          ]}
        />
        <div className="relative lg:ml-2 lg:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vendor, phone or stall" className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-brand-400" />
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Button size="sm" variant="marigold" disabled={!selectedSlips.length} onClick={() => openReceipts("vendor", selectedSlips)}>
                  <Printer className="h-3.5 w-3.5" /> Print {selectedSlips.length} slip{selectedSlips.length === 1 ? "" : "s"} ({selected.size} selected)
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button size="sm" variant="secondary" disabled={!allSlips.length} onClick={() => openReceipts("vendor", allSlips)}>
            <Printer className="h-3.5 w-3.5" /> Print all slips
          </Button>
          {write && (
            <Button size="sm" onClick={() => open({ kind: "booking", eventId })}>
              <Plus className="h-3.5 w-3.5" /> Add vendor
            </Button>
          )}
        </div>
      </div>
      <Table className="border-t border-line">
        <THead>
          <tr>
            <TH className="w-10">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={shown.length > 0 && shown.every((r) => selected.has(r.booking.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((r) => r.booking.id)) : new Set())}
                className="accent-brand-600"
              />
            </TH>
            <TH>Stall</TH>
            <TH>Vendor</TH>
            {Array.from({ length: days }, (_, i) => (
              <TH key={i} align="right">
                Day {i + 1}
              </TH>
            ))}
            <TH align="right">Agreed</TH>
            <TH align="right">Paid</TH>
            <TH align="right">Remaining</TH>
            <TH>Status</TH>
            <TH>Last paid</TH>
            <TH align="right"> </TH>
          </tr>
        </THead>
        <tbody>
          {shown.map((r, i) => {
            const v = L.vendor.get(r.booking.vendorId);
            const sel = selected.has(r.booking.id);
            return (
              <motion.tr
                key={r.booking.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 15) * 0.025 }}
                className={cn("group transition-colors hover:bg-surface-2", sel && "bg-brand-50/60 dark:bg-brand-900/20")}
              >
                <TD>
                  <input type="checkbox" aria-label={`Select ${v?.businessName}`} checked={sel} onChange={() => toggle(r.booking.id)} className="accent-brand-600" />
                </TD>
                <TD className="num whitespace-nowrap font-medium">{r.booking.stallNo}</TD>
                <TD>
                  <p className="font-medium">{v?.businessName}</p>
                  <p className="text-[12px] text-muted">{[v?.ownerName, v?.phone, r.booking.stallType].filter(Boolean).join(" · ") || (r.booking.notes ?? "")}</p>
                </TD>
                {Array.from({ length: days }, (_, d) => (
                  <TD key={d} align="right" className="num text-ink-2">
                    {r.booking.dayFees[d] ? r.booking.dayFees[d].toLocaleString("en-PK") : <span className="text-muted">–</span>}
                  </TD>
                ))}
                <TD align="right" className="num font-medium">{r.agreed.toLocaleString("en-PK")}</TD>
                <TD align="right" className="num text-inflow">{r.paid.toLocaleString("en-PK")}</TD>
                <TD align="right" className={cn("num font-semibold", r.remaining ? "text-marigold-700 dark:text-amber-300" : "text-muted")}>
                  {r.remaining.toLocaleString("en-PK")}
                </TD>
                <TD>
                  <StatusPill status={r.status} />
                </TD>
                <TD className="whitespace-nowrap text-[12.5px] text-muted">{r.lastPaymentDate ? formatDate(r.lastPaymentDate) : "–"}</TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    {write && r.remaining > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => open({ kind: "vendorPayment", bookingId: r.booking.id })}>
                        Collect
                      </Button>
                    )}
                    {r.payments.some((p) => p.txn.status === "posted") && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Print slips" onClick={() => openReceipts("vendor", slipIds([r.booking.id]))}>
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {write && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit booking" onClick={() => open({ kind: "booking", eventId, bookingId: r.booking.id })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {write && r.payments.length === 0 && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-coral" title="Remove from event" onClick={() => remove(r.booking.id, v?.businessName ?? "Vendor")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TD>
              </motion.tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <TD colSpan={3 + days}>Total ({shown.length} vendors)</TD>
            <TD align="right" className="num">{totals.agreed.toLocaleString("en-PK")}</TD>
            <TD align="right" className="num text-inflow">{totals.paid.toLocaleString("en-PK")}</TD>
            <TD align="right" className="num text-marigold-700 dark:text-amber-300">{totals.remaining.toLocaleString("en-PK")}</TD>
            <TD colSpan={3}> </TD>
          </tr>
        </tfoot>
      </Table>
    </Card>
  );
}

// =====================================================================================
/** Members see event details and their duty. No money, matching the database rules. */
function MemberEvent({ id }: { id: string }) {
  const me = useMe()!;
  const data = useApp((s) => s.data);
  const e = data.events.find((x) => x.id === id)!;
  const mine = data.eventMembers.find((m) => m.eventId === id && m.profileId === me.id);
  return (
    <div className="space-y-6">
      <EventHeader id={id} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <p className="text-[13px] font-medium text-muted">About this event</p>
          <p className="mt-2 text-[15px] leading-relaxed">{e.description || EVENT_TYPE_META[e.type].description}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[13px] font-medium text-muted">Your duty</p>
          {mine ? (
            <>
              <p className="mt-2 font-display text-[22px] font-semibold">{mine.duty}</p>
              <p className="mt-1 text-[13px] text-muted">Report to the Finance Secretary for money handed over at the event.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">You are not assigned to this event.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
