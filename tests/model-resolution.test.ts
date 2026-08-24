import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import {
  MODEL_CANDIDATE_HARD_GATE_KINDS,
  MODEL_CONFIRMATION_VIEW_KINDS,
  MODEL_CONFIRMATION_VIEW_SIZE_PX,
  MODEL_MATCH_ASSURANCE_BANDS,
  MODEL_RANKER_EVIDENCE_MODES,
  MODEL_REQUEST_MAX_REVISION,
  MODEL_RESOLUTION_CONTRACT_VERSION,
  MODEL_RESOLUTION_STATES,
  STATIC_WORLD_V1_MODEL_POLICY,
} from "@plasius/asset-contracts";
import { describe, expect, it } from "vitest";
import {
  MODEL_MCP_CATALOG_CONFIRM_CAPABILITY,
  MODEL_MCP_CATALOG_REQUEST_CAPABILITY,
  MODEL_MCP_CATALOG_REVIEW_CAPABILITY,
  MODEL_MCP_EXTERNAL_HARVEST_FEATURE_FLAG_ID,
  MODEL_MCP_GENERATION_FEATURE_FLAG_ID,
  MODEL_MCP_PVOX_FEATURE_FLAG_ID,
  MODEL_MCP_PIPELINE_MANAGE_CAPABILITY,
  MODEL_MCP_PREVIEW_SIZE_PX,
  MODEL_MCP_RESOURCE_TEMPLATES,
  MODEL_MCP_SOURCE_MANAGE_CAPABILITY,
  MODEL_MCP_TOOL_NAMES,
  MODEL_MCP_UNIFIED_FEATURE_FLAG_ID,
  MODEL_MCP_PVOX_RESULT_CONTRACT,
  createResolveModelRequestIdempotencyFingerprint,
  createModelCandidateReviewToolResult,
  getModelMcpToolDefinition,
  isModelMcpResourceUri,
  listModelMcpResourceTemplates,
  listModelMcpToolDefinitions,
  normalizeModelCatalogSearchStructuredContent,
  normalizeModelMcpRefinementAnswers,
  normalizeModelMcpResolveRequestInput,
  normalizeModelMcpRequestSpec,
  normalizeModelResolutionStructuredContent,
  selectModelSearchRanker,
  type ModelMcpToolDefinition,
  type ModelSearchRankerDescriptor,
} from "../src/index.js";

const EXPECTED_TOOL_NAMES = [
  "list_model_search_rankers",
  "search_model_catalog",
  "resolve_model_request",
  "get_model_resolution",
  "confirm_model_candidate",
  "retry_model_resolution",
  "cancel_model_resolution",
  "rebuild_model_catalog_index",
] as const;

const CONTENT_HASH = "f".repeat(64);
const SOURCE_CONTENT_HASH = "e".repeat(64);
const PROCESSING_CLOSURE_HASH = "d".repeat(64);
const CONFIRMATION_TOKEN = "C".repeat(64);
const ORIGINAL_HASHES = ["1", "2", "3", "4"].map((value) => value.repeat(64));
const ajv = new Ajv2020({ allErrors: true, strict: true });

function compile(schema: Readonly<Record<string, unknown>>): ValidateFunction {
  return ajv.compile(schema);
}

function crc32(data: Buffer): number {
  let crc = 0xffff_ffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
}

function pngBytes(width = 512, height = 512, marker = 0): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  scanlines[1] = marker;
  scanlines[4] = 255;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const PREVIEW_BYTES = MODEL_CONFIRMATION_VIEW_KINDS.map((_, index) => pngBytes(512, 512, index + 1));
const PREVIEW_DATA = PREVIEW_BYTES.map((value) => value.toString("base64"));
const PREVIEW_HASHES = PREVIEW_BYTES.map((value) => createHash("sha256").update(value).digest("hex"));

function requestSpec(revision = 0, rankerId: string | undefined = "vision-ranker-v2") {
  return {
    contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
    policyProfileId: STATIC_WORLD_V1_MODEL_POLICY.id,
    query: "A weathered oak farmhouse table",
    revision,
    locale: "en-GB",
    ...(rankerId === undefined ? {} : { rankerId }),
    hardConstraints: {
      dimensionsMetres: { width: 2, height: 0.8, depth: 1 },
      maxTriangles: 80_000,
      maxBytes: 40_000_000,
      maxTextureBytes: 16_000_000,
      maxTextureDimensionPx: 4096,
      maxPartitionCellMetres: 32,
      lod: "required",
      collision: "required",
      partition: "allowed",
    },
    softPreferences: {
      category: "furniture",
      style: "rustic",
      materials: ["oak"],
      tags: ["farmhouse"],
    },
    exclusions: ["painted"],
  };
}

function ranker(): ModelSearchRankerDescriptor {
  return {
    rankerId: "vision-ranker-v2",
    evidenceMode: "vision",
    assuranceCeiling: "high",
    implementationVersion: "2.4.0",
    calibrationId: "model-match-golden",
    calibrationVersion: "2026-07-12",
    ready: true,
  };
}

function selectedRankerOutput() {
  return {
    status: "selected",
    selectionMode: "caller-exact",
    rankerId: "vision-ranker-v2",
    evidenceMode: "vision",
    assuranceCeiling: "high",
    implementationVersion: "2.4.0",
    calibrationId: "model-match-golden",
    calibrationVersion: "2026-07-12",
    ready: true,
    substituted: false,
  };
}

function assessment(assurance: "high" | "low" = "high") {
  return {
    score: assurance === "high" ? 0.91 : 0.65,
    assurance,
    hardConstraintPass: true,
    exactMatch: false,
    reasonCodes: assurance === "low"
      ? ["semantic-match", "fidelity-low-only"]
      : ["semantic-match"],
    ranker: {
      id: "vision-ranker-v2",
      version: "2.4.0",
      calibrationId: "model-match-golden",
      calibrationVersion: "2026-07-12",
      evidenceMode: "vision",
      assuranceCeiling: "high",
    },
    fidelityWarnings: assurance === "low" ? ["source-fidelity-requires-review"] : [],
    requestRevision: 0,
    candidateContentHash: CONTENT_HASH,
  };
}

function provenance() {
  return {
    kind: "catalog",
    sourceId: "plasius-catalog",
    sourceAssetId: "oak-table-v3",
    contentHash: SOURCE_CONTENT_HASH,
    capturedAt: "2026-07-13T09:00:00.000Z",
  };
}

function rights() {
  return {
    decisionId: "rights-decision-1",
    policyId: "catalog-rights-v1",
    policyVersion: "1.0.0",
    sourceId: "plasius-catalog",
    sourceAssetId: "oak-table-v3",
    sourceContentHash: SOURCE_CONTENT_HASH,
    status: "allowed",
    licenseId: "cc0-1.0",
    reviewedAt: "2026-07-13T09:05:00.000Z",
    attributionRequired: false,
  };
}

function technicalProfile() {
  return {
    boundsMetres: { min: [-1, 0, -0.5], max: [1, 0.8, 0.5] },
    dimensionsMetres: { width: 2, height: 0.8, depth: 1 },
    triangleCount: 80_000,
    byteLength: 4_000_000,
    textureByteLength: 1_000_000,
    maxTextureDimensionPx: 2048,
    lodCount: 3,
    hasCollision: true,
    partitionCount: 1,
    partitionCellMetres: 32,
  };
}

function hardGates() {
  return MODEL_CANDIDATE_HARD_GATE_KINDS.map((kind, index) => ({
    kind,
    outcome: "passed",
    validatorId: `validator-${index + 1}`,
    validatorVersion: "1.0.0",
    subjectContentHash: index === 0 ? SOURCE_CONTENT_HASH : PROCESSING_CLOSURE_HASH,
    evaluatedAt: "2026-07-13T09:10:00.000Z",
  }));
}

