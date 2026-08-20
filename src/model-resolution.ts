import { createHash } from "node:crypto";
import {
  MODEL_CANDIDATE_HARD_GATE_KINDS,
  MODEL_CONFIRMATION_VIEW_KINDS,
  MODEL_CONFIRMATION_VIEW_SIZE_PX,
  MODEL_MATCH_ASSURANCE_BANDS,
  MODEL_MATCH_ASSURANCE_THRESHOLDS,
  MODEL_PROVENANCE_KINDS,
  MODEL_RANKER_EVIDENCE_MODES,
  MODEL_RANKER_ASSURANCE_CEILING_REASON_CODE,
  MODEL_REQUEST_MAX_REVISION,
  MODEL_RESOLUTION_CONTRACT_VERSION,
  MODEL_RESOLUTION_STATES,
  MODEL_TEXT_ONLY_ASSURANCE_CEILING_REASON_CODE,
  STATIC_WORLD_V1_MODEL_POLICY,
  assertImmutableAssetVersion,
  classifyModelMatchAssurance,
  createModelAssetRef,
  createModelRequestSpec,
  createModelTechnicalProfile,
  type ModelConfirmationViewKind,
  type ModelMatchAssurance,
  type ModelRankerEvidenceMode,
  type ModelRequestSpec,
  type ModelTechnicalProfile,
} from "@plasius/asset-contracts";

/** Version of the additive canonical model-resolution MCP surface. */
export const MODEL_MCP_CONTRACT_VERSION = "2026-07-13.v1" as const;

/** Parent rollout gate required by every canonical model-resolution tool. */
export const MODEL_MCP_UNIFIED_FEATURE_FLAG_ID =
  "asset.pipeline.unified-ai-assets.enabled" as const;

/** Conditional kill switch for external provider acquisition. */
export const MODEL_MCP_EXTERNAL_HARVEST_FEATURE_FLAG_ID =
  "asset.pipeline.external-model-harvest.enabled" as const;

/** Conditional, fail-closed Phase 1 generator gate. */
export const MODEL_MCP_GENERATION_FEATURE_FLAG_ID =
  "asset.pipeline.ai-model-generation.enabled" as const;

/** Requester capability used by catalog search and owned resolution operations. */
export const MODEL_MCP_CATALOG_REQUEST_CAPABILITY = "asset.catalog.request" as const;

/** Requester capability used only for explicit candidate confirmation. */
export const MODEL_MCP_CATALOG_CONFIRM_CAPABILITY = "asset.catalog.confirm" as const;

/** Operator capability retained for independent rights and catalog review. */
export const MODEL_MCP_CATALOG_REVIEW_CAPABILITY = "asset.catalog.review" as const;

/** Operator capability used by source-provider management surfaces. */
export const MODEL_MCP_SOURCE_MANAGE_CAPABILITY = "asset.source.manage" as const;

/** Operator capability used by index repair and privileged pipeline operations. */
export const MODEL_MCP_PIPELINE_MANAGE_CAPABILITY = "asset.pipeline.mcp.manage" as const;

/** Fixed square preview size returned inline by MCP tool results. */
export const MODEL_MCP_PREVIEW_SIZE_PX = 512 as const;

/** Maximum base64 characters accepted for one bounded inline preview block. */
export const MODEL_MCP_MAX_PREVIEW_BASE64_LENGTH = 4 * 1024 * 1024;

/** Canonical snake_case model-resolution tools, in discovery order. */
export const MODEL_MCP_TOOL_NAMES = Object.freeze([
  "list_model_search_rankers",
  "search_model_catalog",
  "resolve_model_request",
  "get_model_resolution",
  "confirm_model_candidate",
  "retry_model_resolution",
  "cancel_model_resolution",
  "rebuild_model_catalog_index",
] as const);

/** A canonical model-resolution MCP tool name. */
export type ModelMcpToolName = typeof MODEL_MCP_TOOL_NAMES[number];

/** Apply the canonical cross-field request normalizer after MCP schema validation. */
export function normalizeModelMcpRequestSpec(input: unknown): ModelRequestSpec {
  return createModelRequestSpec(input);
}

/** JSON Schema 2020-12 object published at the MCP boundary. */
export type ModelMcpJsonSchema = Readonly<Record<string, unknown>> & {
  readonly $schema: "https://json-schema.org/draft/2020-12/schema";
};

/** Standard MCP behavioral hints for one tool. */
export interface ModelMcpToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

/** OAuth 2.0 security scheme carried by a canonical MCP descriptor. */
export interface ModelMcpOAuthSecurityScheme {
  readonly type: "oauth2";
  readonly scopes: readonly string[];
}

/** Required parent rollout plus conditional fallback kill switches. */
export interface ModelMcpRolloutMetadata {
  readonly requiredFeatureFlag: typeof MODEL_MCP_UNIFIED_FEATURE_FLAG_ID;
  readonly conditionalFeatureFlags: readonly string[];
}

/** Deterministic inline/original review evidence advertised by candidate tools. */
export interface ModelMcpReviewResultMetadata {
  readonly inlineImageCount: 4;
  readonly maximumInlineReviewSubjects: 1;
  readonly viewOrder: typeof MODEL_CONFIRMATION_VIEW_KINDS;
  readonly previewSizePx: typeof MODEL_MCP_PREVIEW_SIZE_PX;
  readonly originalSizePx: typeof MODEL_CONFIRMATION_VIEW_SIZE_PX;
  readonly mimeType: "image/png";
  readonly originalResourceTemplate:
    | "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/views/{viewKind}/original"
    | "mcp://models/catalog/{assetId}/versions/{version}/views/{viewKind}/original";
  readonly originalResourceTemplates: readonly [
    "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/views/{viewKind}/original",
    "mcp://models/catalog/{assetId}/versions/{version}/views/{viewKind}/original",
  ];
}

/** Additive canonical descriptor that a hosted MCP server can register directly. */
export interface ModelMcpToolDefinition {
  readonly name: ModelMcpToolName;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: ModelMcpJsonSchema;
  readonly outputSchema: ModelMcpJsonSchema;
  readonly annotations: ModelMcpToolAnnotations;
  readonly requiredOAuthScopes: readonly string[];
  readonly requiredCapability: string;
  /**
   * First entry is the required parent gate. Remaining entries are conditional
   * kill switches evaluated only when the corresponding fallback is attempted.
   */
  readonly featureFlags: readonly string[];
  readonly rollout: ModelMcpRolloutMetadata;
  readonly reviewResult?: ModelMcpReviewResultMetadata;
  readonly securitySchemes: readonly ModelMcpOAuthSecurityScheme[];
  readonly _meta: {
    readonly securitySchemes: readonly ModelMcpOAuthSecurityScheme[];
    readonly "plasius/requiredCapability": string;
    readonly "plasius/featureFlags": readonly string[];
    readonly "plasius/rollout": ModelMcpRolloutMetadata;
    readonly "plasius/reviewResult"?: ModelMcpReviewResultMetadata;
  };
}

/** Shared public-safe evidence for one allowlisted model-search ranker. */
interface ModelSearchRankerDescriptorBase {
  readonly rankerId: string;
  readonly evidenceMode: ModelRankerEvidenceMode;
  readonly assuranceCeiling: ModelMatchAssurance;
  readonly implementationVersion: string;
  readonly calibrationId: string;
  readonly calibrationVersion: string;
}

/** Ready allowlisted ranker; an unavailability reason is structurally forbidden. */
export interface ReadyModelSearchRankerDescriptor extends ModelSearchRankerDescriptorBase {
  readonly ready: true;
  readonly unavailabilityReasonCode?: never;
}

/** Unavailable allowlisted ranker with one public-safe reason code. */
export interface UnreadyModelSearchRankerDescriptor extends ModelSearchRankerDescriptorBase {
  readonly ready: false;
  readonly unavailabilityReasonCode: string;
}

/** Public-safe readiness record for one allowlisted model-search ranker. */
export type ModelSearchRankerDescriptor =
  | ReadyModelSearchRankerDescriptor
  | UnreadyModelSearchRankerDescriptor;

/** Successful exact/default ranker selection; substitution is structurally impossible. */
export interface SelectedModelSearchRanker
  extends Omit<ReadyModelSearchRankerDescriptor, "unavailabilityReasonCode"> {
  readonly status: "selected";
  /** One ID represents the selected registration; caller-exact is used by the helper. */
  readonly selectionMode: "caller-exact" | "default";
  readonly ready: true;
  readonly substituted: false;
  readonly unavailabilityReasonCode?: never;
}

/** Fail-closed result for an absent or unavailable caller-selected ranker. */
export interface UnavailableModelSearchRanker {
  readonly status: "unavailable";
  readonly requestedRankerId: string;
  readonly reasonCode: string;
  readonly substituted: false;
}

/** Result of resolving an exact caller-selected ranker ID. */
export type ModelSearchRankerSelection =
  | SelectedModelSearchRanker
  | UnavailableModelSearchRanker;

/** Inline preview metadata paired with one MCP image content block. */
export interface ModelMcpPreviewMetadata {
  readonly contentIndex: number;
  readonly width: typeof MODEL_MCP_PREVIEW_SIZE_PX;
  readonly height: typeof MODEL_MCP_PREVIEW_SIZE_PX;
  readonly contentType: "image/png";
  readonly sha256: string;
}

/** Authenticated original evidence referenced by structured tool output. */
export interface ModelMcpOriginalMetadata {
  readonly uri: string;
  readonly width: typeof MODEL_CONFIRMATION_VIEW_SIZE_PX;
  readonly height: typeof MODEL_CONFIRMATION_VIEW_SIZE_PX;
  readonly contentType: "image/png";
  readonly sha256: string;
}

/** Metadata for one ordered review view. */
export interface ModelMcpReviewView {
  readonly kind: ModelConfirmationViewKind;
  readonly preview: ModelMcpPreviewMetadata;
  readonly original: ModelMcpOriginalMetadata;
}

/** Catalog identity used by a read-only cached review. */
export interface ModelMcpCatalogReviewSubject {
  readonly kind: "catalog";
  readonly assetId: string;
  readonly version: string;
  readonly modelIdentifier: string;
}

/** Resolution-scoped identity used by a confirmable staged/existing candidate. */
export interface ModelMcpResolutionReviewSubject {
  readonly kind: "resolution-candidate";
  readonly resolutionId: string;
  readonly candidateId: string;
  readonly modelIdentifier: string;
  readonly confirmationToken: string;
}

/** One review subject; catalog reviews are intentionally non-confirmable. */
export type ModelMcpReviewSubject =
  | ModelMcpCatalogReviewSubject
  | ModelMcpResolutionReviewSubject;

/** Canonical match evidence projected without trusting an asserted assurance. */
export interface ModelMcpMatchAssessmentProjection {
  readonly score: number;
  readonly assurance: ModelMatchAssurance;
  readonly hardConstraintPass: boolean;
  readonly exactMatch: boolean;
  readonly reasonCodes: readonly string[];
  readonly ranker: {
    readonly id: string;
    readonly version: string;
    readonly calibrationId: string;
    readonly calibrationVersion: string;
    readonly evidenceMode: ModelRankerEvidenceMode;
    readonly assuranceCeiling: ModelMatchAssurance;
  };
  readonly fidelityWarnings: readonly string[];
  readonly requestRevision: number;
  readonly candidateContentHash: string;
}

/** Public-safe rights decision summary; signed decision tokens stay server-side. */
export interface ModelMcpRightsSummary {
  readonly decisionId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly sourceId: string;
  readonly sourceAssetId: string;
  readonly sourceContentHash: string;
  readonly status: "allowed" | "attribution-required";
  readonly licenseId: string;
  readonly reviewedAt: string;
  readonly attributionRequired: boolean;
}

/** Public-safe provenance for a catalog or resolution candidate. */
export interface ModelMcpProvenanceSummary {
  readonly kind: typeof MODEL_PROVENANCE_KINDS[number];
  readonly sourceId: string;
  readonly sourceAssetId: string;
  readonly contentHash: string;
  readonly capturedAt: string;
}

/** Passed independent gate evidence without publishing attestation tokens. */
export interface ModelMcpHardGateSummary {
  readonly kind: typeof MODEL_CANDIDATE_HARD_GATE_KINDS[number];
  readonly outcome: "passed";
  readonly validatorId: string;
  readonly validatorVersion: string;
  readonly subjectContentHash: string;
  readonly evaluatedAt: string;
}

/** One stable question-addressed answer accepted by retry_model_resolution. */
export interface ModelMcpRefinementAnswer {
  readonly questionId: string;
  readonly answer: string;
}

/** Exact four-view tuple in front, left, top, isometric order. */
export type ModelMcpReviewViews = readonly [
  ModelMcpReviewView,
  ModelMcpReviewView,
  ModelMcpReviewView,
  ModelMcpReviewView,
];

