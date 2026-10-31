// Which faults apply to one request.
// Pure: no NestJS, no Prisma, no I/O. Same input, same output, always.

import { roll } from './seeded-random.js';

export interface FaultTarget {
  tool: string;
  path?: string; // exact path, or a prefix ending with *, like '/forecast*'
}

export function matchesTarget(
  target: FaultTarget,
  toolSlug: string,
  path: string,
): boolean {
  // Question 1: is it the right kitchen?
  if (target.tool !== toolSlug) {
    return false;
  }

  // Question 2: is it the right dish?
  // No path in the rule: every dish from this kitchen matches.
  if (!target.path) {
    return true;
  }

  // '/forecast*' matches anything that starts with '/forecast'.
  if (target.path.endsWith('*')) {
    const prefix = target.path.slice(0, -1);
    return path.startsWith(prefix);
  }

  // Otherwise the path must be exactly the same.
  return path === target.path;
}

// One rule from the scenario YAML.
export interface FaultRule {
  id: string;
  type: string;
  target: FaultTarget;
  probability: number; // 0 = never, 1 = always
  config: Record<string, unknown>;
}

// A fault that will happen on this request.
export interface PlannedFault {
  ruleId: string;
  type: string;
  config: Record<string, unknown>;
}

// What we know about the request when planning.
export interface PlanContext {
  toolSlug: string;
  path: string;
  seed: number;
  sequence: number;
}

// The rule sheet: asks the three questions for every rule.
export function planFaults(
  rules: FaultRule[],
  context: PlanContext,
): PlannedFault[] {
  const planned: PlannedFault[] = [];

  for (const rule of rules) {
    // Questions 1 and 2: right kitchen, right dish?
    if (!matchesTarget(rule.target, context.toolSlug, context.path)) {
      continue;
    }

    // Question 3: did the dice land right?
    const dice = roll(context.seed, context.sequence, rule.id);
    if (dice >= rule.probability) {
      continue;
    }

    planned.push({ ruleId: rule.id, type: rule.type, config: rule.config });
  }

  return planned;
}
