import type { TraceRecorder } from '../traces/trace.recorder.js';
import { ProxyService } from './proxy.service.js';
import type { RunInfo, TargetProvider, ToolInfo } from './target.provider.js';
import type { UpstreamClient } from './upstream.client.js';

const RUN_ID = '00000000-0000-7000-8000-000000000001';

const runningRun: RunInfo = {
  id: RUN_ID,
  status: 'RUNNING',
  projectId: 'project-1',
};
const todosTool: ToolInfo = {
  id: 'tool-1',
  baseUrl: 'http://upstream.test',
  timeoutMs: 1000,
};

// Fake helpers: each one is a plain object with the methods ProxyService uses.
function makeService(options: {
  run?: RunInfo | null;
  tool?: ToolInfo | null;
  send?: UpstreamClient['send'];
}) {
  const targets = {
    findRun: vi.fn().mockResolvedValue(options.run ?? null),
    findTool: vi.fn().mockResolvedValue(options.tool ?? null),
  } as unknown as TargetProvider;
  const upstream = {
    send: options.send ?? vi.fn(),
  } as unknown as UpstreamClient;
  const record = vi.fn().mockResolvedValue(undefined);
  const recorder = { record } as unknown as TraceRecorder;

  return { service: new ProxyService(targets, upstream, recorder), record };
}

const getTodo = {
  runId: RUN_ID,
  toolSlug: 'todos',
  method: 'GET',
  path: '/todos/1',
};

describe('ProxyService', () => {
  it('returns 404 when the run does not exist', async () => {
    const { service } = makeService({ run: null });

    const result = await service.forward(getTodo);

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'RUN_NOT_FOUND' });
  });

  it('returns 409 when the run is not running', async () => {
    const { service } = makeService({
      run: { ...runningRun, status: 'COMPLETED' },
    });

    const result = await service.forward(getTodo);

    expect(result.status).toBe(409);
    expect(JSON.parse(result.body)).toEqual({ error: 'RUN_NOT_RUNNING' });
  });

  it('returns 404 when the tool does not exist', async () => {
    const { service, record } = makeService({ run: runningRun, tool: null });

    const result = await service.forward({ ...getTodo, toolSlug: 'email' });

    expect(result.status).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'TOOL_NOT_FOUND' });
    expect(record).not.toHaveBeenCalled();
  });

  it("forwards to the tool's base URL and records a trace", async () => {
    const send = vi.fn().mockResolvedValue({
      status: 200,
      contentType: 'application/json',
      body: '{"id":1}',
    });
    const { service, record } = makeService({
      run: runningRun,
      tool: todosTool,
      send,
    });

    const result = await service.forward(getTodo);

    expect(send).toHaveBeenCalledWith(
      'http://upstream.test/todos/1',
      'GET',
      1000,
    );
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"id":1}');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: RUN_ID,
        toolId: 'tool-1',
        path: '/todos/1',
        responseStatus: 200,
      }),
    );
  });

  it('returns 502 when the upstream is unreachable', async () => {
    const send = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { service, record } = makeService({
      run: runningRun,
      tool: todosTool,
      send,
    });

    const result = await service.forward(getTodo);

    expect(result.status).toBe(502);
    expect(JSON.parse(result.body)).toEqual({ error: 'UPSTREAM_UNREACHABLE' });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ responseStatus: 502 }),
    );
  });
});
