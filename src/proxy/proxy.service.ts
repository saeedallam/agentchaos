import { Injectable } from '@nestjs/common';

// Temporary: a later step reads this from the tools table.
const UPSTREAM = 'http://localhost:5000';

export interface ProxyRequest {
  method: string;
  path: string;
}

export interface ProxyResult {
  status: number;
  contentType: string;
  body: string;
  durationMs: number;
}

@Injectable()
export class ProxyService {
  async forward(request: ProxyRequest): Promise<ProxyResult> {
    const startedAt = Date.now();

    try {
      const upstreamRes = await fetch(UPSTREAM + request.path, {
        method: request.method,
        signal: AbortSignal.timeout(10_000),
      });

      return {
        status: upstreamRes.status,
        contentType: upstreamRes.headers.get('content-type') ?? 'text/plain',
        body: await upstreamRes.text(),
        durationMs: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'UPSTREAM_UNREACHABLE' }),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}