/** Public-safe structured candidate projection returned with inline previews. */
export interface ModelCandidateReviewStructuredContent {
  readonly contractVersion: typeof MODEL_RESOLUTION_CONTRACT_VERSION;
  readonly subject: ModelMcpReviewSubject;
  readonly assessment: ModelMcpMatchAssessmentProjection;
  readonly provenance: ModelMcpProvenanceSummary;
  readonly rights: ModelMcpRightsSummary;
  readonly technicalProfile: ModelTechnicalProfile;
  /** Hash of the immutable processed parent closure evaluated by post-malware gates. */
  readonly processingClosureHash: string;
  readonly hardGates: readonly ModelMcpHardGateSummary[];
  readonly fidelityGateOutcome: "passed" | "low-only";
  readonly reviewViews: ModelMcpReviewViews;
}

/** Input image before protocol-only dimensions and kind metadata are removed. */
export interface ModelMcpPreviewImageInput {
  readonly kind: ModelConfirmationViewKind;
  readonly data: string;
  readonly mimeType: "image/png";
  readonly width: typeof MODEL_MCP_PREVIEW_SIZE_PX;
  readonly height: typeof MODEL_MCP_PREVIEW_SIZE_PX;
}

/** Standard MCP image content block. */
export interface ModelMcpImageContent {
  readonly type: "image";
  readonly data: string;
  readonly mimeType: "image/png";
}

/** Exact image tuple emitted alongside candidate structuredContent. */
export type ModelMcpImageContentPack = readonly [
  ModelMcpImageContent,
  ModelMcpImageContent,
  ModelMcpImageContent,
  ModelMcpImageContent,
];

/** Pure MCP result envelope for one candidate review pack. */
export type ModelCandidateBearingToolName =
  | "search_model_catalog"
  | "resolve_model_request"
  | "get_model_resolution"
  | "confirm_model_candidate"
  | "retry_model_resolution";

/** Pure MCP result envelope for one candidate-bearing tool response. */
export interface ModelCandidateReviewToolResult<
  TStructuredContent extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> {
  readonly structuredContent: TStructuredContent & {
    readonly review: ModelCandidateReviewStructuredContent;
  };
  readonly content: ModelMcpImageContentPack;
}

/** Authenticated resource-template metadata registered by the hosted server. */
export interface ModelMcpResourceTemplate {
  readonly name:
    | "model_resolution"
    | "model_candidate_manifest"
    | "model_confirmation_original"
    | "model_catalog_confirmation_original"
    | "model_catalog_manifest";
  readonly title: string;
  readonly description: string;
  readonly uriTemplate: string;
  readonly mimeType: "application/json" | "image/png";
  readonly requiredOAuthScopes: readonly string[];
  readonly requiredCapability: string;
  readonly authenticated: true;
  readonly ownership: "requester-owned" | "promoted-catalog";
  readonly width?: typeof MODEL_CONFIRMATION_VIEW_SIZE_PX;
  readonly height?: typeof MODEL_CONFIRMATION_VIEW_SIZE_PX;
}

const JSON_SCHEMA_URI = "https://json-schema.org/draft/2020-12/schema" as const;
const TOKEN_PATTERN = "^[0-9A-Za-z][0-9A-Za-z._:-]{0,127}$";
const MODEL_PATH_SEGMENT_PATTERN = "^(?!\\.{1,2}$)[0-9A-Za-z._~-]{1,128}$";
const ASSET_ID_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";
const VERSION_PATTERN = "^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$";
const OPAQUE_SOURCE_ASSET_ID_PATTERN = "^[0-9A-Za-z][0-9A-Za-z._-]{0,255}$";
const CONFIRMATION_TOKEN_PATTERN = "^[0-9A-Za-z_-]{32,256}$";
const SAFE_LOCALE_PATTERN = "^(?:[A-Za-z]{2,3}(?:-[A-Za-z]{3}){0,3}|[A-Za-z]{5,8})(?:-[A-Za-z]{4})?(?:-(?:[A-Za-z]{2}|[0-9]{3}))?(?:-(?:[A-Za-z0-9]{5,8}|[0-9][A-Za-z0-9]{3}))*(?:-[0-9A-WY-Za-wy-z](?:-[A-Za-z0-9]{2,8})+)*(?:-x(?:-[A-Za-z0-9]{1,8})+)?$";
const SHA256_PATTERN = "^[a-f0-9]{64}$";
const SAFE_MODEL_RESOURCE_ID = "(?!\\.{1,2}(?:/|$))[0-9A-Za-z._~-]{1,128}";
const SAFE_ASSET_RESOURCE_ID = "(?=[a-z0-9-]{1,128}(?:/|$))[a-z0-9]+(?:-[a-z0-9]+)*";
const SAFE_VERSION_RESOURCE_ID = "[0-9A-Za-z][0-9A-Za-z._-]{0,127}";
const MODEL_RESOURCE_PREFIX = "^mcp://models/";
const REASON_CODE_PATTERN = "^[a-z0-9][a-z0-9._:-]{0,127}$";
const NON_BLANK_BOUNDED_TEXT_PATTERN = "^(?=.*\\S)[^\\u0000-\\u001F\\u007F]+$";
const DIRECT_URL_PATTERN = "(?:[Hh][Tt][Tt][Pp][Ss]?://|\\b[Ww][Ww][Ww]\\.)";
const ISO_TIMESTAMP_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$";
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const TOKEN_REGEX = new RegExp(TOKEN_PATTERN, "u");
const MODEL_PATH_SEGMENT_REGEX = new RegExp(MODEL_PATH_SEGMENT_PATTERN, "u");
const ASSET_ID_REGEX = new RegExp(ASSET_ID_PATTERN, "u");
const VERSION_REGEX = new RegExp(VERSION_PATTERN, "u");
const OPAQUE_SOURCE_ASSET_ID_REGEX = new RegExp(OPAQUE_SOURCE_ASSET_ID_PATTERN, "u");
const CONFIRMATION_TOKEN_REGEX = new RegExp(CONFIRMATION_TOKEN_PATTERN, "u");
const REASON_CODE_REGEX = new RegExp(REASON_CODE_PATTERN, "u");
const SHA256_REGEX = new RegExp(SHA256_PATTERN, "u");

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function objectSchema(
  properties: Record<string, unknown>,
  required: readonly string[] = Object.keys(properties),
): Record<string, unknown> {
  return {
    type: "object",
    properties,
    required: [...required],
    additionalProperties: false,
  };
}

function stringSchema(options: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: "string", ...options };
}

function tokenSchema(): Record<string, unknown> {
  return stringSchema({ pattern: TOKEN_PATTERN, minLength: 1, maxLength: 128 });
}

function modelPathSegmentSchema(): Record<string, unknown> {
  return stringSchema({ pattern: MODEL_PATH_SEGMENT_PATTERN, minLength: 1, maxLength: 128 });
}

function assetIdSchema(): Record<string, unknown> {
  return stringSchema({ pattern: ASSET_ID_PATTERN, minLength: 1, maxLength: 128 });
}

function versionSchema(): Record<string, unknown> {
  return stringSchema({ pattern: VERSION_PATTERN, minLength: 1, maxLength: 128 });
}

function confirmationTokenSchema(): Record<string, unknown> {
  return stringSchema({
    pattern: CONFIRMATION_TOKEN_PATTERN,
    minLength: 32,
    maxLength: 256,
  });
}

function reasonCodeSchema(): Record<string, unknown> {
  return stringSchema({ pattern: REASON_CODE_PATTERN, minLength: 1, maxLength: 128 });
}

function boundedTextSchema(maxLength = 512): Record<string, unknown> {
  return stringSchema({
    minLength: 1,
    maxLength,
    pattern: NON_BLANK_BOUNDED_TEXT_PATTERN,
    not: { pattern: DIRECT_URL_PATTERN },
  });
}

function fixedTupleSchema(items: readonly Record<string, unknown>[]): Record<string, unknown> {
  return {
    type: "array",
    prefixItems: items,
    items: false,
    minItems: items.length,
    maxItems: items.length,
  };
}

function stringArraySchema(maxItems: number, maxLength = 128): Record<string, unknown> {
  return {
    type: "array",
    items: boundedTextSchema(maxLength),
    maxItems,
    uniqueItems: true,
  };
}

const finiteNonNegativeNumber = { type: "number", minimum: 0 };
const positiveNumber = { type: "number", minimum: Number.EPSILON };
const positiveInteger = { type: "integer", minimum: 1 };
const vector3Schema = fixedTupleSchema([
  { type: "number" },
  { type: "number" },
  { type: "number" },
]);
const dimensionsSchema = objectSchema({
  width: positiveNumber,
  height: positiveNumber,
  depth: positiveNumber,
});
const boundsSchema = objectSchema({ min: vector3Schema, max: vector3Schema });
const hardConstraintsSchema = objectSchema(
  {
    boundsMetres: boundsSchema,
    dimensionsMetres: dimensionsSchema,
    maxTriangles: { ...positiveInteger, maximum: STATIC_WORLD_V1_MODEL_POLICY.maxTriangles },
    maxBytes: { ...positiveInteger, maximum: STATIC_WORLD_V1_MODEL_POLICY.maxBytes },
    maxTextureBytes: { ...positiveInteger, maximum: STATIC_WORLD_V1_MODEL_POLICY.maxTextureBytes },
    maxTextureDimensionPx: {
      ...positiveInteger,
      maximum: STATIC_WORLD_V1_MODEL_POLICY.maxTextureDimensionPx,
    },
    maxPartitionCellMetres: {
      ...positiveNumber,
      maximum: STATIC_WORLD_V1_MODEL_POLICY.maxPartitionCellMetres,
    },
    lod: { enum: ["required", "optional", "forbidden"] },
    collision: { enum: ["required", "optional", "forbidden"] },
    partition: { enum: ["single", "allowed", "required"] },
  },
  [],
);
const softPreferencesSchema = objectSchema(
  {
    category: boundedTextSchema(80),
    style: boundedTextSchema(80),
    materials: stringArraySchema(32),
    colors: stringArraySchema(32),
    era: boundedTextSchema(80),
    condition: boundedTextSchema(80),
    tags: stringArraySchema(32),
  },
  [],
);
const requestSpecSchema = objectSchema({
  contractVersion: { const: MODEL_RESOLUTION_CONTRACT_VERSION },
  policyProfileId: { const: STATIC_WORLD_V1_MODEL_POLICY.id },
  query: {
    ...boundedTextSchema(512),
    not: { pattern: DIRECT_URL_PATTERN },
  },
  revision: { type: "integer", minimum: 0, maximum: MODEL_REQUEST_MAX_REVISION },
  locale: stringSchema({ pattern: SAFE_LOCALE_PATTERN, minLength: 1, maxLength: 64 }),
  rankerId: tokenSchema(),
  hardConstraints: hardConstraintsSchema,
  softPreferences: softPreferencesSchema,
  exclusions: stringArraySchema(32, 128),
}, [
  "contractVersion",
  "policyProfileId",
  "query",
  "revision",
  "hardConstraints",
  "softPreferences",
  "exclusions",
]);

const rankerDescriptorProperties = {
  rankerId: tokenSchema(),
  evidenceMode: { enum: [...MODEL_RANKER_EVIDENCE_MODES] },
  assuranceCeiling: { enum: [...MODEL_MATCH_ASSURANCE_BANDS] },
  implementationVersion: versionSchema(),
  calibrationId: tokenSchema(),
  calibrationVersion: versionSchema(),
  ready: { type: "boolean" },
  unavailabilityReasonCode: reasonCodeSchema(),
};
const rankerDescriptorRequired = [
  "rankerId",
  "evidenceMode",
  "assuranceCeiling",
  "implementationVersion",
  "calibrationId",
  "calibrationVersion",
  "ready",
];
const rankerDescriptorSchema = {
  ...objectSchema(rankerDescriptorProperties, rankerDescriptorRequired),
  allOf: [
    {
      if: {
        type: "object",
        properties: { evidenceMode: { const: "text-only" } },
        required: ["evidenceMode"],
      },
      then: {
        type: "object",
        properties: { assuranceCeiling: { enum: ["low", "none"] } },
      },
    },
    {
      if: {
        type: "object",
        properties: { ready: { const: true } },
        required: ["ready"],
      },
      then: {
        not: {
          type: "object",
          properties: { unavailabilityReasonCode: {} },
          required: ["unavailabilityReasonCode"],
        },
      },
      else: {
        type: "object",
        properties: { unavailabilityReasonCode: reasonCodeSchema() },
        required: ["unavailabilityReasonCode"],
      },
    },
  ],
};

const selectedRankerSchema = {
  ...rankerDescriptorSchema,
  properties: {
    rankerId: tokenSchema(),
    evidenceMode: { enum: [...MODEL_RANKER_EVIDENCE_MODES] },
    assuranceCeiling: { enum: [...MODEL_MATCH_ASSURANCE_BANDS] },
    implementationVersion: versionSchema(),
    calibrationId: tokenSchema(),
    calibrationVersion: versionSchema(),
    status: { const: "selected" },
    selectionMode: { enum: ["caller-exact", "default"] },
    ready: { const: true },
    substituted: { const: false },
  },
  required: [
    ...rankerDescriptorRequired,
    "status",
    "selectionMode",
    "substituted",
  ],
};
const unavailableRankerSchema = objectSchema({
  status: { const: "unavailable" },
  requestedRankerId: tokenSchema(),
  reasonCode: reasonCodeSchema(),
  substituted: { const: false },
});
const rankerSelectionSchema = {
  oneOf: [selectedRankerSchema, unavailableRankerSchema],
};

