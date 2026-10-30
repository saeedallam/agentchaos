import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ProxyService } from './proxy.service.js';

@Controller('proxy')
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*path')
  async forward(@Req() req: Request, @Res() res: Response) {
    const path = req.url.replace(/^\/proxy/, '');
    const result = await this.proxy.forward({ method: req.method, path });

    res.status(result.status).type(result.contentType).send(result.body);
    console.log(
      `${req.method} ${path} -> ${result.status} in ${result.durationMs}ms`,
    );
  }
}
