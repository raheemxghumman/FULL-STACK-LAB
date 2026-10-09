/* ==========================================================================
   main.js - Task 5 entry point:  npm run task5
   Shows default import, named imports and an aliased named import, and
   handles every outcome with try / catch / finally.
   ========================================================================== */

import Student from "./Student.js";                                                 // default import
import { processTranscript, reportToJSON } from "./transcriptService.js";            // named imports
import { calculateGrade as gradeOf, calculateGPA } from "./gradeUtils.js";           // aliased named import

const rawData = `
[
  {
    "id": 101,
    "name": "Ali",
    "courses": [
      { "code": "CS301", "marks": 81 },
      { "code": "CS302", "marks": 74 }
    ]
  },
  {
    "id": 102,
    "name": "Sara",
    "courses": [
      { "code": "CS301", "marks": 92 },
      { "code": "CS302", "marks": 88 },
      { "code": "MT201", "marks": 79 }
    ]
  },
  {
    "id": 103,
    "name": "Usman",
    "courses": [
      { "code": "CS301", "marks": 100 },
      { "code": "CS302", "marks": 0 }
    ]
  }
]`;

const testCases = [
  { label: "Valid transcript (normal + boundary marks 0 and 100)", data: rawData },
  { label: "Malformed JSON", data: `[{ "id": 101, "name": "Ali", "courses": [ ] ` },
  { label: "Missing student id", data: `[{ "name": "Ali", "courses": [] }]` },
  { label: "Duplicate ids", data: `[{ "id": 7, "name": "A", "courses": [] }, { "id": 7, "name": "B", "courses": [] }]` },
  { label: "Marks above 100", data: `[{ "id": 1, "name": "A", "courses": [{ "code": "CS1", "marks": 105 }] }]` },
  { label: "Marks below 0", data: `[{ "id": 1, "name": "A", "courses": [{ "code": "CS1", "marks": -3 }] }]` },
  { label: "Missing course code", data: `[{ "id": 1, "name": "A", "courses": [{ "marks": 70 }] }]` },
  { label: "Not an array", data: `{ "id": 1 }` }
];

let succeeded = 0;
let failed = 0;

for (const { label, data } of testCases) {
  console.log(`\n=== ${label} ===`);
  try {
    const report = processTranscript(data);
    succeeded++;
    report.students.forEach((s) => console.log(`${s.id} ${s.name.padEnd(6)} average ${s.average}  GPA ${s.gpa}  grade ${s.overallGrade}`));
    console.log(`Top student: ${report.topStudent.name} (GPA ${report.topStudent.gpa}) | overall average ${report.overallAverage}`);
    const json = reportToJSON(report);
    console.log(`Report converted back to JSON (${json.length} characters). First lines:`);
    console.log(json.split("\n").slice(0, 6).join("\n") + "\n  ...");
    console.log("Round trip check:", JSON.parse(json).studentCount === report.studentCount);
  } catch (error) {
    failed++;
    console.log(`Rejected -> ${error.name}: ${error.message}`);
    if (error.cause) console.log(`   caused by ${error.cause.name}`);
  } finally {
    // runs whether the case succeeded or failed
    console.log(`(finished "${label}")`);
  }
}

console.log(`\n${succeeded} transcript accepted, ${failed} rejected.`);

// The Student class can also be used directly
const demo = new Student(200, "Hina", [{ code: "FSWD", marks: 84 }, { code: "OS", marks: 66 }]);
console.log(`\nDirect use: ${demo.name} average ${demo.average()}, GPA ${demo.gpa()} (= calculateGPA ${calculateGPA(demo.marks)}), FSWD grade ${gradeOf(84)}`);
