// Which faults apply to one request.
// Pure: no NestJS, no Prisma, no I/O. Same input, same output, always.

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
