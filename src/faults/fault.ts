// What a fault tells the proxy to do next.
export type FaultOutcome =
  { kind: 'continue' } | { kind: 'respond'; status: number; body: string };

// Every fault type (latency, http_error, ...) is a class with this shape.
export interface FaultPlugin {
  readonly type: string;
  apply(config: Record<string, unknown>): Promise<FaultOutcome>;
}
