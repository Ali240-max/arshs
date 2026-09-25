"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronsLeft, X } from "lucide-react";
import { useApp, useRole } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { canOpenRoute } from "@/lib/permissions";
import { balanceSummary } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { LogoMark } from "./logo";
import { NAV } from "./nav";

function NavLinks({ collapsed, onNavigate, idPrefix }: { collapsed: boolean; onNavigate?: () => void; idPrefix: string }) {
  const pathname = usePathname();
  const role = useRole();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => canOpenRoute(role, i.href)) })).filter((g) => g.items.length);

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-3 py-2" aria-label="Main">
      {groups.map((g, gi) => (
        <div key={g.label}>
          <div className="h-5 px-3">
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted/80">
                  {g.label}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <ul className="mt-1 space-y-0.5">
            {g.items.map((item, ii) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
              return (
                <motion.li key={item.href} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * (gi * 3 + ii), duration: 0.3 }}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                      active ? "text-brand-800 dark:text-brand-100" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`${idPrefix}-nav-active`}
                        className="absolute inset-0 rounded-xl bg-brand-600/10 ring-1 ring-brand-600/15 dark:bg-brand-400/10 dark:ring-brand-300/15"
                        transition={{ type: "spring", stiffness: 480, damping: 36 }}
                      />
                    )}
                    {active && (
                      <motion.span
                        layoutId={`${idPrefix}-nav-bar`}
                        className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-brand-600 dark:bg-brand-300"
                        transition={{ type: "spring", stiffness: 480, damping: 36 }}
                      />
                    )}
                    <item.icon className={cn("relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110", active ? "text-brand-600 dark:text-brand-300" : "text-muted")} />
                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }} className="relative truncate">
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function BalanceChip({ collapsed }: { collapsed: boolean }) {
  const role = useRole();
  const data = useApp((s) => s.data);
  const balance = useMemo(() => balanceSummary(data).balance, [data]);
  if (role === "member" || collapsed) return null;
  return (
    <Link
      href="/dashboard"
      className="relative mx-3 mb-3 block overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-4 text-white shadow-[0_12px_30px_-14px_rgba(8,52,43,.8)]"
    >
      <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-marigold-400/30 blur-2xl" />
      <p className="text-[11.5px] font-medium text-brand-100/80">Cash available</p>
      <p className="mt-0.5 font-display text-[21px] font-semibold tracking-tight">
        <AnimatedNumber value={balance} />
      </p>
      <p className="mt-1 text-[11px] text-brand-100/70">Opening + in − expenses − aid</p>
    </Link>
  );
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  const mobileNav = useUI((s) => s.mobileNav);
  const setMobileNav = useUI((s) => s.setMobileNav);
  const society = useApp((s) => s.data.settings.societyName);

  const brand = (c: boolean) => (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
      <LogoMark />
      {!c && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-[15px] font-semibold tracking-tight">ARSHS Finance</p>
          <p className="truncate text-[11.5px] text-muted">{society || "Serving Humanity Society"}</p>
        </div>
      )}
    </Link>
  );

  return (
    <>
      <motion.aside
        animate={{ width: collapsed ? 76 : 264 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="glass no-print sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line lg:flex"
      >
        <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-0")}>{brand(collapsed)}</div>
        <NavLinks collapsed={collapsed} idPrefix="desk" />
        <BalanceChip collapsed={collapsed} />
        <button
          onClick={toggle}
          className="mx-3 mb-3 flex h-9 items-center justify-center gap-2 rounded-xl text-[12.5px] text-muted transition hover:bg-surface-2 hover:text-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }}>
            <ChevronsLeft className="h-4 w-4" />
          </motion.span>
          {!collapsed && "Collapse"}
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileNav && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-brand-950/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNav(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line bg-surface lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              role="dialog"
              aria-label="Navigation"
            >
              <div className="flex h-16 items-center justify-between px-4">
                {brand(false)}
                <button onClick={() => setMobileNav(false)} className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks collapsed={false} idPrefix="mob" onNavigate={() => setMobileNav(false)} />
              <BalanceChip collapsed={false} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
