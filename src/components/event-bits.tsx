"use client";
import { HandCoins, ReceiptText, Store } from "lucide-react";
import type { EventStatus, EventType } from "@/lib/types";
import { EVENT_STATUS_LABEL } from "@/lib/constants";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<EventStatus, Tone> = { planned: "outline", active: "inflow", completed: "brand", cancelled: "coral" };

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot={status === "active"} className={status === "active" ? "[&>span]:animate-pulse" : undefined}>
      {EVENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export const EVENT_TYPE_STYLE: Record<EventType, { Icon: typeof Store; color: string; tint: string }> = {
  fundraiser: { Icon: Store, color: "#0E6B57", tint: "from-brand-500/15" },
  expenditure: { Icon: ReceiptText, color: "#E2583E", tint: "from-red-500/12" },
  collection: { Icon: HandCoins, color: "#C9861A", tint: "from-marigold-500/15" },
};

export function EventTypeIcon({ type, className }: { type: EventType; className?: string }) {
  const s = EVENT_TYPE_STYLE[type];
  return (
    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", className)} style={{ background: `${s.color}1c`, color: s.color }}>
      <s.Icon className="h-5 w-5" />
    </span>
  );
}