function reviewViewSchema(kind: ModelConfirmationViewKind, index: number): Record<string, unknown> {
  return objectSchema({
    kind: { const: kind },
    preview: objectSchema({
      contentIndex: { const: index },
      width: { const: MODEL_MCP_PREVIEW_SIZE_PX },
      height: { const: MODEL_MCP_PREVIEW_SIZE_PX },
      contentType: { const: "image/png" },
      sha256: stringSchema({ pattern: SHA256_PATTERN }),
    }),
    original: objectSchema({
      uri: {
        oneOf: [
          stringSchema({
            pattern:
              `${MODEL_RESOURCE_PREFIX}resolutions/${SAFE_MODEL_RESOURCE_ID}/candidates/`
              + `${SAFE_MODEL_RESOURCE_ID}/views/${kind}/original$`,
            maxLength: 512,
          }),
          stringSchema({
            pattern:
              `${MODEL_RESOURCE_PREFIX}catalog/${SAFE_ASSET_RESOURCE_ID}/versions/`
              + `${SAFE_VERSION_RESOURCE_ID}/views/${kind}/original$`,
            maxLength: 512,
          }),
        ],
      },
      width: { const: MODEL_CONFIRMATION_VIEW_SIZE_PX },
      height: { const: MODEL_CONFIRMATION_VIEW_SIZE_PX },
      contentType: { const: "image/png" },
      sha256: stringSchema({ pattern: SHA256_PATTERN }),
    }),
  });
}

const reviewViewsSchema = fixedTupleSchema(
  MODEL_CONFIRMATION_VIEW_KINDS.map((kind, index) => reviewViewSchema(kind, index)),
);

