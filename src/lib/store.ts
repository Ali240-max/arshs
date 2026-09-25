"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuditLog, Profile, Role, Snapshot, SocietySettings } from "./types";
import { freshDemoSnapshot, DEMO_PASSWORD } from "./demo/seed";
import * as M from "./data/mutations";
import { isSupabaseConfigured } from "./supabase/config";
import { getSupabase } from "./supabase/client";
import { loadMemberSummary, loadProfile, loadSnapshot, remote } from "./data/supabase-source";
import { balanceSummary, posted } from "./finance";
import { sum } from "./utils";

export interface MemberSummary {
  totalRaised: number;
  totalDistributed: number;
  peopleHelped: number;
  eventsCompleted: number;
}

const emptySnapshot = (): Snapshot => ({
  settings: { societyName: "", subtitle: "", openingBalance: 0, openingBalanceDate: "2025-01-01", receiptFooter: "" },
  profiles: [],
  categories: [],
  events: [],
  eventMembers: [],
  vendors: [],
  eventVendors: [],
  transactions: [],
  donations: [],
  distributions: [],
  vendorPayments: [],
  auditLogs: [],
});

interface AppState {
  mode: "demo" | "supabase";
  ready: boolean;
  data: Snapshot;
  userId: string | null;
  memberSummary: MemberSummary | null;

  init: () => Promise<void>;
  reload: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInAsDemo: (role: Role) => void;
  switchDemoRole: (role: Role) => void;
  signOut: () => Promise<void>;
  resetDemo: () => void;

  recordLedger: (kind: "income" | "expense", i: M.LedgerInput) => Promise<void>;
  recordDonation: (i: M.DonationInput) => Promise<{ receiptNo: string; transactionId: string }>;
  recordDistribution: (i: M.DistributionInput) => Promise<{ referenceNo: string }>;
  recordVendorPayment: (i: M.VendorPaymentInput) => Promise<{ paymentId: string; receiptNo: string }>;
  voidTransaction: (id: string, reason: string) => Promise<void>;
  deleteTransaction: (id: string, reason: string) => Promise<void>;
  verifyTransactions: (ids: string[]) => Promise<number>;
  updateTransactionNotes: (id: string, p: { description: string; counterparty?: string; reference?: string }) => Promise<void>;

  createEvent: (i: M.EventInput) => Promise<string>;
  updateEvent: (id: string, p: Partial<M.EventInput>) => Promise<void>;
  createVendor: (i: M.VendorInput) => Promise<string>;
  updateVendor: (id: string, i: M.VendorInput) => Promise<void>;
  addBooking: (i: M.BookingInput) => Promise<string>;
  updateBooking: (id: string, i: Omit<M.BookingInput, "eventId" | "vendorId">) => Promise<void>;
  removeBooking: (id: string) => Promise<void>;

  setRole: (profileId: string, role: Role) => Promise<void>;
  addAccount: (i: M.AccountInput) => Promise<string>;
  deleteEvent: (id: string, reason: string) => Promise<void>;
  updateSettings: (p: Partial<SocietySettings>) => Promise<void>;
  logActivity: (action: AuditLog["action"], entity: string, summary: string) => void;
}

