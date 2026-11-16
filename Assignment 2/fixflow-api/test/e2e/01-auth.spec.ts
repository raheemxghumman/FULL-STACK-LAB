import { INestApplication } from '@nestjs/common';
import { api, auth, createTestApp, expiredToken, login } from '../helpers';

/** [S1] Register and log in; reject duplicate email, incorrect password and role escalation. */
describe('[S1] Registration and login', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createTestApp()));
  afterAll(() => app.close());

  it('registers a REQUESTER (201), normalises the email and never returns a password or hash', async () => {
    const res = await api(app).post('/api/auth/register').send({ fullName: '  Hamza Ali  ', email: '  Hamza.Ali@FixFlow.TEST ', password: 'Campus2026' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ fullName: 'Hamza Ali', email: 'hamza.ali@fixflow.test', role: 'REQUESTER' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|Campus2026|\$2[aby]\$/i);
  });

  it('rejects a duplicate email even with different case and spaces (409)', async () => {
    const res = await api(app).post('/api/auth/register').send({ fullName: 'Someone Else', email: 'HAMZA.ali@fixflow.test', password: 'Campus2026' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/);
  });

  it('logs in with valid credentials and returns a signed JWT (200)', async () => {
    const res = await api(app).post('/api/auth/login').send({ email: 'hamza.ali@fixflow.test', password: 'Campus2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken.split('.')).toHaveLength(3);
    expect(res.body.data).toMatchObject({ tokenType: 'Bearer', expiresIn: '15m', user: { role: 'REQUESTER' } });
  });

  it('rejects an incorrect password (401) with the same message as an unknown email', async () => {
    const wrong = await api(app).post('/api/auth/login').send({ email: 'hamza.ali@fixflow.test', password: 'Wrong2026' });
    const unknown = await api(app).post('/api/auth/login').send({ email: 'nobody@fixflow.test', password: 'Wrong2026' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('rejects an attempted role escalation and other unrecognised fields (400)', async () => {
    for (const extra of [{ role: 'DISPATCHER' }, { id: 99 }, { userId: 1 }, { supportedCategoryIds: [1] }]) {
      const res = await api(app).post('/api/auth/register').send({ fullName: 'Evil User', email: `evil${Math.random()}@x.test`, password: 'Campus2026', ...extra });
      expect(res.status).toBe(400);
      expect(res.body.message.join(' ')).toMatch(/should not exist/);
    }
  });

  it('enforces the password and name rules, and does not trim passwords', async () => {
    const cases = [
      { fullName: 'Ok Name', email: 'a1@x.test', password: 'short1' }, // < 8
      { fullName: 'Ok Name', email: 'a2@x.test', password: 'onlyletters' }, // no digit
      { fullName: 'Ok Name', email: 'a3@x.test', password: '12345678' }, // no letter
      { fullName: '  ab  ', email: 'a4@x.test', password: 'Campus2026' }, // name < 3 after trim
      { fullName: 'Ok Name', email: 'not-an-email', password: 'Campus2026' },
    ];
    for (const body of cases) expect((await api(app).post('/api/auth/register').send(body)).status).toBe(400);
    // a password with spaces is kept exactly as typed
    await api(app).post('/api/auth/register').send({ fullName: 'Space Pass', email: 'space@x.test', password: ' pass 2026 ' }).expect(201);
    await api(app).post('/api/auth/login').send({ email: 'space@x.test', password: 'pass 2026' }).expect(401);
    await api(app).post('/api/auth/login').send({ email: 'space@x.test', password: ' pass 2026 ' }).expect(200);
  });
});

/** [S2a] Reject missing, invalid and expired tokens. */
describe('[S2] Token authentication', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createTestApp()));
  afterAll(() => app.close());

  it('rejects a missing token (401)', async () => {
    const res = await api(app).get('/api/requests');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing access token.');
  });

  it('rejects an invalid / tampered token (401)', async () => {
    const good = await login(app, 'ali');
    const [h, p] = good.split('.');
    for (const token of ['abc.def.ghi', `${h}.${p}.invalidsignature`, 'not-a-jwt']) {
      expect((await api(app).get('/api/requests').set(auth(token))).status).toBe(401);
    }
  });

  it('rejects an expired token (401) with a clear message', async () => {
    const res = await api(app).get('/api/requests').set(auth(expiredToken(app)));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/);
  });

  it('accepts a valid token', async () => {
    await api(app).get('/api/requests').set(auth(await login(app, 'ali'))).expect(200);
  });

  it('keeps register and login public, and every other route protected', async () => {
    await api(app).get('/api/health').expect(200);
    for (const path of ['/api/categories', '/api/dashboard', '/api/requests/1', '/api/users/me']) {
      expect((await api(app).get(path)).status).toBe(401);
    }
  });
});