const timestampSchema = stringSchema({ pattern: ISO_TIMESTAMP_PATTERN, maxLength: 32 });
const rankerEvidenceSchema = {
  ...objectSchema({
    id: tokenSchema(),
    version: versionSchema(),
    calibrationId: tokenSchema(),
    calibrationVersion: versionSchema(),
    evidenceMode: { enum: [...MODEL_RANKER_EVIDENCE_MODES] },
    assuranceCeiling: { enum: [...MODEL_MATCH_ASSURANCE_BANDS] },
  }),
  allOf: [
    {
      if: {
        type: "object",
        properties: { evidenceMode: { const: "text-only" } },
        required: ["evidenceMode"],
      },
      then: {
        type: "object",
        properties: { assuranceCeiling: { enum: ["low", "none"] } },
      },
    },
  ],
};
const reasonCodesSchema = {
  type: "array",
  items: reasonCodeSchema(),
  maxItems: 32,
  uniqueItems: true,
};
const rawHighSchema = {
  anyOf: [
    { type: "object", properties: { exactMatch: { const: true } }, required: ["exactMatch"] },
    {
      type: "object",
      properties: { score: { type: "number", minimum: MODEL_MATCH_ASSURANCE_THRESHOLDS.high } },
      required: ["score"],
    },
  ],
};
const rawAtLeastLowSchema = {
  anyOf: [
    rawHighSchema,
    {
      type: "object",
      properties: { score: { type: "number", minimum: MODEL_MATCH_ASSURANCE_THRESHOLDS.low } },
      required: ["score"],
    },
  ],
};
const matchAssessmentSchema = {
  ...objectSchema({
    score: { ...finiteNonNegativeNumber, maximum: 1 },
    assurance: { enum: [...MODEL_MATCH_ASSURANCE_BANDS] },
    hardConstraintPass: { type: "boolean" },
    exactMatch: { type: "boolean" },
    reasonCodes: reasonCodesSchema,
    ranker: rankerEvidenceSchema,
    fidelityWarnings: stringArraySchema(32, 128),
    requestRevision: { type: "integer", minimum: 0, maximum: MODEL_REQUEST_MAX_REVISION },
    candidateContentHash: stringSchema({ pattern: SHA256_PATTERN }),
  }),
  allOf: [
    {
      oneOf: [
        {
          type: "object",
          properties: {
            exactMatch: { const: true },
            ranker: {
              type: "object",
              properties: { evidenceMode: { const: "exact-identifier" } },
              required: ["evidenceMode"],
            },
          },
          required: ["exactMatch", "ranker"],
        },
        {
          type: "object",
          properties: {
            exactMatch: { const: false },
            ranker: {
              type: "object",
              properties: { evidenceMode: { enum: ["text-only", "vision", "multimodal"] } },
              required: ["evidenceMode"],
            },
          },
          required: ["exactMatch", "ranker"],
        },
      ],
    },
    {
      if: {
        type: "object",
        properties: { hardConstraintPass: { const: false } },
        required: ["hardConstraintPass"],
      },
      then: {
        type: "object",
        properties: { reasonCodes: { type: "array", minItems: 1 } },
      },
    },
    {
      if: {
        allOf: [
          rawHighSchema,
          {
            type: "object",
            properties: {
              assurance: { const: "low" },
              ranker: {
                type: "object",
                properties: { evidenceMode: { const: "text-only" } },
                required: ["evidenceMode"],
              },
            },
            required: ["assurance", "ranker"],
          },
        ],
      },
      then: {
        type: "object",
        properties: {
          reasonCodes: {
            type: "array",
            contains: { const: MODEL_TEXT_ONLY_ASSURANCE_CEILING_REASON_CODE },
          },
        },
        required: ["reasonCodes"],
      },
    },
    {
      if: {
        allOf: [
          rawHighSchema,
          {
            type: "object",
            properties: {
              assurance: { const: "low" },
              ranker: {
                type: "object",
                properties: {
                  evidenceMode: { enum: ["vision", "multimodal", "exact-identifier"] },
                },
                required: ["evidenceMode"],
              },
            },
            required: ["assurance", "ranker"],
          },
        ],
      },
      then: {
        type: "object",
        properties: {
          reasonCodes: {
            type: "array",
            contains: { const: MODEL_RANKER_ASSURANCE_CEILING_REASON_CODE },
          },
        },
        required: ["reasonCodes"],
      },
    },
  ],
  oneOf: [
    {
      type: "object",
      properties: {
        assurance: { const: "high" },
        hardConstraintPass: { const: true },
        ranker: {
          type: "object",
          properties: { assuranceCeiling: { const: "high" } },
          required: ["assuranceCeiling"],
        },
      },
      required: ["assurance", "hardConstraintPass", "ranker"],
      ...rawHighSchema,
    },
    {
      type: "object",
      properties: {
        assurance: { const: "low" },
        hardConstraintPass: { const: true },
      },
      required: ["assurance", "hardConstraintPass"],
      anyOf: [
        {
          type: "object",
          properties: {
            ranker: {
              type: "object",
              properties: { assuranceCeiling: { const: "low" } },
              required: ["assuranceCeiling"],
            },
          },
          required: ["ranker"],
          ...rawAtLeastLowSchema,
        },
        {
          type: "object",
          properties: {
            exactMatch: { const: false },
            score: {
              type: "number",
              minimum: MODEL_MATCH_ASSURANCE_THRESHOLDS.low,
              exclusiveMaximum: MODEL_MATCH_ASSURANCE_THRESHOLDS.high,
            },
            ranker: {
              type: "object",
              properties: { assuranceCeiling: { const: "high" } },
              required: ["assuranceCeiling"],
            },
          },
          required: ["exactMatch", "score", "ranker"],
        },
      ],
    },
    {
      type: "object",
      properties: { assurance: { const: "none" } },
      required: ["assurance"],
      anyOf: [
        {
          type: "object",
          properties: { hardConstraintPass: { const: false } },
          required: ["hardConstraintPass"],
        },
        {
          type: "object",
          properties: {
            hardConstraintPass: { const: true },
            ranker: {
              type: "object",
              properties: { assuranceCeiling: { const: "none" } },
              required: ["assuranceCeiling"],
            },
          },
          required: ["hardConstraintPass", "ranker"],
        },
        {
          type: "object",
          properties: {
            hardConstraintPass: { const: true },
            exactMatch: { const: false },
            score: { type: "number", exclusiveMaximum: MODEL_MATCH_ASSURANCE_THRESHOLDS.low },
          },
          required: ["hardConstraintPass", "exactMatch", "score"],
        },
      ],
    },
  ],
};
const selectableAssessmentSchema = {
  allOf: [
    matchAssessmentSchema,
    {
      type: "object",
      properties: {
        assurance: { enum: ["high", "low"] },
        hardConstraintPass: { const: true },
      },
      required: ["assurance", "hardConstraintPass"],
    },
  ],
};
const provenanceSummarySchema = objectSchema({
  kind: { enum: [...MODEL_PROVENANCE_KINDS] },
  sourceId: tokenSchema(),
  sourceAssetId: stringSchema({ pattern: OPAQUE_SOURCE_ASSET_ID_PATTERN, minLength: 1, maxLength: 256 }),
  contentHash: stringSchema({ pattern: SHA256_PATTERN }),
  capturedAt: timestampSchema,
});
const rightsSummarySchema = {
  oneOf: [
    objectSchema({
      decisionId: tokenSchema(),
      policyId: tokenSchema(),
      policyVersion: versionSchema(),
      sourceId: tokenSchema(),
      sourceAssetId: stringSchema({ pattern: OPAQUE_SOURCE_ASSET_ID_PATTERN, minLength: 1, maxLength: 256 }),
      sourceContentHash: stringSchema({ pattern: SHA256_PATTERN }),
      status: { const: "allowed" },
      licenseId: tokenSchema(),
      reviewedAt: timestampSchema,
      attributionRequired: { const: false },
    }),
    objectSchema({
      decisionId: tokenSchema(),
      policyId: tokenSchema(),
      policyVersion: versionSchema(),
      sourceId: tokenSchema(),
      sourceAssetId: stringSchema({ pattern: OPAQUE_SOURCE_ASSET_ID_PATTERN, minLength: 1, maxLength: 256 }),
      sourceContentHash: stringSchema({ pattern: SHA256_PATTERN }),
      status: { const: "attribution-required" },
      licenseId: tokenSchema(),
      reviewedAt: timestampSchema,
      attributionRequired: { const: true },
    }),
  ],
};
const technicalProfileSchema = objectSchema({
  boundsMetres: boundsSchema,
  dimensionsMetres: dimensionsSchema,
  triangleCount: { type: "integer", minimum: 1, maximum: 1_000_000_000 },
  byteLength: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
  textureByteLength: { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  maxTextureDimensionPx: { type: "integer", minimum: 0, maximum: 32_768 },
  lodCount: { type: "integer", minimum: 1, maximum: 4 },
  hasCollision: { type: "boolean" },
  partitionCount: { type: "integer", minimum: 1, maximum: 10_000 },
  partitionCellMetres: { type: "number", minimum: Number.EPSILON, maximum: 1_000_000 },
});
const hardGateSummariesSchema = fixedTupleSchema(
  MODEL_CANDIDATE_HARD_GATE_KINDS.map((kind) => objectSchema({
    kind: { const: kind },
    outcome: { const: "passed" },
    validatorId: tokenSchema(),
    validatorVersion: versionSchema(),
    subjectContentHash: stringSchema({ pattern: SHA256_PATTERN }),
    evaluatedAt: timestampSchema,
  })),
);
const modelAssetRefSchema = objectSchema({
  contractVersion: { const: MODEL_RESOLUTION_CONTRACT_VERSION },
  assetId: assetIdSchema(),
  version: versionSchema(),
  kind: { enum: ["leaf", "assembly"] },
  contentHash: stringSchema({ pattern: SHA256_PATTERN }),
  runtimeManifestUri: stringSchema({
    pattern:
      `${MODEL_RESOURCE_PREFIX}catalog/${SAFE_ASSET_RESOURCE_ID}/versions/`
      + `${SAFE_VERSION_RESOURCE_ID}/manifest$`,
    maxLength: 512,
  }),
});
const evidenceProperties = {
  assessment: selectableAssessmentSchema,
  provenance: provenanceSummarySchema,
  rights: rightsSummarySchema,
  technicalProfile: technicalProfileSchema,
  processingClosureHash: stringSchema({ pattern: SHA256_PATTERN }),
  hardGates: hardGateSummariesSchema,
  fidelityGateOutcome: { enum: ["passed", "low-only"] },
};
const fidelityGateConsistencySchema = {
  if: {
    type: "object",
    properties: { fidelityGateOutcome: { const: "low-only" } },
    required: ["fidelityGateOutcome"],
  },
  then: {
    type: "object",
    properties: {
      assessment: {
        type: "object",
        properties: {
          assurance: { const: "low" },
          reasonCodes: {
            type: "array",
            contains: { const: "fidelity-low-only" },
          },
          fidelityWarnings: { type: "array", minItems: 1 },
        },
        required: ["assurance", "reasonCodes", "fidelityWarnings"],
      },
    },
  },
};
const catalogSearchMatchSchema = {
  ...objectSchema({
    modelIdentifier: tokenSchema(),
    asset: modelAssetRefSchema,
    ...evidenceProperties,
    reviewAvailable: { type: "boolean" },
  }),
  allOf: [fidelityGateConsistencySchema],
};
const candidateAssetRefSchema = {
  oneOf: [
    objectSchema({ disposition: { const: "existing" }, asset: modelAssetRefSchema }),
    objectSchema({
      disposition: { const: "proposed" },
      proposalId: tokenSchema(),
      kind: { enum: ["leaf", "assembly"] },
      contentHash: stringSchema({ pattern: SHA256_PATTERN }),
    }),
  ],
};
const resolutionCandidateSummarySchema = {
  ...objectSchema({
    resolutionId: modelPathSegmentSchema(),
    candidateId: modelPathSegmentSchema(),
    modelIdentifier: tokenSchema(),
    assetRef: candidateAssetRefSchema,
    ...evidenceProperties,
    confirmationToken: confirmationTokenSchema(),
  }),
  allOf: [fidelityGateConsistencySchema],
};
const catalogReviewSubjectSchema = objectSchema({
  kind: { const: "catalog" },
  assetId: assetIdSchema(),
  version: versionSchema(),
  modelIdentifier: tokenSchema(),
});
const resolutionReviewSubjectSchema = objectSchema({
  kind: { const: "resolution-candidate" },
  resolutionId: modelPathSegmentSchema(),
  candidateId: modelPathSegmentSchema(),
  modelIdentifier: tokenSchema(),
  confirmationToken: confirmationTokenSchema(),
});
const candidateReviewProperties = {
  contractVersion: { const: MODEL_RESOLUTION_CONTRACT_VERSION },
  ...evidenceProperties,
  reviewViews: reviewViewsSchema,
};
const catalogReviewSchema = {
  ...objectSchema({
    ...candidateReviewProperties,
    subject: catalogReviewSubjectSchema,
  }),
  allOf: [fidelityGateConsistencySchema],
};
const resolutionReviewSchema = {
  ...objectSchema({
    ...candidateReviewProperties,
    subject: resolutionReviewSubjectSchema,
  }),
  allOf: [fidelityGateConsistencySchema],
};
const refinementQuestionSchema = objectSchema({
  questionId: tokenSchema(),
  prompt: boundedTextSchema(500),
});
const resolutionSummarySchema = {
  ...objectSchema({
    contractVersion: { const: MODEL_RESOLUTION_CONTRACT_VERSION },
    resolutionId: modelPathSegmentSchema(),
    requestRevision: { type: "integer", minimum: 0, maximum: MODEL_REQUEST_MAX_REVISION },
    state: { enum: [...MODEL_RESOLUTION_STATES] },
    attempts: { type: "integer", minimum: 1, maximum: 100 },
    bestCandidate: resolutionCandidateSummarySchema,
    refinementQuestions: {
      type: "array",
      items: refinementQuestionSchema,
      maxItems: 3,
      uniqueItems: true,
    },
    finalAssetRef: modelAssetRefSchema,
    stateReasonCode: reasonCodeSchema(),
  }, [
    "contractVersion",
    "resolutionId",
    "requestRevision",
    "state",
    "attempts",
    "refinementQuestions",
  ]),
  allOf: [
    {
      if: {
        type: "object",
        properties: { state: { enum: ["awaiting-confirmation", "promoting", "completed"] } },
        required: ["state"],
      },
      then: {
        type: "object",
        properties: { bestCandidate: resolutionCandidateSummarySchema },
        required: ["bestCandidate"],
      },
    },
    {
      if: {
        type: "object",
        properties: { state: { enum: ["failed", "cancelled", "unresolved"] } },
        required: ["state"],
      },
      then: {
        type: "object",
        properties: { stateReasonCode: reasonCodeSchema() },
        required: ["stateReasonCode"],
      },
    },
    {
      if: {
        type: "object",
        properties: {
          state: { const: "awaiting-confirmation" },
          bestCandidate: {
            type: "object",
            properties: {
              assessment: {
                type: "object",
                properties: { assurance: { const: "low" } },
                required: ["assurance"],
              },
            },
            required: ["assessment"],
          },
        },
        required: ["state", "bestCandidate"],
      },
      then: {
        type: "object",
        properties: {
          refinementQuestions: {
            type: "array",
            items: refinementQuestionSchema,
            minItems: 1,
            maxItems: 3,
            uniqueItems: true,
          },
        },
        required: ["refinementQuestions"],
      },
    },
    {
      if: {
        type: "object",
        properties: { state: { const: "completed" } },
        required: ["state"],
      },
      then: {
        type: "object",
        properties: { finalAssetRef: modelAssetRefSchema },
        required: ["finalAssetRef"],
      },
      else: {
        not: {
          type: "object",
          properties: { finalAssetRef: modelAssetRefSchema },
          required: ["finalAssetRef"],
        },
      },
    },
  ],
};

function topLevelSchema(title: string, body: Record<string, unknown>): ModelMcpJsonSchema {
  return deepFreeze({
    $schema: JSON_SCHEMA_URI,
    title,
    ...body,
  }) as ModelMcpJsonSchema;
}

const inputSchemas: Record<ModelMcpToolName, ModelMcpJsonSchema> = {
  list_model_search_rankers: topLevelSchema(
    "List model search rankers input",
    objectSchema({}, []),
  ),
  search_model_catalog: topLevelSchema(
    "Search model catalog input",
    objectSchema({
      request: requestSpecSchema,
      limit: { type: "integer", minimum: 1, maximum: 20 },
    }, ["request"]),
  ),
  resolve_model_request: topLevelSchema(
    "Resolve model request input",
    objectSchema({
      request: requestSpecSchema,
      idempotencyKey: tokenSchema(),
    }),
  ),
  get_model_resolution: topLevelSchema(
    "Get model resolution input",
    objectSchema({ resolutionId: modelPathSegmentSchema() }),
  ),
  confirm_model_candidate: topLevelSchema(
    "Confirm model candidate input",
    objectSchema({
      resolutionId: modelPathSegmentSchema(),
      candidateId: modelPathSegmentSchema(),
      confirmationToken: confirmationTokenSchema(),
      viewSha256s: fixedTupleSchema([
        stringSchema({ pattern: SHA256_PATTERN }),
        stringSchema({ pattern: SHA256_PATTERN }),
        stringSchema({ pattern: SHA256_PATTERN }),
        stringSchema({ pattern: SHA256_PATTERN }),
      ]),
      semanticRiskAccepted: { type: "boolean" },
      idempotencyKey: tokenSchema(),
    }),
  ),
  retry_model_resolution: topLevelSchema(
    "Retry model resolution input",
    objectSchema({
      resolutionId: modelPathSegmentSchema(),
      refinementAnswers: {
        type: "array",
        items: objectSchema({
          questionId: tokenSchema(),
          answer: boundedTextSchema(500),
        }),
        minItems: 1,
        maxItems: 3,
        uniqueItems: true,
      },
      excludedCandidateIds: {
        type: "array",
        items: modelPathSegmentSchema(),
        maxItems: 20,
        uniqueItems: true,
      },
      idempotencyKey: tokenSchema(),
    }, ["resolutionId", "refinementAnswers", "idempotencyKey"]),
  ),
  cancel_model_resolution: topLevelSchema(
    "Cancel model resolution input",
    objectSchema({
      resolutionId: modelPathSegmentSchema(),
      reasonCode: reasonCodeSchema(),
      idempotencyKey: tokenSchema(),
    }, ["resolutionId", "idempotencyKey"]),
  ),
  rebuild_model_catalog_index: topLevelSchema(
    "Rebuild model catalog index input",
    objectSchema({
      mode: { enum: ["full", "backfill", "repair"] },
      idempotencyKey: tokenSchema(),
    }),
  ),
};

const resolutionOutputSchema = topLevelSchema(
  "Model resolution output",
  objectSchema({ resolution: resolutionSummarySchema }),
);
const resolutionReviewOutputSchema = topLevelSchema(
  "Model resolution review output",
  {
    ...objectSchema(
      { resolution: resolutionSummarySchema, review: resolutionReviewSchema },
      ["resolution"],
    ),
    allOf: [{
      if: {
        type: "object",
        properties: {
          resolution: {
            type: "object",
            properties: { state: { const: "awaiting-confirmation" } },
            required: ["state"],
          },
        },
        required: ["resolution"],
      },
      then: {
        type: "object",
        properties: { review: resolutionReviewSchema },
        required: ["review"],
      },
    }],
  },
);
const outputSchemas: Record<ModelMcpToolName, ModelMcpJsonSchema> = {
  list_model_search_rankers: topLevelSchema(
    "List model search rankers output",
    objectSchema({
      rankers: {
        type: "array",
        items: rankerDescriptorSchema,
        maxItems: 64,
      },
      selectionPolicy: objectSchema({
        exactCallerSelection: { const: true },
        substitutionAllowed: { const: false },
      }),
    }),
  ),
  search_model_catalog: topLevelSchema(
    "Search model catalog output",
    {
      ...objectSchema(
        {
          contractVersion: { const: MODEL_RESOLUTION_CONTRACT_VERSION },
          requestRevision: { type: "integer", minimum: 0, maximum: MODEL_REQUEST_MAX_REVISION },
          rankerSelection: rankerSelectionSchema,
          matches: {
            type: "array",
            items: catalogSearchMatchSchema,
            maxItems: 5,
          },
          review: catalogReviewSchema,
        },
        ["contractVersion", "requestRevision", "rankerSelection", "matches"],
      ),
      allOf: [{
        if: {
          type: "object",
          properties: {
            rankerSelection: {
              type: "object",
              properties: { status: { const: "unavailable" } },
              required: ["status"],
            },
          },
          required: ["rankerSelection"],
        },
        then: {
          type: "object",
          properties: { matches: { type: "array", maxItems: 0 } },
          not: { type: "object", properties: { review: {} }, required: ["review"] },
        },
      }],
      dependentSchemas: {
        review: {
          type: "object",
          properties: { matches: { type: "array", minItems: 1 } },
          required: ["matches"],
        },
      },
    },
  ),
  resolve_model_request: resolutionReviewOutputSchema,
  get_model_resolution: resolutionReviewOutputSchema,
  confirm_model_candidate: resolutionReviewOutputSchema,
  retry_model_resolution: resolutionReviewOutputSchema,
  cancel_model_resolution: resolutionOutputSchema,
  rebuild_model_catalog_index: topLevelSchema(
    "Rebuild model catalog index output",
    objectSchema({
      operationId: tokenSchema(),
      mode: { enum: ["full", "backfill", "repair"] },
      state: { enum: ["accepted", "running", "completed", "failed"] },
      idempotentReplay: { type: "boolean" },
    }),
  ),
};

/** Input schemas keyed by the exact canonical tool name. */
export const MODEL_MCP_INPUT_SCHEMAS = deepFreeze(inputSchemas);

/** Structured-output schemas keyed by the exact canonical tool name. */
export const MODEL_MCP_OUTPUT_SCHEMAS = deepFreeze(outputSchemas);

function securitySchemes(scopes: readonly string[]): readonly ModelMcpOAuthSecurityScheme[] {
  return deepFreeze([{ type: "oauth2", scopes: [...scopes] }]);
}

function defineTool(input: {
  name: ModelMcpToolName;
  title: string;
  description: string;
  requiredCapability: string;
  featureFlags?: readonly string[];
  candidateReviewResult?: boolean;
  annotations: ModelMcpToolAnnotations;
}): ModelMcpToolDefinition {
  const requiredOAuthScopes = deepFreeze(["mcp:access", input.requiredCapability]);
  const featureFlags = deepFreeze([
    MODEL_MCP_UNIFIED_FEATURE_FLAG_ID,
    ...(input.featureFlags ?? []),
  ]);
  const schemes = securitySchemes(requiredOAuthScopes);
  const rollout = deepFreeze({
    requiredFeatureFlag: MODEL_MCP_UNIFIED_FEATURE_FLAG_ID,
    conditionalFeatureFlags: [...(input.featureFlags ?? [])],
  });
  const reviewResult = input.candidateReviewResult
      ? deepFreeze({
        inlineImageCount: 4 as const,
        maximumInlineReviewSubjects: 1 as const,
        viewOrder: MODEL_CONFIRMATION_VIEW_KINDS,
        previewSizePx: MODEL_MCP_PREVIEW_SIZE_PX,
        originalSizePx: MODEL_CONFIRMATION_VIEW_SIZE_PX,
        mimeType: "image/png" as const,
        originalResourceTemplate: input.name === "search_model_catalog"
          ? "mcp://models/catalog/{assetId}/versions/{version}/views/{viewKind}/original" as const
          : "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/views/{viewKind}/original" as const,
        originalResourceTemplates: [
          "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/views/{viewKind}/original",
          "mcp://models/catalog/{assetId}/versions/{version}/views/{viewKind}/original",
        ] as const,
      })
    : undefined;
  return deepFreeze({
    name: input.name,
    title: input.title,
    description: input.description,
    inputSchema: MODEL_MCP_INPUT_SCHEMAS[input.name],
    outputSchema: MODEL_MCP_OUTPUT_SCHEMAS[input.name],
    annotations: { ...input.annotations },
    requiredOAuthScopes,
    requiredCapability: input.requiredCapability,
    featureFlags,
    rollout,
    ...(reviewResult === undefined ? {} : { reviewResult }),
    securitySchemes: schemes,
    _meta: {
      securitySchemes: schemes,
      "plasius/requiredCapability": input.requiredCapability,
      "plasius/featureFlags": featureFlags,
      "plasius/rollout": rollout,
      ...(reviewResult === undefined ? {} : { "plasius/reviewResult": reviewResult }),
    },
  });
}

const READ_ONLY_ANNOTATIONS: ModelMcpToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const MUTATION_ANNOTATIONS: ModelMcpToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const OPEN_WORLD_MUTATION_ANNOTATIONS: ModelMcpToolAnnotations = {
  ...MUTATION_ANNOTATIONS,
  openWorldHint: true,
};

/** Canonical frozen descriptors, directly consumable by MCP tools/list. */
export const MODEL_MCP_TOOL_DEFINITIONS = deepFreeze([
  defineTool({
    name: "list_model_search_rankers",
    title: "List model search rankers",
    description: "List allowlisted, calibrated model-search rankers and their current readiness without selecting a substitute.",
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    annotations: READ_ONLY_ANNOTATIONS,
  }),
  defineTool({
    name: "search_model_catalog",
    title: "Search model catalog",
    description: "Search promoted model catalog versions using hard constraints and one exact calibrated ranker selection.",
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    candidateReviewResult: true,
    annotations: READ_ONLY_ANNOTATIONS,
  }),
  defineTool({
    name: "resolve_model_request",
    title: "Resolve model request",
    description: "Search the catalog and idempotently create asynchronous provider or generator fallback work when needed.",
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    featureFlags: [
      MODEL_MCP_EXTERNAL_HARVEST_FEATURE_FLAG_ID,
      MODEL_MCP_GENERATION_FEATURE_FLAG_ID,
    ],
    candidateReviewResult: true,
    annotations: OPEN_WORLD_MUTATION_ANNOTATIONS,
  }),
  defineTool({
    name: "get_model_resolution",
    title: "Get model resolution",
    description: "Read an owned immutable model-resolution revision, progress, questions, and review evidence.",
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    candidateReviewResult: true,
    annotations: READ_ONLY_ANNOTATIONS,
  }),
  defineTool({
    name: "confirm_model_candidate",
    title: "Confirm model candidate",
    description: "Confirm one exact four-view candidate; low assurance additionally requires explicit semantic-risk acceptance.",
    requiredCapability: MODEL_MCP_CATALOG_CONFIRM_CAPABILITY,
    candidateReviewResult: true,
    annotations: MUTATION_ANNOTATIONS,
  }),
  defineTool({
    name: "retry_model_resolution",
    title: "Retry model resolution",
    description: "Create the next immutable request revision from bounded refinement answers and candidate exclusions.",
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    featureFlags: [
      MODEL_MCP_EXTERNAL_HARVEST_FEATURE_FLAG_ID,
      MODEL_MCP_GENERATION_FEATURE_FLAG_ID,
    ],
    candidateReviewResult: true,
    annotations: OPEN_WORLD_MUTATION_ANNOTATIONS,
  }),
  defineTool({
    name: "cancel_model_resolution",
    title: "Cancel model resolution",
    description: "Idempotently cancel unfinished work owned by the requester.",
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    annotations: {
      ...MUTATION_ANNOTATIONS,
      destructiveHint: true,
    },
  }),
  defineTool({
    name: "rebuild_model_catalog_index",
    title: "Rebuild model catalog index",
    description: "Run an operator-only idempotent full, backfill, or repair rebuild of the promoted model catalog index.",
    requiredCapability: MODEL_MCP_PIPELINE_MANAGE_CAPABILITY,
    annotations: MUTATION_ANNOTATIONS,
  }),
] as const);

/** Return the immutable canonical tool registry. */
export function listModelMcpToolDefinitions(): readonly ModelMcpToolDefinition[] {
  return MODEL_MCP_TOOL_DEFINITIONS;
}

/** Resolve one exact canonical descriptor without accepting legacy aliases. */
export function getModelMcpToolDefinition(name: unknown): ModelMcpToolDefinition | undefined {
  return typeof name === "string"
    ? MODEL_MCP_TOOL_DEFINITIONS.find((definition) => definition.name === name)
    : undefined;
}

function isToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_REGEX.test(value);
}

