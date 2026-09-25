"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Crown, KeyRound, Landmark, Loader2, Mail, UserRound } from "lucide-react";
import type { Role } from "@/lib/types";
import { useApp } from "@/lib/store";
import { DEMO_PASSWORD } from "@/lib/demo/seed";
import { ROLE_LABEL } from "@/lib/constants";
import { balanceSummary } from "@/lib/finance";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { LogoMark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme";
import { errorMessage } from "@/components/forms/shared";

const DEMO: { role: Role; email: string; name: string; title: string; icon: typeof Crown; can: string }[] = [
  { role: "finance_secretary", email: "finance@arshs.demo", name: "Ali Farooqi", title: "Finance Secretary", icon: Landmark, can: "Controls everything: money, events, vendors, slips" },
  { role: "president", email: "president@arshs.demo", name: "Ayesha Malik", title: "President", icon: Crown, can: "Sees everything, cannot change anything" },
];

function equation(b: ReturnType<typeof balanceSummary> | null) {
  const f = (n: number) => (b ? n.toLocaleString("en-PK") : "···");
  return [
    { label: "Opening", value: f(b?.opening ?? 0), color: "text-brand-100" },
    { op: "+" },
    { label: "Money in", value: f(b?.totalIn ?? 0), color: "text-emerald-300" },
    { op: "−" },
    { label: "Expenses", value: f(b?.expenses ?? 0), color: "text-orange-300" },
    { op: "−" },
    { label: "Aid", value: f(b?.aid ?? 0), color: "text-violet-300" },
  ] as ({ label: string; value: string; color: string } | { op: string })[];
}

export default function LoginPage() {
  const { ready, userId, mode, init, signIn, signInAsDemo, data } = useApp();
  // Only demo mode can show real totals before sign-in. Live data needs an authenticated session.
  const summary = useMemo(() => (mode === "demo" && ready ? balanceSummary(data) : null), [mode, ready, data]);
  const EQUATION = equation(summary);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const next = () => {
    const n = new URLSearchParams(window.location.search).get("next");
    return n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
  };

  useEffect(() => {
    if (ready && userId) router.replace(next());
  }, [ready, userId, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy("form");
    try {
      await signIn(email, password);
      router.replace(next());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  function demo(role: Role) {
    setBusy(role);
    setTimeout(() => {
      signInAsDemo(role);
      router.replace("/dashboard");
    }, 350);
  }

  return (
    <div className="app-mesh grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand-950 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-500/30 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-40 right-[-120px] h-[460px] w-[460px] rounded-full bg-marigold-500/20 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
        </div>
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <p className="font-display text-lg font-semibold">Adeeb Rizvi Serving Humanity Society</p>
            <p className="text-sm text-brand-200/80">Finance & events</p>
          </div>
        </div>

        <div className="relative mt-auto">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-lg font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]"
          >
            Every rupee in. Every rupee out. One balance you can trust.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-4 max-w-md text-brand-100/75">
            Stall fees, donations, aid and event costs in one ledger, with numbered receipts and a full audit trail.
          </motion.p>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
            <p className="mb-3 text-[12px] font-medium uppercase tracking-wider text-brand-200/70">How the balance is worked out</p>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              {EQUATION.map((p, i) =>
                "op" in p ? (
                  <motion.span key={i} initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 0.5 + i * 0.12 }} className="pb-1 text-xl">
                    {p.op}
                  </motion.span>
                ) : (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.12, duration: 0.5 }}>
                    <p className="text-[11px] text-brand-200/70">{p.label}</p>
                    <p className={`num font-display text-lg font-semibold ${p.color}`}>{p.value}</p>
                  </motion.div>
                ),
              )}
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1.4 }} className="pb-1 text-xl">
                =
              </motion.span>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.55, type: "spring" }} className="rounded-xl bg-marigold-400 px-3 py-1.5 text-brand-950">
                <p className="text-[11px] font-medium opacity-70">Balance</p>
                <p className="num font-display text-lg font-bold">{summary ? `PKR ${summary.balance.toLocaleString("en-PK")}` : "PKR ···"}</p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <ThemeToggle className="absolute right-5 top-5" />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <p className="font-display font-semibold">ARSHS Finance</p>
          </div>
          <h2 className="font-display text-[30px] font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-muted">
            {mode === "demo" ? "Demo mode: data is stored in this browser only." : "Use the account the Finance Secretary created for you."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Email">
              {(id) => (
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="you@university.edu.pk" />
                </div>
              )}
            </Field>
            <Field label="Password">
              {(id) => (
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
                </div>
              )}
            </Field>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
                {error}
              </motion.p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy === "form"} disabled={!ready}>
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {mode === "demo" && (
            <div className="mt-9">
              <div className="mb-3 flex items-center gap-3 text-[12px] text-muted">
                <span className="h-px flex-1 bg-line" /> or open a demo account (password {DEMO_PASSWORD}) <span className="h-px flex-1 bg-line" />
              </div>
              <div className="space-y-2">
                {DEMO.map((d, i) => (
                  <motion.button
                    key={d.role}
                    type="button"
                    disabled={!ready || !!busy}
                    onClick={() => demo(d.role)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.07 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left shadow-[var(--shadow-card)] transition hover:border-brand-300 hover:shadow-[var(--shadow-lift)] disabled:opacity-60"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/50 dark:text-brand-200">
                      <d.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {d.title} <span className="font-normal text-muted">· {d.name}</span>
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">{d.can}</span>
                    </span>
                    {busy === d.role ? <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> : <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-600" />}
                  </motion.button>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted">
                <UserRound className="h-3.5 w-3.5" /> Or type any demo email above, e.g. {DEMO[0].email}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
