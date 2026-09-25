import type { EventStatus, EventType, PaymentMethod, RecipientType, Role, TxnKind } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  finance_secretary: "Finance Secretary",
  president: "President",
  member: "Member",
};

export const EVENT_TYPE_META: Record<EventType, { label: string; short: string; description: string }> = {
  fundraiser: {
    label: "Vendor / fundraising event",
    short: "Fundraiser",
    description: "Stalls and outside vendors pay a fee per day. Track bookings, payments and print slips.",
  },
  expenditure: {
    label: "Expenditure event",
    short: "Expenditure",
    description: "The society spends money against a budget: iftar drives, relief work, medical camps.",
  },
  collection: {
    label: "Income / collection campaign",
    short: "Collection",
    description: "Money comes in from donors or other sources against a target. No vendors.",
  },
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const KIND_META: Record<TxnKind, { label: string; plural: string; direction: "in" | "out" }> = {
  vendor_payment: { label: "Vendor payment", plural: "Vendor payments", direction: "in" },
  donation: { label: "Donation", plural: "Donations", direction: "in" },
  income: { label: "Other income", plural: "Other income", direction: "in" },
  expense: { label: "Expense", plural: "Expenses", direction: "out" },
  distribution: { label: "Aid given", plural: "Aid distributed", direction: "out" },
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  cheque: "Cheque",
  other: "Other",
};

export const RECIPIENT_TYPE_LABEL: Record<RecipientType, string> = {
  individual: "Individual",
  family: "Family",
  group: "Group / community",
  institution: "Institution",
};

/** Chart and badge colors. Kept in one place so charts, legends and badges agree. */
export const FLOW_COLORS = {
  in: "#169B6B",
  expense: "#E2583E",
  aid: "#7A5AF8",
  net: "#0E6B57",
  marigold: "#E9A21B",
  muted: "#94A3A0",
};

export const DONATION_PURPOSES = [
  "General fund",
  "Ramzan appeal",
  "Flood relief",
  "Medical fund",
  "Education fund",
  "Winter relief",
];

export const STALL_TYPES = ["Food", "Drinks", "Dessert", "Clothing", "Accessories", "Books", "Games", "Services", "Other"];
