import { INestApplication } from '@nestjs/common';
import { RequestsService } from '../../src/requests/requests.service';
import { FIXFLOW_STORE } from '../../src/storage/fixflow-store.interface';
import { InMemoryFixflowStore } from '../../src/storage/in-memory-fixflow.store';
import { FakeFixflowStore } from '../fakes/fake-fixflow.store';
import { api, auth, createTestApp, login, newRequest } from '../helpers';

/**
 * [S10] Storage-provider replacement: the FIXFLOW_STORE binding is replaced with FakeFixflowStore
 * in the testing module. No service, controller or module file is edited.
 */
describe('[S10] Replacing the FIXFLOW_STORE binding', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createTestApp({ store: FakeFixflowStore })));
  afterAll(() => app.close());

  it('Nest injects the fake under the token, and the in-memory class is not used', () => {
    const store = app.get(FIXFLOW_STORE);
    expect(store).toBeInstanceOf(FakeFixflowStore);
    expect(store).not.toBeInstanceOf(InMemoryFixflowStore);
  });

  it('GET /api/health reports the fake driver', async () => {
    const res = await api(app).get('/api/health');
    expect(res.body.data.storage).toBe('fake-array-store (test double)');
  });

  it('the unchanged business services run the full workflow on the fake store', async () => {
    const fake = app.get<FakeFixflowStore>(FIXFLOW_STORE);
    fake.calls.length = 0;
    const [usman, dispatcher, bilal] = await Promise.all([login(app, 'usman'), login(app, 'dispatcher'), login(app, 'bilal')]);
    const created = await api(app).post('/api/requests').set(auth(usman)).send(newRequest({ categoryId: 1 }));
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    await api(app).post(`/api/requests/${id}/assign`).set(auth(dispatcher)).send({ technicianId: 5 }).expect(200);
    await api(app).post(`/api/requests/${id}/start`).set(auth(bilal)).expect(200);
    // business rules still apply on the fake: a technician who is not assigned is refused
    await api(app).post(`/api/requests/${id}/start`).set(auth(await login(app, 'zara'))).expect(403);

    expect(fake.calls).toEqual(expect.arrayContaining(['createRequest', 'applyRequestChange', 'runExclusive', 'findUserById']));
    console.log(`FakeFixflowStore received ${fake.calls.length} calls, e.g.: ${[...new Set(fake.calls)].join(', ')}`);
  });

  it('RequestsService itself received the fake through constructor injection', () => {
    const service = app.get(RequestsService) as unknown as { store: unknown };
    expect(service.store).toBe(app.get(FIXFLOW_STORE));
  });
});
