// Lab 7 Part 1 tests: npm test
// Each test file run starts its own server on a free port with fresh seed data.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.js";

process.env.QUIET = "1";
let server, base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
  });
  return { status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json() };
}

const newStudent = (over = {}) => ({ rollNo: "249001", name: "Test Student", email: "test.student@uni.edu.pk", program: "BSCS", semester: 5, section: "A", ...over });
const newTeacher = (over = {}) => ({ name: "Test Teacher", email: "test.teacher@uni.edu.pk", designation: "Lecturer", department: "Computer Science", course: "Testing 101", ...over });

test("original routes still work: /health, /hello, 404", async () => {
  assert.equal((await call("GET", "/health")).body.status, "ok");
  assert.deepEqual((await call("GET", "/hello?name=Ali")).body, { message: "Hello Ali" });
  assert.deepEqual((await call("GET", "/hello")).body, { message: "Hello Guest" });
  const r = await call("GET", "/does-not-exist");
  assert.equal(r.status, 404);
  assert.equal(r.body.error, "Route not found");
});

test("students: full CRUD", async () => {
  const created = await call("POST", "/api/students", newStudent());
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal(created.headers.get("location"), `/api/students/${id}`);

  assert.equal((await call("GET", `/api/students/${id}`)).body.data.name, "Test Student");

  const patched = await call("PATCH", `/api/students/${id}`, { semester: 6 });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.semester, 6);
  assert.equal(patched.body.data.name, "Test Student", "PATCH keeps the other fields");

  const put = await call("PUT", `/api/students/${id}`, newStudent({ name: "Renamed Student", semester: 7 }));
  assert.equal(put.body.data.name, "Renamed Student");

  const del = await call("DELETE", `/api/students/${id}`);
  assert.equal(del.status, 200);
  assert.equal((await call("GET", `/api/students/${id}`)).status, 404);
});

test("students: validation, duplicates and PUT needing every field", async () => {
  const bad = await call("POST", "/api/students", { rollNo: "12", name: "X", email: "nope", program: "MBA", semester: 9, extra: 1 });
  assert.equal(bad.status, 422);
  assert.deepEqual(bad.body.details.map((d) => d.field).sort(), ["email", "extra", "name", "program", "rollNo", "semester"]);

  const dup = await call("POST", "/api/students", newStudent({ rollNo: "241854" }));
  assert.equal(dup.status, 409);
  assert.match(dup.body.error, /241854/);

  const dupEmail = await call("POST", "/api/students", newStudent({ email: "AYESHA.KHAN@uni.edu.pk" }));
  assert.equal(dupEmail.status, 409, "emails are compared without case");

  const put = await call("PUT", "/api/students/1", { name: "Only A Name" });
  assert.equal(put.status, 422, "PUT replaces the whole record, so required fields are needed");
});

test("students: list with filters, search, sort and pagination", async () => {
  const bscs = await call("GET", "/api/students?program=BSCS");
  assert.ok(bscs.body.data.every((s) => s.program === "BSCS"));
  assert.equal((await call("GET", "/api/students?q=raheem")).body.data[0].rollNo, "241854");
  const sorted = await call("GET", "/api/students?sort=-name&limit=2&offset=1");
  assert.equal(sorted.body.count, 2);
  assert.equal(sorted.body.total, 8);
  assert.equal((await call("GET", "/api/students?sort=password")).status, 400);
  assert.equal((await call("GET", "/api/students?colour=red")).status, 400);
});

test("teachers: full CRUD and phone rule", async () => {
  assert.equal((await call("POST", "/api/teachers", newTeacher({ phone: "12345" }))).status, 422);
  const created = await call("POST", "/api/teachers", newTeacher());
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal((await call("PATCH", `/api/teachers/${id}`, { designation: "Professor" })).body.data.designation, "Professor");
  assert.equal((await call("DELETE", `/api/teachers/${id}`)).status, 200);
  assert.equal((await call("DELETE", `/api/teachers/${id}`)).status, 404);
});

