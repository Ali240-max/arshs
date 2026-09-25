"use client";
import { useMemo } from "react";
import { useApp } from "./store";
import { vendorLedger } from "./finance";

/** Id -> record maps for fast lookups in tables. */
export function useLookups() {
  const data = useApp((s) => s.data);
  return useMemo(() => {
    const ledger = vendorLedger(data);
    return {
      category: new Map(data.categories.map((c) => [c.id, c])),
      event: new Map(data.events.map((e) => [e.id, e])),
      vendor: new Map(data.vendors.map((v) => [v.id, v])),
      booking: new Map(data.eventVendors.map((b) => [b.id, b])),
      profile: new Map(data.profiles.map((p) => [p.id, p])),
      donationByTxn: new Map(data.donations.map((d) => [d.transactionId, d])),
      distributionByTxn: new Map(data.distributions.map((d) => [d.transactionId, d])),
      paymentByTxn: new Map(data.vendorPayments.map((p) => [p.transactionId, p])),
      ledgerByBooking: new Map(ledger.map((l) => [l.booking.id, l])),
      ledger,
    };
  }, [data]);
}

export function openReceipts(type: "vendor" | "donation", ids: string[]) {
  if (!ids.length) return;
  window.open(`/print/receipts?type=${type}&ids=${ids.join(",")}`, "_blank", "noopener");
}
