"use client";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { useIsDark } from "./theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const dark = useIsDark();
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        position="bottom-right"
        theme={dark ? "dark" : "light"}
        richColors
        closeButton
        toastOptions={{ className: "!rounded-2xl !font-sans", duration: 5000 }}
      />
    </MotionConfig>
  );
}
