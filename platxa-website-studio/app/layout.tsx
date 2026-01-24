import type { Metadata } from "next";
import { StreamingPreviewProvider } from "@/lib/preview";
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
        <StreamingPreviewProvider>
          {children}
        </StreamingPreviewProvider>
      </body>
    </html>
  );
}
