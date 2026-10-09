/* Task 6 demo: run with  npm run task6
   Scenarios run one after another; the next one starts inside the previous
   one's callback, because with plain callbacks that is the only way to
   sequence asynchronous work. */
import { createRegistry, registerStudentForCourse } from "./registration.js";

const registry = createRegistry();

const scenarios = [
  { label: "Success", studentId: 101, course: "CS401" },
  { label: "Student does not exist", studentId: 999, course: "CS401" },
  { label: "Prerequisite not completed", studentId: 102, course: "CS401" },
  { label: "Course is full", studentId: 101, course: "CS402" },
  { label: "Already registered", studentId: 101, course: "CS401" },
  { label: "Boundary: takes the last seat (3 of 3)", studentId: 104, course: "CS401" },
  { label: "Boundary: one student past capacity", studentId: 105, course: "CS401" },
  { label: "Course with no prerequisites", studentId: 102, course: "MT201" },
  { label: "Invalid id type", studentId: "101", course: "CS401" },
  { label: "Unknown course", studentId: 101, course: "XX999" }
];

function runScenario(index) {
  if (index >= scenarios.length) {
    console.log("\nFinal CS401 register:", registry.courses.CS401.registered);
    return;
  }
  const { label, studentId, course } = scenarios[index];
  const started = Date.now();
  let calls = 0;

  registerStudentForCourse(registry, studentId, course, (error, confirmation) => {
    calls++;
    const took = Date.now() - started;
    if (error) {
      console.log(`[${label}] FAILED after ${took} ms -> ${error.name}${error.code ? " " + error.code : ""}: ${error.message}`);
    } else {
      console.log(`[${label}] OK after ${took} ms ->`, confirmation);
    }
    if (calls !== 1) console.log("   callback was called more than once!");
    runScenario(index + 1);
  });
}

console.log("=== Task 6: callback-based registration (each stage ~50 ms) ===");
console.log("A failure at stage 1 returns after ~50 ms; success needs all 4 stages (~200 ms).\n");
runScenario(0);
