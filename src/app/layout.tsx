import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EstateOS — Your agency, connected", template: "%s | EstateOS" },
  description: "The foundation for a connected real estate agency. Explore the EstateOS CRM frontend for UAE agencies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-svh antialiased" suppressHydrationWarning>
        <Providers>
          <a href="#main-content" className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground focus:translate-y-0">Skip to content</a>
          {children}
        </Providers>
      </body>
    </html>
  );
}
