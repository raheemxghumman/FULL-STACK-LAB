/* Tests for Tasks 5-8 (node:test, built into Node.js).  npm test */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import Student from "../Task-5-Transcript-Modules/Student.js";
import { calculateGrade, calculateAverage, calculateGPA } from "../Task-5-Transcript-Modules/gradeUtils.js";
import { processTranscript, reportToJSON } from "../Task-5-Transcript-Modules/transcriptService.js";
import { createRegistry, registerStudentForCourse, loadStudent } from "../Task-6-Callbacks/registration.js";
import {
  createDatabase, registrationChain, brokenRegistrationChain, runPostRegistration, getCourseFromFastestServer
} from "../Task-7-Promises/registrationService.js";
import {
  getJSON, fakeFetch, loadDashboard, fetchWithTimeout, HttpError, NetworkError, InvalidJSONError, TimeoutError
} from "../Task-8-Async-Await/api.js";

describe("Task 5 - transcript modules", () => {
  const good = JSON.stringify([{ id: 101, name: "Ali", courses: [{ code: "CS301", marks: 81 }, { code: "CS302", marks: 74 }] }]);
  test("grade utilities", () => {
    assert.equal(calculateGrade(81), "A-");
    assert.equal(calculateAverage([81, 74]), 77.5);
    assert.equal(calculateGPA([81, 74]), 3.34);
    assert.equal(calculateAverage([]), 0);
    assert.throws(() => calculateGrade(-1), RangeError);
  });
  test("valid JSON becomes a report and back to JSON", () => {
    const report = processTranscript(good);
    assert.equal(report.students[0].average, 77.5);
    assert.equal(report.students[0].gpa, 3.34);
    assert.equal(JSON.parse(reportToJSON(report)).studentCount, 1);
  });
  test("Student default export works on its own", () => assert.equal(new Student(1, "A", [{ code: "X", marks: 90 }]).overallGrade(), "A"));
  test("rejects malformed JSON, missing id, duplicate id, bad marks, missing code", () => {
    assert.throws(() => processTranscript("[{"), (e) => e.message.startsWith("Malformed") && e.cause instanceof SyntaxError);
    assert.throws(() => processTranscript('[{"name":"A","courses":[]}]'), TypeError);
    assert.throws(() => processTranscript('[{"id":1,"name":"A","courses":[]},{"id":1,"name":"B","courses":[]}]'), /Duplicate/);
    assert.throws(() => processTranscript('[{"id":1,"name":"A","courses":[{"code":"X","marks":101}]}]'), RangeError);
    assert.throws(() => processTranscript('[{"id":1,"name":"A","courses":[{"code":"X","marks":-1}]}]'), RangeError);
    assert.throws(() => processTranscript('[{"id":1,"name":"A","courses":[{"marks":50}]}]'), TypeError);
  });
  test("boundary marks 0 and 100 are accepted", () => {
    assert.equal(processTranscript('[{"id":1,"name":"A","courses":[{"code":"X","marks":0},{"code":"Y","marks":100}]}]').students[0].average, 50);
  });
});

// Wraps a callback API so the test can wait for it; the code under test itself uses no Promises.
function runCallback(registry, studentId, course) {
  return new Promise((resolve) => {
    let calls = 0;
    registerStudentForCourse(registry, studentId, course, (error, value) => {
      calls++;
      setTimeout(() => resolve({ error, value, calls }), 120);   // wait a little to catch a second call
    });
  });
}

describe("Task 6 - callbacks", () => {
  test("success returns the confirmation, callback called once", async () => {
    const r = await runCallback(createRegistry(), 101, "CS401");
    assert.equal(r.error, null);
    assert.deepEqual(r.value, { studentId: 101, course: "CS401", status: "REGISTERED" });
    assert.equal(r.calls, 1);
  });
  test("each failure code stops the workflow", async () => {
    const registry = createRegistry();
    assert.equal((await runCallback(registry, 999, "CS401")).error.code, "STUDENT_NOT_FOUND");
    assert.equal((await runCallback(registry, 102, "CS401")).error.code, "PREREQUISITE_MISSING");
    assert.equal((await runCallback(registry, 101, "CS402")).error.code, "COURSE_FULL");
    await runCallback(registry, 101, "CS401");
    const again = await runCallback(registry, 101, "CS401");
    assert.equal(again.error.code, "ALREADY_REGISTERED");
    assert.equal(again.calls, 1);
  });
  test("a failure does not change the data", async () => {
    const registry = createRegistry();
    await runCallback(registry, 102, "CS401");
    assert.deepEqual(registry.courses.CS401.registered, [103]);
  });
  test("missing callback throws immediately", () => assert.throws(() => loadStudent(createRegistry(), 101), TypeError));
});

