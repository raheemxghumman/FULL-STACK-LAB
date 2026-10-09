# Lab 5 — Hands-on Practice on Advanced JavaScript (CampusFlow)

**Student:** Abdul Raheem · BSCS-V-A (Shift-I) · Air University, Islamabad · CLO-1 GA-4

Core business logic for **CampusFlow**, written in plain Node.js with ES modules. It uses no DOM, HTML,
React, Express, databases or external packages. The tests use Node's built-in `node:test`.

## Running

Requires Node.js 18 or newer. There is nothing to install.

```
npm test            # 42 automated tests (normal, boundary and invalid cases)
npm run task1       # ... up to task8: each prints a demo of that task
npm run all         # every demo in order
```

## How the general requirements are met

| Requirement | How |
|---|---|
| No DOM / HTML / React / Express / databases / packages | Only relative imports and `node:` built-ins (`node:test`, `node:assert`). `package.json` has no dependencies. |
| No closures as a solution technique | No function returns an inner function to keep state. State lives in parameters, objects and class instances. |
| `const` / `let`, no `var` | No `var` anywhere. |
| No mutation of source data | Inputs are copied (`slice()`, spread, `map`). Tests compare inputs before and after, and Task 3 freezes its input. Only the registration steps in Tasks 6 and 7 change data, because registering is the point of that operation. |
| No hard-coded answers | Every merit, grade, average and statistic is computed. |
| Functions return results | Logic modules return values. Only the `demo.js` files print. |
| Strict equality | `===` and `!==` throughout. |
| Invalid / unexpected data | Guard clauses and specific errors (`TypeError`, `RangeError`, custom error classes) in every task. |
| ES modules | `"type": "module"`, with `import`/`export` everywhere. Task 5 uses the four required files. |
| Normal, boundary, invalid cases | Every demo includes all three, and `npm test` checks them. |

## Tasks

### Task 1 — Admission decision and data sanitisation (`Task-1-Admission/`)

- **Explicit conversion.** Values go through `Number()` with checks for missing input (`""`, whitespace, `null`), `NaN` and non-integer ages. `"true"`/`"false"` are compared as text because `Boolean("false")` is `true`.
- **Validation.** Marks must be 0–100, age 17–30, and the program one of BSCS, BSAI, BSSE or BSDS. Every problem is collected, and merit is only calculated for valid data.
- **Merit and eligibility.** Merit = 20% Matric + 30% Intermediate + 50% Entry test. An applicant is eligible when merit ≥ 70, entry test ≥ 60 and intermediate ≥ 60.
- **SELECTED vs WAITING (our definition).** An eligible applicant is **SELECTED** when merit reaches the program's closing merit and the fee is paid. The closing merits come from a `switch`: BSCS 80, BSAI 78, BSSE 76, BSDS 75. Otherwise an eligible applicant is **WAITING**, either because merit is below the closing merit or because the fee is unpaid. A valid but ineligible applicant is **REJECTED**.
- **Summary.** It reports valid and invalid counts, the highest-merit applicant, the lowest merit, the average merit, and counts per program and per status.

### Task 2 — Academic performance engine (`Task-2-Performance/`)

- **Grading.** Grade, grade points and PASS/FAIL come from a grading table searched with `find()`. Processed records are new objects made with `map()` and spread.
- **Ranking.** The merit list uses `slice().sort(...)`, with marks descending and ties broken by name. `sort()` changes the array it runs on, so it always works on a copy.
- **Department statistics.** These are built with `reduce()` into an object keyed by department name, so a new department such as "DS" works automatically.
- **Queries.** The queries use `find`, `findIndex`, `some`, `every`, `filter` and `slice(0, 3).map(...)`, and the table printer uses `forEach`.

### Task 3 — Safe profile update (`Task-3-Profile-Update/`)

- **The update.** `updateProfile(student, update)` returns a new object and merges `address` and `contact` instead of replacing them.
- **Real values kept.** `0`, `false` and `""` in an update are applied. `undefined` means "not provided".
- **Concepts used.** Object and nested destructuring, renaming (`address: currentAddress`), default values, array destructuring (`([, value])`), rest parameters (`applyUpdates(student, ...updates)`), object rest, spread, optional chaining, nullish coalescing (`??` keeps `marks: 0`, while `||` would replace it), and property shorthand.
- **Reference challenge.** `compareReferences()` proves that the original vs updated object, address and contact are all **different** objects. The demo then shows that a plain `{ ...student }` would still **share** `address` with the original. That is why the nested objects are copied as well.

### Task 4 — User hierarchy and dynamic `this` (`Task-4-User-Hierarchy/`)

- **The classes.** `Person` → `Student` and `FacultyMember`, using `class`, `constructor`, `extends` and `super(...)`. Each subclass overrides `introduce()` and reuses the parent version through `super.introduce()`.
- **Polymorphism.** `users.forEach(user => console.log(user.introduce()))` runs the right version for each object at run time, and `instanceof` checks the type of each.
- **`call()`.** `Person.prototype.introduce.call(guest)` borrows the method with the guest object as `this`.
- **Detached method.** `const fn = student.introduce; fn()` throws a `TypeError`. `this` is decided by how a function is called. With nothing before the dot, and class code always running in strict mode, `this` is `undefined`, so `this.name` fails.
- **`bind()`.** `student.introduce.bind(student)` creates a version whose `this` is fixed. It keeps working when passed around, for example to `map()`.

