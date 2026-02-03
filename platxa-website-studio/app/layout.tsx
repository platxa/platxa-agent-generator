import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { StreamingPreviewProvider } from "@/lib/preview/client";
import "./globals.css";

export const metadata: Metadata = {
  title: "Platxa Website Studio",
  description: "AI-powered Odoo website generator - create beautiful websites with natural language",
  keywords: ["Odoo", "website", "AI", "generator", "themes", "QWeb"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <SessionProvider>
            <StreamingPreviewProvider>
              {children}
            </StreamingPreviewProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
