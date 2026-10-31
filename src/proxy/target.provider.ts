import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

export interface RunInfo {
  id: string;
  status: string;
  projectId: string;
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
