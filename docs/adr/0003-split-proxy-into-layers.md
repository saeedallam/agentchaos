# ADR 0003: Split the proxy into layers, without interfaces for now

- Status: Accepted
- Date: 2026-10-31

## Context

An architecture review of phase 1 found that `ProxyService` did four jobs
from three layers: reading runs and tools with Prisma, calling the real
tool with `fetch`, writing traces with Prisma, and orchestrating the
steps. The next step adds fault planning (target matching, probability,
seeded randomness), which is the core business logic of the project. Adding
it to the same class would turn `ProxyService` into a god class and mix
pure rules with I/O.

## Decision

Split by responsibility:

| Piece             | Layer          | Job                                         |
| ----------------- | -------------- | ------------------------------------------- |
| `ProxyController` | Controller     | Translate HTTP to `ProxyRequest` and back   |
| `ProxyService`    | Application    | Orchestrate the steps, no I/O of its own    |
| `TargetProvider`  | Infrastructure | Read the run and tool, return plain objects |
| `UpstreamClient`  | Infrastructure | Send one request to the real tool           |
| `TraceRecorder`   | Infrastructure | Write one trace per request                 |
| Fault plugins     | Domain         | Pure fault behavior (`FaultPlugin`)         |
| Fault planner     | Domain         | Pure rules: which faults apply (next step)  |

Domain code (`src/faults`, and later trace policies such as redaction)
must not import NestJS, Prisma, or HTTP types.

Infrastructure pieces are plain injectable classes, **without** separate
interfaces. NestJS dependency injection already lets tests pass fakes.

## Alternatives considered

- **Interface plus implementation for every infrastructure piece** (for
  example `TraceRecorder` and `PrismaTraceRecorder`): full dependency
  inversion, but twice the files, and nothing in phase 1 needs to swap
  these implementations.
- **Keep everything in `ProxyService`**: simplest today, but fault
  planning would land next to Prisma and `fetch` calls and be hard to
  test deterministically.

## Consequences

- `ProxyService` no longer imports `PrismaService`. Prisma types stay in
  infrastructure classes.
- Unit tests fake three small helpers instead of a Prisma client.
- Fault planning will be a pure function and can be tested with fixed
  seeds and no database.
- Revisit when an infrastructure piece needs a second implementation. The
  expected first case is `TraceRecorder` in phase 3, when trace writes may
  move to a BullMQ queue. Introduce an interface then, in a new ADR.
- `HealthController` still calls Prisma directly. Accepted: it exists to
  test the database connection.
