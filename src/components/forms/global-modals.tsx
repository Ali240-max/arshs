"use client";
import { ArrowDownLeft, ArrowUpRight, Ban, HandHeart, HeartHandshake, ReceiptText, Store, CalendarCog, FileText, Trash2, UserPlus } from "lucide-react";
import { useUI } from "@/lib/ui-store";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { DonationForm } from "./donation-form";
import { DistributionForm } from "./distribution-form";
import { LedgerForm } from "./ledger-form";
import { VendorPaymentForm } from "./vendor-payment-form";
import { BookingForm } from "./booking-form";
import { VendorForm } from "./vendor-form";
import { DeleteForm, VoidForm } from "./void-form";
import { TxnDetail } from "./txn-detail";
import { EventForm } from "./event-form";
import { DeleteEventForm } from "./delete-event-form";
import { AccountForm } from "./account-form";

/**
 * One place renders every modal. Any page opens a form with useUI().open({...}),
 * so the "Record" menu, command palette and table rows all share the same forms.
 */
export function GlobalModals() {
  const modal = useUI((s) => s.modal);
  const close = useUI((s) => s.close);
  const events = useApp((s) => s.data.events);
  const onOpenChange = (o: boolean) => !o && close();
  const m = modal;

  return (
    <>
      <Modal open={m?.kind === "donation"} onOpenChange={onOpenChange} title="Record donation" description="Money a donor gave the society." icon={<HandHeart className="h-5 w-5" />} size="lg">
        {m?.kind === "donation" && <DonationForm eventId={m.eventId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "distribution"} onOpenChange={onOpenChange} title="Record aid given" description="Money the society gave to a person or family in need." icon={<HeartHandshake className="h-5 w-5" />} size="lg">
        {m?.kind === "distribution" && <DistributionForm eventId={m.eventId} onDone={close} />}
      </Modal>
      <Modal
        open={m?.kind === "ledger"}
        onOpenChange={onOpenChange}
        title={m?.kind === "ledger" && m.ledgerKind === "income" ? "Record other income" : "Record expense"}
        description={m?.kind === "ledger" && m.ledgerKind === "income" ? "Student stalls, sponsorships, direct contributions." : "Operating and event costs. Aid to people goes under Aid given."}
        icon={m?.kind === "ledger" && m.ledgerKind === "income" ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
        size="lg"
      >
        {m?.kind === "ledger" && <LedgerForm kind={m.ledgerKind} eventId={m.eventId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "vendorPayment"} onOpenChange={onOpenChange} title="Collect vendor payment" description="Issues a numbered receipt the vendor signs." icon={<ReceiptText className="h-5 w-5" />} size="lg">
        {m?.kind === "vendorPayment" && <VendorPaymentForm bookingId={m.bookingId} eventId={m.eventId} onDone={close} />}
      </Modal>
      <Modal
        open={m?.kind === "booking"}
        onOpenChange={onOpenChange}
        title={m?.kind === "booking" && m.bookingId ? "Edit stall booking" : "Add vendor to event"}
        description={m?.kind === "booking" ? events.find((e) => e.id === m.eventId)?.name : undefined}
        icon={<Store className="h-5 w-5" />}
        size="lg"
      >
        {m?.kind === "booking" && <BookingForm eventId={m.eventId} bookingId={m.bookingId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "vendor"} onOpenChange={onOpenChange} title={m?.kind === "vendor" && m.vendorId ? "Edit vendor" : "New vendor"} description="Vendors are reusable across events." icon={<Store className="h-5 w-5" />}>
        {m?.kind === "vendor" && <VendorForm vendorId={m.vendorId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "void"} onOpenChange={onOpenChange} title="Void transaction" icon={<Ban className="h-5 w-5" />}>
        {m?.kind === "void" && <VoidForm txnId={m.txnId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "delete"} onOpenChange={onOpenChange} title="Delete transaction" icon={<Trash2 className="h-5 w-5" />}>
        {m?.kind === "delete" && <DeleteForm txnId={m.txnId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "deleteEvent"} onOpenChange={onOpenChange} title="Delete event" icon={<Trash2 className="h-5 w-5" />} size="lg">
        {m?.kind === "deleteEvent" && <DeleteEventForm eventId={m.eventId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "account"} onOpenChange={onOpenChange} title="New account" description="Create a login and choose what it can do." icon={<UserPlus className="h-5 w-5" />} size="lg">
        {m?.kind === "account" && <AccountForm onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "txn"} onOpenChange={onOpenChange} title="Transaction" side="right" icon={<FileText className="h-5 w-5" />}>
        {m?.kind === "txn" && <TxnDetail txnId={m.txnId} onDone={close} />}
      </Modal>
      <Modal open={m?.kind === "event"} onOpenChange={onOpenChange} title="Edit event" icon={<CalendarCog className="h-5 w-5" />} size="xl">
        {m?.kind === "event" && (
          <div className="px-6 py-5">
            <EventForm event={events.find((e) => e.id === m.eventId)} onDone={close} onCancel={close} />
          </div>
        )}
      </Modal>
    </>
  );
}
