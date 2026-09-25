"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HandHeart } from "lucide-react";
import type { PaymentMethod } from "@/lib/types";
import { DONATION_PURPOSES } from "@/lib/constants";
import { useApp } from "@/lib/store";
import { openReceipts } from "@/lib/hooks";
import { formatPKR, todayISO } from "@/lib/utils";
import { Field, Input, MoneyInput, Textarea, Toggle } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { CategorySelect, EventSelect, FormGrid, MethodPicker, errorMessage } from "./shared";

const QUICK = [500, 1000, 2000, 5000, 10000];

export function DonationForm({ eventId, onDone }: { eventId?: string; onDone: () => void }) {
  const recordDonation = useApp((s) => s.recordDonation);
  const categories = useApp((s) => s.data.categories);
  const firstCat = useMemo(() => categories.find((c) => c.kind === "donation")?.id ?? "", [categories]);

  const [anon, setAnon] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [categoryId, setCategoryId] = useState(firstCat);
  const [purpose, setPurpose] = useState(DONATION_PURPOSES[0]);
  const [event, setEvent] = useState(eventId ?? "");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(print: boolean) {
    const e: Record<string, string> = {};
    const amt = Number(amount);
    if (!(amt > 0)) e.amount = "Enter an amount above zero.";
    if (!anon && !donorName.trim()) e.donorName = "Enter the donor's name, or mark the donation anonymous.";
    if (!date) e.date = "Pick a date.";
    if (!purpose.trim()) e.purpose = "Enter what the donation is for.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await recordDonation({
        date,
        amount: amt,
        categoryId,
        eventId: event || undefined,
        method,
        donorName: anon ? undefined : donorName.trim(),
        donorPhone: anon ? undefined : donorPhone.trim() || undefined,
        isAnonymous: anon,
        purpose: purpose.trim(),
        notes: notes.trim() || undefined,
      });
      toast.success(`Donation ${r.receiptNo} recorded`, {
        description: `${formatPKR(amt)} from ${anon ? "an anonymous donor" : donorName.trim()}`,
        action: { label: "Print receipt", onClick: () => openReceipts("donation", [r.transactionId]) },
      });
      if (print) openReceipts("donation", [r.transactionId]);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        submit(false);
      }}
    >
      <FormGrid>
        <div className="sm:col-span-2">
          <Toggle checked={anon} onChange={setAnon} label="Anonymous donor" description="The receipt and reports will say Anonymous. No name or phone is stored." />
        </div>
        {!anon && (
          <>
            <Field label="Donor name" required error={errors.donorName}>
              {(id) => <Input id={id} value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="e.g. Dr. Saima Qureshi" autoFocus />}
            </Field>
            <Field label="Phone" hint="Optional. Used to send a thank-you.">
              {(id) => <Input id={id} value={donorPhone} onChange={(e) => setDonorPhone(e.target.value)} placeholder="03xx-xxxxxxx" inputMode="tel" />}
            </Field>
          </>
        )}
        <Field label="Amount" required error={errors.amount} className="sm:col-span-2">
          {(id) => (
            <div className="space-y-2">
              <MoneyInput id={id} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    className="num rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-marigold-400 hover:bg-marigold-50 dark:hover:bg-amber-950/30"
                  >
                    {q.toLocaleString("en-PK")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>
        <Field label="Date" required error={errors.date}>
          {(id) => <Input id={id} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Donation type">{(id) => <CategorySelect id={id} kind="donation" value={categoryId} onChange={setCategoryId} />}</Field>
        <Field label="Purpose" required error={errors.purpose}>
          {(id) => (
            <>
              <Input id={id} list="donation-purposes" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              <datalist id="donation-purposes">
                {DONATION_PURPOSES.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Campaign / event">{(id) => <EventSelect id={id} value={event} onChange={setEvent} placeholder="General fund (no event)" />}</Field>
        <Field label="Payment method" className="sm:col-span-2">
          {() => <MethodPicker value={method} onChange={setMethod} />}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the next Finance Secretary should know" />}
        </Field>
      </FormGrid>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" loading={busy} onClick={() => submit(true)}>
          Save & print receipt
        </Button>
        <Button type="submit" variant="marigold" loading={busy}>
          <HandHeart className="h-4 w-4" />
          Record donation
        </Button>
      </ModalFooter>
    </form>
  );
}
