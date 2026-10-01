/* ==========================================================================
   Lab 4 · Task #1 — Biography
   1. Write a biography about yourself and print it on the console.
   2. Use 'var' to store the biography in variables, using appropriate
      primitive types.
   3. Create a JS object for the biography (key-value pairs, at least 4-5 keys,
      nested objects for address, degree program, etc.) and print the
      biography from it (not the entire object as it is).
   ========================================================================== */

/* ---------- Part 1 & 2: biography stored in 'var' variables ---------- */

// string
var firstName = "Abdul";
var lastName = "Raheem";
var birthCity = "Multan";
var currentCity = "Islamabad";
var country = "Pakistan";
var university = "Air University, Islamabad";
var degree = "BS Computer Science";
var email = "raheemxghumman@gmail.com";

// number
var currentSemester = 5;
var enrollmentYear = 2024;
var coursesThisSemester = 7;

// boolean
var isStudent = true;
var isOpenToFreelance = true;

// null: a value that is intentionally empty
var middleName = null;

// undefined: declared but not assigned yet
var finalCGPA;   // not available until the degree is completed

console.log("===== My Biography (using var + primitive types) =====");
console.log(
  "My name is " + firstName + " " + lastName + ". I was born in " + birthCity + ", " + country +
  ", and I currently live in " + currentCity + "."
);
console.log(
  "I am studying " + degree + " at " + university + ". I started in " + enrollmentYear +
  " and I am now in semester " + currentSemester + ", taking " + coursesThisSemester + " courses."
);
console.log(
  "My interests are web development, SEO and video editing. Open to freelance work: " +
  (isOpenToFreelance ? "yes" : "no") + "."
);
console.log("You can reach me at " + email + ".");

console.log("----- Primitive types used -----");
console.log("firstName       -> " + typeof firstName);
console.log("currentSemester -> " + typeof currentSemester);
console.log("isStudent       -> " + typeof isStudent);
console.log("middleName      -> " + (middleName === null ? "null" : typeof middleName));
console.log("finalCGPA       -> " + typeof finalCGPA);


/* ---------- Part 3: the same biography as a JS object ---------- */

var biography = {
  name: "Abdul Raheem",
  nickname: "Raheem",
  isStudent: true,
  address: {
    city: "Islamabad",
    province: "Islamabad Capital Territory",
    country: "Pakistan",
    hometown: "Multan, Punjab"
  },
  degreeProgram: {
    title: "BS Computer Science",
    university: "Air University",
    campus: "Islamabad",
    department: "Department of Computer Science",
    section: "BSCS-V-A",
    shift: "Shift-I",
    semester: 5,
    enrollmentYear: 2024,
    currentCourses: [
      "Artificial Intelligence",
      "Operating Systems",
      "Design and Analysis of Algorithms",
      "Linear Algebra",
      "Introduction to Management",
      "Full Stack Web Development"
    ]
  },
  skills: ["Web Development", "SEO", "Video Editing", "C++", "JavaScript"],
  contact: {
    email: "raheemxghumman@gmail.com",
    github: "github.com/raheemxghumman",
    linkedin: "linkedin.com/in/abdulxraheem"
  }
};

// Print the biography from the object, field by field (not the whole object).
console.log("===== My Biography (from a JS object) =====");
console.log("Name: " + biography.name + " (" + biography.nickname + ")");
console.log("Hometown: " + biography.address.hometown);
console.log(
  "Lives in: " + biography.address.city + ", " + biography.address.province + ", " + biography.address.country
);
console.log(
  "Degree: " + biography.degreeProgram.title + " at " + biography.degreeProgram.university +
  " (" + biography.degreeProgram.campus + ")"
);
console.log("Department: " + biography.degreeProgram.department);
console.log(
  "Class: " + biography.degreeProgram.section + " " + biography.degreeProgram.shift +
  ", semester " + biography.degreeProgram.semester + " (enrolled " + biography.degreeProgram.enrollmentYear + ")"
);

console.log("Courses this semester:");
for (var i = 0; i < biography.degreeProgram.currentCourses.length; i++) {
  console.log("  " + (i + 1) + ". " + biography.degreeProgram.currentCourses[i]);
}

console.log("Skills: " + biography.skills.join(", "));
console.log("Email: " + biography.contact.email);
console.log("GitHub: " + biography.contact.github);
console.log("LinkedIn: " + biography.contact.linkedin);
