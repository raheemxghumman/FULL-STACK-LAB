# FixFlow: architecture and request lifecycle

**Abdul Raheem · 241854 · BSCS-V-A**: Assignment 2, Full Stack Web Development (CS-301)

## 1. Modules and dependency injection

| Module | Provides | Imports / exports |
|---|---|---|
| **StorageModule** | `FIXFLOW_STORE` → `InMemoryFixflowStore`, `SeedService` | exports `FIXFLOW_STORE` |
| **UsersModule** | `UsersService`, `UsersController` (`/users/me`, `/users/technicians`) | imports Storage; exports `UsersService` |
| **AuthModule** | `AuthService`, `AuthController`, `JwtAuthGuard`, `RolesGuard`, `JwtModule` (secret + expiry from `ConfigService`) | imports Users; exports the guards |
| **CategoriesModule** | `CategoriesService`, `CategoriesController` | imports Storage; exports `CategoriesService` |
| **RequestsModule** | `RequestsService` (all workflow rules), `RequestAccessPolicy` (ownership), `RequestsController` | imports Storage, Categories, Users |
| **ReportsModule** | `ReportsService`, `ReportsController` (`/dashboard`, `/reports/technicians`) | imports Storage |

- **Controllers handle HTTP only.** They map routes, roles, pipes and status codes to service calls.
- **Services hold every business rule.** Nothing is created with `new`: every provider reaches its dependencies through constructor injection.
- **The pipeline components are registered in `AppModule`:** `APP_GUARD` (JWT, then roles), `APP_PIPE` (the `ValidationPipe`), `APP_INTERCEPTOR` (response wrapping), and the middleware for every route. The tests therefore run exactly the same pipeline as `npm start`.

## 2. Custom injection token and storage replacement

`FIXFLOW_STORE` is a `Symbol`, and `FixflowStore` is a typed interface. Its methods return copies of the data, never live references:
- **users:** find, list, create;
- **categories:** find, list, create, update;
- **requests:** `createRequest` together with its creation event, and `applyRequestChange`, which writes the request, the history event and the assignment change together or not at all;
- **history and assignments:** list;
- **feedback:** find, list, create;
- `runExclusive` and `reset`.

Services ask for the token, not a class: `constructor(@Inject(FIXFLOW_STORE) store: FixflowStore)`.

The second implementation is `test/fakes/fake-fixflow.store.ts`. It is array-based and records every call made to it. It is bound with `Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FIXFLOW_STORE).useClass(FakeFixflowStore)`, in `test/e2e/09-storage-replacement.spec.ts` and in `npm run demo:fake-store`. No service file is edited:
- `/api/health` reports `fake-array-store (test double)`;
- the full workflow and its rules still work;
- `RequestsService` holds the fake instance.

## 3. Request lifecycle (instrumented route `PATCH /api/requests/:id`)

With `LIFECYCLE_TRACE=true`, each component logs its stage together with the request id. Request-scoped data lives in `AsyncLocalStorage`, never in fields of singleton services. The **binding scope** of each component:

| # | Component | Scope |
|---|---|---|
| 1 | `RequestIdMiddleware` | every route |
| 2 | `JwtAuthGuard`, then `RolesGuard` | global |
| 3 | `ResponseEnvelopeInterceptor` | global |
| 4 | `AppValidationPipe` (global) and `ParsePositiveIntPipe` + `NonEmptyBodyPipe` | global; parameter |
| 5 | `RequestsController.update`, then `RequestsService.update` | route |
| 6 | interceptor, on the way out | global |
| 7 | middleware `finish` event | every route |

| Case | Observed stages (`docs/evidence/04-lifecycle-trace.png`) | Skipped |
|---|---|---|
| **Success, 200** | 1 → 2 → 2 → 3 → 4 → 4 → 5 → 5 → 6 (wrapped) → 7 | nothing |
| **No token, 401** | 1 → 2 (JWT guard throws) → 7 | RolesGuard, interceptor, pipes, controller, service |
| **Invalid body, 400** | 1 → 2 → 2 → 3 → 4 (`ValidationPipe` throws) → 6 (sees the error, re-throws it unwrapped) → 7 | controller, service |

What the traces show:
- **Guards run before the interceptor and the pipes.** That is why ownership is never decided in a guard: guards cannot see the transformed DTO or the stored record. `RequestAccessPolicy` checks ownership inside the service, after loading the record.
- **The two argument pipes can log in either order.** Nest resolves the handler's arguments with `Promise.all`; within one argument, the global pipe still runs before the parameter-scoped pipe.
- **A 401 never reaches the interceptor.** The final log line therefore comes from the middleware's `finish` event, which also covers guard failures, unknown routes (404) and pipe errors.
- **The interceptor only maps successful responses.** `catchError` re-throws the original exception, so Nest's standard error body and status code are kept.

## 4. Concurrency and consistency strategy

1. **Serialise check-and-update.** Every write action in a service (create, edit, cancel, assign, start, resolve, close, reopen, feedback, category update) runs inside `store.runExclusive()`. It is a promise-chain mutex, so the read → check rules → write sequence can never interleave with another action. This holds even across `await`, which matters because the store contract is async (as a database would be).
2. **Atomic writes.** `applyRequestChange()` is synchronous inside the store. It updates the request, appends the history event, and creates or clears the assignment in one step. A rule that fails throws **before** this call, so a failed action changes nothing (tested in S5, S6, S7 and S11).
3. **Optimistic version check.** Each request has a `version`. A write with a stale `expectedVersion` is refused with **409** instead of overwriting a newer status.
4. **Unique keys checked inside the write.** Duplicate emails, duplicate category names and duplicate feedback are rejected inside the store's own write. Two simultaneous registrations therefore cannot both succeed, even though bcrypt hashing happens outside the lock.

**Proof.** Five simultaneous creates for a requester with three active requests produce exactly **2 × 201** and **3 × 409**. Four simultaneous assignments to a technician with one job produce exactly **2 × 200**, and the refused requests keep only their creation event. Two simultaneous starts of the same job produce **200 + 409**. See `npm test`, the Postman folder S11 and `npm run demo:concurrency`.

**Limitation.** This works because there is a single Node process. With several instances or a real database, the same contract would be implemented with database transactions and row locks, or conditional updates (`WHERE version = ?`).
