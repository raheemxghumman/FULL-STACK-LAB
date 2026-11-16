import { INestApplication } from '@nestjs/common';
import { AccountName, api, auth, createRequest, createTestApp, historyOf, loginAll } from '../helpers';

const NOTE = 'Replaced the faulty part and tested it twice with the requester present.';

/** [S7] Reopen RESOLVED work: assignment cleared, history kept; reject a reopen above the limit. */
describe('[S7] Reopening resolved work', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
  });
  afterAll(() => app.close());

  it('reopens a RESOLVED request with a reason: OPEN again, assignment cleared, history retained', async () => {
    // seed request 4: Sara's Wi-Fi job, RESOLVED by Zara
    await api(app).post('/api/requests/4/reopen').set(auth(t.sara)).send({ reason: 'short' }).expect(400); // reason 10-500
    const res = await api(app).post('/api/requests/4/reopen').set(auth(t.sara)).send({ reason: 'The Wi-Fi started dropping again this morning.' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'OPEN', assignedTechnicianId: null });

    const details = (await api(app).get('/api/requests/4').set(auth(t.sara))).body.data;
    expect(details.assignment).toBeNull();
    expect(details.assignmentHistory[0]).toMatchObject({ technicianId: 7, clearedReason: 'The Wi-Fi started dropping again this morning.' });
    expect(details.assignmentHistory[0].clearedAt).not.toBeNull();
    expect(details.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'OPEN']);
    expect(details.history[4]).toMatchObject({ fromStatus: 'RESOLVED', actorId: 3, note: 'The Wi-Fi started dropping again this morning.' });
  });

  it('the technician loses access once the assignment is cleared', async () => {
    await api(app).get('/api/requests/4').set(auth(t.zara)).expect(403);
  });

  it('rejects a reopen when the owner already has five active requests (409), leaving everything unchanged', async () => {
    // Usman: one RESOLVED request + four OPEN = five active
    const resolved = await createRequest(app, t.usman, { categoryId: 4 });
    await api(app).post(`/api/requests/${resolved}/assign`).set(auth(t.dispatcher)).send({ technicianId: 6 }).expect(200);
    await api(app).post(`/api/requests/${resolved}/start`).set(auth(t.imran)).expect(200);
    await api(app).post(`/api/requests/${resolved}/resolve`).set(auth(t.imran)).send({ resolutionNote: NOTE }).expect(200);
    for (let i = 0; i < 4; i++) await createRequest(app, t.usman);

    const before = await historyOf(app, t.usman, resolved);
    const res = await api(app).post(`/api/requests/${resolved}/reopen`).set(auth(t.usman)).send({ reason: 'Still wobbling after the repair.' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already have 5 active requests/);
    const after = (await api(app).get(`/api/requests/${resolved}`).set(auth(t.usman))).body.data;
    expect(after.request).toMatchObject({ status: 'RESOLVED', assignedTechnicianId: 6 });
    expect(after.history).toEqual(before);
  });
});

/** [S8] Reject early or duplicate feedback; correct attribution and averages after a reopen and reassignment. */
describe('[S8] Feedback and technician ratings', () => {
  let app: INestApplication;
  let t: Record<AccountName, string>;
  beforeAll(async () => {
    app = await createTestApp();
    t = await loginAll(app);
  });
  afterAll(() => app.close());

  it('rejects feedback before the request is CLOSED (409)', async () => {
    const res = await api(app).post('/api/requests/4/feedback').set(auth(t.sara)).send({ rating: 5 }); // RESOLVED
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/only be given for a CLOSED request/);
  });

  it('rejects duplicate feedback (409)', async () => {
    const res = await api(app).post('/api/requests/5/feedback').set(auth(t.ali)).send({ rating: 1 }); // seed already rated 4
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already been submitted/);
  });

  it('attributes feedback to the technician who did the FINAL repair after a reopen and reassignment', async () => {
    // Electrical job: Bilal resolves it, the owner reopens, Zara is assigned and fixes it for good
    const id = await createRequest(app, t.usman, { categoryId: 1 });
    await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 5 }).expect(200);
    await api(app).post(`/api/requests/${id}/start`).set(auth(t.bilal)).expect(200);
    await api(app).post(`/api/requests/${id}/resolve`).set(auth(t.bilal)).send({ resolutionNote: NOTE }).expect(200);
    await api(app).post(`/api/requests/${id}/reopen`).set(auth(t.usman)).send({ reason: 'Lights flicker again after an hour.' }).expect(200);
    await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 7 }).expect(200);
    await api(app).post(`/api/requests/${id}/start`).set(auth(t.zara)).expect(200);
    await api(app).post(`/api/requests/${id}/resolve`).set(auth(t.zara)).send({ resolutionNote: 'Replaced the whole lighting circuit breaker; stable for a day.' }).expect(200);
    await api(app).post(`/api/requests/${id}/close`).set(auth(t.usman)).expect(200);

    const res = await api(app).post(`/api/requests/${id}/feedback`).set(auth(t.usman)).send({ rating: 4, comment: 'Second visit fixed it.' });
    expect(res.status).toBe(201);
    expect(res.body.data.technicianId).toBe(7); // Zara, not Bilal

    const history = (await api(app).get(`/api/requests/${id}`).set(auth(t.usman))).body.data.history;
    expect(history.map((h: { toStatus: string }) => h.toStatus)).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
  });

  it('dispatcher report: feedback count, average rounded to 2 decimals, null without feedback', async () => {
    // one more rating for Zara: 5 (seed) + 4 (above) + 4 = 13 / 3 = 4.333... -> 4.33
    const id = await createRequest(app, t.ali, { categoryId: 3 });
    await api(app).post(`/api/requests/${id}/assign`).set(auth(t.dispatcher)).send({ technicianId: 7 }).expect(200);
    await api(app).post(`/api/requests/${id}/start`).set(auth(t.zara)).expect(200);
    await api(app).post(`/api/requests/${id}/resolve`).set(auth(t.zara)).send({ resolutionNote: NOTE }).expect(200);
    await api(app).post(`/api/requests/${id}/close`).set(auth(t.ali)).expect(200);
    await api(app).post(`/api/requests/${id}/feedback`).set(auth(t.ali)).send({ rating: 4 }).expect(201);

    const report = (await api(app).get('/api/reports/technicians').set(auth(t.dispatcher))).body.data;
    const byId = Object.fromEntries(report.map((r: { technicianId: number }) => [r.technicianId, r]));
    expect(byId[5]).toMatchObject({ feedbackCount: 0, averageRating: null }); // Bilal's repair was not final
    expect(byId[6]).toMatchObject({ feedbackCount: 1, averageRating: 4 });
    expect(byId[7]).toMatchObject({ feedbackCount: 3, averageRating: 4.33 });
  });
});
