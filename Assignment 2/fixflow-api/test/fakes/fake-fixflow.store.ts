import {
  AssignmentRecord, CategoryPatch, CategoryRecord, FeedbackRecord, FixflowStore, HistoryEventRecord, NewCategory,
  NewFeedback, NewHistoryEvent, NewServiceRequest, NewUser, RequestChange, ServiceRequestRecord, StoreConflictError,
  StoreSnapshot, UserRecord,
} from '../../src/storage/fixflow-store.interface';
import { RequestStatus } from '../../src/common/enums';

/**
 * A second, deliberately small FixflowStore used to prove the injection token works:
 * the tests bind it with .overrideProvider(FIXFLOW_STORE).useClass(FakeFixflowStore) and the
 * business services run unchanged on top of it. It keeps plain arrays (no Maps, no mutex, no
 * copying) and records every call in `calls`, so a test can see that the services really used it.
 */
export class FakeFixflowStore implements FixflowStore {
  readonly driver = 'fake-array-store (test double)';
  readonly calls: string[] = [];
  private data: StoreSnapshot = { users: [], categories: [], requests: [], history: [], assignments: [], feedback: [] };
  private ids = { users: 0, categories: 0, requests: 0, history: 0, assignments: 0, feedback: 0 };

  private log(name: string) {
    this.calls.push(name);
  }
  private nextId(key: keyof FakeFixflowStore['ids']) {
    return ++this.ids[key];
  }
  private get now() {
    return new Date().toISOString();
  }

  async runExclusive<T>(work: () => Promise<T>) {
    this.log('runExclusive');
    return work();
  }

  async reset(snapshot: StoreSnapshot) {
    this.log('reset');
    this.data = JSON.parse(JSON.stringify(snapshot));
    for (const key of Object.keys(this.ids) as (keyof FakeFixflowStore['ids'])[]) {
      this.ids[key] = Math.max(0, ...this.data[key].map((r) => r.id));
    }
  }

  async findUserById(id: number) { this.log('findUserById'); return this.data.users.find((u) => u.id === id) ?? null; }
  async findUserByEmail(email: string) { this.log('findUserByEmail'); return this.data.users.find((u) => u.email === email.trim().toLowerCase()) ?? null; }
  async listUsers() { this.log('listUsers'); return [...this.data.users]; }
  async createUser(input: NewUser): Promise<UserRecord> {
    this.log('createUser');
    if (this.data.users.some((u) => u.email === input.email)) throw new StoreConflictError('duplicate email');
    const user = { id: this.nextId('users'), ...input, createdAt: this.now };
    this.data.users.push(user);
    return user;
  }

  async findCategoryById(id: number) { this.log('findCategoryById'); return this.data.categories.find((c) => c.id === id) ?? null; }
  async findCategoryByName(name: string) { this.log('findCategoryByName'); return this.data.categories.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null; }
  async listCategories() { this.log('listCategories'); return [...this.data.categories]; }
  async createCategory(input: NewCategory): Promise<CategoryRecord> {
    this.log('createCategory');
    if (this.data.categories.some((c) => c.name.toLowerCase() === input.name.toLowerCase())) throw new StoreConflictError('duplicate name');
    const category = { id: this.nextId('categories'), ...input, createdAt: this.now, updatedAt: this.now };
    this.data.categories.push(category);
    return category;
  }
  async updateCategory(id: number, patch: CategoryPatch) {
    this.log('updateCategory');
    const category = this.data.categories.find((c) => c.id === id)!;
    Object.assign(category, patch, { updatedAt: this.now });
    return { ...category };
  }

  async findRequestById(id: number) { this.log('findRequestById'); const r = this.data.requests.find((x) => x.id === id); return r ? { ...r } : null; }
  async listRequests() { this.log('listRequests'); return this.data.requests.map((r) => ({ ...r })); }
  async createRequest(input: NewServiceRequest, event: NewHistoryEvent): Promise<ServiceRequestRecord> {
    this.log('createRequest');
    const at = this.now;
    const request: ServiceRequestRecord = {
      id: this.nextId('requests'), ...input, status: RequestStatus.OPEN, assignedTechnicianId: null,
      resolvedByTechnicianId: null, resolutionNote: null, version: 1, createdAt: at, updatedAt: at,
    };
    this.data.requests.push(request);
    this.data.history.push({ id: this.nextId('history'), requestId: request.id, ...event, at });
    return { ...request };
  }
  async applyRequestChange(change: RequestChange) {
    this.log('applyRequestChange');
    const request = this.data.requests.find((r) => r.id === change.requestId)!;
    if (request.version !== change.expectedVersion) throw new StoreConflictError('stale version');
    const at = this.now;
    Object.assign(request, change.patch, { version: request.version + 1, updatedAt: at });
    if (change.clearActiveAssignment) {
      this.data.assignments.filter((a) => a.requestId === request.id && !a.clearedAt).forEach((a) => Object.assign(a, { clearedAt: at, clearedReason: change.clearActiveAssignment!.reason }));
    }
    if (change.createAssignment) {
      this.data.assignments.push({ id: this.nextId('assignments'), requestId: request.id, ...change.createAssignment, assignedAt: at, clearedAt: null, clearedReason: null });
    }
    if (change.historyEvent) this.data.history.push({ id: this.nextId('history'), requestId: request.id, ...change.historyEvent, at });
    return { ...request };
  }

  async listHistory(requestId: number): Promise<HistoryEventRecord[]> { this.log('listHistory'); return this.data.history.filter((h) => h.requestId === requestId); }
  async listAssignments(requestId: number): Promise<AssignmentRecord[]> { this.log('listAssignments'); return this.data.assignments.filter((a) => a.requestId === requestId); }

  async findFeedbackByRequestId(requestId: number) { this.log('findFeedbackByRequestId'); return this.data.feedback.find((f) => f.requestId === requestId) ?? null; }
  async listFeedback() { this.log('listFeedback'); return [...this.data.feedback]; }
  async createFeedback(input: NewFeedback): Promise<FeedbackRecord> {
    this.log('createFeedback');
    const record = { id: this.nextId('feedback'), ...input, createdAt: this.now };
    this.data.feedback.push(record);
    return record;
  }
}
