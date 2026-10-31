import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { UpstreamClient } from './upstream.client.js';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly upstream: UpstreamClient,
  ) {}

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
    let result: ProxyResult;
    try {
      const response = await this.upstream.send(
        tool.baseUrl + request.path,
        request.method,
        tool.timeoutMs,
      );

      result = {
        status: response.status,
        contentType: response.contentType,
        body: response.body,
        durationMs: Date.now() - startedAt,
      };
    } catch {
      result = errorResult(502, 'UPSTREAM_UNREACHABLE', startedAt);
    }

    // 4) Write it in the notebook: one trace per request
    const sequence =
      (await this.prisma.trace.count({ where: { runId: run.id } })) + 1;

    await this.prisma.trace.create({
      data: {
        runId: request.runId,
        toolId: tool.id,
        sequence,
        method: request.method,
        path: request.path,
        requestHeaders: {},
        responseStatus: result.status,
        responseBody: result.body,
        startedAt: new Date(startedAt),
        durationMs: result.durationMs,
      },
    });

    return result;
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
