import { INestApplication, LoggerService } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * [S10] Request ids, success wrapping, and lifecycle logs for a success, a 401 and a 400 on the
 * instrumented route (PATCH /api/requests/:id). LIFECYCLE_TRACE is switched on before the app
 * module is loaded, and every log line is captured.
 */
class CaptureLogger implements LoggerService {
  lines: string[] = [];
  log(message: string, context?: string) { this.lines.push(`[${context}] ${message}`); }
  error(message: string, ...rest: unknown[]) { this.lines.push(`[error] ${message} ${rest.join(' ')}`); }
  warn(message: string, context?: string) { this.lines.push(`[${context}] ${message}`); }
  debug() {}
  verbose() {}
}

describe('[S10] Request ids, response wrapping and lifecycle', () => {
  let app: INestApplication;
  const logger = new CaptureLogger();
  let token: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.LIFECYCLE_TRACE = 'true';
    const { AppModule } = await import('../../src/app.module');
    const { configureApp } = await import('../../src/app.setup');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger });
    configureApp(app, { swagger: false });
    await app.init();
    token = (await http().post('/api/auth/login').send({ email: 'ali@fixflow.test', password: 'Requester2026' })).body.data.accessToken;
  });
  afterAll(async () => {
    await app.close();
    process.env.LIFECYCLE_TRACE = 'false';
  });

  /** Sends one request and returns its status, body, request id and its lifecycle log lines. */
  async function traced(send: () => request.Test) {
    logger.lines.length = 0;
    const res = await send();
    await new Promise((r) => setTimeout(r, 20)); // the "finish" log is written just after the response
    const rid: string = res.headers['x-request-id'];
    const lines = logger.lines.filter((l) => l.includes(rid.slice(0, 8)) || l.includes(rid));
    return { res, rid, lines, stages: lines.filter((l) => l.startsWith('[Lifecycle]')).map((l) => l.replace(/^.*\+\s*\d+ms\s+/, '')) };
  }

  it('returns a unique X-Request-Id on every response, including errors', async () => {
    const a = await http().get('/api/health');
    const b = await http().get('/api/requests');
    expect(a.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(b.status).toBe(401);
    expect(b.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });

  it('wraps successes as { success, data, requestId } and keeps the status code', async () => {
    const res = await http().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: expect.objectContaining({ status: 'ok' }), requestId: res.headers['x-request-id'] });
    const created = await http().post('/api/auth/register').send({ fullName: 'Wrap Check', email: 'wrap@x.test', password: 'Campus2026' });
    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.success).toBeUndefined(); // wrapped exactly once
  });

  it('does not wrap errors: standard Nest error bodies', async () => {
    const res = await http().get('/api/requests/9999').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ statusCode: 404, message: 'Request 9999 not found.', error: 'Not Found' });
  });

  it('success: middleware -> guards -> interceptor -> pipes -> controller -> service -> interceptor -> finish', async () => {
    const { res, stages, lines } = await traced(() =>
      http().patch('/api/requests/1').set('Authorization', `Bearer ${token}`).send({ room: 'CS Lab 3 (front)' }),
    );
    expect(res.status).toBe(200);
    expect(stages.slice(0, 4)).toEqual([
      expect.stringMatching(/^1 middleware\s+RequestIdMiddleware/),
      expect.stringMatching(/^2 guard\s+JwtAuthGuard -> pass/),
      expect.stringMatching(/^2 guard\s+RolesGuard -> pass/),
      expect.stringMatching(/^3 intercept\s+ResponseEnvelopeInterceptor -> before/),
    ]);
    // Nest resolves the handler's arguments with Promise.all, so the param pipe and the body pipe may log in either order
    expect(stages.slice(4, 6).sort()).toEqual([
      expect.stringMatching(/^4 pipe\s+ParsePositiveIntPipe\(id\) -> "1" became 1/),
      expect.stringMatching(/^4 pipe\s+ValidationPipe\(UpdateRequestDto\) -> body valid/),
    ]);
    expect(stages.slice(6)).toEqual([
      expect.stringMatching(/^5 controller\s+RequestsController.update/),
      expect.stringMatching(/^5 service\s+RequestsService.update/),
      expect.stringMatching(/^6 intercept\s+ResponseEnvelopeInterceptor -> response wrapped/),
      expect.stringMatching(/^7 finish\s+middleware "finish" event -> 200/),
    ]);
    expect(lines.some((l) => /\[HTTP\] PATCH \/api\/requests\/1 200 \d+ms rid=/.test(l))).toBe(true);
    console.log(['SUCCESS (200)', ...lines].join('\n'));
  });

  it('401: the guard rejects; interceptor, pipes, controller and service are skipped; finish still logs', async () => {
    const { res, stages, lines } = await traced(() => http().patch('/api/requests/1').send({ room: 'X-1' }));
    expect(res.status).toBe(401);
    expect(stages).toEqual([
      expect.stringMatching(/^1 middleware/),
      expect.stringMatching(/^2 guard\s+JwtAuthGuard -> no bearer token \(401\)/),
      expect.stringMatching(/^7 finish\s+middleware "finish" event -> 401/),
    ]);
    expect(lines.join('\n')).not.toMatch(/Bearer|eyJ/); // no tokens or authorization headers in logs
    console.log(['AUTH FAILURE (401)', ...lines].join('\n'));
  });

  it('400: guards and interceptor pass, the ValidationPipe rejects; controller and service are skipped', async () => {
    const { res, stages, lines } = await traced(() =>
      http().patch('/api/requests/1').set('Authorization', `Bearer ${token}`).send({ description: 'too short', status: 'CLOSED' }),
    );
    expect(res.status).toBe(400);
    expect(stages.slice(0, 4)).toEqual([
      expect.stringMatching(/^1 middleware/),
      expect.stringMatching(/^2 guard\s+JwtAuthGuard -> pass/),
      expect.stringMatching(/^2 guard\s+RolesGuard -> pass/),
      expect.stringMatching(/^3 intercept\s+ResponseEnvelopeInterceptor -> before/),
    ]);
    expect(stages).toContainEqual(expect.stringMatching(/^4 pipe\s+ValidationPipe\(UpdateRequestDto\) -> invalid body \(400\)/));
    expect(stages.join(' | ')).not.toMatch(/controller|service|response wrapped/); // skipped after the rejection
    expect(stages.slice(-2)).toEqual([
      expect.stringMatching(/^6 intercept\s+ResponseEnvelopeInterceptor -> saw BadRequestException, re-thrown unchanged/),
      expect.stringMatching(/^7 finish\s+middleware "finish" event -> 400/),
    ]);
    console.log(['VALIDATION FAILURE (400)', ...lines].join('\n'));
  });

  it('logs requests that never reach a controller (unknown route 404)', async () => {
    logger.lines.length = 0;
    const res = await http().get('/api/nope');
    await new Promise((r) => setTimeout(r, 20));
    expect(res.status).toBe(404);
    expect(logger.lines.some((l) => /\[HTTP\] GET \/api\/nope 404/.test(l))).toBe(true);
  });

  it('never logs passwords', async () => {
    logger.lines.length = 0;
    await http().post('/api/auth/login').send({ email: 'ali@fixflow.test', password: 'Requester2026' });
    await new Promise((r) => setTimeout(r, 20));
    expect(logger.lines.join('\n')).not.toContain('Requester2026');
  });
});
