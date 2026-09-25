"use client";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download, Scale, Search, Trash2 } from "lucide-react";
import type { TxnKind } from "@/lib/types";
import { useApp, useRole } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useLookups } from "@/lib/hooks";
import { can } from "@/lib/permissions";
import { KIND_META, METHOD_LABEL } from "@/lib/constants";
import { cn, downloadCSV, formatDate, formatPKR, sum } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TD } from "@/components/ui/table";
import { KindIcon } from "@/components/txn-list";
import { FilterSelect, PeriodPicker, useAnchorDate, usePeriod, type PeriodPreset } from "@/components/filters";

const PAGE = 50;

export default function TransactionsPage() {
  const data = useApp((s) => s.data);
  const role = useRole();
  const open = useUI((s) => s.open);
  const L = useLookups();
  const write = can(role, "finance.write");
  const anchor = useAnchorDate();

  const [dir, setDir] = useState<"all" | "in" | "out">("all");
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [custom, setCustom] = useState({ from: `${anchor.slice(0, 4)}-01-01`, to: anchor });
  const period = usePeriod(preset, custom);
  const [kind, setKind] = useState("");
  const [eventId, setEventId] = useState("");
  const [method, setMethod] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  // Who the money came from or went to, pulled from the linked record when the ledger row has none
  const party = (id: string, counterparty?: string) =>
    counterparty || L.donationByTxn.get(id)?.donorName || L.distributionByTxn.get(id)?.recipientName || (L.paymentByTxn.get(id) && L.vendor.get(L.booking.get(L.paymentByTxn.get(id)!.eventVendorId)?.vendorId ?? "")?.businessName) || "";

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.transactions
      .filter(
        (t) =>
          (showVoid || t.status === "posted") &&
          (dir === "all" || t.direction === dir) &&
          t.date >= period.from &&
          t.date <= period.to &&
          (!kind || t.kind === kind) &&
          (!eventId || t.eventId === eventId) &&
          (!method || t.method === method) &&
          (!term ||
            `${t.code} ${t.description} ${party(t.id, t.counterparty)} ${t.reference ?? ""} ${L.donationByTxn.get(t.id)?.receiptNo ?? ""} ${L.paymentByTxn.get(t.id)?.receiptNo ?? ""} ${t.amount}`
              .toLowerCase()
              .includes(term)),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data.transactions, showVoid, dir, period.from, period.to, kind, eventId, method, q, L]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = rows.filter((t) => t.status === "posted");
  const totalIn = sum(live.filter((t) => t.direction === "in"), (t) => t.amount);
  const totalOut = sum(live.filter((t) => t.direction === "out"), (t) => t.amount);

  function exportCSV() {
    downloadCSV(
      `transactions-${period.from}-to-${period.to}.csv`,
      rows.map((t) => ({
        Date: t.date,
        Code: t.code,
        Type: KIND_META[t.kind].label,
        Direction: t.direction === "in" ? "In" : "Out",
        Amount: t.amount,
        "From / to": party(t.id, t.counterparty),
        Description: t.description,
        Category: L.category.get(t.categoryId)?.name ?? "",
        Event: t.eventId ? (L.event.get(t.eventId)?.name ?? "") : "",
        Method: METHOD_LABEL[t.method],
        Receipt: L.donationByTxn.get(t.id)?.receiptNo ?? L.paymentByTxn.get(t.id)?.receiptNo ?? L.distributionByTxn.get(t.id)?.referenceNo ?? "",
        Status: t.status,
      })),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="Every rupee that came in or went out. Tap a row for full details."
        actions={
          <Button variant="secondary" onClick={exportCSV} disabled={!rows.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <StatCard index={0} label="Money in" value={totalIn} icon={<ArrowDownLeft className="h-4 w-4" />} accent="#169B6B" sub={`${live.filter((t) => t.direction === "in").length} entries`} />
        <StatCard index={1} label="Money out" value={totalOut} icon={<ArrowUpRight className="h-4 w-4" />} accent="#E2583E" sub={`${live.filter((t) => t.direction === "out").length} entries`} />
        <StatCard index={2} label="Net" value={totalIn - totalOut} icon={<Scale className="h-4 w-4" />} accent="#0E6B57" sub="In minus out, for this filter" />
        <StatCard index={3} label="Entries" value={rows.length} icon={<ArrowLeftRight className="h-4 w-4" />} accent="#5EA8D6" sub={showVoid ? "Including voided" : "Posted only"} format={(n) => String(Math.round(n))} />
      </div>

      <Card className="space-y-3 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Tabs
            size="sm"
            value={dir}
            onChange={(v) => {
              setDir(v);
              setKind("");
            }}
            items={[
              { value: "all", label: "All" },
              { value: "in", label: <><ArrowDownLeft className="h-3.5 w-3.5" /> Incoming</> },
              { value: "out", label: <><ArrowUpRight className="h-3.5 w-3.5" /> Outgoing</> },
            ]}
          />
          <PeriodPicker value={preset} onChange={setPreset} custom={custom} onCustom={setCustom} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Name, TXN code, receipt no. or amount"
              className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[13px] outline-none focus:border-brand-400"
            />
          </div>
          <FilterSelect
            label="Type"
            value={kind}
            onChange={setKind}
            placeholder="All types"
            options={(Object.keys(KIND_META) as TxnKind[]).filter((k) => dir === "all" || KIND_META[k].direction === dir).map((k) => ({ value: k, label: KIND_META[k].plural }))}
          />
          <FilterSelect label="Event" value={eventId} onChange={setEventId} placeholder="All events" options={[...data.events].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((e) => ({ value: e.id, label: e.name }))} />
          <FilterSelect label="Method" value={method} onChange={setMethod} placeholder="All methods" options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
          <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3 text-[13px] text-ink-2">
            <input type="checkbox" checked={showVoid} onChange={(e) => setShowVoid(e.target.checked)} className="accent-brand-600" /> Show voided
          </label>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight className="h-6 w-6" />} title="No transactions match" description="Try a wider date range or clear the filters." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Transaction</TH>
                <TH>From / to</TH>
                <TH>Event</TH>
                <TH>Method</TH>
                <TH align="right">Amount</TH>
                {write && <TH align="right"> </TH>}
              </tr>
            </THead>
            <tbody>
              {rows.slice(0, limit).map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 20) * 0.015 }}
                  onClick={() => open({ kind: "txn", txnId: t.id })}
                  className={cn("group cursor-pointer transition-colors hover:bg-surface-2", t.status === "void" && "opacity-55")}
                >
                  <TD className="whitespace-nowrap text-[13px] text-muted">{formatDate(t.date)}</TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <KindIcon kind={t.kind} className="h-8 w-8" />
                      <div className="min-w-0">
                        <p className="max-w-[280px] truncate font-medium">{t.description}</p>
                        <p className="flex items-center gap-1.5 text-[12px] text-muted">
                          {t.code} · {KIND_META[t.kind].label}
                          {t.status === "void" && <Badge tone="coral">Void</Badge>}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD className="max-w-[180px] truncate text-[13px]">{party(t.id, t.counterparty) || <span className="text-muted">–</span>}</TD>
                  <TD className="max-w-[200px] truncate text-[13px] text-ink-2">{t.eventId ? L.event.get(t.eventId)?.name : <span className="text-muted">General</span>}</TD>
                  <TD className="whitespace-nowrap text-[13px] text-ink-2">{METHOD_LABEL[t.method]}</TD>
                  <TD align="right" className="whitespace-nowrap">
                    <Money amount={t.amount} direction={t.direction} kind={t.kind} muted={t.status === "void"} />
                  </TD>
                  {write && (
                    <TD align="right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-40 transition group-hover:opacity-100 hover:text-coral"
                        title="Delete"
                        aria-label={`Delete ${t.code}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          open({ kind: "delete", txnId: t.id });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TD>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </Table>
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[13px] text-muted">
            <span>
              Showing {Math.min(limit, rows.length)} of {rows.length}
            </span>
            {limit < rows.length && (
              <Button size="sm" variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, rows.length - limit)} more
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
