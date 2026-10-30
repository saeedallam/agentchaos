import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { ProxyModule } from './proxy/proxy.module.js';

@Module({
  imports: [PrismaModule, ProxyModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
