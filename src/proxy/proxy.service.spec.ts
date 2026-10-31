import type { PrismaService } from '../common/prisma/prisma.service.js';
import { ProxyService } from './proxy.service.js';
import { UpstreamClient } from './upstream.client.js';

const RUN_ID = '00000000-0000-7000-8000-000000000001';

// A fake PrismaService: only the two methods ProxyService uses.
function fakePrisma(options: { run?: unknown; tool?: unknown }) {
  return {
    run: { findUnique: vi.fn().mockResolvedValue(options.run ?? null) },
    tool: { findUnique: vi.fn().mockResolvedValue(options.tool ?? null) },
    trace: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaService;
}

function makeService(options: { run?: unknown; tool?: unknown }) {
  return new ProxyService(fakePrisma(options), new UpstreamClient());
}

const runningRun = { status: 'RUNNING', scenario: { projectId: 'project-1' } };
const todosTool = { baseUrl: 'http://upstream.test', timeoutMs: 1000 };

describe('ProxyService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 404 when the run does not exist', async () => {
    const service = makeService({ run: null });

    const result = await service.forward({
      runId: RUN_ID,
      toolSlug: 'todos',
      method: 'GET',
      path: '/todos/1',
    });

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'RUN_NOT_FOUND' });
  });

  it('returns 409 when the run is not running', async () => {
    const finishedRun = { ...runningRun, status: 'COMPLETED' };
    const service = makeService({ run: finishedRun });

    const result = await service.forward({
      runId: RUN_ID,
      toolSlug: 'todos',
      method: 'GET',
      path: '/todos/1',
    });

    expect(result.status).toBe(409);
    expect(JSON.parse(result.body)).toEqual({ error: 'RUN_NOT_RUNNING' });
  });

  it('returns 404 when the tool does not exist', async () => {
    const service = makeService({ run: runningRun, tool: null });

    const result = await service.forward({
      runId: RUN_ID,
      toolSlug: 'email',
      method: 'GET',
      path: '/inbox',
    });

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'TOOL_NOT_FOUND' });
  });

  it("forwards to the tool's base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"id":1}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const service = makeService({ run: runningRun, tool: todosTool });

    const result = await service.forward({
      runId: RUN_ID,
      toolSlug: 'todos',
      method: 'GET',
      path: '/todos/1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://upstream.test/todos/1',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"id":1}');
  });

  it('returns 502 when the upstream is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );
    const service = makeService({ run: runningRun, tool: todosTool });

    const result = await service.forward({
      runId: RUN_ID,
      toolSlug: 'todos',
      method: 'GET',
      path: '/todos/1',
    });

    expect(result.status).toBe(502);
    expect(JSON.parse(result.body)).toEqual({ error: 'UPSTREAM_UNREACHABLE' });
  });
});
