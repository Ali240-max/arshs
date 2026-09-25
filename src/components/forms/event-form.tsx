"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { CheckCircle2, HandCoins, ReceiptText, Store } from "lucide-react";
import type { EventStatus, EventType, SocietyEvent } from "@/lib/types";
import type { EventInput } from "@/lib/data/mutations";
import { EVENT_STATUS_LABEL, EVENT_TYPE_META } from "@/lib/constants";
import { cn, formatPKR, todayISO } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { errorMessage } from "./shared";

const TYPE_ICON: Record<EventType, typeof Store> = { fundraiser: Store, expenditure: ReceiptText, collection: HandCoins };
const TYPE_COLOR: Record<EventType, string> = { fundraiser: "#0E6B57", expenditure: "#E2583E", collection: "#E9A21B" };

function dayCount(a: string, b: string) {
  if (!a || !b) return 1;
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
  return Math.max(1, d);
}

export function EventForm({ event, onDone, onCancel }: { event?: SocietyEvent; onDone: (id: string) => void; onCancel: () => void }) {
  const [type, setType] = useState<EventType>(event?.type ?? "fundraiser");
  const [name, setName] = useState(event?.name ?? "");
  const [status, setStatus] = useState<EventStatus>(event?.status ?? "planned");
  const [startDate, setStartDate] = useState(event?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(event?.endDate ?? todayISO());
  const [days, setDays] = useState(String(event?.days ?? 1));
  const [location, setLocation] = useState(event?.location ?? "University Main Ground");
  const [description, setDescription] = useState(event?.description ?? "");
  const [targetAmount, setTargetAmount] = useState(event?.targetAmount ? String(event.targetAmount) : "");
  const [budget, setBudget] = useState(event?.budget ? String(event.budget) : "");
  const [expectedVendors, setExpectedVendors] = useState(event?.expectedVendors ? String(event.expectedVendors) : "");
  const [defaultDayFee, setDefaultDayFee] = useState(event?.defaultDayFee ? String(event.defaultDayFee) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const locked = !!event; // type cannot change once money is attached; keep it simple and lock on edit

  function onDates(a: string, b: string) {
    setStartDate(a);
    setEndDate(b < a ? a : b);
    setDays(String(dayCount(a, b < a ? a : b)));
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (name.trim().length < 3) e.name = "Give the event a name.";
    if (!startDate) e.startDate = "Pick a start date.";
    if (!location.trim()) e.location = "Where is it happening?";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: EventInput = {
      name: name.trim(),
      type,
      status,
      startDate,
      endDate: endDate || startDate,
      days: Math.max(1, Number(days) || 1),
      location: location.trim(),
      description: description.trim() || undefined,
      targetAmount: type !== "expenditure" && Number(targetAmount) > 0 ? Number(targetAmount) : undefined,
      budget: Number(budget) > 0 ? Number(budget) : undefined,
      expectedVendors: type === "fundraiser" && Number(expectedVendors) > 0 ? Number(expectedVendors) : undefined,
      defaultDayFee: type === "fundraiser" && Number(defaultDayFee) > 0 ? Number(defaultDayFee) : undefined,
    };
    setBusy(true);
    try {
      if (event) {
        await useApp.getState().updateEvent(event.id, input);
        toast.success("Event updated");
        onDone(event.id);
      } else {
        const id = await useApp.getState().createEvent(input);
        toast.success(`${input.name} created`, { description: type === "fundraiser" ? "Next: add vendors and their stall fees." : undefined });
        onDone(id);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const expected = type === "fundraiser" ? (Number(expectedVendors) || 0) * (Number(defaultDayFee) || 0) * (Number(days) || 1) : 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <div>
        <p className="mb-2 text-[13px] font-medium text-ink-2">What kind of event is this?</p>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(EVENT_TYPE_META) as EventType[]).map((t) => {
            const Icon = TYPE_ICON[t];
            const active = type === t;
            return (
              <motion.button
                key={t}
                type="button"
                disabled={locked && !active}
                onClick={() => setType(t)}
                whileHover={locked ? undefined : { y: -2 }}
                whileTap={locked ? undefined : { scale: 0.98 }}
                className={cn(
                  "relative rounded-2xl border p-4 text-left transition-colors disabled:opacity-40",
                  active ? "border-transparent bg-surface shadow-[var(--shadow-lift)]" : "border-line bg-surface-2 hover:border-line-strong",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="event-type-ring"
                    className="pointer-events-none absolute inset-0 rounded-2xl"
                    style={{ boxShadow: `0 0 0 2px ${TYPE_COLOR[t]}` }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${TYPE_COLOR[t]}1f`, color: TYPE_COLOR[t] }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {active && <CheckCircle2 className="h-5 w-5" style={{ color: TYPE_COLOR[t] }} />}
                </div>
                <p className="mt-3 font-display font-semibold">{EVENT_TYPE_META[t].label}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-muted">{EVENT_TYPE_META[t].description}</p>
              </motion.button>
            );
          })}
        </div>
        {locked && <p className="mt-2 text-[12px] text-muted">The event type is fixed once created, because records are already attached to it.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name" required error={errors.name} className="sm:col-span-2">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. University Charity Mela 2026" autoFocus={!event} />}
        </Field>
        <Field label="Start date" required error={errors.startDate}>
          {(id) => <Input id={id} type="date" value={startDate} onChange={(e) => onDates(e.target.value, endDate)} />}
        </Field>
        <Field label="End date">
          {(id) => <Input id={id} type="date" value={endDate} min={startDate} onChange={(e) => onDates(startDate, e.target.value)} />}
        </Field>
        <Field label="Location" required error={errors.location}>
          {(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
              {Object.entries(EVENT_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {type === "fundraiser" && (
          <>
            <Field label="Trading days" hint="Vendors are charged per day, like Day 1 and Day 2 in the old sheets.">
              {(id) => <Input id={id} type="number" min={1} max={14} className="num" value={days} onChange={(e) => setDays(e.target.value)} />}
            </Field>
            <Field label="Default stall fee per day" hint="Pre-fills new bookings. You can change it per vendor.">
              {(id) => <MoneyInput id={id} value={defaultDayFee} onChange={(e) => setDefaultDayFee(e.target.value)} placeholder="e.g. 3000" />}
            </Field>
            <Field label="Expected vendors">
              {(id) => <Input id={id} type="number" min={0} className="num" value={expectedVendors} onChange={(e) => setExpectedVendors(e.target.value)} placeholder="e.g. 25" />}
            </Field>
          </>
        )}
        {type !== "expenditure" && (
          <Field label="Target revenue" hint={expected > 0 ? `At full occupancy vendors alone bring ${formatPKR(expected)}.` : undefined}>
            {(id) => <MoneyInput id={id} value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="e.g. 150000" />}
          </Field>
        )}
        <Field label={type === "expenditure" ? "Budget" : "Expense budget"} hint={type === "expenditure" ? "Expenses are tracked against this." : "Optional cap on event costs."}>
          {(id) => <MoneyInput id={id} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 100000" />}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Purpose, who approved it, anything the team should know" />}
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {event ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
