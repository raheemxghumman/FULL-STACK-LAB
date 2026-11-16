import { INestApplication } from '@nestjs/common';
import { AccountName, api, auth, createRequest, createTestApp, historyOf, loginAll } from '../helpers';

/** [S3] OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED, then feedback and dashboard counts. */
describe('[S3] Complete workflow, feedback and dashboard', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  let id: number;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
  });
  afterAll(() => app.close());

  it('creates a request: server sets id, owner, OPEN, timestamps and a creation event (201)', async () => {
    const res = await api(app).post('/api/requests').set(auth(t.usman)).send({
      title: '  Network point dead in Room C-3  ', description: 'The wall network point gives no connection to any laptop we plug in.',
      categoryId: 3, building: 'Academic Block C', room: 'C-3', priority: 'HIGH',
    });
    expect(res.status).toBe(201);
    id = res.body.data.id;
    expect(res.body.data).toMatchObject({ title: 'Network point dead in Room C-3', status: 'OPEN', requesterId: 4, assignedTechnicianId: null });
    expect(res.body.data.createdAt).toBeDefined();
    expect(await historyOf(app, t.usman, id)).toEqual([expect.objectContaining({ fromStatus: null, toStatus: 'OPEN', actorId: 4 })]);
  });

  it('OPEN -> ASSIGNED by the dispatcher (200)', async () => {
    const res = await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ASSIGNED', assignedTechnicianId: 5 });
  });

  it('ASSIGNED -> IN_PROGRESS by the assigned technician', async () => {
    await api(app).post(`/api/requests/${id}/start`).set(auth(t.bilal)).expect(200);
  });

  it('IN_PROGRESS -> RESOLVED with a resolution note of 20-1000 characters', async () => {
    await api(app).post(`/api/requests/${id}/resolve`).set(auth(t.bilal)).send({ resolutionNote: 'too short' }).expect(400);
    const res = await api(app).post(`/api/requests/${id}/resolve`).set(auth(t.bilal)).send({ resolutionNote: 'Re-terminated the network cable at the wall socket and tested it.' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'RESOLVED', resolvedByTechnicianId: 5 });
  });

  it('RESOLVED -> CLOSED by the owner', async () => {
    await api(app).post(`/api/requests/${id}/close`).set(auth(t.usman)).expect(200);
  });

  it('records every change in chronological history with old/new status, actor and note', async () => {
    const history = await historyOf(app, t.usman, id);
    expect(history.map((h) => `${h.fromStatus}->${h.toStatus}@${h.actorId}`)).toEqual([
      'null->OPEN@4', 'OPEN->ASSIGNED@1', 'ASSIGNED->IN_PROGRESS@5', 'IN_PROGRESS->RESOLVED@5', 'RESOLVED->CLOSED@4',
    ]);
    expect(history[3].note).toMatch(/Re-terminated/);
  });

  it('accepts feedback for the CLOSED request (201) and attributes it to the technician', async () => {
    const res = await api(app).post(`/api/requests/${id}/feedback`).set(auth(t.usman)).send({ rating: 5, comment: 'Fixed within the hour.' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ requestId: id, technicianId: 5, rating: 5 });
  });

  it('dashboard counts are derived from stored data for each role', async () => {
    const requester = (await api(app).get('/api/dashboard').set(auth(t.usman))).body.data;
    expect(requester).toMatchObject({ role: 'REQUESTER', totalRequests: 1, activeRequests: 0, byStatus: { CLOSED: 1, OPEN: 0 } });

    const tech = (await api(app).get('/api/dashboard').set(auth(t.bilal))).body.data;
    expect(tech).toMatchObject({ role: 'TECHNICIAN', byStatus: { IN_PROGRESS: 1, CLOSED: 1 }, workload: { activeJobs: 1, capacity: 3, available: 2 }, feedbackCount: 1, averageRating: 5 });

    const dispatcher = (await api(app).get('/api/dashboard').set(auth(t.dispatcher))).body.data;
    expect(dispatcher.totalRequests).toBe(8);
    expect(dispatcher.byStatus).toEqual({ OPEN: 1, ASSIGNED: 1, IN_PROGRESS: 1, RESOLVED: 1, CLOSED: 3, CANCELLED: 1 });
    expect(dispatcher.byCategory.find((c: { name: string }) => c.name === 'IT Support').total).toBe(3);
    expect(dispatcher.technicianWorkload.map((w: { technicianId: number; activeJobs: number }) => [w.technicianId, w.activeJobs])).toEqual([[5, 1], [6, 1], [7, 0]]);
  });
});

/** [S6] Reject completion before starting, actions by an unassigned technician, edits/cancel after assignment. */
describe('[S6] Invalid workflow actions', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  let id: number;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
    id = await createRequest(app, t.usman, { categoryId: 1 });
    await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 5 }).expect(200);
  });
  afterAll(() => app.close());

  it('rejects completion before the job is started (409) and adds no history', async () => {
    const before = (await historyOf(app, t.usman, id)).length;
    const res = await api(app).post(`/api/requests/${id}/resolve`).set(auth(t.bilal)).send({ resolutionNote: 'Replaced the faulty breaker in the distribution box.' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/ASSIGNED; it cannot move to RESOLVED/);
    expect((await historyOf(app, t.usman, id)).length).toBe(before);
  });

  it('rejects start/resolve by a technician who is not assigned (403)', async () => {
    await api(app).post(`/api/requests/${id}/start`).set(auth(t.zara)).expect(403);
    await api(app).post(`/api/requests/${id}/resolve`).set(auth(t.zara)).send({ resolutionNote: 'Replaced the faulty breaker in the distribution box.' }).expect(403);
  });

  it('rejects edits and cancellation after assignment (409)', async () => {
    const edit = await api(app).patch(`/api/requests/${id}`).set(auth(t.usman)).send({ room: 'C-99' });
    expect(edit.status).toBe(409);
    expect(edit.body.message).toMatch(/only be edited while OPEN/);
    await api(app).post(`/api/requests/${id}/cancel`).set(auth(t.usman)).expect(409);
  });

  it('rejects any transition from a terminal status (409)', async () => {
    await api(app).post('/api/requests/7/cancel').set(auth(t.sara)).expect(409); // already CANCELLED
    await api(app).post('/api/requests/5/close').set(auth(t.ali)).expect(409); // already CLOSED
    await api(app).post('/api/requests/5/reopen').set(auth(t.ali)).send({ reason: 'Trying to reopen a closed job.' }).expect(409);
  });

  it('lets the owner edit and cancel only while OPEN, without changing owner, status or history', async () => {
    const open = await createRequest(app, t.usman);
    const res = await api(app).patch(`/api/requests/${open}`).set(auth(t.usman)).send({ room: 'Lab 7', priority: 'HIGH' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ room: 'Lab 7', priority: 'HIGH', status: 'OPEN', requesterId: 4 });
    expect(await historyOf(app, t.usman, open)).toHaveLength(1); // edits are not status changes
    await api(app).post(`/api/requests/${open}/cancel`).set(auth(t.usman)).expect(200);
  });
});
