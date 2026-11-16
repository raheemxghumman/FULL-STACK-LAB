import { INestApplication } from '@nestjs/common';
import { AccountName, api, auth, createRequest, createTestApp, loginAll, newRequest } from '../helpers';

/** [S9] Search, filters and pagination together; user scoping, totals, category deactivation, seed reset. */
describe('[S9] Discovery, categories and reset', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
    // 12 projector requests from Ali and Sara, alternating priority
    for (let i = 0; i < 6; i++) {
      await createRequest(app, i < 3 ? t.ali : t.sara, { title: `Projector fault number ${i + 1}`, categoryId: 3, priority: i % 2 ? 'HIGH' : 'LOW' });
    }
  });
  afterAll(() => app.close());

  it('case-insensitive title search + category + status + priority, applied together', async () => {
    const res = await api(app).get('/api/requests?q=PROJECTOR&categoryId=3&status=OPEN&priority=HIGH').set(auth(t.dispatcher));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(4); // 3 new HIGH requests + seed request 1 ("Projector not turning on", HIGH)
    for (const r of res.body.data.items) {
      expect(r.title.toLowerCase()).toContain('projector');
      expect(r).toMatchObject({ categoryId: 3, status: 'OPEN', priority: 'HIGH' });
    }
  });

  it('scopes to the caller BEFORE counting and paginating', async () => {
    const ali = await api(app).get('/api/requests?q=projector').set(auth(t.ali));
    expect(ali.body.data.total).toBe(4); // seed request 1 + 3 new; Sara's are never counted
    expect(ali.body.data.items.every((r: { requesterId: number }) => r.requesterId === 2)).toBe(true);
    const all = await api(app).get('/api/requests?q=projector').set(auth(t.dispatcher));
    expect(all.body.data.total).toBe(7);
  });

  it('paginates newest first with id as tie-breaker, defaults page 1 / limit 10', async () => {
    const first = (await api(app).get('/api/requests').set(auth(t.dispatcher))).body.data;
    expect(first).toMatchObject({ page: 1, limit: 10, total: 13, totalPages: 2 });
    expect(first.items).toHaveLength(10);
    const second = (await api(app).get('/api/requests?page=2').set(auth(t.dispatcher))).body.data;
    expect(second.items).toHaveLength(3);
    const ids = [...first.items, ...second.items].map((r: { id: number }) => r.id);
    expect(new Set(ids).size).toBe(13); // no duplicates across pages
    const created = [...first.items, ...second.items].map((r: { createdAt: string; id: number }) => `${r.createdAt}#${String(r.id).padStart(4, '0')}`);
    expect(created).toEqual([...created].sort().reverse());
    const page3 = (await api(app).get('/api/requests?page=3').set(auth(t.dispatcher))).body.data;
    expect(page3.items).toEqual([]);
  });

  it('details return the request, current assignment and chronological history', async () => {
    const d = (await api(app).get('/api/requests/3').set(auth(t.sara))).body.data;
    expect(d.request.id).toBe(3);
    expect(d.assignment).toMatchObject({ technicianId: 5, clearedAt: null });
    expect(d.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS']);
  });

  it('category management: create, unique name, update, deactivate, list active only', async () => {
    const created = await api(app).post('/api/categories').set(auth(t.dispatcher)).send({ name: 'Painting', description: 'Walls, doors and railings.' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ id: 6, name: 'Painting', active: true });
    await api(app).post('/api/categories').set(auth(t.dispatcher)).send({ name: 'painting', description: 'Duplicate in lower case.' }).expect(409);
    await api(app).patch('/api/categories/6').set(auth(t.dispatcher)).send({ description: 'Interior and exterior painting work.' }).expect(200);
    await api(app).patch('/api/categories/99').set(auth(t.dispatcher)).send({ active: false }).expect(404);

    const names = (await api(app).get('/api/categories').set(auth(t.ali))).body.data.map((c: { name: string }) => c.name);
    expect(names).toEqual(['Electrical', 'Plumbing', 'IT Support', 'Furniture', 'Painting']); // HVAC is inactive
    await api(app).get('/api/categories?includeInactive=true').set(auth(t.ali)).expect(403);
    expect((await api(app).get('/api/categories?includeInactive=true').set(auth(t.dispatcher))).body.data).toHaveLength(6);
  });

  it('deactivating a category blocks new requests but keeps historical ones', async () => {
    const res = await api(app).patch('/api/categories/2').set(auth(t.dispatcher)).send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
    const blocked = await api(app).post('/api/requests').set(auth(t.usman)).send(newRequest({ categoryId: 2 }));
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toMatch(/deactivated/);
    // request 2 (Plumbing) still exists and can still be read and filtered
    await api(app).get('/api/requests/2').set(auth(t.ali)).expect(200);
    expect((await api(app).get('/api/requests?categoryId=2').set(auth(t.dispatcher))).body.data.total).toBe(1);
    // the seed's HVAC request (inactive category) is also kept
    expect((await api(app).get('/api/requests/6').set(auth(t.sara))).body.data.category).toMatchObject({ name: 'HVAC', active: false });
  });

  it('record ids are unique per entity type and never reused', async () => {
    const a = await createRequest(app, t.usman);
    await api(app).post(`/api/requests/${a}/cancel`).set(auth(t.usman)).expect(200);
    const b = await createRequest(app, t.usman);
    expect(b).toBe(a + 1);
  });

  it('a fresh start resets all data to the seed', async () => {
    const fresh = await createTestApp();
    const token = (await api(fresh).post('/api/auth/login').send({ email: 'dispatcher@fixflow.test', password: 'Dispatch2026' })).body.data.accessToken;
    expect((await api(fresh).get('/api/requests').set(auth(token))).body.data.total).toBe(7);
    expect((await api(fresh).get('/api/categories').set(auth(token))).body.data.map((c: { name: string }) => c.name)).toContain('Plumbing');
    await fresh.close();
  });
});
