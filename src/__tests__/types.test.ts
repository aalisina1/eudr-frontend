import { describe, it, expect } from "vitest";
import type {
  User,
  Supplier,
  LandPlot,
  Batch,
  DueDiligenceStatement,
  Document,
  DataSource,
  DataSourceSchema,
  IngestJob,
  RawRecord,
  StagingRecord,
  MappingTemplate,
  FieldMapping,
  PaginatedResponse,
  SourceType,
  ConnectionStatus,
  SchemaObjectType,
} from "@/lib/api/types";

/**
 * Type-level tests — these verify that our TypeScript interfaces
 * compile correctly and have the expected shape. If any interface
 * is changed in a breaking way, these tests will fail at compile time.
 */
describe("Type definitions", () => {
  it("User interface has required fields", () => {
    const user: User = {
      id: "u1",
      email: "a@b.com",
      username: "test",
      first_name: "Test",
      last_name: "User",
      role: "ADMIN",
      organization_id: null,
      is_staff: false,
    };
    expect(user.id).toBeDefined();
    expect(user.role).toBe("ADMIN");
  });

  it("Supplier interface has required fields", () => {
    const supplier: Supplier = {
      id: "s1",
      name: "Test",
      country_of_origin: "BR",
      kyc_status: "PENDING",
      risk_rating: "LOW",
      external_id: "",
      managed_by_id: "org1",
      supplier_organization_id: null,
      kyc_verified_at: null,
      created_at: "",
      updated_at: "",
    };
    expect(supplier.kyc_status).toBe("PENDING");
  });

  it("DataSource interface has connection_status", () => {
    const source: DataSource = {
      id: "ds1",
      name: "Test SQL",
      source_type: "SQL_SERVER",
      transform_mode: "FIELD_MAPPER",
      connection_status: "UNTESTED",
      last_connected_at: null,
      is_active: true,
      created_at: "",
      updated_at: "",
    };
    expect(source.connection_status).toBe("UNTESTED");
  });

  it("PaginatedResponse wraps results array", () => {
    const page: PaginatedResponse<{ id: string }> = {
      count: 1,
      next: null,
      previous: null,
      results: [{ id: "1" }],
    };
    expect(page.results).toHaveLength(1);
  });

  it("SourceType union includes SQL_SERVER", () => {
    const t: SourceType = "SQL_SERVER";
    expect(t).toBe("SQL_SERVER");
  });

  it("ConnectionStatus union values", () => {
    const statuses: ConnectionStatus[] = [
      "UNTESTED",
      "CONNECTED",
      "FAILED",
    ];
    expect(statuses).toHaveLength(3);
  });

  it("SchemaObjectType union values", () => {
    const types: SchemaObjectType[] = [
      "TABLE",
      "VIEW",
      "FILE",
      "ENDPOINT",
    ];
    expect(types).toHaveLength(4);
  });

  it("StagingRecord has validation_errors array", () => {
    const record: StagingRecord = {
      id: "sr1",
      target_object_type: "LAND_PLOT",
      status: "PENDING_REVIEW",
      transformed_data: {},
      validation_errors: ["field missing"],
      promoted_object_id: null,
      review_notes: "",
      created_at: "",
    };
    expect(record.validation_errors).toHaveLength(1);
  });
});
