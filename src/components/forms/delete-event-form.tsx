"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { eventSummary } from "@/lib/finance";
import { formatPKR } from "@/lib/utils";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { errorMessage } from "./shared";

export function DeleteEventForm({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const data = useApp((s) => s.data);
  const router = useRouter();
  const e = data.events.find((x) => x.id === eventId);
  const s = useMemo(() => (e ? eventSummary(data, eventId) : null), [data, e, eventId]);
  const txnCount = data.transactions.filter((t) => t.eventId === eventId).length;
  const [reason, setReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!e || !s) return null;
  const hasMoney = txnCount > 0 || s.vendorCount > 0;
  const nameOk = !hasMoney || confirmName.trim().toLowerCase() === e.name.trim().toLowerCase();

  async function submit() {
    if (reason.trim().length < 3) return toast.error("Write a short reason.");
    if (!nameOk) return toast.error("Type the event name exactly to confirm.");
    setBusy(true);
    try {
      await useApp.getState().deleteEvent(eventId, reason);
      toast.success(`${e!.name} deleted`);
      onDone();
      router.replace("/events");
    } catch (err) {
      toast.error(errorMessage(err));
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
      <div className="space-y-4 px-6 py-5">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13.5px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">This permanently deletes {e.name} and everything recorded against it:</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">
            <li>{txnCount} transactions (money in {formatPKR(s.revenue)}, money out {formatPKR(s.spend)})</li>
            {s.vendorCount > 0 && <li>{s.vendorCount} stall bookings and their receipts</li>}
            <li>The event's team assignments</li>
          </ul>
          <p className="mt-2">
            Your balance changes by {formatPKR(-s.net, { sign: true })}. Vendors stay in the directory. A summary stays in the activity log.
          </p>
        </div>
        <Field label="Reason" required>
          {(id) => <Textarea id={id} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="e.g. Test event, created by mistake" autoFocus />}
        </Field>
        {hasMoney && (
          <Field label={`Type the event name to confirm: ${e.name}`}>
            {(id) => <Input id={id} value={confirmName} onChange={(ev) => setConfirmName(ev.target.value)} autoComplete="off" />}
          </Field>
        )}
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Keep event
        </Button>
        <Button type="submit" variant="danger" loading={busy} disabled={!nameOk || reason.trim().length < 3}>
          <Trash2 className="h-4 w-4" /> Delete event
        </Button>
      </ModalFooter>
    </form>
  );
}
