# AgentChaos

Chaos testing for AI agents.

AgentChaos sits as a proxy between an AI agent and the tools it calls
(HTTP APIs, and later MCP servers). It forwards each call to the real
tool, injects faults defined in a YAML scenario, records every call as a
trace, and scores how the agent behaved.

> Status: early development. Phase 1 (HTTP proxy, first faults, YAML
> scenarios) is in progress. Nothing here is stable yet.

## Why

Agents look great in demos, where every tool answers instantly and
correctly. In production, APIs time out, rate limit, and return broken
data. AgentChaos answers the question nobody tests: what does your agent
do when its tools fail?

- Does it retry sensibly, or give up, or retry forever?
- Does it get stuck in a loop?
- How many calls and tokens does it burn?
- Does it claim success when it actually failed?
- Does it obey instructions injected into tool output?

## How it works

```
Agent  -->  AgentChaos proxy  -->  Real tool
                 |
                 +-- injects faults from a YAML scenario
                 +-- records every call as a trace (PostgreSQL)
```

A scenario looks like this (the format is still evolving):

```yaml
version: 1
name: flaky-weather
seed: 42 # same seed = same faults in the same places

faults:
  - id: slow-forecast
    type: latency
    target: { tool: weather, path: '/forecast*' }
    probability: 0.5
    config: { delayMs: 2000 }

  - id: rate-limited
    type: http_error
    target: { tool: weather }
    probability: 0.2
    config: { status: 429 }
```

## Getting started (development)

Requirements:

- Node.js 22.12 or newer
- npm 11 or newer (npm 10.9 crashes while installing, see
  [ADR 0001](docs/adr/0001-use-esm-and-vitest.md))
- Docker with Docker Compose

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your local environment file
cp .env.example .env

# 3. Start PostgreSQL (runs on 127.0.0.1:5433)
docker compose up -d

# 4. Apply database migrations
npm run db:migrate

# 5. Start the app in watch mode
npm run start:dev
```

Check that the app and the database are up:

```bash
curl http://localhost:3000/health
# {"status":"ok","database":"up"}
```

## Useful scripts

| Script                | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run start:dev`   | Start the app and restart on file changes    |
| `npm run db:migrate`  | Create and apply database migrations         |
| `npm run db:generate` | Regenerate the Prisma client                 |
| `npm test`            | Run unit tests (Vitest)                      |
| `npm run test:e2e`    | Run end-to-end tests (needs the database up) |
| `npm run lint`        | Lint the code (oxlint)                       |
| `npm run format`      | Format the code (Prettier)                   |

## Tech stack

NestJS 12, TypeScript (ESM), PostgreSQL 18, Prisma 7, Vitest, Docker
Compose. Redis and BullMQ will be added for background runs.

## Architecture decisions

Important decisions are recorded as ADRs in [`docs/adr`](docs/adr).

## License

Not decided yet. Until a license is added, this code is not open source.
