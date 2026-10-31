import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller.js';
import { ProxyService } from './proxy.service.js';
import { UpstreamClient } from './upstream.client.js';

@Module({
  controllers: [ProxyController],
  providers: [ProxyService, UpstreamClient],
})
export class ProxyModule {}
