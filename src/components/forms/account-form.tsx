"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Landmark, UserPlus } from "lucide-react";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { DEMO_PASSWORD } from "@/lib/demo/seed";
import { cn } from "@/lib/utils";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ModalFooter } from "@/components/ui/modal";
import { FormGrid, errorMessage } from "./shared";

const LEVELS = [
  { role: "president" as const, title: "View only", text: "Sees every page and number. Cannot record, edit or delete anything.", Icon: Eye },
  { role: "finance_secretary" as const, title: "Finance · full access", text: "Records money, runs events, deletes entries, manages accounts and settings.", Icon: Landmark },
];

export function AccountForm({ onDone }: { onDone: () => void }) {
  const mode = useApp((s) => s.mode);
  const [role, setRole] = useState<"president" | "finance_secretary">("president");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(mode === "demo" ? DEMO_PASSWORD : "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function suggestPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const a = new Uint32Array(12);
    crypto.getRandomValues(a);
    setPassword(Array.from(a, (x) => chars[x % chars.length]).join(""));
  }

  async function submit() {
    if (fullName.trim().length < 2) return setError("Enter the person's name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter a valid email.");
    if (mode !== "demo" && password.length < 8) return setError("Password must be at least 8 characters.");
    setError(undefined);
    setBusy(true);
    try {
      await useApp.getState().addAccount({ fullName, email, password, role });
      toast.success(`Account created for ${fullName.trim()}`, {
        description: mode === "demo" ? `Demo login: ${email.trim().toLowerCase()} / ${DEMO_PASSWORD}` : "Send them the email and password privately.",
        duration: 10000,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
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
        <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
          {LEVELS.map((l) => {
            const on = role === l.role;
            return (
              <button
                key={l.role}
                type="button"
                onClick={() => setRole(l.role)}
                className={cn("relative rounded-2xl border p-3.5 text-left transition", on ? "border-transparent bg-surface shadow-[var(--shadow-card)]" : "border-line bg-surface-2 hover:border-line-strong")}
              >
                {on && <motion.span layoutId="acct-level" className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand-500" transition={{ type: "spring", stiffness: 450, damping: 34 }} />}
                <l.Icon className={cn("h-5 w-5", on ? "text-brand-600" : "text-muted")} />
                <p className="mt-2 text-sm font-semibold">{l.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{l.text}</p>
              </button>
            );
          })}
        </div>
        <Field label="Full name" required>
          {(id) => <Input id={id} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ayesha Malik" autoFocus />}
        </Field>
        <Field label="Email" required>
          {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" />}
        </Field>
        <Field
          label="Password"
          className="sm:col-span-2"
          hint={mode === "demo" ? `Demo accounts all use ${DEMO_PASSWORD}.` : "At least 8 characters. They sign in with this; you can reset it later from Supabase."}
        >
          {(id) => (
            <div className="flex gap-2">
              <Input id={id} value={password} onChange={(e) => setPassword(e.target.value)} disabled={mode === "demo"} className="num" autoComplete="new-password" />
              {mode !== "demo" && (
                <Button type="button" variant="secondary" onClick={suggestPassword}>
                  Generate
                </Button>
              )}
            </div>
          )}
        </Field>
        {error && <p className="text-[13px] text-coral sm:col-span-2">{error}</p>}
      </FormGrid>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          <UserPlus className="h-4 w-4" /> Create account
        </Button>
      </ModalFooter>
    </form>
  );
}
