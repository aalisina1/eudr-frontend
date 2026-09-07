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
  /** The operator's usual commercial activity. Copied onto a new DDS as its
   * starting value; the DDS always owns what is actually filed. `""` means no
   * default — the officer chooses per statement. */
  default_activity_type: ActivityType | "";
  traces_actor_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Suppliers ──

export type KYCStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
/** `NOT_ASSESSED` mirrors `KYCStatus.PENDING`: the absence of a conclusion has
 * to be expressible, or the default has to assert one. */
export type RiskRating = "NOT_ASSESSED" | "LOW" | "STANDARD" | "HIGH";

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

/** Mirrors `CertificationExpiringSerializer` — the row shape of
 * `GET /api/v1/suppliers/certifications/?expiring_within=N` (eudr-app#139),
 * which backs the dashboard's Tier-4 "Certifications expiring" metric.
 * Distinct from `SupplierCertification`: rows here can come from any of the
 * org's suppliers, so the supplier is denormalised onto each row rather than
 * being implied by the URL. It carries neither `issuing_body`, `valid_from`,
 * `document_id` nor `is_valid` — this is a summary feed, not the detail
 * nested under one supplier. */
export interface CertificationExpiring {
  id: string;
  supplier_id: string;
  supplier_name: string;
  certification_type: string;
  certificate_number: string;
  valid_until: string;
}

// ── Geolocation ──

export type GeometrySource = "GPS_DEVICE" | "SATELLITE_IMAGERY" | "MANUAL_ENTRY" | "THIRD_PARTY" | "DATA_IMPORT";
export type ValidationStatus = "PENDING" | "PASSED" | "FAILED" | "REQUIRES_REVIEW";
/** ADR-0014 — the human resolution state, orthogonal to `ValidationStatus`.
 * Resolution never rewrites the deforestation provider's verdict; it records
 * that someone acted on it. An EXCLUDED plot is dropped from every filing. */
export type ResolutionStatus = "UNRESOLVED" | "AWAITING_RESURVEY" | "OVERRIDDEN" | "EXCLUDED";

export interface GeoJsonGeometry {
  type: "Point" | "Polygon" | "MultiPolygon";
  coordinates: unknown;
}

