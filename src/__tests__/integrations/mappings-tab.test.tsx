/**
 * eudr-frontend#90 — creating a "Supply Chain Batch" mapping always 400'd
 * because the form never sent `stream_role`, which
 * `MappingConfigSerializer.validate()` requires for BATCH targets
 * (ADR-0019 D4).
 *
 * These tests assert the *request body crossing the boundary*, which is the
 * gap that let the bug ship: the backend's own tests post `stream_role`, and
 * the frontend compiled because the body was a `Record<string, unknown>`.
 * Nothing looked at what the form actually sent.
 *
 * The edit form is covered too, and deliberately so — the ticket claimed that
 * path was unaffected, but `saveMutation` always sends `target_object_type`,
 * which trips the serializer's `touches_relevant_fields` branch. Switching a
 * mapping to BATCH, and even renaming a legacy BATCH mapping, 400'd for the
 * same reason.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, mockPaginatedResponse } from "../helpers";
import { MappingsTab } from "@/components/integrations/mappings-tab";
import { Toaster } from "@/components/ui/sonner";
import type { MappingConfig, DataSource } from "@/lib/api/types";

const mockSource: DataSource = {
  id: "src-1",
  name: "ERP warehouse",
  source_type: "SQL_SERVER",
  connection_status: "CONNECTED",
  last_connected_at: null,
  is_active: true,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

function mockMapping(overrides: Partial<MappingConfig> = {}): MappingConfig {
  return {
    id: "map-1",
    name: "Existing mapping",
    source: "src-1",
    source_name: "ERP warehouse",
    source_type: "SOURCE_OBJECT",
    source_object: null,
    transformation: null,
    target_object_type: "SUPPLIER",
    stream_role: null,
    is_active: true,
    version: 1,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

/** Captured POST/PATCH bodies to /mappings/, in call order. */
type Captured = { method: string; url: string; body: Record<string, unknown> };

/**
 * Mocks every endpoint MappingsTab touches and records the write bodies.
 * `mappings` seeds the list; `detail` is what the edit form hydrates from.
 */
function mockApi(opts: { mappings?: MappingConfig[]; detail?: MappingConfig } = {}) {
  const captured: Captured[] = [];
  const mappings = opts.mappings ?? [];

  globalThis.fetch = vi
    .fn()
    .mockImplementation((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (method === "POST" || method === "PATCH") {
        captured.push({
          method,
          url,
          body: JSON.parse(String(init?.body ?? "{}")),
        });
        return Promise.resolve(
          new Response(JSON.stringify(mockMapping({ id: "created-1" })), {
            status: method === "POST" ? 201 : 200,
          })
        );
      }

      // Edit form hydration — /mappings/{id}/ before /mappings/
      if (/\/mappings\/[^/]+\/$/.test(url)) {
        return Promise.resolve(
          new Response(JSON.stringify(opts.detail ?? mockMapping()), {
            status: 200,
          })
        );
      }
      if (url.includes("/mappings/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPaginatedResponse(mappings)), {
            status: 200,
          })
        );
      }
      if (url.includes("/sources/")) {
        return Promise.resolve(
          new Response(JSON.stringify(mockPaginatedResponse([mockSource])), {
            status: 200,
          })
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(mockPaginatedResponse([])), { status: 200 })
      );
    });

  return captured;
}

function renderMappingsTab() {
  return renderWithProviders(
    <>
      <MappingsTab />
      <Toaster />
    </>
  );
}

/** List view → create form. */
async function openCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByText("No mapping configs yet")).toBeInTheDocument();
  });
  await user.click(screen.getByRole("button", { name: /create mapping/i }));
  await waitFor(() => {
    expect(screen.getByText("Create Mapping Configuration")).toBeInTheDocument();
  });
}

/** List view → edit form for the first mapping. */
async function openEditForm(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByText("Existing mapping")).toBeInTheDocument();
  });
  await user.click(screen.getByRole("button", { name: /edit/i }));
  await waitFor(() => {
    expect(screen.getByText("Edit Mapping Configuration")).toBeInTheDocument();
  });
}

const targetSelect = () => screen.getByLabelText(/target object type/i);
const streamSelect = () => screen.getByLabelText(/stream role/i);