function isModelPathSegment(value: unknown): value is string {
  return typeof value === "string" && MODEL_PATH_SEGMENT_REGEX.test(value);
}

function isAssetId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 128 && ASSET_ID_REGEX.test(value);
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_REGEX.test(value);
}

function isConfirmationToken(value: unknown): value is string {
  return typeof value === "string" && CONFIRMATION_TOKEN_REGEX.test(value);
}

function isReasonCode(value: unknown): value is string {
  return typeof value === "string" && REASON_CODE_REGEX.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !new RegExp(ISO_TIMESTAMP_PATTERN, "u").test(value)) {
    return false;
  }
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) && timestamp.toISOString() === value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => descriptor.get === undefined && descriptor.set === undefined,
  );
}

function assertAllowedKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void {
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    throw new Error(`${field} contains unsupported properties.`);
  }
}

function normalizeRankerDescriptor(input: unknown): ModelSearchRankerDescriptor {
  if (!isPlainRecord(input)) {
    throw new Error("Model-search ranker registrations must be plain objects.");
  }
  assertAllowedKeys(input, [
    "rankerId",
    "evidenceMode",
    "assuranceCeiling",
    "implementationVersion",
    "calibrationId",
    "calibrationVersion",
    "ready",
    "unavailabilityReasonCode",
  ], "Model-search ranker registration");
  const {
    rankerId,
    evidenceMode,
    assuranceCeiling,
    implementationVersion,
    calibrationId,
    calibrationVersion,
    ready,
    unavailabilityReasonCode,
  } = input;
  if (!isToken(rankerId)) {
    throw new Error("Model-search rankerId must be a safe registered identifier.");
  }
  if (!MODEL_RANKER_EVIDENCE_MODES.includes(evidenceMode as ModelRankerEvidenceMode)) {
    throw new Error("Model-search ranker evidenceMode is unsupported.");
  }
  if (!MODEL_MATCH_ASSURANCE_BANDS.includes(assuranceCeiling as ModelMatchAssurance)) {
    throw new Error("Model-search ranker assuranceCeiling is unsupported.");
  }
  if (evidenceMode === "text-only" && assuranceCeiling === "high") {
    throw new Error("Text-only model-search rankers cannot declare high assurance.");
  }
  if (!isVersion(implementationVersion) || !isToken(calibrationId) || !isVersion(calibrationVersion)) {
    throw new Error("Model-search ranker version and calibration identifiers are invalid.");
  }
  if (typeof ready !== "boolean") {
    throw new Error("Model-search ranker ready must be a boolean.");
  }
  if (unavailabilityReasonCode !== undefined && !isReasonCode(unavailabilityReasonCode)) {
    throw new Error("Model-search ranker unavailabilityReasonCode is invalid.");
  }
  if (
    (ready && unavailabilityReasonCode !== undefined)
    || (!ready && unavailabilityReasonCode === undefined)
  ) {
    throw new Error("Model-search ranker readiness and unavailability reason are inconsistent.");
  }
  const descriptorBase = {
    rankerId,
    evidenceMode: evidenceMode as ModelRankerEvidenceMode,
    assuranceCeiling: assuranceCeiling as ModelMatchAssurance,
    implementationVersion,
    calibrationId,
    calibrationVersion,
  };
  return ready
    ? deepFreeze({ ...descriptorBase, ready: true as const })
    : deepFreeze({
      ...descriptorBase,
      ready: false as const,
      unavailabilityReasonCode: unavailabilityReasonCode as string,
    });
}

/**
 * Select only the exact caller-requested ranker. Missing or unready rankers
 * return an unavailable result and never fall back to another registration.
 */
export function selectModelSearchRanker(
  requestedRankerId: unknown,
  rankers: unknown,
): ModelSearchRankerSelection {
  if (!isToken(requestedRankerId)) {
    throw new Error("Requested model-search rankerId must be a safe registered identifier.");
  }
  if (!Array.isArray(rankers)) {
    throw new Error("Model-search rankers must be an array.");
  }
  if (rankers.length > 64) {
    throw new Error("Model-search ranker registries are limited to 64 entries.");
  }
  const normalized = rankers.map((ranker) => normalizeRankerDescriptor(ranker));
  if (new Set(normalized.map((ranker) => ranker.rankerId)).size !== normalized.length) {
    throw new Error("Duplicate model-search ranker registrations are not allowed.");
  }
  const selected = normalized.find((ranker) => ranker.rankerId === requestedRankerId);
  if (!selected) {
    return deepFreeze({
      status: "unavailable",
      requestedRankerId,
      reasonCode: "ranker-not-registered",
      substituted: false,
    });
  }
  if (!selected.ready) {
    return deepFreeze({
      status: "unavailable",
      requestedRankerId,
      reasonCode: selected.unavailabilityReasonCode ?? "ranker-not-ready",
      substituted: false,
    });
  }
  return deepFreeze({
    status: "selected",
    selectionMode: "caller-exact",
    rankerId: selected.rankerId,
    evidenceMode: selected.evidenceMode,
    assuranceCeiling: selected.assuranceCeiling,
    implementationVersion: selected.implementationVersion,
    calibrationId: selected.calibrationId,
    calibrationVersion: selected.calibrationVersion,
    ready: true,
    substituted: false,
  });
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_REGEX.test(value);
}

function assertStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxLength: number,
  tokens = false,
): readonly string[] {
  if (
    !Array.isArray(value)
    || value.length > maxItems
    || value.some((item) =>
      typeof item !== "string"
      || item.length === 0
      || item.length > maxLength
      || (tokens ? !isReasonCode(item) : !new RegExp(NON_BLANK_BOUNDED_TEXT_PATTERN, "u").test(item))
      || new RegExp(DIRECT_URL_PATTERN, "iu").test(item))
  ) {
    throw new Error(`${field} must be a bounded string array.`);
  }
  const normalized = [...value] as string[];
  if (new Set(normalized.map((item) => item.toLocaleLowerCase("en-GB"))).size !== normalized.length) {
    throw new Error(`${field} must not contain duplicate values.`);
  }
  return normalized;
}

function expectedOriginalUri(
  subject: ModelMcpReviewSubject,
  kind: ModelConfirmationViewKind,
): string {
  return subject.kind === "catalog"
    ? `mcp://models/catalog/${subject.assetId}/versions/${subject.version}/views/${kind}/original`
    : `mcp://models/resolutions/${subject.resolutionId}/candidates/${subject.candidateId}/views/${kind}/original`;
}

function normalizeReviewSubject(input: unknown): ModelMcpReviewSubject {
  if (!isPlainRecord(input) || !isToken(input.modelIdentifier)) {
    throw new Error("Candidate review subject must be a plain object with a safe model identifier.");
  }
  if (input.kind === "catalog") {
    assertAllowedKeys(input, ["kind", "assetId", "version", "modelIdentifier"], "Catalog review subject");
    if (!isAssetId(input.assetId) || !isVersion(input.version)) {
      throw new Error("Catalog review subject asset identity is invalid.");
    }
    return {
      kind: "catalog",
      assetId: input.assetId,
      version: input.version,
      modelIdentifier: input.modelIdentifier,
    };
  }
  if (input.kind === "resolution-candidate") {
    assertAllowedKeys(
      input,
      ["kind", "resolutionId", "candidateId", "modelIdentifier", "confirmationToken"],
      "Resolution review subject",
    );
    if (
      !isModelPathSegment(input.resolutionId)
      || !isModelPathSegment(input.candidateId)
      || !isConfirmationToken(input.confirmationToken)
    ) {
      throw new Error("Resolution review subject identity or signed confirmation token is invalid.");
    }
    return {
      kind: "resolution-candidate",
      resolutionId: input.resolutionId,
      candidateId: input.candidateId,
      modelIdentifier: input.modelIdentifier,
      confirmationToken: input.confirmationToken,
    };
  }
  throw new Error("Candidate review subject kind is unsupported.");
}

