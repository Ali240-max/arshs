import { cn } from "@/lib/utils";

/** Society logo (public/logo.png). Used in the sidebar, login, receipts and reports. */
export function LogoMark({ className }: { className?: string }) {
  // Plain <img>: it prints reliably and loads instantly on the print pages.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="Serving Humanity logo" width={512} height={512} className={cn("h-9 w-9 shrink-0 object-contain", className)} draggable={false} />;
}
