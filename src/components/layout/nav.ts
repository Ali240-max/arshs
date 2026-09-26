import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  HandHeart,
  HeartHandshake,
  LayoutDashboard,
  Settings,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short description used by the command palette. */
  hint: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

// Only the modules that are built are listed. Add the rest back as each page lands.
export const NAV: NavGroup[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Balance, charts and what needs attention" }] },
  {
    label: "Money",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, hint: "Every rupee in and out, with search and filters" },
      { href: "/reports", label: "Reports", icon: BarChart3, hint: "Monthly, event, donation, aid and vendor reports" },
    ],
  },
  { label: "Events", items: [{ href: "/events", label: "Events", icon: CalendarRange, hint: "Fundraisers, drives and campaigns" }] },
  {
    label: "System",
    items: [
      { href: "/activity", label: "Activity log", icon: Activity, hint: "Who changed what, and when" },
      { href: "/users", label: "Accounts", icon: Users, hint: "Create Finance and view-only logins" },
      { href: "/settings", label: "Settings", icon: Settings, hint: "Starting balance, society details, theme" },
    ],
  },
];

// Planned modules, kept here so the icons and hints are ready when the pages are built.
export const PLANNED = { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, HandHeart, HeartHandshake, Settings, Store, Users, Activity };
