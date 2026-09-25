"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useLookups } from "@/lib/hooks";
import { KIND_META } from "@/lib/constants";
import { formatDate, formatPKR } from "@/lib/utils";
import { Field, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { errorMessage } from "./shared";

export function VoidForm({ txnId, onDone }: { txnId: string; onDone: () => void }) {
  const t = useApp((s) => s.data.transactions.find((x) => x.id === txnId));
  const L = useLookups();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!t) return null;

  async function submit() {
    if (reason.trim().length < 5) return toast.error("Write a reason of at least a few words.");
    setBusy(true);
    try {
      await useApp.getState().voidTransaction(txnId, reason);
      toast.success(`${t!.code} voided`, { description: "It stays in the ledger but no longer counts toward any total." });
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
      <div className="space-y-4 px-6 py-5">
        <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">
              {t.code} · {KIND_META[t.kind].label}
            </span>
            <span className="num font-semibold">{formatPKR(t.amount)}</span>
          </div>
          <p className="mt-1 text-muted">
            {t.description} · {formatDate(t.date)}
            {t.eventId ? ` · ${L.event.get(t.eventId)?.name}` : ""}
          </p>
        </div>
        <p className="text-[13.5px] text-ink-2">
          Voiding keeps the record for the audit trail and removes it from every balance, report and vendor total. You cannot undo a void. If the amount was
          wrong, void this one and record the correct amount.
        </p>
        <Field label="Reason" required>
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice by mistake, see TXN-0142" autoFocus />}
        </Field>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Keep it
        </Button>
        <Button type="submit" variant="danger" loading={busy}>
          <Ban className="h-4 w-4" />
          Void transaction
        </Button>
      </ModalFooter>
    </form>
  );
}

/** Permanent delete, for entries that should never have existed (duplicates, test entries). */
export function DeleteForm({ txnId, onDone }: { txnId: string; onDone: () => void }) {
  const t = useApp((s) => s.data.transactions.find((x) => x.id === txnId));
  const L = useLookups();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!t) return null;
  const receipt = L.donationByTxn.get(t.id)?.receiptNo ?? L.paymentByTxn.get(t.id)?.receiptNo ?? L.distributionByTxn.get(t.id)?.referenceNo;

  async function submit() {
    if (reason.trim().length < 3) return toast.error("Write a short reason, e.g. \"entered twice\".");
    setBusy(true);
    try {
      await useApp.getState().deleteTransaction(txnId, reason);
      toast.success(`${t!.code} deleted`, { description: `${formatPKR(t!.amount)} removed from all totals.` });
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
      <div className="space-y-4 px-6 py-5">
        <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">
              {t.code} · {KIND_META[t.kind].label}
            </span>
            <span className="num font-semibold">{formatPKR(t.amount)}</span>
          </div>
          <p className="mt-1 text-muted">
            {t.description} · {formatDate(t.date)}
            {t.eventId ? ` · ${L.event.get(t.eventId)?.name}` : ""}
          </p>
        </div>
        <p className="text-[13.5px] text-ink-2">
          This removes the entry{receipt ? ` and receipt ${receipt}` : ""} for good. The balance, event totals and vendor dues update straight away. A copy stays in the
          activity log so you can still see what was deleted and why.
        </p>
        <Field label="Reason" required>
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice by mistake" autoFocus />}
        </Field>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Keep it
        </Button>
        <Button type="submit" variant="danger" loading={busy}>
          <Trash2 className="h-4 w-4" />
          Delete permanently
        </Button>
      </ModalFooter>
    </form>
  );
}
