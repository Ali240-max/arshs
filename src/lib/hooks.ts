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

/**
 * Opens a print page in a new tab. If the browser's popup blocker stops the tab
 * (common on a freshly deployed domain, and after an await such as "Save & print"),
 * it opens in the same tab instead, so the button never silently does nothing.
 */
export function openPage(url: string) {
  const w = window.open(url, "_blank");
  if (w) {
    try {
      w.opener = null;
    } catch {
      /* cross-origin guard, ignore */
    }
    return;
  }
  window.location.assign(url);
}

export function openReceipts(type: "vendor" | "donation", ids: string[]) {
  if (!ids.length) return;
  openPage(`/print/receipts?type=${type}&ids=${ids.join(",")}`);
}

export const openEventReport = (eventId: string) => openPage(`/print/event-report?id=${eventId}`);
