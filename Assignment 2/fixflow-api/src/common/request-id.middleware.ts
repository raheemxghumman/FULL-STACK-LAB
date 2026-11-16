import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { INSTRUMENTED_ROUTE, requestContext, traceStage } from './request-context';

/**
 * Runs first for every request (bound to all routes in AppModule.configure).
 *  - generates a request id, attaches it to the request and returns it in X-Request-Id
 *  - logs method, path, final status code and duration when the response finishes. This runs on
 *    the response's "finish" event, so it also logs requests rejected by a guard, a pipe or a 404,
 *    which never reach the interceptor.
 * Only the path is logged (no query string, body or headers), so passwords and tokens never appear.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly config: ConfigService) {}

  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const path = req.originalUrl.split('?')[0];
    const trace =
      this.config.get<boolean>('LIFECYCLE_TRACE') === true &&
      req.method === INSTRUMENTED_ROUTE.method &&
      INSTRUMENTED_ROUTE.pattern.test(path);

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const ms = Date.now() - startedAt;
      requestContext.run({ requestId, trace, startedAt }, () =>
        traceStage('7 finish', `middleware "finish" event -> ${res.statusCode}`),
      );
      this.logger.log(`${req.method} ${path} ${res.statusCode} ${ms}ms rid=${requestId}`);
    });

    requestContext.run({ requestId, trace, startedAt }, () => {
      traceStage('1 middleware', `RequestIdMiddleware -> id assigned, X-Request-Id header set`);
      next();
    });
  }
}
