import { Injectable } from '@nestjs/common';
import { FaultRegistry } from '../faults/fault-registry.js';
import { planFaults, type PlannedFault } from '../faults/fault-planner.js';
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
    private readonly faults: FaultRegistry,
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

    // 3) Which faults happen on this request? (the rule sheet)
    const sequence = await this.recorder.nextSequence(run.id);
    const planned = planFaults(run.faultRules, {
      toolSlug: request.toolSlug,
      path: request.path,
      seed: run.seed,
      sequence,
    });

    // 4) Apply them, card by card
    const applied: PlannedFault[] = [];
    let result: ProxyResult | undefined;
    for (const fault of planned) {
      const card = this.faults.get(fault.type);
      if (!card) {
        continue; // unknown type: scenario validation will reject these later
      }

      const outcome = await card.apply(fault.config);
      applied.push(fault);

      if (outcome.kind === 'respond') {
        // The card answers instead of the kitchen.
        result = {
          status: outcome.status,
          contentType: 'application/json',
          body: outcome.body,
          durationMs: Date.now() - startedAt,
        };
        break;
      }
    }

    // 5) Forward to the real tool, unless a card already answered
    if (!result) {
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
    }

    // 6) Write it in the notebook, with the faults that were applied
    await this.recorder.record({
      runId: run.id,
      toolId: tool.id,
      sequence,
      method: request.method,
      path: request.path,
      responseStatus: result.status,
      responseBody: result.body,
      startedAt,
      durationMs: result.durationMs,
      faults: applied,
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
