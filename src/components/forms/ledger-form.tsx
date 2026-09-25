"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { PaymentMethod } from "@/lib/types";
import { useApp } from "@/lib/store";
import { eventSummary } from "@/lib/finance";
import { formatPKR, todayISO } from "@/lib/utils";
import { Field, Input, MoneyInput } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { CategorySelect, EventSelect, FormGrid, MethodPicker, errorMessage } from "./shared";

/** Records an operating/event expense or an "other income" line (student stalls, sponsorship, etc). */
export function LedgerForm({ kind, eventId, onDone }: { kind: "income" | "expense"; eventId?: string; onDone: () => void }) {
  const recordLedger = useApp((s) => s.recordLedger);
  const data = useApp((s) => s.data);
  const firstCat = useMemo(() => data.categories.find((c) => c.kind === kind)?.id ?? "", [data.categories, kind]);
  const isExpense = kind === "expense";

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState(firstCat);
  const [event, setEvent] = useState(eventId ?? "");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [counterparty, setCounterparty] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const ev = data.events.find((e) => e.id === event);
  const budgetInfo = useMemo(() => {
    if (!isExpense || !ev?.budget) return null;
    const s = eventSummary(data, ev.id);
    return { budget: ev.budget, spent: s.expenses };
  }, [isExpense, ev, data]);
  const amt = Number(amount) || 0;

  async function submit() {
    const e: Record<string, string> = {};
    if (!(amt > 0)) e.amount = "Enter an amount above zero.";
    if (!description.trim()) e.description = isExpense ? "Say what was bought or paid for." : "Say where the money came from.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await recordLedger(kind, {
        date,
        amount: amt,
        categoryId,
        eventId: event || undefined,
        method,
        counterparty: counterparty.trim() || undefined,
        description: description.trim(),
        reference: reference.trim() || undefined,
      });
      toast.success(isExpense ? "Expense recorded" : "Income recorded", { description: `${formatPKR(amt)} · ${description.trim()}` });
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
        <Field label="Description" required error={errors.description} className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isExpense ? "e.g. Shamiana and 40 chairs for 2 days" : "e.g. Student stalls, day 1 and 2"}
              autoFocus
            />
          )}
        </Field>
        <Field label="Amount" required error={errors.amount}>
          {(id) => <MoneyInput id={id} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />}
        </Field>
        <Field label="Date" required>
          {(id) => <Input id={id} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Category">{(id) => <CategorySelect id={id} kind={kind} value={categoryId} onChange={setCategoryId} />}</Field>
        <Field label="Event">{(id) => <EventSelect id={id} value={event} onChange={setEvent} placeholder="Not linked to an event" />}</Field>
        {budgetInfo && (
          <div className="rounded-xl border border-line bg-surface-2 p-3 sm:col-span-2">
            <div className="mb-2 flex justify-between text-[12.5px]">
              <span className="text-muted">Budget used for {ev!.name}</span>
              <span className="num font-medium">
                {formatPKR(budgetInfo.spent + amt)} / {formatPKR(budgetInfo.budget)}
              </span>
            </div>
            <Progress value={budgetInfo.spent + amt} max={budgetInfo.budget} color={budgetInfo.spent + amt > budgetInfo.budget ? "var(--color-coral)" : "var(--color-brand-600)"} />
            {budgetInfo.spent + amt > budgetInfo.budget && (
              <p className="mt-2 text-[12px] text-coral">This takes the event over budget by {formatPKR(budgetInfo.spent + amt - budgetInfo.budget)}.</p>
            )}
          </div>
        )}
        <Field label={isExpense ? "Paid to" : "Received from"}>
          {(id) => <Input id={id} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={isExpense ? "Supplier or person" : "Source"} />}
        </Field>
        <Field label="Bill / reference no." hint="Write the number on the paper bill.">
          {(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />}
        </Field>
        <Field label="Payment method" className="sm:col-span-2">
          {() => <MethodPicker value={method} onChange={setMethod} />}
        </Field>
      </FormGrid>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} variant={isExpense ? "danger" : "primary"}>
          {isExpense ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
          {isExpense ? "Record expense" : "Record income"}
        </Button>
      </ModalFooter>
    </form>
  );
}
