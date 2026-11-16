import { INestApplication } from '@nestjs/common';
import { AccountName, api, auth, createRequest, createTestApp, loginAll, newRequest } from '../helpers';

/** [S4] Reject short descriptions, unknown fields, malformed ids, invalid enums and invalid pagination. */
describe('[S4] Input validation (400)', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
  });
  afterAll(() => app.close());

  const create = (body: Record<string, unknown>) => api(app).post('/api/requests').set(auth(t.usman)).send(body);

  it('rejects a short description, title, building and empty room', async () => {
    for (const [field, value] of [['description', 'Too short to be useful'.slice(0, 15)], ['title', 'Fan'], ['building', 'A'], ['room', '']] as const) {
      const res = await create(newRequest({ [field]: value }));
      expect(res.status).toBe(400);
      expect(res.body.message.join(' ')).toContain(field);
    }
  });

  it('trims text before measuring and rejects whitespace-only values', async () => {
    const res = await create(newRequest({ title: '      ', description: `   ${'x'.repeat(10)}            ` }));
    expect(res.status).toBe(400);
    expect(res.body.message.join(' ')).toMatch(/title must be 5-100.*description must be 20-1000/s);
  });

  it('rejects unknown and server-owned body fields', async () => {
    for (const extra of [{ status: 'CLOSED' }, { requesterId: 1 }, { assignedTechnicianId: 5 }, { createdAt: '2026-01-01' }, { history: [] }, { colour: 'red' }]) {
      const res = await create(newRequest(extra));
      expect(res.status).toBe(400);
      expect(res.body.message.join(' ')).toMatch(/should not exist/);
    }
  });

  it('rejects malformed route ids before the controller runs', async () => {
    for (const bad of ['abc', '1.5', '0', '-3', '1e3', '0x10', '%201']) {
      const res = await api(app).get(`/api/requests/${bad}`).set(auth(t.dispatcher));
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be a positive integer/);
    }
  });

  it('rejects invalid enum values in bodies and filters', async () => {
    expect((await create(newRequest({ priority: 'URGENT' }))).status).toBe(400);
    expect((await create(newRequest({ priority: 'high' }))).status).toBe(400);
    expect((await api(app).get('/api/requests?status=DONE').set(auth(t.dispatcher))).status).toBe(400);
    expect((await api(app).get('/api/requests?priority=CRITICAL').set(auth(t.dispatcher))).status).toBe(400);
  });

  it('rejects invalid pagination: page < 1, limit outside 1-50, fractions and text', async () => {
    for (const q of ['page=0', 'page=-1', 'limit=0', 'limit=51', 'limit=2.5', 'page=abc', 'page=1e2', 'categoryId=1.5', 'categoryId=x', 'unknown=1']) {
      const res = await api(app).get(`/api/requests?${q}`).set(auth(t.dispatcher));
      expect(res.status).toBe(400);
    }
    const ok = await api(app).get('/api/requests?page=2&limit=50').set(auth(t.dispatcher));
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ page: 2, limit: 50 });
  });

  it('requires numeric ids in bodies to be real positive integers', async () => {
    for (const categoryId of ['3', 3.5, 0, -1, null]) expect((await create(newRequest({ categoryId }))).status).toBe(400);
    const id = await createRequest(app, t.usman);
    for (const technicianId of ['5', 5.5, 0]) {
      expect((await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId })).status).toBe(400);
    }
  });

  it('validates updates as carefully as creation, and rejects an empty update body', async () => {
    const id = await createRequest(app, t.usman);
    const patch = (body: unknown) => api(app).patch(`/api/requests/${id}`).set(auth(t.usman)).send(body as object);
    expect((await patch({})).status).toBe(400);
    expect((await patch({})).body.message).toMatch(/at least one field/);
    expect((await patch({ description: 'short' })).status).toBe(400);
    expect((await patch({ status: 'CLOSED' })).status).toBe(400);
    expect((await patch({ requesterId: 1 })).status).toBe(400);
    expect((await patch({ assignedTechnicianId: 5 })).status).toBe(400);
    expect((await patch({ priority: 'NOPE' })).status).toBe(400);
  });

  it('category rules: names 3-50, descriptions 10-300, active must be a real boolean', async () => {
    const post = (body: object) => api(app).post('/api/categories').set(auth(t.dispatcher)).send(body);
    expect((await post({ name: 'AC', description: 'Air conditioning units.' })).status).toBe(400);
    expect((await post({ name: 'Painting', description: 'Too short' })).status).toBe(400);
    expect((await post({ name: 'Painting', description: 'Walls, doors and railings.', active: 'true' })).status).toBe(400);
    expect((await api(app).patch('/api/categories/1').set(auth(t.dispatcher)).send({ active: 'false' })).status).toBe(400);
    expect((await api(app).patch('/api/categories/1').set(auth(t.dispatcher)).send({})).status).toBe(400);
  });

  it('feedback: rating must be an integer 1-5 and the comment at most 500 characters', async () => {
    for (const body of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: '5' }, { rating: 5, comment: 'x'.repeat(501) }, { rating: 5, comment: '   ' }]) {
      expect((await api(app).post('/api/requests/5/feedback').set(auth(t.ali)).send(body)).status).toBe(400);
    }
  });
});
