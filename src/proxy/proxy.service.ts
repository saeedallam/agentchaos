import { Injectable } from '@nestjs/common';
import { TraceRecorder } from '../traces/trace.recorder.js';
import { TargetProvider } from './target.provider.js';
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

// The manager: decides the order of steps and hands each one to a helper.
@Injectable()
export class ProxyService {
  constructor(
    private readonly targets: TargetProvider,
    private readonly upstream: UpstreamClient,
    private readonly recorder: TraceRecorder,
  ) {}

  async forward(request: ProxyRequest): Promise<ProxyResult> {
    const startedAt = Date.now();

    // 1) Which run is this request part of?
    const run = await this.targets.findRun(request.runId);
    if (!run) {
      return errorResult(404, 'RUN_NOT_FOUND', startedAt);
    }
    if (run.status !== 'RUNNING') {
      return errorResult(409, 'RUN_NOT_RUNNING', startedAt);
    }

    // 2) Which tool is the agent calling?
    const tool = await this.targets.findTool(run.projectId, request.toolSlug);
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
    await this.recorder.record({
      runId: run.id,
      toolId: tool.id,
      method: request.method,
      path: request.path,
      responseStatus: result.status,
      responseBody: result.body,
      startedAt,
      durationMs: result.durationMs,
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
