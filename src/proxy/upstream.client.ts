import { Injectable } from '@nestjs/common';

export interface UpstreamResponse {
  status: number;
  contentType: string;
  body: string;
}

// The runner to the kitchen: sends one request to the real tool.
// Throws if the tool cannot be reached or does not answer in time.
@Injectable()
export class UpstreamClient {
  async send(
    url: string,
    method: string,
    timeoutMs: number,
  ): Promise<UpstreamResponse> {
    const response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
    });

    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? 'text/plain',
      body: await response.text(),
    };
  }
}