function evidence(assurance: "high" | "low" = "high") {
  return {
    assessment: assessment(assurance),
    provenance: provenance(),
    rights: rights(),
    technicalProfile: technicalProfile(),
    processingClosureHash: PROCESSING_CLOSURE_HASH,
    hardGates: hardGates(),
    fidelityGateOutcome: assurance === "low" ? "low-only" : "passed",
  };
}

function assetRef() {
  return {
    contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
    assetId: "oak-table",
    version: "v3",
    kind: "assembly",
    contentHash: CONTENT_HASH,
    runtimeManifestUri: "mcp://models/catalog/oak-table/versions/v3/manifest",
  };
}

function catalogMatch() {
  return {
    modelIdentifier: "oak-table-v3",
    asset: assetRef(),
    ...evidence(),
    reviewAvailable: true,
  };
}

function resolutionCandidate(assurance: "high" | "low" = "high") {
  return {
    resolutionId: "resolution-1",
    candidateId: "candidate-1",
    modelIdentifier: "oak-table-v3",
    assetRef: { disposition: "existing", asset: assetRef() },
    ...evidence(assurance),
    confirmationToken: CONFIRMATION_TOKEN,
  };
}

function reviewViews(subject: "catalog" | "resolution") {
  return MODEL_CONFIRMATION_VIEW_KINDS.map((kind, index) => ({
    kind,
    preview: {
      contentIndex: index,
      width: MODEL_MCP_PREVIEW_SIZE_PX,
      height: MODEL_MCP_PREVIEW_SIZE_PX,
      contentType: "image/png",
      sha256: PREVIEW_HASHES[index],
    },
    original: {
      uri: subject === "catalog"
        ? `mcp://models/catalog/oak-table/versions/v3/views/${kind}/original`
        : `mcp://models/resolutions/resolution-1/candidates/candidate-1/views/${kind}/original`,
      width: MODEL_CONFIRMATION_VIEW_SIZE_PX,
      height: MODEL_CONFIRMATION_VIEW_SIZE_PX,
      contentType: "image/png",
      sha256: ORIGINAL_HASHES[index],
    },
  }));
}

function catalogReview() {
  return {
    contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
    subject: {
      kind: "catalog",
      assetId: "oak-table",
      version: "v3",
      modelIdentifier: "oak-table-v3",
    },
    ...evidence(),
    reviewViews: reviewViews("catalog"),
  };
}

function resolutionReview(assurance: "high" | "low" = "high") {
  return {
    contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
    subject: {
      kind: "resolution-candidate",
      resolutionId: "resolution-1",
      candidateId: "candidate-1",
      modelIdentifier: "oak-table-v3",
      confirmationToken: CONFIRMATION_TOKEN,
    },
    ...evidence(assurance),
    reviewViews: reviewViews("resolution"),
  };
}

function catalogOutput(includeReview = true) {
  return {
    contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
    requestRevision: 0,
    rankerSelection: selectedRankerOutput(),
    matches: [catalogMatch()],
    ...(includeReview ? { review: catalogReview() } : {}),
  };
}

function resolutionOutput(
  state: "awaiting-confirmation" | "completed" = "awaiting-confirmation",
  assurance: "high" | "low" = "high",
) {
  return {
    resolution: {
      contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
      resolutionId: "resolution-1",
      requestRevision: 0,
      state,
      attempts: 1,
      bestCandidate: resolutionCandidate(assurance),
      refinementQuestions: assurance === "low"
        ? [{ questionId: "style", prompt: "Should the style be more rustic?" }]
        : [],
      ...(state === "completed" ? { finalAssetRef: assetRef() } : {}),
    },
    review: resolutionReview(assurance),
  };
}

function images() {
  return MODEL_CONFIRMATION_VIEW_KINDS.map((kind, index) => ({
    kind,
    data: PREVIEW_DATA[index],
    mimeType: "image/png",
    width: MODEL_MCP_PREVIEW_SIZE_PX,
    height: MODEL_MCP_PREVIEW_SIZE_PX,
  }));
}

function validInputs(): Record<(typeof EXPECTED_TOOL_NAMES)[number], unknown> {
  return {
    list_model_search_rankers: {},
    search_model_catalog: { request: requestSpec(), limit: 5 },
    resolve_model_request: { request: requestSpec(), idempotencyKey: "resolve-request-1" },
    get_model_resolution: { resolutionId: "resolution~1" },
    confirm_model_candidate: {
      resolutionId: "resolution-1",
      candidateId: "candidate-1",
      confirmationToken: CONFIRMATION_TOKEN,
      viewSha256s: ORIGINAL_HASHES,
      semanticRiskAccepted: false,
      idempotencyKey: "confirmation-1",
    },
    retry_model_resolution: {
      resolutionId: "resolution-1",
      refinementAnswers: [{ questionId: "style", answer: "More rustic" }],
      excludedCandidateIds: ["candidate~old"],
      idempotencyKey: "retry-1",
    },
    cancel_model_resolution: {
      resolutionId: "resolution-1",
      reasonCode: "requester-cancelled",
      idempotencyKey: "cancel-1",
    },
    rebuild_model_catalog_index: { mode: "repair", idempotencyKey: "index-repair-1" },
  };
}

function uploadedSourceInput(downloadUrl = "https://files.openaiusercontent.com/file-demo?token=temporary") {
  return {
    request: requestSpec(),
    idempotencyKey: "resolve-upload-1",
    sourceFile: {
      download_url: downloadUrl,
      file_id: "file-demo-1",
      mime_type: "model/gltf-binary",
      file_name: "oak-table.glb",
    },
    rightsAttestation: {
      basis: "requester-owned",
      publicDemoRedistributionAllowed: true,
      derivativeWorksAllowed: true,
      commercialUseAllowed: true,
      licenseId: "LicenseRef-Plasius-Demo",
      attribution: {
        modelTitle: "Oak table",
        creator: "Example creator",
        notice: "Used with the creator's permission.",
        publicSourceUrl: "https://example.com/models/oak-table",
        publicLicenseUrl: "https://example.com/licenses/demo",
      },
    },
  };
}

function validOutputs(): Record<(typeof EXPECTED_TOOL_NAMES)[number], unknown> {
  return {
    list_model_search_rankers: {
      rankers: [ranker()],
      selectionPolicy: { exactCallerSelection: true, substitutionAllowed: false },
    },
    search_model_catalog: catalogOutput(),
    resolve_model_request: resolutionOutput(),
    get_model_resolution: resolutionOutput(),
    confirm_model_candidate: resolutionOutput("completed"),
    retry_model_resolution: resolutionOutput(),
    cancel_model_resolution: {
      resolution: {
        contractVersion: MODEL_RESOLUTION_CONTRACT_VERSION,
        resolutionId: "resolution-1",
        requestRevision: 0,
        state: "cancelled",
        attempts: 1,
        refinementQuestions: [],
        stateReasonCode: "requester-cancelled",
      },
    },
    rebuild_model_catalog_index: {
      operationId: "index-operation-1",
      mode: "repair",
      state: "accepted",
      idempotentReplay: false,
    },
  };
}

function definition(name: (typeof EXPECTED_TOOL_NAMES)[number]): ModelMcpToolDefinition {
  const found = listModelMcpToolDefinitions().find((tool) => tool.name === name);
  if (!found) throw new Error(`Missing tool definition for ${name}.`);
  return found;
}

