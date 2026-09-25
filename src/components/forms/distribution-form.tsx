"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { HeartHandshake } from "lucide-react";
import type { PaymentMethod, RecipientType } from "@/lib/types";
import { RECIPIENT_TYPE_LABEL } from "@/lib/constants";
import { useApp } from "@/lib/store";
import { balanceSummary } from "@/lib/finance";
import { formatPKR, todayISO } from "@/lib/utils";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { CategorySelect, EventSelect, FormGrid, MethodPicker, errorMessage } from "./shared";

export function DistributionForm({ eventId, onDone }: { eventId?: string; onDone: () => void }) {
  const recordDistribution = useApp((s) => s.recordDistribution);
  const data = useApp((s) => s.data);
  const balance = useMemo(() => balanceSummary(data).balance, [data]);
  const firstCat = useMemo(() => data.categories.find((c) => c.kind === "distribution")?.id ?? "", [data.categories]);

  const [recipientName, setRecipientName] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("individual");
  const [recipientContact, setRecipientContact] = useState("");
  const [beneficiaryCount, setBeneficiaryCount] = useState("1");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [categoryId, setCategoryId] = useState(firstCat);
  const [event, setEvent] = useState(eventId ?? "");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const amt = Number(amount) || 0;
  const overdraw = amt > balance;

  async function submit() {
    const e: Record<string, string> = {};
    if (!(amt > 0)) e.amount = "Enter an amount above zero.";
    if (!recipientName.trim()) e.recipientName = "Enter who received the aid. Use initials if the family asked for privacy.";
    if (!(Number(beneficiaryCount) >= 1)) e.beneficiaryCount = "At least one person.";
    if (!notes.trim()) e.notes = "Write why this aid was approved. Auditors will ask.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await recordDistribution({
        date,
        amount: amt,
        categoryId,
        eventId: event || undefined,
        method,
        recipientName: recipientName.trim(),
        recipientType,
        recipientContact: recipientContact.trim() || undefined,
        beneficiaryCount: Number(beneficiaryCount),
        notes: notes.trim(),
      });
      toast.success(`Aid ${r.referenceNo} recorded`, { description: `${formatPKR(amt)} to ${recipientName.trim()}` });
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
        submit();
      }}
    >
      <FormGrid>
        <Field label="Recipient name" required error={errors.recipientName}>
          {(id) => <Input id={id} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Family of M. Aslam" autoFocus />}
        </Field>
        <Field label="Recipient type">
          {(id) => (
            <Select id={id} value={recipientType} onChange={(e) => setRecipientType(e.target.value as RecipientType)}>
              {Object.entries(RECIPIENT_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Contact" hint="Optional. Only officers can see it.">
          {(id) => <Input id={id} value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} placeholder="Phone or address" />}
        </Field>
        <Field label="People helped" error={errors.beneficiaryCount}>
          {(id) => <Input id={id} type="number" min={1} className="num" value={beneficiaryCount} onChange={(e) => setBeneficiaryCount(e.target.value)} />}
        </Field>
        <Field
          label="Amount"
          required
          error={errors.amount}
          hint={
            overdraw ? (
              <span className="text-coral">This is more than the current balance of {formatPKR(balance)}. You can still save it, but check first.</span>
            ) : (
              <>Available balance: {formatPKR(balance)}</>
            )
          }
        >
          {(id) => <MoneyInput id={id} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />}
        </Field>
        <Field label="Date" required>
          {(id) => <Input id={id} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Category">{(id) => <CategorySelect id={id} kind="distribution" value={categoryId} onChange={setCategoryId} />}</Field>
        <Field label="Campaign / event">{(id) => <EventSelect id={id} value={event} onChange={setEvent} placeholder="General fund (no event)" />}</Field>
        <Field label="Payment method" className="sm:col-span-2">
          {() => <MethodPicker value={method} onChange={setMethod} />}
        </Field>
        <Field label="Reason / approval note" required error={errors.notes} className="sm:col-span-2">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Dialysis session fees for 2 weeks, approved by President on 12 Sep" />}
        </Field>
      </FormGrid>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} className="bg-violet hover:bg-violet hover:brightness-95">
          <HeartHandshake className="h-4 w-4" />
          Record aid
        </Button>
      </ModalFooter>
    </form>
  );
}
