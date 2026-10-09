/* Tests for Tasks 1-4 (node:test is built into Node.js, no packages needed).  npm test */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { processApplicants, evaluateApplicant, summarize, calculateMerit, toNumber, STATUS } from "../Task-1-Admission/admission.js";
import { processResults, rankStudents, departmentStatistics, academicQueries, gradeFor } from "../Task-2-Performance/performance.js";
import { updateProfile, applyUpdates, compareReferences, deepFreeze } from "../Task-3-Profile-Update/profileService.js";
import { Person, Student, FacultyMember } from "../Task-4-User-Hierarchy/users.js";

const applicant = (overrides = {}) => ({
  id: "X1", name: "Test", age: "20", matricMarks: "90", intermediateMarks: "90", entryTest: "90", program: "BSCS", feePaid: "true", ...overrides
});

describe("Task 1 - admission", () => {
  test("normal: lab example gives SELECTED, INVALID DATA, SELECTED", () => {
    const decisions = processApplicants([
      applicant({ id: "A101", matricMarks: "91", intermediateMarks: "87", entryTest: "78", age: "19" }),
      applicant({ id: "A102", age: "twenty", intermediateMarks: "", program: "BSSE", feePaid: "false" }),
      applicant({ id: "A103", matricMarks: "76", intermediateMarks: "83", entryTest: "91", program: "BSAI", age: "18" })
    ]);
    assert.deepEqual(decisions.map((d) => d.status), [STATUS.SELECTED, STATUS.INVALID, STATUS.SELECTED]);
    assert.equal(decisions[0].merit, 83.3);
    assert.equal(decisions[1].merit, null);
  });
  test("merit uses 20/30/50 weights", () => assert.equal(calculateMerit({ matricMarks: 80, intermediateMarks: 70, entryTest: 60 }), 67));
  test("boundary: merit exactly 70 with entry and inter 60 is eligible", () => {
    assert.notEqual(evaluateApplicant(applicant({ matricMarks: "100", intermediateMarks: "60", entryTest: "64", program: "BSDS" })).status, STATUS.REJECTED);
  });
  test("boundary: entry test 59 is rejected even with high merit", () => {
    assert.equal(evaluateApplicant(applicant({ matricMarks: "100", intermediateMarks: "100", entryTest: "59" })).status, STATUS.REJECTED);
  });
  test("boundary: ages 17 and 30 valid, 16 and 31 invalid", () => {
    assert.notEqual(evaluateApplicant(applicant({ age: "17" })).status, STATUS.INVALID);
    assert.notEqual(evaluateApplicant(applicant({ age: "30" })).status, STATUS.INVALID);
    assert.equal(evaluateApplicant(applicant({ age: "16" })).status, STATUS.INVALID);
    assert.equal(evaluateApplicant(applicant({ age: "31" })).status, STATUS.INVALID);
  });
  test("fee not paid makes an eligible applicant WAITING", () => {
    assert.equal(evaluateApplicant(applicant({ feePaid: "false" })).status, STATUS.WAITING);
  });
  test("invalid: unsupported program, marks over 100, non-numeric, null record", () => {
    assert.equal(evaluateApplicant(applicant({ program: "BBA" })).status, STATUS.INVALID);
    assert.equal(evaluateApplicant(applicant({ entryTest: "101" })).status, STATUS.INVALID);
    assert.equal(evaluateApplicant(applicant({ matricMarks: "9o" })).status, STATUS.INVALID);
    assert.equal(evaluateApplicant(null).status, STATUS.INVALID);
  });
  test("explicit conversion: empty string is missing, '0' is a real 0", () => {
    assert.equal(toNumber("", "x").value, null);
    assert.equal(toNumber("0", "x").value, 0);
  });
  test("summary counts and does not mutate input", () => {
    const input = [applicant(), applicant({ id: "X2", age: "abc" })];
    const copy = structuredClone(input);
    const summary = summarize(processApplicants(input));
    assert.equal(summary.validApplicants, 1);
    assert.equal(summary.invalidApplicants, 1);
    assert.equal(summary.averageMerit, 90);
    assert.deepEqual(input, copy);
  });
  test("processApplicants rejects a non-array", () => assert.throws(() => processApplicants("x"), TypeError));
});

const results = [
  { id: 1, name: "Ali", department: "CS", course: "FSWD", marks: 82 },
  { id: 2, name: "Sara", department: "CS", course: "FSWD", marks: 91 },
  { id: 3, name: "Usman", department: "SE", course: "FSWD", marks: 47 },
  { id: 4, name: "Hina", department: "AI", course: "FSWD", marks: 73 },
  { id: 5, name: "Ahmed", department: "SE", course: "FSWD", marks: 64 },
  { id: 6, name: "Zoya", department: "AI", course: "FSWD", marks: 91 }
];

