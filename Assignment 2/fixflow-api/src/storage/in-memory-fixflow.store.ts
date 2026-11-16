import { Injectable } from '@nestjs/common';
import {
  AssignmentRecord, CategoryPatch, CategoryRecord, FeedbackRecord, FixflowStore, HistoryEventRecord,
  NewCategory, NewFeedback, NewHistoryEvent, NewServiceRequest, NewUser, RequestChange,
  ServiceRequestRecord, StoreConflictError, StoreSnapshot, UserRecord,
} from './fixflow-store.interface';
import { Mutex } from './mutex';
import { RequestStatus } from '../common/enums';

type Entity = 'users' | 'categories' | 'requests' | 'history' | 'assignments' | 'feedback';

/**
 * The in-memory FixflowStore bound to FIXFLOW_STORE by StorageModule.
 *
 *  - Data lives in Maps keyed by id; every entity type has its own counter, so ids are stable and
 *    unique within the type and are never reused (not even after a reset of a single record).
 *  - Reads return deep copies (structuredClone): callers cannot change stored data by accident.
 *  - Every write method is synchronous inside, so a single write is indivisible. Multi-step
 *    "check then write" work in services is serialised with runExclusive(), and
 *    applyRequestChange() additionally refuses a stale version (optimistic check).
 *  - Nothing is written to disk: restarting the process reloads the seed snapshot.
 */
@Injectable()
export class InMemoryFixflowStore implements FixflowStore {
  readonly driver = 'in-memory';

  private readonly mutex = new Mutex();
  private users = new Map<number, UserRecord>();
  private categories = new Map<number, CategoryRecord>();
  private requests = new Map<number, ServiceRequestRecord>();
  private history = new Map<number, HistoryEventRecord>();
  private assignments = new Map<number, AssignmentRecord>();
  private feedback = new Map<number, FeedbackRecord>();
  private counters: Record<Entity, number> = { users: 0, categories: 0, requests: 0, history: 0, assignments: 0, feedback: 0 };

  private next(entity: Entity): number {
    this.counters[entity] += 1;
    return this.counters[entity];
  }

  private now(): string {
    return new Date().toISOString();
  }

  private copy<T>(value: T): T {
    return structuredClone(value);
  }

  runExclusive<T>(work: () => Promise<T>): Promise<T> {
    return this.mutex.run(work);
  }

  async reset(snapshot: StoreSnapshot): Promise<void> {
    const load = <T extends { id: number }>(rows: T[]) => new Map(rows.map((r) => [r.id, this.copy(r)] as [number, T]));
    this.users = load(snapshot.users);
    this.categories = load(snapshot.categories);
    this.requests = load(snapshot.requests);
    this.history = load(snapshot.history);
    this.assignments = load(snapshot.assignments);
    this.feedback = load(snapshot.feedback);
    const max = (rows: { id: number }[]) => rows.reduce((m, r) => Math.max(m, r.id), 0);
    this.counters = {
      users: max(snapshot.users), categories: max(snapshot.categories), requests: max(snapshot.requests),
      history: max(snapshot.history), assignments: max(snapshot.assignments), feedback: max(snapshot.feedback),
    };
  }

  /* ---------------------------------------------------------------- users */

  async findUserById(id: number) {
    const user = this.users.get(id);
    return user ? this.copy(user) : null;
  }

  async findUserByEmail(email: string) {
    const key = email.trim().toLowerCase();
    const user = [...this.users.values()].find((u) => u.email === key);
    return user ? this.copy(user) : null;
  }

  async listUsers() {
    return [...this.users.values()].map((u) => this.copy(u));
  }

  async createUser(input: NewUser) {
    if ([...this.users.values()].some((u) => u.email === input.email)) {
      throw new StoreConflictError(`Email ${input.email} is already registered.`);
    }
    const user: UserRecord = { id: this.next('users'), ...this.copy(input), createdAt: this.now() };
    this.users.set(user.id, user);
    return this.copy(user);
  }

  /* ----------------------------------------------------------- categories */

  async findCategoryById(id: number) {
    const category = this.categories.get(id);
    return category ? this.copy(category) : null;
  }

  async findCategoryByName(name: string) {
    const key = name.trim().toLowerCase();
    const category = [...this.categories.values()].find((c) => c.name.toLowerCase() === key);
    return category ? this.copy(category) : null;
  }

  async listCategories() {
    return [...this.categories.values()].sort((a, b) => a.id - b.id).map((c) => this.copy(c));
  }

