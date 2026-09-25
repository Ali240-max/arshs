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
    label: "Events",
    items: [{ href: "/events", label: "Events", icon: CalendarRange, hint: "Fundraisers, drives and campaigns" }],
  },
];

// Planned modules, kept here so the icons and hints are ready when the pages are built.
export const PLANNED = { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BarChart3, HandHeart, HeartHandshake, Settings, Store, Users, Activity };
