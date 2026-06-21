"use client";

import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Root toast region — mounted once in the dashboard layout, never per-page.
 *
 * Tracks the manual `.dark` class on <html> (this app has no next-themes /
 * ThemeProvider — see app-sidebar.tsx's toggleTheme) so toasts match the
 * current light/dark theme without a new theme context.
 *
 * Sonner renders its container with `aria-live="polite"` and individual
 * toasts with `role="status"`, doesn't trap focus, and its dismiss button
 * (when `closeButton` is set) is a real keyboard-reachable <button>.
 */
function Toaster({ ...props }: ToasterProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.classList.contains("dark") ? "dark" : "light");
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      closeButton
      duration={4000}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--primary)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--destructive)",
          "--error-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