describe("canonical model-resolution MCP contracts", () => {
  it("exports all eight canonical names exactly once without changing the legacy family", () => {
    expect(MODEL_MCP_TOOL_NAMES).toEqual(EXPECTED_TOOL_NAMES);
    expect(new Set(MODEL_MCP_TOOL_NAMES).size).toBe(8);
    expect(listModelMcpToolDefinitions().map((tool) => tool.name)).toEqual(EXPECTED_TOOL_NAMES);
    expect(getModelMcpToolDefinition("search_model_catalog")?.name).toBe("search_model_catalog");
    expect(getModelMcpToolDefinition("asset.get_manifest")).toBeUndefined();
    expect(getModelMcpToolDefinition(null)).toBeUndefined();
    expect(Object.isFrozen(MODEL_MCP_TOOL_NAMES)).toBe(true);
    expect(Object.isFrozen(listModelMcpToolDefinitions())).toBe(true);
  });

  it("publishes exact scopes, capabilities, rollout flags, and MCP annotations", () => {
    const tools = Object.fromEntries(listModelMcpToolDefinitions().map((tool) => [tool.name, tool]));
    for (const name of [
      "list_model_search_rankers",
      "search_model_catalog",
      "resolve_model_request",
      "get_model_resolution",
      "retry_model_resolution",
      "cancel_model_resolution",
    ] as const) {
      expect(tools[name]?.requiredOAuthScopes).toEqual(["mcp:access", MODEL_MCP_CATALOG_REQUEST_CAPABILITY]);
      expect(tools[name]?.requiredCapability).toBe(MODEL_MCP_CATALOG_REQUEST_CAPABILITY);
    }
    expect(tools.confirm_model_candidate?.requiredOAuthScopes).toEqual([
      "mcp:access",
      MODEL_MCP_CATALOG_CONFIRM_CAPABILITY,
    ]);
    expect(tools.rebuild_model_catalog_index?.requiredOAuthScopes).toEqual([
      "mcp:access",
      MODEL_MCP_PIPELINE_MANAGE_CAPABILITY,
    ]);
    expect(MODEL_MCP_CATALOG_REVIEW_CAPABILITY).toBe("asset.catalog.review");
    expect(MODEL_MCP_SOURCE_MANAGE_CAPABILITY).toBe("asset.source.manage");
    for (const tool of Object.values(tools)) {
      expect(tool.featureFlags[0]).toBe(MODEL_MCP_UNIFIED_FEATURE_FLAG_ID);
      expect(tool.securitySchemes).toEqual([{ type: "oauth2", scopes: tool.requiredOAuthScopes }]);
      expect(tool._meta.securitySchemes).toEqual(tool.securitySchemes);
      expect(tool._meta["plasius/requiredCapability"]).toBe(tool.requiredCapability);
      expect(tool.rollout.requiredFeatureFlag).toBe(MODEL_MCP_UNIFIED_FEATURE_FLAG_ID);
    }
    expect(tools.resolve_model_request?.featureFlags).toEqual([
      MODEL_MCP_UNIFIED_FEATURE_FLAG_ID,
      MODEL_MCP_PVOX_FEATURE_FLAG_ID,
      MODEL_MCP_EXTERNAL_HARVEST_FEATURE_FLAG_ID,
      MODEL_MCP_GENERATION_FEATURE_FLAG_ID,
    ]);
    expect(tools.confirm_model_candidate?.featureFlags).toEqual([
      MODEL_MCP_UNIFIED_FEATURE_FLAG_ID,
      MODEL_MCP_PVOX_FEATURE_FLAG_ID,
    ]);
    expect(tools.resolve_model_request?._meta["openai/fileParams"]).toEqual(["sourceFile"]);
    expect(tools.resolve_model_request?._meta["plasius/pvoxResultContract"]).toEqual(
      MODEL_MCP_PVOX_RESULT_CONTRACT,
    );
    expect(tools.resolve_model_request?._meta["plasius/pvoxResultContract"]?.resolutionStates).toContain(
      "voxelizing",
    );
    expect(tools.get_model_resolution?._meta["openai/fileParams"]).toBeUndefined();
    expect(tools.retry_model_resolution?.rollout.conditionalFeatureFlags).toEqual([
      MODEL_MCP_PVOX_FEATURE_FLAG_ID,
      MODEL_MCP_EXTERNAL_HARVEST_FEATURE_FLAG_ID,
      MODEL_MCP_GENERATION_FEATURE_FLAG_ID,
    ]);
    expect(tools.search_model_catalog?.reviewResult).toMatchObject({
      inlineImageCount: 4,
      maximumInlineReviewSubjects: 1,
      viewOrder: ["front", "left", "top", "isometric"],
      previewSizePx: 512,
      originalSizePx: 1024,
      mimeType: "image/png",
    });
    expect(tools.search_model_catalog?.reviewResult?.originalResourceTemplates).toHaveLength(2);
    expect(tools.search_model_catalog?.reviewResult?.originalResourceTemplate).toBe(
      "mcp://models/catalog/{assetId}/versions/{version}/views/{viewKind}/original",
    );
    expect(tools.get_model_resolution?.reviewResult?.originalResourceTemplate).toBe(
      "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/views/{viewKind}/original",
    );
    expect(tools.list_model_search_rankers?.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(tools.resolve_model_request?.annotations.openWorldHint).toBe(true);
    expect(tools.retry_model_resolution?.annotations.openWorldHint).toBe(true);
    expect(tools.cancel_model_resolution?.annotations.destructiveHint).toBe(true);
    expect(tools.rebuild_model_catalog_index?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });

  it("compiles every draft-2020 schema and accepts canonical inputs and outputs", () => {
    const inputs = validInputs();
    const outputs = validOutputs();
    for (const name of EXPECTED_TOOL_NAMES) {
      const tool = definition(name);
      expect(tool.inputSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(tool.outputSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      const validateInput = compile(tool.inputSchema);
      const validateOutput = compile(tool.outputSchema);
      expect(validateInput(inputs[name]), `${name} input: ${ajv.errorsText(validateInput.errors)}`).toBe(true);
      expect(validateOutput(outputs[name]), `${name} output: ${ajv.errorsText(validateOutput.errors)}`).toBe(true);
    }
    expect(normalizeModelMcpRequestSpec(requestSpec())).toMatchObject({
      query: requestSpec().query,
      revision: 0,
      locale: "en-GB",
    });
  });

  it("accepts the official ChatGPT file object only with a bounded public-demo rights attestation", () => {
    const resolveTool = definition("resolve_model_request");
    const validate = compile(resolveTool.inputSchema);
    const valid = uploadedSourceInput();

    expect(validate(valid), ajv.errorsText(validate.errors)).toBe(true);
    const normalized = normalizeModelMcpResolveRequestInput(valid);
    expect(normalized).toMatchObject({
      idempotencyKey: "resolve-upload-1",
      sourceFile: { file_id: "file-demo-1", file_name: "oak-table.glb" },
      rightsAttestation: { basis: "requester-owned" },
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(Object.isFrozen(normalized.sourceFile)).toBe(true);
    expect(Object.isFrozen(normalized.rightsAttestation?.attribution)).toBe(true);
    expect((resolveTool.inputSchema.properties as Record<string, unknown>).sourceFile).toMatchObject({
      type: "object",
      required: ["download_url", "file_id"],
      additionalProperties: false,
      properties: {
        download_url: expect.any(Object),
        file_id: expect.any(Object),
        mime_type: expect.any(Object),
        file_name: expect.any(Object),
      },
    });

    for (const invalid of [
      { ...valid, sourceFile: { ...valid.sourceFile, download_url: undefined } },
      { ...valid, sourceFile: { ...valid.sourceFile, file_id: undefined } },
      { ...valid, sourceFile: { ...valid.sourceFile, unexpected: true } },
      { ...valid, sourceFile: { ...valid.sourceFile, download_url: "http://files.example/model.glb" } },
      { ...valid, sourceFile: { ...valid.sourceFile, file_name: "../model.glb" } },
      { request: valid.request, idempotencyKey: valid.idempotencyKey, sourceFile: valid.sourceFile },
      { request: valid.request, idempotencyKey: valid.idempotencyKey, rightsAttestation: valid.rightsAttestation },
      {
        ...valid,
        rightsAttestation: {
          ...valid.rightsAttestation,
          publicDemoRedistributionAllowed: false,
        },
      },
      {
        ...valid,
        rightsAttestation: {
          ...valid.rightsAttestation,
          unexpected: true,
        },
      },
    ]) {
      expect(validate(invalid), JSON.stringify(invalid)).toBe(false);
      expect(() => normalizeModelMcpResolveRequestInput(invalid)).toThrow();
    }
    expect(() => normalizeModelMcpResolveRequestInput(null)).toThrow(/plain object/i);
    expect(() => normalizeModelMcpResolveRequestInput({ ...valid, unexpected: true })).toThrow(/unsupported/i);

    const localOnly = normalizeModelMcpResolveRequestInput({
      request: valid.request,
      idempotencyKey: "resolve-local-1",
    });
    expect(localOnly.sourceFile).toBeUndefined();
    expect(normalizeModelMcpResolveRequestInput({
      ...valid,
      sourceFile: {
        download_url: "https://files.openaiusercontent.com/file-minimal",
        file_id: "file-minimal",
      },
      rightsAttestation: {
        basis: "public-domain",
        publicDemoRedistributionAllowed: true,
        derivativeWorksAllowed: true,
        commercialUseAllowed: true,
      },
    }).sourceFile).toEqual({
      download_url: "https://files.openaiusercontent.com/file-minimal",
      file_id: "file-minimal",
    });

    for (const invalid of [
      { ...valid, idempotencyKey: "../invalid" },
      { ...valid, sourceFile: null },
      { ...valid, sourceFile: { ...valid.sourceFile, download_url: "https://" } },
      { ...valid, sourceFile: { ...valid.sourceFile, download_url: "https://example.com/model\n" } },
      { ...valid, sourceFile: { ...valid.sourceFile, download_url: "https://user:secret@example.com/model" } },
      { ...valid, sourceFile: { ...valid.sourceFile, file_id: "   " } },
      { ...valid, sourceFile: { ...valid.sourceFile, mime_type: 42 } },
      { ...valid, sourceFile: { ...valid.sourceFile, mime_type: "not-a-media-type" } },
      { ...valid, sourceFile: { ...valid.sourceFile, file_name: "." } },
      { ...valid, rightsAttestation: null },
      { ...valid, rightsAttestation: { ...valid.rightsAttestation, basis: "unknown" } },
      { ...valid, rightsAttestation: { ...valid.rightsAttestation, licenseId: "../license" } },
      { ...valid, rightsAttestation: { ...valid.rightsAttestation, attribution: {} } },
      {
        ...valid,
        rightsAttestation: {
          ...valid.rightsAttestation,
          attribution: { ...valid.rightsAttestation.attribution, unexpected: true },
        },
      },
      {
        ...valid,
        rightsAttestation: {
          ...valid.rightsAttestation,
          attribution: { modelTitle: "https://private.example/model" },
        },
      },
      {
        ...valid,
        rightsAttestation: {
          ...valid.rightsAttestation,
          attribution: { publicSourceUrl: "http://example.com/model" },
        },
      },
    ]) expect(() => normalizeModelMcpResolveRequestInput(invalid), JSON.stringify(invalid)).toThrow();
  });

  it("fingerprints uploaded resolutions without binding the expiring download URL", () => {
    const base = {
      requesterId: "requester:demo-1",
      ...uploadedSourceInput("https://files.openaiusercontent.com/file-demo?token=first"),
    };
    const fingerprint = createResolveModelRequestIdempotencyFingerprint(base);

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(createResolveModelRequestIdempotencyFingerprint({
      ...base,
      sourceFile: {
        ...base.sourceFile,
        download_url: "https://files.openaiusercontent.com/file-demo?token=second",
        mime_type: "application/octet-stream",
        file_name: "renamed.glb",
      },
    })).toBe(fingerprint);
    expect(createResolveModelRequestIdempotencyFingerprint({
      ...base,
      request: {
        exclusions: base.request.exclusions,
        softPreferences: base.request.softPreferences,
        hardConstraints: base.request.hardConstraints,
        rankerId: base.request.rankerId,
        locale: base.request.locale,
        revision: base.request.revision,
        query: base.request.query,
        policyProfileId: base.request.policyProfileId,
        contractVersion: base.request.contractVersion,
      },
    })).toBe(fingerprint);
    expect(createResolveModelRequestIdempotencyFingerprint({
      ...base,
      sourceFile: { ...base.sourceFile, file_id: "file-demo-2" },
    })).not.toBe(fingerprint);
    expect(createResolveModelRequestIdempotencyFingerprint({
      ...base,
      requesterId: "requester:demo-2",
    })).not.toBe(fingerprint);
    expect(createResolveModelRequestIdempotencyFingerprint({
      ...base,
      idempotencyKey: "resolve-upload-2",
    })).not.toBe(fingerprint);
    expect(createResolveModelRequestIdempotencyFingerprint({
      ...base,
      request: { ...base.request, query: "A modern oak table" },
    })).not.toBe(fingerprint);
    expect(createResolveModelRequestIdempotencyFingerprint({
      ...base,
      rightsAttestation: { ...base.rightsAttestation, licenseId: "CC0-1.0" },
    })).not.toBe(fingerprint);
    expect(() => createResolveModelRequestIdempotencyFingerprint({
      ...base,
      sourceFile: { ...base.sourceFile, download_url: "http://private.example/model.glb" },
    })).toThrow(/HTTPS/i);
    expect(() => createResolveModelRequestIdempotencyFingerprint(null)).toThrow(/plain object/i);
    expect(() => createResolveModelRequestIdempotencyFingerprint({
      ...base,
      unexpected: true,
    })).toThrow(/unsupported/i);
    expect(() => createResolveModelRequestIdempotencyFingerprint({
      ...base,
      requesterId: "https://identity.example/requester",
    })).toThrow(/requesterId/i);
    expect(createResolveModelRequestIdempotencyFingerprint({
      requesterId: "requester:demo-1",
      request: base.request,
      idempotencyKey: "resolve-local-1",
    })).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("matches released request, identifier, token, and attempt boundaries", () => {
    const validateSearch = compile(definition("search_model_catalog").inputSchema);
    expect(validateSearch({ request: requestSpec(0) })).toBe(true);
    expect(validateSearch({ request: requestSpec(MODEL_REQUEST_MAX_REVISION) })).toBe(true);
    expect(validateSearch({ request: requestSpec(-1) })).toBe(false);
    expect(validateSearch({ request: requestSpec(MODEL_REQUEST_MAX_REVISION + 1) })).toBe(false);
    expect(validateSearch({ request: { ...requestSpec(), query: "x".repeat(512) } })).toBe(true);
    expect(validateSearch({ request: { ...requestSpec(), query: "x".repeat(513) } })).toBe(false);
    expect(validateSearch({ request: { ...requestSpec(), query: "   " } })).toBe(false);
    expect(validateSearch({ request: { ...requestSpec(), query: "https://provider.example/model" } })).toBe(false);
    expect(validateSearch({ request: { ...requestSpec(), query: "HTTPS://provider.example/model" } })).toBe(false);
    expect(validateSearch({ request: { ...requestSpec(), query: "WWW.provider.example/model" } })).toBe(false);
    expect(validateSearch({ request: { ...requestSpec(), locale: "zh-Hant-TW" } })).toBe(true);
    for (const locale of ["en_GB", "en--GB", "1", "a", "en-a", "en-GB-GB"]) {
      expect(validateSearch({ request: { ...requestSpec(), locale } })).toBe(false);
    }
    expect(validateSearch({ request: { ...requestSpec(), locale: "x".repeat(65) } })).toBe(false);
    expect(validateSearch({ request: requestSpec(0, `r${"a".repeat(127)}`) })).toBe(true);
    expect(validateSearch({ request: requestSpec(0, `r${"a".repeat(128)}`) })).toBe(false);
    expect(validateSearch({ request: {
      ...requestSpec(),
      hardConstraints: { ...requestSpec().hardConstraints, maxPartitionCellMetres: Number.EPSILON },
    } })).toBe(true);
    expect(validateSearch({ request: {
      ...requestSpec(),
      hardConstraints: { ...requestSpec().hardConstraints, maxPartitionCellMetres: Number.EPSILON / 2 },
    } })).toBe(false);
    expect(validateSearch({ request: {
      ...requestSpec(),
      softPreferences: { ...requestSpec().softPreferences, style: "s".repeat(80) },
    } })).toBe(true);
    expect(validateSearch({ request: {
      ...requestSpec(),
      softPreferences: { ...requestSpec().softPreferences, style: "s".repeat(81) },
    } })).toBe(false);
    expect(validateSearch({ request: { ...requestSpec(), exclusions: ["x".repeat(128)] } })).toBe(true);
    expect(validateSearch({ request: { ...requestSpec(), exclusions: ["x".repeat(129)] } })).toBe(false);
    expect(() => normalizeModelMcpRequestSpec({
      ...requestSpec(),
      hardConstraints: {
        ...requestSpec().hardConstraints,
        boundsMetres: { min: [1, 0, 0], max: [0, 1, 1] },
      },
    })).toThrow(/bounds|lower/i);
    expect(() => normalizeModelMcpRequestSpec({
      ...requestSpec(),
      hardConstraints: {
        ...requestSpec().hardConstraints,
        maxBytes: 100,
        maxTextureBytes: 101,
      },
    })).toThrow(/maxTextureBytes/i);
    expect(() => normalizeModelMcpRequestSpec({
      ...requestSpec(),
      softPreferences: { ...requestSpec().softPreferences, materials: ["Oak", "oak"] },
    })).toThrow(/duplicate/i);

    const validateConfirm = compile(definition("confirm_model_candidate").inputSchema);
    const confirm = validInputs().confirm_model_candidate as Record<string, unknown>;
    expect(validateConfirm({ ...confirm, confirmationToken: "A".repeat(32) })).toBe(true);
    expect(validateConfirm({ ...confirm, confirmationToken: "A".repeat(256) })).toBe(true);
    expect(validateConfirm({ ...confirm, confirmationToken: "A".repeat(31) })).toBe(false);
    expect(validateConfirm({ ...confirm, confirmationToken: "A".repeat(257) })).toBe(false);
    expect(validateConfirm({ ...confirm, confirmationToken: `${"A".repeat(31)}:` })).toBe(false);

    const validateGet = compile(definition("get_model_resolution").inputSchema);
    expect(validateGet({ resolutionId: "resolution~1" })).toBe(true);
    expect(validateGet({ resolutionId: `r${"a".repeat(127)}` })).toBe(true);
    expect(validateGet({ resolutionId: `r${"a".repeat(128)}` })).toBe(false);
    expect(validateGet({ resolutionId: "resolution:1" })).toBe(false);
    expect(validateGet({ resolutionId: ".." })).toBe(false);

    const validateCatalog = compile(definition("search_model_catalog").outputSchema);
    const assetBoundary = catalogOutput(false);
    assetBoundary.matches[0]!.asset.assetId = "a".repeat(128);
    assetBoundary.matches[0]!.asset.runtimeManifestUri =
      `mcp://models/catalog/${"a".repeat(128)}/versions/v3/manifest`;
    expect(validateCatalog(assetBoundary)).toBe(true);
    const assetTooLong = structuredClone(assetBoundary);
    assetTooLong.matches[0]!.asset.assetId = "a".repeat(129);
    assetTooLong.matches[0]!.asset.runtimeManifestUri =
      `mcp://models/catalog/${"a".repeat(129)}/versions/v3/manifest`;
    expect(validateCatalog(assetTooLong)).toBe(false);
    const invalidAssetCase = catalogOutput(false);
    invalidAssetCase.matches[0]!.asset.assetId = "Oak-table";
    invalidAssetCase.matches[0]!.asset.runtimeManifestUri =
      "mcp://models/catalog/Oak-table/versions/v3/manifest";
    expect(validateCatalog(invalidAssetCase)).toBe(false);
    const invalidAssetKebab = catalogOutput(false);
    invalidAssetKebab.matches[0]!.asset.assetId = "oak--table";
    invalidAssetKebab.matches[0]!.asset.runtimeManifestUri =
      "mcp://models/catalog/oak--table/versions/v3/manifest";
    expect(validateCatalog(invalidAssetKebab)).toBe(false);
    const versionBoundary = catalogOutput(false);
    versionBoundary.matches[0]!.asset.version = `v${"1".repeat(127)}`;
    versionBoundary.matches[0]!.asset.runtimeManifestUri =
      `mcp://models/catalog/oak-table/versions/v${"1".repeat(127)}/manifest`;
    expect(validateCatalog(versionBoundary)).toBe(true);
    const versionTooLong = structuredClone(versionBoundary);
    versionTooLong.matches[0]!.asset.version = `v${"1".repeat(128)}`;
    versionTooLong.matches[0]!.asset.runtimeManifestUri =
      `mcp://models/catalog/oak-table/versions/v${"1".repeat(128)}/manifest`;
    expect(validateCatalog(versionTooLong)).toBe(false);
    for (const version of ["v:3", "v~3"]) {
      const invalidVersion = catalogOutput(false);
      invalidVersion.matches[0]!.asset.version = version;
      invalidVersion.matches[0]!.asset.runtimeManifestUri =
        `mcp://models/catalog/oak-table/versions/${version}/manifest`;
      expect(validateCatalog(invalidVersion)).toBe(false);
    }
    const proposedCandidate = resolutionOutput();
    (proposedCandidate.resolution.bestCandidate as unknown as Record<string, unknown>).assetRef = {
      disposition: "proposed",
      proposalId: "proposal:1",
      kind: "assembly",
      contentHash: CONTENT_HASH,
    };
    expect(compile(definition("get_model_resolution").outputSchema)(proposedCandidate)).toBe(true);
    ((proposedCandidate.resolution.bestCandidate as unknown as Record<string, unknown>)
      .assetRef as Record<string, unknown>).proposalId = "proposal~1";
    expect(compile(definition("get_model_resolution").outputSchema)(proposedCandidate)).toBe(false);

    const validateResolution = compile(definition("get_model_resolution").outputSchema);
    for (const attempts of [1, 100]) {
      const output = resolutionOutput();
      output.resolution.attempts = attempts;
      expect(validateResolution(output)).toBe(true);
    }
    for (const attempts of [0, 101]) {
      const output = resolutionOutput();
      output.resolution.attempts = attempts;
      expect(validateResolution(output)).toBe(false);
    }
  });

  it("rejects malformed JavaScript, unsafe references, and impossible lifecycle projections", () => {
    const invalidInputs: Record<(typeof EXPECTED_TOOL_NAMES)[number], unknown[]> = {
      list_model_search_rankers: [null, [], { unexpected: true }],
      search_model_catalog: [
        { request: { ...requestSpec(), rankerId: "../ranker" } },
        { request: { ...requestSpec(), query: "oak\u0000secret" } },
        { request: requestSpec(), limit: 21 },
      ],
      resolve_model_request: [
        { request: requestSpec(), idempotencyKey: "https://unsafe.example/key" },
      ],
      get_model_resolution: [{ resolutionId: "../private" }, { resolutionId: 4 }],
      confirm_model_candidate: [
        { ...validInputs().confirm_model_candidate as object, viewSha256s: ORIGINAL_HASHES.slice(0, 3) },
      ],
      retry_model_resolution: [
        {
          ...validInputs().retry_model_resolution as object,
          refinementAnswers: [1, 2, 3, 4].map((value) => ({ questionId: `q-${value}`, answer: "answer" })),
        },
        { ...validInputs().retry_model_resolution as object, excludedCandidateIds: ["candidate:old"] },
      ],
      cancel_model_resolution: [
        { ...validInputs().cancel_model_resolution as object, reasonCode: "spaces are invalid" },
        { ...validInputs().cancel_model_resolution as object, unexpected: true },
      ],
      rebuild_model_catalog_index: [
        { mode: "delete", idempotencyKey: "index-1" },
        { mode: "repair", idempotencyKey: "../index-1" },
      ],
    };
    for (const name of EXPECTED_TOOL_NAMES) {
      const validate = compile(definition(name).inputSchema);
      for (const input of invalidInputs[name]) expect(validate(input)).toBe(false);
    }

    const validateResolution = compile(definition("get_model_resolution").outputSchema);
    const missingBest = resolutionOutput();
    delete (missingBest.resolution as Partial<typeof missingBest.resolution>).bestCandidate;
    expect(validateResolution(missingBest)).toBe(false);
    const completedWithoutAsset = resolutionOutput("completed");
    delete (completedWithoutAsset.resolution as Partial<typeof completedWithoutAsset.resolution>).finalAssetRef;
    expect(validateResolution(completedWithoutAsset)).toBe(false);
    const failedWithoutReason = resolutionOutput();
    (failedWithoutReason.resolution as Record<string, unknown>).state = "failed";
    expect(validateResolution(failedWithoutReason)).toBe(false);
    const prematureAsset = resolutionOutput();
    (prematureAsset.resolution as Record<string, unknown>).finalAssetRef = assetRef();
    expect(validateResolution(prematureAsset)).toBe(false);
    const missingAwaitingReview = resolutionOutput();
    delete (missingAwaitingReview as Partial<typeof missingAwaitingReview>).review;
    expect(validateResolution(missingAwaitingReview)).toBe(false);
    const lowWithoutQuestion = resolutionOutput("awaiting-confirmation", "low");
    lowWithoutQuestion.resolution.refinementQuestions = [];
    expect(validateResolution(lowWithoutQuestion)).toBe(false);
    expect(validateResolution(resolutionOutput("awaiting-confirmation", "low"))).toBe(true);
  });

  it("uses non-confirmable search matches and rejects impossible assurance claims", () => {
    const validate = compile(definition("search_model_catalog").outputSchema);
    expect(validate(catalogOutput(false))).toBe(true);
    const withToken = structuredClone(catalogOutput());
    (withToken.matches[0] as Record<string, unknown>).confirmationToken = CONFIRMATION_TOKEN;
    expect(validate(withToken)).toBe(false);
    const wrongReviewSubject = structuredClone(catalogOutput());
    (wrongReviewSubject.review as Record<string, unknown>).subject = resolutionReview().subject;
    expect(validate(wrongReviewSubject)).toBe(false);
    const impossibleScore = structuredClone(catalogOutput());
    impossibleScore.matches[0]!.assessment.score = 0.1;
    expect(validate(impossibleScore)).toBe(false);
    const failedHardGate = structuredClone(catalogOutput());
    failedHardGate.matches[0]!.assessment.hardConstraintPass = false;
    expect(validate(failedHardGate)).toBe(false);
    const invalidTextHigh = structuredClone(catalogOutput());
    invalidTextHigh.matches[0]!.assessment.ranker.evidenceMode = "text-only";
    expect(validate(invalidTextHigh)).toBe(false);
    const lowOnlyHigh = structuredClone(catalogOutput());
    lowOnlyHigh.matches[0]!.fidelityGateOutcome = "low-only";
    expect(validate(lowOnlyHigh)).toBe(false);
    const unavailableWithMatches = structuredClone(catalogOutput(false));
    (unavailableWithMatches as unknown as Record<string, unknown>).rankerSelection = {
      status: "unavailable",
      requestedRankerId: "vision-ranker-v2",
      reasonCode: "ranker-not-ready",
      substituted: false,
    };
    expect(validate(unavailableWithMatches)).toBe(false);
    unavailableWithMatches.matches = [];
    expect(validate(unavailableWithMatches)).toBe(true);
    const tooMany = structuredClone(catalogOutput(false));
    tooMany.matches = Array.from({ length: 6 }, () => catalogMatch());
    expect(validate(tooMany)).toBe(false);

    const validateResolution = compile(definition("get_model_resolution").outputSchema);
    const impossibleResolutionFidelity = resolutionOutput();
    impossibleResolutionFidelity.resolution.bestCandidate.fidelityGateOutcome = "low-only";
    impossibleResolutionFidelity.review.fidelityGateOutcome = "low-only";
    expect(validateResolution(impossibleResolutionFidelity)).toBe(false);
    const lowWithoutFidelityEvidence = resolutionOutput("awaiting-confirmation", "low");
    lowWithoutFidelityEvidence.resolution.bestCandidate.assessment.reasonCodes = ["semantic-match"];
    lowWithoutFidelityEvidence.resolution.bestCandidate.assessment.fidelityWarnings = [];
    lowWithoutFidelityEvidence.review.assessment.reasonCodes = ["semantic-match"];
    lowWithoutFidelityEvidence.review.assessment.fidelityWarnings = [];
    expect(validateResolution(lowWithoutFidelityEvidence)).toBe(false);

    const ceilingCapped = catalogOutput(false);
    ceilingCapped.rankerSelection.evidenceMode = "text-only";
    ceilingCapped.rankerSelection.assuranceCeiling = "low";
    ceilingCapped.matches[0]!.assessment = {
      ...assessment("low"),
      score: 0.9,
      ranker: {
        ...assessment("low").ranker,
        evidenceMode: "text-only",
        assuranceCeiling: "low",
      },
      reasonCodes: ["semantic-match"],
      fidelityWarnings: [],
    };
    ceilingCapped.matches[0]!.fidelityGateOutcome = "passed";
    expect(validate(ceilingCapped)).toBe(false);
    ceilingCapped.matches[0]!.assessment.reasonCodes.push("text-only-assurance-ceiling");
    expect(validate(ceilingCapped)).toBe(true);
  });

  it("publishes released enums and stable refinement question IDs", () => {
    const rankerText = JSON.stringify(definition("list_model_search_rankers").outputSchema);
    const resolutionText = JSON.stringify(definition("get_model_resolution").outputSchema);
    expect(rankerText).toContain(JSON.stringify(MODEL_RANKER_EVIDENCE_MODES));
    expect(rankerText).toContain(JSON.stringify(MODEL_MATCH_ASSURANCE_BANDS));
    expect(resolutionText).toContain(JSON.stringify(MODEL_RESOLUTION_STATES));
    const withQuestion = resolutionOutput();
    (withQuestion.resolution as Record<string, unknown>).refinementQuestions = [
      { questionId: "style", prompt: "Which style?" },
    ];
    expect(compile(definition("get_model_resolution").outputSchema)(withQuestion)).toBe(true);
    expect(normalizeModelMcpRefinementAnswers([
      { questionId: "style", answer: "More rustic" },
    ])).toEqual([{ questionId: "style", answer: "More rustic" }]);
    expect(() => normalizeModelMcpRefinementAnswers([
      { questionId: "style", answer: "More rustic" },
      { questionId: "style", answer: "Less rustic" },
    ])).toThrow(/unique/i);
    expect(MODEL_CONFIRMATION_VIEW_KINDS).toEqual(["front", "left", "top", "isometric"]);
  });
});

describe("exact ranker selection", () => {
  it("returns one schema-compatible exact selected identity", () => {
    const selected = selectModelSearchRanker("vision-ranker-v2", [
      ranker(),
      { ...ranker(), rankerId: "text-ranker-v1", evidenceMode: "text-only", assuranceCeiling: "low" },
    ]);
    expect(selected).toEqual(selectedRankerOutput());
    expect(Object.isFrozen(selected)).toBe(true);
    const output = { ...catalogOutput(false), rankerSelection: selected };
    expect(compile(definition("search_model_catalog").outputSchema)(output)).toBe(true);
    const validateList = compile(definition("list_model_search_rankers").outputSchema);
    expect(validateList({
      rankers: [{ ...ranker(), unavailabilityReasonCode: "should-not-exist" }],
      selectionPolicy: { exactCallerSelection: true, substitutionAllowed: false },
    })).toBe(false);
    expect(validateList({
      rankers: [{ ...ranker(), ready: false }],
      selectionPolicy: { exactCallerSelection: true, substitutionAllowed: false },
    })).toBe(false);
  });

  it("reports unavailable without substituting another ready ranker", () => {
    expect(selectModelSearchRanker("vision-ranker-v2", [
      { ...ranker(), ready: false, unavailabilityReasonCode: "calibration-expired" },
      { ...ranker(), rankerId: "other-ready-ranker" },
    ])).toEqual({
      status: "unavailable",
      requestedRankerId: "vision-ranker-v2",
      reasonCode: "calibration-expired",
      substituted: false,
    });
    expect(selectModelSearchRanker("missing-ranker", [ranker()])).toEqual({
      status: "unavailable",
      requestedRankerId: "missing-ranker",
      reasonCode: "ranker-not-registered",
      substituted: false,
    });
  });

  it("fails closed for text-only high, malformed, duplicate, and accessor registrations", () => {
    expect(() => selectModelSearchRanker("text", [{
      ...ranker(), rankerId: "text", evidenceMode: "text-only", assuranceCeiling: "high",
    }])).toThrow(/text-only/i);
    expect(() => selectModelSearchRanker("../ranker", [ranker()])).toThrow(/rankerId/i);
    expect(() => selectModelSearchRanker("vision-ranker-v2", null)).toThrow(/array/i);
    expect(() => selectModelSearchRanker("vision-ranker-v2", [null])).toThrow(/plain object/i);
    expect(() => selectModelSearchRanker("vision-ranker-v2", [ranker(), ranker()])).toThrow(/duplicate/i);
    expect(() => selectModelSearchRanker("vision-ranker-v2", [{
      ...ranker(), unavailabilityReasonCode: "should-not-exist",
    }])).toThrow(/readiness|inconsistent/i);
    expect(() => selectModelSearchRanker("vision-ranker-v2", [{
      ...ranker(), ready: false,
    }])).toThrow(/readiness|inconsistent/i);
    expect(() => selectModelSearchRanker(
      "vision-ranker-v2",
      Array.from({ length: 65 }, (_, index) => ({ ...ranker(), rankerId: `ranker-${index}` })),
    )).toThrow(/64/i);
    const accessor = { ...ranker() } as Record<string, unknown>;
    Object.defineProperty(accessor, "rankerId", { enumerable: true, get: () => "vision-ranker-v2" });
    expect(() => selectModelSearchRanker("vision-ranker-v2", [accessor])).toThrow(/plain object/i);
  });
});

describe("candidate four-view MCP result", () => {
  it("normalizes cross-field structured outputs even when no inline review is returned", () => {
    const search = catalogOutput(false);
    const normalizedSearch = normalizeModelCatalogSearchStructuredContent(search);
    expect(compile(definition("search_model_catalog").outputSchema)(normalizedSearch)).toBe(true);
    const wrongRanker = structuredClone(search);
    wrongRanker.matches[0]!.assessment.ranker.id = "substituted-ranker";
    expect(() => normalizeModelCatalogSearchStructuredContent(wrongRanker)).toThrow(/exact selected ranker/i);

    const resolution = resolutionOutput();
    (resolution.resolution as unknown as Record<string, unknown>).state = "processing";
    delete (resolution as Partial<typeof resolution>).review;
    const normalizedResolution = normalizeModelResolutionStructuredContent(resolution);
    expect(compile(definition("get_model_resolution").outputSchema)(normalizedResolution)).toBe(true);
    const awaitingWithoutReview = resolutionOutput();
    delete (awaitingWithoutReview as Partial<typeof awaitingWithoutReview>).review;
    expect(() => normalizeModelResolutionStructuredContent(awaitingWithoutReview)).toThrow(/review/i);
    const wrongFinal = resolutionOutput("completed");
    delete (wrongFinal as Partial<typeof wrongFinal>).review;
    wrongFinal.resolution.finalAssetRef!.contentHash = "0".repeat(64);
    expect(() => normalizeModelResolutionStructuredContent(wrongFinal)).toThrow(/match/i);

    const progressOnly = validOutputs().cancel_model_resolution;
    expect(normalizeModelResolutionStructuredContent(progressOnly)).toEqual(progressOnly);
  });

  it("returns four real ordered 512 PNG blocks and validates structuredContent against the selected tool", () => {
    const search = createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent: catalogOutput(),
      images: images(),
    });
    expect(search.content).toHaveLength(4);
    expect(search.content.every((item) => item.type === "image" && item.mimeType === "image/png")).toBe(true);
    expect(search.structuredContent.review.reviewViews.map((view) => view.kind)).toEqual([
      "front", "left", "top", "isometric",
    ]);
    expect(compile(definition("search_model_catalog").outputSchema)(search.structuredContent)).toBe(true);
    expect(Object.isFrozen(search.structuredContent)).toBe(true);
    expect(Object.isFrozen(search.content)).toBe(true);

    const resolution = createModelCandidateReviewToolResult({
      toolName: "get_model_resolution",
      structuredContent: resolutionOutput(),
      images: images(),
    });
    expect(compile(definition("get_model_resolution").outputSchema)(resolution.structuredContent)).toBe(true);
  });

  it("rejects any helper input that cannot satisfy the selected structured-output schema", () => {
    const sixMatches = catalogOutput();
    sixMatches.matches = Array.from({ length: 6 }, () => catalogMatch());
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: sixMatches, images: images(),
    })).toThrow(/five|5|invalid/i);

    const mismatchedManifest = catalogOutput();
    mismatchedManifest.matches[0]!.asset.runtimeManifestUri =
      "mcp://models/catalog/another-table/versions/v9/manifest";
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: mismatchedManifest, images: images(),
    })).toThrow(/manifest|assetId|version/i);

    const missingAssetContract = catalogOutput();
    delete (missingAssetContract.matches[0]!.asset as unknown as Record<string, unknown>).contractVersion;
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: missingAssetContract, images: images(),
    })).toThrow(/contractVersion/i);

    const leafWithAssemblyClosure = catalogOutput();
    leafWithAssemblyClosure.matches[0]!.asset.kind = "leaf";
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: leafWithAssemblyClosure, images: images(),
    })).toThrow(/content hash|eligible/i);

    for (const mutate of [
      (value: ReturnType<typeof resolutionOutput>) => { value.resolution.attempts = 0; },
      (value: ReturnType<typeof resolutionOutput>) => {
        delete (value.resolution as unknown as Record<string, unknown>).contractVersion;
      },
      (value: ReturnType<typeof resolutionOutput>) => {
        delete (value.resolution as unknown as Record<string, unknown>).state;
      },
      (value: ReturnType<typeof resolutionOutput>) => {
        delete (value.resolution as unknown as Record<string, unknown>).refinementQuestions;
      },
      (value: ReturnType<typeof resolutionOutput>) => {
        (value.resolution as unknown as Record<string, unknown>).unexpected = true;
      },
      (value: ReturnType<typeof resolutionOutput>) => {
        value.resolution.refinementQuestions = [
          { questionId: "style", prompt: "First prompt" },
          { questionId: "style", prompt: "Second prompt" },
        ];
      },
    ]) {
      const invalid = resolutionOutput();
      mutate(invalid);
      expect(() => createModelCandidateReviewToolResult({
        toolName: "get_model_resolution", structuredContent: invalid, images: images(),
      })).toThrow();
    }

    const completedWithoutAsset = resolutionOutput("completed");
    delete (completedWithoutAsset.resolution as unknown as Record<string, unknown>).finalAssetRef;
    expect(() => createModelCandidateReviewToolResult({
      toolName: "confirm_model_candidate", structuredContent: completedWithoutAsset, images: images(),
    })).toThrow(/asset/i);
    const completedWithWrongAsset = resolutionOutput("completed");
    completedWithWrongAsset.resolution.finalAssetRef!.contentHash = "0".repeat(64);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "confirm_model_candidate", structuredContent: completedWithWrongAsset, images: images(),
    })).toThrow(/match/i);
  });

  it("rejects arbitrary base64, spoofed signatures, incorrect IHDR dimensions, and hash mismatches", () => {
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent: catalogOutput(),
      images: images().map((image, index) => index === 0
        ? { ...image, data: Buffer.from("not a png").toString("base64") }
        : image),
    })).toThrow(/PNG signature|IHDR/i);

    const spoofed = Buffer.from(PREVIEW_BYTES[0]!);
    spoofed[0] = 0;
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent: catalogOutput(),
      images: images().map((image, index) => index === 0
        ? { ...image, data: spoofed.toString("base64") }
        : image),
    })).toThrow(/PNG signature/i);

    const wrongSize = pngBytes(511, 512).toString("base64");
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent: catalogOutput(),
      images: images().map((image, index) => index === 0 ? { ...image, data: wrongSize } : image),
    })).toThrow(/IHDR.*512/i);

    const wrongHash = structuredClone(catalogOutput());
    wrongHash.review!.reviewViews[0]!.preview.sha256 = "0".repeat(64);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent: wrongHash,
      images: images(),
    })).toThrow(/sha256/i);
  });

  it("rejects incomplete, reordered, mislabeled, and non-512 preview packs", () => {
    const structuredContent = catalogOutput();
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent, images: images().slice(0, 3),
    })).toThrow(/four|4/i);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent,
      images: [images()[1], images()[0], images()[2], images()[3]],
    })).toThrow(/order|front/i);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent,
      images: images().map((image, index) => index === 0 ? { ...image, mimeType: "image/jpeg" } : image),
    })).toThrow(/PNG/i);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog",
      structuredContent,
      images: images().map((image, index) => index === 0 ? { ...image, width: 511 } : image),
    })).toThrow(/512/i);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "cancel_model_resolution", structuredContent, images: images(),
    })).toThrow(/toolName/i);
  });

  it("rejects inconsistent review metadata, evidence, and untrusted strings", () => {
    const incomplete = structuredClone(catalogOutput());
    incomplete.review!.reviewViews = incomplete.review!.reviewViews.slice(0, 3);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: incomplete, images: images(),
    })).toThrow(/four|4/i);
    const wrongUri = structuredClone(catalogOutput());
    wrongUri.review!.reviewViews[0]!.original.uri = "https://storage.example/private.png?sig=secret";
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: wrongUri, images: images(),
    })).toThrow(/resource/i);
    const mismatchedHash = structuredClone(catalogOutput());
    mismatchedHash.review!.provenance.contentHash = "a".repeat(64);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: mismatchedHash, images: images(),
    })).toThrow(/same source|content hash/i);
    const injected = structuredClone(catalogOutput());
    (injected.review!.assessment as Record<string, unknown>).fidelityWarnings = [
      "https://provider.example/private",
    ];
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: injected, images: images(),
    })).toThrow(/bounded string array/i);
    const gateFailure = structuredClone(catalogOutput());
    (gateFailure.review!.hardGates[0] as Record<string, unknown>).outcome = "blocked";
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: gateFailure, images: images(),
    })).toThrow(/gate evidence/i);
    const wrongCandidateEvidence = structuredClone(catalogOutput());
    wrongCandidateEvidence.matches[0]!.assessment.score = 0.92;
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: wrongCandidateEvidence, images: images(),
    })).toThrow(/exactly match|content-bound/i);
    const wrongRightsHash = structuredClone(catalogOutput());
    wrongRightsHash.review!.rights.sourceContentHash = "a".repeat(64);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: wrongRightsHash, images: images(),
    })).toThrow(/same source|content hash/i);
    const wrongGateHash = structuredClone(catalogOutput());
    wrongGateHash.review!.hardGates[0]!.subjectContentHash = "a".repeat(64);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "search_model_catalog", structuredContent: wrongGateHash, images: images(),
    })).toThrow(/same source|content hash/i);
    const wrongResolutionToken = resolutionOutput();
    wrongResolutionToken.review.subject.confirmationToken = "D".repeat(64);
    expect(() => createModelCandidateReviewToolResult({
      toolName: "get_model_resolution", structuredContent: wrongResolutionToken, images: images(),
    })).toThrow(/best candidate/i);
  });
});

