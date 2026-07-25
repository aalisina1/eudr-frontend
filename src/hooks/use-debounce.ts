"use client";

import { useEffect, useState } from "react";

/** Debounces a fast-changing value (e.g. a controlled search input) so
 * dependents (query keys, fetches) don't re-fire on every keystroke.
 * Extracted from data-table.tsx's private copy so non-DataTable consumers
 * (e.g. the Shipments Calendar agenda search) can reuse the same idiom. */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
