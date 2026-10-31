import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

export interface TraceInput {
  runId: string;
  toolId: string;
  method: string;
  path: string;
  responseStatus: number;
  responseBody: string;
  startedAt: number;
  durationMs: number;
}

// The notebook writer: saves one trace per proxied request.
@Injectable()
export class TraceRecorder {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: TraceInput): Promise<void> {
    // count + 1 can collide under concurrent requests; the unique
    // (run_id, sequence) index rejects the duplicate. Fix later.
    const sequence =
      (await this.prisma.trace.count({ where: { runId: input.runId } })) + 1;

    await this.prisma.trace.create({
      data: {
        runId: input.runId,
        toolId: input.toolId,
        sequence,
        method: input.method,
        path: input.path,
        requestHeaders: {},
        responseStatus: input.responseStatus,
        responseBody: input.responseBody,
        startedAt: new Date(input.startedAt),
        durationMs: input.durationMs,
      },
    });
  }
}
