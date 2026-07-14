"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
  /** Optional override for the CSV export cell — e.g. resolve a joined name
   * instead of a raw foreign-key UUID, or format a nested/derived value the
   * raw `item[key]` lookup can't reach (eudr-frontend #28). Falls back to
   * the existing `item[key]` behaviour when omitted. */
  exportValue?: (item: T) => string | number;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
}

export interface ExportColumnDef {
  key: string;
  header: string;
  /** Extract a plain string/number value for CSV export */
  exportValue?: (item: unknown) => string | number;
}

interface DataTableProps<T> {
  /** React Query cache key prefix, e.g. "suppliers" */
  queryKey: string;
  /** API path, e.g. "/api/v1/suppliers/" */
  endpoint: string;
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Filter definitions */
  filters?: FilterDef[];
  /** Extra fixed query params merged into every request (list + CSV export).
   * For a filter whose options don't all map to the same query param — e.g.
   * a derived "Stage" select where one option (Blocked) is really a
   * different backend param than the rest (`blocked=true` vs. `stage=...`)
   * — eudr-frontend #28. Optional; existing callers are unaffected. */
  extraParams?: Record<string, string>;
  /** Extra toolbar content rendered in the same row as search/filters/export
   * (e.g. a custom Select whose options don't fit the generic `FilterDef`
   * key/value shape — eudr-frontend #28). */
  toolbarExtra?: React.ReactNode;
  /** Enable the search input */
  searchable?: boolean;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Items per page (default 20) */
  pageSize?: number;
  /** Unique key extractor for each row */
  rowKey: (item: T) => string;
  /** Callback when a row is clicked */
  onRowClick?: (item: T) => void;
  /** Enable CSV export button */
  exportable?: boolean;
  /** Filename prefix for CSV export (default: queryKey) */
  exportFilename?: string;
  /** Empty state content */
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Rendered under the empty-state title/description — e.g. call-to-action
   * buttons (eudr-frontend #28). Optional; existing pages unaffected. */
  emptyAction?: React.ReactNode;
}

// ── Hook: debounced value ────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  queryKey,
  endpoint,
  columns,
  filters = [],
  extraParams = {},
  toolbarExtra,
  searchable = true,
  searchPlaceholder = "Search...",
  pageSize = 20,
  rowKey,
  onRowClick,
  exportable = false,
  exportFilename,
  emptyIcon,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your search or filters",
  emptyAction,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [ordering, setOrdering] = useState<string>("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  // Reset to page 1 when search/filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, activeFilters, extraParams]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (ordering) params.set("ordering", ordering);
    params.set("limit", String(pageSize));
    params.set("offset", String((page - 1) * pageSize));
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) params.set(key, value);
    }
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [debouncedSearch, ordering, page, pageSize, activeFilters, extraParams]);

  const { data, isLoading, isPlaceholderData, error } = useQuery<PaginatedResponse<T>>({
    queryKey: [queryKey, queryParams],
    queryFn: async () => {
      const res = await authFetch(`${endpoint}?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  const handleSort = useCallback((key: string) => {
    setOrdering((prev) => {
      if (prev === key) return `-${key}`;
      if (prev === `-${key}`) return "";
      return key;
    });
  }, []);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleExportCSV = useCallback(async () => {
    // Fetch all records (up to 1000) for export
    const exportParams = new URLSearchParams();
    if (debouncedSearch) exportParams.set("search", debouncedSearch);
    if (ordering) exportParams.set("ordering", ordering);
    exportParams.set("limit", "1000");
    exportParams.set("offset", "0");
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) exportParams.set(key, value);
    }
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) exportParams.set(key, value);
    }
    const res = await authFetch(`${endpoint}?${exportParams.toString()}`);
    if (!res.ok) return;
    const result: PaginatedResponse<T> = await res.json();

    // Build CSV
    const headers = columns.map((c) => c.header);
    const rows = result.results.map((item) =>
      columns.map((col) => {
        const val = col.exportValue ? col.exportValue(item) : (item as Record<string, unknown>)[col.key];
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
    );

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename ?? queryKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, debouncedSearch, ordering, activeFilters, extraParams, endpoint, queryKey, exportFilename]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (ordering === columnKey) return <ArrowUp className="size-3" />;
    if (ordering === `-${columnKey}`) return <ArrowDown className="size-3" />;
    return <ArrowUpDown className="size-3 opacity-30" />;
  };

  const TH = "text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters */}
      {(searchable || filters.length > 0 || toolbarExtra) && (
        <div className="flex flex-wrap items-center gap-3">
          {searchable && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 h-9 bg-secondary/50 border-border/60 focus:bg-card rounded-xl text-[13px]"
              />
            </div>
          )}
          {filters.map((filter) => (
            <select
              key={filter.key}
              value={activeFilters[filter.key] ?? ""}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              className="h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="">{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
          {toolbarExtra}
          {exportable && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="h-9 gap-1.5 text-xs rounded-xl border-border/60 ml-auto"
            >
              <Download className="size-3.5" />
              Export CSV
            </Button>
          )}
          {(search || Object.values(activeFilters).some(Boolean)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setActiveFilters({});
                setOrdering("");
              }}
              className="text-xs text-muted-foreground h-9"
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
          Failed to load data. Is the API running?
        </div>
      )}

      {/* Table */}
      <div className={`rounded-2xl border border-border/50 bg-card overflow-hidden shadow-card transition-opacity ${isPlaceholderData ? "opacity-70" : ""}`}>
        <Table>
          {!isLoading && data && data.results.length > 0 && totalPages <= 1 && (
            <TableCaption className="mb-1">
              Showing {data.results.length} of {data.count} {data.count === 1 ? "result" : "results"}
            </TableCaption>
          )}
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`${TH} ${col.sortable ? "cursor-pointer select-none hover:text-foreground transition-colors" : ""}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && <SortIcon columnKey={col.key} />}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/30">
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-full rounded-md" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.results.map((item) => (
                  <TableRow
                    key={rowKey(item)}
                    className={`border-border/30 hover:bg-muted/30 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key}>{col.render(item)}</TableCell>
                    ))}
                  </TableRow>
                ))}

            {!isLoading && data?.results.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className={emptyAction ? "py-14" : "h-40"}>
                  <div className="flex flex-col items-center justify-center text-center">
                    {emptyIcon && (
                      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        {emptyIcon}
                      </div>
                    )}
                    <p className="text-sm font-medium mb-0.5">{emptyTitle}</p>
                    <p className="text-xs text-muted-foreground max-w-md">{emptyDescription}</p>
                    {emptyAction && <div className="mt-4">{emptyAction}</div>}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>
            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, data?.count ?? 0)} of {data?.count ?? 0}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className="h-8 w-8 p-0 text-[13px]"
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
