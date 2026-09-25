"use client";
import { useMemo } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Eye, Landmark, ShieldOff, UserPlus } from "lucide-react";
import type { Role } from "@/lib/types";
import { useApp, useMe } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/layout/topbar";
import { errorMessage } from "@/components/forms/shared";

const ACCESS: Record<Role, { label: string; tone: "brand" | "outline" | "coral"; Icon: typeof Eye }> = {
  finance_secretary: { label: "Finance · full access", tone: "brand", Icon: Landmark },
  president: { label: "View only", tone: "outline", Icon: Eye },
  member: { label: "No access", tone: "coral", Icon: ShieldOff },
};

export default function AccountsPage() {
  const me = useMe()!;
  const profiles = useApp((s) => s.data.profiles);
  const mode = useApp((s) => s.mode);
  const open = useUI((s) => s.open);
  const write = can(me.role, "finance.write");

  const groups = useMemo(() => {
    const by = (r: Role) => profiles.filter((p) => p.role === r).sort((a, b) => a.fullName.localeCompare(b.fullName));
    return [
      { role: "finance_secretary" as Role, title: "Finance accounts", text: "Full control: money, events, deletes, accounts and settings.", rows: by("finance_secretary") },
      { role: "president" as Role, title: "View-only accounts", text: "See every page and number. Cannot change anything.", rows: by("president") },
      { role: "member" as Role, title: "No access", text: "Can sign in but see nothing. Give them access or leave them here.", rows: by("member") },
    ].filter((g) => g.rows.length || g.role !== "member");
  }, [profiles]);

  async function change(id: string, name: string, role: Role) {
    try {
      await useApp.getState().setRole(id, role);
      toast.success(`${name}: ${ACCESS[role].label}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Accounts"
        description="Who can sign in and what they can do."
        actions={
          write && (
            <Button onClick={() => open({ kind: "account" })}>
              <UserPlus className="h-4 w-4" /> New account
            </Button>
          )
        }
      />

      {groups.map((g, gi) => (
        <Card key={g.role} className="overflow-hidden">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <AccessIcon role={g.role} /> {g.title}
                <span className="text-[13px] font-normal text-muted">({g.rows.length})</span>
              </span>
            }
            description={g.text}
          />
          <ul className="mt-3 divide-y divide-line">
            {g.rows.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">None yet.</li>}
            {g.rows.map((p, i) => {
              const self = p.id === me.id;
              return (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05 + i * 0.03 }}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <Avatar name={p.fullName} className="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {p.fullName}
                      {self && <Badge tone="marigold">You</Badge>}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">
                      {p.email} · since {formatDate(p.joinedAt)}
                    </p>
                  </div>
                  {write && !self ? (
                    <select
                      aria-label={`Access for ${p.fullName}`}
                      value={p.role}
                      onChange={(e) => change(p.id, p.fullName, e.target.value as Role)}
                      className="h-9 rounded-xl border border-line bg-surface px-3 text-[13px] outline-none hover:border-line-strong focus:border-brand-400"
                    >
                      <option value="finance_secretary">Finance · full access</option>
                      <option value="president">View only</option>
                      <option value="member">No access</option>
                    </select>
                  ) : (
                    <Badge tone={ACCESS[p.role].tone}>{ACCESS[p.role].label}</Badge>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </Card>
      ))}

      <p className="text-[12.5px] text-muted">
        {mode === "demo"
          ? "Demo mode: new accounts sign in with password demo1234."
          : "To remove someone, set them to No access. Their past entries stay in the ledger under their name. Password resets are done in Supabase: Authentication > Users."}
      </p>
    </div>
  );
}

function AccessIcon({ role }: { role: Role }) {
  const Icon = ACCESS[role].Icon;
  return <Icon className="h-5 w-5 text-brand-600" />;
}