describe("authenticated model resources", () => {
  it("publishes immutable requester and promoted-catalog templates including both original families", () => {
    const templates = listModelMcpResourceTemplates();
    expect(templates).toEqual(MODEL_MCP_RESOURCE_TEMPLATES);
    expect(Object.isFrozen(templates)).toBe(true);
    expect(templates.map((template) => template.uriTemplate)).toEqual([
      "mcp://models/resolutions/{resolutionId}",
      "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/manifest",
      "mcp://models/resolutions/{resolutionId}/candidates/{candidateId}/views/{viewKind}/original",
      "mcp://models/catalog/{assetId}/versions/{version}/views/{viewKind}/original",
      "mcp://models/catalog/{assetId}/versions/{version}/manifest",
    ]);
    for (const template of templates) {
      expect(template.requiredOAuthScopes).toEqual(["mcp:access", MODEL_MCP_CATALOG_REQUEST_CAPABILITY]);
      expect(template.authenticated).toBe(true);
    }
    expect(templates.filter((template) => template.mimeType === "image/png")).toEqual([
      expect.objectContaining({ width: 1024, height: 1024, ownership: "requester-owned" }),
      expect.objectContaining({ width: 1024, height: 1024, ownership: "promoted-catalog" }),
    ]);
  });

  it("accepts only bounded canonical model resource URIs", () => {
    for (const uri of [
      "mcp://models/resolutions/resolution~1",
      "mcp://models/resolutions/resolution-1/candidates/candidate-1/manifest",
      "mcp://models/resolutions/resolution-1/candidates/candidate-1/views/front/original",
      "mcp://models/catalog/oak-table/versions/v3/views/isometric/original",
      "mcp://models/catalog/oak-table/versions/v3/manifest",
      `mcp://models/catalog/${"a".repeat(128)}/versions/${"v".repeat(128)}/manifest`,
    ]) expect(isModelMcpResourceUri(uri), uri).toBe(true);
    for (const uri of [
      "https://storage.example/private.glb?sig=secret",
      "mcp://models/resolutions/../private",
      "mcp://models/resolutions/resolution:1",
      "mcp://models/resolutions/%2e%2e/private",
      "mcp://models/resolutions/resolution-1/candidates/candidate-1/views/back/original",
      "mcp://models/catalog/Oak-Table/versions/v3/manifest",
      "mcp://models/catalog/oak-table/versions/latest/manifest",
      "mcp://models/catalog/oak-table/versions/PrOdUcTiOn/views/front/original",
      "mcp://models/catalog/oak-table/versions/v1.x/manifest",
      `mcp://models/catalog/${"a".repeat(129)}/versions/v3/manifest`,
      `mcp://models/catalog/oak-table/versions/${"v".repeat(129)}/manifest`,
      "mcp://models/catalog/oak-table/versions/v3/manifest/extra",
      42,
      null,
    ]) expect(isModelMcpResourceUri(uri), String(uri)).toBe(false);
  });
});
