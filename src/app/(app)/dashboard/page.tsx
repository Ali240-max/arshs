"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck2,
  CalendarRange,
  CircleDollarSign,
  HandHeart,
  HeartHandshake,
  Landmark,
  ReceiptText,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { useApp, useMe } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { can } from "@/lib/permissions";
import { useLookups } from "@/lib/hooks";
import { balanceSummary, categoryBreakdown, eventSummary, filterTxns, incomeBySource, monthlySeries, posted } from "@/lib/finance";
import { EVENT_TYPE_META, FLOW_COLORS, KIND_META } from "@/lib/constants";
import { compactPKR, formatDate, formatPKR, sum } from "@/lib/utils";
import type { TxnKind } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { BalanceHero } from "@/components/balance-hero";
import { TxnList } from "@/components/txn-list";
import { FilterSelect, PeriodPicker, useAnchorDate, usePeriod, type PeriodPreset } from "@/components/filters";
import { CashflowChart, DonationTrendChart, DonutChart, EventPerformanceChart, VendorCollectionChart } from "@/components/charts/charts";
import { EventStatusBadge } from "@/components/event-bits";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const me = useMe();
  if (!me) return null;
  return me.role === "member" ? <MemberDashboard /> : <OfficerDashboard />;
}

// =====================================================================================
function OfficerDashboard() {
  const me = useMe()!;
  const data = useApp((s) => s.data);
  const L = useLookups();
  const anchor = useAnchorDate();
  const [preset, setPreset] = useState<PeriodPreset>("12m");
  const [custom, setCustom] = useState({ from: `${anchor.slice(0, 4)}-01-01`, to: anchor });
  const period = usePeriod(preset, custom);
  const [eventId, setEventId] = useState("");
  const [kind, setKind] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [outTab, setOutTab] = useState<"all" | "expense" | "aid">("all");

  const allTime = useMemo(() => balanceSummary(data), [data]);
  const allSeries = useMemo(() => monthlySeries(data, data.settings.openingBalanceDate, anchor), [data, anchor]);

  const txns = useMemo(
    () => filterTxns(data.transactions, { from: period.from, to: period.to, eventId: eventId || undefined, kinds: kind ? [kind as TxnKind] : undefined, categoryId: categoryId || undefined }),
    [data.transactions, period.from, period.to, eventId, kind, categoryId],
  );
  const s = useMemo(() => balanceSummary(data, txns), [data, txns]);
  const series = useMemo(() => monthlySeries(data, period.from, period.to, txns), [data, period.from, period.to, txns]);
  const filtered = !!(eventId || kind || categoryId || preset !== "all");

  const eventsInScope = useMemo(
    () =>
      data.events.filter((e) =>
        eventId
          ? e.id === eventId
          : e.endDate >= period.from &&
            // Upcoming events count when the period runs to today, so their bookings and dues show up
            (e.startDate <= period.to || (period.to >= anchor && (e.status === "active" || e.status === "planned"))),
      ),
    [data.events, eventId, period.from, period.to, anchor],
  );
  const activeEvents = data.events.filter((e) => e.status === "active").length;

  const incomeSlices = useMemo(() => incomeBySource(txns, data.categories), [txns, data.categories]);
  const outSlices = useMemo(() => {
    if (outTab === "expense") return categoryBreakdown(txns, data.categories, ["expense"]);
    if (outTab === "aid") return categoryBreakdown(txns, data.categories, ["distribution"]);
    const exp = categoryBreakdown(txns, data.categories, ["expense"]);
    const top = exp.slice(0, 4);
    const rest = sum(exp.slice(4), (x) => x.value);
    return [
      { name: "Aid to people", value: s.aid, color: FLOW_COLORS.aid },
      ...top,
      ...(rest ? [{ name: "Other expenses", value: rest, color: "#B9A29B" }] : []),
    ].filter((x) => x.value > 0);
  }, [outTab, txns, data.categories, s.aid]);

  const eventBars = useMemo(
    () =>
      eventsInScope
        .map((e) => ({ e, sm: eventSummary(data, e.id) }))
        .filter((x) => x.sm.revenue || x.sm.spend)
        .sort((a, b) => a.e.startDate.localeCompare(b.e.startDate))
        .slice(-8)
        .map(({ e, sm }) => ({ name: e.name.replace(/ 20\d\d$/, ""), revenue: sm.revenue, spend: sm.spend, net: sm.net })),
    [eventsInScope, data],
  );

  const fundraisers = eventsInScope.filter((e) => e.type === "fundraiser");
  const vendorStats = useMemo(() => {
    const ids = new Set(fundraisers.map((e) => e.id));
    const rows = L.ledger.filter((l) => ids.has(l.booking.eventId));
    return {
      bookings: rows.length,
      vendors: new Set(rows.map((r) => r.booking.vendorId)).size,
      collected: sum(rows, (r) => r.paid),
      outstanding: sum(rows, (r) => r.remaining),
      paid: rows.filter((r) => r.status === "paid").length,
      partial: rows.filter((r) => r.status === "partial").length,
      pending: rows.filter((r) => r.status === "pending").length,
      bars: fundraisers
        .map((e) => {
          const r = rows.filter((x) => x.booking.eventId === e.id);
          return { name: e.name.replace(/ 20\d\d$/, ""), collected: sum(r, (x) => x.paid), outstanding: sum(r, (x) => x.remaining), date: e.startDate };
        })
        .filter((b) => b.collected || b.outstanding)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    };
  }, [fundraisers, L.ledger]);

  const recent = useMemo(() => [...txns].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7), [txns]);
  const upcoming = useMemo(
    () => data.events.filter((e) => e.status === "active" || e.status === "planned").sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 4),
    [data.events],
  );

  const kpis = [
    { label: "Money received", value: s.totalIn, icon: <ArrowDownLeft className="h-4 w-4" />, accent: FLOW_COLORS.in, sub: `${posted(txns).filter((t) => t.direction === "in").length} entries` },
    { label: "Donations received", value: s.donations, icon: <HandHeart className="h-4 w-4" />, accent: FLOW_COLORS.marigold, sub: `${posted(txns).filter((t) => t.kind === "donation").length} donations` },
    { label: "Aid distributed", value: s.aid, icon: <HeartHandshake className="h-4 w-4" />, accent: FLOW_COLORS.aid, sub: "Given to people in need" },
    { label: "Expenditure", value: s.expenses, icon: <ArrowUpRight className="h-4 w-4" />, accent: FLOW_COLORS.expense, sub: "Operating and event costs" },
    { label: "Event revenue", value: s.eventRevenue, icon: <CalendarRange className="h-4 w-4" />, accent: "#0E6B57", sub: "Money in linked to events" },
    { label: "Vendor revenue", value: s.vendorRevenue, icon: <Store className="h-4 w-4" />, accent: "#16806A", sub: "Stall fees collected" },
    { label: "Events", value: eventsInScope.length, icon: <CalendarCheck2 className="h-4 w-4" />, accent: "#5EA8D6", sub: "In this period", format: (n: number) => Math.round(n).toString() },
    { label: "Active events", value: activeEvents, icon: <Sparkles className="h-4 w-4" />, accent: "#C9861A", sub: "Running right now", format: (n: number) => Math.round(n).toString() },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted">
          {greeting()}, {me.fullName.split(" ")[0]}
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="font-display text-[30px] font-semibold tracking-[-0.02em] md:text-[34px]">
          Society finances
        </motion.h1>
      </div>

      <BalanceHero s={allTime} series={allSeries} openingDate={data.settings.openingBalanceDate} />

      <AttentionStrip />

      {/* Filters */}
      <Card className="glass sticky top-[72px] z-10 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <PeriodPicker value={preset} onChange={setPreset} custom={custom} onCustom={setCustom} />
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          <FilterSelect label="Event" value={eventId} onChange={setEventId} placeholder="All events" options={[...data.events].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((e) => ({ value: e.id, label: e.name }))} />
          <FilterSelect
            label="Transaction type"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setCategoryId("");
            }}
            placeholder="All types"
            options={(Object.keys(KIND_META) as TxnKind[]).map((k) => ({ value: k, label: KIND_META[k].plural }))}
          />
          <FilterSelect
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            placeholder="All categories"
            options={data.categories.filter((c) => !kind || c.kind === kind).map((c) => ({ value: c.id, label: `${c.name} (${KIND_META[c.kind].label})` }))}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <StatCard key={k.label} index={i} {...k} format={k.format ?? ((n) => (Math.abs(n) >= 1e6 ? `PKR ${compactPKR(n)}` : formatPKR(n)))} />
        ))}
      </div>
      {filtered && (
        <p className="-mt-2 text-[12.5px] text-muted">
          Figures cover {formatDate(period.from)} to {formatDate(period.to)}
          {eventId ? `, ${L.event.get(eventId)?.name}` : ""}
          {kind ? `, ${KIND_META[kind as TxnKind].plural.toLowerCase()} only` : ""}
          {categoryId ? `, ${L.category.get(categoryId)?.name}` : ""}. The balance above is always all-time.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Income vs expenses" description="Money in against expenses and aid, month by month" />
          <div className="px-3 pb-4 pt-3 sm:px-5">{series.length ? <CashflowChart data={series} /> : null}</div>
        </Card>
        <Card>
          <CardHeader title="Where money came from" description="Income by source" />
          <div className="p-5">
            <DonutChart data={incomeSlices} totalLabel="Money in" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Where money went"
            description="Aid is kept apart from running costs"
            action={
              <Tabs
                size="sm"
                value={outTab}
                onChange={setOutTab}
                items={[
                  { value: "all", label: "All" },
                  { value: "expense", label: "Costs" },
                  { value: "aid", label: "Aid" },
                ]}
              />
            }
          />
          <div className="p-5">
            <DonutChart key={outTab} data={outSlices} totalLabel={outTab === "aid" ? "Aid" : outTab === "expense" ? "Costs" : "Money out"} />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader
            title="Event performance"
            description="Revenue, spending and net per event"
            action={
              <Link href="/events" className="text-[13px] font-medium text-brand-700 hover:underline dark:text-brand-300">
                All events
              </Link>
            }
          />
          <div className="px-3 pb-4 pt-3 sm:px-5">
            {eventBars.length ? <EventPerformanceChart data={eventBars} /> : <p className="py-20 text-center text-sm text-muted">No event money in this period.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader title="Donation trend" description="Amount per month, with number of donations" />
          <div className="px-3 pb-4 pt-3 sm:px-5">
            <DonationTrendChart data={series} />
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader
            title="Vendor performance"
            description="Stall fees collected and still owed"
          />
          <div className="grid gap-4 p-5 lg:grid-cols-[200px_1fr]">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[
                { l: "Vendors", v: vendorStats.vendors, sub: `${vendorStats.bookings} stall bookings`, f: (n: number) => String(Math.round(n)) },
                { l: "Collected", v: vendorStats.collected, sub: `${vendorStats.paid} fully paid`, f: (n: number) => formatPKR(n) },
                { l: "Still owed", v: vendorStats.outstanding, sub: `${vendorStats.partial} partial, ${vendorStats.pending} not paid`, f: (n: number) => formatPKR(n), warn: vendorStats.outstanding > 0 },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-surface-2 px-3 py-2.5 ring-1 ring-line">
                  <p className="text-[12px] text-muted">{x.l}</p>
                  <p className={`font-display text-[18px] font-semibold ${x.warn ? "text-marigold-700 dark:text-amber-300" : ""}`}>
                    <AnimatedNumber value={x.v} format={x.f} />
                  </p>
                  <p className="text-[11.5px] text-muted">{x.sub}</p>
                </div>
              ))}
            </div>
            {vendorStats.bars.length ? <VendorCollectionChart data={vendorStats.bars} /> : <p className="self-center py-12 text-center text-sm text-muted">No vendor events in this period.</p>}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="overflow-hidden xl:col-span-3">
          <CardHeader
            title="Latest entries"
            description="Most recently recorded, newest first"
          />
          <div className="mt-3">
            <TxnList txns={recent} empty="Nothing recorded in this period." />
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader
            title="Active and upcoming events"
            action={
              can(me.role, "events.write") ? (
                <Link href="/events/new">
                  <Button size="sm" variant="secondary">
                    New event
                  </Button>
                </Link>
              ) : undefined
            }
          />
          <div className="space-y-2 p-5">
            {upcoming.length === 0 && <p className="py-8 text-center text-sm text-muted">No events planned.</p>}
            {upcoming.map((e, i) => {
              const sm = eventSummary(data, e.id);
              const target = e.type === "expenditure" ? e.budget : e.targetAmount;
              const value = e.type === "expenditure" ? sm.spend : sm.revenue;
              return (
                <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                  <Link href={`/events/${e.id}`} className="block rounded-2xl border border-line p-3.5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-card)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.name}</p>
                        <p className="text-[12px] text-muted">
                          {formatDate(e.startDate)} · {EVENT_TYPE_META[e.type].short}
                        </p>
                      </div>
                      <EventStatusBadge status={e.status} />
                    </div>
                    {target ? (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[12px]">
                          <span className="text-muted">{e.type === "expenditure" ? "Spent of budget" : "Raised of target"}</span>
                          <span className="num font-medium">
                            {compactPKR(value)} / {compactPKR(target)}
                          </span>
                        </div>
                        <Progress value={value} max={target} delay={0.2 + i * 0.1} color={e.type === "expenditure" ? FLOW_COLORS.expense : FLOW_COLORS.in} />
                      </div>
                    ) : null}
                    {e.type === "fundraiser" && sm.vendorCount > 0 && (
                      <p className="mt-2 text-[12px] text-muted">
                        {sm.vendorCount} vendors · {sm.paidVendors} paid · <span className={sm.outstanding ? "text-marigold-700 dark:text-amber-300" : ""}>{formatPKR(sm.outstanding)} owed</span>
                      </p>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------
/** Unpaid stall fees. The Finance Secretary can collect from here; the President sees the same list read-only. */
function AttentionStrip() {
  const me = useMe()!;
  const data = useApp((s) => s.data);
  const L = useLookups();
  const open = useUI((s) => s.open);
  const dues = useMemo(() => {
    const live = new Set(data.events.filter((e) => e.status === "active" || e.status === "planned" || e.status === "completed").map((e) => e.id));
    return L.ledger.filter((l) => l.remaining > 0 && live.has(l.booking.eventId)).sort((a, b) => b.remaining - a.remaining);
  }, [L.ledger, data.events]);
  const write = can(me.role, "finance.write");

  if (!can(me.role, "finance.view") || !dues.length) return null;
  const total = sum(dues, (d) => d.remaining);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-marigold-600" /> {formatPKR(total)} in stall fees still owed
          </span>
        }
        description={`${dues.length} vendors have not paid in full.${write ? " Tap Collect when they pay." : ""}`}
      />
      <div className="flex gap-3 overflow-x-auto p-5 pt-4">
        {dues.slice(0, 8).map((d, i) => {
          const v = L.vendor.get(d.booking.vendorId);
          return (
            <motion.div
              key={d.booking.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              className="w-[220px] shrink-0 rounded-2xl border border-line bg-surface-2 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium">{v?.businessName}</p>
                <StatusPill status={d.status} />
              </div>
              <p className="truncate text-[12px] text-muted">
                Stall {d.booking.stallNo} · {L.event.get(d.booking.eventId)?.name}
              </p>
              <Progress className="mt-3" value={d.paid} max={d.agreed} color="var(--color-inflow)" delay={0.1 + i * 0.05} />
              <div className="mt-2 flex items-center justify-between">
                <span className="num text-[13px] font-semibold text-marigold-700 dark:text-amber-300">{formatPKR(d.remaining)}</span>
                {write && (
                  <Button size="sm" variant="secondary" onClick={() => open({ kind: "vendorPayment", bookingId: d.booking.id })}>
                    <ReceiptText className="h-3.5 w-3.5" /> Collect
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

// =====================================================================================
function MemberDashboard() {
  const me = useMe()!;
  const data = useApp((s) => s.data);
  const summary = useApp((s) => s.memberSummary);
  const mine = data.eventMembers.filter((m) => m.profileId === me.id);
  const myEvents = mine.map((m) => ({ m, e: data.events.find((e) => e.id === m.eventId)! })).filter((x) => x.e);
  const upcoming = data.events.filter((e) => e.status === "active" || e.status === "planned").sort((a, b) => a.startDate.localeCompare(b.startDate));

  const stats = [
    { label: "Raised by the society", value: summary?.totalRaised ?? 0, icon: <Landmark className="h-4 w-4" />, accent: FLOW_COLORS.in },
    { label: "Given as aid", value: summary?.totalDistributed ?? 0, icon: <HeartHandshake className="h-4 w-4" />, accent: FLOW_COLORS.aid },
    { label: "People helped", value: summary?.peopleHelped ?? 0, icon: <Users className="h-4 w-4" />, accent: FLOW_COLORS.marigold, format: (n: number) => Math.round(n).toLocaleString("en-PK") },
    { label: "Events completed", value: summary?.eventsCompleted ?? 0, icon: <CalendarCheck2 className="h-4 w-4" />, accent: "#5EA8D6", format: (n: number) => Math.round(n).toString() },
  ];

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-700 to-brand-950 p-7 text-white"
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-marigold-400/25 blur-3xl" />
        <p className="text-sm text-brand-100/80">{greeting()},</p>
        <h1 className="mt-1 font-display text-[32px] font-semibold tracking-tight">{me.fullName}</h1>
        <p className="mt-2 max-w-xl text-brand-100/80">
          You are on {myEvents.length} event {myEvents.length === 1 ? "team" : "teams"}. Here is what the society has done together so far.
        </p>
      </motion.section>

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {stats.map((s, i) => (
          <StatCard key={s.label} index={i} {...s} />
        ))}
      </div>
      <p className="-mt-2 text-[12.5px] text-muted">Totals only. Donor names, recipient details and the ledger are visible to the Finance Secretary and President.</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="My events" description="Events you are assigned to" />
          <div className="space-y-2 p-5">
            {myEvents.length === 0 ? (
              <EmptyState icon={<CalendarRange className="h-6 w-6" />} title="No duties yet" description="When an officer adds you to an event team, it will show here." className="py-8" />
            ) : (
              myEvents.map(({ m, e }, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                  <Link href={`/events/${e.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3.5 transition hover:border-line-strong hover:bg-surface-2">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">
                      <CalendarRange className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block text-[12.5px] text-muted">
                        {formatDate(e.startDate)} · {e.location}
                      </span>
                    </span>
                    <Badge tone="brand">{m.duty}</Badge>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Coming up" description="Active and planned society events" action={<Link href="/events" className="text-[13px] font-medium text-brand-700 hover:underline dark:text-brand-300">All events</Link>} />
          <div className="space-y-2 p-5">
            {upcoming.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                  <span className="block text-[12px] text-muted">
                    {formatDate(e.startDate)} · {EVENT_TYPE_META[e.type].short}
                  </span>
                </span>
                <EventStatusBadge status={e.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
