import { Module } from '@nestjs/common';
import { FaultRegistry } from './fault-registry.js';

@Module({
  providers: [FaultRegistry],
  exports: [FaultRegistry],
})
export class FaultsModule {}
