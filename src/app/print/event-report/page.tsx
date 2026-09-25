"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { useApp } from "@/lib/store";
import { useLookups } from "@/lib/hooks";
import { eventSummary } from "@/lib/finance";
import { EVENT_STATUS_LABEL, EVENT_TYPE_META, KIND_META, METHOD_LABEL } from "@/lib/constants";
import { amountInWords, downloadCSV, formatDate, formatDateTime, formatPKR, sum } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/layout/logo";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm">Loading report…</p>}>
      <EventReport />
    </Suspense>
  );
}

const n = (v: number) => v.toLocaleString("en-PK");

function EventReport() {
  const id = useSearchParams().get("id") ?? "";
  const { ready, userId, init, data, logActivity } = useApp();
  const L = useLookups();
  const logged = useRef(false);
  useEffect(() => {
    init();
  }, [init]);

  const e = data.events.find((x) => x.id === id);
  const me = data.profiles.find((p) => p.id === userId);
  const s = useMemo(() => (e ? eventSummary(data, e.id) : null), [data, e]);
  const vendors = useMemo(
    () => L.ledger.filter((l) => l.booking.eventId === id).sort((a, b) => a.booking.stallNo.localeCompare(b.booking.stallNo, undefined, { numeric: true })),
    [L.ledger, id],
  );
  const txns = useMemo(() => data.transactions.filter((t) => t.eventId === id && t.status === "posted").sort((a, b) => a.date.localeCompare(b.date)), [data.transactions, id]);
  const otherIn = txns.filter((t) => t.direction === "in" && t.kind !== "vendor_payment");
  const out = txns.filter((t) => t.direction === "out");
  const days = Math.max(1, ...vendors.map((v) => v.booking.dayFees.length));

  useEffect(() => {
    if (ready && e && me && !logged.current) {
      logged.current = true;
      logActivity("print", "event", `Opened event report for ${e.name}`);
    }
  }, [ready, e, me, logActivity]);

  if (!ready) return <p className="p-10 text-center text-sm">Loading report…</p>;
  if (!me || me.role === "member") return <p className="p-10 text-center text-sm">Sign in as the Finance Secretary or President to see this report.</p>;
  if (!e || !s) return <p className="p-10 text-center text-sm">Event not found.</p>;

  const who = (id: string, cp?: string) => cp || L.donationByTxn.get(id)?.donorName || (L.donationByTxn.get(id)?.isAnonymous ? "Anonymous" : "") || L.distributionByTxn.get(id)?.recipientName || "";
  const totalIn = s.revenue;
  const totalOut = s.spend;

  function exportVendors() {
    downloadCSV(
      `${e!.code}-vendors.csv`,
      vendors.map((r, i) => {
        const v = L.vendor.get(r.booking.vendorId);
        const row: Record<string, string | number> = { "#": i + 1, Stall: r.booking.stallNo, Vendor: v?.businessName ?? "", Owner: v?.ownerName ?? "", Phone: v?.phone ?? "" };
        for (let d = 0; d < days; d++) row[`Day ${d + 1}`] = r.booking.dayFees[d] ?? 0;
        return {
          ...row,
          Agreed: r.agreed,
          Paid: r.paid,
          Balance: r.remaining,
          Status: r.status,
          Receipts: r.payments.filter((p) => p.txn.status === "posted").map((p) => `${p.payment.receiptNo} (${p.txn.date}, ${p.txn.amount})`).join("; "),
        };
      }),
    );
  }

  return (
    <div className="min-h-dvh bg-[#eef3f1] py-6 print:bg-white print:py-0">
      <style>{"@page { size: A4; margin: 12mm; }"}</style>
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center gap-2 px-4">
        <p className="text-sm font-medium text-[#0f2621]">Event report · {e.name}</p>
        <div className="ml-auto flex gap-2">
          {vendors.length > 0 && (
            <Button variant="secondary" onClick={exportVendors}>
              <Download className="h-4 w-4" /> Vendors CSV
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / save PDF
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-[190mm] bg-white p-8 text-[12px] text-black shadow print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 border-black pb-3">
          <LogoMark className="h-12 w-12" />
          <div className="flex-1">
            <p className="font-display text-[18px] font-semibold leading-tight">{data.settings.societyName}</p>
            <p className="text-gray-600">{data.settings.subtitle}</p>
          </div>
          <div className="text-right">
            <p className="text-[14px] font-bold uppercase tracking-wide">Event Financial Report</p>
            <p className="text-gray-600">{e.code}</p>
          </div>
        </div>

        {e.status !== "completed" && (
          <p className="mt-3 rounded border border-amber-500 bg-amber-50 px-3 py-1.5 text-amber-800">
            This event is marked <b>{EVENT_STATUS_LABEL[e.status]}</b>. Figures may still change until it is completed.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1">
          {[
            ["Event", e.name],
            ["Type", EVENT_TYPE_META[e.type].label],
            ["Dates", `${formatDate(e.startDate, "long")}${e.endDate !== e.startDate ? ` to ${formatDate(e.endDate, "long")}` : ""} (${e.days} day${e.days > 1 ? "s" : ""})`],
            ["Location", e.location],
            ["Status", EVENT_STATUS_LABEL[e.status]],
            ["Prepared", `${formatDateTime(new Date().toISOString())} by ${me.fullName}`],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="w-20 shrink-0 text-gray-600">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <h2 className="mt-6 border-b border-black pb-1 text-[13px] font-bold uppercase tracking-wide">Summary</h2>
        <table className="mt-2 w-full">
          <tbody>
            {e.type === "fundraiser" && (
              <>
                <SumRow label={`Vendor stall fees agreed (${vendors.length} vendors)`} value={s.agreedTotal} muted />
                <SumRow label="Vendor stall fees collected" value={s.vendorRevenue} />
              </>
            )}
            {s.donations > 0 && <SumRow label="Donations" value={s.donations} />}
            {s.otherIncome > 0 && <SumRow label="Other income" value={s.otherIncome} />}
            <SumRow label="Total money in" value={totalIn} bold />
            {s.expenses > 0 && <SumRow label="Expenses" value={-s.expenses} />}
            {s.aid > 0 && <SumRow label="Aid given" value={-s.aid} />}
            <SumRow label="Total money out" value={-totalOut} bold />
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between rounded border-2 border-black px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-600">Grand total (net result)</p>
            <p className="italic text-gray-700">{amountInWords(Math.abs(s.net))}{s.net < 0 ? " (loss)" : ""}</p>
          </div>
          <p className="num text-[22px] font-bold">{formatPKR(s.net, { sign: true })}</p>
        </div>
        {e.type === "fundraiser" && s.outstanding > 0 && (
          <p className="mt-2 text-amber-800">
            Still owed by vendors: <b>{formatPKR(s.outstanding)}</b> ({s.partialVendors} partly paid, {s.pendingVendors} not paid). Not included in the totals above.
          </p>
        )}

        {/* Vendors */}
        {vendors.length > 0 && (
          <>
            <h2 className="mt-6 border-b border-black pb-1 text-[13px] font-bold uppercase tracking-wide">Vendors ({vendors.length})</h2>
            <table className="mt-2 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1 pr-1">#</th>
                  <th className="py-1 pr-1">Stall</th>
                  <th className="py-1 pr-1">Vendor</th>
                  {Array.from({ length: days }, (_, d) => (
                    <th key={d} className="py-1 pr-1 text-right">
                      Day {d + 1}
                    </th>
                  ))}
                  <th className="py-1 pr-1 text-right">Agreed</th>
                  <th className="py-1 pr-1 text-right">Paid</th>
                  <th className="py-1 pr-1 text-right">Balance</th>
                  <th className="py-1 pr-1">Status</th>
                  <th className="py-1">Receipts</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((r, i) => {
                  const v = L.vendor.get(r.booking.vendorId);
                  const pays = r.payments.filter((p) => p.txn.status === "posted");
                  return (
                    <tr key={r.booking.id} className="break-inside-avoid border-b border-gray-300 align-top">
                      <td className="py-1 pr-1 text-gray-500">{i + 1}</td>
                      <td className="py-1 pr-1 whitespace-nowrap">{r.booking.stallNo}</td>
                      <td className="py-1 pr-1">
                        <p className="font-medium">{v?.businessName}</p>
                        {(v?.ownerName || v?.phone) && <p className="text-gray-600">{[v?.ownerName, v?.phone].filter(Boolean).join(" · ")}</p>}
                      </td>
                      {Array.from({ length: days }, (_, d) => (
                        <td key={d} className="num py-1 pr-1 text-right">
                          {r.booking.dayFees[d] ? n(r.booking.dayFees[d]) : "–"}
                        </td>
                      ))}
                      <td className="num py-1 pr-1 text-right">{n(r.agreed)}</td>
                      <td className="num py-1 pr-1 text-right font-medium">{n(r.paid)}</td>
                      <td className="num py-1 pr-1 text-right">{r.remaining ? n(r.remaining) : "–"}</td>
                      <td className="py-1 pr-1 capitalize">{r.status}</td>
                      <td className="py-1 text-gray-700">
                        {pays.length
                          ? pays.map((p) => (
                              <p key={p.payment.id} className="whitespace-nowrap">
                                {p.payment.receiptNo} · {formatDate(p.txn.date).replace(/ \d{4}$/, "")} · {n(p.txn.amount)}
                              </p>
                            ))
                          : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td className="py-1.5" colSpan={3}>
                    Total
                  </td>
                  {Array.from({ length: days }, (_, d) => (
                    <td key={d} className="num py-1.5 pr-1 text-right">
                      {n(sum(vendors, (r) => r.booking.dayFees[d] ?? 0))}
                    </td>
                  ))}
                  <td className="num py-1.5 pr-1 text-right">{n(s.agreedTotal)}</td>
                  <td className="num py-1.5 pr-1 text-right">{n(s.vendorRevenue)}</td>
                  <td className="num py-1.5 pr-1 text-right">{n(s.outstanding)}</td>
                  <td colSpan={2} className="py-1.5 font-normal text-gray-600">
                    {s.paidVendors} paid · {s.partialVendors} partial · {s.pendingVendors} pending
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

        <TxnTable title="Other money in" rows={otherIn} who={who} L={L} />
        <TxnTable title="Money out (expenses and aid)" rows={out} who={who} L={L} />

        <p className="mt-6 text-[10.5px] text-gray-500">
          Voided entries are excluded. Every figure comes from the society ledger; transaction codes can be checked in the app.
        </p>
        <div className="mt-14 grid grid-cols-2 gap-16">
          {["Finance Secretary", "President"].map((sig) => (
            <div key={sig} className="border-t border-black pt-1 text-center text-gray-700">
              {sig}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SumRow({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <tr className={bold ? "border-t border-gray-400 font-bold" : muted ? "text-gray-500" : ""}>
      <td className="py-1">{label}</td>
      <td className="num py-1 text-right">{formatPKR(value)}</td>
    </tr>
  );
}

function TxnTable({
  title,
  rows,
  who,
  L,
}: {
  title: string;
  rows: ReturnType<typeof useApp.getState>["data"]["transactions"];
  who: (id: string, cp?: string) => string;
  L: ReturnType<typeof useLookups>;
}) {
  if (!rows.length) return null;
  return (
    <>
      <h2 className="mt-6 border-b border-black pb-1 text-[13px] font-bold uppercase tracking-wide">{title}</h2>
      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2">Date</th>
            <th className="py-1 pr-2">Code</th>
            <th className="py-1 pr-2">Type</th>
            <th className="py-1 pr-2">Details</th>
            <th className="py-1 pr-2">Method</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="break-inside-avoid border-b border-gray-300 align-top">
              <td className="py-1 pr-2 whitespace-nowrap">{formatDate(t.date)}</td>
              <td className="py-1 pr-2 whitespace-nowrap">{t.code}</td>
              <td className="py-1 pr-2">{L.category.get(t.categoryId)?.name ?? KIND_META[t.kind].label}</td>
              <td className="py-1 pr-2">
                {t.description}
                {who(t.id, t.counterparty) ? <span className="text-gray-600"> · {who(t.id, t.counterparty)}</span> : null}
              </td>
              <td className="py-1 pr-2">{METHOD_LABEL[t.method]}</td>
              <td className="num py-1 text-right">{n(t.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td colSpan={5} className="py-1.5">
              Total
            </td>
            <td className="num py-1.5 text-right">{n(sum(rows, (t) => t.amount))}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}
