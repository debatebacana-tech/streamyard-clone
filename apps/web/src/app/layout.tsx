import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every page here is session- or live-room-driven (host auth, invite tokens,
// signed layout tokens) with no meaningful static shell to prerender, so we
// opt the whole app out of Cache Components' instant-navigation validation.
export const instant = false;

export const metadata: Metadata = {
  title: "Estúdio ao vivo",
  description: "Estúdio de transmissão ao vivo self-hosted para o YouTube",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
