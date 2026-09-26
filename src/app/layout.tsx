import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: { default: "ARSHS Finance", template: "%s · ARSHS Finance" },
  description: "Finance and event management for the Adeeb Rizvi Serving Humanity Society.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef3f1" },
    { media: "(prefers-color-scheme: dark)", color: "#07130f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
