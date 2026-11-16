import { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { FIXFLOW_STORE } from '../src/storage/fixflow-store.interface';

/** Demo accounts from the seed (src/seed/seed-data.ts). */
export const ACCOUNTS = {
  dispatcher: { id: 1, email: 'dispatcher@fixflow.test', password: 'Dispatch2026' },
  ali: { id: 2, email: 'ali@fixflow.test', password: 'Requester2026' },
  sara: { id: 3, email: 'sara@fixflow.test', password: 'Requester2026' },
  usman: { id: 4, email: 'usman@fixflow.test', password: 'Requester2026' },
  bilal: { id: 5, email: 'bilal@fixflow.test', password: 'Technician2026' }, // Electrical, IT Support
  imran: { id: 6, email: 'imran@fixflow.test', password: 'Technician2026' }, // Plumbing, Furniture
  zara: { id: 7, email: 'zara@fixflow.test', password: 'Technician2026' }, // Electrical, IT, Furniture, HVAC
} as const;
export type AccountName = keyof typeof ACCOUNTS;

/**
 * Builds the real application (same modules, guards, pipes, interceptor and middleware as npm start)
 * with fresh seed data. `store` replaces the FIXFLOW_STORE binding without touching any service.
 */
export async function createTestApp(options: { store?: Type<unknown> } = {}): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.store) builder = builder.overrideProvider(FIXFLOW_STORE).useClass(options.store);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app, { swagger: false });
  await app.init();
  return app;
}

export function api(app: INestApplication) {
  return request(app.getHttpServer());
}

export async function login(app: INestApplication, who: AccountName): Promise<string> {
  const res = await api(app).post('/api/auth/login').send({ email: ACCOUNTS[who].email, password: ACCOUNTS[who].password });
  if (res.status !== 200) throw new Error(`login ${who} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken;
}

/** Logs in every demo account once. */
export async function loginAll(app: INestApplication): Promise<Record<AccountName, string>> {
  const names = Object.keys(ACCOUNTS) as AccountName[];
  const tokens = await Promise.all(names.map((n) => login(app, n)));
  return Object.fromEntries(names.map((n, i) => [n, tokens[i]])) as Record<AccountName, string>;
}

/** A correctly signed token whose expiry is already in the past. */
export function expiredToken(app: INestApplication, userId = 2): string {
  const jwt = app.get(JwtService);
  // same secret as the app, but the expiry is 60 seconds in the past
  return jwt.sign({ sub: userId, role: 'REQUESTER', email: 'ali@fixflow.test' }, { expiresIn: -60 });
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let counter = 0;
/** A valid create-request body; override any field. */
export function newRequest(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    title: `Test request ${counter} projector issue`,
    description: 'The projector flickers every few seconds and then switches itself off.',
    categoryId: 3,
    building: 'Academic Block A',
    room: `A-${counter}`,
    priority: 'MEDIUM',
    ...overrides,
  };
}

/** Creates a request as `token` and returns its id. */
export async function createRequest(app: INestApplication, token: string, overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await api(app).post('/api/requests').set(auth(token)).send(newRequest(overrides));
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id;
}

export async function historyOf(app: INestApplication, token: string, id: number) {
  const res = await api(app).get(`/api/requests/${id}`).set(auth(token));
  return res.body.data.history as Array<{ fromStatus: string | null; toStatus: string; actorId: number; note: string | null }>;
}