describe("Task 7 - promises", () => {
  test("chain passes data through and registers", async () => {
    const { confirmation, student, course } = await registrationChain(createDatabase(), 101, "CS401");
    assert.deepEqual(confirmation, { studentId: 101, course: "CS401", status: "REGISTERED" });
    assert.equal(student.name, "Ali Khan");
    assert.equal(course.code, "CS401");
  });
  test("chain rejects at the right stage", async () => {
    const db = createDatabase();
    await assert.rejects(registrationChain(db, 404, "CS401"), { code: "STUDENT_NOT_FOUND" });
    await assert.rejects(registrationChain(db, 103, "CS401"), { code: "PREREQUISITE_MISSING" });
    await assert.rejects(registrationChain(db, 101, "ZZ1"), { code: "COURSE_NOT_FOUND" });
  });
  test("a missing return breaks the chain", async () => {
    await assert.rejects(brokenRegistrationChain(createDatabase(), 101, "CS401"), TypeError);
  });
  test("allSettled reports every service even when one fails", async () => {
    const db = createDatabase();
    const report = await runPostRegistration(db, db.students[102], { studentId: 102, course: "CS401", status: "REGISTERED" });
    assert.deepEqual(report.map((r) => [r.service, r.status]), [["Email", "fulfilled"], ["SMS", "rejected"], ["Audit", "fulfilled"]]);
  });
  test("Promise.any takes the first success and ignores a faster failure", async () => {
    const course = await getCourseFromFastestServer("CS401", { ms: 10, fail: true }, { ms: 40, fail: false });
    assert.equal(course.server, "Mirror server");
    await assert.rejects(getCourseFromFastestServer("CS401", { ms: 10, fail: true }, { ms: 20, fail: true }), AggregateError);
  });
});

describe("Task 8 - async/await", () => {
  test("getJSON returns data and maps each failure to its error type", async () => {
    assert.equal((await getJSON("/courses", fakeFetch)).length, 3);
    await assert.rejects(getJSON("/missing", fakeFetch), (e) => e instanceof HttpError && e.status === 404);
    await assert.rejects(getJSON("/server-error", fakeFetch), (e) => e instanceof HttpError && e.status === 500);
    await assert.rejects(getJSON("/network-down", fakeFetch), NetworkError);
    await assert.rejects(getJSON("/bad-json", fakeFetch), InvalidJSONError);
  });
  test("dashboard loads concurrently and computes the statistics", async () => {
    const start = Date.now();
    const d = await loadDashboard(fakeFetch);
    assert.ok(Date.now() - start < 450, "three 200 ms requests should overlap");
    assert.equal(d.totalStudents, 6);
    assert.equal(d.totalCourses, 3);
    assert.equal(d.failedStudents, 1);
    assert.deepEqual(d.highestPerformingStudent, { name: "Zoya", average: 92.5 });
  });
  test("fetchWithTimeout: success, timeout, and other errors are not timeouts", async () => {
    assert.equal((await fetchWithTimeout("/courses", 1000)).length, 3);
    await assert.rejects(fetchWithTimeout("/slow", 100), TimeoutError);
    await assert.rejects(fetchWithTimeout("/missing", 1000), HttpError);
    await assert.rejects(fetchWithTimeout("/users", 0), RangeError);
  });
  test("getJSON also works with any fetch-compatible function", async () => {
    const stub = async () => ({ ok: true, status: 200, json: async () => ({ hello: "world" }) });
    assert.deepEqual(await getJSON("/anything", stub), { hello: "world" });
  });
});
