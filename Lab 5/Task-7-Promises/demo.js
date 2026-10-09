/* Task 7 demo: run with  npm run task7
   Each section waits for the previous one by returning its promise from .then(). */
import {
  createDatabase, registrationChain, brokenRegistrationChain, runPostRegistration,
  getCourseFromFastestServer, getCourseWithRace
} from "./registrationService.js";

const db = createDatabase();

function attempt(label, studentId, courseCode) {
  console.log(`\n[${label}] student ${studentId} -> ${courseCode}`);
  return registrationChain(db, studentId, courseCode)
    .then(({ student, confirmation }) => {
      console.log("   registered:", confirmation);
      console.log("   post-registration services:");
      return runPostRegistration(db, student, confirmation);
    })
    .then((report) => console.log(report.map((r) => `      ${JSON.stringify(r)}`).join("\n")))
    .catch((error) => console.log(`   stopped -> ${error.name}${error.code ? " " + error.code : ""}: ${error.message}`))
    .finally(() => console.log(`   (attempt finished; CS401 now has ${db.courses.CS401.registered.length}/${db.courses.CS401.capacity} students)`));
}

console.log("=== Part A + B: registration chain, then independent services ===");
attempt("Success, all services work", 101, "CS401")
  .then(() => attempt("Success, but this student has no phone (SMS fails)", 102, "CS401"))
  .then(() => attempt("Course full (2 of 2 seats taken)", 104, "CS401"))
  .then(() => attempt("Already registered", 101, "CS401"))
  .then(() => { db.auditAvailable = false; return attempt("Success, but the audit service is down", 104, "CS402"); })
  .then(() => attempt("Prerequisite missing", 103, "CS402"))
  .then(() => attempt("Student does not exist", 404, "CS401"))
  .then(() => attempt("Unknown course", 101, "ZZ100"))
  .then(() => attempt("Invalid id", "101", "CS401"))
  .then(() => {
    console.log("\n=== Part A: what a missing return does ===");
    return brokenRegistrationChain(createDatabase(), 101, "CS401")
      .then((result) => console.log("   unexpected success:", result))
      .catch((error) => console.log(`   broken chain -> ${error.name}: ${error.message}`))
      .finally(() => console.log("   Without `return`, .then() hands undefined to the next step instead of the course."));
  })
  .then(() => {
    console.log("\n=== Part C: two course servers with Promise.any ===");
    const cases = [
      ["Both servers fine (mirror is faster)", { ms: 120, fail: false }, { ms: 40, fail: false }],
      ["Fast server fails, slower one succeeds", { ms: 30, fail: true }, { ms: 90, fail: false }],
      ["Both servers fail", { ms: 30, fail: true }, { ms: 60, fail: true }]
    ];
    return cases.reduce((previous, [label, primary, mirror]) => previous.then(() =>
      getCourseFromFastestServer("CS401", primary, mirror)
        .then((course) => console.log(`   ${label}: any() -> ${course.server}`))
        .catch((error) => console.log(`   ${label}: any() -> ${error.name}: ${error.errors.map((e) => e.message).join(" | ")}`))
        .then(() => getCourseWithRace("CS401", primary, mirror))
        .then((course) => console.log(`      race() would give -> ${course.server}`))
        .catch((error) => console.log(`      race() would give -> rejected: ${error.message}`))
    ), Promise.resolve());
  })
  .then(() => console.log("\nWhy any(): it waits for the first SUCCESS. race() settles on the first answer of any kind, so in case 2 it fails even though the other server works."));
