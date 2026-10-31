import { Injectable } from '@nestjs/common';
import type { FaultPlugin } from './fault.js';
import { LatencyFault } from './latency.fault.js';

@Injectable()
export class FaultRegistry {
  private readonly plugins = new Map<string, FaultPlugin>();

  constructor() {
    this.register(new LatencyFault());
  }

  register(plugin: FaultPlugin) {
    this.plugins.set(plugin.type, plugin);
  }

  get(type: string): FaultPlugin | undefined {
    return this.plugins.get(type);
  }
}