describe("Task 2 - performance", () => {
  test("grades follow the policy, including boundaries", () => {
    assert.deepEqual([100, 85, 84, 80, 79, 75, 74, 70, 69, 65, 64, 60, 59, 50, 49, 0].map((m) => gradeFor(m).grade),
      ["A", "A", "A-", "A-", "B+", "B+", "B", "B", "B-", "B-", "C+", "C+", "C", "C", "F", "F"]);
    assert.throws(() => gradeFor(101), RangeError);
  });
  test("ranking: marks desc, ties by name, original untouched", () => {
    const before = JSON.stringify(results);
    assert.deepEqual(rankStudents(results).map((s) => s.name), ["Sara", "Zoya", "Ali", "Hina", "Ahmed", "Usman"]);
    assert.equal(JSON.stringify(results), before);
  });
  test("department stats work for a new department", () => {
    const stats = departmentStatistics([...results, { id: 7, name: "Bilal", department: "DS", marks: 88 }]);
    assert.deepEqual(stats.SE, { students: 2, average: 55.5, highest: 64, passed: 1, failed: 1 });
    assert.equal(stats.DS.students, 1);
  });
  test("queries", () => {
    const q = academicQueries(processResults(results));
    assert.equal(q.firstAbove85.name, "Sara");
    assert.equal(q.firstFailedIndex, 2);
    assert.equal(q.anyFailed, true);
    assert.equal(q.allMarksValid, true);
    assert.equal(q.overallAverage, 74.67);
    assert.deepEqual(q.topThree, ["Sara", "Zoya", "Ali"]);
  });
  test("invalid records are filtered out", () => {
    assert.equal(processResults([...results, { id: 8, name: "X", department: "CS", marks: 120 }, null]).length, 6);
  });
});

describe("Task 3 - profile update", () => {
  const student = deepFreeze({ id: 101, name: "Ali", marks: 0, scholarship: false, address: { city: "Islamabad", sector: "F-10" }, contact: { email: "ali@university.edu" } });
  test("merges nested objects and keeps the original intact", () => {
    const updated = updateProfile(student, { name: "Ali Khan", address: { city: "Rawalpindi" }, contact: { phone: "03001234567" } });
    assert.deepEqual(updated.address, { city: "Rawalpindi", sector: "F-10" });
    assert.deepEqual(updated.contact, { email: "ali@university.edu", phone: "03001234567" });
    assert.equal(student.name, "Ali");
    assert.equal(updated.marks, 0);
    assert.equal(updated.scholarship, false);
  });
  test("0, false and '' replace values; undefined does not", () => {
    const u = updateProfile({ ...student, marks: 50, scholarship: true }, { marks: 0, scholarship: false, name: undefined, contact: { email: "" } });
    assert.equal(u.marks, 0);
    assert.equal(u.scholarship, false);
    assert.equal(u.name, "Ali");
    assert.equal(u.contact.email, "");
  });
  test("references are all different", () => {
    const refs = compareReferences(student, updateProfile(student, {}));
    assert.deepEqual(refs.map((r) => r.same), [false, false, false]);
  });
  test("applyUpdates applies several updates in order", () => {
    assert.equal(applyUpdates(student, { marks: 10 }, { marks: 20 }).marks, 20);
  });
  test("invalid input throws TypeError", () => {
    assert.throws(() => updateProfile(null, {}), TypeError);
    assert.throws(() => updateProfile(student, "x"), TypeError);
    assert.throws(() => updateProfile(student, { address: ["x"] }), TypeError);
  });
});

describe("Task 4 - user hierarchy", () => {
  const s = new Student("Ali", "ali@uni.edu", "241001", 82);
  const f = new FacultyMember("Ms Warda", "warda@uni.edu", "EMP-1", "CS");
  test("polymorphism: each object uses its own introduce()", () => {
    const lines = [s, f, new Person("Guest", "g@x.com")].map((u) => u.introduce());
    assert.match(lines[0], /roll no 241001/);
    assert.match(lines[1], /CS department/);
    assert.equal(lines[2], "Hello, I am Guest (g@x.com).");
    assert.ok(lines.every((l) => l.startsWith("Hello, I am")));   // super.introduce() reused
  });
  test("instanceof and getResult", () => {
    assert.ok(s instanceof Student && s instanceof Person && !(s instanceof FacultyMember));
    assert.deepEqual(s.getResult(), { rollNo: "241001", name: "Ali", marks: 82, status: "PASS" });
  });
  test("call, detached method, bind", () => {
    assert.equal(Person.prototype.introduce.call({ name: "Dr. Ahmed", email: "ahmed@example.com" }), "Hello, I am Dr. Ahmed (ahmed@example.com).");
    const fn = s.introduce;
    assert.throws(() => fn(), TypeError);
    assert.equal(s.introduce.bind(s)(), s.introduce());
  });
  test("constructors validate input", () => {
    assert.throws(() => new Student("A", "a@b.com", "1", 120), RangeError);
    assert.throws(() => new Person("A", "bad-email"), TypeError);
  });
});
