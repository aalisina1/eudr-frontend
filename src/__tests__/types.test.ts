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
  SyncRecord,
  MappingConfig,
  FieldMapping,
  PaginatedResponse,
  SourceType,
  ConnectionStatus,
  SchemaObjectType,
  Transformation,
  SyncConfig,
  SyncJob,
  TracesSubmission,
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

  it("SyncRecord has status and target fields", () => {
    const record: SyncRecord = {
      id: "sr1",
      sync_job: "job1",
      source_data: { name: "test" },
      transformed_data: { name: "TEST" },
      status: "PENDING_REVIEW",
      target_object_type: "LAND_PLOT",
      target_object_id: null,
      error_message: "",
      review_notes: "",
      reviewed_by_id: null,
      reviewed_at: null,
      created_at: "",
    };
    expect(record.status).toBe("PENDING_REVIEW");
  });

  it("Transformation interface has query fields", () => {
    const t: Transformation = {
      id: "t1",
      name: "Test query",
      description: "",
      query_text: "SELECT 1",
      output_columns: [{ name: "col1", type: "varchar" }],
      is_validated: false,
      created_at: "",
      updated_at: "",
    };
    expect(t.output_columns).toHaveLength(1);
  });

  it("MappingConfig interface has source_type", () => {
    const m: MappingConfig = {
      id: "m1",
      name: "Test mapping",
      source: "src1",
      source_type: "SOURCE_OBJECT",
      source_object: null,
      transformation: null,
      target_object_type: "SUPPLIER",
      is_active: true,
      version: 1,
      created_at: "",
      updated_at: "",
    };
    expect(m.source_type).toBe("SOURCE_OBJECT");
  });

  it("TracesSubmission interface has traces_status, verification_number, soap payloads, and corrected enums", () => {
    const submission: TracesSubmission = {
      id: "ts1",
      dds_id: "dds1",
      submission_type: "CREATE",
      status: "QUEUED",
      traces_status: "AVAILABLE",
      verification_number: "VER-123",
      traces_reference_number: "TR-456",
      error_message: "",
      attempt_count: 1,
      last_attempted_at: null,
      next_retry_at: null,
      submitted_at: "2025-06-30T00:00:00Z",
      submitted_by_id: "user1",
      soap_request_payload: "<soap:Envelope>...</soap:Envelope>",
      soap_response_payload: "<soap:Envelope>...</soap:Envelope>",
      created_at: "2025-06-30T00:00:00Z",
    };
    expect(submission.traces_status).toBe("AVAILABLE");
    expect(submission.verification_number).toBe("VER-123");
    expect(submission.traces_reference_number).toBe("TR-456");
    expect(submission.soap_request_payload).toBeDefined();
    expect(submission.soap_response_payload).toBeDefined();
    expect(submission.status).toBe("QUEUED");
    expect(submission.submission_type).toBe("CREATE");
  });

  it("DueDiligenceStatement interface has activity_type field", () => {
    const dds: DueDiligenceStatement = {
      id: "dds1",
      reference_number: "DDS-001",
      traces_reference: "TR-001",
      status: "DRAFT",
      statement_type: "OPERATOR",
      activity_type: "DOMESTIC",
      batch_ids: [],
      risk_conclusion: null,
      conclusion_justification: "",
      operator_id: "op1",
      created_by_id: "user1",
      reviewed_by_id: null,
      submitted_at: null,
      valid_until: null,
      archived_until: null,
      created_at: "2025-06-30T00:00:00Z",
      updated_at: "2025-06-30T00:00:00Z",
    };
    expect(dds.activity_type).toBe("DOMESTIC");
  });
});
