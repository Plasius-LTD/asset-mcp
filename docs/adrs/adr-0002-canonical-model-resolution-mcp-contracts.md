# ADR 0002: Canonical Model-Resolution MCP Contracts

## Status

Accepted — 2026-07-13; amended 2026-08-24

## Context

The unified asset pipeline needs one portable MCP contract family for resolving
static world models from the promoted catalog, approved providers, and a future
generator. The hosted site owns identity, durable state, workers, storage, and
side effects, while clients and hosts need identical names, schemas, assurance
evidence, review-image ordering, scopes, capabilities, and resource templates.

The package already exposes nine dotted `asset.*` operations. Those names and
their request-envelope behavior are public and must remain compatible while the
canonical workflow is added.

## Decision

Add an independent snake_case tool registry containing:

- `list_model_search_rankers`
- `search_model_catalog`
- `resolve_model_request`
- `get_model_resolution`
- `confirm_model_candidate`
- `retry_model_resolution`
- `cancel_model_resolution`
- `rebuild_model_catalog_index`

Each frozen descriptor publishes JSON Schema 2020-12 input and structured
output schemas, standard MCP behavioral annotations, OAuth security schemes,
one required backend capability, and stored rollout-flag metadata. The new
contracts reuse `@plasius/asset-contracts@^0.3.1` constants and model types
instead of redefining assurance bands, lifecycle states, view order, or
original-image size. Hosted adapters apply the published JSON Schema first and
then use the exported request and structured-output normalizers for cross-field
invariants that JSON Schema cannot express.
Request revisions use the released immutable `0..3` boundary. Resolution
questions are bounded `{ questionId, prompt }` records, allowing retry answers
to bind to the exact question and revision that produced them.

Caller-selected rankers use exact ID matching. Missing, duplicate, malformed,
or unready registrations fail closed and cannot silently select another
ranker. A selected result is flattened into one identity containing its
selection status/mode, ranker and calibration evidence, readiness, and
`substituted: false`. Text-only rankers are prohibited from declaring a `high`
assurance ceiling.

Candidate review results contain exactly four inline 512×512 PNG MCP image
blocks in front, left, top, and isometric order. The helper verifies canonical
base64, the decoded PNG signature, 512×512 IHDR dimensions, and the decoded
bytes' SHA-256 digest before emitting a block.

All candidate-bearing tools use the same optional top-level `review` envelope
alongside their normal structured output. That envelope contains public-safe
canonical assessment and ranker evidence, provenance, an eligible rights
summary, the canonical technical profile, all required passed hard-gate
summaries, fidelity outcome, and the four ordered review records. Raw source,
canonical candidate, and processing-closure hashes remain distinct: rights and
malware bind the raw source; assessment and asset identity bind the canonical
candidate; remaining hard gates bind the processed closure. A
resolution-candidate subject includes its signed confirmation token. A catalog
subject identifies an immutable promoted asset version and deliberately has no
confirmation token. Catalog search returns non-confirmable matches and may add
at most one inline review for one of those matches.

Structured view metadata references authenticated 1024×1024 originals using
bounded `mcp://models/...` resources. The package publishes requester-owned
resolution, candidate-manifest, and original templates together with promoted
catalog-original and catalog-manifest templates, but performs no reads itself.
Promoted-catalog resource matching validates the path version with the shared
immutable asset-version validator; mutable aliases and wildcard labels fail
closed before a host can resolve a catalog resource.

The legacy dotted constants, definitions, types, and envelope helper remain
unchanged. Hosts may implement compatibility aliases over the same services,
but this package does not execute hosted actions.

As an additive extension, `resolve_model_request` accepts an optional
top-level `sourceFile` and publishes `_meta["openai/fileParams"]` for that exact
field. The file object declares all four ChatGPT runtime fields, requires only
`download_url` and `file_id`, and closes the object to unknown properties. An
uploaded file is valid only when paired with a structured rights attestation
that explicitly permits public-demo redistribution, derivatives, and
commercial use. Confirmation remains a separate tool and capability.

