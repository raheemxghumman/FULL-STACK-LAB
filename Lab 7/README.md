# Full Stack Web Development — Lab 7

**Student:** Abdul Raheem · 241854 · BSCS-V-A (Shift-I) · Air University, Islamabad

## The tasks

**Part 1:** Modify the uploaded code (file: *in memory api*) and create a student management system.
Modules: Student (CRUD), Teacher (CRUD), Attendance (CRUD), Marks (CRUD).

**Part 2:** Write end-points of the e-commerce store (already assigned in Lab 3) by using persistent APIs.

| | Part 1 · Student Management System | Part 2 · Kashi Ghar store API |
|---|---|---|
| Folder | [`Part 1/`](Part%201/) | [`Part 2/`](Part%202/) |
| Data | **in memory**: lost when the server stops | **persistent**: saved to `data/db.json` |
| API | 4 modules × 5 operations (GET list, GET one, POST, PUT, PATCH, DELETE) plus a report, stats and reset | 32 endpoints: products, categories, reviews, accounts with login tokens, carts, coupons, orders |
| Front end | a test UI with CRUD screens, an API tester, 37 automated requirement checks and a network log | a copy of the Lab 3 store, now using the API (Lab 3 itself is unchanged) |
| Live | [Test UI](https://raheemxghumman.github.io/FULL-STACK-LAB/Lab%207/Part%201/public/) | [Store](https://raheemxghumman.github.io/FULL-STACK-LAB/Lab%207/Part%202/store/) |
| Run locally | `cd "Part 1"` → `npm start` → http://localhost:3002 | `cd "Part 2"` → `npm start` → http://localhost:3000 |
| Tests | `npm test` (11 tests) | `npm test` (9 tests) and `npm run restart-check` |

Both parts are written with plain Node.js (`node:http`, no packages), starting from the uploaded `node:http` routing file.

The API of each part (`lib/router.js` and the files it imports) does not depend on Node, so the pages can run the same code in the browser when no server is available. That is how the GitHub Pages links work. Only the small storage file differs: Part 2 saves to `data/db.json` on the server, or to `localStorage` in the browser.

| Part 1 | Part 2 |
|---|---|
| ![](Part%201/screenshots/dashboard.png) | ![](Part%202/screenshots/store-cart.png) |
| ![](Part%201/screenshots/checks.png) | ![](Part%202/screenshots/restart-check.png) |
