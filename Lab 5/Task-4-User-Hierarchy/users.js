/* ==========================================================================
   Task 4 - University User Hierarchy and Dynamic this
   --------------------------------------------------------------------------
        Person
          |---- Student
          |---- FacultyMember

   constructor  runs when `new` creates an object and sets up its fields
   new          creates an empty object, links it to Class.prototype, runs
                the constructor with `this` = that object, and returns it
   extends      makes Student.prototype inherit from Person.prototype
   super(...)   calls the parent constructor (must run before using `this`)
   super.method() calls the parent's version of an overridden method
   overriding   Student and FacultyMember define their own introduce()
   polymorphism user.introduce() runs the version of the ACTUAL object,
                decided at run time, even inside an array of mixed users
   this         decided by HOW a function is called, not where it is written
   ========================================================================== */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Person {
  constructor(name, email) {
    if (typeof name !== "string" || name.trim() === "") throw new TypeError("name must be a non-empty string");
    if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) throw new TypeError(`"${email}" is not a valid email`);
    this.name = name.trim();
    this.email = email.trim().toLowerCase();
  }

  introduce() {
    return `Hello, I am ${this.name} (${this.email}).`;
  }

  get role() {
    return "Person";
  }
}

export class Student extends Person {
  constructor(name, email, rollNo, marks) {
    super(name, email);                       // parent sets name and email
    if (typeof rollNo !== "string" || rollNo.trim() === "") throw new TypeError("rollNo must be a non-empty string");
    if (typeof marks !== "number" || !Number.isFinite(marks) || marks < 0 || marks > 100) {
      throw new RangeError(`marks must be between 0 and 100 (got ${marks})`);
    }
    this.rollNo = rollNo;
    this.marks = marks;
  }

  // Overrides Person.introduce() but reuses it through super
  introduce() {
    return `${super.introduce()} I am a student, roll no ${this.rollNo}.`;
  }

  getResult() {
    const status = this.marks >= 50 ? "PASS" : "FAIL";
    return { rollNo: this.rollNo, name: this.name, marks: this.marks, status };
  }

  get role() {
    return "Student";
  }
}

export class FacultyMember extends Person {
  constructor(name, email, employeeId, department) {
    super(name, email);
    if (typeof employeeId !== "string" || employeeId.trim() === "") throw new TypeError("employeeId must be a non-empty string");
    if (typeof department !== "string" || department.trim() === "") throw new TypeError("department must be a non-empty string");
    this.employeeId = employeeId;
    this.department = department;
  }

  introduce() {
    return `${super.introduce()} I teach in the ${this.department} department (employee ${this.employeeId}).`;
  }

  get role() {
    return "Faculty";
  }
}

/** Runtime check of what kind of user an object is, using instanceof. */
export function describeType(user) {
  if (user instanceof Student) return "Student (also a Person)";
  if (user instanceof FacultyMember) return "FacultyMember (also a Person)";
  if (user instanceof Person) return "Person";
  return "not a university user";
}
