import { Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request data, kept in AsyncLocalStorage instead of fields on singleton services.
 * The middleware starts a context for every request; anything running inside that request
 * (guards, pipes, interceptor, controller, service) can read it without it ever being shared
 * between two requests.
 */
export interface RequestContext {
  requestId: string;
  /** true only for the instrumented route when LIFECYCLE_TRACE=true */
  trace: boolean;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();
const lifecycle = new Logger('Lifecycle');

export const requestContext = {
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
};

/** The route whose lifecycle is traced (Section 6, "Lifecycle evidence"). */
export const INSTRUMENTED_ROUTE = { method: 'PATCH', pattern: /^\/api\/requests\/[^/]+$/ };

/**
 * Logs one lifecycle stage of the instrumented route, e.g. "2 guard   JwtAuthGuard -> pass".
 * Does nothing for other routes or when tracing is off.
 */
export function traceStage(stage: string, detail: string): void {
  const ctx = storage.getStore();
  if (!ctx?.trace) return;
  const ms = String(Date.now() - ctx.startedAt).padStart(3);
  lifecycle.log(`[${ctx.requestId.slice(0, 8)}] +${ms}ms  ${stage.padEnd(12)} ${detail}`);
}
