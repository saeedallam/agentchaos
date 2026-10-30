import { ProxyService } from './proxy.service.js';

describe('ProxyService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 502 when the upstream is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );
    const service = new ProxyService();

    const result = await service.forward({ method: 'GET', path: '/todos/1' });

    expect(result.status).toBe(502);
    expect(JSON.parse(result.body)).toEqual({ error: 'UPSTREAM_UNREACHABLE' });
  });
});
