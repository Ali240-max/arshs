"use client";
import { useState } from "react";
import { toast } from "sonner";
import { STALL_TYPES } from "@/lib/constants";
import { useApp } from "@/lib/store";
import { useLookups } from "@/lib/hooks";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { FormGrid, errorMessage } from "./shared";

export function VendorForm({ vendorId, onDone }: { vendorId?: string; onDone: () => void }) {
  const L = useLookups();
  const v = vendorId ? L.vendor.get(vendorId) : undefined;
  const [businessName, setBusinessName] = useState(v?.businessName ?? "");
  const [ownerName, setOwnerName] = useState(v?.ownerName ?? "");
  const [phone, setPhone] = useState(v?.phone ?? "");
  const [stallType, setStallType] = useState(v?.stallType ?? "Food");
  const [notes, setNotes] = useState(v?.notes ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!businessName.trim()) return setError("Enter the business or stall name.");
    setBusy(true);
    try {
      const input = { businessName: businessName.trim(), ownerName: ownerName.trim() || undefined, phone: phone.trim() || undefined, stallType, notes: notes.trim() || undefined };
      if (v) await useApp.getState().updateVendor(v.id, input);
      else await useApp.getState().createVendor(input);
      toast.success(v ? "Vendor updated" : "Vendor added to directory");
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
        <Field label="Business / stall name" required error={error} className="sm:col-span-2">
          {(id) => <Input id={id} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Karachi Chaat House" autoFocus />}
        </Field>
        <Field label="Owner name">{(id) => <Input id={id} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />}</Field>
        <Field label="Usual stall type">
          {(id) => (
            <Select id={id} value={stallType} onChange={(e) => setStallType(e.target.value)}>
              {STALL_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reliability, items sold, anything useful for next time" />}
        </Field>
      </FormGrid>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {v ? "Save vendor" : "Add vendor"}
        </Button>
      </ModalFooter>
    </form>
  );
}
