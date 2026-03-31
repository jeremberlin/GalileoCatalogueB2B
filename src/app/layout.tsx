import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Galileo — Catalogue Formations 2026-2027",
  description:
    "Catalogue des formations professionnelles du groupe Galileo Global Education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col bg-surface text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
