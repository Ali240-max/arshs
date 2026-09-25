// Domain types. Each interface maps 1:1 to a table in supabase/migrations.
// Field names are camelCase here and snake_case in Postgres; see lib/data/supabase-source.ts.

export type Role = "finance_secretary" | "president" | "member";

export type EventType = "fundraiser" | "expenditure" | "collection";
export type EventStatus = "planned" | "active" | "completed" | "cancelled";

/** Every money movement is one of these five kinds. */
export type TxnKind = "vendor_payment" | "donation" | "income" | "expense" | "distribution";
export type Direction = "in" | "out";
export type TxnStatus = "posted" | "void";

export type PaymentMethod = "cash" | "bank_transfer" | "easypaisa" | "jazzcash" | "cheque" | "other";
export type RecipientType = "individual" | "family" | "group" | "institution";

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  phone?: string;
  joinedAt: string;
}

export interface SocietySettings {
  societyName: string;
  subtitle: string;
  openingBalance: number;
  openingBalanceDate: string; // yyyy-mm-dd
  receiptFooter: string;
}

export interface Category {
  id: string;
  name: string;
  kind: TxnKind;
  color: string;
}

export interface SocietyEvent {
  id: string;
  code: string;
  name: string;
  type: EventType;
  status: EventStatus;
  startDate: string;
  endDate: string;
  /** Number of trading days. Vendor fees are charged per day, as in the Excel sheets. */
  days: number;
  location: string;
  description?: string;
  targetAmount?: number;
  budget?: number;
  expectedVendors?: number;
  defaultDayFee?: number;
  createdBy: string;
  createdAt: string;
}

export interface EventMember {
  eventId: string;
  profileId: string;
  duty: string;
}

/** A vendor in the reusable directory. The same vendor can book stalls at many events. */
export interface Vendor {
  id: string;
  code: string;
  businessName: string;
  ownerName?: string;
  phone?: string;
  stallType?: string;
  notes?: string;
  createdAt: string;
}

/** A vendor's stall booking at one event. */
export interface EventVendor {
  id: string;
  eventId: string;
  vendorId: string;
  stallNo: string;
  stallType?: string;
  /** Fee for each event day. 0 means the vendor did not trade that day ("-" in the old sheets). */
  dayFees: number[];
  notes?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  code: string;
  date: string;
  kind: TxnKind;
  direction: Direction;
  amount: number;
  categoryId: string;
  eventId?: string;
  method: PaymentMethod;
  /** Who paid us, or who we paid. */
  counterparty?: string;
  description: string;
  reference?: string;
  status: TxnStatus;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface Donation {
  id: string;
  transactionId: string;
  donorName?: string;
  donorPhone?: string;
  isAnonymous: boolean;
  purpose: string;
  receiptNo: string;
}

export interface Distribution {
  id: string;
  transactionId: string;
  recipientName: string;
  recipientType: RecipientType;
  recipientContact?: string;
  beneficiaryCount: number;
  referenceNo: string;
}

export interface VendorPayment {
  id: string;
  transactionId: string;
  eventVendorId: string;
  receiptNo: string;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "void"
  | "verify"
  | "view"
  | "print"
  | "export"
  | "login"
  | "role_change";

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

export interface Snapshot {
  settings: SocietySettings;
  profiles: Profile[];
  categories: Category[];
  events: SocietyEvent[];
  eventMembers: EventMember[];
  vendors: Vendor[];
  eventVendors: EventVendor[];
  transactions: Transaction[];
  donations: Donation[];
  distributions: Distribution[];
  vendorPayments: VendorPayment[];
  auditLogs: AuditLog[];
}

export type VendorPaymentStatus = "paid" | "partial" | "pending";
