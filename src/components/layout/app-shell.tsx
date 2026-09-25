"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useApp, useRole } from "@/lib/store";
import { canOpenRoute } from "@/lib/permissions";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { GlobalModals } from "@/components/forms/global-modals";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useApp((s) => s.ready);
  const userId = useApp((s) => s.userId);
  const init = useApp((s) => s.init);
  const role = useRole();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (ready && !userId) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, userId, pathname, router]);

  if (!ready || !userId) {
    return (
      <div className="app-mesh min-h-dvh">
        <PageSkeleton />
      </div>
    );
  }

  // Only two accounts use the app: the Finance Secretary (full control) and the President (view-only).
  // Anyone else who signs in, e.g. a new Supabase signup with the default "member" role, gets no access.
  if (role !== "finance_secretary" && role !== "president") {
    return (
      <div className="app-mesh grid min-h-dvh place-items-center p-6">
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="No access"
          description="This account is not the Finance Secretary or President. Ask the Finance Secretary to give you access."
          action={
            <Button
              variant="secondary"
              onClick={async () => {
                await useApp.getState().signOut();
                router.replace("/login");
              }}
            >
              Sign out
            </Button>
          }
        />
      </div>
    );
  }

  const allowed = canOpenRoute(role, pathname);

  return (
    <div className="app-mesh flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {allowed ? (
            children
          ) : (
            <EmptyState
              icon={<ShieldAlert className="h-6 w-6" />}
              title="This page is for officers"
              description="Your role can view events and the society summary. Ask the President if you need more access."
              action={
                <Link href="/dashboard">
                  <Button variant="secondary">Back to dashboard</Button>
                </Link>
              }
            />
          )}
        </main>
      </div>
      <GlobalModals />
      <CommandPalette />
    </div>
  );
}
