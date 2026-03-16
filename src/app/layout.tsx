import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Canopy — EUDR Compliance Platform",
  description: "Deforestation-free supply chain management & due diligence reporting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${fraunces.variable} font-sans antialiased grain`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
