import type { Metadata } from "next";
import { DM_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/providers";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

// Backs `--font-mono` (see globals.css `@theme inline`: `--font-mono: var(--font-geist-mono)`).
// Reference numbers, TRACES ids and other "mono chip" text rely on `font-mono`
// throughout the app; this was previously an undefined CSS var (no font ever
// loaded it), silently falling back to the body sans font.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canopy — EUDR Compliance Platform",
  description: "Deforestation-free supply chain management & due diligence reporting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches))d.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${dmSans.variable} ${fraunces.variable} ${jetbrainsMono.variable} font-sans antialiased grain`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
