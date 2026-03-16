"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
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

interface DataTableProps<T> {
  /** React Query cache key prefix, e.g. "suppliers" */
  queryKey: string;
  /** API path, e.g. "/api/v1/suppliers/" */
  endpoint: string;
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Filter definitions */
  filters?: FilterDef[];
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
  /** Empty state content */
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
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
  searchable = true,
  searchPlaceholder = "Search...",
  pageSize = 20,
  rowKey,
  onRowClick,
  emptyIcon,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting your search or filters",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [ordering, setOrdering] = useState<string>("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  // Reset to page 1 when search/filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeFilters]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (ordering) params.set("ordering", ordering);
    params.set("limit", String(pageSize));
    params.set("offset", String((page - 1) * pageSize));
    for (const [key, value] of Object.entries(activeFilters)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [debouncedSearch, ordering, page, pageSize, activeFilters]);

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

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (ordering === columnKey) return <ArrowUp className="size-3" />;
    if (ordering === `-${columnKey}`) return <ArrowDown className="size-3" />;
    return <ArrowUpDown className="size-3 opacity-30" />;
  };

  const TH = "text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

  return (
    <div className="space-y-4">
      {/* Toolbar: search + filters */}
      {(searchable || filters.length > 0) && (
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
      <div className={`rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-opacity ${isPlaceholderData ? "opacity-70" : ""}`}>
        <Table>
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
                <TableCell colSpan={columns.length} className="h-40">
                  <div className="flex flex-col items-center justify-center text-center">
                    {emptyIcon && (
                      <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                        {emptyIcon}
                      </div>
                    )}
                    <p className="text-sm font-medium mb-0.5">{emptyTitle}</p>
                    <p className="text-xs text-muted-foreground">{emptyDescription}</p>
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
