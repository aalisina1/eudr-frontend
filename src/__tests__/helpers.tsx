import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Create a fresh QueryClient for each test to prevent shared state.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Render with all providers (QueryClientProvider, etc).
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...options }), queryClient };
}

/**
 * Build a mock paginated response matching the DRF format.
 */
export function mockPaginatedResponse<T>(results: T[], count?: number) {
  return {
    count: count ?? results.length,
    next: null,
    previous: null,
    results,
  };
}

/**
 * Create a mock fetch that returns JSON responses keyed by URL pattern.
 */
export function createMockFetch(
  handlers: Record<string, unknown>
): typeof globalThis.fetch {
  return async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    for (const [pattern, data] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ detail: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };
}