function normalizeAssessment(input: unknown): ModelMcpMatchAssessmentProjection {
  if (!isPlainRecord(input) || !isPlainRecord(input.ranker)) {
    throw new Error("Candidate review assessment and ranker evidence must be plain objects.");
  }
  assertAllowedKeys(input, [
    "score",
    "assurance",
    "hardConstraintPass",
    "exactMatch",
    "reasonCodes",
    "ranker",
    "fidelityWarnings",
    "requestRevision",
    "candidateContentHash",
  ], "Candidate review assessment");
  assertAllowedKeys(input.ranker, [
    "id",
    "version",
    "calibrationId",
    "calibrationVersion",
    "evidenceMode",
    "assuranceCeiling",
  ], "Candidate review ranker evidence");
  const { score, assurance, hardConstraintPass, exactMatch, requestRevision, candidateContentHash } = input;
  const ranker = input.ranker;
  if (
    typeof score !== "number"
    || !Number.isFinite(score)
    || score < 0
    || score > 1
    || typeof hardConstraintPass !== "boolean"
    || typeof exactMatch !== "boolean"
    || !MODEL_MATCH_ASSURANCE_BANDS.includes(assurance as ModelMatchAssurance)
    || !Number.isInteger(requestRevision)
    || (requestRevision as number) < 0
    || (requestRevision as number) > MODEL_REQUEST_MAX_REVISION
    || !isSha256(candidateContentHash)
    || !isToken(ranker.id)
    || !isVersion(ranker.version)
    || !isToken(ranker.calibrationId)
    || !isVersion(ranker.calibrationVersion)
    || !MODEL_RANKER_EVIDENCE_MODES.includes(ranker.evidenceMode as ModelRankerEvidenceMode)
    || !MODEL_MATCH_ASSURANCE_BANDS.includes(ranker.assuranceCeiling as ModelMatchAssurance)
  ) {
    throw new Error("Candidate review assessment evidence is invalid.");
  }
  const derivedAssurance = classifyModelMatchAssurance(
    score,
    hardConstraintPass,
    ranker.evidenceMode as ModelRankerEvidenceMode,
    exactMatch,
    ranker.assuranceCeiling as ModelMatchAssurance,
  );
  const reasonCodes = assertStringArray(input.reasonCodes, "reasonCodes", 32, 128, true);
  const rawHigh = exactMatch || score >= MODEL_MATCH_ASSURANCE_THRESHOLDS.high;
  if (hardConstraintPass && assurance === "low" && rawHigh) {
    const requiredCeilingReason = ranker.evidenceMode === "text-only"
      ? MODEL_TEXT_ONLY_ASSURANCE_CEILING_REASON_CODE
      : MODEL_RANKER_ASSURANCE_CEILING_REASON_CODE;
    if (!reasonCodes.includes(requiredCeilingReason)) {
      throw new Error("Candidate review assessment must retain the canonical assurance-ceiling reason.");
    }
  }
  if (assurance !== derivedAssurance || !hardConstraintPass || assurance === "none") {
    throw new Error("Candidate review assurance must be a selectable canonical assessment.");
  }
  return {
    score,
    assurance: assurance as ModelMatchAssurance,
    hardConstraintPass,
    exactMatch,
    reasonCodes,
    ranker: {
      id: ranker.id,
      version: ranker.version,
      calibrationId: ranker.calibrationId,
      calibrationVersion: ranker.calibrationVersion,
      evidenceMode: ranker.evidenceMode as ModelRankerEvidenceMode,
      assuranceCeiling: ranker.assuranceCeiling as ModelMatchAssurance,
    },
    fidelityWarnings: assertStringArray(input.fidelityWarnings, "fidelityWarnings", 32, 128),
    requestRevision: requestRevision as number,
    candidateContentHash,
  };
}

function normalizeProvenance(input: unknown): ModelMcpProvenanceSummary {
  if (!isPlainRecord(input)) {
    throw new Error("Candidate review provenance must be a plain object.");
  }
  assertAllowedKeys(input, ["kind", "sourceId", "sourceAssetId", "contentHash", "capturedAt"], "Candidate review provenance");
  if (
    !MODEL_PROVENANCE_KINDS.includes(input.kind as typeof MODEL_PROVENANCE_KINDS[number])
    || !isToken(input.sourceId)
    || typeof input.sourceAssetId !== "string"
    || !OPAQUE_SOURCE_ASSET_ID_REGEX.test(input.sourceAssetId)
    || !isSha256(input.contentHash)
    || !isTimestamp(input.capturedAt)
  ) {
    throw new Error("Candidate review provenance is invalid.");
  }
  return {
    kind: input.kind as typeof MODEL_PROVENANCE_KINDS[number],
    sourceId: input.sourceId,
    sourceAssetId: input.sourceAssetId,
    contentHash: input.contentHash,
    capturedAt: input.capturedAt,
  };
}

function normalizeRights(input: unknown): ModelMcpRightsSummary {
  if (!isPlainRecord(input)) {
    throw new Error("Candidate review rights summary must be a plain object.");
  }
  assertAllowedKeys(input, [
    "decisionId",
    "policyId",
    "policyVersion",
    "sourceId",
    "sourceAssetId",
    "sourceContentHash",
    "status",
    "licenseId",
    "reviewedAt",
    "attributionRequired",
  ], "Candidate review rights summary");
  if (
    !isToken(input.decisionId)
    || !isToken(input.policyId)
    || !isVersion(input.policyVersion)
    || !isToken(input.sourceId)
    || typeof input.sourceAssetId !== "string"
    || !OPAQUE_SOURCE_ASSET_ID_REGEX.test(input.sourceAssetId)
    || !isSha256(input.sourceContentHash)
    || !["allowed", "attribution-required"].includes(input.status as string)
    || !isToken(input.licenseId)
    || !isTimestamp(input.reviewedAt)
    || input.attributionRequired !== (input.status === "attribution-required")
  ) {
    throw new Error("Candidate review rights summary is invalid or ineligible.");
  }
  return {
    decisionId: input.decisionId,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    sourceId: input.sourceId,
    sourceAssetId: input.sourceAssetId,
    sourceContentHash: input.sourceContentHash,
    status: input.status as ModelMcpRightsSummary["status"],
    licenseId: input.licenseId,
    reviewedAt: input.reviewedAt,
    attributionRequired: input.attributionRequired as boolean,
  };
}

function normalizeHardGates(input: unknown): readonly ModelMcpHardGateSummary[] {
  if (!Array.isArray(input) || input.length !== MODEL_CANDIDATE_HARD_GATE_KINDS.length) {
    throw new Error("Candidate review hard gates must contain every required gate exactly once.");
  }
  return input.map((gate, index): ModelMcpHardGateSummary => {
    const expectedKind = MODEL_CANDIDATE_HARD_GATE_KINDS[index];
    if (!expectedKind || !isPlainRecord(gate)) {
      throw new Error("Candidate review hard gate evidence must be plain objects.");
    }
    assertAllowedKeys(
      gate,
      ["kind", "outcome", "validatorId", "validatorVersion", "subjectContentHash", "evaluatedAt"],
      "Candidate review hard gate",
    );
    if (
      gate.kind !== expectedKind
      || gate.outcome !== "passed"
      || !isToken(gate.validatorId)
      || !isVersion(gate.validatorVersion)
      || !isSha256(gate.subjectContentHash)
      || !isTimestamp(gate.evaluatedAt)
    ) {
      throw new Error("Candidate review hard gate evidence is invalid or not passed.");
    }
    return {
      kind: expectedKind,
      outcome: "passed",
      validatorId: gate.validatorId,
      validatorVersion: gate.validatorVersion,
      subjectContentHash: gate.subjectContentHash,
      evaluatedAt: gate.evaluatedAt,
    };
  });
}

function normalizeStructuredContent(input: unknown): ModelCandidateReviewStructuredContent {
  if (!isPlainRecord(input)) {
    throw new Error("Candidate review structuredContent.review must be a plain object.");
  }
  assertAllowedKeys(input, [
    "contractVersion",
    "subject",
    "assessment",
    "provenance",
    "rights",
    "technicalProfile",
    "processingClosureHash",
    "hardGates",
    "fidelityGateOutcome",
    "reviewViews",
  ], "Candidate review");
  if (input.contractVersion !== MODEL_RESOLUTION_CONTRACT_VERSION) {
    throw new Error("Candidate review contractVersion is unsupported.");
  }
  const subject = normalizeReviewSubject(input.subject);
  const assessment = normalizeAssessment(input.assessment);
  const provenance = normalizeProvenance(input.provenance);
  const rights = normalizeRights(input.rights);
  const technicalProfile = createModelTechnicalProfile(input.technicalProfile);
  const processingClosureHash = input.processingClosureHash;
  const hardGates = normalizeHardGates(input.hardGates);
  if (
    rights.sourceId !== provenance.sourceId
    || rights.sourceAssetId !== provenance.sourceAssetId
    || rights.sourceContentHash !== provenance.contentHash
    || !isSha256(processingClosureHash)
    || hardGates.some((gate, index) => gate.subjectContentHash !== (
      index === 0 ? provenance.contentHash : processingClosureHash
    ))
  ) {
    throw new Error("Candidate review evidence must bind the same source and content hash.");
  }
  if (
    !["passed", "low-only"].includes(input.fidelityGateOutcome as string)
    || (input.fidelityGateOutcome === "low-only" && (
      assessment.assurance !== "low"
      || !assessment.reasonCodes.includes("fidelity-low-only")
      || assessment.fidelityWarnings.length === 0
    ))
  ) {
    throw new Error("Candidate review fidelity gate outcome is inconsistent with assurance.");
  }
  const reviewViews = input.reviewViews;
  if (!Array.isArray(reviewViews) || reviewViews.length !== 4) {
    throw new Error("Candidate review structuredContent requires exactly four views.");
  }

  const normalizedViews = reviewViews.map((rawView, index): ModelMcpReviewView => {
    const expectedKind = MODEL_CONFIRMATION_VIEW_KINDS[index];
    if (!expectedKind || !isPlainRecord(rawView) || rawView.kind !== expectedKind) {
      throw new Error(`Candidate review views must use canonical order beginning with ${expectedKind ?? "front"}.`);
    }
    if (!isPlainRecord(rawView.preview)) {
      throw new Error(`Candidate ${expectedKind} preview metadata is required.`);
    }
    if (
      rawView.preview.contentIndex !== index
      || rawView.preview.width !== MODEL_MCP_PREVIEW_SIZE_PX
      || rawView.preview.height !== MODEL_MCP_PREVIEW_SIZE_PX
      || rawView.preview.contentType !== "image/png"
      || !isSha256(rawView.preview.sha256)
    ) {
      throw new Error(`Candidate ${expectedKind} preview metadata must describe one ordered 512 PNG.`);
    }
    if (!isPlainRecord(rawView.original)) {
      throw new Error(`Candidate ${expectedKind} original metadata is required.`);
    }
    if (
      rawView.original.uri !== expectedOriginalUri(subject, expectedKind)
      || rawView.original.width !== MODEL_CONFIRMATION_VIEW_SIZE_PX
      || rawView.original.height !== MODEL_CONFIRMATION_VIEW_SIZE_PX
      || rawView.original.contentType !== "image/png"
      || !isSha256(rawView.original.sha256)
    ) {
      throw new Error(`Candidate ${expectedKind} original must be an authenticated 1024 mcp://models resource.`);
    }
    return {
      kind: expectedKind,
      preview: {
        contentIndex: index,
        width: MODEL_MCP_PREVIEW_SIZE_PX,
        height: MODEL_MCP_PREVIEW_SIZE_PX,
        contentType: "image/png",
        sha256: rawView.preview.sha256,
      },
      original: {
        uri: rawView.original.uri,
        width: MODEL_CONFIRMATION_VIEW_SIZE_PX,
        height: MODEL_CONFIRMATION_VIEW_SIZE_PX,
        contentType: "image/png",
        sha256: rawView.original.sha256,
      },
    };
  }) as unknown as ModelMcpReviewViews;

  return deepFreeze({
    contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
    subject,
    assessment,
    provenance,
    rights,
    technicalProfile,
    processingClosureHash,
    hardGates,
    fidelityGateOutcome: input.fidelityGateOutcome as "passed" | "low-only",
    reviewViews: normalizedViews,
  });
}

function isCanonicalBase64(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MODEL_MCP_MAX_PREVIEW_BASE64_LENGTH
    && value.length % 4 === 0
    && BASE64_PATTERN.test(value);
}

function decodeVerifiedPreviewPng(value: unknown, kind: ModelConfirmationViewKind): Buffer {
  if (!isCanonicalBase64(value)) {
    throw new Error(`Candidate ${kind} preview data must be canonical base64 without a data URI prefix.`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error(`Candidate ${kind} preview data must use canonical base64 padding.`);
  }
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    bytes.length < 33
    || !bytes.subarray(0, 8).equals(pngSignature)
    || bytes.readUInt32BE(8) !== 13
    || bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`Candidate ${kind} preview must contain a valid PNG signature and IHDR chunk.`);
  }
  if (
    bytes.readUInt32BE(16) !== MODEL_MCP_PREVIEW_SIZE_PX
    || bytes.readUInt32BE(20) !== MODEL_MCP_PREVIEW_SIZE_PX
  ) {
    throw new Error(`Candidate ${kind} PNG IHDR must be exactly 512 by 512 pixels.`);
  }
  return bytes;
}

function sameNormalizedValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeMcpModelAssetRef(input: unknown) {
  if (!isPlainRecord(input) || input.contractVersion !== MODEL_RESOLUTION_CONTRACT_VERSION) {
    throw new Error("Projected model asset references require the current explicit contractVersion.");
  }
  const asset = createModelAssetRef(input);
  if (!isAssetId(asset.assetId) || !isVersion(asset.version)) {
    throw new Error("Projected model asset identity exceeds the MCP boundary.");
  }
  return asset;
}

