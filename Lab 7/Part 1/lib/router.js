/* ==========================================================================
   lib/router.js - the Student Management System API
   --------------------------------------------------------------------------
   createApi() returns an object with one method:

     handle({ method, url, headers, body })  ->  { status, headers, body }

   It does not know about sockets or the network. server.js calls it for
   every HTTP request, and the test UI calls it directly when no server is
   running (on GitHub Pages), so both use exactly the same code.

   Endpoints (the same five for every module: students, teachers,
   attendance, marks)

     GET    /api/<module>         list (filters, ?q= search, ?sort=, ?limit=, ?offset=)
     GET    /api/<module>/:id     read one
     POST   /api/<module>         create          201 + Location header
     PUT    /api/<module>/:id     replace (every required field)
     PATCH  /api/<module>/:id     update some fields
     DELETE /api/<module>/:id     delete (?cascade=true also deletes related records)

   plus GET /health, GET /hello (from the original file), GET /api,
   GET /api/stats, GET /api/students/:id/report and POST /api/reset.
   ========================================================================== */

import { validate, todayISO } from "./validate.js";
import { createDatabase, counts } from "./db.js";
import { MODULES, READ_ONLY, MIN_ATTENDANCE, gradeFor, round1 } from "./modules.js";
import { SEED } from "./seed.js";

/* An error that becomes an HTTP response: throw it anywhere in a handler. */
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const MAX_LIST = 500;

