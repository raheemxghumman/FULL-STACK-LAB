/* ==========================================================================
   Task 2 - Academic Performance Intelligence Engine
   --------------------------------------------------------------------------
   Uses array methods (map, filter, find, findIndex, reduce, some, every,
   sort, slice, forEach) instead of hand-written loops.

   sort() and reverse() change the array they are called on, so every
   ordering here works on a copy made with slice(). The original results
   array is never modified.
   ========================================================================== */

// Grading policy from the lab manual, highest band first
export const GRADE_SCALE = [
  { min: 85, grade: "A", points: 4.0 },
  { min: 80, grade: "A-", points: 3.67 },
  { min: 75, grade: "B+", points: 3.33 },
  { min: 70, grade: "B", points: 3.0 },
  { min: 65, grade: "B-", points: 2.67 },
  { min: 60, grade: "C+", points: 2.33 },
  { min: 50, grade: "C", points: 2.0 },
  { min: 0, grade: "F", points: 0.0 }
];
export const PASS_MARK = 50;

const round2 = (n) => Math.round(n * 100) / 100;

export function isValidMarks(marks) {
  return typeof marks === "number" && Number.isFinite(marks) && marks >= 0 && marks <= 100;
}

/** Grade band for a mark. Throws RangeError for marks outside 0-100. */
export function gradeFor(marks) {
  if (!isValidMarks(marks)) throw new RangeError(`Marks must be a number from 0 to 100 (got ${marks})`);
  return GRADE_SCALE.find((band) => marks >= band.min);
}

/** A record is usable when it has an id, a name, a department and valid marks. */
export function isValidRecord(record) {
  return (
    record !== null &&
    typeof record === "object" &&
    record.id !== undefined &&
    typeof record.name === "string" && record.name.trim() !== "" &&
    typeof record.department === "string" && record.department.trim() !== "" &&
    isValidMarks(record.marks)
  );
}

/** Splits incoming data into valid and invalid records (filter does not mutate). */
export function partitionRecords(results) {
  if (!Array.isArray(results)) throw new TypeError("results must be an array");
  return {
    valid: results.filter(isValidRecord),
    invalid: results.filter((r) => !isValidRecord(r))
  };
}

/* ---------- A. Result processing ---------- */

/** Returns NEW objects with grade, gradePoints and status added. */
export function processResults(results) {
  return partitionRecords(results).valid.map((student) => {
    const { grade, points } = gradeFor(student.marks);
    return { ...student, grade, gradePoints: points, status: student.marks >= PASS_MARK ? "PASS" : "FAIL" };
  });
}

/* ---------- B. Ranked merit list ---------- */

/** Marks descending, ties broken by name A-Z. slice() copies first so the input order is kept. */
export function rankStudents(results) {
  return results
    .slice()
    .sort((a, b) => b.marks - a.marks || a.name.localeCompare(b.name))
    .map((student, index) => ({ rank: index + 1, ...student }));
}

/* ---------- C. Department statistics ---------- */

/**
 * Groups by department with reduce. Works for any department name,
 * including ones that appear later (e.g. "DS").
 */
export function departmentStatistics(results) {
  const totals = results.reduce((acc, { department, marks }) => {
    const current = acc[department] ?? { students: 0, total: 0, highest: -Infinity, passed: 0 };
    acc[department] = {
      students: current.students + 1,
      total: current.total + marks,
      highest: Math.max(current.highest, marks),
      passed: current.passed + (marks >= PASS_MARK ? 1 : 0)
    };
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(totals).map(([department, t]) => [
      department,
      { students: t.students, average: round2(t.total / t.students), highest: t.highest, passed: t.passed, failed: t.students - t.passed }
    ])
  );
}

/* ---------- D. Academic queries ---------- */

export function overallAverage(results) {
  if (results.length === 0) return 0;
  return round2(results.reduce((sum, s) => sum + s.marks, 0) / results.length);
}

export function academicQueries(results) {
  const average = overallAverage(results);
  return {
    firstAbove85: results.find((s) => s.marks > 85) ?? null,
    firstFailedIndex: results.findIndex((s) => s.marks < PASS_MARK),      // -1 when nobody failed
    anyFailed: results.some((s) => s.marks < PASS_MARK),
    allMarksValid: results.every((s) => isValidMarks(s.marks)),
    overallAverage: average,
    aboveAverage: results.filter((s) => s.marks > average),
    topThree: rankStudents(results).slice(0, 3).map((s) => s.name)
  };
}

/** Prints a simple table with forEach (the only printing helper). */
export function printTable(rows, columns) {
  console.log(columns.map((c) => c.padEnd(12)).join(""));
  rows.forEach((row) => console.log(columns.map((c) => String(row[c] ?? "").padEnd(12)).join("")));
}
