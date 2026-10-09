/* Task 1 demo: run with  npm run task1  (or node Task-1-Admission/demo.js) */
import { processApplicants, summarize, toNumber, isMissing } from "./admission.js";

// The example input from the lab manual
const applicants = [
  { id: "A101", name: "Sara Khan", age: "19", matricMarks: "91", intermediateMarks: "87", entryTest: "78", program: "BSCS", feePaid: "true" },
  { id: "A102", name: "Ahmed Ali", age: "twenty", matricMarks: "88", intermediateMarks: "", entryTest: "72", program: "BSSE", feePaid: "false" },
  { id: "A103", name: "Hassan", age: "18", matricMarks: "76", intermediateMarks: "83", entryTest: "91", program: "BSAI", feePaid: "true" }
];

// Extra applicants covering normal, boundary and invalid cases
const moreApplicants = [
  // normal: eligible but merit below the BSCS closing merit (80) -> WAITING
  { id: "A104", name: "Hina Malik", age: "20", matricMarks: "80", intermediateMarks: "72", entryTest: "75", program: "BSCS", feePaid: "true" },
  // normal: eligible and above cut-off, but fee not paid -> WAITING
  { id: "A105", name: "Bilal Ahmed", age: "21", matricMarks: "90", intermediateMarks: "85", entryTest: "82", program: "BSSE", feePaid: "FALSE" },
  // boundary: merit exactly 70, entry 60, intermediate 60 -> eligible -> WAITING (below every cut-off)
  { id: "A106", name: "Ayesha Noor", age: "17", matricMarks: "100", intermediateMarks: "60", entryTest: "64", program: "BSDS", feePaid: "true" },
  // boundary: age 30, marks 0 and 100 are allowed; entry test below 60 -> REJECTED
  { id: "A107", name: "Usman Raza", age: "30", matricMarks: "100", intermediateMarks: "100", entryTest: "0", program: "BSAI", feePaid: "true" },
  // normal: merit 69.5 just below 70 -> REJECTED
  { id: "A108", name: "Zoya Khan", age: " 22 ", matricMarks: "70", intermediateMarks: "65", entryTest: "72", program: "bscs", feePaid: "true" },
  // invalid: unsupported program, age 16, marks above 100
  { id: "A109", name: "Ali Raza", age: "16", matricMarks: "101", intermediateMarks: "90", entryTest: "88", program: "BBA", feePaid: "yes" },
  // invalid: "0" is a real value, but "12abc" and a decimal age are not
  { id: "A110", name: "Fatima", age: "19.5", matricMarks: "0", intermediateMarks: "12abc", entryTest: "70", program: "BSCS", feePaid: "true" },
  // invalid: not even an object
  null
];

const all = [...applicants, ...moreApplicants];
const decisions = processApplicants(all);

console.log("=== Task 1: Admission decisions ===\n");
for (const d of decisions) {
  const merit = d.merit === null ? "  -  " : d.merit.toFixed(2);
  console.log(`${String(d.id ?? "?").padEnd(5)} ${String(d.name ?? "(unknown)").padEnd(12)} ${String(d.program ?? "-").padEnd(5)} merit ${merit}  ${d.status}`);
  for (const reason of d.reasons) console.log(`        - ${reason}`);
}

console.log("\n=== Summary ===");
console.log(summarize(decisions));

console.log("\n=== Why explicit conversion matters ===");
console.log('Number("")        ->', Number(""), "(would be read as 0 marks)");
console.log('toNumber("")      ->', toNumber("", "Marks"));
console.log('Boolean("false")  ->', Boolean("false"), "(a non-empty string is truthy)");
console.log('isMissing("0")    ->', isMissing("0"), "(0 is falsy but is a real value)");

console.log("\nOriginal input was not mutated:", applicants[1].intermediateMarks === "" && applicants[0].age === "19");
