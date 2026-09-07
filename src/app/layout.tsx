import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/providers/providers";
import { PRODUCT_TITLE, PRODUCT_DESCRIPTION } from "@/lib/brand";

/**
 * Type (eudr-frontend#156, #157). Geist Sans and Geist Mono (SIL OFL, from
 * the `geist` package) are the open faces closest to the Render direction
 * (a geometric grotesque with a matching mono). They replace DM Sans,
 * Fraunces and JetBrains Mono. `--font-geist-mono` was already the mono
 * variable in globals.css before any of this: it was the original intent.
 *
 * #157, if the founder buys Neue Montreal / Roobert: swap these two imports
 * for `next/font/local` loaders pointing at `src/fonts/*.woff2` with the same
 * `variable` names, and nothing else changes. See the comment in globals.css
 * next to --font-display.
 */

export const metadata: Metadata = {
  title: PRODUCT_TITLE,
  description: PRODUCT_DESCRIPTION,
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
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
