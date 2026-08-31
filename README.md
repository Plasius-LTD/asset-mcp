# @plasius/asset-mcp

[![npm version](https://img.shields.io/npm/v/@plasius/asset-mcp.svg)](https://www.npmjs.com/package/@plasius/asset-mcp)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/asset-mcp/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/asset-mcp/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/codecov/c/github/Plasius-LTD/asset-mcp)](https://codecov.io/gh/Plasius-LTD/asset-mcp)
[![License](https://img.shields.io/github/license/Plasius-LTD/asset-mcp)](./LICENSE)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-yes-blue.svg)](./CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/security%20policy-yes-orange.svg)](./SECURITY.md)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

MCP tool contracts for governed Plasius asset upload, generation, processing,
review, promotion, rollback, manifest lookup, and asynchronous model resolution.

## Install

```bash
npm install @plasius/asset-mcp
```

## Scope

This package is part of the unified AI asset pipeline package family. It owns
portable MCP descriptors, JSON Schemas, result envelopes, OAuth/capability
metadata, and authenticated resource templates. It deliberately does not own
HTTP hosting, authentication, persistence, provider downloads, conversion,
rendering, or promotion side effects.

The canonical model-resolution API reuses the runtime-validated model contracts
from `@plasius/asset-contracts`. The existing nine `asset.*` tool names and
their request-envelope helpers remain source-compatible.

## Canonical model-resolution tools

| Tool | Purpose | Required capability |
| --- | --- | --- |
| `list_model_search_rankers` | List calibrated rankers and readiness evidence. | `asset.catalog.request` |
| `search_model_catalog` | Search promoted catalog versions only. | `asset.catalog.request` |
| `resolve_model_request` | Search locally, optionally stage a ChatGPT-attached source, and create governed fallback work. | `asset.catalog.request` |
| `get_model_resolution` | Read an owned immutable request revision and review evidence. | `asset.catalog.request` |
| `confirm_model_candidate` | Confirm one exact candidate and its four-view evidence. | `asset.catalog.confirm` |
| `retry_model_resolution` | Create a refined immutable request revision. | `asset.catalog.request` |
| `cancel_model_resolution` | Cancel unfinished requester-owned work. | `asset.catalog.request` |
| `rebuild_model_catalog_index` | Run an operator-only full, backfill, or repair rebuild. | `asset.pipeline.mcp.manage` |

Every descriptor includes JSON Schema 2020-12 input and structured-output
schemas, MCP annotations, OAuth scopes, required capability, and rollout
metadata. Hosts can register the returned definitions directly while retaining
responsibility for verifying every declared control. After schema validation,
hosts must call `normalizeModelMcpRequestSpec` before execution so BCP 47,
bounds/dimensions, budgets, and case-insensitive list uniqueness remain
authoritative through `@plasius/asset-contracts`.
Model request revisions start at `0` and are bounded through revision `3`.
Refinement questions are stable `{ questionId, prompt }` records so retry
answers can address the exact question from the preceding immutable revision.
`normalizeModelMcpRefinementAnswers` rejects duplicate answer IDs.

```ts
import {
  listModelMcpResourceTemplates,
  listModelMcpToolDefinitions,
  normalizeModelCatalogSearchStructuredContent,
  normalizeModelMcpResolveRequestInput,
  normalizeModelMcpRequestSpec,
  normalizeModelResolutionStructuredContent,
} from "@plasius/asset-mcp";

const tools = listModelMcpToolDefinitions();
const resourceTemplates = listModelMcpResourceTemplates();

const request = normalizeModelMcpRequestSpec(untrustedRequest);
const resolveInput = normalizeModelMcpResolveRequestInput(untrustedResolveInput);
const searchOutput = normalizeModelCatalogSearchStructuredContent(untrustedSearchOutput);
const resolutionOutput = normalizeModelResolutionStructuredContent(untrustedResolutionOutput);
```

The two structured-output normalizers are required for responses without inline
images because JSON Schema cannot express equality between arbitrary sibling
hashes or ranker IDs. The four-view result helper delegates to the same
normalizers when a review is present.

### ChatGPT attachment input

`resolve_model_request` declares `_meta["openai/fileParams"]` as
`["sourceFile"]`. Its optional top-level `sourceFile` follows the ChatGPT file
object exactly: `download_url` and `file_id` are required, while `mime_type`
and `file_name` are optional and all other properties are rejected. An attached
source must be paired with `rightsAttestation`; callers must explicitly state
that public-demo redistribution, derivative work, and commercial use are
allowed. That statement is evidence for a later independent rights gate and
does not itself authorize promotion.

```ts
import {
  createResolveModelRequestIdempotencyFingerprint,
  normalizeModelMcpResolveRequestInput,
} from "@plasius/asset-mcp";

const input = normalizeModelMcpResolveRequestInput({
  request: untrustedRequest,
  idempotencyKey: "resolve-upload-1",
  sourceFile: {
    download_url: temporaryChatGptUrl,
    file_id: "file-example",
    mime_type: "model/gltf-binary",
    file_name: "example.glb",
  },
  rightsAttestation: {
    basis: "requester-owned",
    publicDemoRedistributionAllowed: true,
    derivativeWorksAllowed: true,
    commercialUseAllowed: true,
  },
});

const fingerprint = createResolveModelRequestIdempotencyFingerprint({
  requesterId: verifiedTokenSubject,
  ...input,
});
```

The fingerprint binds the verified requester, exact tool, idempotency key,
normalized request, stable `file_id`, and normalized rights statement. It
deliberately excludes the expiring URL, untrusted filename, and MIME hint.
Hosts must stream the URL through their bounded acquisition policy, never log
or persist it, and reject a replay when the stored fingerprint differs.

### PVOX v2 contract discovery

`@plasius/asset-contracts@^0.4.0` is the source of truth for PVOX states,
manifests, candidates, processing evidence, and JSON Schemas. This package
re-exports that released family and advertises `MODEL_MCP_PVOX_RESULT_CONTRACT`
on candidate-bearing descriptors. Existing v1 structured-output schemas and
normalizers remain compatible; hosted adapters may retain a v1 review
projection while linking authenticated resources to the full v2 PVOX record.
This package performs no download, conversion, rendering, or promotion work.

### Exact ranker selection

Caller-selected rankers are exact and fail closed. An unavailable selection is
reported without substituting a different ready ranker. A successful selection
is one flattened record containing the selected ranker identity, calibration
evidence, readiness, `selectionMode`, and `substituted: false`; it does not
publish a second nested ranker identity. Text-only rankers cannot declare a
`high` assurance ceiling.

```ts
import { selectModelSearchRanker } from "@plasius/asset-mcp";

const selection = selectModelSearchRanker("vision-ranker-v2", registeredRankers);
if (selection.status === "unavailable") {
  // Return selection.reasonCode; do not reroute to another ranker.
}
```

Ranker discovery exposes only the safe ranker ID, evidence mode, declared
assurance ceiling, implementation version, calibration ID/version, readiness,
and a bounded unavailability reason code.

### Four-view review results

`createModelCandidateReviewToolResult` validates and returns exactly four
ordered 512×512 PNG MCP image content blocks: front, left, top, then isometric.
It verifies canonical base64, the actual PNG signature and IHDR dimensions, and
the SHA-256 digest of each decoded preview against its structured metadata.

Candidate-bearing tools use a common optional top-level `review` envelope in
`structuredContent`. The envelope projects the canonical match assessment,
provenance, eligible rights decision, technical profile, every required passed
hard gate, fidelity outcome, and ordered view metadata. Evidence preserves
three separate identities: raw source hash for rights/malware, canonical asset
hash for match/asset identity, and processing closure hash for technical,
human, and accessibility gates. Resolution candidate reviews carry a signed
confirmation token. Promoted catalog matches are
read-only and intentionally carry no confirmation token; catalog search may
include at most one optional inline review for one returned match. A response
without an inline review uses the ordinary structured output and has no image
blocks.

The structured view metadata references authenticated 1024×1024 originals
under `mcp://models/...`; it never accepts HTTP, signed storage, or
path-traversal references. Both requester-owned resolution originals and
immutable promoted-catalog originals have dedicated resource templates.

Resource templates cover requester-owned resolutions, candidate manifests,
requester and promoted-catalog confirmation originals, and immutable promoted
catalog manifests. A host must authenticate every read, enforce requester
ownership for staged resources, and serve only promoted catalog versions
through catalog templates. Catalog resource matching uses the canonical
immutable-version validator, so moving aliases such as `latest` or `production`
and wildcard labels cannot be treated as immutable catalog evidence.

The v1 compatibility projection retains stable MCP `questionId` records and
the MCP package's stricter 128-character asset-ID boundary. Full PVOX v2
records use the released `@plasius/asset-contracts` validators and schemas.

## Feature Flag

- `asset.pipeline.unified-ai-assets.enabled`
- `asset.pipeline.pvox-models.enabled` when uploaded PVOX processing or promotion is attempted
- `asset.pipeline.external-model-harvest.enabled` when provider fallback is attempted
- `asset.pipeline.ai-model-generation.enabled` when generation fallback is attempted

These are remotely stored rollout controls. This package publishes their IDs
but does not evaluate them. The generation gate remains fail-closed during
Phase 1.

## OAuth scopes and capabilities

Canonical descriptors require `mcp:access` plus one operation-specific scope.
The operation-specific scope uses the same value as the backend capability:

- `asset.catalog.request`
- `asset.catalog.confirm`
- `asset.catalog.review` for independent hosted review workflows
- `asset.source.manage` for provider administration
- `asset.pipeline.mcp.manage` for operator pipeline/index operations

OAuth scope verification never replaces backend capability or resource-owner
authorization.

## Related Documents

- plasius-ltd-site `docs/Design/unified-ai-asset-pipeline.md`
- plasius-ltd-site `docs/adrs/adr-0084-unified-ai-asset-pipeline-packages.md`
- plasius-ltd-site `docs/tdrs/tdr-0004-unified-ai-asset-pipeline.md`

## Development

```bash
npm ci
npm run build
npm test
npm run test:coverage
npm run typecheck
npm run lint
npm run audit:all
npm run pack:check
```

## Governance

- Security policy: [SECURITY.md](./SECURITY.md)
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- ADRs: [docs/adrs](./docs/adrs)
- CLA and legal docs: [legal](./legal)

## License

Apache-2.0

<!-- BEGIN PLASIUS RELEASE INTEGRITY -->
## Release integrity

CI keeps the administrative contributor registry outside Git and npm package
artifacts using exact, case-normalised path checks. CI runs on approved
self-hosted runners through the allowlisted reusable workflow on `main`.
Same-repository pull requests call that immutable admission point while fork
pull requests remain excluded. Package-manager caching is disabled, preventing
shared cache state and cache post-job failures from weakening exact-SHA
admission.
Release preparation and npm publication use GitHub-hosted runners with Node.js
24.18.0 LTS and npm 11.5.1 or newer. CD must not be
dispatched until the npm trusted-publisher binding is verified. Publication is
token-free and proceeds only while the prepared commit remains the exact
`main` head after successful push-triggered CI for that SHA.
<!-- END PLASIUS RELEASE INTEGRITY -->
