# Changelog

## Unreleased

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.8] - 2026-08-31

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.7] - 2026-08-24

- **Added**
  - Added an optional ChatGPT `sourceFile` parameter to
    `resolve_model_request`, paired with a closed public-demo rights
    attestation and `_meta["openai/fileParams"]` discovery metadata.
  - Added requester-bound resolve idempotency fingerprints that use stable
    `file_id` and rights inputs without retaining expiring download URLs.
  - Re-exported the released PVOX v2 lifecycle, manifest, evidence, and JSON
    Schema contracts and advertised their identifiers on candidate tools.

- **Changed**
  - Updated `@plasius/asset-contracts` to `^0.4.0` and added the conditional
    `asset.pipeline.pvox-models.enabled` rollout gate while retaining all eight
    canonical tools, legacy wrappers, and v1 result normalizers.

- **Fixed**
  - (placeholder)

- **Security**
  - Closed and bounded attachment/rights objects, required credential-free
    HTTPS download URLs, treated filenames and MIME values as untrusted hints,
    and kept confirmation behind `asset.catalog.confirm`.
  - Pinned patched development transitive releases for `brace-expansion`,
    `fast-uri`, and `nanoid` after the full dependency audit.

## [0.1.6] - 2026-08-20

- **Added**
  - (placeholder)

- **Changed**
  - Bound npm publication to the exact prepared `main` commit after successful push-triggered CI.

- **Fixed**
  - Routed same-repository pull-request validation through the allowlisted
    reusable self-hosted workflow on `main`, restoring runner admission without
    exposing quarantined capacity to forks.
  - Disabled shared npm caching on quarantined self-hosted CI so cache setup or
    post-job failures cannot strand exact-SHA validation runs.
  - Rejected moving aliases and wildcard labels at promoted-catalog MCP
    resource boundaries while preserving exact immutable versions and every
    legacy dotted tool API.
  - (placeholder)

- **Security**
  - Removed the legacy npm write-token path and added a fail-closed Node 24 and npm 11.5.1-or-newer OIDC runtime check.
  - Enabled same-repository pull-request CI while preventing external forks and `pull_request_target` from executing repository code on self-hosted runners.
  - Bound authenticated catalog manifests and review originals to exact
    immutable asset versions using the canonical shared validator.
  - (placeholder)

## [0.1.5] - 2026-08-01

- **Added**
  - Added eight canonical snake_case model-resolution MCP tool descriptors with
    JSON Schema 2020-12 input/output contracts, OAuth scopes, capabilities,
    rollout metadata, and MCP annotations.
  - Added exact no-substitution ranker selection contracts, authenticated model
    resource templates, and a four-view 512 PNG result helper linked to 1024
    `mcp://models/...` originals.
  - Added canonical public-safe assessment, provenance, rights, technical, and
    passed hard-gate projections plus stable refinement question IDs.
  - Added runtime normalizers for canonical requests, question-addressed retry
    answers, reviewed or structured-only catalog results, and resolution results.

- **Changed**
  - Added the released `@plasius/asset-contracts` `^0.3.1` runtime dependency
    while preserving every legacy dotted tool name and envelope behavior.
  - Candidate-bearing outputs now use one optional top-level review envelope;
    catalog matches are non-confirmable and expose at most one inline review.
  - Candidate evidence now preserves distinct raw-source, canonical-asset, and
    processing-closure hashes for the rights, match, and hard-gate domains.
  - Request revisions now match the released immutable `0..3` boundary, and
    selected ranker results use one flattened exact-selection identity.

- **Fixed**
  - Aligned retry questions and answers through stable `questionId` values and
    prohibited high assurance ceilings for text-only rankers.
  - Bound selected rankers, final assets, rights decisions, and each hard gate
    across structured-only and reviewed outputs, including fidelity warnings.

- **Security**
  - Canonical schemas and result helpers reject malformed identifiers, unsafe
    external/private resource references, traversal syntax, incomplete view
    packs, and implicit ranker substitution.
  - Four-view helpers verify decoded PNG signatures, 512×512 IHDR dimensions,
    and SHA-256 hashes before emitting inline review images.
  - Public normalizers reject case-insensitive request duplicates, mismatched
    manifest identities, duplicate question IDs, and inconsistent hash domains.
  - Added fail-closed source and npm-package admission for the administrative contributor registry and pinned the CI/CD runtime to Node.js 24.18.0 LTS.
  - (placeholder)

## [0.1.4] - 2026-06-28

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.3] - 2026-06-28

- **Added**
  - (placeholder)

- **Changed**
  - Refreshed development dependency baselines to `@types/node@26.0.1` and `eslint@10.6.0`.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.2] - 2026-06-22

- **Added**
  - (placeholder)

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.1] - 2026-06-21

- Scaffolded @plasius/asset-mcp for the unified AI asset pipeline.
- Corrected scaffold documentation to identify the asset-mcp package and ADR 0084 accurately.


[0.1.1]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.1
[0.1.2]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.2
[0.1.3]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.3
[0.1.4]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.4
[0.1.5]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.5
[0.1.6]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.6
[0.1.7]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.7
[0.1.8]: https://github.com/Plasius-LTD/asset-mcp/releases/tag/v0.1.8
