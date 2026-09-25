"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, CalendarRange, CornerDownLeft, FileText, HandHeart, HeartHandshake, ReceiptText, Search, Store } from "lucide-react";
import { useApp, useRole } from "@/lib/store";
import { useUI, type ModalRequest } from "@/lib/ui-store";
import { can, canOpenRoute } from "@/lib/permissions";
import { useLookups } from "@/lib/hooks";
import { KIND_META } from "@/lib/constants";
import { cn, formatDate, formatPKR } from "@/lib/utils";
import { NAV } from "./nav";

interface Item {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: React.ReactNode;
  keywords: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPalette);
  const openModal = useUI((s) => s.open);
  const role = useRole();
  const data = useApp((s) => s.data);
  const L = useLookups();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUI.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const all = useMemo<Item[]>(() => {
    const close = () => setOpen(false);
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    const act = (m: ModalRequest) => () => {
      close();
      openModal(m);
    };
    const items: Item[] = [];
    NAV.flatMap((g) => g.items)
      .filter((i) => canOpenRoute(role, i.href))
      .forEach((i) => items.push({ id: `nav-${i.href}`, group: "Pages", label: i.label, sub: i.hint, icon: <i.icon className="h-4 w-4" />, keywords: `${i.label} ${i.hint}`, run: go(i.href) }));

    if (can(role, "finance.write")) {
      items.push(
        { id: "a-vp", group: "Actions", label: "Collect vendor payment", icon: <ReceiptText className="h-4 w-4" />, keywords: "record vendor payment stall fee slip receipt", run: act({ kind: "vendorPayment" }) },
        { id: "a-don", group: "Actions", label: "Record donation", icon: <HandHeart className="h-4 w-4" />, keywords: "record donation donor", run: act({ kind: "donation" }) },
        { id: "a-inc", group: "Actions", label: "Record other income", icon: <ArrowDownLeft className="h-4 w-4" />, keywords: "record income student stalls sponsorship", run: act({ kind: "ledger", ledgerKind: "income" }) },
        { id: "a-exp", group: "Actions", label: "Record expense", icon: <ArrowUpRight className="h-4 w-4" />, keywords: "record expense cost bill", run: act({ kind: "ledger", ledgerKind: "expense" }) },
        { id: "a-aid", group: "Actions", label: "Record aid given", icon: <HeartHandshake className="h-4 w-4" />, keywords: "record aid distribution help", run: act({ kind: "distribution" }) },
        { id: "a-evt", group: "Actions", label: "Create event", icon: <CalendarRange className="h-4 w-4" />, keywords: "new event create fundraiser", run: go("/events/new") },
      );
    }

    data.events
      .filter((e) => role !== "member" || e.status !== "cancelled")
      .forEach((e) =>
        items.push({ id: `e-${e.id}`, group: "Events", label: e.name, sub: `${e.code} · ${formatDate(e.startDate)}`, icon: <CalendarRange className="h-4 w-4" />, keywords: `${e.name} ${e.code} ${e.location}`, run: go(`/events/${e.id}`) }),
      );

    if (can(role, "finance.view")) {
      data.vendors.forEach((v) =>
        items.push({ id: `v-${v.id}`, group: "Vendors", label: v.businessName, sub: [v.code, v.ownerName, v.phone].filter(Boolean).join(" · "), icon: <Store className="h-4 w-4" />, keywords: `${v.businessName} ${v.code} ${v.ownerName ?? ""} ${v.phone ?? ""}`, run: act({ kind: "vendor", vendorId: v.id }) }),
      );
      [...data.transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .forEach((t) => {
          const d = L.donationByTxn.get(t.id);
          const r = L.distributionByTxn.get(t.id);
          const p = L.paymentByTxn.get(t.id);
          const extra = [d?.donorName, d?.receiptNo, d?.purpose, r?.recipientName, r?.referenceNo, p?.receiptNo].filter(Boolean).join(" ");
          items.push({
            id: `t-${t.id}`,
            group: "Transactions",
            label: `${t.code} · ${t.counterparty || d?.donorName || r?.recipientName || t.description}`,
            sub: `${KIND_META[t.kind].label} · ${t.direction === "in" ? "+" : "−"}${formatPKR(t.amount)} · ${formatDate(t.date)}${t.status === "void" ? " · void" : ""}`,
            icon: <FileText className="h-4 w-4" />,
            keywords: `${t.code} ${t.description} ${t.counterparty ?? ""} ${t.reference ?? ""} ${extra} ${t.amount}`,
            run: act({ kind: "txn", txnId: t.id }),
          });
        });
    }
    return items;
  }, [data, role, L, router, openModal, setOpen]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const matched = terms.length ? all.filter((i) => terms.every((t) => `${i.label} ${i.keywords}`.toLowerCase().includes(t))) : all.filter((i) => i.group === "Pages" || i.group === "Actions");
    const groups = new Map<string, Item[]>();
    for (const i of matched) {
      const g = groups.get(i.group) ?? [];
      if (g.length < (terms.length ? 6 : 12)) g.push(i);
      groups.set(i.group, g);
    }
    return [...groups.entries()];
  }, [q, all]);
  const flat = results.flatMap(([, items]) => items);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[active]?.run();
    }
  }

  let idx = -1;
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount onKeyDown={onKeyDown}>
              <motion.div
                className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-lift)] outline-none"
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <Dialog.Title className="sr-only">Search</Dialog.Title>
                <Dialog.Description className="sr-only">Search pages, events, vendors and transactions</Dialog.Description>
                <div className="flex items-center gap-3 border-b border-line px-5">
                  <Search className="h-5 w-5 text-muted" />
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Type a name, TXN code, receipt no. or amount"
                    className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
                    aria-label="Search"
                  />
                  <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
                </div>
                <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
                  {flat.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted">Nothing matches “{q}”.</p>}
                  {results.map(([group, items]) => (
                    <div key={group} className="mb-1">
                      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{group}</p>
                      {items.map((it) => {
                        idx++;
                        const i = idx;
                        const on = i === active;
                        return (
                          <button
                            key={it.id}
                            data-idx={i}
                            onMouseMove={() => setActive(i)}
                            onClick={it.run}
                            className={cn("relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", on ? "text-ink" : "text-ink-2")}
                          >
                            {on && <motion.span layoutId="palette-active" className="absolute inset-0 rounded-xl bg-brand-600/10 dark:bg-brand-400/10" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
                            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">{it.icon}</span>
                            <span className="relative min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{it.label}</span>
                              {it.sub && <span className="block truncate text-[12px] text-muted">{it.sub}</span>}
                            </span>
                            {on && <CornerDownLeft className="relative h-4 w-4 text-muted" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
