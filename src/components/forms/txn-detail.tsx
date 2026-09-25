"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, BadgeCheck, CalendarDays, History, Pencil, Printer } from "lucide-react";
import { useApp, useRole } from "@/lib/store";
import { openReceipts, useLookups } from "@/lib/hooks";
import { can } from "@/lib/permissions";
import { KIND_META, METHOD_LABEL, RECIPIENT_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, formatPKR } from "@/lib/utils";
import { useUI } from "@/lib/ui-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { errorMessage } from "./shared";

/** Everything about one ledger row, in a side sheet. */
export function TxnDetail({ txnId, onDone }: { txnId: string; onDone: () => void }) {
  const t = useApp((s) => s.data.transactions.find((x) => x.id === txnId));
  const logs = useApp((s) => s.data.auditLogs);
  const role = useRole();
  const L = useLookups();
  const openModal = useUI((s) => s.open);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(t?.description ?? "");
  const [counterparty, setCounterparty] = useState(t?.counterparty ?? "");
  const [reference, setReference] = useState(t?.reference ?? "");
  const history = useMemo(() => logs.filter((l) => l.entityId === txnId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [logs, txnId]);

  if (!t) return <p className="p-6 text-muted">Transaction not found.</p>;
  const donation = L.donationByTxn.get(t.id);
  const distribution = L.distributionByTxn.get(t.id);
  const payment = L.paymentByTxn.get(t.id);
  const booking = payment ? L.booking.get(payment.eventVendorId) : undefined;
  const vendor = booking ? L.vendor.get(booking.vendorId) : undefined;
  const ev = t.eventId ? L.event.get(t.eventId) : undefined;
  const isVoid = t.status === "void";
  const tone = t.direction === "in" ? "text-inflow" : t.kind === "distribution" ? "text-violet" : "text-coral";

  const rows: [string, React.ReactNode][] = [
    ["Date", formatDate(t.date, "long")],
    ["Type", KIND_META[t.kind].label],
    ["Category", L.category.get(t.categoryId)?.name ?? "None"],
    ["Method", METHOD_LABEL[t.method]],
    ["Event", ev ? <Link href={`/events/${ev.id}`} onClick={onDone} className="text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">{ev.name}</Link> : "Not linked"],
    [t.direction === "in" ? "Received from" : "Paid to", t.counterparty || "Not recorded"],
    ["Reference", t.reference || "None"],
    ["Recorded by", `${L.profile.get(t.createdBy)?.fullName ?? "Unknown"} · ${formatDateTime(t.createdAt)}`],
  ];
  if (donation)
    rows.push(
      ["Donor", donation.isAnonymous ? "Anonymous" : `${donation.donorName ?? ""}${donation.donorPhone ? ` · ${donation.donorPhone}` : ""}`],
      ["Purpose", donation.purpose],
      ["Receipt no.", donation.receiptNo],
    );
  if (distribution)
    rows.push(
      ["Recipient", `${distribution.recipientName} (${RECIPIENT_TYPE_LABEL[distribution.recipientType]})`],
      ["People helped", distribution.beneficiaryCount],
      ["Contact", distribution.recipientContact || "Not recorded"],
      ["Aid reference", distribution.referenceNo],
    );
  if (payment && booking)
    rows.push(["Vendor", `${vendor?.businessName} · stall ${booking.stallNo}`], ["Receipt no.", payment.receiptNo]);

  async function saveNotes() {
    try {
      await useApp.getState().updateTransactionNotes(t!.id, { description: description.trim(), counterparty: counterparty.trim() || undefined, reference: reference.trim() || undefined });
      toast.success("Details updated");
      setEditing(false);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function verify() {
    try {
      await useApp.getState().verifyTransactions([t!.id]);
      toast.success(`${t!.code} verified`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6 px-6 py-5">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12.5px] font-medium text-muted">{t.code}</p>
            <p className={`num mt-1 font-display text-[32px] font-semibold tracking-tight ${isVoid ? "text-muted line-through" : tone}`}>
              {t.direction === "in" ? "+" : "−"}
              {formatPKR(t.amount)}
            </p>
            <p className="mt-1 text-sm text-ink-2">{t.description}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {isVoid ? <Badge tone="coral">Void</Badge> : <Badge tone="inflow" dot>Posted</Badge>}
            {t.verifiedAt && (
              <Badge tone="brand">
                <BadgeCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
          </div>
        </div>
        {isVoid && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
            Voided by {L.profile.get(t.voidedBy ?? "")?.fullName ?? "Finance"} on {formatDate(t.voidedAt ?? "")}: {t.voidReason}
          </p>
        )}
        {t.verifiedAt && (
          <p className="mt-3 text-[12.5px] text-muted">
            Verified by {L.profile.get(t.verifiedBy ?? "")?.fullName} on {formatDateTime(t.verifiedAt)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {payment && !isVoid && (
          <Button size="sm" variant="secondary" onClick={() => openReceipts("vendor", [payment.id])}>
            <Printer className="h-3.5 w-3.5" /> Print slip
          </Button>
        )}
        {donation && !isVoid && (
          <Button size="sm" variant="secondary" onClick={() => openReceipts("donation", [t.id])}>
            <Printer className="h-3.5 w-3.5" /> Print receipt
          </Button>
        )}
        {can(role, "finance.write") && !isVoid && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setEditing((v) => !v)}>
              <Pencil className="h-3.5 w-3.5" /> Edit details
            </Button>
            <Button size="sm" variant="ghost" className="text-coral hover:text-coral" onClick={() => openModal({ kind: "void", txnId: t.id })}>
              <Ban className="h-3.5 w-3.5" /> Void
            </Button>
          </>
        )}
        {can(role, "transactions.verify") && !isVoid && !t.verifiedAt && (
          <Button size="sm" onClick={verify}>
            <BadgeCheck className="h-3.5 w-3.5" /> Verify
          </Button>
        )}
      </div>

      {editing && (
        <div className="space-y-3 rounded-2xl border border-line p-4">
          <p className="text-[12.5px] text-muted">Amount, date and type cannot change after saving. To fix those, void and record again.</p>
          <Field label="Description">{(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.direction === "in" ? "Received from" : "Paid to"}>{(id) => <Input id={id} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />}</Field>
            <Field label="Reference">{(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} />}</Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveNotes} disabled={!description.trim()}>
              Save
            </Button>
          </div>
        </div>
      )}

      <dl className="divide-y divide-line rounded-2xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-2.5 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-muted" /> Audit trail
        </h4>
        {history.length === 0 ? (
          <p className="text-[13px] text-muted">No audit entries for this record.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-line pl-5">
            {history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[25px] top-1 grid h-3 w-3 place-items-center rounded-full bg-brand-500 ring-4 ring-surface" />
                <p className="text-[13.5px]">{h.summary}</p>
                <p className="flex items-center gap-1 text-[12px] text-muted">
                  <CalendarDays className="h-3 w-3" /> {h.actorName} · {formatDateTime(h.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