export function createApi({ seed = true } = {}) {
  let db = createDatabase(seed ? SEED : null);
  const startedAt = Date.now();
  const routes = [];

  /* ---------- route table ---------------------------------------------- */

  // "/api/students/:id" -> RegExp with a named group for each :param
  function route(method, pattern, handler, { body = false, description = "" } = {}) {
    const regex = new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "/?$");
    routes.push({ method, pattern, regex, handler, body, description });
  }

  route("GET", "/health", () => ok({
    status: "ok", service: "student-management-api", storage: "in-memory",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), counts: counts(db)
  }), { description: "Server status and record counts" });

  route("GET", "/hello", ({ query }) => ok({ message: `Hello ${query.get("name") ?? "Guest"}` }),
    { description: "Greeting from the original file, e.g. /hello?name=Ali" });

  route("GET", "/api", () => ok({
    name: "Student Management System API", modules: Object.keys(MODULES),
    endpoints: routes.map((r) => ({ method: r.method, path: r.pattern, description: r.description }))
  }), { description: "This list of endpoints" });

  route("GET", "/api/stats", () => ok({ data: stats() }), { description: "Dashboard numbers" });

  route("POST", "/api/reset", () => {
    db = createDatabase(SEED);
    return ok({ message: "All data was reset to the starting records.", counts: counts(db) });
  }, { description: "Restore the starting data" });

  route("GET", "/api/students/:id/report", ({ params }) => ok({ data: report(findOr404("students", params.id)) }),
    { description: "Attendance and marks report for one student" });

  for (const [name, mod] of Object.entries(MODULES)) {
    const base = `/api/${name}`;
    route("GET", base, (ctx) => list(name, ctx), { description: `List ${name}` });
    route("POST", base, (ctx) => create(name, ctx), { body: true, description: `Create a ${mod.title.toLowerCase()}` });
    route("GET", `${base}/:id`, ({ params }) => ok({ data: present(name, findOr404(name, params.id)) }), { description: `Read one ${mod.title.toLowerCase()}` });
    route("PUT", `${base}/:id`, (ctx) => update(name, ctx, false), { body: true, description: `Replace a ${mod.title.toLowerCase()}` });
    route("PATCH", `${base}/:id`, (ctx) => update(name, ctx, true), { body: true, description: `Update some fields of a ${mod.title.toLowerCase()}` });
    route("DELETE", `${base}/:id`, (ctx) => remove(name, ctx), { description: `Delete a ${mod.title.toLowerCase()}` });
  }

  /* ---------- response helpers ----------------------------------------- */

  function ok(body, status = 200, headers = {}) {
    return { status, headers, body };
  }

  // Adds the read-only fields (names, percentages, grade) to a stored record
  function present(name, record) {
    return { ...record, ...MODULES[name].decorate(record, db) };
  }

  function findOr404(name, rawId) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) throw new HttpError(400, `"${rawId}" is not a valid id. Ids are positive whole numbers.`);
    const record = db[name].get(id);
    if (!record) throw new HttpError(404, `${MODULES[name].title} ${id} not found.`);
    return record;
  }

  /* ---------- CRUD handlers -------------------------------------------- */

  function list(name, { query }) {
    const mod = MODULES[name];
    const allowed = ["q", "sort", "limit", "offset", ...mod.filters];
    const unknown = [...query.keys()].filter((k) => !allowed.includes(k));
    if (unknown.length) {
      throw new HttpError(400, `Unknown query parameter: ${unknown.join(", ")}.`, { allowed });
    }

    let rows = db[name].all().map((r) => present(name, r));

    for (const field of mod.filters) {
      if (!query.has(field)) continue;
      const wanted = query.get(field).trim().toLowerCase();
      rows = rows.filter((r) => String(r[field]).toLowerCase() === wanted);
    }

    const q = (query.get("q") || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => q.split(/\s+/).every((word) =>
        mod.search.some((field) => String(r[field] ?? "").toLowerCase().includes(word))));
    }

    const sort = query.get("sort") || mod.defaultSort;
    const key = sort.replace(/^-/, "");
    if (!mod.sortable.includes(key)) {
      throw new HttpError(400, `Cannot sort ${name} by "${key}".`, { allowed: mod.sortable });
    }
    const dir = sort.startsWith("-") ? -1 : 1;
    rows.sort((a, b) => {
      const x = a[key], y = b[key];
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return cmp * dir || a.id - b.id;
    });

    const total = rows.length;
    const limit = query.has("limit") ? toCount(query.get("limit"), "limit", 1) : MAX_LIST;
    const offset = query.has("offset") ? toCount(query.get("offset"), "offset", 0) : 0;
    const data = rows.slice(offset, offset + Math.min(limit, MAX_LIST));
    return ok({ count: data.length, total, data });
  }

  function toCount(raw, label, min) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min) throw new HttpError(400, `${label} must be a whole number of at least ${min}.`);
    return n;
  }

  // Runs the schema, the cross-field check, the references and the unique rules.
  function checkRecord(name, input, selfId = null) {
    const mod = MODULES[name];
    const { value, errors } = validate(input, mod.schema, { readOnly: READ_ONLY });

    if (!errors.length && mod.check) errors.push(...mod.check(value));

    for (const [field, spec] of Object.entries(mod.schema)) {
      if (spec.type === "ref" && value[field] !== undefined && !db[spec.ref].get(value[field])) {
        errors.push({ field, message: `${MODULES[spec.ref].title} ${value[field]} does not exist.` });
      }
    }
    if (errors.length) throw new HttpError(422, `The ${mod.title.toLowerCase()} has ${errors.length} invalid field${errors.length > 1 ? "s" : ""}.`, { details: errors });

    for (const rule of mod.unique) {
      const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
      const existing = db[name].all().find((r) => r.id !== selfId && rule.fields.every((f) => same(r[f], value[f])));
      if (existing) {
        throw new HttpError(409, rule.message(value, existing), {
          details: rule.fields.map((field) => ({ field, message: "Already in use." })), conflictId: existing.id
        });
      }
    }
    return value;
  }

  function create(name, { body }) {
    const value = checkRecord(name, body);
    const record = db[name].insert(value);
    return ok({ message: `${MODULES[name].title} created.`, data: present(name, record) }, 201, { Location: `/api/${name}/${record.id}` });
  }

  // PUT needs every required field; PATCH merges the sent fields into the stored record.
  function update(name, { params, body }, partial) {
    const current = findOr404(name, params.id);
    if (partial && Object.keys(body).length === 0) throw new HttpError(400, "Send at least one field to update.");
    if (partial) {
      const bad = Object.keys(body).filter((k) => !(k in MODULES[name].schema) && !READ_ONLY.includes(k));
      if (bad.length) {
        throw new HttpError(422, `Unknown field: ${bad.join(", ")}.`, { details: bad.map((field) => ({ field, message: `"${field}" is not a field of this record.` })) });
      }
    }
    const input = partial ? { ...current, ...body } : body;
    const value = checkRecord(name, input, current.id);
    const record = db[name].update(current.id, value);
    return ok({ message: `${MODULES[name].title} ${record.id} updated.`, data: present(name, record) });
  }

  function remove(name, { params, query }) {
    const extra = [...query.keys()].filter((k) => k !== "cascade");
    if (extra.length) throw new HttpError(400, `Unknown query parameter: ${extra.join(", ")}.`, { allowed: ["cascade"] });

    const mod = MODULES[name];
    const record = findOr404(name, params.id);
    const related = Object.fromEntries(mod.dependents.map((d) =>
      [d.module, db[d.module].all().filter((r) => r[d.field] === record.id).length]));
    const relatedTotal = Object.values(related).reduce((a, b) => a + b, 0);

    if (relatedTotal > 0 && query.get("cascade") !== "true") {
      throw new HttpError(409, `${mod.title} ${record.id} still has ${describe(related)}. Delete those first, or repeat the request with ?cascade=true to delete them too.`, { related });
    }
    for (const d of mod.dependents) db[d.module].removeWhere((r) => r[d.field] === record.id);
    const deleted = present(name, record);
    db[name].remove(record.id);
    return ok({ message: `${mod.title} ${record.id} deleted${relatedTotal ? ` with ${describe(related)}` : ""}.`, data: deleted, related });
  }

  const describe = (related) => Object.entries(related).filter(([, n]) => n)
    .map(([m, n]) => `${n} ${m === "marks" ? "marks" : "attendance"} record${n > 1 ? "s" : ""}`).join(" and ");

  /* ---------- report and stats ----------------------------------------- */

  function report(student) {
    const attendance = db.attendance.all().filter((a) => a.studentId === student.id);
    const marks = db.marks.all().filter((m) => m.studentId === student.id);

    const tally = (rows) => {
      const t = { total: rows.length, present: 0, absent: 0, late: 0, leave: 0 };
      rows.forEach((r) => t[r.status]++);
      t.percentage = rows.length ? round1(((t.present + t.late) / rows.length) * 100) : null;
      return t;
    };

    const courseIds = [...new Set([...attendance, ...marks].map((r) => r.teacherId))];
    const courses = courseIds.map((teacherId) => {
      const teacher = db.teachers.get(teacherId);
      const m = marks.filter((r) => r.teacherId === teacherId);
      const obtained = m.reduce((s, r) => s + r.obtained, 0);
      const total = m.reduce((s, r) => s + r.total, 0);
      const percentage = total ? round1((obtained / total) * 100) : null;
      return {
        teacherId, course: teacher.course, teacher: teacher.name,
        attendance: tally(attendance.filter((r) => r.teacherId === teacherId)),
        marks: {
          obtained, total, percentage, grade: percentage === null ? null : gradeFor(percentage),
          assessments: m.map((r) => ({ id: r.id, title: r.title, assessment: r.assessment, obtained: r.obtained, total: r.total }))
        }
      };
    });

    const obtained = marks.reduce((s, r) => s + r.obtained, 0);
    const total = marks.reduce((s, r) => s + r.total, 0);
    const overallPct = total ? round1((obtained / total) * 100) : null;
    const overallAttendance = tally(attendance);

    const warnings = [];
    if (overallAttendance.percentage !== null && overallAttendance.percentage < MIN_ATTENDANCE) {
      warnings.push(`Attendance is ${overallAttendance.percentage}%, below the required ${MIN_ATTENDANCE}%.`);
    }
    courses.filter((c) => c.marks.grade === "F").forEach((c) => warnings.push(`Failing ${c.course} (${c.marks.percentage}%).`));

    return {
      student: present("students", student),
      attendance: overallAttendance,
      marks: { obtained, total, percentage: overallPct, grade: overallPct === null ? null : gradeFor(overallPct) },
      courses,
      warnings
    };
  }

  function stats() {
    const att = db.attendance.all();
    const byStatus = { present: 0, absent: 0, late: 0, leave: 0 };
    att.forEach((a) => byStatus[a.status]++);
    const latestDate = att.map((a) => a.date).sort().pop() || null;
    const students = db.students.all().map((s) => present("students", s));
    const marksRows = db.marks.all();
    const obtained = marksRows.reduce((s, r) => s + r.obtained, 0);
    const total = marksRows.reduce((s, r) => s + r.total, 0);
    return {
      counts: counts(db),
      attendance: { byStatus, latestDate, percentage: att.length ? round1(((byStatus.present + byStatus.late) / att.length) * 100) : null },
      averageMarks: total ? round1((obtained / total) * 100) : null,
      lowAttendance: students.filter((s) => s.attendancePercent !== null && s.attendancePercent < MIN_ATTENDANCE)
        .map((s) => ({ id: s.id, name: s.name, rollNo: s.rollNo, attendancePercent: s.attendancePercent })),
      topStudents: students.filter((s) => s.marksPercent !== null).sort((a, b) => b.marksPercent - a.marksPercent).slice(0, 3)
        .map((s) => ({ id: s.id, name: s.name, rollNo: s.rollNo, marksPercent: s.marksPercent, grade: gradeFor(s.marksPercent) })),
      byProgram: students.reduce((acc, s) => ({ ...acc, [s.program]: (acc[s.program] || 0) + 1 }), {}),
      today: todayISO()
    };
  }

  /* ---------- request entry point -------------------------------------- */

  function readBody(req, method) {
    const raw = typeof req.body === "string" ? req.body : "";
    if (raw.trim() === "") throw new HttpError(400, `A JSON body is required for ${method}.`);
    const type = String((req.headers || {})["content-type"] || "");
    if (!type.includes("application/json")) {
      throw new HttpError(415, `Send the body as JSON with the header Content-Type: application/json (got "${type || "none"}").`);
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch (err) {
      throw new HttpError(400, `The body is not valid JSON: ${err.message}`);
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "The body must be a JSON object, e.g. { \"name\": \"Ali\" }.");
    }
    return body;
  }

  function handle(req) {
    const method = String(req.method || "GET").toUpperCase();
    const url = new URL(req.url || "/", "http://localhost");
    try {
      const matches = routes
        .map((r) => ({ r, m: r.regex.exec(url.pathname) }))
        .filter((x) => x.m);
      if (!matches.length) return ok({ error: "Route not found", path: url.pathname }, 404);

      const allowed = [...new Set(matches.map((x) => x.r.method))];
      if (method === "OPTIONS") return ok(null, 204, { Allow: [...allowed, "OPTIONS"].join(", ") });

      const hit = matches.find((x) => x.r.method === method);
      if (!hit) {
        return ok({ error: `Method ${method} is not allowed on ${url.pathname}.`, allowed }, 405, { Allow: allowed.join(", ") });
      }

      const body = hit.r.body ? readBody(req, method) : undefined;
      return hit.r.handler({ params: hit.m.groups || {}, query: url.searchParams, body });
    } catch (err) {
      if (err instanceof HttpError) return ok({ error: err.message, ...err.extra }, err.status);
      console.error(err);
      return ok({ error: "Something went wrong on the server." }, 500);
    }
  }

  return { handle, routes: () => routes.map((r) => `${r.method} ${r.pattern}`) };
}
