"use client";
import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useApp } from "@/lib/store";
import { useLookups } from "@/lib/hooks";
import { METHOD_LABEL } from "@/lib/constants";
import { amountInWords, formatDate, formatPKR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { LogoMark } from "@/components/layout/logo";

interface Slip {
  key: string;
  title: string;
  receiptNo: string;
  date: string;
  amount: number;
  method: string;
  rows: [string, string][];
  signatures: string[];
  isVoid: boolean;
  payments?: { no: string; date: string; amount: number; note: string }[];
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm">Loading receipts…</p>}>
      <Receipts />
    </Suspense>
  );
}

function Receipts() {
  const params = useSearchParams();
  const type = params.get("type") === "donation" ? "donation" : "vendor";
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const { ready, userId, init, data, logActivity } = useApp();
  const L = useLookups();
  const [size, setSize] = useState<"a4" | "thermal">("a4");
  const logged = useRef(false);

  useEffect(() => {
    init();
  }, [init]);

  const slips = useMemo<Slip[]>(() => {
    if (type === "vendor") {
      // One slip per vendor booking, covering every payment for all days
      const bookingIds: string[] = [];
      for (const pid of ids) {
        const p = data.vendorPayments.find((x) => x.id === pid);
        if (p && !bookingIds.includes(p.eventVendorId)) bookingIds.push(p.eventVendorId);
      }
      return bookingIds.flatMap((bid) => {
        const row = L.ledgerByBooking.get(bid);
        if (!row) return [];
        const pays = row.payments
          .filter((x) => x.txn.status === "posted")
          .sort((a, b) => (a.txn.date + a.txn.createdAt).localeCompare(b.txn.date + b.txn.createdAt));
        if (!pays.length) return [];
        const last = pays[pays.length - 1];
        const v = L.vendor.get(row.booking.vendorId);
        const ev = L.event.get(row.booking.eventId);
        return [
          {
            key: bid,
            title: "Vendor Payment Receipt",
            receiptNo: last.payment.receiptNo,
            date: last.txn.date,
            amount: row.paid,
            method: [...new Set(pays.map((x) => METHOD_LABEL[x.txn.method]))].join(", "),
            isVoid: false,
            rows: [
              ["Event", ev?.name ?? ""],
              ["Vendor", [v?.businessName, v?.ownerName].filter(Boolean).join(" · ")],
              ["Stall no.", `${row.booking.stallNo}${row.booking.stallType ? ` (${row.booking.stallType})` : ""}`],
              ["Agreed fee", formatPKR(row.agreed)],
              ["Balance due", formatPKR(row.remaining)],
            ],
            payments: pays.map((x) => ({ no: x.payment.receiptNo, date: x.txn.date, amount: x.txn.amount, note: x.txn.description })),
            signatures: ["Vendor signature", "Finance Secretary"],
          },
        ];
      });
    }
    return ids.flatMap((tid) => {
      const t = data.transactions.find((x) => x.id === tid);
      const d = L.donationByTxn.get(tid);
      if (!t || !d) return [];
      return [
        {
          key: tid,
          title: "Donation Receipt",
          receiptNo: d.receiptNo,
          date: t.date,
          amount: t.amount,
          method: METHOD_LABEL[t.method],
          isVoid: t.status === "void",
          rows: [
            ["Received from", d.isAnonymous ? "Anonymous donor" : `${d.donorName ?? ""}${d.donorPhone ? ` · ${d.donorPhone}` : ""}`],
            ["Purpose", d.purpose],
            ["Type", L.category.get(t.categoryId)?.name ?? ""],
            ...(t.eventId ? ([["Campaign", L.event.get(t.eventId)?.name ?? ""]] as [string, string][]) : []),
          ],
          signatures: ["Finance Secretary", "President"],
        },
      ];
    });
  }, [type, ids.join(","), data, L]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready && userId && slips.length && !logged.current) {
      logged.current = true;
      logActivity("print", type === "vendor" ? "vendor_payment" : "donation", `Printed ${slips.length} ${type} receipt${slips.length > 1 ? "s" : ""}: ${slips.map((s) => s.receiptNo).join(", ")}`);
    }
  }, [ready, userId, slips, type, logActivity]);

  if (!ready) return <p className="p-10 text-center text-sm">Loading receipts…</p>;
  if (!userId) return <p className="p-10 text-center text-sm">Sign in first, then print again.</p>;
  if (!slips.length) return <p className="p-10 text-center text-sm">No receipts found for this link.</p>;

  const settings = data.settings;
  const copies = size === "a4" ? (type === "vendor" ? ["Vendor copy", "Society copy"] : ["Donor copy", "Society copy"]) : [""];

  return (
    <div className="min-h-dvh bg-[#eef3f1] py-6 print:bg-white print:py-0">
      <style>{size === "a4" ? "@page { size: A4 portrait; margin: 10mm; }" : "@page { size: 80mm auto; margin: 3mm; }"}</style>
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center gap-3 px-4">
        <p className="text-sm font-medium text-[#0f2621]">
          {slips.length} receipt{slips.length > 1 ? "s" : ""}
        </p>
        <Tabs size="sm" value={size} onChange={setSize} items={[{ value: "a4", label: "A4 (2 copies)" }, { value: "thermal", label: "80mm slip" }]} />
        <Button className="ml-auto" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {slips.map((s, i) => (
        <div key={s.key} className={i < slips.length - 1 ? "print-break" : ""}>
          {/* A4: one sheet per receipt, split into two fixed halves (vendor copy + society copy), so it can never spill onto a second page */}
          <div
            className={
              size === "a4"
                ? "mx-auto mb-6 flex h-[275mm] w-full max-w-[190mm] flex-col overflow-hidden bg-white px-5 shadow print:mb-0 print:max-w-none print:px-0 print:shadow-none"
                : "mx-auto w-[74mm] bg-white p-2 shadow print:shadow-none"
            }
          >
            {copies.map((copy, ci) => (
              <div key={copy} className={size === "a4" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : undefined}>
                {ci > 0 && (
                  <div className="flex shrink-0 items-center gap-2 py-1 text-[9px] uppercase tracking-widest text-gray-400">
                    <span className="flex-1 border-t border-dashed border-gray-400" /> cut here <span className="flex-1 border-t border-dashed border-gray-400" />
                  </div>
                )}
                <ReceiptBody s={s} copy={copy} thermal={size === "thermal"} society={settings.societyName} subtitle={settings.subtitle} footer={settings.receiptFooter} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceiptBody({ s, copy, thermal, society, subtitle, footer }: { s: Slip; copy: string; thermal: boolean; society: string; subtitle: string; footer: string }) {
  return (
    <div className={`relative flex flex-col text-black ${thermal ? "text-[11px]" : "h-full min-h-0 py-4 text-[12px]"}`}>
      {s.isVoid && <div className="pointer-events-none absolute inset-0 grid place-items-center text-6xl font-bold uppercase text-red-500/25 [transform:rotate(-18deg)]">Void</div>}
      <div className={`flex items-center gap-3 ${thermal ? "flex-col text-center" : ""}`}>
        <LogoMark className={thermal ? "h-10 w-10" : "h-14 w-14"} />
        <div className={thermal ? "" : "flex-1"}>
          <p className={`font-display font-semibold leading-tight ${thermal ? "text-[13px]" : "text-[18px]"}`}>{society}</p>
          <p className="text-gray-600">{subtitle}</p>
        </div>
        {!thermal && copy && <span className="rounded border border-gray-400 px-2 py-0.5 text-[11px] uppercase tracking-wider text-gray-600">{copy}</span>}
      </div>
      <div className={`mt-3 flex items-end justify-between border-y-2 border-black py-1.5 ${thermal ? "flex-col items-center gap-0.5" : ""}`}>
        <p className="font-semibold uppercase tracking-wide">{s.title}</p>
        <p>
          No. <span className="font-mono font-semibold">{s.receiptNo}</span> · {formatDate(s.date)}
        </p>
      </div>
      <table className={thermal ? "mt-3 w-full" : "mt-2 w-full"}>
        <tbody>
          {s.rows.map(([k, v]) => (
            <tr key={k}>
              <td className={`w-[30%] pr-2 align-top text-gray-600 ${thermal ? "py-1" : "py-[3px]"}`}>{k}</td>
              <td className={`font-medium ${thermal ? "py-1" : "py-[3px]"}`}>{v}</td>
            </tr>
          ))}
          <tr>
            <td className={`pr-2 text-gray-600 ${thermal ? "py-1" : "py-[3px]"}`}>Method</td>
            <td className={`font-medium ${thermal ? "py-1" : "py-[3px]"}`}>{s.method}</td>
          </tr>
        </tbody>
      </table>
      {s.payments && s.payments.length > 4 && (
        <p className={`mt-2 leading-snug ${thermal ? "text-[10px]" : "text-[10.5px]"}`}>
          <span className="font-semibold">Payments: </span>
          {s.payments.map((p, i) => (
            <Fragment key={p.no}>
              <span className="whitespace-nowrap">
                <span className="font-mono">{p.no}</span> ({formatDate(p.date).replace(/ \d{4}$/, "")}) {p.amount.toLocaleString("en-PK")}
              </span>
              {i < s.payments!.length - 1 ? " · " : ""}
            </Fragment>
          ))}
        </p>
      )}
      {s.payments && s.payments.length <= 4 && (
        <table className={`w-full border-collapse ${thermal ? "mt-2 text-[10px]" : "mt-2 text-[11px]"}`}>
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-[2px] pr-2 font-semibold">Receipt</th>
              <th className="py-[2px] pr-2 font-semibold">Date</th>
              {!thermal && <th className="py-[2px] pr-2 font-semibold">For</th>}
              <th className="py-[2px] text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {s.payments.map((p) => (
              <tr key={p.no} className="border-b border-gray-300">
                <td className="py-[2px] pr-2 font-mono">{p.no}</td>
                <td className="py-[2px] pr-2 whitespace-nowrap">{formatDate(p.date)}</td>
                {!thermal && <td className="py-[2px] pr-2">{p.note}</td>}
                <td className="num py-[2px] text-right">{p.amount.toLocaleString("en-PK")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className={`rounded border-2 border-black ${thermal ? "mt-3 p-2.5" : "mt-2 px-3 py-2"}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-gray-600">{s.payments && s.payments.length > 1 ? `Total received (${s.payments.length} payments)` : "Amount received"}</span>
          <span className={`num font-bold ${thermal ? "text-[16px]" : "text-[22px]"}`}>{formatPKR(s.amount)}</span>
        </div>
        <p className="mt-0.5 italic text-gray-700">{amountInWords(s.amount)}</p>
      </div>
      <div className={`grid gap-6 ${thermal ? "mt-8 grid-cols-1" : "mt-auto grid-cols-2 pt-8"}`}>
        {s.signatures.map((sig) => (
          <div key={sig} className="border-t border-black pt-1 text-center text-gray-700">
            {sig}
          </div>
        ))}
      </div>
      {footer && <p className={`text-center text-[10.5px] text-gray-500 ${thermal ? "mt-4" : "mt-2"}`}>{footer}</p>}
    </div>
  );
}
