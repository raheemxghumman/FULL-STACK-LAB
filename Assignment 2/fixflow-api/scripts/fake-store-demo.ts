/**
 * npm run demo:fake-store
 *
 * Starts the real AppModule with ONE change: the FIXFLOW_STORE token is bound to FakeFixflowStore
 * (test/fakes) instead of InMemoryFixflowStore. No service, controller or module file is edited.
 * Then it runs a short workflow over HTTP and prints which store answered.
 */
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { FIXFLOW_STORE } from '../src/storage/fixflow-store.interface';
import { FakeFixflowStore } from '../test/fakes/fake-fixflow.store';

async function main() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FIXFLOW_STORE) // <- the only difference from `npm start`
    .useClass(FakeFixflowStore)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app, { swagger: false });
  await app.listen(0);
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;

  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, body: (await res.json()) as any };
  };

  const fake = app.get<FakeFixflowStore>(FIXFLOW_STORE);
  console.log(`Bound to FIXFLOW_STORE: ${fake.constructor.name}`);
  console.log(`GET /api/health -> storage: "${(await call('GET', '/health')).body.data.storage}"`);

  const login = async (email: string, password: string) => (await call('POST', '/auth/login', undefined, { email, password })).body.data.accessToken;
  const usman = await login('usman@fixflow.test', 'Requester2026');
  const dispatcher = await login('dispatcher@fixflow.test', 'Dispatch2026');

  const created = await call('POST', '/requests', usman, {
    title: 'Fake store demo request', description: 'This request is stored by the fake test store.', categoryId: 1, building: 'Demo Block', room: 'F-1', priority: 'LOW',
  });
  console.log(`POST /api/requests -> ${created.status}, id ${created.body.data.id}, status ${created.body.data.status}`);
  const assigned = await call('POST', `/requests/${created.body.data.id}/assign`, dispatcher, { technicianId: 6 });
  console.log(`POST /api/requests/${created.body.data.id}/assign (technician 6, no Electrical) -> ${assigned.status}: ${assigned.body.message}`);
  const ok = await call('POST', `/requests/${created.body.data.id}/assign`, dispatcher, { technicianId: 5 });
  console.log(`POST /api/requests/${created.body.data.id}/assign (technician 5) -> ${ok.status}, status ${ok.body.data.status}`);

  console.log(`\nThe unchanged services made ${fake.calls.length} calls to the fake store:`);
  console.log(`  ${[...new Set(fake.calls)].join(', ')}`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
