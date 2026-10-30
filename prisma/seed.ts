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

  console.log(
    `Seeded: project "${project.slug}", tool "${tool.slug}", run ${DEMO_RUN_ID}`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
