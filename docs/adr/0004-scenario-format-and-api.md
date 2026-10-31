# ADR 0004: Scenario format, validation and the setup API

- Status: Accepted
- Date: 2026-10-31

## Context

Phase 1 needs a way for users to describe faults and to start runs without
editing the seed script. Scenarios are written by people, so the format must
be easy to write, and every mistake must be reported clearly before a run
starts, because a bad scenario would silently produce a meaningless test.

## Decision

- Scenarios are YAML (`version: 1`). They are parsed with `yaml` and
  validated with `zod` in `src/scenarios/scenario.ts`, a pure function with
  no NestJS or Prisma imports.
- Validation rejects: YAML syntax errors (with the line), wrong shapes or
  ranges (for example `probability` above 1), duplicate fault ids, fault
  types that have no plugin in `FaultRegistry`, and targets that name a tool
  the project does not have. Errors are returned as
  `{ error: "INVALID_INPUT", issues: [{ path, message }] }`.
- The validated scenario is stored as `definition`; the original text as
  `source_yaml`. A run copies the definition into `scenario_snapshot`, and
  the proxy reads fault rules from that snapshot only.
- Setup endpoints are idempotent where possible:
  - `PUT /projects/:project` and `PUT /projects/:project/tools/:tool`
    create or update.
  - `POST /projects/:project/scenarios` creates or updates by the scenario
    `name`. The body is YAML, sent with `Content-Type: text/yaml`.
  - `POST /projects/:project/scenarios/:scenario/runs` starts a new run. The
    seed comes from the request, then the scenario, then a random number.
  - `POST /runs/:runId/complete` and `GET /runs/:runId/traces`.
- Services that only store and read records (projects, tools, scenarios,
  runs) use `PrismaService` directly. Business rules stay in pure functions
  (scenario validation, fault planning, trace redaction). This narrows
  ADR 0003, which applies to the proxy path.

## Alternatives considered

- **JSON scenarios**: easier to parse, but no comments and harder to write by
  hand.
- **class-validator DTOs**: the NestJS default, but it needs decorated
  classes, while a zod schema also gives the TypeScript type and works the
  same way for YAML files and JSON bodies.
- **Repositories for every module**: consistent with ADR 0003, but twice the
  files for code that has no rules to protect.

## Consequences

- A new fault plugin is accepted in scenarios as soon as it is registered.
  Plugin-specific config (for example `delayMs`) is not validated yet; a
  plugin falls back to its default when a value is missing.
- Scenario changes never affect runs that already started.
