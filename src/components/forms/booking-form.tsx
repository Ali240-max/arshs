"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Store, UserPlus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { STALL_TYPES } from "@/lib/constants";
import { useApp } from "@/lib/store";
import { useLookups } from "@/lib/hooks";
import { formatPKR } from "@/lib/utils";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { FormGrid, errorMessage } from "./shared";

/** Adds a vendor to an event (from the directory or new), or edits an existing stall booking. */
export function BookingForm({ eventId, bookingId, onDone }: { eventId: string; bookingId?: string; onDone: () => void }) {
  const { addBooking, updateBooking, createVendor } = useApp.getState();
  const data = useApp((s) => s.data);
  const L = useLookups();
  const event = L.event.get(eventId);
  const existing = bookingId ? L.booking.get(bookingId) : undefined;
  const paid = existing ? (L.ledgerByBooking.get(existing.id)?.paid ?? 0) : 0;
  const defaultFee = event?.defaultDayFee ?? 0;

  const [source, setSource] = useState<"directory" | "new">("directory");
  const [vendorId, setVendorId] = useState(existing?.vendorId ?? "");
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [stallNo, setStallNo] = useState(existing?.stallNo ?? suggestStall(data.eventVendors.filter((b) => b.eventId === eventId).map((b) => b.stallNo)));
  const [stallType, setStallType] = useState(existing?.stallType ?? "Food");
  // New bookings start with one day. The + button adds more, each pre-filled with the previous day's fee.
  const [fees, setFees] = useState<string[]>(existing ? existing.dayFees.map(String) : [String(defaultFee || "")]);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const available = useMemo(() => {
    const taken = new Set(data.eventVendors.filter((b) => b.eventId === eventId).map((b) => b.vendorId));
    return data.vendors.filter((v) => !taken.has(v.id)).sort((a, b) => a.businessName.localeCompare(b.businessName));
  }, [data.vendors, data.eventVendors, eventId]);
  const total = fees.reduce((a, f) => a + (Number(f) || 0), 0);

  async function submit() {
    const dayFees = fees.map((f) => Math.max(0, Number(f) || 0));
    if (!stallNo.trim()) return setError("Give the stall a number, e.g. A-12.");
    if (dayFees.every((f) => f === 0)) return setError("Enter a fee for at least one day.");
    if (existing && total < paid) return setError(`This vendor has already paid ${formatPKR(paid)}. Fees cannot total less than that.`);
    setError(undefined);
    setBusy(true);
    try {
      if (existing) {
        await updateBooking(existing.id, { stallNo: stallNo.trim(), stallType, dayFees, notes: notes.trim() || undefined });
        toast.success("Stall booking updated");
      } else {
        let vid = vendorId;
        if (source === "new") {
          if (!businessName.trim()) {
            setBusy(false);
            return setError("Enter the business or stall name.");
          }
          vid = await createVendor({ businessName: businessName.trim(), ownerName: ownerName.trim() || undefined, phone: phone.trim() || undefined, stallType });
        } else if (!vid) {
          setBusy(false);
          return setError("Choose a vendor from the directory, or switch to New vendor.");
        }
        await addBooking({ eventId, vendorId: vid, stallNo: stallNo.trim(), stallType, dayFees, notes: notes.trim() || undefined });
        toast.success("Vendor added to event", { description: `Stall ${stallNo.trim()} · ${formatPKR(total)} agreed` });
      }
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
        submit();
      }}
    >
      <FormGrid>
        {existing ? (
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 sm:col-span-2">
            <p className="font-medium">{L.vendor.get(existing.vendorId)?.businessName}</p>
            <p className="text-[12.5px] text-muted">Paid so far: {formatPKR(paid)}</p>
          </div>
        ) : (
          <>
            <div className="sm:col-span-2">
              <Tabs
                size="sm"
                value={source}
                onChange={setSource}
                items={[
                  { value: "directory", label: <><Store className="h-3.5 w-3.5" /> From directory</>, count: available.length },
                  { value: "new", label: <><UserPlus className="h-3.5 w-3.5" /> New vendor</> },
                ]}
              />
            </div>
            {source === "directory" ? (
              <Field label="Vendor" className="sm:col-span-2" hint="Vendors who already have a stall at this event are hidden.">
                {(id) => (
                  <Select
                    id={id}
                    value={vendorId}
                    onChange={(e) => {
                      setVendorId(e.target.value);
                      const v = L.vendor.get(e.target.value);
                      if (v?.stallType) setStallType(v.stallType);
                    }}
                  >
                    <option value="">Choose vendor</option>
                    {available.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.businessName}
                        {v.ownerName ? ` (${v.ownerName})` : ""}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <>
                <Field label="Business / stall name" required>
                  {(id) => <Input id={id} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Sitara Bakery" autoFocus />}
                </Field>
                <Field label="Owner name">{(id) => <Input id={id} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />}</Field>
                <Field label="Phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />}</Field>
              </>
            )}
          </>
        )}
        <Field label="Stall no." required>
          {(id) => <Input id={id} value={stallNo} onChange={(e) => setStallNo(e.target.value)} placeholder="A-12" />}
        </Field>
        <Field label="Stall type">
          {(id) => (
            <Select id={id} value={stallType} onChange={(e) => setStallType(e.target.value)}>
              {STALL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Fee per day</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {fees.map((f, i) => (
                <motion.label
                  key={i}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="block"
                >
                  <span className="mb-1 flex items-center justify-between text-[12px] text-muted">
                    Day {i + 1}
                    {fees.length > 1 && i === fees.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setFees((prev) => prev.slice(0, -1))}
                        className="rounded p-0.5 text-muted transition hover:bg-surface-2 hover:text-coral"
                        aria-label={`Remove day ${i + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                  <MoneyInput aria-label={`Day ${i + 1} fee`} value={f} onChange={(e) => setFees((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} />
                </motion.label>
              ))}
            </AnimatePresence>
            <motion.button
              layout
              type="button"
              onClick={() => setFees((prev) => [...prev, prev[prev.length - 1] || String(defaultFee || "")])}
              disabled={fees.length >= 14}
              className="mt-[22px] flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[13px] font-medium text-ink-2 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40 dark:hover:bg-brand-900/30 dark:hover:text-brand-200"
            >
              <Plus className="h-4 w-4" /> Add day
            </motion.button>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">
            Enter 0 for a day the vendor will not trade. Agreed total: <span className="num font-semibold text-ink">{formatPKR(total)}</span>
          </p>
        </div>
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Needs electricity point, arrives at 10am" />}
        </Field>
        {error && <p className="text-[13px] text-coral sm:col-span-2">{error}</p>}
      </FormGrid>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {existing ? "Save booking" : "Add to event"}
        </Button>
      </ModalFooter>
    </form>
  );
}

/** Next free stall number, following the pattern already in use (A-1, A-2 ...). */
function suggestStall(existing: string[]) {
  if (!existing.length) return "A-1";
  const nums = existing.map((s) => s.match(/^([A-Za-z]*)-?(\d+)$/)).filter(Boolean) as RegExpMatchArray[];
  if (!nums.length) return "";
  const prefix = nums[nums.length - 1][1];
  const max = Math.max(...nums.filter((m) => m[1] === prefix).map((m) => Number(m[2])));
  return `${prefix}${prefix ? "-" : ""}${max + 1}`;
}
