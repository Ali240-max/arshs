"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Database, Palette, RotateCcw, Save, Wallet } from "lucide-react";
import { useApp, useRole } from "@/lib/store";
import { can } from "@/lib/permissions";
import { balanceSummary } from "@/lib/finance";
import { formatDate, formatPKR } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Textarea } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { applyTheme, getTheme, type Theme } from "@/components/theme";
import { errorMessage } from "@/components/forms/shared";

export default function SettingsPage() {
  const data = useApp((s) => s.data);
  const mode = useApp((s) => s.mode);
  const role = useRole();
  const write = can(role, "settings.write");
  const st = data.settings;

  const [opening, setOpening] = useState(String(st.openingBalance));
  const [openingDate, setOpeningDate] = useState(st.openingBalanceDate);
  const [societyName, setSocietyName] = useState(st.societyName);
  const [subtitle, setSubtitle] = useState(st.subtitle);
  const [footer, setFooter] = useState(st.receiptFooter);
  const [busy, setBusy] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(getTheme()), []);

  const current = useMemo(() => balanceSummary(data), [data]);
  const newOpening = Number(opening) || 0;
  const preview = current.balance - current.opening + newOpening;
  const earlier = data.transactions.filter((t) => t.status === "posted" && t.date < openingDate).length;
  const openingDirty = newOpening !== st.openingBalance || openingDate !== st.openingBalanceDate;
  const detailsDirty = societyName !== st.societyName || subtitle !== st.subtitle || footer !== st.receiptFooter;

  async function save(section: "opening" | "details") {
    setBusy(section);
    try {
      if (section === "opening") {
        if (newOpening < 0) throw new Error("Opening balance cannot be negative.");
        if (!openingDate) throw new Error("Pick the date of the opening balance.");
        await useApp.getState().updateSettings({ openingBalance: newOpening, openingBalanceDate: openingDate });
        toast.success("Opening balance saved", { description: `Current balance is now ${formatPKR(preview)}.` });
      } else {
        if (!societyName.trim()) throw new Error("Society name cannot be empty.");
        await useApp.getState().updateSettings({ societyName: societyName.trim(), subtitle: subtitle.trim(), receiptFooter: footer.trim() });
        toast.success("Society details saved", { description: "Receipts and reports use the new details." });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Settings" description={write ? "Starting balance, society details and appearance." : "View only. A Finance account can change these."} />

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-brand-600" /> Starting balance
            </span>
          }
          description="The cash and bank money the society held on the day you started using this app. Everything is counted from here."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Opening balance">{(id) => <MoneyInput id={id} value={opening} onChange={(e) => setOpening(e.target.value)} disabled={!write} />}</Field>
          <Field label="As of date" hint="Don't record entries before this date. They are already inside the opening balance.">
            {(id) => <Input id={id} type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} disabled={!write} />}
          </Field>
          <div className="rounded-2xl border border-line bg-surface-2 p-4 sm:col-span-2">
            <p className="text-[13px] text-muted">{openingDirty ? "Current balance after saving" : "Current balance"}</p>
            <p className="num mt-1 font-display text-[26px] font-semibold tracking-tight">{formatPKR(openingDirty ? preview : current.balance)}</p>
            <p className="mt-1 text-[12.5px] text-muted">
              {formatPKR(newOpening)} opening + {formatPKR(current.totalIn)} in − {formatPKR(current.expenses)} expenses − {formatPKR(current.aid)} aid
            </p>
            {earlier > 0 && (
              <p className="mt-2 text-[12.5px] text-marigold-700 dark:text-amber-300">
                {earlier} recorded entries are dated before {formatDate(openingDate)}. They still count, so check they are not already included in the opening balance.
              </p>
            )}
          </div>
        </div>
        {write && (
          <div className="flex justify-end border-t border-line px-5 py-3">
            <Button onClick={() => save("opening")} loading={busy === "opening"} disabled={!openingDirty}>
              <Save className="h-4 w-4" /> Save starting balance
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-600" /> Society details
            </span>
          }
          description="Printed on every receipt and report."
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Society name">{(id) => <Input id={id} value={societyName} onChange={(e) => setSocietyName(e.target.value)} disabled={!write} />}</Field>
          <Field label="Line under the name">{(id) => <Input id={id} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={!write} placeholder="e.g. Finance Office" />}</Field>
          <Field label="Receipt footer" className="sm:col-span-2">
            {(id) => <Textarea id={id} value={footer} onChange={(e) => setFooter(e.target.value)} disabled={!write} />}
          </Field>
        </div>
        {write && (
          <div className="flex justify-end border-t border-line px-5 py-3">
            <Button onClick={() => save("details")} loading={busy === "details"} disabled={!detailsDirty}>
              <Save className="h-4 w-4" /> Save details
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-brand-600" /> Appearance
            </span>
          }
          description="Saved on this device only."
        />
        <div className="p-5">
          <Tabs
            value={theme}
            onChange={(t) => {
              setTheme(t);
              applyTheme(t);
            }}
            items={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Match device" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Database className="h-5 w-5 text-brand-600" /> Data
            </span>
          }
          description={mode === "demo" ? "Demo mode: data lives in this browser only. Add Supabase keys to go live." : "Live: connected to your Supabase database."}
        />
        {mode === "demo" && write && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-[13.5px] text-ink-2">Undo everything you changed while testing and go back to the original demo data.</p>
            <Button
              variant="secondary"
              onClick={() => {
                if (!confirm("Reset all demo data in this browser?")) return;
                useApp.getState().resetDemo();
                toast.success("Demo data reset");
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset demo data
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
