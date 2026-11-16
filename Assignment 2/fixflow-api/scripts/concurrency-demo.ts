/**
 * npm run demo:concurrency      (start the API first with `npm start`; best on freshly seeded data)
 *
 * Sends competing requests near a capacity limit to the RUNNING server, all at the same moment:
 *  1. Usman has 3 active requests and sends 5 creates at once   -> limit 5 holds: exactly 2 x 201
 *  2. Bilal has 1 active job; 4 assignments to him are sent at once -> limit 3 holds: exactly 2 x 200
 * Then it shows that every failed operation left no history behind.
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000/api';

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, requestId: res.headers.get('x-request-id') };
}

async function login(email: string, password: string) {
  const res = await call('POST', '/auth/login', undefined, { email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: is the API running on ${BASE}?`);
  return res.body.data.accessToken as string;
}

const body = (n: number, categoryId: number) => ({
  title: `Concurrency demo request ${n}`, description: 'Created by the concurrency demonstration script.',
  categoryId, building: 'Demo Block', room: `D-${n}`, priority: 'MEDIUM',
});

async function main() {
  const [usman, ali, sara, dispatcher] = await Promise.all([
    login('usman@fixflow.test', 'Requester2026'), login('ali@fixflow.test', 'Requester2026'),
    login('sara@fixflow.test', 'Requester2026'), login('dispatcher@fixflow.test', 'Dispatch2026'),
  ]);

  console.log('\n1) Active-request limit (5 per requester)');
  const before = (await call('GET', '/dashboard', usman)).body.data.activeRequests;
  for (let i = before; i < 3; i++) await call('POST', '/requests', usman, body(i, 3));
  console.log(`   Usman has ${(await call('GET', '/dashboard', usman)).body.data.activeRequests} active requests. Sending 5 creates at the same moment...`);
  const creates = await Promise.all([1, 2, 3, 4, 5].map((n) => call('POST', '/requests', usman, body(100 + n, 3))));
  creates.forEach((r, i) => console.log(`   create #${i + 1} -> ${r.status} ${r.status === 201 ? `request ${r.body.data.id}` : r.body.message}`));
  console.log(`   Usman now has ${(await call('GET', '/dashboard', usman)).body.data.activeRequests} active requests (limit held).`);

  console.log('\n2) Technician capacity (3 ASSIGNED/IN_PROGRESS jobs)');
  const ids: number[] = [];
  for (const [i, token] of [ali, ali, sara, sara].entries()) {
    const r = await call('POST', '/requests', token, body(200 + i, 1));
    if (r.status === 201) ids.push(r.body.data.id);
  }
  const load = async () => (await call('GET', '/reports/technicians', dispatcher)).body.data.find((t: { technicianId: number }) => t.technicianId === 5).activeJobs;
  console.log(`   Bilal (#5) has ${await load()} active job(s). Sending ${ids.length} assignments at the same moment...`);
  const assigns = await Promise.all(ids.map((id) => call('POST', `/requests/${id}/assign`, dispatcher, { technicianId: 5 })));
  assigns.forEach((r, i) => console.log(`   assign request ${ids[i]} -> ${r.status} ${r.status === 200 ? 'ASSIGNED' : r.body.message}`));
  console.log(`   Bilal now has ${await load()} active jobs (limit held).`);

  console.log('\n3) Failed operations left no history');
  for (const [i, r] of assigns.entries()) {
    if (r.status === 200) continue;
    const details = await call('GET', `/requests/${ids[i]}`, dispatcher);
    const events = details.body.data.history.map((h: { toStatus: string }) => h.toStatus).join(' -> ');
    console.log(`   request ${ids[i]}: status ${details.body.data.request.status}, history [${events}], assignment ${details.body.data.assignment ?? 'none'}`);
  }
  console.log('\nWhy: every check-and-update runs inside store.runExclusive() (one at a time), and each write also checks the record version.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
