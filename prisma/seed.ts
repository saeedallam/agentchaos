import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// ---------- Connect to the database ----------
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ---------- The demo data ----------
// A fixed run id, so the proxy URL is the same every time.
const DEMO_RUN_ID = '00000000-0000-7000-8000-000000000001';

const sourceYaml = `version: 1
name: no-faults
seed: 42
faults: []
`;
const definition = { version: 1, name: 'no-faults', seed: 42, faults: [] };

// A second run whose scenario slows down half of the todos requests.
const SLOW_RUN_ID = '00000000-0000-7000-8000-000000000002';

const slowSourceYaml = `version: 1
name: slow-todos
seed: 42
faults:
  - id: slow-todos
    type: latency
    target: { tool: todos, path: "/todos*" }
    probability: 0.5
    config: { delayMs: 2000 }
`;
const slowDefinition = {
  version: 1,
  name: 'slow-todos',
  seed: 42,
  faults: [
    {
      id: 'slow-todos',
      type: 'latency',
      target: { tool: 'todos', path: '/todos*' },
      probability: 0.5,
      config: { delayMs: 2000 },
    },
  ],
};

async function main() {
  // 1) Project
  const project = await prisma.project.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { slug: 'demo', name: 'Demo project' },
  });

  // 2) Tool: points to the fake upstream
  const tool = await prisma.tool.upsert({
    where: { projectId_slug: { projectId: project.id, slug: 'todos' } },
    update: {},
    create: {
      projectId: project.id,
      slug: 'todos',
      baseUrl: 'http://localhost:5000',
    },
  });

  // Second tool, also pointing to the fake upstream
  await prisma.tool.upsert({
    where: { projectId_slug: { projectId: project.id, slug: 'email' } },
    update: {},
    create: {
      projectId: project.id,
      slug: 'email',
      baseUrl: 'http://localhost:5000',
    },
  });

  // 3) Scenario: no faults yet
  const scenario = await prisma.scenario.upsert({
    where: { projectId_name: { projectId: project.id, name: 'no-faults' } },
    update: {},
    create: {
      projectId: project.id,
      name: 'no-faults',
      sourceYaml,
      definition,
      checksum: createHash('sha256').update(sourceYaml).digest('hex'),
    },
  });

  // 4) Run: already running, ready to receive requests
  await prisma.run.upsert({
    where: { id: DEMO_RUN_ID },
    update: { status: 'RUNNING' },
    create: {
      id: DEMO_RUN_ID,
      scenarioId: scenario.id,
      status: 'RUNNING',
      seed: 42,
      scenarioSnapshot: definition,
      startedAt: new Date(),
    },
  });

  // 5) Second scenario and run: half of the todos requests are slow
  const slowScenario = await prisma.scenario.upsert({
    where: { projectId_name: { projectId: project.id, name: 'slow-todos' } },
    update: {},
    create: {
      projectId: project.id,
      name: 'slow-todos',
      sourceYaml: slowSourceYaml,
      definition: slowDefinition,
      checksum: createHash('sha256').update(slowSourceYaml).digest('hex'),
    },
  });

  await prisma.run.upsert({
    where: { id: SLOW_RUN_ID },
    update: { status: 'RUNNING' },
    create: {
      id: SLOW_RUN_ID,
      scenarioId: slowScenario.id,
      status: 'RUNNING',
      seed: 42,
      scenarioSnapshot: slowDefinition,
      startedAt: new Date(),
    },
  });

  // 6) Start both demo runs from request number 1 again, so the seeded
  // fault pattern is the same every time you seed.
  await prisma.trace.deleteMany({
    where: { runId: { in: [DEMO_RUN_ID, SLOW_RUN_ID] } },
  });

  console.log(
    `Seeded: project "${project.slug}", tool "${tool.slug}", run ${DEMO_RUN_ID}`,
  );
  console.log(`Seeded: slow run ${SLOW_RUN_ID} (seed 42, latency on /todos*)`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