function demoMemberSummary(d: Snapshot): MemberSummary {
  const s = balanceSummary(d);
  const aidTxnIds = new Set(posted(d.transactions).filter((t) => t.kind === "distribution").map((t) => t.id));
  return {
    totalRaised: s.totalIn,
    totalDistributed: s.aid,
    peopleHelped: sum(d.distributions.filter((x) => aidTxnIds.has(x.transactionId)), (x) => x.beneficiaryCount),
    eventsCompleted: d.events.filter((e) => e.status === "completed").length,
  };
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const actor = (): Profile => {
        const p = get().data.profiles.find((x) => x.id === get().userId);
        if (!p) throw new Error("You are signed out. Sign in again.");
        return p;
      };
      const sb = () => {
        const c = getSupabase();
        if (!c) throw new Error("Supabase is not configured.");
        return c;
      };
      /** Runs a demo mutation locally, or a live call followed by a reload. */
      async function mutate<T>(demo: (d: Snapshot, a: Profile) => M.Result<T>, live: () => Promise<T>): Promise<T> {
        if (get().mode === "demo") {
          const r = demo(get().data, actor());
          set({ data: r.data, memberSummary: demoMemberSummary(r.data) });
          return r.value;
        }
        const value = await live();
        await get().reload();
        return value;
      }

      return {
        mode: isSupabaseConfigured ? "supabase" : "demo",
        ready: false,
        data: isSupabaseConfigured ? emptySnapshot() : freshDemoSnapshot(),
        userId: null,
        memberSummary: null,

        async init() {
          if (get().mode === "demo") {
            set({ ready: true, memberSummary: demoMemberSummary(get().data) });
            return;
          }
          const profile = await loadProfile(sb()).catch(() => null);
          set({ userId: profile?.id ?? null });
          if (profile) await get().reload();
          set({ ready: true });
        },

        async reload() {
          if (get().mode === "demo") return;
          const [data, summary] = await Promise.all([loadSnapshot(sb()), loadMemberSummary(sb())]);
          const me = await loadProfile(sb());
          if (me && !data.profiles.some((p) => p.id === me.id)) data.profiles.push(me);
          set({ data, memberSummary: summary });
        },

        async signIn(email, password) {
          if (get().mode === "demo") {
            const p = get().data.profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
            if (!p || password !== DEMO_PASSWORD || p.role === "member") throw new Error("Email or password is incorrect. Use one of the demo accounts below.");
            set({ userId: p.id });
            get().logActivity("login", "session", `${p.fullName} signed in`);
            return;
          }
          const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
          if (error) throw new Error(error.message);
          await get().init();
          get().logActivity("login", "session", "Signed in");
        },

        signInAsDemo(role) {
          const p = get().data.profiles.find((x) => x.role === role);
          if (!p) return;
          set({ userId: p.id });
          get().logActivity("login", "session", `${p.fullName} signed in`);
        },

        switchDemoRole(role) {
          const p = get().data.profiles.find((x) => x.role === role);
          if (p) set({ userId: p.id });
        },

        async signOut() {
          if (get().mode === "supabase") await sb().auth.signOut();
          set({ userId: null });
        },

        resetDemo() {
          const data = freshDemoSnapshot();
          set({ data, memberSummary: demoMemberSummary(data) });
        },

        recordLedger: (kind, i) =>
          mutate(
            (d, a) => ({ ...M.recordLedger(d, a, kind, i), value: undefined }),
            async () => void (await remote.recordLedger(sb(), kind, i)),
          ),

        recordDonation: (i) =>
          mutate(
            (d, a) => {
              const r = M.recordDonation(d, a, i);
              return { data: r.data, value: { receiptNo: r.value.receiptNo, transactionId: r.value.txn.id } };
            },
            async () => {
              const r = await remote.recordDonation(sb(), i);
              return { receiptNo: r.receipt_no, transactionId: r.transaction_id };
            },
          ),

        recordDistribution: (i) =>
          mutate(
            (d, a) => {
              const r = M.recordDistribution(d, a, i);
              return { data: r.data, value: { referenceNo: r.value.referenceNo } };
            },
            async () => ({ referenceNo: (await remote.recordDistribution(sb(), i)).reference_no }),
          ),

        recordVendorPayment: (i) =>
          mutate(
            (d, a) => {
              const r = M.recordVendorPayment(d, a, i);
              return { data: r.data, value: { paymentId: r.value.paymentId, receiptNo: r.value.receiptNo } };
            },
            async () => {
              const r = await remote.recordVendorPayment(sb(), i);
              return { paymentId: r.payment_id, receiptNo: r.receipt_no };
            },
          ),

        deleteTransaction: (id, reason) =>
          mutate((d, a) => M.deleteTransaction(d, a, id, reason), async () => void (await remote.deleteTransaction(sb(), id, reason))),
        voidTransaction: (id, reason) =>
          mutate((d, a) => M.voidTransaction(d, a, id, reason), async () => void (await remote.voidTransaction(sb(), id, reason))),

        verifyTransactions: (ids) =>
          mutate((d, a) => M.verifyTransactions(d, a, ids), () => remote.verifyTransactions(sb(), ids)),

        updateTransactionNotes: (id, p) =>
          mutate((d, a) => M.updateTransactionNotes(d, a, id, p), async () => void (await remote.updateTransactionNotes(sb(), id, p))),

        createEvent: (i) =>
          mutate(
            (d, a) => {
              const r = M.createEvent(d, a, i);
              return { data: r.data, value: r.value.id };
            },
            async () => (await remote.createEvent(sb(), i)).id as string,
          ),
        updateEvent: (id, p) => mutate((d, a) => M.updateEvent(d, a, id, p), async () => void (await remote.updateEvent(sb(), id, p))),
        createVendor: (i) => mutate((d, a) => M.createVendor(d, a, i), async () => (await remote.createVendor(sb(), i)).id as string),
        updateVendor: (id, i) => mutate((d, a) => M.updateVendor(d, a, id, i), async () => void (await remote.updateVendor(sb(), id, i))),
        addBooking: (i) => mutate((d, a) => M.addBooking(d, a, i), async () => (await remote.addBooking(sb(), i)).id as string),
        updateBooking: (id, i) => mutate((d, a) => M.updateBooking(d, a, id, i), async () => void (await remote.updateBooking(sb(), id, i))),
        removeBooking: (id) => mutate((d, a) => M.removeBooking(d, a, id), async () => void (await remote.removeBooking(sb(), id))),

        setRole: (profileId, role) => mutate((d, a) => M.setRole(d, a, profileId, role), async () => void (await remote.setRole(sb(), profileId, role))),
        addAccount: (i) => mutate((d, a) => M.addAccount(d, a, i), () => remote.addAccount(i)),
        deleteEvent: (id, reason) => mutate((d, a) => M.deleteEvent(d, a, id, reason), async () => void (await remote.deleteEvent(sb(), id, reason))),
        updateSettings: (p) => mutate((d, a) => M.updateSettings(d, a, p), async () => void (await remote.updateSettings(sb(), p))),

        logActivity(action, entity, summary) {
          const a = get().data.profiles.find((x) => x.id === get().userId);
          if (!a) return;
          if (get().mode === "demo") {
            set({ data: M.logActivity(get().data, a, action, entity, summary).data });
          } else {
            remote.logActivity(sb(), action, entity, summary).catch(() => undefined);
          }
        },
      };
    },
    {
      name: "arshs-finance-demo",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // Only demo mode keeps data in the browser. Supabase mode keeps nothing locally.
      partialize: (s) => (s.mode === "demo" ? { data: s.data, userId: s.userId } : {}),
      migrate: () => ({ data: freshDemoSnapshot(), userId: null }) as unknown as AppState,
    },
  ),
);

// ---------- selectors ----------
export const useMe = () => useApp((s) => s.data.profiles.find((p) => p.id === s.userId) ?? null);
export const useRole = () => useApp((s) => s.data.profiles.find((p) => p.id === s.userId)?.role);
export const useData = () => useApp((s) => s.data);
