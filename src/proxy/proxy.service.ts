import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

export interface ProxyRequest {
  runId: string;
  toolSlug: string;
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
  constructor(private readonly prisma: PrismaService) {}

  async forward(request: ProxyRequest): Promise<ProxyResult> {
    const startedAt = Date.now();

    // 1) Which run is this request part of?
    const run = await this.prisma.run.findUnique({
      where: { id: request.runId },
      include: { scenario: { select: { projectId: true } } },
    });
    if (!run) {
      return errorResult(404, 'RUN_NOT_FOUND', startedAt);
    }
    if (run.status !== 'RUNNING') {
      return errorResult(409, 'RUN_NOT_RUNNING', startedAt);
    }

    // 2) Which tool is the agent calling?
    const tool = await this.prisma.tool.findUnique({
      where: {
        projectId_slug: {
          projectId: run.scenario.projectId,
          slug: request.toolSlug,
        },
      },
    });
    if (!tool) {
      return errorResult(404, 'TOOL_NOT_FOUND', startedAt);
    }

    // 3) Forward to the real tool
    try {
      const upstreamRes = await fetch(tool.baseUrl + request.path, {
        method: request.method,
        signal: AbortSignal.timeout(tool.timeoutMs),
      });

      return {
        status: upstreamRes.status,
        contentType: upstreamRes.headers.get('content-type') ?? 'text/plain',
        body: await upstreamRes.text(),
        durationMs: Date.now() - startedAt,
      };
    } catch {
      return errorResult(502, 'UPSTREAM_UNREACHABLE', startedAt);
    }
  }
}

function errorResult(
  status: number,
  error: string,
  startedAt: number,
): ProxyResult {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({ error }),
    durationMs: Date.now() - startedAt,
  };
}
