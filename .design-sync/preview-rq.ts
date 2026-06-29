// Re-exported into the DS bundle (via cfg.extraEntries) so preview cards can wrap
// data-driven composites (DataTable, the forms) in a QueryClientProvider that shares
// the SAME @tanstack/react-query instance the bundled components use. Importing the
// provider from a separate copy gives a different React context → "No QueryClient set".
export { QueryClient, QueryClientProvider } from "@tanstack/react-query";