test("attendance: CRUD, references, dates and one record per day", async () => {
  const body = { studentId: 1, teacherId: 3, date: "2026-10-21", status: "present" };
  const created = await call("POST", "/api/attendance", body);
  assert.equal(created.status, 201);
  assert.equal(created.body.data.course, "Operating Systems");
  const id = created.body.data.id;

  assert.equal((await call("POST", "/api/attendance", body)).status, 409, "same student, course and date");
  assert.equal((await call("POST", "/api/attendance", { ...body, studentId: 999 })).status, 422);
  assert.equal((await call("POST", "/api/attendance", { ...body, date: "2026-02-30" })).status, 422);
  assert.equal((await call("POST", "/api/attendance", { ...body, date: "2099-01-01" })).status, 422);
  assert.equal((await call("POST", "/api/attendance", { ...body, status: "sleeping" })).status, 422);

  assert.equal((await call("PATCH", `/api/attendance/${id}`, { status: "late" })).body.data.status, "late");
  assert.equal((await call("GET", "/api/attendance?studentId=1&teacherId=3")).body.total, 1);
  assert.equal((await call("DELETE", `/api/attendance/${id}`)).status, 200);
});

test("marks: CRUD, percentage, grade and obtained <= total", async () => {
  const created = await call("POST", "/api/marks", { studentId: 2, teacherId: 3, assessment: "quiz", title: "Quiz 1", obtained: 7, total: 10 });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.percentage, 70);
  assert.equal(created.body.data.grade, "B-");
  const id = created.body.data.id;

  const tooMany = await call("PATCH", `/api/marks/${id}`, { obtained: 11 });
  assert.equal(tooMany.status, 422, "PATCH checks the merged record");
  assert.match(tooMany.body.details[0].message, /cannot be more than/);

  assert.equal((await call("PATCH", `/api/marks/${id}`, { obtained: 9 })).body.data.grade, "A");
  assert.equal((await call("DELETE", `/api/marks/${id}`)).status, 200);
});

test("delete refuses while related records exist, unless ?cascade=true", async () => {
  const refused = await call("DELETE", "/api/students/3");
  assert.equal(refused.status, 409);
  assert.deepEqual(refused.body.related, { attendance: 8, marks: 5 });

  const done = await call("DELETE", "/api/students/3?cascade=true");
  assert.equal(done.status, 200);
  assert.equal((await call("GET", "/api/attendance?studentId=3")).body.total, 0);
  assert.equal((await call("GET", "/api/marks?studentId=3")).body.total, 0);
});

test("report combines attendance and marks, with a warning below 75%", async () => {
  const r = await call("GET", "/api/students/5/report");
  assert.equal(r.status, 200);
  assert.ok(r.body.data.attendance.percentage < 75);
  assert.equal(r.body.data.courses.length, 2);
  assert.ok(r.body.data.warnings.some((w) => /below the required 75%/.test(w)));
});

test("HTTP errors: 400 bad JSON / id, 405 wrong method, 415 not JSON", async () => {
  assert.equal((await call("POST", "/api/students", "{bad json")).status, 400);
  assert.equal((await call("POST", "/api/students", "[1,2]")).status, 400);
  assert.equal((await call("GET", "/api/students/abc")).status, 400);
  const wrong = await call("DELETE", "/api/students");
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get("allow"), "GET, POST");
  const form = await fetch(base + "/api/students", { method: "POST", body: "name=Ali", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  assert.equal(form.status, 415);
});

test("data lives in memory: POST /api/reset brings back the starting records", async () => {
  await call("POST", "/api/students", newStudent({ rollNo: "249555", email: "reset.me@uni.edu.pk" }));
  const reset = await call("POST", "/api/reset");
  assert.deepEqual(reset.body.counts, { students: 8, teachers: 4, attendance: 64, marks: 40 });
});
