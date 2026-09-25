"use client";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Database,
  Eye,
  FlaskConical,
  HandHeart,
  HeartHandshake,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Search,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { useApp, useMe } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MenuItem, Popover } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/theme";

const ROLES: Role[] = ["finance_secretary", "president"];
const ROLE_SHORT: Record<Role, string> = { finance_secretary: "Finance", president: "President", member: "Member" };

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[12px] font-semibold text-white", className)}>
      {initials(name)}
    </span>
  );
}

function RecordMenu() {
  const open = useUI((s) => s.open);
  return (
    <Popover
      trigger={({ toggle, open: o }) => (
        <Button onClick={toggle} aria-expanded={o} className="pl-3">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Record</span>
          <motion.span animate={{ rotate: o ? 180 : 0 }} className="hidden sm:inline">
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </motion.span>
        </Button>
      )}
      className="w-[280px]"
    >
      {(close) => {
        const go = (fn: () => void) => () => {
          close();
          fn();
        };
        return (
          <>
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Money in</p>
            <MenuItem icon={<ReceiptText className="h-4 w-4 text-brand-600" />} hint="Stall fee with printed slip" onClick={go(() => open({ kind: "vendorPayment" }))}>
              Vendor payment
            </MenuItem>
            <MenuItem icon={<HandHeart className="h-4 w-4 text-marigold-600" />} hint="From a donor, with receipt" onClick={go(() => open({ kind: "donation" }))}>
              Donation
            </MenuItem>
            <MenuItem icon={<ArrowDownLeft className="h-4 w-4 text-inflow" />} hint="Student stalls, sponsorship" onClick={go(() => open({ kind: "ledger", ledgerKind: "income" }))}>
              Other income
            </MenuItem>
            <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Money out</p>
            <MenuItem icon={<ArrowUpRight className="h-4 w-4 text-coral" />} hint="Operating or event cost" onClick={go(() => open({ kind: "ledger", ledgerKind: "expense" }))}>
              Expense
            </MenuItem>
            <MenuItem icon={<HeartHandshake className="h-4 w-4 text-violet" />} hint="Given to a person in need" onClick={go(() => open({ kind: "distribution" }))}>
              Aid given
            </MenuItem>
          </>
        );
      }}
    </Popover>
  );
}

function DemoRoleSwitch() {
  const me = useMe();
  const switchDemoRole = useApp((s) => s.switchDemoRole);
  return (
    <div className="hidden items-center gap-0.5 rounded-xl border border-dashed border-marigold-400/70 bg-marigold-50/60 p-0.5 dark:bg-amber-950/20 md:flex" title="Demo only: view the app as each role">
      <FlaskConical className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-marigold-600" />
      {ROLES.map((r) => {
        const active = me?.role === r;
        return (
          <button
            key={r}
            onClick={() => switchDemoRole(r)}
            className={cn("relative rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors", active ? "text-brand-950" : "text-marigold-700 hover:text-brand-900 dark:text-amber-300")}
          >
            {active && <motion.span layoutId="demo-role" className="absolute inset-0 rounded-lg bg-marigold-400" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{ROLE_SHORT[r]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Topbar() {
  const me = useMe();
  const mode = useApp((s) => s.mode);
  const signOut = useApp((s) => s.signOut);
  const setPalette = useUI((s) => s.setPalette);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const router = useRouter();

  return (
    <header className="glass no-print sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line px-4 sm:gap-3 lg:px-8">
      <button onClick={() => setMobileNav(true)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={() => setPalette(true)}
        className="group flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface/70 px-3 text-left text-sm text-muted transition hover:border-line-strong hover:bg-surface sm:max-w-md"
      >
        <Search className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
        <span className="truncate">Search donors, vendors, TXN codes, receipts</span>
        <kbd className="ml-auto hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-muted sm:block">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {mode === "demo" ? <DemoRoleSwitch /> : (
          <span className="hidden items-center gap-1.5 rounded-lg bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 md:flex">
            <Database className="h-3.5 w-3.5" /> Live
          </span>
        )}
        {can(me?.role, "finance.write") ? (
          <RecordMenu />
        ) : (
          me?.role === "president" && (
            <span className="hidden items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-muted ring-1 ring-line sm:flex" title="The President can see everything but cannot change anything">
              <Eye className="h-3.5 w-3.5" /> View only
            </span>
          )
        )}
        <ThemeToggle />
        {me && (
          <Popover
            trigger={({ toggle }) => (
              <button onClick={toggle} className="flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-surface-2" aria-label="Account menu">
                <Avatar name={me.fullName} />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-[13px] font-medium">{me.fullName}</span>
                  <span className="block text-[11.5px] text-muted">{ROLE_LABEL[me.role]}</span>
                </span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 py-2">
                  <p className="text-sm font-medium">{me.fullName}</p>
                  <p className="text-[12px] text-muted">{me.email}</p>
                  <p className="mt-1 text-[12px] font-medium text-brand-700 dark:text-brand-300">{ROLE_LABEL[me.role]}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <MenuItem
                  icon={<LogOut className="h-4 w-4" />}
                  onClick={async () => {
                    close();
                    await signOut();
                    router.replace("/login");
                  }}
                >
                  Sign out
                </MenuItem>
              </>
            )}
          </Popover>
        )}
      </div>
    </header>
  );
}
