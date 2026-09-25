import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Creates a login (Supabase Auth user) and gives it Finance or View-only access.
 * Needs SUPABASE_SERVICE_ROLE_KEY on the server. That key never reaches the browser:
 * it has no NEXT_PUBLIC_ prefix and is only read here.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    return NextResponse.json({ error: "Account creation is not set up. Add SUPABASE_SERVICE_ROLE_KEY to the server environment (see SUPABASE_SETUP.md)." }, { status: 500 });

  // Who is asking? Only a signed-in Finance account may create logins.
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { data: me } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (me?.role !== "finance_secretary") return NextResponse.json({ error: "Only a Finance account can create logins." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { fullName?: string; email?: string; password?: string; role?: string } | null;
  const fullName = body?.fullName?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";
  const role = body?.role;
  if (fullName.length < 2) return NextResponse.json({ error: "Enter the person's name." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (role !== "finance_secretary" && role !== "president") return NextResponse.json({ error: "Choose Finance or View only." }, { status: 400 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) {
    const msg = /already.*registered|exists/i.test(error?.message ?? "") ? "An account with this email already exists." : (error?.message ?? "Could not create the login.");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // The signup trigger made a profile with no access. Set the name and access level.
  const { error: upErr } = await admin.from("profiles").update({ full_name: fullName, role }).eq("id", data.user.id);
  if (upErr) return NextResponse.json({ error: `Login created, but setting access failed: ${upErr.message}` }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_name: me.full_name,
    action: "create",
    entity: "profile",
    entity_id: data.user.id,
    summary: `Created ${role === "finance_secretary" ? "Finance · full access" : "View only"} account for ${fullName} (${email})`,
  });

  return NextResponse.json({ id: data.user.id });
}
