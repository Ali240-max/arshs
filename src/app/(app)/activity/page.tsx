"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Ban, BadgeCheck, ChevronDown, Download, Eye, LogIn, Pencil, Plus, Printer, Search, ShieldCheck, Trash2, Activity as ActivityIcon } from "lucide-react";
import type { AuditAction, AuditLog } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { cn, downloadCSV, formatDate, formatPKR, sum } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect, PeriodPicker, useAnchorDate, usePeriod, type PeriodPreset } from "@/components/filters";

const ACTION: Record<AuditAction, { label: string; Icon: typeof Plus; cls: string }> = {
  create: { label: "Created", Icon: Plus, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  update: { label: "Edited", Icon: Pencil, cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  delete: { label: "Deleted", Icon: Trash2, cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  void: { label: "Voided", Icon: Ban, cls: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" },
  verify: { label: "Verified", Icon: BadgeCheck, cls: "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" },
  view: { label: "Viewed", Icon: Eye, cls: "bg-surface-2 text-ink-2" },
  print: { label: "Printed", Icon: Printer, cls: "bg-surface-2 text-ink-2" },
  export: { label: "Exported", Icon: Download, cls: "bg-surface-2 text-ink-2" },
  login: { label: "Signed in", Icon: LogIn, cls: "bg-surface-2 text-ink-2" },
  role_change: { label: "Access changed", Icon: ShieldCheck, cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
};

const ENTITY_LABEL: Record<string, string> = {
  transaction: "Transaction",
  event: "Event",
  vendor: "Vendor",
  event_vendor: "Stall booking",
  booking: "Stall booking",
  vendor_payment: "Vendor payment",
  donation: "Donation",
  distribution: "Aid",
  profile: "Account",
  settings: "Settings",
  session: "Sign-in",
};
const entityLabel = (e: string) => ENTITY_LABEL[e] ?? e.replace(/_/g, " ");
const PAGE = 80;

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "number") return v.toLocaleString("en-PK");
  if (Array.isArray(v)) return v.length > 6 ? `${v.length} items` : v.map(fmt).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const name = o.name ?? o.businessName ?? o.business_name ?? o.description ?? o.code;
    const amount = o.amount;
    return [name, typeof amount === "number" || typeof amount === "string" ? formatPKR(Number(amount)) : null].filter(Boolean).join(" · ") || "record";
  }
  return String(v);
}

function Changes({ log }: { log: AuditLog }) {
  const entries = Object.entries(log.changes ?? {}).filter(([k]) => k !== "_demo");
  if (!entries.length) return null;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-line text-[12.5px]">
      {entries.map(([k, v]) => {
        const hasFromTo = v && typeof v === "object" && "from" in (v as object);
        const from = hasFromTo ? (v as { from: unknown }).from : undefined;
        const to = hasFromTo ? (v as { to: unknown }).to : v;
        return (
          <div key={k} className="grid grid-cols-[120px_1fr] gap-3 border-b border-line px-3 py-1.5 last:border-0">
            <span className="text-muted">{k.replace(/_/g, " ")}</span>
            <span className="min-w-0 break-words">
              {hasFromTo && from !== undefined && (
                <>
                  <span className="text-red-600 line-through decoration-red-300 dark:text-red-400">{fmt(from)}</span>
                  <span className="mx-1.5 text-muted">→</span>
                </>
              )}
              <span className="font-medium">{hasFromTo && to === null ? "removed" : fmt(to)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ActivityPage() {
  const data = useApp((s) => s.data);
  const mode = useApp((s) => s.mode);
  const open = useUI((s) => s.open);
  const anchor = useAnchorDate();
  const [preset, setPreset] = useState<PeriodPreset>("3m");
  const [custom, setCustom] = useState({ from: `${anchor.slice(0, 7)}-01`, to: anchor });
  const period = usePeriod(preset, custom);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [entity, setEntity] = useState("");
  const [hideRoutine, setHideRoutine] = useState(true);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const txnIds = useMemo(() => new Set(data.transactions.map((t) => t.id)), [data.transactions]);
  const eventIds = useMemo(() => new Set(data.events.map((e) => e.id)), [data.events]);
  const actors = useMemo(() => [...new Set(data.auditLogs.map((l) => l.actorName))].sort(), [data.auditLogs]);
  const entities = useMemo(() => [...new Set(data.auditLogs.map((l) => l.entity))].sort(), [data.auditLogs]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.auditLogs
      .filter((l) => {
        const day = l.createdAt.slice(0, 10);
        return (
          day >= period.from &&
          day <= period.to &&
          (!action || l.action === action) &&
          (!actor || l.actorName === actor) &&
          (!entity || l.entity === entity) &&
          (!hideRoutine || action || !["login", "view", "print", "export"].includes(l.action)) &&
          (!term || `${l.summary} ${l.actorName} ${l.entity}`.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.auditLogs, period.from, period.to, action, actor, entity, hideRoutine, q]);

  const shown = rows.slice(0, limit);
  const days = useMemo(() => {
    const m = new Map<string, AuditLog[]>();
    for (const l of shown) {
      const d = l.createdAt.slice(0, 10);
      m.set(d, [...(m.get(d) ?? []), l]);
    }
    return [...m.entries()];
  }, [shown]);

  const count = (a: AuditAction[]) => sum(rows, (l) => (a.includes(l.action) ? 1 : 0));
  const stats = [
    { label: "Entries", value: rows.length },
    { label: "Money & records changed", value: count(["create", "update"]) },
    { label: "Deletes & voids", value: count(["delete", "void"]), warn: true },
    { label: "People active", value: new Set(rows.map((l) => l.actorName)).size },
  ];

  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Every change anyone made: what, who and when. Entries can't be edited or removed from the app."
        actions={
          <Button
            variant="secondary"
            disabled={!rows.length}
            onClick={() =>
              downloadCSV(
                `activity-${period.from}-to-${period.to}.csv`,
                rows.map((l) => ({ Time: l.createdAt, Who: l.actorName, Action: ACTION[l.action]?.label ?? l.action, What: entityLabel(l.entity), Summary: l.summary })),
              )
            }
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-4">
              <p className="text-[12.5px] text-muted">{s.label}</p>
              <p className={cn("num mt-1 font-display text-[22px] font-semibold", s.warn && s.value > 0 && "text-coral")}>{s.value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="space-y-3 p-3">
        <PeriodPicker value={preset} onChange={setPreset} custom={custom} onCustom={setCustom} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Search, e.g. TXN-0142, Pizza Point, opening balance"
              className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-brand-400"
            />
          </div>
          <FilterSelect label="Action" value={action} onChange={setAction} placeholder="All actions" options={(Object.keys(ACTION) as AuditAction[]).map((a) => ({ value: a, label: ACTION[a].label }))} />
          <FilterSelect label="Person" value={actor} onChange={setActor} placeholder="Everyone" options={actors.map((a) => ({ value: a, label: a }))} />
          <FilterSelect label="Record type" value={entity} onChange={setEntity} placeholder="All records" options={entities.map((e) => ({ value: e, label: entityLabel(e) }))} />
          <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3 text-[13px] text-ink-2" title="Sign-ins, prints and exports">
            <input type="checkbox" checked={hideRoutine} onChange={(e) => setHideRoutine(e.target.checked)} className="accent-brand-600" /> Hide sign-ins & prints
          </label>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={<ActivityIcon className="h-6 w-6" />} title="No activity matches" description="Try a longer period or clear the filters." />
      ) : (
        <div className="space-y-5">
          {days.map(([day, logs], di) => (
            <section key={day}>
              <div className="sticky top-16 z-[5] -mx-1 mb-2 flex items-center gap-3 bg-bg/80 px-1 py-1.5 backdrop-blur">
                <h2 className="text-[13px] font-semibold">{formatDate(day, "long")}</h2>
                <span className="text-[12px] text-muted">{logs.length} {logs.length === 1 ? "entry" : "entries"}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {logs.map((l, i) => {
                    const meta = ACTION[l.action] ?? ACTION.update;
                    const hasChanges = Object.keys(l.changes ?? {}).some((k) => k !== "_demo");
                    const isOpen = expanded.has(l.id);
                    const txnLink = l.entity === "transaction" && l.entityId && txnIds.has(l.entityId);
                    const eventLink = l.entity === "event" && l.entityId && eventIds.has(l.entityId);
                    return (
                      <motion.li key={l.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(di * 4 + i, 20) * 0.015 }} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", meta.cls)}>
                            <meta.Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] leading-snug">{l.summary}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                              <span className="font-medium text-ink-2">{l.actorName}</span>
                              <span>·</span>
                              <span>{time(l.createdAt)}</span>
                              <span>·</span>
                              <span>
                                {meta.label} {entityLabel(l.entity).toLowerCase()}
                              </span>
                              {txnLink && (
                                <button onClick={() => open({ kind: "txn", txnId: l.entityId! })} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                                  Open
                                </button>
                              )}
                              {eventLink && (
                                <Link href={`/events/${l.entityId}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                                  Open
                                </Link>
                              )}
                            </p>
                          </div>
                          {hasChanges && (
                            <button onClick={() => toggle(l.id)} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted transition hover:bg-surface-2 hover:text-ink" aria-expanded={isOpen}>
                              Details
                              <motion.span animate={{ rotate: isOpen ? 180 : 0 }}>
                                <ChevronDown className="h-3.5 w-3.5" />
                              </motion.span>
                            </button>
                          )}
                        </div>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-11">
                              <Changes log={l} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
          <div className="flex items-center justify-between text-[13px] text-muted">
            <span>
              Showing {shown.length} of {rows.length}
              {mode === "supabase" ? " (the app loads the latest 1,000 entries; older ones are in Supabase, table audit_logs)" : ""}
            </span>
            {limit < rows.length && (
              <Button size="sm" variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                Show more
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
