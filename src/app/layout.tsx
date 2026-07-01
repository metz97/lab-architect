import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Solution Architect",
  description:
    "Paste a product brief and get a structured architecture recommendation — stack, AWS services, scaling notes, and a live Mermaid diagram — powered by Gemini, Groq, or NVIDIA NIM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              AI Solution Architect
            </span>
            <Link
              href={process.env.NEXT_PUBLIC_PORTFOLIO_URL ?? "#"}
              className="text-sm text-primary transition-colors hover:text-primary/80"
            >
              ← Back to portfolio
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