### Task 5 — Modular transcript processing (`Task-5-Transcript-Modules/`)

- **Modules.**
  - `Student.js` has the default export, the `Student` class.
  - `gradeUtils.js` has the named exports `calculateGrade`, `calculateAverage`, `calculateGPA` and helpers.
  - `transcriptService.js` parses, validates, builds the report and converts it back to JSON.
  - `main.js` is the caller.
- **Imports.** Default imports and named imports are both used, and named imports are aliased: `calculateGrade as gradeOf` and `calculateAverage as averageOf`.
- **Error types.**
  - Malformed JSON raises an `Error` whose `cause` is the original `SyntaxError`.
  - A wrong shape, a missing id, a missing course code or non-numeric marks raise a `TypeError`.
  - Marks below 0 or above 100 raise a `RangeError`.
  - A duplicate id raises an `Error`.
- **Caller.** `main.js` runs every case with `try` / `catch` / `finally`.

### Task 6 — Legacy registration with callbacks (`Task-6-Callbacks/`)

- **The stages.** Four `setTimeout`-based stages use error-first callbacks: `loadStudent`, `checkPrerequisites`, `checkSeats`, `registerCourse`.
- **Failures.** Each stage reports unknown students, missing prerequisites, full courses and duplicate registrations through the callback.
- **No Promises.** There are no Promises and no `async`/`await` in this task.
- **Exactly one callback.** Every branch ends in `return callback(...)`, and callbacks are never called inside a `try`. A test checks that the callback runs exactly once.
- **Stops at the first failure.** The workflow ends at the first error, as the demo timings show: about 60 ms when stage 1 fails, about 250 ms on success.

**Why dependent callback workflows become hard to maintain.** Each step can only start inside the callback
of the step before it. Every new operation adds another level of nesting, so four steps already form a
"pyramid", and ten would be unreadable. Error handling repeats at every level: each callback must check
`if (error) return done(error)` itself. One forgotten `return` makes the code continue after an error, or
call `done` twice. There is no single place to catch failures, since a `try/catch` around the first call
cannot see errors thrown later inside a timer. Sequencing several independent requests means even more
nesting or manual counters. Promises and `async/await` (Tasks 7 and 8) flatten this into one chain, with
one error path.

### Task 7 — Promise-based registration (`Task-7-Promises/`)

- **Part A, the chain.** `getStudent → getCourse → checkPrerequisites → checkSeats → registerStudent`. Each `.then()` returns the next promise, and one context object `{ student, course, ... }` carries data forward. The caller uses `.catch()` for any failure and `.finally()` for clean-up. `brokenRegistrationChain()` shows the same chain with a missing `return`: the next stage receives `undefined` and the chain fails.
- **Part B, `Promise.allSettled`.** `sendEmail`, `sendSMS` and `writeAuditLog` start together. They are independent, so one failure, such as a student without a phone, must not hide the others. `Promise.all` would reject on the first failure and lose the other results. The output is `[{ service: 'Email', status: 'fulfilled' }, { service: 'SMS', status: 'rejected' }, ...]`.
- **Part C, `Promise.any`.** It resolves with the first **successful** server and only rejects, with an `AggregateError`, when every server fails. `Promise.race` would settle on the first server to finish, even if it failed, so a fast error would win over a slower success. The demo shows both on the same inputs to justify the choice.

### Task 8 — Concurrent API aggregator with async/await (`Task-8-Async-Await/`)

- **`getJSON(url, fetchImplementation)`.** It calls fetch and checks `response.ok`. A failing status raises an `HttpError`, a fetch rejection becomes a `NetworkError`, and a JSON parse failure becomes an `InvalidJSONError`. It works with the real `fetch` or any compatible function.
- **`fakeFetch(url, options)`.** It returns objects shaped like a real response. It simulates a 200 success (`/users`, `/courses`, `/results`), a 404 (`/missing`), a 500 (`/server-error`), a network failure (`/network-down`), invalid JSON (`/bad-json`) and a slow response (`/slow`, 3 s). It also respects an abort signal.
- **`loadDashboard()`.** It starts all three requests at once with `Promise.all`, taking about 200 ms instead of about 600 ms. It reports totals, overall average, the top student, failed students and department statistics.
- **`fetchWithTimeout(url, ms)`.** It uses `AbortController` with `setTimeout`, and `clearTimeout` in `finally`, so the timer is always cleaned up. A timeout raises a `TimeoutError`. `classifyError()` tells HTTP, network, invalid JSON and timeout failures apart.

## Structure

```
Lab 5/
├── package.json                    "type": "module", npm scripts, no dependencies
├── Task-1-Admission/               admission.js · demo.js
├── Task-2-Performance/             performance.js · demo.js
├── Task-3-Profile-Update/          profileService.js · demo.js
├── Task-4-User-Hierarchy/          users.js · demo.js
├── Task-5-Transcript-Modules/      main.js · Student.js · gradeUtils.js · transcriptService.js
├── Task-6-Callbacks/               registration.js · demo.js
├── Task-7-Promises/                registrationService.js · demo.js
├── Task-8-Async-Await/             api.js · demo.js
└── tests/                          task1-4.test.js · task5-8.test.js
```
