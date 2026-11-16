import { INestApplication } from '@nestjs/common';
import { AccountName, api, auth, createRequest, createTestApp, historyOf, loginAll, newRequest } from '../helpers';

/** [S5] Reject a sixth active request, a fourth active job and an unsupported category assignment. */
describe('[S5] Capacity limits and eligibility', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
  });
  afterAll(() => app.close());

  it('rejects a sixth active request for one requester (409)', async () => {
    for (let i = 0; i < 5; i++) await createRequest(app, t.usman);
    const res = await api(app).post('/api/requests').set(auth(t.usman)).send(newRequest());
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already have 5 active requests/);
  });

  it('cancelled requests do not count as active', async () => {
    const list = await api(app).get('/api/requests?status=OPEN').set(auth(t.usman));
    await api(app).post(`/api/requests/${list.body.data.items[0].id}/cancel`).set(auth(t.usman)).expect(200);
    await api(app).post('/api/requests').set(auth(t.usman)).send(newRequest()).expect(201);
  });

  it('rejects a fourth ASSIGNED/IN_PROGRESS job for one technician (409)', async () => {
    // Zara has 0 active jobs; give her three, then try a fourth (Furniture requests from Ali and Sara)
    const ids = [];
    for (const who of [t.ali, t.ali, t.sara, t.sara]) ids.push(await createRequest(app, who, { categoryId: 4 }));
    for (const id of ids.slice(0, 3)) await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 7 }).expect(200);
    const res = await api(app).post(`/api/requests/${ids[3]}/assign`).set(auth(t.dispatcher)).send({ technicianId: 7 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already has 3 ASSIGNED\/IN_PROGRESS jobs/);
    expect(await historyOf(app, t.dispatcher, ids[3])).toHaveLength(1); // still only the creation event
  });

  it('rejects an unsupported category, a non-technician and an unknown technician', async () => {
    const plumbing = await createRequest(app, t.ali, { categoryId: 2 });
    const r1 = await api(app).post(`/api/requests/${plumbing}/assign`).set(auth(t.dispatcher)).send({ technicianId: 5 }); // Bilal: Electrical, IT
    expect(r1.status).toBe(409);
    expect(r1.body.message).toMatch(/does not support category 2/);
    const r2 = await api(app).post(`/api/requests/${plumbing}/assign`).set(auth(t.dispatcher)).send({ technicianId: 3 }); // Sara is a requester
    expect(r2.status).toBe(409);
    expect(r2.body.message).toMatch(/REQUESTER, not a TECHNICIAN/);
    await api(app).post(`/api/requests/${plumbing}/assign`).set(auth(t.dispatcher)).send({ technicianId: 999 }).expect(404);
    expect(await historyOf(app, t.ali, plumbing)).toHaveLength(1);
  });

  it('only OPEN requests can be assigned (reassignment is out of scope)', async () => {
    await api(app).post('/api/requests/2/assign').set(auth(t.dispatcher)).send({ technicianId: 6 }).expect(409); // already ASSIGNED
  });
});

/** [S11] Competing requests near a capacity limit: the limit holds and failures add no history. */
describe('[S11] Concurrency near a capacity limit', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
  });
  afterAll(() => app.close());

  it('five simultaneous creates when the requester has 3 active: exactly 2 succeed', async () => {
    for (let i = 0; i < 3; i++) await createRequest(app, t.usman);
    const results = await Promise.all(Array.from({ length: 5 }, () => api(app).post('/api/requests').set(auth(t.usman)).send(newRequest())));
    const codes = results.map((r) => r.status).sort();
    expect(codes).toEqual([201, 201, 409, 409, 409]);
    const mine = await api(app).get('/api/requests?limit=50').set(auth(t.usman));
    expect(mine.body.data.total).toBe(5); // never 6 or more
  });

  it('four simultaneous assignments to a technician with 1 job: exactly 2 succeed, failures add no history', async () => {
    // Bilal (Electrical, IT) already has request 3 IN_PROGRESS
    const ids = [];
    for (const who of [t.ali, t.ali, t.sara, t.sara]) ids.push(await createRequest(app, who, { categoryId: 1 }));
    const results = await Promise.all(ids.map((id) => api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 5 })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 409, 409]);

    const dashboard = await api(app).get('/api/dashboard').set(auth(t.bilal));
    expect(dashboard.body.data.workload.activeJobs).toBe(3);

    for (const [i, res] of results.entries()) {
      const history = await historyOf(app, t.dispatcher, ids[i]);
      expect(history).toHaveLength(res.status === 200 ? 2 : 1); // failed: creation event only
    }
  });

  it('two simultaneous starts of the same job: one succeeds, the other is refused (no double history)', async () => {
    const id = await createRequest(app, t.ali, { categoryId: 4 });
    await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 6 }).expect(200);
    const [a, b] = await Promise.all([1, 2].map(() => api(app).post(`/api/requests/${id}/start`).set(auth(t.imran))));
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const history = await historyOf(app, t.ali, id);
    expect(history.filter((h) => h.toStatus === 'IN_PROGRESS')).toHaveLength(1);
  });
});
