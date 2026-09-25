"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  side?: "center" | "right";
  icon?: React.ReactNode;
}

const WIDTH = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

export function Modal({ open, onOpenChange, title, description, children, size = "md", side = "center", icon }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-brand-950/40 backdrop-blur-[3px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
              <motion.div
                className={cn(
                  "fixed z-50 flex max-h-[92vh] flex-col overflow-hidden border border-line bg-surface shadow-[var(--shadow-lift)] outline-none",
                  side === "center"
                    ? cn("left-1/2 top-1/2 w-[calc(100vw-1.5rem)] rounded-3xl", WIDTH[size])
                    : "bottom-0 right-0 top-0 h-full w-full max-w-xl rounded-l-3xl max-h-none",
                )}
                initial={side === "center" ? { opacity: 0, scale: 0.94, x: "-50%", y: "-46%" } : { x: "100%" }}
                animate={side === "center" ? { opacity: 1, scale: 1, x: "-50%", y: "-50%" } : { x: 0 }}
                exit={side === "center" ? { opacity: 0, scale: 0.96, x: "-50%", y: "-48%" } : { x: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              >
                <div className="flex items-start gap-3 border-b border-line px-6 py-5">
                  {icon && <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200">{icon}</div>}
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="font-display text-xl font-semibold tracking-tight">{title}</Dialog.Title>
                    {description ? (
                      <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description>
                    ) : (
                      <Dialog.Description className="sr-only">Dialog</Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Close">
                    <X className="h-5 w-5" />
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("sticky bottom-0 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-6 py-4 backdrop-blur", className)}>{children}</div>;
}
