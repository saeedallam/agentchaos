import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { PlannedFault } from '../faults/fault-planner.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface TraceInput {
  runId: string;
  toolId: string;
  sequence: number;
  method: string;
  path: string;
  responseStatus: number;
  responseBody: string;
  startedAt: number;
  durationMs: number;
  faults: PlannedFault[];
}

// The notebook writer: saves one trace per proxied request,
// plus one trace_faults row for every fault that was applied.
@Injectable()
export class TraceRecorder {
  constructor(private readonly prisma: PrismaService) {}

  // The number of the next request in this run.
  // count + 1 can collide under concurrent requests; the unique
  // (run_id, sequence) index rejects the duplicate. Fix later.
  async nextSequence(runId: string): Promise<number> {
    return (await this.prisma.trace.count({ where: { runId } })) + 1;
  }

  async record(input: TraceInput): Promise<void> {
    await this.prisma.trace.create({
      data: {
        runId: input.runId,
        toolId: input.toolId,
        sequence: input.sequence,
        method: input.method,
        path: input.path,
        requestHeaders: {},
        responseStatus: input.responseStatus,
        responseBody: input.responseBody,
        startedAt: new Date(input.startedAt),
        durationMs: input.durationMs,
        faults: {
          create: input.faults.map((fault) => ({
            ruleId: fault.ruleId,
            faultType: fault.type,
            config: fault.config as Prisma.InputJsonValue,
          })),
        },
      },
    });
  }
}
