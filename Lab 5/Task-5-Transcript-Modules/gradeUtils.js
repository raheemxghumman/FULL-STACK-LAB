/* ==========================================================================
   gradeUtils.js - named exports for grading maths
   Same grading policy as Task 2 (A = 85-100 ... F = below 50).
   ========================================================================== */

export const GRADE_SCALE = Object.freeze([
  { min: 85, grade: "A", points: 4.0 },
  { min: 80, grade: "A-", points: 3.67 },
  { min: 75, grade: "B+", points: 3.33 },
  { min: 70, grade: "B", points: 3.0 },
  { min: 65, grade: "B-", points: 2.67 },
  { min: 60, grade: "C+", points: 2.33 },
  { min: 50, grade: "C", points: 2.0 },
  { min: 0, grade: "F", points: 0.0 }
]);

export const roundTo = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

/** Throws when marks are not a number from 0 to 100. */
export function assertValidMarks(marks) {
  if (typeof marks !== "number" || Number.isNaN(marks)) throw new TypeError(`marks must be a number (got ${JSON.stringify(marks)})`);
  if (marks < 0 || marks > 100) throw new RangeError(`marks must be between 0 and 100 (got ${marks})`);
}

function bandFor(marks) {
  assertValidMarks(marks);
  return GRADE_SCALE.find((band) => marks >= band.min);
}

/** calculateGrade(81) -> "A-" */
export function calculateGrade(marks) {
  return bandFor(marks).grade;
}

/** gradePoints(81) -> 3.67 */
export function gradePoints(marks) {
  return bandFor(marks).points;
}

/** calculateAverage([81, 74]) -> 77.5 ; an empty list gives 0 */
export function calculateAverage(marksList) {
  if (!Array.isArray(marksList)) throw new TypeError("calculateAverage expects an array of marks");
  if (marksList.length === 0) return 0;
  marksList.forEach(assertValidMarks);
  return roundTo(marksList.reduce((sum, m) => sum + m, 0) / marksList.length);
}

/**
 * GPA on a 4.0 scale: the average of each course's grade points
 * (every course is treated as having the same credit hours).
 */
export function calculateGPA(marksList) {
  if (!Array.isArray(marksList)) throw new TypeError("calculateGPA expects an array of marks");
  if (marksList.length === 0) return 0;
  return roundTo(marksList.map(gradePoints).reduce((sum, p) => sum + p, 0) / marksList.length);
}
