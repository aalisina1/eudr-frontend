// Hand-written types mirroring Django models — regenerate from OpenAPI schema with:
// npx openapi-typescript http://localhost:8000/api/v1/schema/ -o src/lib/api/schema.d.ts

// ── Auth ──

export interface User {
  id: string; // UUID
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "ADMIN" | "COMPLIANCE_OFFICER" | "VIEWER" | "SUPPLIER_CONTACT";
  organization_id: string | null;
  organization_name: string | null;
  is_staff: boolean;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

// ── Organization ──

export interface Organization {
  id: string;
  name: string;
  organization_type: "OPERATOR" | "TRADER" | "DOWNSTREAM_OPERATOR" | "SUPPLIER";
  country: string;
  vat_number: string;
  eori_number: string;
  traces_actor_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Suppliers ──

export type KYCStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type RiskRating = "LOW" | "STANDARD" | "HIGH";

export interface Supplier {
  id: string;
  name: string;
  country_of_origin: string;
  kyc_status: KYCStatus;
  risk_rating: RiskRating;
  external_id: string;
  managed_by_id: string;
  supplier_organization_id: string | null;
  kyc_verified_at: string | null;
  created_at: string;
  updated_at: string;
  certifications?: SupplierCertification[];
}

export interface SupplierCertification {
  id: string;
  certification_type: string;
  certificate_number: string;
  issuing_body: string;
  valid_from: string;
  valid_until: string;
  document_id: string | null;
  is_valid: boolean;
  created_at: string;
}

// ── Geolocation ──

export type GeometrySource = "GPS_DEVICE" | "SATELLITE_IMAGERY" | "MANUAL_ENTRY" | "THIRD_PARTY" | "DATA_IMPORT";
export type ValidationStatus = "PENDING" | "PASSED" | "FAILED" | "REQUIRES_REVIEW";

export interface GeoJsonGeometry {
  type: "Point" | "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface LandPlot {
  id: string;
  supplier_id: string;
  organization_id: string;
  country: string;
  region: string;
  area_hectares: number;
  geometry: GeoJsonGeometry | null;
  geometry_source: GeometrySource;
  accuracy_meters: number | null;
  collection_date: string | null;
  validation_status: ValidationStatus;
  validated_at: string | null;
  external_id: string;
  created_at: string;
  updated_at: string;
  validation_results?: PlotValidationResult[];
}

export type Validator = "GLAD_ALERTS" | "RADD_ALERTS" | "PRODES" | "JRC_TMF" | "MANUAL";

export interface PlotValidationResult {
  id: string;
  validator: Validator;
  deforestation_detected: boolean;
  alert_date: string | null;
  confidence_score: number | null;
  notes: string;
  validated_at: string;
}

// ── Commodities ──

export interface Commodity {
  id: string;
  name: string;
  code: string;
  cn_codes: string[];
  hs_codes: string[];
  requires_species: boolean;
}

export interface Product {
  id: string;
  // `commodity`/`species` — the FK field names themselves, per
  // `ProductSerializer.Meta.fields`; DRF does not append `_id`. Corrected
  // while wiring the first real consumer of this type (eudr-frontend #28's
  // New-PO "Commodity" picker) — previously unused, so this was undetected
  // drift, not a behavior change for any existing screen.
  commodity: string;
  commodity_name?: string;
  species: string | null;
  description: string;
  internal_product_code: string;
  cn_code: string;
  is_active: boolean;
}

// ── Supply Chain (Batches) ──

export type BatchUnit = "KG" | "TONNES" | "M3" | "PIECES";
export type BatchStatus = "DRAFT" | "CONFIRMED" | "IN_DDS";

export interface Batch {
  id: string;
  seller_id: string;
  buyer_id: string;
  organization_id: string;
  commodity_id: string;
  quantity: number;
  unit: BatchUnit;
  transaction_date: string;
  country_of_harvest: string;
  harvest_period_start: string | null;
  harvest_period_end: string | null;
  land_plot_ids: string[];
  reference_number: string;
  status: BatchStatus;
  external_id: string;
  created_at: string;
  updated_at: string;
  parent_links?: BatchChainLink[];
  child_links?: BatchChainLink[];
}

export interface BatchChainLink {
  id: string;
  parent_batch: string;
  child_batch: string;
  volume_ratio: number;
  created_at: string;
}

// ── Supply Chain — PO Readiness (BE-A, eudr-app #60 / PR #83, in QA) ──
// Derived (not stored) readiness pipeline + tonnes coverage funnel for a "PO
// batch" (a Batch with no plots of its own — lots resolve to it via
// BatchChainLink). See eudr-vault/10-Specs/dds-readiness-pipeline.md
// Decision 4 and eudr-app PR #83's body for the full contract this mirrors.

export type ReadinessStage = "OPEN" | "ALLOCATED" | "PLOTS_COMPLETE" | "READY" | "FILED";

export type ReadinessBlockerCode =
  | "NO_LOTS_LINKED"
  | "MISSING_HARVEST_PERIOD"
  | "MISSING_GEOLOCATION"
  | "PRODUCT_UNRESOLVABLE"
  | "PLOT_NOT_FOUND"
  | "BATCH_NOT_FOUND"
  | "OPERATOR_IDENTITY_INCOMPLETE"
  | "UNIT_MISMATCH"
  | "PLOTS_FAILED_VALIDATION"
  | "PLOTS_PENDING_VALIDATION"
  | "OVER_ALLOCATED";

export interface ReadinessBlocker {
  code: ReadinessBlockerCode;
  message: string;
  count: number | null;
}

/** Quantities are `DecimalField`s — DRF serializes these as strings (e.g.
 * `"500000.0000"`), not numbers. `Number(...)` before doing arithmetic. */
export interface CoverageFunnel {
  unit: BatchUnit;
  ordered_quantity: string;
  allocated_quantity: string;
  geolocated_quantity: string;
  filed_quantity: string;
  uncovered_quantity: string;
}

/** One row of `GET /api/v1/supply-chain/batches/readiness/` (list), and the
 * base shape `GET .../batches/{id}/readiness/` (detail, see
 * `POReadinessDetail` below) extends with a `lots` breakdown.
 *
 * `next_deadline` shipped additively in eudr-app #61/PR#85 — the soonest
 * `expected_clearance_date` across the PO's linked lots, or `null` if none is
 * set yet. Compute eta/days-remaining client-side from this date (see
 * `DeadlineChip`); the backend doesn't pre-compute a days-remaining count. */
export interface BatchReadiness {
  id: string;
  reference_number: string;
  seller_id: string;
  buyer_id: string;
  commodity_id: string;
  transaction_date: string;
  stage: ReadinessStage;
  blocked: boolean;
  blockers: ReadinessBlocker[];
  funnel: CoverageFunnel;
  lot_count: number;
  next_deadline: string | null;
}

/** One entry of `POReadinessDetail.lots` (`LotReadinessSerializer`,
 * eudr-app apps/supply_chain/serializers.py) — the per-lot breakdown behind
 * the PO Detail "Lots fulfilling this order" table (eudr-frontend #29). */
export interface LotReadiness {
  id: string;
  reference_number: string;
  quantity: string;
  unit: BatchUnit;
  harvest_period_start: string | null;
  harvest_period_end: string | null;
  plot_count: number;
  plots_resolved: boolean;
  plots_failed_count: number;
  plots_pending_count: number;
  filed: boolean;
  filing_dds_id: string | null;
  filing_dds_reference: string;
  /** [FOLLOW-UP eudr-app — file a small additive PR] NOT yet on
   * `LotReadinessSerializer` as of eudr-app PR #85 — only `BatchSerializer`/
   * `BatchListSerializer` (the raw Batch endpoints) got `shipment_reference`/
   * `expected_clearance_date`; the readiness detail's per-lot rows didn't.
   * Optional here so PO Detail's "grouped by shipment" table activates
   * automatically the day the backend adds them (same additive-serializer
   * pattern as `next_deadline`) — do not invent client-side values in the
   * meantime; today's live lots table renders as a single ungrouped list. */
  shipment_reference?: string | null;
  expected_clearance_date?: string | null;
}

/** `GET /api/v1/supply-chain/batches/{id}/readiness/` — full readiness
 * detail for one PO batch (`POReadinessDetailSerializer`), adding the
 * per-lot breakdown on top of the list row shape above. */
export interface POReadinessDetail extends BatchReadiness {
  lots: LotReadiness[];
}

// ── Due Diligence ──

export type DDSStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "SUBMITTED" | "REJECTED" | "WITHDRAWN";
export type StatementType = "OPERATOR" | "REFERENCE";
export type RiskConclusion = "NEGLIGIBLE" | "NOT_NEGLIGIBLE";
export type ActivityType = "DOMESTIC" | "IMPORT" | "EXPORT";

export interface DueDiligenceStatement {
  id: string;
  reference_number: string;
  traces_reference: string;
  status: DDSStatus;
  statement_type: StatementType;
  activity_type: ActivityType;
  batch_ids: string[];
  risk_conclusion: RiskConclusion | null;
  conclusion_justification: string;
  operator_id: string;
  created_by_id: string;
  reviewed_by_id: string | null;
  submitted_at: string | null;
  valid_until: string | null;
  archived_until: string | null;
  created_at: string;
  updated_at: string;
  risk_assessments?: RiskAssessment[];
}

export interface RiskAssessment {
  id: string;
  country_risk: string;
  deforestation_risk_score: number;
  legality_risk_score: number;
  traceability_completeness: number;
  mitigation_measures: string;
  overall_conclusion: string;
  notes: string;
  assessed_by_id: string;
  assessed_at: string;
}

// ── TRACES Credentials ──

export type TracesEnvironment = "ACCEPTANCE" | "PRODUCTION";

export interface TracesCredential {
  id: string;
  environment: TracesEnvironment;
  username: string;
  web_service_client_id: string;
  is_active: boolean;
  created_at: string;
  // password is NEVER returned by the API — write-only
}

// ── TRACES Submissions ──

export type TracesSubmissionStatus = "QUEUED" | "PROCESSING" | "SUBMITTED" | "FAILED" | "RETRYING";
export type SubmissionType = "CREATE" | "UPDATE" | "WITHDRAW";
export type TracesStatus = "SUBMITTED" | "AVAILABLE" | "REJECTED" | "WITHDRAWN" | "GROUPED" | "ARCHIVED";

/** One field-level error, e.g. `{ field: "batch[0].harvest_period", message: "..." }`. */
export interface TracesErrorDetail {
  field: string;
  message: string;
}

export interface TracesSubmission {
  id: string;
  dds_id: string;
  submission_type: SubmissionType;
  status: TracesSubmissionStatus;
  traces_status: TracesStatus;
  verification_number: string;
  traces_reference_number: string;
  error_message: string;
  /** Structured per-field errors (#63 / eudr-app PR#67) — populated for
   * deterministic payload-validation failures. Render these, not just the
   * flattened `error_message`. */
  error_detail: TracesErrorDetail[];
  attempt_count: number;
  last_attempted_at: string | null;
  next_retry_at: string | null;
  submitted_at: string | null;
  submitted_by_id: string;
  soap_request_payload: string;
  soap_response_payload: string;
  created_at: string;
}

// ── Documents ──

export type DocumentType =
  | "SUPPLIER_DECLARATION"
  | "LAND_TITLE"
  | "CERTIFICATION"
  | "AUDIT_REPORT"
  | "SATELLITE_IMAGE"
  | "DDS_EXPORT"
  | "KYC_DOCUMENT"
  | "TRANSPORT_DOCUMENT"
  | "OTHER";

export interface Document {
  id: string;
  organization_id: string;
  document_type: DocumentType;
  title: string;
  description: string;
  storage_key: string;
  storage_bucket: string;
  file_size_bytes: number | null;
  mime_type: string;
  checksum_sha256: string;
  uploaded_at: string;
  archival_deadline: string | null;
  is_archived: boolean;
  archived_at: string | null;
  is_confidential: boolean;
  uploaded_by_id: string;
  versions?: DocumentVersion[];
}

export interface DocumentVersion {
  id: string;
  version_number: number;
  storage_key: string;
  file_size_bytes: number | null;
  checksum_sha256: string;
  uploaded_at: string;
  uploaded_by_id: string;
  change_notes: string;
}

// ── Data Integration / Integrations ──

export type SourceType = "SQL_SERVER" | "FARMFORCE" | "AS400" | "CSV_UPLOAD" | "WEBHOOK" | "REST_API" | "SFTP";
export type ConnectionStatus = "UNTESTED" | "CONNECTED" | "FAILED";
export type SchemaObjectType = "TABLE" | "VIEW" | "FILE" | "ENDPOINT";

export type TargetObjectType = "LAND_PLOT" | "BATCH" | "SUPPLIER" | "DDS_HEADER" | "PRODUCT";
export type MappingSourceType = "SOURCE_OBJECT" | "TRANSFORMATION";

export interface DataSource {
  id: string;
  name: string;
  source_type: SourceType;
  connection_config?: Record<string, unknown>;
  connection_status: ConnectionStatus;
  last_connected_at: string | null;
  is_active: boolean;
  schema_count?: number;
  created_at: string;
  updated_at: string;
}

export interface DataSourceSchema {
  id: string;
  object_name: string;
  object_type: SchemaObjectType;
  is_selected: boolean;
  version: number;
  schema: { columns: SchemaColumn[] };
  sample_record: Record<string, unknown>;
  row_count: number | null;
  discovered_at: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  max_length: number | null;
  is_primary_key: boolean;
}

export interface IngestJob {
  id: string;
  source: string;
  source_name: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  records_ingested: number;
  records_failed: number;
  started_at: string;
  completed_at: string | null;
  error_message: string;
}

export interface RawRecord {
  id: string;
  source: string;
  ingest_job: string;
  external_id: string;
  source_object: string;
  raw_data?: Record<string, unknown>;
  processing_status: "PENDING" | "STAGED" | "PROMOTED" | "FAILED" | "SKIPPED";
  received_at: string;
}

// ── Transformation ──

export interface Transformation {
  id: string;
  name: string;
  description: string;
  query_text: string;
  output_columns: { name: string; type: string }[];
  is_validated: boolean;
  created_at: string;
  updated_at: string;
}

// ── Mapping Config ──

export interface MappingConfig {
  id: string;
  name: string;
  source: string | null;
  source_name?: string;
  source_type: MappingSourceType;
  source_object: string | null;
  source_object_name?: string;
  transformation: string | null;
  transformation_name?: string;
  target_object_type: TargetObjectType;
  is_active: boolean;
  version: number;
  field_mappings?: FieldMapping[];
  created_at: string;
  updated_at: string;
}

export interface FieldMapping {
  id: string;
  source_path: string;
  target_field: string;
  transformation_type: string;
  transformation_params: Record<string, unknown>;
  is_required: boolean;
  default_value: string;
  order: number;
}

// ── Sync Config ──

export interface SyncConfig {
  id: string;
  name: string;
  mapping: string;
  mapping_name?: string;
  schedule_cron: string;
  is_enabled: boolean;
  requires_review: boolean;
  created_at: string;
  updated_at: string;
}

// ── Sync Job ──

export type SyncJobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type SyncTriggerType = "MANUAL" | "SCHEDULE";

export interface SyncJob {
  id: string;
  sync_config: string;
  sync_config_name?: string;
  status: SyncJobStatus;
  triggered_by: SyncTriggerType;
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string;
  created_at: string;
}

// ── Sync Record ──

export type SyncRecordStatus = "PENDING_REVIEW" | "SUCCESS" | "FAILED" | "SKIPPED" | "REJECTED";

export interface SyncRecord {
  id: string;
  sync_job: string;
  source_data: Record<string, unknown>;
  transformed_data: Record<string, unknown>;
  status: SyncRecordStatus;
  target_object_type: TargetObjectType;
  target_object_id: string | null;
  error_message: string;
  review_notes: string;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ── Ingestion Schedule ──

export interface IngestionSchedule {
  id: string;
  source_id: string;
  source_name: string;
  schedule_type: "CRON" | "INTERVAL";
  cron_expression: string;
  timezone: string;
  interval_seconds: number | null;
  is_enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── SQL Schema (for editor autocomplete) ──

export interface SQLViewSchema {
  view_name: string;
  object_name: string;
  source_name?: string;
  columns: { name: string; type: string; nullable: boolean }[];
}

// ── Auto-map suggestion ──

export interface AutoMapSuggestion {
  source_path: string;
  target_field: string;
  transformation_type: string;
  confidence: number;
  source_type?: string;
  target_type?: string;
}

// ── Target field info ──

export interface TargetFieldInfo {
  name: string;
  type: string;
  required: boolean;
}

// ── Shared ──

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
