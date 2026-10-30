import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

// Temporary: the next step reads this from the tools table.
const UPSTREAM = 'http://localhost:5000';

@Controller('proxy')
export class ProxyController {
  @All('*path')
  async forward(@Req() req: Request, @Res() res: Response) {
    const startedAt = Date.now();
    const path = req.url.replace(/^\/proxy/, '');

    try {
      const upstreamRes = await fetch(UPSTREAM + path, {
        method: req.method,
        signal: AbortSignal.timeout(10_000),
      });
      const body = await upstreamRes.text();

      res
        .status(upstreamRes.status)
        .type(upstreamRes.headers.get('content-type') ?? 'text/plain')
        .send(body);

      console.log(
        `${req.method} ${path} -> ${upstreamRes.status} in ${Date.now() - startedAt}ms`,
      );
    } catch {
      res.status(502).json({ error: 'UPSTREAM_UNREACHABLE' });
    }
  }
}
