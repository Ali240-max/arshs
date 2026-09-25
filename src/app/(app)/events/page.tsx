"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CalendarRange, MapPin, Plus, Search } from "lucide-react";
import type { EventStatus, EventType } from "@/lib/types";
import { useApp, useMe } from "@/lib/store";
import { can } from "@/lib/permissions";
import { eventSummary } from "@/lib/finance";
import { EVENT_STATUS_LABEL, EVENT_TYPE_META, FLOW_COLORS } from "@/lib/constants";
import { cn, compactPKR, formatDate, formatPKR } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/filters";
import { EventStatusBadge, EventTypeIcon, EVENT_TYPE_STYLE } from "@/components/event-bits";

export default function EventsPage() {
  const me = useMe()!;
  const data = useApp((s) => s.data);
  const officer = me.role !== "member";
  const [status, setStatus] = useState<"all" | EventStatus>("all");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const myIds = new Set(data.eventMembers.filter((m) => m.profileId === me.id).map((m) => m.eventId));

  const visible = useMemo(() => data.events.filter((e) => officer || e.status !== "cancelled"), [data.events, officer]);
  const list = useMemo(
    () =>
      visible
        .filter((e) => (status === "all" || e.status === status) && (!type || e.type === type) && (!q || `${e.name} ${e.code} ${e.location}`.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => {
          const rank = (s: EventStatus) => ({ active: 0, planned: 1, completed: 2, cancelled: 3 })[s];
          return rank(a.status) - rank(b.status) || b.startDate.localeCompare(a.startDate);
        }),
    [visible, status, type, q],
  );
  const count = (s: EventStatus) => visible.filter((e) => e.status === s).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description={officer ? "Vendor fairs, relief drives and collection campaigns. Each one tracks its own money." : "Society events. Events you are assigned to are marked."}
        actions={
          can(me.role, "events.write") && (
            <Link href="/events/new">
              <Button>
                <Plus className="h-4 w-4" /> New event
              </Button>
            </Link>
          )
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={status}
          onChange={setStatus}
          items={[
            { value: "all", label: "All", count: visible.length },
            { value: "active", label: "Active", count: count("active") },
            { value: "planned", label: "Planned", count: count("planned") },
            { value: "completed", label: "Completed", count: count("completed") },
            ...(officer ? [{ value: "cancelled" as const, label: "Cancelled", count: count("cancelled") }] : []),
          ]}
        />
        <div className="flex flex-1 gap-2 lg:justify-end">
          <FilterSelect label="Event type" value={type} onChange={setType} placeholder="All types" className="w-44" options={(Object.keys(EVENT_TYPE_META) as EventType[]).map((t) => ({ value: t, label: EVENT_TYPE_META[t].short }))} />
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events"
              className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13px] outline-none transition focus:border-brand-400"
            />
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="h-6 w-6" />}
          title="No events match"
          description="Try another status or clear the search."
          action={can(me.role, "events.write") ? <Link href="/events/new"><Button>Create an event</Button></Link> : undefined}
        />
      ) : (
        <motion.div layout className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((e, i) => {
              const s = officer ? eventSummary(data, e.id) : null;
              const target = e.type === "expenditure" ? e.budget : e.targetAmount;
              const value = s ? (e.type === "expenditure" ? s.spend : s.revenue) : 0;
              return (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href={`/events/${e.id}`}
                    className={cn(
                      "group relative block h-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
                      e.status === "cancelled" && "opacity-60",
                    )}
                  >
                    <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent opacity-70 transition-opacity group-hover:opacity-100", EVENT_TYPE_STYLE[e.type].tint)} />
                    <div className="relative flex items-start justify-between gap-3">
                      <EventTypeIcon type={e.type} className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {myIds.has(e.id) && <span className="rounded-full bg-marigold-400 px-2 py-0.5 text-[11.5px] font-semibold text-brand-950">Your event</span>}
                        <EventStatusBadge status={e.status} />
                      </div>
                    </div>
                    <p className="relative mt-4 font-display text-[18px] font-semibold leading-snug tracking-tight">{e.name}</p>
                    <p className="relative mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
                      <span>
                        {formatDate(e.startDate)}
                        {e.endDate !== e.startDate ? ` to ${formatDate(e.endDate)}` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {e.location}
                      </span>
                    </p>
                    <p className="relative mt-1 text-[12px] font-medium" style={{ color: EVENT_TYPE_STYLE[e.type].color }}>
                      {EVENT_TYPE_META[e.type].short} · {e.code}
                    </p>

                    {s && (
                      <div className="relative mt-5 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            ["In", s.revenue, "text-inflow"],
                            ["Out", s.spend, "text-coral"],
                            ["Net", s.net, s.net >= 0 ? "text-ink" : "text-coral"],
                          ].map(([l, v, c]) => (
                            <div key={l as string} className="rounded-xl bg-surface-2 px-2 py-2 ring-1 ring-line">
                              <p className="text-[11px] text-muted">{l}</p>
                              <p className={`num text-[14px] font-semibold ${c}`}>{compactPKR(v as number)}</p>
                            </div>
                          ))}
                        </div>
                        {target ? (
                          <div>
                            <div className="mb-1 flex justify-between text-[12px]">
                              <span className="text-muted">{e.type === "expenditure" ? "Budget used" : "Target reached"}</span>
                              <span className="num font-medium">{Math.round((value / target) * 100)}%</span>
                            </div>
                            <Progress value={value} max={target} color={e.type === "expenditure" ? FLOW_COLORS.expense : FLOW_COLORS.in} delay={0.15 + i * 0.04} />
                          </div>
                        ) : null}
                        {e.type === "fundraiser" && (
                          <p className="text-[12px] text-muted">
                            {s.vendorCount} vendors · {s.paidVendors} paid
                            {s.outstanding > 0 && <span className="text-marigold-700 dark:text-amber-300"> · {formatPKR(s.outstanding)} owed</span>}
                          </p>
                        )}
                      </div>
                    )}
                    {!s && <p className="relative mt-4 text-[12.5px] text-muted">{EVENT_STATUS_LABEL[e.status]} · {e.days} day{e.days > 1 ? "s" : ""}</p>}
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
