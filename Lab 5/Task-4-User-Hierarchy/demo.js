/* Task 4 demo: run with  npm run task4 */
import { Person, Student, FacultyMember, describeType } from "./users.js";

console.log("=== Creating users with new ===");
const ali = new Student("Ali Khan", "ali@university.edu", "241001", 82);
const sara = new Student("Sara Malik", "sara@university.edu", "241002", 45);
const drWarda = new FacultyMember("Ms Warda Aslam", "warda@university.edu", "EMP-117", "Computer Science");
const drWaqas = new FacultyMember("Dr Waqas Abbasi", "waqas@university.edu", "EMP-042", "Mathematics");
const visitor = new Person("Hamza Tariq", "hamza@example.com");

console.log("new linked ali to Student.prototype:", Object.getPrototypeOf(ali) === Student.prototype);
console.log("Student.prototype inherits from Person.prototype (extends):", Object.getPrototypeOf(Student.prototype) === Person.prototype);

console.log("\n=== Runtime polymorphism: one array, the right introduce() for each object ===");
const users = [ali, drWarda, sara, drWaqas, visitor];
users.forEach((user) => console.log(user.introduce()));

console.log("\n=== instanceof ===");
users.forEach((user) => console.log(`${user.name.padEnd(16)} -> ${describeType(user)} | instanceof Person: ${user instanceof Person}`));

console.log("\n=== Student results ===");
console.log(ali.getResult(), sara.getResult());

console.log("\n=== call(): borrow Person.introduce with a guest as this ===");
const guest = { name: "Dr. Ahmed", email: "ahmed@example.com" };
console.log(Person.prototype.introduce.call(guest));
console.log("guest is still a plain object, not a Person:", guest instanceof Person);

console.log("\n=== Detached method ===");
const fn = ali.introduce;
try {
  console.log(fn());
} catch (error) {
  console.log(`fn() threw ${error.name}: ${error.message}`);
  console.log("Why: `this` depends on how a function is called. ali.introduce() is called ON ali, so this = ali.");
  console.log("fn() is a plain call with nothing before the dot. Class code (and ES modules) always run in");
  console.log("strict mode, so this is undefined instead of the global object, and reading this.name fails.");
}

console.log("\n=== bind(): a safely bound version ===");
const boundIntroduce = ali.introduce.bind(ali);
console.log(boundIntroduce());
const detachedAgain = boundIntroduce;           // passing it around keeps working
console.log("Still works after being passed around:", detachedAgain() === ali.introduce());
console.log("bind() also fixes methods passed as callbacks (array methods call them without an object):");
const facultyIntro = drWarda.introduce;
try {
  ["x"].map(facultyIntro);
} catch (error) {
  console.log(`   unbound: ${error.name}: ${error.message}`);
}
console.log("   bound:  ", ["x"].map(drWarda.introduce.bind(drWarda))[0]);
setTimeout(() => {
  console.log("\n=== Invalid data is rejected by the constructors ===");
  const attempts = [
    ["Person without a name", () => new Person("", "x@y.com")],
    ["Student with marks 150", () => new Student("Bad", "bad@uni.edu", "241009", 150)],
    ["Faculty with a broken email", () => new FacultyMember("Dr X", "not-an-email", "EMP-1", "CS")],
    ["Calling a class without new", () => Student("Ali", "a@b.com", "1", 50)]
  ];
  attempts.forEach(([label, create]) => {
    try {
      create();
    } catch (error) {
      console.log(`${label} -> ${error.name}: ${error.message}`);
    }
  });
}, 10);
