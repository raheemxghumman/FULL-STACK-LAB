/* ==========================================================================
   transcriptService.js - parse, validate and report on transcript JSON
   --------------------------------------------------------------------------
   Error types:
     SyntaxError (wrapped in Error with cause)  malformed JSON
     TypeError   wrong shape: not an array, missing id / name / course code, marks not a number
     RangeError  course marks below 0 or above 100
     Error       duplicate student ids (a data conflict rather than a type problem)
   Every error message says which record is at fault.
   ========================================================================== */

import Student from "./Student.js";                                   // default import
import { roundTo, calculateAverage as averageOf } from "./gradeUtils.js";   // named imports, one aliased

/** JSON.parse with a clear error message. Throws Error (cause = the SyntaxError). */
export function parseTranscriptJSON(rawData) {
  if (typeof rawData !== "string") throw new TypeError("Transcript data must be a JSON string");
  try {
    return JSON.parse(rawData);
  } catch (error) {
    throw new Error(`Malformed transcript JSON: ${error.message}`, { cause: error });
  }
}

const isBlank = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/** Validates the parsed data and returns Student objects. Throws on the first problem found. */
export function validateTranscript(data) {
  if (!Array.isArray(data)) throw new TypeError("Transcript must be an array of students");

  const seenIds = new Set();
  return data.map((record, index) => {
    const where = `student #${index + 1}`;
    if (record === null || typeof record !== "object") throw new TypeError(`${where} is not an object`);

    const { id, name, courses } = record;
    if (isBlank(id)) throw new TypeError(`${where} is missing a student id`);
    if (!Number.isInteger(id) || id <= 0) throw new TypeError(`${where} has an invalid id ${JSON.stringify(id)} (expected a positive whole number)`);
    if (seenIds.has(id)) throw new Error(`Duplicate student id ${id} (${where})`);
    seenIds.add(id);

    if (isBlank(name)) throw new TypeError(`Student ${id} is missing a name`);
    if (!Array.isArray(courses)) throw new TypeError(`Student ${id} must have a courses array`);

    courses.forEach((course, courseIndex) => {
      const at = `Student ${id}, course #${courseIndex + 1}`;
      if (course === null || typeof course !== "object") throw new TypeError(`${at} is not an object`);
      if (isBlank(course.code)) throw new TypeError(`${at} is missing a course code`);
      if (typeof course.marks !== "number" || Number.isNaN(course.marks)) {
        throw new TypeError(`${at} (${course.code}) marks must be a number`);
      }
      if (course.marks < 0 || course.marks > 100) {
        throw new RangeError(`${at} (${course.code}) marks ${course.marks} must be between 0 and 100`);
      }
    });

    return new Student(id, name.trim(), courses);
  });
}

/** Builds a plain JavaScript report object from Student objects. */
export function buildReport(students) {
  const entries = students.map((student) => student.toReportEntry());
  const allMarks = students.flatMap((student) => student.marks);
  const top = entries.reduce((best, entry) => (best === null || entry.gpa > best.gpa ? entry : best), null);

  return {
    title: "CampusFlow Transcript Report",
    generatedAt: new Date().toISOString(),
    studentCount: entries.length,
    courseResultCount: allMarks.length,
    overallAverage: averageOf(allMarks),
    averageGPA: entries.length ? roundTo(entries.reduce((sum, e) => sum + e.gpa, 0) / entries.length) : 0,
    topStudent: top ? { id: top.id, name: top.name, gpa: top.gpa } : null,
    students: entries
  };
}

/** Full pipeline: JSON text -> validated students -> report object. */
export function processTranscript(rawData) {
  return buildReport(validateTranscript(parseTranscriptJSON(rawData)));
}

/** Report object -> JSON text. */
export function reportToJSON(report, indent = 2) {
  return JSON.stringify(report, null, indent);
}