function candidateSummaryAssetIdentity(candidate: Record<string, unknown>): {
  readonly contentHash: string;
  readonly kind: "leaf" | "assembly";
} {
  if (isPlainRecord(candidate.asset)) {
    const asset = normalizeMcpModelAssetRef(candidate.asset);
    return { contentHash: asset.contentHash, kind: asset.kind };
  }
  if (!isPlainRecord(candidate.assetRef)) {
    throw new Error("Candidate summary requires one canonical asset identity.");
  }
  if (candidate.assetRef.disposition === "existing" && isPlainRecord(candidate.assetRef.asset)) {
    assertAllowedKeys(candidate.assetRef, ["disposition", "asset"], "Existing candidate assetRef");
    const asset = normalizeMcpModelAssetRef(candidate.assetRef.asset);
    return { contentHash: asset.contentHash, kind: asset.kind };
  }
  assertAllowedKeys(
    candidate.assetRef,
    ["disposition", "proposalId", "kind", "contentHash"],
    "Proposed candidate assetRef",
  );
  if (
    candidate.assetRef.disposition !== "proposed"
    || !isToken(candidate.assetRef.proposalId)
    || !["leaf", "assembly"].includes(candidate.assetRef.kind as string)
    || !isSha256(candidate.assetRef.contentHash)
  ) {
    throw new Error("Proposed candidate asset identity is invalid.");
  }
  return {
    contentHash: candidate.assetRef.contentHash,
    kind: candidate.assetRef.kind as "leaf" | "assembly",
  };
}

function normalizeCandidateSummaryEvidence(candidate: Record<string, unknown>) {
  const assessment = normalizeAssessment(candidate.assessment);
  const provenance = normalizeProvenance(candidate.provenance);
  const rights = normalizeRights(candidate.rights);
  const technicalProfile = createModelTechnicalProfile(candidate.technicalProfile);
  const processingClosureHash = candidate.processingClosureHash;
  const hardGates = normalizeHardGates(candidate.hardGates);
  const fidelityGateOutcome = candidate.fidelityGateOutcome;
  const candidateAsset = candidateSummaryAssetIdentity(candidate);
  if (
    candidateAsset.contentHash !== assessment.candidateContentHash
    || rights.sourceId !== provenance.sourceId
    || rights.sourceAssetId !== provenance.sourceAssetId
    || rights.sourceContentHash !== provenance.contentHash
    || !isSha256(processingClosureHash)
    || (candidateAsset.kind === "leaf" && processingClosureHash !== candidateAsset.contentHash)
    || hardGates.some((gate, index) => gate.subjectContentHash !== (
      index === 0 ? provenance.contentHash : processingClosureHash
    ))
    || !["passed", "low-only"].includes(fidelityGateOutcome as string)
    || (fidelityGateOutcome === "low-only" && (
      assessment.assurance !== "low"
      || !assessment.reasonCodes.includes("fidelity-low-only")
      || assessment.fidelityWarnings.length === 0
    ))
  ) {
    throw new Error("Candidate summary evidence must bind one eligible content hash.");
  }
  return {
    assessment,
    provenance,
    rights,
    technicalProfile,
    processingClosureHash,
    hardGates,
    fidelityGateOutcome: fidelityGateOutcome as "passed" | "low-only",
    candidateHash: candidateAsset.contentHash,
    candidateKind: candidateAsset.kind,
  };
}

function assertCandidateEvidenceMatchesReview(
  candidate: Record<string, unknown>,
  review: ModelCandidateReviewStructuredContent,
): void {
  const evidence = normalizeCandidateSummaryEvidence(candidate);
  if (
    !sameNormalizedValue(evidence.assessment, review.assessment)
    || !sameNormalizedValue(evidence.provenance, review.provenance)
    || !sameNormalizedValue(evidence.rights, review.rights)
    || !sameNormalizedValue(evidence.technicalProfile, review.technicalProfile)
    || evidence.processingClosureHash !== review.processingClosureHash
    || !sameNormalizedValue(evidence.hardGates, review.hardGates)
    || evidence.fidelityGateOutcome !== review.fidelityGateOutcome
  ) {
    throw new Error("Candidate review evidence must exactly match one content-bound candidate summary.");
  }
}

function normalizeSelectedRanker(input: Record<string, unknown>): SelectedModelSearchRanker {
  assertAllowedKeys(input, [
    "status",
    "selectionMode",
    "rankerId",
    "evidenceMode",
    "assuranceCeiling",
    "implementationVersion",
    "calibrationId",
    "calibrationVersion",
    "ready",
    "substituted",
  ], "Selected catalog ranker");
  if (
    input.status !== "selected"
    || !["caller-exact", "default"].includes(input.selectionMode as string)
    || input.ready !== true
    || input.substituted !== false
  ) {
    throw new Error("Catalog review requires one ready, non-substituted selected ranker.");
  }
  const descriptor = normalizeRankerDescriptor({
    rankerId: input.rankerId,
    evidenceMode: input.evidenceMode,
    assuranceCeiling: input.assuranceCeiling,
    implementationVersion: input.implementationVersion,
    calibrationId: input.calibrationId,
    calibrationVersion: input.calibrationVersion,
    ready: true,
  });
  return {
    rankerId: descriptor.rankerId,
    evidenceMode: descriptor.evidenceMode,
    assuranceCeiling: descriptor.assuranceCeiling,
    implementationVersion: descriptor.implementationVersion,
    calibrationId: descriptor.calibrationId,
    calibrationVersion: descriptor.calibrationVersion,
    status: "selected",
    selectionMode: input.selectionMode as SelectedModelSearchRanker["selectionMode"],
    ready: true,
    substituted: false,
  };
}

function normalizeUnavailableRanker(input: Record<string, unknown>): UnavailableModelSearchRanker {
  assertAllowedKeys(
    input,
    ["status", "requestedRankerId", "reasonCode", "substituted"],
    "Unavailable catalog ranker",
  );
  if (
    input.status !== "unavailable"
    || !isToken(input.requestedRankerId)
    || !isReasonCode(input.reasonCode)
    || input.substituted !== false
  ) {
    throw new Error("Unavailable catalog ranker evidence is invalid.");
  }
  return deepFreeze({
    status: "unavailable",
    requestedRankerId: input.requestedRankerId,
    reasonCode: input.reasonCode,
    substituted: false,
  });
}

function assertAssessmentUsesSelectedRanker(
  assessment: ModelMcpMatchAssessmentProjection,
  selection: SelectedModelSearchRanker,
  requestRevision: number,
): void {
  if (
    assessment.requestRevision !== requestRevision
    || assessment.ranker.id !== selection.rankerId
    || assessment.ranker.evidenceMode !== selection.evidenceMode
    || assessment.ranker.assuranceCeiling !== selection.assuranceCeiling
    || assessment.ranker.version !== selection.implementationVersion
    || assessment.ranker.calibrationId !== selection.calibrationId
    || assessment.ranker.calibrationVersion !== selection.calibrationVersion
  ) {
    throw new Error("Catalog candidate assessment must bind the exact selected ranker and request revision.");
  }
}

function normalizeCatalogMatch(
  input: unknown,
  selection: SelectedModelSearchRanker,
  requestRevision: number,
): Record<string, unknown> {
  if (!isPlainRecord(input)) {
    throw new Error("Catalog matches must be plain objects.");
  }
  assertAllowedKeys(input, [
    "modelIdentifier",
    "asset",
    "assessment",
    "provenance",
    "rights",
    "technicalProfile",
    "processingClosureHash",
    "hardGates",
    "fidelityGateOutcome",
    "reviewAvailable",
  ], "Catalog match");
  if (!isToken(input.modelIdentifier) || input.reviewAvailable !== true && input.reviewAvailable !== false) {
    throw new Error("Catalog match identity and review availability are invalid.");
  }
  const evidence = normalizeCandidateSummaryEvidence(input);
  assertAssessmentUsesSelectedRanker(evidence.assessment, selection, requestRevision);
  return input;
}

function isBoundedPublicText(value: unknown, maxLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && new RegExp(NON_BLANK_BOUNDED_TEXT_PATTERN, "u").test(value)
    && !new RegExp(DIRECT_URL_PATTERN, "u").test(value);
}

/** Validate, copy, and freeze bounded retry answers with unique question IDs. */
export function normalizeModelMcpRefinementAnswers(
  input: unknown,
): readonly ModelMcpRefinementAnswer[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 3) {
    throw new Error("Model resolution retry requires one to three refinement answers.");
  }
  const answers = input.map((answer): ModelMcpRefinementAnswer => {
    if (!isPlainRecord(answer)) {
      throw new Error("Model resolution refinement answers must be plain objects.");
    }
    assertAllowedKeys(answer, ["questionId", "answer"], "Model resolution refinement answer");
    if (!isToken(answer.questionId) || !isBoundedPublicText(answer.answer, 500)) {
      throw new Error("Model resolution refinement answer ID or value is invalid.");
    }
    return { questionId: answer.questionId, answer: answer.answer };
  });
  if (new Set(answers.map((answer) => answer.questionId)).size !== answers.length) {
    throw new Error("Model resolution refinement answer question IDs must be unique.");
  }
  return deepFreeze(answers);
}

function normalizeRefinementQuestions(input: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(input) || input.length > 3) {
    throw new Error("Resolution refinementQuestions must contain at most three records.");
  }
  const questions = input.map((question) => {
    if (!isPlainRecord(question)) {
      throw new Error("Resolution refinement questions must be plain objects.");
    }
    assertAllowedKeys(question, ["questionId", "prompt"], "Resolution refinement question");
    if (!isToken(question.questionId) || !isBoundedPublicText(question.prompt, 500)) {
      throw new Error("Resolution refinement question ID or prompt is invalid.");
    }
    return question;
  });
  if (new Set(questions.map((question) => question.questionId)).size !== questions.length) {
    throw new Error("Resolution refinement question IDs must be unique.");
  }
  return questions;
}

function normalizeResolutionCandidate(
  input: unknown,
  resolutionId: string,
  requestRevision: number,
): {
  readonly candidate: Record<string, unknown>;
  readonly evidence: ReturnType<typeof normalizeCandidateSummaryEvidence>;
} {
  if (!isPlainRecord(input)) {
    throw new Error("Resolution bestCandidate must be a plain object.");
  }
  assertAllowedKeys(input, [
    "resolutionId",
    "candidateId",
    "modelIdentifier",
    "assetRef",
    "assessment",
    "provenance",
    "rights",
    "technicalProfile",
    "processingClosureHash",
    "hardGates",
    "fidelityGateOutcome",
    "confirmationToken",
  ], "Resolution bestCandidate");
  if (
    input.resolutionId !== resolutionId
    || !isModelPathSegment(input.candidateId)
    || !isToken(input.modelIdentifier)
    || !isConfirmationToken(input.confirmationToken)
  ) {
    throw new Error("Resolution bestCandidate identity is invalid.");
  }
  const evidence = normalizeCandidateSummaryEvidence(input);
  if (evidence.assessment.requestRevision !== requestRevision) {
    throw new Error("Resolution bestCandidate must bind the immutable request revision.");
  }
  return { candidate: input, evidence };
}

function normalizeResolutionSummary(input: unknown): {
  readonly resolution: Record<string, unknown>;
  readonly bestCandidate?: Record<string, unknown>;
  readonly evidence?: ReturnType<typeof normalizeCandidateSummaryEvidence>;
} {
  if (!isPlainRecord(input)) {
    throw new Error("Model resolution summary must be a plain object.");
  }
  assertAllowedKeys(input, [
    "contractVersion",
    "resolutionId",
    "requestRevision",
    "state",
    "attempts",
    "bestCandidate",
    "refinementQuestions",
    "finalAssetRef",
    "stateReasonCode",
  ], "Model resolution summary");
  if (
    input.contractVersion !== MODEL_RESOLUTION_CONTRACT_VERSION
    || !isModelPathSegment(input.resolutionId)
    || !Number.isInteger(input.requestRevision)
    || (input.requestRevision as number) < 0
    || (input.requestRevision as number) > MODEL_REQUEST_MAX_REVISION
    || !MODEL_RESOLUTION_STATES.includes(input.state as typeof MODEL_RESOLUTION_STATES[number])
    || !Number.isInteger(input.attempts)
    || (input.attempts as number) < 1
    || (input.attempts as number) > 100
  ) {
    throw new Error("Model resolution contract, identity, revision, state, or attempts are invalid.");
  }
  const questions = normalizeRefinementQuestions(input.refinementQuestions);
  const normalizedCandidate = input.bestCandidate === undefined
    ? undefined
    : normalizeResolutionCandidate(
      input.bestCandidate,
      input.resolutionId,
      input.requestRevision as number,
    );
  if (
    ["awaiting-confirmation", "promoting", "completed"].includes(input.state as string)
    && normalizedCandidate === undefined
  ) {
    throw new Error(`Model resolution ${String(input.state)} requires bestCandidate.`);
  }
  if (
    input.state === "awaiting-confirmation"
    && normalizedCandidate?.evidence.assessment.assurance === "low"
    && questions.length === 0
  ) {
    throw new Error("Low-assurance confirmation requires at least one refinement question.");
  }
  if (["failed", "cancelled", "unresolved"].includes(input.state as string)) {
    if (!isReasonCode(input.stateReasonCode)) {
      throw new Error("Terminal model resolution states require a bounded reason code.");
    }
  } else if (input.stateReasonCode !== undefined && !isReasonCode(input.stateReasonCode)) {
    throw new Error("Model resolution stateReasonCode is invalid.");
  }
  if (input.state === "completed") {
    if (normalizedCandidate === undefined) {
      throw new Error("Completed model resolution requires bestCandidate.");
    }
    const finalAsset = normalizeMcpModelAssetRef(input.finalAssetRef);
    if (
      !isAssetId(finalAsset.assetId)
      || !isVersion(finalAsset.version)
      || finalAsset.kind !== normalizedCandidate.evidence.candidateKind
      || finalAsset.contentHash !== normalizedCandidate.evidence.candidateHash
    ) {
      throw new Error("Completed model resolution finalAssetRef must match the selected candidate.");
    }
    const candidateAssetRef = normalizedCandidate.candidate.assetRef;
    if (
      isPlainRecord(candidateAssetRef)
      && candidateAssetRef.disposition === "existing"
      && isPlainRecord(candidateAssetRef.asset)
    ) {
      const existingAsset = normalizeMcpModelAssetRef(candidateAssetRef.asset);
      if (existingAsset.assetId !== finalAsset.assetId || existingAsset.version !== finalAsset.version) {
        throw new Error("Completed existing catalog selection must return the same immutable asset version.");
      }
    }
  } else if (input.finalAssetRef !== undefined) {
    throw new Error("finalAssetRef is only allowed for a completed model resolution.");
  }
  return {
    resolution: input,
    ...(normalizedCandidate === undefined
      ? {}
      : {
        bestCandidate: normalizedCandidate.candidate,
        evidence: normalizedCandidate.evidence,
      }),
  };
}

