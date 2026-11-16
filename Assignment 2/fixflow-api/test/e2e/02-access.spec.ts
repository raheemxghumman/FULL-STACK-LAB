import { INestApplication } from '@nestjs/common';
import { AccountName, api, auth, createTestApp, loginAll } from '../helpers';

/** [S2b] Reject cross-role operations; prevent access to another requester's record. */
describe('[S2] Roles and record ownership', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
  });
  afterAll(() => app.close());

  it("prevents a requester from reading another requester's record (403, not 404)", async () => {
    // request 3 belongs to Sara
    const res = await api(app).get('/api/requests/3').set(auth(t.ali));
    expect(res.status).toBe(403);
    expect(res.body.message).not.toMatch(/IN_PROGRESS/); // authorization is checked before revealing state
  });

  it("prevents editing, cancelling, closing, reopening or rating another requester's record (403)", async () => {
    await api(app).patch('/api/requests/3').set(auth(t.ali)).send({ room: 'B-205' }).expect(403);
    await api(app).post('/api/requests/3/cancel').set(auth(t.ali)).expect(403);
    await api(app).post('/api/requests/4/close').set(auth(t.ali)).expect(403); // Sara's RESOLVED request
    await api(app).post('/api/requests/4/reopen').set(auth(t.ali)).send({ reason: 'It is broken again today.' }).expect(403);
    await api(app).post('/api/requests/6/feedback').set(auth(t.ali)).send({ rating: 1 }).expect(403);
  });

  it('a missing record is 404, an existing unauthorised one is 403', async () => {
    await api(app).get('/api/requests/9999').set(auth(t.ali)).expect(404);
    await api(app).get('/api/requests/3').set(auth(t.ali)).expect(403);
  });

  it('a technician sees only requests assigned to them', async () => {
    const res = await api(app).get('/api/requests').set(auth(t.bilal));
    expect(res.body.data.items.map((r: { id: number }) => r.id)).toEqual([3]);
    await api(app).get('/api/requests/2').set(auth(t.bilal)).expect(403); // assigned to Imran
  });

  it('rejects cross-role operations with 403', async () => {
    await api(app).post('/api/requests/1/assign').set(auth(t.ali)).send({ technicianId: 5 }).expect(403); // requester cannot assign
    await api(app).post('/api/requests/1/assign').set(auth(t.bilal)).send({ technicianId: 5 }).expect(403); // technician cannot assign
    await api(app).post('/api/requests/4/close').set(auth(t.zara)).expect(403); // technician cannot close
    await api(app).post('/api/requests/3/start').set(auth(t.dispatcher)).expect(403); // dispatcher cannot act as technician
    await api(app).post('/api/requests').set(auth(t.dispatcher)).send({}).expect(403); // dispatcher cannot act as requester
    await api(app).post('/api/categories').set(auth(t.ali)).send({ name: 'Painting', description: 'Walls and doors painting.' }).expect(403);
    await api(app).get('/api/reports/technicians').set(auth(t.bilal)).expect(403);
  });

  it('a dispatcher sees every request', async () => {
    const res = await api(app).get('/api/requests?limit=50').set(auth(t.dispatcher));
    expect(res.body.data.total).toBe(7);
  });

  it('has no public route for creating privileged accounts', async () => {
    for (const path of ['/api/auth/register-technician', '/api/users', '/api/auth/register/dispatcher']) {
      expect((await api(app).post(path).send({ fullName: 'Tech Person', email: 't@x.test', password: 'Campus2026' })).status).toBe(404);
    }
  });
});
