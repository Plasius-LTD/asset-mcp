# ADR 0003: Hosted OIDC Package Publication

- Status: Accepted
- Date: 2026-08-11

## Context

`@plasius/asset-mcp` must publish without a long-lived npm write token and must
not accept CI evidence for a different source snapshot.

## Decision

Publication is phase-isolated: dependency installation, package validation, SBOM generation, and immutable tarball packing run in `validate_and_pack` without the `production` environment or OIDC permission. The final hosted `publish` job downloads only that sealed artifact, explicitly installs npm 11.6.2, runs no repository dependency code, and publishes the tarball with lifecycle scripts disabled. It re-fetches current `main` immediately before the first release mutation and again immediately before npm publication. `.npmrc` contains no registry-auth placeholder, and release preparation returns the reviewed current `main` HEAD rather than package-file history.

Use the GitHub-hosted `production` publish job and npm trusted publishing. The
job proves the prepared SHA is still the exact remote `main` head, waits for a
successful push-triggered `ci.yml` run for that SHA, enforces Node 24 with npm
11.5.1 or newer, and publishes with provenance. Token fallbacks are prohibited.

## Consequences

Publication fails closed if npm's trusted-publisher binding is absent, `main`
moves, exact-SHA CI has not succeeded, the runtime is unsupported, or OIDC is
unavailable.

## Test implications

Contract tests enforce the identity, source, CI, runtime, and provenance gates
and reject legacy npm credential names.