export interface LandPlot {
  id: string;
  /** ADR-0026 — immutable, org-scoped display identity, e.g. "PLOT-000412". */
  reference: string;
  supplier_id: string;
  country: string;
  region: string;
  area_hectares: number;
  geometry: GeoJsonGeometry | null;
  geometry_source: GeometrySource;
  accuracy_meters: number | null;
  collection_date: string | null;
  validation_status: ValidationStatus;
  validated_at: string | null;
  /** The source system's own code, when known. Editable; may be blank. */
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

// #33: no `organization_id` here — neither `BatchListSerializer` nor
// `BatchSerializer` (eudr-app `apps/supply_chain/serializers.py`) exposes it;
// the field never existed at runtime. If org scoping is ever needed
// client-side, derive it from the authenticated user, not the batch.
export interface Batch {
  id: string;
  seller_id: string;
  buyer_id: string;
  product_id: string;
  quantity: number;
  unit: BatchUnit;
  transaction_date: string;
  country_of_harvest: string;
  harvest_period_start: string | null;
  harvest_period_end: string | null;
  /** #51 / eudr-app PR #85 (`supply_chain.0004_batch_shipment_reference_and_clearance_date`).
   * Both `BatchListSerializer` and `BatchSerializer` expose these — required
   * (not `?`), since the model fields are `null=True` and DRF's ModelSerializer
   * always renders the key (value `null` when unset), never omits it. NOT on
   * `LotReadinessSerializer` yet — see the optional fields of the same name on
   * `LotReadiness` below. */
  shipment_reference: string | null;
  expected_clearance_date: string | null;
  /** #51 / eudr-app PR #100 (ADR-0019, #90 lot-stream PO join) — drift that
   * post-dates PR #50's baseline sync. Raw commercial reference this LOT
   * claims to fulfil, exactly as the origin/traceability stream supplied it
   * (resolved to a PO number at join time); null on PO batches and
   * manually-composed batches. NEVER the upsert/dedup key — that stays
   * `external_id`. Same required-but-nullable reasoning as the two fields
   * above. */
  fulfils_reference: string | null;
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
 * `next_deadline` (eudr-app #61/BE-B, PR #85 — merged) is the soonest
 * `expected_clearance_date` across the PO's linked lot batches, or `null`
 * if none of them has one yet (in particular, always `null` for stage
 * OPEN — a PO with no lots has nothing to derive a deadline from). The FE
 * computes eta-label/days-remaining client-side from this date (see
 * `formatEtaLabel`/`daysUntil` in `lib/dashboard-worklist.ts`) — the
 * backend deliberately doesn't pre-compute a days-remaining count, since
 * "today" is a presentation concern.
 *
 * [FOLLOW-UP eudr-frontend#29/#44] The Sourcing list's own `DeadlineChip`
 * usage (`app/(dashboard)/sourcing/page.tsx`) still renders the muted
 * placeholder unconditionally — wiring it to this now-shipped field is
 * that page's own follow-up, out of this ticket's (#30, dashboard-only)
 * surface. */
export interface BatchReadiness {
  id: string;
  reference_number: string;
  seller_id: string;
  buyer_id: string;
  product_id: string;
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
  /** eudr-app#225 (frontend #134): the id behind `shipment_reference`, so a
   * lot row can link to the shipment carrying it. Null when unassigned. */
  consignment_id?: string | null;
  shipment_reference?: string | null;
  expected_clearance_date?: string | null;
}

/** `GET /api/v1/supply-chain/batches/{id}/readiness/` — full readiness
 * detail for one PO batch (`POReadinessDetailSerializer`), adding the
 * per-lot breakdown on top of the list row shape above. */
export interface POReadinessDetail extends BatchReadiness {
  lots: LotReadiness[];
}

/** `GET /api/v1/supply-chain/batches/readiness/summary/` (no `group_by`) —
 * one org-wide rollup, built straight from a plain dict (`aggregate_overall`,
 * not a Serializer), but `Decimal`s still render as strings under DRF's
 * default `COERCE_DECIMAL_TO_STRING`, same as everywhere else in this file.
 * Tonnage is always normalised to KG here (POs in non-mass units are
 * excluded from the funnel rollup but still counted in `po_count`/
 * `stage_counts`) — per-PO views show native units instead, see
 * `BatchReadiness`/`CoverageFunnel`. */
export interface ReadinessSummaryFunnel {
  unit: "KG";
  ordered_quantity: string;
  allocated_quantity: string;
  geolocated_quantity: string;
  filed_quantity: string;
  uncovered_quantity: string;
}

export interface ReadinessSummary {
  po_count: number;
  stage_counts: Record<ReadinessStage, number>;
  blocked_count: number;
  funnel: ReadinessSummaryFunnel;
}

/** `POST /api/v1/supply-chain/batches/payload-estimate/` (BE-C, eudr-app #94 /
 * PR #98) — the geolocation payload size estimate feeding the File DDS
 * composition page's "Geolocation payload" meter (eudr-frontend #26). Per the
 * architect ruling on #94: always 200 for a well-formed request (candidate
 * `batch_ids` that can't contribute geometry surface only in `errors`, never
 * in `batches`); `estimated_bytes` is guaranteed to be the exact sum of
 * `batches[*].estimated_bytes` (no plot dedup across batches). 400 only for a
 * malformed request body (missing/empty/non-list/non-UUID/>500 `batch_ids`). */
export interface PayloadEstimateBatchRow {
  batch_id: string;
  shipment_reference: string | null;
  plot_count: number;
  estimated_bytes: number;
}

export interface PayloadEstimateError {
  field: string;
  message: string;
}

export interface PayloadEstimateResponse {
  estimated_bytes: number;
  limit_bytes: number;
  exceeds_limit: boolean;
  batches: PayloadEstimateBatchRow[];
  errors: PayloadEstimateError[];
}

// ── Supply Chain — Consignments (v0.3.0 Shipment Readiness) ──
// Mirrors ConsignmentReadinessRowSerializer / ConsignmentDetail / summary from
// eudr-app apps/supply_chain (spec plan 2026-07-20-shipment-readiness-backend.md
// PR-B Task 8). Do not add fields the contract doesn't emit — optional
// forward-compat fields below follow the LotReadiness.shipment_reference house
// convention and render "—" until the backend serializer adds them.

export type ConsignmentRag = "GREEN" | "AMBER" | "RED" | "GRAY";
export type EtaSource = "FEED" | "MANUAL" | "NONE";

/** Tracking state shown by TrackingBadge. Derived client-side by
 * `deriveTrackingState()` from tracking_number/t49_request_id/latest_eta, OR —
 * once the backend adds it — read verbatim from `ConsignmentRow.tracking_state`
 * (which wins). The current PR-B row has no explicit tracking-state/error
 * field, so "error"/"quota_reached" only surface when the backend supplies
 * `tracking_state`; untracked/subscribing/live are derivable today. */
export type TrackingState = "untracked" | "subscribing" | "live" | "error" | "quota_reached";

/** [additive] Latest resolvable port a tracked consignment reached, derived
 * server-side from ShipmentEvents (ADR-0025). Null when untracked or no port
 * is known yet. */
export interface ConsignmentLocation {
  locode: string;
  name: string;
  latitude: number;
  longitude: number;
  event_type: string;
  occurred_at: string;
}

/** One row of `GET /api/v1/supply-chain/consignments/`. */
export interface ConsignmentRow {
  id: string;
  reference: string;
  expected_clearance_date: string | null;
  /** Customs import-declaration reference / MRN the DDS reference was lodged
   * against. Blank string when not yet recorded (never null). */
  customs_declaration_reference: string;
  tracking_number: string | null;
  t49_request_id: string | null;
  latest_eta: string | null;
  eta_source: EtaSource;
  created_at: string;
  rag: ConsignmentRag;
  covered_count: number;
  /** ALSO the consignment's lot count — the shipped serializer has no separate
   * `lot_count` field (dropped as redundant); the "Lots" column reads this. */
  total_count: number;
  countdown_to: string | null;
  /** [FOLLOW-UP eudr-app] not on the PR-B list serializer — additive. Latest
   * ShipmentEvent for the "Latest milestone" column; renders "—" until added. */
  latest_event_type?: string | null;
  latest_event_at?: string | null;
  /** [FOLLOW-UP eudr-app] not on the PR-B list serializer — additive. Distinct
   * POs the consignment's lots touch ("POs touched" column); "—" until added. */
  po_count?: number | null;
  /** [FOLLOW-UP eudr-app] not on the PR-B contract — additive explicit tracking
   * state; when present it overrides deriveTrackingState(). */
  tracking_state?: TrackingState | null;
  /** [additive, ADR-0025] Latest resolvable port for the shipment-location
   * map/"Held at" column; null for untracked consignments or no port yet. */
  latest_location?: ConsignmentLocation | null;
}

/** One entry of `ConsignmentDetail.lots`. `stage` is the read-model subset
 * ALLOCATED | PLOTS_COMPLETE | FILED (a ReadinessStage value). */
export interface ConsignmentLot {
  id: string;
  reference_number: string;
  quantity: string;
  unit: BatchUnit;
  stage: ReadinessStage;
  covered: boolean;
  covering_dds_id: string | null;
  covering_dds_reference: string;
  /** eudr-app#225 (frontend #134): the order this lot fulfils, resolved
   * server-side from the chain link, and the plots it carries. */
  po_id?: string | null;
  po_reference?: string;
  plot_ids?: string[];
}

/** One entry of `ConsignmentDetail.events` (ShipmentEventSerializer). */
export interface ShipmentEvent {
  id?: string;
  event_type: string;
  occurred_at: string;
  payload?: Record<string, unknown>;
}

/** `GET /api/v1/supply-chain/consignments/{id}/`. */
export interface ConsignmentDetail extends ConsignmentRow {
  lots: ConsignmentLot[];
  events: ShipmentEvent[];
}

/** One covering DDS on the Customs Reference Ledger. TRACES issues these two
 * fields at different lifecycle stages, not together: `traces_reference_number`
 * arrives at SUBMITTED, `verification_number` only once the DDS reaches
 * AVAILABLE. So a legitimate row can carry a reference with no verification
 * number yet — but never the reverse; treat verification-without-reference as
 * not submitted. */
export interface ConsignmentLedgerDdsRow {
  dds_id: string;
  reference_number: string;
  covered_lot_count: number;
  traces_reference_number: string;
  verification_number: string;
  traces_status: string;
  submitted_at: string | null;
}

/** Mirrors ConsignmentLedgerSerializer — the per-consignment audit record
 * (GET /api/v1/supply-chain/consignments/{id}/ledger/). */
export interface ConsignmentLedger {
  id: string;
  reference: string;
  customs_declaration_reference: string;
  expected_clearance_date: string | null;
  created_at: string;
  po_references: string[];
  dds_rows: ConsignmentLedgerDdsRow[];
  uncovered_lot_count: number;
}

/** `GET /api/v1/supply-chain/consignments/summary/`. */
export interface ConsignmentSummary {
  red: number;
  amber: number;
  gray: number;
  green: number;
  landing_within_red_window_uncovered: number;
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
  /** `""` is reachable and the backend produces it deliberately: the field is
   * `blank=True`, `save()` leaves it blank when the operator has no default,
   * and `_validate_activity_type` exists to *reject* blanks at submit time.
   * Two places already handle it — the detail page's `activityLabel` and the
   * TRACES panel's confirm copy — which the narrower type made look like dead
   * code a simplification pass would have been right to delete. */
  activity_type: ActivityType | "";
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
  /** What the statement is about — the goods, the ground they came from, and
   * the orders they fulfil. Detail serializer only; absent on the list. */
  covered_lots?: CoveredLot[];
  /** Why this statement cannot be filed, while it can still be fixed. Empty
   * means the batch data would build a payload. Detail serializer only. */
  filing_blockers?: FilingBlocker[];
}

/** A land plot as it appears beside the statement that declares it. Geometry
 * is deliberately not included — this is a summary; the plot detail screen is
 * where a map belongs. */
export interface CoveredPlot {
  id: string;
  /** Immutable, human-readable identity (ADR-0026), e.g. `PLOT-000412`. */
  reference: string;
  country: string;
  region: string;
  /** Decimal serialised as a string; `null` when the plot has no recorded area. */
  area_hectares: string | null;
  validation_status: ValidationStatus;
  resolution_status: ResolutionStatus;
}

/** A purchase order a covered lot fulfils. */
export interface CoveredPurchaseOrder {
  id: string;
  reference_number: string;
}

export interface CoveredLot {
  id: string;
  /** Blank when `resolved` is false — an id that resolves to nothing, or to
   * another organisation's batch, is listed but never described. */
  reference_number: string;
  /** Decimal serialised as a string; `null` on an unresolved lot. */
  quantity: string | null;
  unit: string;
  country_of_harvest: string;
  harvest_period_start: string | null;
  harvest_period_end: string | null;
  /** Counts the plots the filing actually covers, which for a consolidated lot
   * are its parents' — not the empty list the batch carries itself. */
  plot_count: number;
  plots: CoveredPlot[];
  purchase_orders: CoveredPurchaseOrder[];
  /** True when this covered batch IS a purchase order, so an empty
   * `purchase_orders` is not read as a missing link. */
  is_purchase_order: boolean;
  /** False means the id could not be resolved within this organisation. The
   * lot is still listed: a statement showing fewer lots than it claims would
   * be worse than one admitting it cannot describe them all. */
  resolved: boolean;
}

/** One reason a statement cannot be filed yet — same `{field, message}` shape
 * as `TracesErrorDetail`, produced by the payload builder's own dry-run. */
export interface FilingBlocker {
  field: string;
  message: string;
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

/**
 * `OperatorRoleType` in the vendored TRACES XSD. `""` means "fall back to the
 * deployment-wide `TRACES_OPERATOR_ROLE`" — mirrors
 * `TracesCredential.resolved_operator_role` on the backend.
 */
export type TracesOperatorRole = "" | "OPERATOR" | "REPRESENTATIVE_OPERATOR";

export interface TracesCredential {
  id: string;
  environment: TracesEnvironment;
  username: string;
  web_service_client_id: string;
  /**
   * EUDR role this WS user is registered for in TRACES NT. TRACES rejects
   * `EUDR-WEBSERVICE-USER-ACTIVITY-NOT-ALLOWED` when a submission claims a
   * role the account does not hold.
   */
  operator_role: TracesOperatorRole;
  /**
   * The operator's Web Service Identifier, assigned by TRACES and read from
   * the operator's registration in the TRACES NT UI. Sent as the
   * `BodyIdentity` SOAP header (Information System release 8.2.1) so a WS user
   * registered against several operators says which one it acts as. NOT
   * `web_service_client_id`, which identifies the client application. `""`
   * sends no header at all.
   */
  operator_ws_identifier: string;
  is_active: boolean;
  created_at: string;
  // password is NEVER returned by the API — write-only
}

// ── TRACES submissions ──

export type TracesSubmissionStatus = "QUEUED" | "PROCESSING" | "SUBMITTED" | "FAILED" | "RETRYING";
export type SubmissionType = "CREATE" | "UPDATE" | "WITHDRAW";
/**
 * `EudrStatusType` in the vendored TRACES XSD — every lifecycle status TRACES
 * can report. `""` is reachable: a submission that has not yet been polled (or
 * never reached TRACES) carries no status at all.
 *
 * SUSPENDED and UPDATED are marked "not active in current release" in the
 * schema; they are modelled because the backend enum mirrors the XSD exactly,
 * and a status the UI cannot name renders as nothing.
 */
export type TracesStatus =
  | ""
  | "SUBMITTED"
  | "AVAILABLE"
  | "REJECTED"
  | "WITHDRAWN"
  | "ARCHIVED"
  | "SUSPENDED"
  | "UPDATED"
  | "GROUPED"
  | "OBSOLETE";

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
  /** The identifier TRACES holds this filing under — the only honest answer to
   * "does the regulator still have this?". `DueDiligenceStatement.status` says
   * a statement was submitted, not whether TRACES has a record of it, and
   * `traces_reference_number` appears only once a poll resolves it to
   * AVAILABLE. `""` on a submission that never reached TRACES. */
  traces_uuid: string;
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

/**
 * `MappingConfig.StreamRole` — which side of two-stream ingestion a
 * BATCH-targeted mapping feeds (ADR-0019 D4). `null` on every non-BATCH
 * mapping, and on legacy BATCH mappings authored before the field existed.
 */
export type StreamRole = "PO_STREAM" | "LOT_STREAM";

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
  /** Set iff `target_object_type === "BATCH"`; `null` on legacy BATCH rows. */
  stream_role: StreamRole | null;
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

// ── Ingestion schedule ──

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

// ── Request bodies ──
//
// These mirror the backend's *request* serializers, not its model serializers.
// Typing them is the regression guard for eudr-frontend#88: the Promote button
// silently posted `sync_record_ids` where the backend reads `ids`, and nothing
// caught it — the backend's tests post `ids`, the frontend compiled because the
// body was an untyped object literal, and no test crossed the boundary. With
// these types a divergent key is a BUILD failure, not a runtime one.
//
// Keep in sync with `apps/data_integration/serializers.py` (the `*Request`
// serializers) via the `sync-types` skill.

/** `SyncRecordIdsRequestSerializer` — shared by bulk-action and promote. */
export interface SyncRecordIdsRequest {
  ids: string[];
}

/** `SyncRecordIdsRequestSerializer` + the bulk-action `action` discriminator. */
export interface SyncRecordBulkActionRequest extends SyncRecordIdsRequest {
  action: "approve" | "reject";
}

/** `SelectObjectsRequestSerializer`. */
export interface SelectObjectsRequest {
  schema_ids: string[];
}

/** `TransformationPreviewRequestSerializer` (+ the view's own `query_text`/`limit`). */
export interface TransformationPreviewRequest {
  source_ids: string[];
  query_text: string;
  limit?: number;
}

/**
 * `MappingConfigSerializer` on write (POST /mappings/, PATCH /mappings/{id}/).
 *
 * eudr-frontend#90: both mapping forms posted an untyped `Record<string,
 * unknown>` that never carried `stream_role`, so creating a BATCH mapping
 * always 400'd and nothing caught it at build time.
 *
 * `stream_role` is deliberately **required here but nullable**, which is
 * stricter than the serializer field (`null=True, blank=True`). Making it
 * optional would guard a future key *rename* but not an *omission* — and
 * omission is precisely what #90 was. Required means every call site has to
 * state a value, so the original bug cannot be written again without a build
 * failure. Pass `null` for any non-BATCH target; `MappingConfigSerializer.
 * validate()` short-circuits before reading it (ADR-0019 D4).
 *
 * The BATCH ⇒ non-null invariant is *not* expressed in the type: TypeScript
 * cannot correlate two independently-narrowed fields of one object literal
 * without contortions that would cost more than they buy. That half is
 * enforced at the submit gate and pinned by tests.
 */
export interface MappingConfigWriteRequest {
  name: string;
  target_object_type: TargetObjectType;
  source_type: MappingSourceType;
  stream_role: StreamRole | null;
  /** `SOURCE_OBJECT` only. */
  source?: string | null;
  source_object?: string | null;
  /** `TRANSFORMATION` only. */
  transformation?: string | null;
}

// ── Plot lineage (eudr-app#225, frontend #134) ─────────────────────────────

/** One lot that uses a plot, with the rest of its chain resolved server-side:
 * the order it fulfils (chain-link child, ADR-0013/0019), the shipment
 * carrying it (`Batch.consignment`, ADR-0021) and the filed statement
 * covering it (SUBMITTED only, ADR-0017). Nulls where a hop is absent. */
export interface PlotLineageLot {
  id: string;
  reference_number: string;
  quantity: string;
  unit: BatchUnit;
  po_id: string | null;
  po_reference: string;
  consignment_id: string | null;
  consignment_reference: string;
  covering_dds_id: string | null;
  covering_dds_reference: string;
}

/** `GET /api/v1/geolocation/plots/{id}/lineage/` */
export interface PlotLineage {
  lots: PlotLineageLot[];
}
