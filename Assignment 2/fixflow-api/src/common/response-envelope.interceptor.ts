import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, map, throwError } from 'rxjs';
import { traceStage } from './request-context';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  requestId: string;
}

const WRAPPED = Symbol('fixflow.wrapped');

/**
 * Wraps every successful response as { success: true, data, requestId }.
 *  - Only the success path is mapped; errors are re-thrown untouched, so Nest's normal exception
 *    responses (statusCode, message, error) and status codes are kept.
 *  - The status code is never changed (201 stays 201, 200 stays 200).
 *  - A value that is already an envelope is not wrapped a second time.
 * Registered once, globally, with APP_INTERCEPTOR.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ requestId?: string }>();
    traceStage('3 intercept', 'ResponseEnvelopeInterceptor -> before handler (pipes run next)');

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && (data as Record<symbol, unknown>)[WRAPPED]) return data;
        const envelope: SuccessEnvelope<unknown> = { success: true, data: data ?? null, requestId: request.requestId ?? '' };
        Object.defineProperty(envelope, WRAPPED, { value: true, enumerable: false });
        traceStage('6 intercept', 'ResponseEnvelopeInterceptor -> response wrapped { success, data, requestId }');
        return envelope;
      }),
      catchError((err: unknown) => {
        const name = err instanceof Error ? err.constructor.name : 'error';
        traceStage('6 intercept', `ResponseEnvelopeInterceptor -> saw ${name}, re-thrown unchanged (not wrapped)`);
        return throwError(() => err);
      }),
    );
  }
}