/**
 * Validate cross-field catalog output invariants that JSON Schema cannot
 * express, including exact ranker and three-domain content-hash bindings.
 */
export function normalizeModelCatalogSearchStructuredContent(
  input: unknown,
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(input)) {
    throw new Error("Catalog search structuredContent must be a plain object.");
  }
  assertAllowedKeys(
    input,
    ["contractVersion", "requestRevision", "rankerSelection", "matches", "review"],
    "Catalog search structuredContent",
  );
  if (
    input.contractVersion !== MODEL_RESOLUTION_CONTRACT_VERSION
    || !Number.isInteger(input.requestRevision)
    || (input.requestRevision as number) < 0
    || (input.requestRevision as number) > MODEL_REQUEST_MAX_REVISION
    || !Array.isArray(input.matches)
    || input.matches.length > 5
    || !isPlainRecord(input.rankerSelection)
  ) {
    throw new Error("Catalog search structuredContent contract or bounds are invalid.");
  }
  if (input.rankerSelection.status === "unavailable") {
    normalizeUnavailableRanker(input.rankerSelection);
    if (input.matches.length !== 0 || input.review !== undefined) {
      throw new Error("Unavailable catalog rankers cannot return matches or review evidence.");
    }
    return deepFreeze({ ...input });
  }
  const selection = normalizeSelectedRanker(input.rankerSelection);
  const matches = input.matches.map((match) => normalizeCatalogMatch(
    match,
    selection,
    input.requestRevision as number,
  ));
  if (input.review === undefined) {
    return deepFreeze({ ...input });
  }
  if (matches.length === 0) {
    throw new Error("Catalog inline review requires one returned match.");
  }
  const review = normalizeStructuredContent(input.review);
  if (review.subject.kind !== "catalog") {
    throw new Error("Catalog search review requires a promoted catalog subject.");
  }
  const catalogSubject = review.subject;
  const matchingSubjects = matches.filter((match) =>
    isPlainRecord(match.asset)
    && match.reviewAvailable === true
    && match.modelIdentifier === catalogSubject.modelIdentifier
    && match.asset.assetId === catalogSubject.assetId
    && match.asset.version === catalogSubject.version);
  if (matchingSubjects.length !== 1 || !isPlainRecord(matchingSubjects[0])) {
    throw new Error("Catalog review subject must match exactly one returned catalog match.");
  }
  assertAssessmentUsesSelectedRanker(
    review.assessment,
    selection,
    input.requestRevision as number,
  );
  assertCandidateEvidenceMatchesReview(matchingSubjects[0], review);
  return deepFreeze({ ...input, review });
}

/** Validate cross-field resolution output invariants with or without a review. */
export function normalizeModelResolutionStructuredContent(
  input: unknown,
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(input)) {
    throw new Error("Model resolution structuredContent must be a plain object.");
  }
  assertAllowedKeys(input, ["resolution", "review"], "Model resolution structuredContent");
  const normalizedResolution = normalizeResolutionSummary(input.resolution);
  if (input.review === undefined) {
    if (normalizedResolution.resolution.state === "awaiting-confirmation") {
      throw new Error("Awaiting-confirmation model resolutions require the four-view review envelope.");
    }
    return deepFreeze({ ...input });
  }
  const review = normalizeStructuredContent(input.review);
  if (
    review.subject.kind !== "resolution-candidate"
    || normalizedResolution.bestCandidate === undefined
    || normalizedResolution.resolution.resolutionId !== review.subject.resolutionId
    || normalizedResolution.resolution.requestRevision !== review.assessment.requestRevision
    || normalizedResolution.bestCandidate.resolutionId !== review.subject.resolutionId
    || normalizedResolution.bestCandidate.candidateId !== review.subject.candidateId
    || normalizedResolution.bestCandidate.modelIdentifier !== review.subject.modelIdentifier
    || normalizedResolution.bestCandidate.confirmationToken !== review.subject.confirmationToken
  ) {
    throw new Error("Resolution review subject must match the returned best candidate and revision.");
  }
  assertCandidateEvidenceMatchesReview(normalizedResolution.bestCandidate, review);
  return deepFreeze({ ...input, review });
}

function normalizeToolStructuredContent(
  toolName: ModelCandidateBearingToolName,
  input: unknown,
): Readonly<Record<string, unknown>> & { readonly review: ModelCandidateReviewStructuredContent } {
  const normalized = toolName === "search_model_catalog"
    ? normalizeModelCatalogSearchStructuredContent(input)
    : normalizeModelResolutionStructuredContent(input);
  if (!isPlainRecord(normalized.review)) {
    throw new Error("Candidate review tool result requires one top-level review envelope.");
  }
  return normalized as Readonly<Record<string, unknown>> & {
    readonly review: ModelCandidateReviewStructuredContent;
  };
}

/**
 * Validate and freeze the exact four inline preview blocks paired with public-
 * safe candidate structuredContent. This helper performs no hosted I/O.
 */
export function createModelCandidateReviewToolResult(input: unknown): ModelCandidateReviewToolResult {
  if (!isPlainRecord(input)) {
    throw new Error("Candidate review tool result input must be a plain object.");
  }
  if (
    typeof input.toolName !== "string"
    || ![
      "search_model_catalog",
      "resolve_model_request",
      "get_model_resolution",
      "confirm_model_candidate",
      "retry_model_resolution",
    ].includes(input.toolName)
  ) {
    throw new Error("Candidate review tool result requires one candidate-bearing canonical toolName.");
  }
  const structuredContent = normalizeToolStructuredContent(
    input.toolName as ModelCandidateBearingToolName,
    input.structuredContent,
  );
  if (!Array.isArray(input.images) || input.images.length !== 4) {
    throw new Error("Candidate review tool results require exactly four preview images.");
  }
  const content = input.images.map((rawImage, index): ModelMcpImageContent => {
    const expectedKind = MODEL_CONFIRMATION_VIEW_KINDS[index];
    if (!expectedKind || !isPlainRecord(rawImage) || rawImage.kind !== expectedKind) {
      throw new Error(`Candidate preview images must use canonical order beginning with ${expectedKind ?? "front"}.`);
    }
    if (rawImage.mimeType !== "image/png") {
      throw new Error(`Candidate ${expectedKind} preview must be a PNG image.`);
    }
    if (
      rawImage.width !== MODEL_MCP_PREVIEW_SIZE_PX
      || rawImage.height !== MODEL_MCP_PREVIEW_SIZE_PX
    ) {
      throw new Error(`Candidate ${expectedKind} preview must be exactly 512 by 512 pixels.`);
    }
    const bytes = decodeVerifiedPreviewPng(rawImage.data, expectedKind);
    const expectedHash = structuredContent.review.reviewViews[index]?.preview.sha256;
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) {
      throw new Error(`Candidate ${expectedKind} preview sha256 must match structured review metadata.`);
    }
    return deepFreeze({
      type: "image",
      data: rawImage.data as string,
      mimeType: "image/png",
    });
  }) as unknown as ModelMcpImageContentPack;
  return deepFreeze({ structuredContent, content });
}

const REQUEST_RESOURCE_SCOPES = deepFreeze([
  "mcp:access",
  MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
]);

/** Authenticated resources registered by resources/templates/list. */
export const MODEL_MCP_RESOURCE_TEMPLATES = deepFreeze([
  {
    name: "model_resolution",
    title: "Model resolution",
    description: "Requester-owned immutable model-resolution revision and progress metadata.",
    uriTemplate: "mcp://models/resolutions/{resolutionId}",
    mimeType: "application/json",
    requiredOAuthScopes: REQUEST_RESOURCE_SCOPES,
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    authenticated: true,
    ownership: "requester-owned",
  },
  {
    name: "model_candidate_manifest",
    title: "Model candidate manifest",
    description: "Requester-owned candidate processing manifest without private storage references.",
    uriTemplate: "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/manifest",
    mimeType: "application/json",
    requiredOAuthScopes: REQUEST_RESOURCE_SCOPES,
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    authenticated: true,
    ownership: "requester-owned",
  },
  {
    name: "model_confirmation_original",
    title: "Model confirmation original",
    description: "Authenticated 1024 PNG original for one canonical confirmation view.",
    uriTemplate:
      "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/views/{viewKind}/original",
    mimeType: "image/png",
    requiredOAuthScopes: REQUEST_RESOURCE_SCOPES,
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    authenticated: true,
    ownership: "requester-owned",
    width: MODEL_CONFIRMATION_VIEW_SIZE_PX,
    height: MODEL_CONFIRMATION_VIEW_SIZE_PX,
  },
  {
    name: "model_catalog_confirmation_original",
    title: "Promoted model confirmation original",
    description: "Authenticated cached 1024 PNG original for one promoted catalog view.",
    uriTemplate:
      "mcp://models/catalog/{assetId}/versions/{version}/views/{viewKind}/original",
    mimeType: "image/png",
    requiredOAuthScopes: REQUEST_RESOURCE_SCOPES,
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    authenticated: true,
    ownership: "promoted-catalog",
    width: MODEL_CONFIRMATION_VIEW_SIZE_PX,
    height: MODEL_CONFIRMATION_VIEW_SIZE_PX,
  },
  {
    name: "model_catalog_manifest",
    title: "Promoted model catalog manifest",
    description: "Authenticated immutable runtime manifest for one promoted catalog version.",
    uriTemplate: "mcp://models/catalog/{assetId}/versions/{version}/manifest",
    mimeType: "application/json",
    requiredOAuthScopes: REQUEST_RESOURCE_SCOPES,
    requiredCapability: MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
    authenticated: true,
    ownership: "promoted-catalog",
  },
] as const satisfies readonly ModelMcpResourceTemplate[]);

const MODEL_RESOURCE_PATTERNS = [
  new RegExp(`^mcp://models/resolutions/${SAFE_MODEL_RESOURCE_ID}$`, "u"),
  new RegExp(
    `^mcp://models/resolutions/${SAFE_MODEL_RESOURCE_ID}/candidates/`
      + `${SAFE_MODEL_RESOURCE_ID}/manifest$`,
    "u",
  ),
  new RegExp(
    `^mcp://models/resolutions/${SAFE_MODEL_RESOURCE_ID}/candidates/`
      + `${SAFE_MODEL_RESOURCE_ID}/views/(?:front|left|top|isometric)/original$`,
    "u",
  ),
  new RegExp(
    `^mcp://models/catalog/${SAFE_ASSET_RESOURCE_ID}/versions/`
      + `${SAFE_VERSION_RESOURCE_ID}/manifest$`,
    "u",
  ),
  new RegExp(
    `^mcp://models/catalog/${SAFE_ASSET_RESOURCE_ID}/versions/`
      + `${SAFE_VERSION_RESOURCE_ID}/views/(?:front|left|top|isometric)/original$`,
    "u",
  ),
] as const;

/** Return the immutable authenticated resource-template registry. */
export function listModelMcpResourceTemplates(): readonly ModelMcpResourceTemplate[] {
  return MODEL_MCP_RESOURCE_TEMPLATES;
}

/** Return whether a value is one exact, traversal-safe canonical model URI. */
export function isModelMcpResourceUri(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 512
    && !value.includes("%")
    && MODEL_RESOURCE_PATTERNS.some((pattern) => pattern.test(value))
    && hasImmutableCatalogResourceVersion(value);
}

function hasImmutableCatalogResourceVersion(uri: string): boolean {
  const segments = uri.slice("mcp://models/".length).split("/");
  if (segments[0] !== "catalog") {
    return true;
  }
  if (segments[2] !== "versions" || segments[3] === undefined) {
    return false;
  }
  try {
    assertImmutableAssetVersion(segments[3]);
    return true;
  } catch {
    return false;
  }
}
