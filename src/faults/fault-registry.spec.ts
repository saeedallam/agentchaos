import { FaultRegistry } from './fault-registry.js';
import { HttpErrorFault } from './http-error.fault.js';
import { LatencyFault } from './latency.fault.js';

describe('FaultRegistry', () => {
  it('finds the latency card by its type', () => {
    const registry = new FaultRegistry();

    expect(registry.get('latency')).toBeInstanceOf(LatencyFault);
  });

  it('finds the http_error card by its type', () => {
    const registry = new FaultRegistry();

    expect(registry.get('http_error')).toBeInstanceOf(HttpErrorFault);
  });

  it('returns undefined for an unknown type', () => {
    const registry = new FaultRegistry();

    expect(registry.get('slow_dns')).toBeUndefined();
  });
});