  private assertUniqueCategoryName(name: string, selfId?: number) {
    const clash = [...this.categories.values()].find((c) => c.id !== selfId && c.name.toLowerCase() === name.toLowerCase());
    if (clash) throw new StoreConflictError(`A category named "${clash.name}" already exists.`);
  }

  async createCategory(input: NewCategory) {
    this.assertUniqueCategoryName(input.name);
    const at = this.now();
    const category: CategoryRecord = { id: this.next('categories'), ...input, createdAt: at, updatedAt: at };
    this.categories.set(category.id, category);
    return this.copy(category);
  }

  async updateCategory(id: number, patch: CategoryPatch) {
    const current = this.categories.get(id);
    if (!current) throw new StoreConflictError(`Category ${id} does not exist.`);
    if (patch.name !== undefined) this.assertUniqueCategoryName(patch.name, id);
    const updated: CategoryRecord = { ...current, ...patch, updatedAt: this.now() };
    this.categories.set(id, updated);
    return this.copy(updated);
  }

  /* ------------------------------------------------------------- requests */

  async findRequestById(id: number) {
    const request = this.requests.get(id);
    return request ? this.copy(request) : null;
  }

  async listRequests() {
    return [...this.requests.values()].map((r) => this.copy(r));
  }

  async createRequest(input: NewServiceRequest, creationEvent: NewHistoryEvent) {
    const at = this.now();
    const request: ServiceRequestRecord = {
      id: this.next('requests'),
      ...this.copy(input),
      status: RequestStatus.OPEN,
      assignedTechnicianId: null,
      resolvedByTechnicianId: null,
      resolutionNote: null,
      version: 1,
      createdAt: at,
      updatedAt: at,
    };
    const event: HistoryEventRecord = { ...creationEvent, id: this.next('history'), requestId: request.id, at };
    this.requests.set(request.id, request);
    this.history.set(event.id, event);
    return this.copy(request);
  }

  async applyRequestChange(change: RequestChange) {
    const current = this.requests.get(change.requestId);
    if (!current) throw new StoreConflictError(`Request ${change.requestId} does not exist.`);
    if (current.version !== change.expectedVersion) {
      // somebody changed the request after it was read: refuse instead of overwriting their change
      throw new StoreConflictError(`Request ${change.requestId} was changed by another action. Reload it and try again.`);
    }

    // everything below is synchronous: either all of it happens or (if this point is not reached) none
    const at = this.now();
    const updated: ServiceRequestRecord = { ...current, ...this.copy(change.patch), version: current.version + 1, updatedAt: at };
    this.requests.set(updated.id, updated);

    if (change.clearActiveAssignment) {
      for (const a of this.assignments.values()) {
        if (a.requestId === updated.id && a.clearedAt === null) {
          this.assignments.set(a.id, { ...a, clearedAt: at, clearedReason: change.clearActiveAssignment.reason });
        }
      }
    }
    if (change.createAssignment) {
      const assignment: AssignmentRecord = {
        id: this.next('assignments'), requestId: updated.id, ...change.createAssignment, assignedAt: at, clearedAt: null, clearedReason: null,
      };
      this.assignments.set(assignment.id, assignment);
    }
    if (change.historyEvent) {
      const event: HistoryEventRecord = { ...change.historyEvent, id: this.next('history'), requestId: updated.id, at };
      this.history.set(event.id, event);
    }
    return this.copy(updated);
  }

  /* ------------------------------------------------ history & assignments */

  async listHistory(requestId: number) {
    return [...this.history.values()]
      .filter((h) => h.requestId === requestId)
      .sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
      .map((h) => this.copy(h));
  }

  async listAssignments(requestId: number) {
    return [...this.assignments.values()]
      .filter((a) => a.requestId === requestId)
      .sort((a, b) => a.id - b.id)
      .map((a) => this.copy(a));
  }

  /* ------------------------------------------------------------- feedback */

  async findFeedbackByRequestId(requestId: number) {
    const found = [...this.feedback.values()].find((f) => f.requestId === requestId);
    return found ? this.copy(found) : null;
  }

  async listFeedback() {
    return [...this.feedback.values()].map((f) => this.copy(f));
  }

  async createFeedback(input: NewFeedback) {
    if ([...this.feedback.values()].some((f) => f.requestId === input.requestId)) {
      throw new StoreConflictError(`Request ${input.requestId} already has feedback.`);
    }
    const record: FeedbackRecord = { id: this.next('feedback'), ...this.copy(input), createdAt: this.now() };
    this.feedback.set(record.id, record);
    return this.copy(record);
  }
}
