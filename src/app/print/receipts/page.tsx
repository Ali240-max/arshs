"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { useApp } from "@/lib/store";
import { useLookups } from "@/lib/hooks";
import { METHOD_LABEL } from "@/lib/constants";
import { amountInWords, formatDate, formatPKR, sum } from "@/lib/utils";
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
      return ids.flatMap((pid) => {
        const p = data.vendorPayments.find((x) => x.id === pid);
        const t = p && data.transactions.find((x) => x.id === p.transactionId);
        const row = p && L.ledgerByBooking.get(p.eventVendorId);
        if (!p || !t || !row) return [];
        const v = L.vendor.get(row.booking.vendorId);
        const ev = L.event.get(row.booking.eventId);
        // Paid up to and including this payment, so a reprinted old slip still shows the balance at that time
        const upto = row.payments.filter((x) => x.txn.status === "posted" && (x.txn.date < t.date || (x.txn.date === t.date && x.txn.createdAt <= t.createdAt)));
        const paidToDate = sum(upto, (x) => x.txn.amount);
        return [
          {
            key: pid,
            title: "Vendor Payment Receipt",
            receiptNo: p.receiptNo,
            date: t.date,
            amount: t.amount,
            method: METHOD_LABEL[t.method],
            isVoid: t.status === "void",
            rows: [
              ["Event", ev?.name ?? ""],
              ["Vendor", [v?.businessName, v?.ownerName].filter(Boolean).join(" · ")],
              ["Stall no.", `${row.booking.stallNo}${row.booking.stallType ? ` (${row.booking.stallType})` : ""}`],
              ["For", t.description],
              ["Agreed fee", formatPKR(row.agreed)],
              ["Paid to date", formatPKR(paidToDate)],
              ["Balance due", formatPKR(Math.max(row.agreed - paidToDate, 0))],
            ],
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
      <style>{size === "a4" ? "@page { size: A4; margin: 10mm; }" : "@page { size: 80mm auto; margin: 3mm; }"}</style>
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
          <div className={size === "a4" ? "mx-auto max-w-[190mm] bg-white px-4 shadow print:shadow-none" : "mx-auto w-[74mm] bg-white p-2 shadow print:shadow-none"}>
            {copies.map((copy, ci) => (
              <div key={copy}>
                {ci > 0 && (
                  <div className="my-5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400">
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
    <div className={`relative text-black ${thermal ? "text-[11px]" : "py-6 text-[13px]"}`}>
      {s.isVoid && <div className="pointer-events-none absolute inset-0 grid place-items-center text-6xl font-bold uppercase text-red-500/25 [transform:rotate(-18deg)]">Void</div>}
      <div className={`flex items-center gap-3 ${thermal ? "flex-col text-center" : ""}`}>
        <LogoMark className={thermal ? "h-8 w-8" : "h-12 w-12"} />
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
      <table className="mt-3 w-full">
        <tbody>
          {s.rows.map(([k, v]) => (
            <tr key={k}>
              <td className="w-[34%] py-1 pr-2 align-top text-gray-600">{k}</td>
              <td className="py-1 font-medium">{v}</td>
            </tr>
          ))}
          <tr>
            <td className="py-1 pr-2 text-gray-600">Method</td>
            <td className="py-1 font-medium">{s.method}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 rounded border-2 border-black p-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-gray-600">Amount received</span>
          <span className={`num font-bold ${thermal ? "text-[16px]" : "text-[22px]"}`}>{formatPKR(s.amount)}</span>
        </div>
        <p className="mt-0.5 italic text-gray-700">{amountInWords(s.amount)}</p>
      </div>
      <div className={`grid gap-6 ${thermal ? "mt-8 grid-cols-1" : "mt-12 grid-cols-2"}`}>
        {s.signatures.map((sig) => (
          <div key={sig} className="border-t border-black pt-1 text-center text-gray-700">
            {sig}
          </div>
        ))}
      </div>
      {footer && <p className="mt-4 text-center text-[11px] text-gray-500">{footer}</p>}
    </div>
  );
}