describe("CreateMappingForm — stream_role (#90)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts stream_role when the target is BATCH", async () => {
    const user = userEvent.setup();
    const captured = mockApi();
    renderMappingsTab();
    await openCreateForm(user);

    await user.type(screen.getByPlaceholderText(/e\.g\./i), "PO ingest");
    await user.selectOptions(targetSelect(), "BATCH");
    await user.selectOptions(streamSelect(), "PO_STREAM");
    await user.click(screen.getByRole("button", { name: /create & add fields/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].method).toBe("POST");
    expect(captured[0].body).toMatchObject({
      name: "PO ingest",
      target_object_type: "BATCH",
      stream_role: "PO_STREAM",
    });
  });

  it("hides the stream role field and posts null for a non-BATCH target", async () => {
    const user = userEvent.setup();
    const captured = mockApi();
    renderMappingsTab();
    await openCreateForm(user);

    await user.type(screen.getByPlaceholderText(/e\.g\./i), "Supplier ingest");
    await user.selectOptions(targetSelect(), "SUPPLIER");

    expect(screen.queryByLabelText(/stream role/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create & add fields/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].body.target_object_type).toBe("SUPPLIER");
    expect(captured[0].body.stream_role).toBeNull();
  });

  it("reveals the stream role field only once BATCH is selected", async () => {
    const user = userEvent.setup();
    mockApi();
    renderMappingsTab();
    await openCreateForm(user);

    // Default target is LAND_PLOT.
    expect(screen.queryByLabelText(/stream role/i)).not.toBeInTheDocument();
    await user.selectOptions(targetSelect(), "BATCH");
    expect(streamSelect()).toBeInTheDocument();
    await user.selectOptions(targetSelect(), "PRODUCT");
    expect(screen.queryByLabelText(/stream role/i)).not.toBeInTheDocument();
  });

  it("blocks submit — and sends nothing — while BATCH has no stream role", async () => {
    const user = userEvent.setup();
    const captured = mockApi();
    renderMappingsTab();
    await openCreateForm(user);

    await user.type(screen.getByPlaceholderText(/e\.g\./i), "PO ingest");
    await user.selectOptions(targetSelect(), "BATCH");

    const submit = screen.getByRole("button", { name: /create & add fields/i });
    expect(submit).toBeDisabled();

    // The guard is the gate, not just the styling: no request escapes.
    await user.click(submit);
    expect(captured).toHaveLength(0);

    await user.selectOptions(streamSelect(), "LOT_STREAM");
    expect(submit).toBeEnabled();
  });

  it("explains what the stream role means rather than showing a bare enum", async () => {
    const user = userEvent.setup();
    mockApi();
    renderMappingsTab();
    await openCreateForm(user);

    await user.selectOptions(targetSelect(), "BATCH");
    expect(
      screen.getByText(/which side of two-stream ingestion/i)
    ).toBeInTheDocument();
  });
});

describe("EditMappingForm — stream_role (#90)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("hydrates the existing stream role and re-sends it on save", async () => {
    const user = userEvent.setup();
    const batch = mockMapping({
      target_object_type: "BATCH",
      stream_role: "LOT_STREAM",
    });
    const captured = mockApi({ mappings: [batch], detail: batch });
    renderMappingsTab();
    await openEditForm(user);

    await waitFor(() => {
      expect(streamSelect()).toHaveValue("LOT_STREAM");
    });

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].method).toBe("PATCH");
    expect(captured[0].body).toMatchObject({
      target_object_type: "BATCH",
      stream_role: "LOT_STREAM",
    });
  });

  it("sends stream_role when switching an existing mapping to BATCH", async () => {
    const user = userEvent.setup();
    const supplier = mockMapping({ target_object_type: "SUPPLIER" });
    const captured = mockApi({ mappings: [supplier], detail: supplier });
    renderMappingsTab();
    await openEditForm(user);

    await waitFor(() => expect(targetSelect()).toHaveValue("SUPPLIER"));
    await user.selectOptions(targetSelect(), "BATCH");
    await user.selectOptions(streamSelect(), "PO_STREAM");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].body).toMatchObject({
      target_object_type: "BATCH",
      stream_role: "PO_STREAM",
    });
  });

  it("makes a legacy BATCH mapping (stream_role=null) choose one before saving", async () => {
    // The backend's non-retroactivity exemption only applies to a PATCH that
    // omits target_object_type. This form always sends it, so the exemption is
    // unreachable from the UI and a rename would 400. Forcing the choice is
    // what makes the save succeed.
    const user = userEvent.setup();
    const legacy = mockMapping({
      target_object_type: "BATCH",
      stream_role: null,
    });
    const captured = mockApi({ mappings: [legacy], detail: legacy });
    renderMappingsTab();
    await openEditForm(user);

    await waitFor(() => expect(streamSelect()).toHaveValue(""));

    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(captured).toHaveLength(0);

    await user.selectOptions(streamSelect(), "PO_STREAM");
    await user.click(save);

    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].body.stream_role).toBe("PO_STREAM");
  });

  it("clears stream_role when a BATCH mapping is retargeted away from BATCH", async () => {
    const user = userEvent.setup();
    const batch = mockMapping({
      target_object_type: "BATCH",
      stream_role: "PO_STREAM",
    });
    const captured = mockApi({ mappings: [batch], detail: batch });
    renderMappingsTab();
    await openEditForm(user);

    await waitFor(() => expect(streamSelect()).toHaveValue("PO_STREAM"));
    await user.selectOptions(targetSelect(), "PRODUCT");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(captured).toHaveLength(1));
    expect(captured[0].body.target_object_type).toBe("PRODUCT");
    // Leaving the old role behind would label a non-BATCH mapping with a
    // two-stream role that means nothing for it.
    expect(captured[0].body.stream_role).toBeNull();
  });
});
