import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { FaultRule } from '../faults/fault-planner.js';

export interface RunInfo {
  id: string;
  status: string;
  projectId: string;
  seed: number;
  faultRules: FaultRule[];
}

export interface ToolInfo {
  id: string;
  baseUrl: string;
  timeoutMs: number;
}

// The reservations desk: looks up the run and the tool for a request.
// Returns plain objects, so callers never see Prisma types.
@Injectable()
export class TargetProvider {
  constructor(private readonly prisma: PrismaService) {}

  async findRun(runId: string): Promise<RunInfo | null> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { scenario: { select: { projectId: true } } },
    });
    if (!run) {
      return null;
    }

    return {
      id: run.id,
      status: run.status,
      projectId: run.scenario.projectId,
      seed: run.seed,
      faultRules: faultRulesFrom(run.scenarioSnapshot),
    };
  }

  async findTool(projectId: string, slug: string): Promise<ToolInfo | null> {
    const tool = await this.prisma.tool.findUnique({
      where: { projectId_slug: { projectId, slug } },
    });
    if (!tool) {
      return null;
    }

    return { id: tool.id, baseUrl: tool.baseUrl, timeoutMs: tool.timeoutMs };
  }
}

// The run's scenario snapshot is stored as JSON. Until scenario validation
// exists (YAML step), trust its "faults" array and ignore anything else.
function faultRulesFrom(snapshot: unknown): FaultRule[] {
  if (
    typeof snapshot === 'object' &&
    snapshot !== null &&
    'faults' in snapshot &&
    Array.isArray(snapshot.faults)
  ) {
    return snapshot.faults as FaultRule[];
  }
  return [];
}
