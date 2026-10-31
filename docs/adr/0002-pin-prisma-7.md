# ADR 0002: Pin Prisma to version 7

- Status: Accepted
- Date: 2026-10-28

## Context

When we installed Prisma, the `latest` tag of the `prisma` package on
npm pointed to `8.0.0-rc.28` (a release candidate), while
`@prisma/client@latest` pointed to `7.10.x`. Installing both without a
version produced mismatched major versions, and the Prisma 8 CLI
rejected Prisma 7 commands (`No command registered for validate`).

Prisma 8 is not a drop-in upgrade: it changes the schema format, the
CLI commands, and removes `@prisma/client`.

## Decision

- Pin `prisma`, `@prisma/client`, and `@prisma/adapter-pg` to `^7`.
- Do not follow the CLI's "Update available" banner to Prisma 8.
- Revisit when Prisma 8 has a stable (non-rc) release.

## Alternatives considered

- **Adopt Prisma 8 now**: rejected because it is a release candidate,
  and building an open-source project on pre-release tooling would
  expose contributors to breaking changes.

## Consequences

- Always install Prisma packages with an explicit major version
  (for example `npm install prisma@7`), never bare.
- npm 12 blocks install scripts by default. `prisma` and
  `@prisma/engines` are approved in `allowScripts` in `package.json`.
  The approval is tied to an exact version, so after upgrading Prisma
  run `npm install-scripts ls` and approve the new version again.
- A future move to Prisma 8 will need its own ADR and a migration plan.
