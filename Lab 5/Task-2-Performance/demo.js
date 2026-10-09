/* Task 2 demo: run with  npm run task2 */
import {
  processResults, rankStudents, departmentStatistics, academicQueries, partitionRecords, printTable, gradeFor
} from "./performance.js";

const results = [
  { id: 1, name: "Ali", department: "CS", course: "FSWD", marks: 82 },
  { id: 2, name: "Sara", department: "CS", course: "FSWD", marks: 91 },
  { id: 3, name: "Usman", department: "SE", course: "FSWD", marks: 47 },
  { id: 4, name: "Hina", department: "AI", course: "FSWD", marks: 73 },
  { id: 5, name: "Ahmed", department: "SE", course: "FSWD", marks: 64 },
  { id: 6, name: "Zoya", department: "AI", course: "FSWD", marks: 91 }
];
const snapshot = JSON.stringify(results);

console.log("=== A. Result processing ===");
const processed = processResults(results);
printTable(processed, ["name", "department", "marks", "grade", "gradePoints", "status"]);

console.log("\n=== B. Ranked merit list (marks desc, then name) ===");
printTable(rankStudents(processed), ["rank", "name", "marks", "grade"]);
console.log("Original order still:", results.map((s) => s.name).join(", "));

console.log("\n=== C. Department statistics ===");
console.log(departmentStatistics(processed));

console.log("\n=== D. Academic queries ===");
const q = academicQueries(processed);
console.log("First student scoring more than 85:", q.firstAbove85?.name);
console.log("Index of the first failed student:", q.firstFailedIndex);
console.log("At least one student failed:", q.anyFailed);
console.log("Every student has valid marks:", q.allMarksValid);
console.log("Overall average:", q.overallAverage);
console.log("Above the overall average:", q.aboveAverage.map((s) => `${s.name} (${s.marks})`).join(", "));
console.log("Top three:", q.topThree.join(", "));

console.log("\n=== New department appears later (DS) ===");
const withNewDepartment = [...results, { id: 7, name: "Bilal", department: "DS", course: "FSWD", marks: 88 }];
console.log(departmentStatistics(processResults(withNewDepartment)));

console.log("\n=== Boundary marks ===");
[100, 85, 84, 50, 49, 0].forEach((m) => console.log(`${String(m).padStart(3)} -> ${gradeFor(m).grade}`));

console.log("\n=== Invalid data is filtered out, not crashed on ===");
const messy = [...results, { id: 8, name: "Ghost", department: "CS", marks: 120 }, { id: 9, name: "", department: "SE", marks: 70 }, { id: 10, name: "Text", department: "AI", marks: "80" }, null];
const { valid, invalid } = partitionRecords(messy);
console.log(`valid: ${valid.length}, invalid: ${invalid.length}`);
console.log("every() on the raw data says all marks valid:", academicQueries(messy.filter(Boolean)).allMarksValid);

console.log("\nOriginal results array unchanged:", JSON.stringify(results) === snapshot);
