/* FixFlow project page: interactions and animations (no frameworks). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => sleep(reduced ? 0 : ms);

  /* ------------------------------------------------------------ nav */
  const nav = $('#nav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 10), { passive: true });
  $('#menuBtn').addEventListener('click', (e) => {
    const open = $('#navLinks').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => $('#navLinks').classList.remove('open')));
  const sections = $$('main section[id]');
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) $$('#navLinks a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${en.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  /* ------------------------------------------------------------ reveal + counters */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      $$('[data-count]', en.target).forEach(countUp);
      if (en.target.matches('[data-count]')) countUp(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.12 });
  const watchReveal = (root = document) => $$('.reveal', root).forEach((el) => io.observe(el));
  watchReveal();
  function countUp(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const target = Number(el.dataset.count);
    const start = performance.now();
    const dur = reduced ? 1 : 1200;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------ hero terminal */
  const heroLines = [
    ['t-prompt', '$ curl -X POST /api/auth/login  { "email": "ali@fixflow.test", … }'],
    ['t-ok', '200  { "success": true, "data": { "accessToken": "eyJhbGciOi…" } }'],
    ['t-prompt', '$ curl -X POST /api/requests -H "Authorization: Bearer …"'],
    ['t-ok', '201  { "id": 8, "status": "OPEN", "requesterId": 2, … }'],
    ['t-prompt', '$ curl -X POST /api/requests/8/assign  { "technicianId": 6 }'],
    ['t-warn', '409  Technician 6 does not support category 3.'],
    ['t-prompt', '$ curl -X POST /api/requests/8/assign  { "technicianId": 5 }'],
    ['t-ok', '200  { "status": "ASSIGNED", "assignedTechnicianId": 5 }'],
    ['t-prompt', '$ curl -X POST /api/requests/8/resolve   (Bilal, before start)'],
    ['t-warn', '409  Request 8 is ASSIGNED; it cannot move to RESOLVED.'],
    ['t-dim', '[HTTP] POST /api/requests/8/resolve 409 2ms rid=95c4…'],
  ];
  (async () => {
    const box = $('#heroTerm');
    for (const [cls, text] of heroLines) {
      const ln = document.createElement('div');
      ln.className = `ln ${cls}`;
      ln.textContent = text;
      box.appendChild(ln);
      await wait(cls === 't-prompt' ? 520 : 340);
    }
    box.insertAdjacentHTML('beforeend', '<span class="cursor"></span>');
  })();

  /* ------------------------------------------------------------ workflow state machine */
  const NODES = {
    OPEN: [100, 200], ASSIGNED: [335, 200], IN_PROGRESS: [570, 200], RESOLVED: [805, 200],
    CLOSED: [805, 345], CANCELLED: [100, 345],
  };
  const EDGES = [
    { id: 'assign', from: 'OPEN', to: 'ASSIGNED', d: 'M180,200 L253,200', lx: 217, ly: 150, label: 'assign', who: 'DISPATCHER',
      route: 'POST /api/requests/:id/assign', body: '{ "technicianId": 5 }',
      rules: ['Request must be OPEN', 'The user must exist and be a TECHNICIAN', "The technician must support the request's category", 'The technician has fewer than 3 ASSIGNED/IN_PROGRESS jobs', 'Creates an assignment and a history event'],
      codes: ['200', '400 bad id', '403 not dispatcher', '404 no such user', '409 capacity / category / not OPEN'] },
    { id: 'start', from: 'ASSIGNED', to: 'IN_PROGRESS', d: 'M415,200 L488,200', lx: 452, ly: 150, label: 'start', who: 'ASSIGNED TECH',
      route: 'POST /api/requests/:id/start', body: '(no body)',
      rules: ['Only the technician currently assigned', 'Request must be ASSIGNED'],
      codes: ['200', '403 other technician', '409 not ASSIGNED'] },
    { id: 'resolve', from: 'IN_PROGRESS', to: 'RESOLVED', d: 'M650,200 L723,200', lx: 687, ly: 150, label: 'resolve', who: 'ASSIGNED TECH',
      route: 'POST /api/requests/:id/resolve', body: '{ "resolutionNote": "Replaced the faulty HDMI cable…" }',
      rules: ['Only the assigned technician', 'Must be IN_PROGRESS: completing before starting gets 409', 'resolutionNote must be 20-1000 characters', 'Records which technician did this repair (used for feedback)'],
      codes: ['200', '400 short note', '403 other technician', '409 not started'] },
    { id: 'close', from: 'RESOLVED', to: 'CLOSED', d: 'M805,227 L805,316', lx: 850, ly: 268, label: 'close', who: 'OWNER',
      route: 'POST /api/requests/:id/close', body: '(no body)',
      rules: ['Only the requester who owns it', 'Request must be RESOLVED', 'CLOSED is final; one feedback can then be given'],
      codes: ['200', '403 not owner', '409 not RESOLVED'] },
    { id: 'reopen', from: 'RESOLVED', to: 'OPEN', d: 'M805,173 C805,55 100,55 100,173', lx: 452, ly: 82, label: 'reopen (reason)', who: 'OWNER',
      route: 'POST /api/requests/:id/reopen', body: '{ "reason": "The projector is flickering again." }',
      rules: ['Only the owner, only when RESOLVED', 'reason must be 10-500 characters', 'Clears the current assignment; the assignment history keeps it', 'Refused when the owner already has 5 active requests'],
      codes: ['200', '400 short reason', '403 not owner', '409 limit / not RESOLVED'] },
    { id: 'cancel', from: 'OPEN', to: 'CANCELLED', d: 'M100,227 L100,316', lx: 150, ly: 268, label: 'cancel', who: 'OWNER',
      route: 'POST /api/requests/:id/cancel', body: '(no body)',
      rules: ['Only the owner', 'Only while OPEN: after assignment it gets 409', 'CANCELLED is final'],
      codes: ['200', '403 not owner', '409 not OPEN'] },
    { id: 'feedback', from: 'CLOSED', to: 'FEEDBACK', d: 'M885,345 L912,345', lx: 0, ly: 0, label: '', who: '',
      route: 'POST /api/requests/:id/feedback', body: '{ "rating": 5, "comment": "Fixed quickly." }',
      rules: ['Owner only, request must be CLOSED', 'rating: integer 1-5; comment: up to 500 characters, optional', 'Only one feedback per request (a duplicate gets 409)', 'Credited to the technician who did the final repair'],
      codes: ['201', '400 rating', '403 not owner', '409 early / duplicate'] },
  ];
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = $('#flowSvg');
  const mk = (tag, attrs = {}, parent = svg) => {
    const el = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    parent.appendChild(el);
    return el;
  };
  const defs = mk('defs');
  const marker = mk('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, defs);
  mk('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'rgba(148,163,184,.65)' }, marker);

  const edgeEls = {};
  EDGES.forEach((e) => {
    const g = mk('g', { class: 'f-edge', tabindex: '0', role: 'button', 'aria-label': `${e.from} to ${e.to}` });
    const line = mk('path', { d: e.d, class: 'line' }, g);
    mk('path', { d: e.d, class: 'hit' }, g);
    if (e.label) {
      mk('text', { x: e.lx, y: e.ly - 4 }, g).textContent = e.label;
      mk('text', { x: e.lx, y: e.ly + 12, class: 'who' }, g).textContent = e.who;
    }
    g.addEventListener('click', () => showEdge(e.id));
    g.addEventListener('keydown', (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), showEdge(e.id)));
    edgeEls[e.id] = { g, line };
  });
  const nodeEls = {};
  Object.entries(NODES).forEach(([name, [x, y]]) => {
    const g = mk('g', { class: `f-node${name === 'CLOSED' || name === 'CANCELLED' ? ' final' : ''}` });
    mk('rect', { x: x - 80, y: y - 27, width: 160, height: 54, rx: 14 }, g);
    mk('text', { x, y }, g).textContent = name;
    nodeEls[name] = g;
  });
  const fb = mk('g', { class: 'f-node final' });
  mk('rect', { x: 912, y: 327, width: 84, height: 36, rx: 10 }, fb);
  mk('text', { x: 954, y: 345, style: 'font-size:12px' }, fb).textContent = '★ feedback';
  nodeEls.FEEDBACK = fb;
  const ticket = mk('circle', { r: 9, class: 'ticket', cx: NODES.OPEN[0], cy: NODES.OPEN[1] - 40, opacity: 0 });

  function showEdge(id) {
    const e = EDGES.find((x) => x.id === id);
    Object.values(edgeEls).forEach(({ g }) => g.classList.remove('active'));
    edgeEls[id].g.classList.add('active');
    $('#flowInfo').innerHTML = `<div class="swap">
      <span class="eyebrow">${esc(e.from)} → ${esc(e.to)}</span>
      <h3>${esc(e.id === 'feedback' ? 'Submit feedback' : e.label.replace(' (reason)', ''))}${e.who ? ` <span class="muted" style="font-size:14px">· ${esc(e.who)}</span>` : ''}</h3>
      <div class="route">${esc(e.route)}</div>
      <pre class="code" style="margin-top:10px">${esc(e.body)}</pre>
      <ul>${e.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <div class="codes">${e.codes.map((c) => `<span class="code-pill ${c.startsWith('2') ? 'c2' : 'c4'}">${esc(c)}</span>`).join('')}</div>
    </div>`;
  }
  showEdge('assign');

  function light(name) {
    Object.values(nodeEls).forEach((n) => n.classList.remove('lit'));
    if (name) nodeEls[name].classList.add('lit');
  }
  async function travel(edgeId) {
    const path = edgeEls[edgeId].line;
    const len = path.getTotalLength();
    showEdge(edgeId);
    const dur = reduced ? 1 : 900;
    const t0 = performance.now();
    await new Promise((done) => {
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const pt = path.getPointAtLength(len * ease);
        ticket.setAttribute('cx', pt.x);
        ticket.setAttribute('cy', pt.y);
        if (p < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    light(EDGES.find((e) => e.id === edgeId).to);
    await wait(650);
  }
  let playing = false;
  async function play(edges) {
    if (playing) return;
    playing = true;
    ticket.setAttribute('cx', NODES.OPEN[0]);
    ticket.setAttribute('cy', NODES.OPEN[1]);
    ticket.setAttribute('opacity', 1);
    light('OPEN');
    await wait(500);
    for (const id of edges) await travel(id);
    playing = false;
  }
  $('#playFlow').addEventListener('click', () => play(['assign', 'start', 'resolve', 'close', 'feedback']));
  $('#playReopen').addEventListener('click', () => play(['assign', 'start', 'resolve', 'reopen', 'assign', 'start', 'resolve', 'close', 'feedback']));

  /* ------------------------------------------------------------ lifecycle */
  const STAGES = ['Request id middleware', 'JwtAuthGuard', 'RolesGuard', 'Interceptor (before)', 'Pipes: id + body', 'Controller', 'Service', 'Interceptor (after)', 'Finish log'];
  // real log lines recorded with LIFECYCLE_TRACE=true (docs/evidence/04-lifecycle-trace.txt)
  const CASES = {
    ok: {
      states: ['run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'run'],
      notes: ['id + header', 'pass', 'pass', 'before', 'valid', 'update()', 'rules ok', 'wrapped', '200'],
      log: [
        '[Lifecycle] [0ec1bb66] +  0ms  1 middleware RequestIdMiddleware -> id assigned, X-Request-Id header set',
        '[Lifecycle] [0ec1bb66] +  0ms  2 guard      JwtAuthGuard -> pass (user #2, REQUESTER)',
        '[Lifecycle] [0ec1bb66] +  0ms  2 guard      RolesGuard -> pass (REQUESTER is allowed)',
        '[Lifecycle] [0ec1bb66] +  1ms  3 intercept  ResponseEnvelopeInterceptor -> before handler (pipes run next)',
        '[Lifecycle] [0ec1bb66] +  1ms  4 pipe       ValidationPipe(UpdateRequestDto) -> body valid, transformed to UpdateRequestDto',
        '[Lifecycle] [0ec1bb66] +  1ms  4 pipe       ParsePositiveIntPipe(id) -> "1" became 1',
        '[Lifecycle] [0ec1bb66] +  1ms  5 controller RequestsController.update(#1) -> calling RequestsService',
        '[Lifecycle] [0ec1bb66] +  1ms  5 service    RequestsService.update(#1) -> checking owner, status and category',
        '[Lifecycle] [0ec1bb66] +  1ms  6 intercept  ResponseEnvelopeInterceptor -> response wrapped { success, data, requestId }',
        '[Lifecycle] [0ec1bb66] +  1ms  7 finish     middleware "finish" event -> 200',
        '[HTTP] PATCH /api/requests/1 200 1ms rid=0ec1bb66-10bd-4a5b-8a31-ba9027f7fc83',
      ],
    },
    auth: {
      states: ['run', 'fail', 'skip', 'skip', 'skip', 'skip', 'skip', 'skip', 'run'],
      notes: ['id + header', 'no token → 401', 'skipped', 'skipped', 'skipped', 'skipped', 'skipped', 'skipped', '401'],
      log: [
        '[Lifecycle] [36f419ab] +  0ms  1 middleware RequestIdMiddleware -> id assigned, X-Request-Id header set',
        '[Lifecycle] [36f419ab] +  0ms  2 guard      JwtAuthGuard -> no bearer token (401); RolesGuard, interceptor, pipes, controller are skipped',
        '[Lifecycle] [36f419ab] +  0ms  7 finish     middleware "finish" event -> 401',
        '[HTTP] PATCH /api/requests/1 401 0ms rid=36f419ab-3da9-4e2f-84f2-7941d9ad9653',
      ],
    },
    invalid: {
      states: ['run', 'run', 'run', 'run', 'fail', 'skip', 'skip', 'err', 'run'],
      notes: ['id + header', 'pass', 'pass', 'before', 'invalid → 400', 'skipped', 'skipped', 'error passed on', '400'],
      log: [
        '[Lifecycle] [da20dbd0] +  0ms  1 middleware RequestIdMiddleware -> id assigned, X-Request-Id header set',
        '[Lifecycle] [da20dbd0] +  0ms  2 guard      JwtAuthGuard -> pass (user #2, REQUESTER)',
        '[Lifecycle] [da20dbd0] +  0ms  2 guard      RolesGuard -> pass (REQUESTER is allowed)',
        '[Lifecycle] [da20dbd0] +  0ms  3 intercept  ResponseEnvelopeInterceptor -> before handler (pipes run next)',
        '[Lifecycle] [da20dbd0] +  1ms  4 pipe       ParsePositiveIntPipe(id) -> "1" became 1',
        '[Lifecycle] [da20dbd0] +  1ms  4 pipe       ValidationPipe(UpdateRequestDto) -> invalid body (400)',
        '[Lifecycle] [da20dbd0] +  1ms  6 intercept  ResponseEnvelopeInterceptor -> saw BadRequestException, re-thrown unchanged (not wrapped)',
        '[Lifecycle] [da20dbd0] +  1ms  7 finish     middleware "finish" event -> 400',
        '[HTTP] PATCH /api/requests/1 400 1ms rid=da20dbd0-d11c-4e3b-97f8-7c3c22b7d669',
      ],
    },
  };
  const pipeline = $('#pipeline');
  pipeline.innerHTML = STAGES.map((s, i) => `<div class="pipe-step reveal" data-i="${i}"><div class="n">${String(i + 1).padStart(2, '0')}</div><div class="t">${esc(s)}</div><div class="s"></div></div>`).join('');
  watchReveal(pipeline);
  let lifeRun = 0;
  const colourLog = (l) => esc(l)
    .replace(/^(\[\w+\])/, '<span class="k">$1</span>')
    .replace(/(?<![a-z])(pass|valid|response wrapped|became 1)(?![a-z])|(-&gt; 200| 200 )/g, (m) => `<span class="ok">${m}</span>`)
    .replace(/(\(401\)|\(400\)|-&gt; 40\d| 40\d |re-thrown unchanged \(not wrapped\)|are skipped)/g, '<span class="bad">$1</span>');
  async function runCase(name) {
    const id = ++lifeRun;
    const c = CASES[name];
    const steps = $$('.pipe-step', pipeline);
    steps.forEach((s) => { s.className = 'pipe-step reveal in'; $('.s', s).textContent = ''; });
    const con = $('#lifeConsole');
    con.innerHTML = '';
    let logged = 0;
    for (let i = 0; i < steps.length; i++) {
      if (id !== lifeRun) return;
      const st = c.states[i];
      steps[i].classList.add(st, 'pulse');
      $('.s', steps[i]).textContent = c.notes[i];
      // print the log lines that belong to this stage
      const before = logged;
      while (logged < c.log.length && belongs(c.log[logged], i)) logged++;
      for (let k = before; k < logged; k++) con.insertAdjacentHTML('beforeend', `<div class="ln">${colourLog(c.log[k])}</div>`);
      await wait(st === 'skip' ? 140 : 420);
    }
    for (let k = logged; k < c.log.length; k++) con.insertAdjacentHTML('beforeend', `<div class="ln">${colourLog(c.log[k])}</div>`);
  }
  // which pipeline stage a recorded log line belongs to
  function belongs(line, i) {
    const map = [/1 middleware/, /JwtAuthGuard/, /RolesGuard/, /before handler/, /4 pipe/, /5 controller/, /5 service/, /6 intercept/, /7 finish|\[HTTP\]/];
    return map[i].test(line);
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => {
    $$('.tab').forEach((x) => { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', String(x === t)); });
    runCase(t.dataset.case);
  }));
  new IntersectionObserver((en, obs) => { if (en[0].isIntersecting) { runCase('ok'); obs.disconnect(); } }, { threshold: 0.3 }).observe(pipeline);

  /* ------------------------------------------------------------ architecture swap */
  const BIND = {
    mem: `<span class="c-c">// src/storage/storage.module.ts</span>
<span class="c-k">@Module</span>({
  providers: [{ provide: <span class="c-t">FIXFLOW_STORE</span>, useClass: <span class="c-f">InMemoryFixflowStore</span> }, SeedService],
  exports: [<span class="c-t">FIXFLOW_STORE</span>],
})
<span class="c-c">// every service, unchanged:</span>
<span class="c-k">constructor</span>(<span class="c-k">@Inject</span>(<span class="c-t">FIXFLOW_STORE</span>) <span class="c-k">private readonly</span> store: FixflowStore) {}`,
    fake: `<span class="c-c">// test/e2e/09-storage-replacement.spec.ts  ·  scripts/fake-store-demo.ts</span>
Test.<span class="c-f">createTestingModule</span>({ imports: [AppModule] })
  .<span class="c-f">overrideProvider</span>(<span class="c-t">FIXFLOW_STORE</span>)
  .<span class="c-f">useClass</span>(<span class="c-f">FakeFixflowStore</span>)   <span class="c-c">// no service file edited</span>
  .<span class="c-f">compile</span>();
<span class="c-c">// GET /api/health -> storage: </span><span class="c-s">"fake-array-store (test double)"</span>`,
  };
  let usingFake = false;
  $('#bindCode').innerHTML = BIND.mem;
  $('#swapStore').addEventListener('click', async (e) => {
    const button = e.currentTarget; // currentTarget is null again after the first await
    usingFake = !usingFake;
    const plug = $('#plug');
    plug.classList.add('out');
    await wait(450);
    plug.textContent = usingFake ? 'FakeFixflowStore' : 'InMemoryFixflowStore';
    plug.className = `plug ${usingFake ? 'fake' : 'mem'} out`;
    requestAnimationFrame(() => plug.classList.remove('out'));
    $('#bindCode').innerHTML = BIND[usingFake ? 'fake' : 'mem'];
    $$('.consumer').forEach((c, i) => setTimeout(() => { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }, i * 90));
    button.textContent = usingFake ? 'Restore the in-memory store' : 'Swap the binding';
  });

  /* ------------------------------------------------------------ concurrency race */
  // real output of npm run demo:concurrency: 3 active, 5 simultaneous creates -> 2 x 201, 3 x 409
  const RACE = [201, 201, 409, 409, 409];
  const lanes = $('#lanes');
  lanes.innerHTML = RACE.map((_, i) => `<div class="lane"><span class="lbl">create #${i + 1}</span><div class="track"><span class="gate"></span><span class="packet">POST</span></div><span class="res"></span></div>`).join('');
  const meter = $('#meter');
  const drawMeter = (n) => (meter.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'full' : ''}"></i>`).join(''));
  drawMeter(3);
  let racing = false;
  $('#raceBtn').addEventListener('click', async () => {
    if (racing) return;
    racing = true;
    drawMeter(3);
    const ls = $$('.lane', lanes);
    ls.forEach((l) => { const p = $('.packet', l); p.className = 'packet'; p.style.left = '6px'; p.textContent = 'POST'; const r = $('.res', l); r.className = 'res'; r.textContent = ''; });
    await wait(80);
    ls.forEach((l, i) => { $('.packet', l).style.left = `calc(62% - ${66 + i * 2}px)`; });
    await wait(1150);
    let active = 3;
    // runExclusive lets them through the gate one at a time
    const order = [2, 0, 4, 1, 3];
    for (const i of order) {
      const lane = ls[i];
      const code = active < 5 ? 201 : 409;
      const p = $('.packet', lane);
      const r = $('.res', lane);
      if (code === 201) {
        active++;
        p.classList.add('ok');
        p.textContent = '201';
        p.style.left = 'calc(100% - 62px)';
        drawMeter(active);
      } else {
        p.classList.add('no');
        p.textContent = '409';
        p.style.left = '6px';
      }
      r.textContent = code === 201 ? 'Created' : 'Conflict';
      r.className = `res show ${code === 201 ? 'ok' : 'no'}`;
      await wait(520);
    }
    $('#raceFoot').innerHTML = 'Result: <b class="res ok" style="opacity:1">2 × 201</b> and <b class="res no" style="opacity:1">3 × 409</b>. The requester ends with exactly 5 active requests, and the refused creates left no record or history. The real run is in <code>docs/evidence/05-concurrency-demo.png</code>.';
    racing = false;
  });

  /* ------------------------------------------------------------ data-driven sections */
  const json = (v, depth = 0) => {
    const pad = '  '.repeat(depth);
    if (v === null) return '<span class="j-null">null</span>';
    if (typeof v === 'string') return `<span class="j-s">"${esc(v)}"</span>`;
    if (typeof v === 'number') return `<span class="j-n">${v}</span>`;
    if (typeof v === 'boolean') return `<span class="j-b">${v}</span>`;
    if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => pad + '  ' + json(x, depth + 1)).join(',\n')}\n${pad}]` : '[]';
    const keys = Object.keys(v);
    return keys.length ? `{\n${keys.map((k) => `${pad}  <span class="j-k">"${esc(k)}"</span>: ${json(v[k], depth + 1)}`).join(',\n')}\n${pad}}` : '{}';
  };
  const methodCls = (m) => `method m-${m.toLowerCase()}`;
  const statusCls = (s) => (s >= 500 ? 's5' : s >= 400 ? 's4' : 's2');

  Promise.all([fetch('assets/data/openapi.json').then((r) => r.json()), fetch('assets/data/run.json').then((r) => r.json())])
    .then(([openapi, run]) => {
      buildEndpoints(openapi, run);
      buildReplay(run);
    })
    .catch(() => {
      $('#epList').innerHTML = '<p class="muted">Could not load the data files (open this page over http, e.g. GitHub Pages).</p>';
    });

  function schemaRows(schema, openapi) {
    if (!schema) return '';
    const ref = schema.$ref && openapi.components.schemas[schema.$ref.split('/').pop()];
    const s = ref || schema;
    if (!s.properties) return '';
    const req = new Set(s.required || []);
    return `<table class="props">${Object.entries(s.properties).map(([k, p]) => {
      const rules = [];
      if (p.enum) rules.push(p.enum.join(' | '));
      if (p.minLength !== undefined || p.maxLength !== undefined) rules.push(`${p.minLength ?? 0}-${p.maxLength ?? '∞'} chars`);
      if (p.minimum !== undefined || p.maximum !== undefined) rules.push(`${p.minimum ?? '-∞'}..${p.maximum ?? '∞'}`);
      if (p.pattern) rules.push(`pattern ${p.pattern}`);
      return `<tr><td>${esc(k)}${req.has(k) ? '<span class="req">*</span>' : ''}</td><td>${esc(p.type || (p.$ref ? p.$ref.split('/').pop() : 'object'))}${rules.length ? ' · ' + esc(rules.join(' · ')) : ''}<br><span style="font-size:12px">${esc(p.description || '')}</span></td></tr>`;
    }).join('')}</table>`;
  }

  function buildEndpoints(openapi, run) {
    const groups = {};
    for (const [path, ops] of Object.entries(openapi.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const tag = (op.tags && op.tags[0]) || 'Other';
        (groups[tag] = groups[tag] || []).push({ path, method: method.toUpperCase(), op });
      }
    }
    const order = ['Auth', 'Health', 'Users', 'Categories', 'Requests', 'Dashboard & reports'];
    const list = $('#epList');
    const sample = (method, path) => {
      const re = new RegExp('^' + path.replace(/\{[^}]+\}/g, '[^/?]+') + '(\\?.*)?$');
      const hits = run.executions.filter((e) => e.method === method && re.test(e.path));
      return hits.find((e) => e.status < 300) || hits[0];
    };
    list.innerHTML = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((tag) => `
      <div class="ep-group"><h3>${esc(tag)}</h3>${groups[tag].map(({ path, method, op }) => {
        const ex = sample(method, path);
        const secured = op.security && op.security.length;
        const params = (op.parameters || []).filter((p) => p.in === 'query');
        const body = op.requestBody && op.requestBody.content['application/json'].schema;
        return `<div class="ep" data-search="${esc((method + ' ' + path + ' ' + (op.summary || '') + ' ' + tag).toLowerCase())}">
          <button aria-expanded="false"><span class="${methodCls(method)}">${method}</span><span class="path">${esc(path)}</span><span class="sum">${esc(op.summary || '')}</span>
          <span class="lock">${secured ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Bearer' : 'public'}</span></button>
          <div class="ep-body"><div><div class="ep-inner">
            <div>
              <h5>Description</h5><p class="muted" style="margin:0;font-size:14px">${esc(op.summary || '')}</p>
              ${params.length ? `<h5>Query parameters</h5><table class="props">${params.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.schema.type || (p.schema.enum ? 'enum' : ''))}${p.schema.enum ? ' · ' + esc(p.schema.enum.join(' | ')) : ''}${p.schema.minimum !== undefined ? ` · min ${p.schema.minimum}` : ''}${p.schema.maximum !== undefined ? ` · max ${p.schema.maximum}` : ''}</td></tr>`).join('')}</table>` : ''}
              ${body ? `<h5>Body (${esc((body.$ref || '').split('/').pop())})</h5>${schemaRows(body, openapi)}` : ''}
            </div>
            <div>
              <h5>Recorded response ${ex ? `<span class="${statusCls(ex.status)}">${ex.status}</span>` : ''}</h5>
              ${ex ? `<div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(ex.name)} · ${esc(ex.method)} ${esc(ex.path)}</div><pre class="code json">${json(ex.body)}</pre>` : '<p class="muted">Not called in the recorded run.</p>'}
            </div>
          </div></div></div>
        </div>`;
      }).join('')}</div>`).join('');
    $$('.ep > button', list).forEach((b) => b.addEventListener('click', () => {
      const ep = b.parentElement;
      const open = ep.classList.toggle('open');
      b.setAttribute('aria-expanded', String(open));
    }));
    $('#epSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      $$('.ep', list).forEach((ep) => (ep.style.display = !q || q.split(/\s+/).every((w) => ep.dataset.search.includes(w)) ? '' : 'none'));
      $$('.ep-group', list).forEach((g) => (g.style.display = $$('.ep', g).some((ep) => ep.style.display !== 'none') ? '' : 'none'));
    });
  }

  function buildReplay(run) {
    const total = run.totals;
    $('#replayLead').innerHTML = `Every request from <code>npm run test:postman</code> against a freshly started API: <b>${total.requests} requests</b>, <b>${total.assertions} assertions</b>, <b style="color:var(--green)">${total.assertionsFailed} failed</b>, in ${(run.durationMs / 1000).toFixed(1)}s. Choose a scenario folder, then a request, to see its real status, request id, response body and assertions.`;
    const folders = run.folders;
    const fBox = $('#folders');
    fBox.innerHTML = folders.map((f, i) => {
      const ex = run.executions.filter((e) => e.folder === f);
      const passed = ex.reduce((n, e) => n + e.assertions.filter((a) => a.passed).length, 0);
      const all = ex.reduce((n, e) => n + e.assertions.length, 0);
      return `<button class="folder${i === 3 ? ' on' : ''}" role="tab" data-f="${esc(f)}"><span>${esc(f)}</span><span class="cnt">${passed}/${all} ✓</span></button>`;
    }).join('');
    const showFolder = (f) => {
      $$('.folder', fBox).forEach((b) => b.classList.toggle('on', b.dataset.f === f));
      const ex = run.executions.map((e, i) => ({ ...e, i })).filter((e) => e.folder === f);
      $('#runlist').innerHTML = ex.map((e) => `<button class="run-item" data-i="${e.i}"><span class="${methodCls(e.method)}">${e.method}</span><span class="nm">${esc(e.name)}</span><span class="status ${statusCls(e.status)}">${e.status}</span></button>`).join('');
      $$('.run-item').forEach((b) => b.addEventListener('click', () => showRun(Number(b.dataset.i))));
      if (ex.length) showRun(ex[0].i);
    };
    const showRun = (i) => {
      const e = run.executions[i];
      $$('.run-item').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i));
      $('#viewer').innerHTML = `
        <div class="viewer-head"><span class="${methodCls(e.method)}" style="padding:5px 10px">${e.method}</span><span class="path">${esc(e.path)}</span>
          <span class="status ${statusCls(e.status)}" style="margin-left:auto">${e.status} ${esc(e.statusText || '')} · ${e.ms} ms</span>
          <span class="rid">X-Request-Id: ${esc(e.requestId || '-')}${e.auth ? ' · sent with Authorization: Bearer …' : ' · no token sent'}</span></div>
        <h5>Assertions</h5>
        <div class="asserts">${e.assertions.map((a, k) => `<div class="assert${a.passed ? '' : ' no'}" style="animation-delay:${k * 70}ms">${esc(a.name)}</div>`).join('') || '<span class="muted">-</span>'}</div>
        <div class="viewer-grid">
          <div><h5>Request body</h5><pre class="code json">${e.requestBody ? json(e.requestBody) : '<span class="j-null">(none)</span>'}</pre></div>
          <div><h5>Response body</h5><pre class="code json">${json(e.body)}</pre></div>
        </div>`;
    };
    $$('.folder', fBox).forEach((b) => b.addEventListener('click', () => showFolder(b.dataset.f)));
    showFolder(folders[3]);
  }

  /* ------------------------------------------------------------ gallery */
  const SHOTS = [
    ['02-jest-e2e-tests.png', 'npm test: 76 e2e tests', 'Jest + supertest on the real AppModule'],
    ['03a-postman-auth.png', 'Postman S1 + run summary', '138 requests, 218 assertions, 0 failed'],
    ['03b-postman-limits.png', 'Postman S5: limits', 'Sixth request, fourth job, wrong category'],
    ['03c-postman-concurrency.png', 'Postman S11: races', 'pm.sendRequest in parallel'],
    ['04-lifecycle-trace.png', 'Lifecycle trace', 'Success, 401 and 400 on PATCH /requests/:id'],
    ['05-concurrency-demo.png', 'npm run demo:concurrency', 'Limits hold, no history for failed requests'],
    ['06-storage-replacement.png', 'Storage provider replaced', 'FIXFLOW_STORE bound to FakeFixflowStore'],
    ['07-request-id-and-wrapping.png', 'Request ids + wrapping', 'Header matches body; errors unwrapped'],
    ['01-seed-command.png', 'npm run seed', 'Demo accounts and the seed snapshot'],
  ];
  const gal = $('#gallery');
  gal.innerHTML = SHOTS.map(([f, t, d], i) => `<button class="card shot reveal${i % 3 ? ' d' + (i % 3) : ''}" data-src="fixflow-api/docs/evidence/${f}" data-cap="${esc(t)}: ${esc(d)}">
    <div class="frame"><img loading="lazy" src="fixflow-api/docs/evidence/${f}" alt="${esc(t)}"></div><figcaption>${esc(t)}<small>${esc(d)}</small></figcaption></button>`).join('');
  watchReveal(gal);
  const lb = $('#lightbox');
  $$('.shot', gal).forEach((s) => s.addEventListener('click', () => {
    $('#lbImg').src = s.dataset.src;
    $('#lbImg').alt = s.dataset.cap;
    $('#lbCap').textContent = s.dataset.cap;
    lb.classList.add('open');
    $('#lbClose').focus();
  }));
  const closeLb = () => lb.classList.remove('open');
  $('#lbClose').addEventListener('click', closeLb);
  lb.addEventListener('click', (e) => e.target === lb && closeLb());
  addEventListener('keydown', (e) => e.key === 'Escape' && closeLb());
})();
