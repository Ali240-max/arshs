"use client";
import { create } from "zustand";

export type ModalRequest =
  | { kind: "donation"; eventId?: string }
  | { kind: "distribution"; eventId?: string }
  | { kind: "ledger"; ledgerKind: "income" | "expense"; eventId?: string }
  | { kind: "vendorPayment"; bookingId?: string; eventId?: string }
  | { kind: "booking"; eventId: string; bookingId?: string }
  | { kind: "vendor"; vendorId?: string }
  | { kind: "void"; txnId: string }
  | { kind: "txn"; txnId: string }
  | { kind: "event"; eventId: string };

interface UIState {
  modal: ModalRequest | null;
  open: (m: ModalRequest) => void;
  close: () => void;
  paletteOpen: boolean;
  setPalette: (v: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNav: boolean;
  setMobileNav: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  modal: null,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
  paletteOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileNav: false,
  setMobileNav: (mobileNav) => set({ mobileNav }),
}));