The package now depends on `@plasius/asset-contracts@^0.4.0`, re-exports its
PVOX v2 state, manifest, candidate, processing, and JSON Schema contracts, and
advertises their immutable identifiers through
`MODEL_MCP_PVOX_RESULT_CONTRACT`. The existing v1 result projection remains
source-compatible; hosted services own the durable v2 record and may project
the existing four-view response from it. The conditional
`asset.pipeline.pvox-models.enabled` flag gates attached-source processing and
PVOX confirmation.

## Security and failure posture

- JSON Schemas close objects to unknown properties and bound identifiers,
  arrays, request revisions, catalog limits, and refinement answers.
- Resource helpers reject HTTP/S URLs, percent encoding, traversal, unknown
  view names, and noncanonical suffixes.
- Catalog evidence cannot be submitted directly for confirmation; confirmation
  requires a resolution-scoped candidate and its signed token.
- Review projections expose only eligible rights outcomes and passed malware,
  technical, human-review, and accessibility gates. Private attestations and
  signed rights-decision tokens remain server-side.
- Runtime normalizers bind selected rankers, rights, hashes, leaf/assembly
  closures, final assets, and stable question IDs for reviewed and
  structured-only responses.
- Inline preview helpers verify actual PNG signature/IHDR evidence and bind
  decoded image bytes to the advertised SHA-256 digest.
- OAuth scopes are descriptive gates only; hosts must separately enforce the
  declared capability and requester ownership. Both requester-owned and
  promoted-catalog originals remain authenticated resources.
- External provider and generator flags are conditional kill switches. The
  parent unified flag remains mandatory for every tool.
- No provider URL, storage path, SAS value, token, secret, or image data is
  logged or persisted by this contract package.
- ChatGPT download URLs must be bounded HTTPS values without embedded
  credentials. They are intentionally excluded from idempotency fingerprints;
  the verified requester, exact tool, key, normalized request, stable
  `file_id`, and rights statement are included instead.
- User filenames and MIME values are untrusted hints. The schema rejects path
  separators and unknown fields, while hosted acquisition remains responsible
  for redirect, DNS/IP, byte, time, and content verification.
- A rights attestation is never a licensing bypass: independent rights,
  malware, PVOX, fidelity, renderer, and review gates still fail closed.

## Alternatives considered

- Implement tools directly in the hosted site: rejected because schemas and
  metadata would drift across hosts and tests.
- Replace the legacy dotted family: rejected because it would break existing
  consumers.
- Depend on a runtime JSON Schema engine: rejected to keep the production
  dependency surface small. AJV is test-only and verifies the published
  schemas.
- Permit fallback to a different ready ranker: rejected because caller choice,
  calibration evidence, and assurance ceilings must remain auditable.

## Consequences

- Hosted implementations can register one immutable contract registry and add
  their own authorization, persistence, and execution adapters.
- Hosts can emit structured-only candidate lists or one common review envelope
  with exactly four image blocks; catalog search never creates a confirmation
  capability for a promoted match by itself.
- ChatGPT can bind a user attachment to the canonical resolve action without a
  parallel upload tool or a result that exposes the temporary download URL.
- Provider, processing, review, and generator packages can evolve behind the
  stable MCP boundary.
- Any schema expansion must remain additive within this contract version or
  publish a new version.
- PVOX v2 remains an additive hosted/resource contract. Switching the existing
  v1 structured result to v2 would require a separately versioned public MCP
  result contract rather than a silent schema replacement.
- Hosts remain responsible for owner checks, hard licensing/technical gates,
  idempotency, cancellation, deadlines, and atomic promotion.

## Related decisions

- [ADR 0001: Asset MCP Package Boundary](./adr-0001-package-boundary.md)
- plasius-ltd-site ADR 0084: Unified AI asset pipeline packages
- plasius-ltd-site ADR 0098: Hosted MCP asset operations and agent auth
