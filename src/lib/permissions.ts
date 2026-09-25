import type { Role } from "./types";

/**
 * UI permission map. The UI hides what a role cannot do; Supabase RLS policies
 * (supabase/migrations/0002_security.sql) enforce the same rules on the server.
 * Never rely on this file alone for security.
 */
export type Permission =
  | "finance.view" // see ledgers, donors, recipients, vendor money
  | "finance.write" // record, edit, void money records
  | "events.write" // create and edit events, vendors, bookings
  | "transactions.verify" // countersign posted transactions
  | "reports.view"
  | "audit.view"
  | "users.view"
  | "users.manage_roles"
  | "settings.write";

const MATRIX: Record<Role, Permission[]> = {
  finance_secretary: [
    "finance.view",
    "finance.write",
    "events.write",
    "reports.view",
    "audit.view",
    "users.view",
    "settings.write",
  ],
  // View-only: sees every page and number, cannot change anything.
  president: ["finance.view", "reports.view", "audit.view", "users.view"],
  member: [],
};

export function can(role: Role | undefined, permission: Permission) {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

/** Routes each role may open. Members only see the dashboard summary and events. */
export function canOpenRoute(role: Role | undefined, pathname: string) {
  if (!role) return false;
  if (pathname.startsWith("/dashboard") || pathname === "/events" || /^\/events\/[^/]+$/.test(pathname)) {
    return pathname === "/events/new" ? can(role, "events.write") : true;
  }
  if (pathname.startsWith("/events/new")) return can(role, "events.write");
  if (pathname.startsWith("/activity")) return can(role, "audit.view");
  if (pathname.startsWith("/users")) return can(role, "users.view");
  if (pathname.startsWith("/settings")) return true;
  return can(role, "finance.view");
}
