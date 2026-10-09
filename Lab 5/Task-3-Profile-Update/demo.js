/* Task 3 demo: run with  npm run task3 */
import { updateProfile, applyUpdates, changedFields, profileSummary, compareReferences, deepFreeze } from "./profileService.js";

const student = deepFreeze({        // frozen: any accidental mutation would throw in strict mode
  id: 101,
  name: "Ali",
  marks: 0,
  scholarship: false,
  address: { city: "Islamabad", sector: "F-10" },
  contact: { email: "ali@university.edu" }
});

const update = {
  name: "Ali Khan",
  address: { city: "Rawalpindi" },
  contact: { phone: "03001234567" }
};

console.log("=== Normal update ===");
const updated = updateProfile(student, update);
console.log(updated);
console.log("Changed fields:", changedFields(student, updated));
console.log("address.sector kept:", updated.address.sector);
console.log("contact.email kept:", updated.contact.email, "| contact.phone added:", updated.contact.phone);
console.log("marks 0 and scholarship false kept:", updated.marks, updated.scholarship);

console.log("\n=== Original is unchanged ===");
console.log(student);

console.log("\n=== Reference challenge ===");
compareReferences(student, updated).forEach(({ pair, same, reason }) => {
  console.log(`${pair}: ${same ? "SAME" : "DIFFERENT"}\n   ${reason}`);
});
const shallowCopy = { ...student };
console.log("\nFor contrast, a shallow spread { ...student } copies only the top level:");
console.log("   shallowCopy === student:", shallowCopy === student);
console.log("   shallowCopy.address === student.address:", shallowCopy.address === student.address,
  "(the nested object is shared, which is why updateProfile spreads address and contact too)");

console.log("\n=== Boundary: 0, false and empty string are real values ===");
const boundary = updateProfile(updated, { marks: 0, scholarship: false, contact: { phone: "" } });
console.log({ marks: boundary.marks, scholarship: boundary.scholarship, phone: boundary.contact.phone });
const ignored = updateProfile(updated, { name: undefined, address: { city: undefined } });
console.log("undefined means 'not provided':", ignored.name, "/", ignored.address.city);
console.log("Empty update returns an equal copy:", JSON.stringify(updateProfile(student, {})) === JSON.stringify(student));

console.log("\n=== Several updates with rest parameters ===");
const final = applyUpdates(student, update, { marks: 88, scholarship: true }, { address: { sector: "G-9" } });
console.log(final);

console.log("\n=== Summary with nested destructuring, ?? and || ===");
console.log(profileSummary(updated));
console.log("Note: marks is 0, so ?? keeps 0 while || replaces it with the fallback.");

console.log("\n=== Invalid input ===");
for (const [label, s, u] of [["student is null", null, update], ["update is a string", student, "name=Ali"], ["address is an array", student, { address: ["Lahore"] }]]) {
  try {
    updateProfile(s, u);
  } catch (error) {
    console.log(`${label} -> ${error.name}: ${error.message}`);
  }
}
