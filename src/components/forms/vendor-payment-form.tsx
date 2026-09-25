"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, ReceiptText } from "lucide-react";
import type { PaymentMethod } from "@/lib/types";
import { useApp } from "@/lib/store";
import { openReceipts, useLookups } from "@/lib/hooks";
import { formatDate, formatPKR, todayISO } from "@/lib/utils";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { FormGrid, MethodPicker, errorMessage } from "./shared";

/**
 * The form used at the stall. Pick the event and vendor, tap an amount chip, save and print.
 * Three taps for the common case of a vendor paying the full day fee in cash.
 */
export function VendorPaymentForm({ bookingId, eventId, onDone }: { bookingId?: string; eventId?: string; onDone: () => void }) {
  const recordVendorPayment = useApp((s) => s.recordVendorPayment);
  const data = useApp((s) => s.data);
  const L = useLookups();

  const initialEvent = eventId ?? (bookingId ? L.booking.get(bookingId)?.eventId : undefined) ?? "";
  const [event, setEvent] = useState(initialEvent);
  const [booking, setBooking] = useState(bookingId ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const fundraisers = useMemo(
    () => data.events.filter((e) => e.type === "fundraiser" && e.status !== "cancelled").sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [data.events],
  );
  const bookings = useMemo(
    () =>
      L.ledger
        .filter((l) => l.booking.eventId === event)
        .sort((a, b) => (a.remaining > 0 ? 0 : 1) - (b.remaining > 0 ? 0 : 1) || a.booking.stallNo.localeCompare(b.booking.stallNo, undefined, { numeric: true })),
    [L.ledger, event],
  );
  const row = booking ? L.ledgerByBooking.get(booking) : undefined;
  const vendor = row ? L.vendor.get(row.booking.vendorId) : undefined;
  const amt = Number(amount) || 0;

  const chips = useMemo(() => {
    if (!row || row.remaining <= 0) return [];
    const out: { label: string; value: number }[] = [{ label: "Full balance", value: row.remaining }];
    const uniqueFees = [...new Set(row.booking.dayFees.filter((f) => f > 0 && f < row.remaining))];
    uniqueFees.forEach((f) => out.push({ label: "One day", value: f }));
    if (row.remaining >= 2000 && !uniqueFees.includes(Math.round(row.remaining / 2))) out.push({ label: "Half", value: Math.round(row.remaining / 2) });
    return out;
  }, [row]);

  async function submit(print: boolean) {
    if (!row) return setError("Pick the vendor first.");
    if (!(amt > 0)) return setError("Enter an amount above zero.");
    if (amt > row.remaining) return setError(`The vendor owes ${formatPKR(row.remaining)}. Amount cannot be more than that.`);
    setError(undefined);
    setBusy(true);
    try {
      const r = await recordVendorPayment({ eventVendorId: row.booking.id, amount: amt, date, method, notes: notes.trim() || undefined });
      toast.success(`Receipt ${r.receiptNo} issued`, {
        description: `${formatPKR(amt)} from ${vendor?.businessName}. ${amt === row.remaining ? "Fully paid." : `${formatPKR(row.remaining - amt)} still due.`}`,
        action: { label: "Print slip", onClick: () => openReceipts("vendor", [r.paymentId]) },
      });
      if (print) openReceipts("vendor", [r.paymentId]);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
    >
      <FormGrid>
        <Field label="Event">
          {(id) => (
            <Select
              id={id}
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setBooking("");
                setAmount("");
              }}
            >
              <option value="">Choose event</option>
              {fundraisers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Vendor / stall">
          {(id) => (
            <Select
              id={id}
              value={booking}
              disabled={!event}
              onChange={(e) => {
                setBooking(e.target.value);
                setAmount("");
              }}
            >
              <option value="">{event ? "Choose vendor" : "Pick an event first"}</option>
              {bookings.map((l) => (
                <option key={l.booking.id} value={l.booking.id} disabled={l.remaining <= 0}>
                  {l.booking.stallNo} · {L.vendor.get(l.booking.vendorId)?.businessName} {l.remaining > 0 ? `(owes ${l.remaining.toLocaleString("en-PK")})` : "(paid)"}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {row && (
          <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-50/70 to-surface p-4 dark:from-brand-900/30 sm:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[17px] font-semibold">{vendor?.businessName}</p>
                <p className="text-[12.5px] text-muted">
                  Stall {row.booking.stallNo}
                  {vendor?.ownerName ? ` · ${vendor.ownerName}` : ""}
                  {vendor?.phone ? ` · ${vendor.phone}` : ""}
                </p>
              </div>
              <StatusPill status={row.status} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Agreed", row.agreed, "text-ink"],
                ["Paid", row.paid, "text-inflow"],
                ["Remaining", row.remaining, row.remaining ? "text-coral" : "text-muted"],
              ].map(([l, v, c]) => (
                <div key={l as string} className="rounded-xl bg-surface/80 px-2 py-2 ring-1 ring-line">
                  <div className="text-[11.5px] text-muted">{l}</div>
                  <div className={`num font-display text-[15px] font-semibold ${c}`}>{formatPKR(v as number)}</div>
                </div>
              ))}
            </div>
            <Progress className="mt-3" value={row.paid + amt} max={row.agreed} color="var(--color-inflow)" />
            <p className="mt-1.5 text-[12px] text-muted">
              Day fees: {row.booking.dayFees.map((f, i) => `Day ${i + 1} ${f ? f.toLocaleString("en-PK") : "absent"}`).join(" · ")}
              {row.lastPaymentDate ? ` · last paid ${formatDate(row.lastPaymentDate)}` : ""}
            </p>
          </div>
        )}

        <Field label="Amount received" error={error} className="sm:col-span-2">
          {(id) => (
            <div className="space-y-2">
              <MoneyInput id={id} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" disabled={!row || row.remaining <= 0} />
              {chips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <button
                      key={c.label + c.value}
                      type="button"
                      onClick={() => setAmount(String(c.value))}
                      className="rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/40"
                    >
                      {c.label} <span className="num text-muted">{c.value.toLocaleString("en-PK")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>
        <Field label="Payment date">
          {(id) => <Input id={id} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Note on receipt" hint="Defaults to “Stall … fee”.">
          {(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Day 1 fee" />}
        </Field>
        <Field label="Payment method" className="sm:col-span-2">
          {() => <MethodPicker value={method} onChange={setMethod} methods={["cash", "easypaisa", "jazzcash", "bank_transfer", "other"]} />}
        </Field>
      </FormGrid>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" loading={busy} onClick={() => submit(false)} disabled={!row}>
          <ReceiptText className="h-4 w-4" />
          Save only
        </Button>
        <Button type="submit" loading={busy} disabled={!row}>
          <Printer className="h-4 w-4" />
          Save & print slip
        </Button>
      </ModalFooter>
    </form>
  );
}
