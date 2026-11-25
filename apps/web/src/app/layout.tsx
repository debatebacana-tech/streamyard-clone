import type { Metadata } from "next";
import { Anton, Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Broadcast graphics: condensed display face for GC/scoreboard, like TV packages.
const anton = Anton({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const barlow = Barlow_Condensed({ variable: "--font-condensed", weight: ["500", "700"], subsets: ["latin"] });

// Every page here is session- or live-room-driven (host auth, invite tokens,
// signed layout tokens) with no meaningful static shell to prerender, so we
// opt the whole app out of Cache Components' instant-navigation validation.
export const instant = false;

export const metadata: Metadata = {
  title: "Estúdio ao vivo",
  description: "Estúdio de transmissão ao vivo self-hosted para o YouTube",
  // The stream is rendered by a Chrome in English: without this it offers to
  // translate the page and the Google Translate bar shows up on the live.
  other: { google: "notranslate" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      translate="no"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${barlow.variable} h-full antialiased`}
    >
      <body translate="no" className="notranslate min-h-full flex flex-col bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
