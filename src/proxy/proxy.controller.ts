import {
  All,
  Controller,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service.js';

@Controller('proxy')
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  // /proxy/:runId/:toolSlug/<path the real tool receives>
  @All(':runId/:toolSlug/*path')
  async forward(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('toolSlug') toolSlug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const prefix = `/proxy/${runId}/${toolSlug}`;
    const path = req.url.slice(prefix.length);

    const result = await this.proxy.forward({
      runId,
      toolSlug,
      method: req.method,
      path,
    });

    res.status(result.status).type(result.contentType).send(result.body);
    console.log(
      `${req.method} [${toolSlug}] ${path} -> ${result.status} in ${result.durationMs}ms`,
    );
  }
}
