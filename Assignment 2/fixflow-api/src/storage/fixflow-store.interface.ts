import { Priority, RequestStatus, Role } from '../common/enums';

/**
 * Custom injection token for the storage provider.
 * Services never import a concrete store class: they ask Nest for whatever is bound to this token,
 *   constructor(@Inject(FIXFLOW_STORE) private readonly store: FixflowStore) {}
 * so the in-memory store can be replaced (by a fake in tests, or a database later) without editing them.
 */
export const FIXFLOW_STORE = Symbol('FIXFLOW_STORE');

/* ------------------------------------------------------------------ records */

export interface UserRecord {
  id: number;
  fullName: string;
  email: string; // normalised: trimmed + lower-case
  passwordHash: string; // bcrypt hash, never returned by the API
  role: Role;
  supportedCategoryIds: number[]; // technicians only; empty for other roles
  createdAt: string;
}

export interface CategoryRecord {
  id: number;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequestRecord {
  id: number;
  title: string;
  description: string;
  categoryId: number;
  building: string;
  room: string;
  priority: Priority;
  status: RequestStatus;
  requesterId: number;
  assignedTechnicianId: number | null; // current assignment (cleared by a reopen)
  resolvedByTechnicianId: number | null; // technician of the latest successful repair
  resolutionNote: string | null;
  version: number; // increases on every change; used to detect a stale write
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEventRecord {
  id: number;
  requestId: number;
  fromStatus: RequestStatus | null; // null for the creation event
  toStatus: RequestStatus;
  actorId: number;
  note: string | null;
  at: string;
}

export interface AssignmentRecord {
  id: number;
  requestId: number;
  technicianId: number;
  assignedById: number;
  assignedAt: string;
  clearedAt: string | null; // set when a reopen clears the assignment
  clearedReason: string | null;
}

export interface FeedbackRecord {
  id: number;
  requestId: number;
  requesterId: number;
  technicianId: number; // technician who completed the final successful repair
  rating: number;
  comment: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ inputs */

export type NewUser = Omit<UserRecord, 'id' | 'createdAt'>;
export type NewCategory = Pick<CategoryRecord, 'name' | 'description' | 'active'>;
export type CategoryPatch = Partial<NewCategory>;
export type NewServiceRequest = Pick<
  ServiceRequestRecord,
  'title' | 'description' | 'categoryId' | 'building' | 'room' | 'priority' | 'requesterId'
>;
export type NewHistoryEvent = Omit<HistoryEventRecord, 'id' | 'requestId' | 'at'>;
export type NewFeedback = Omit<FeedbackRecord, 'id' | 'createdAt'>;

/**
 * One all-or-nothing change to a request. The store applies the request patch, the history event and
 * the assignment change together, or none of them (e.g. when expectedVersion no longer matches).
 */
export interface RequestChange {
  requestId: number;
  expectedVersion: number;
  patch: Partial<
    Pick<
      ServiceRequestRecord,
      | 'title' | 'description' | 'categoryId' | 'building' | 'room' | 'priority'
      | 'status' | 'assignedTechnicianId' | 'resolvedByTechnicianId' | 'resolutionNote'
    >
  >;
  historyEvent?: NewHistoryEvent;
  createAssignment?: { technicianId: number; assignedById: number };
  clearActiveAssignment?: { reason: string };
}

/** Everything the store holds, used for seeding and resetting. */
export interface StoreSnapshot {
  users: UserRecord[];
  categories: CategoryRecord[];
  requests: ServiceRequestRecord[];
  history: HistoryEventRecord[];
  assignments: AssignmentRecord[];
  feedback: FeedbackRecord[];
}

/** Thrown by a store when a write would break a stored invariant (stale version, duplicate key). */
export class StoreConflictError extends Error {}

/* ------------------------------------------------------------------ contract */

/**
 * Typed storage contract. Every method returns copies, so callers can never change stored data
 * by accident; the only way to change data is through the write methods below.
 * Methods are async so a database implementation can be bound to the same token later.
 */
export interface FixflowStore {
  /** Name of the implementation, shown by GET /api/health. */
  readonly driver: string;

  /**
   * Runs check-and-update work so that no other runExclusive work interleaves with it.
   * Services wrap every "read, check rules, then write" sequence in this.
   */
  runExclusive<T>(work: () => Promise<T>): Promise<T>;

  /** Replaces all data (used by seeding and by tests). */
  reset(snapshot: StoreSnapshot): Promise<void>;

  findUserById(id: number): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  createUser(input: NewUser): Promise<UserRecord>;

  findCategoryById(id: number): Promise<CategoryRecord | null>;
  findCategoryByName(name: string): Promise<CategoryRecord | null>; // case-insensitive
  listCategories(): Promise<CategoryRecord[]>;
  createCategory(input: NewCategory): Promise<CategoryRecord>;
  updateCategory(id: number, patch: CategoryPatch): Promise<CategoryRecord>;

  findRequestById(id: number): Promise<ServiceRequestRecord | null>;
  listRequests(): Promise<ServiceRequestRecord[]>;
  /** Creates the request and its creation history event together. */
  createRequest(input: NewServiceRequest, creationEvent: NewHistoryEvent): Promise<ServiceRequestRecord>;
  /** Applies a RequestChange atomically; throws StoreConflictError if the version is stale. */
  applyRequestChange(change: RequestChange): Promise<ServiceRequestRecord>;

  listHistory(requestId: number): Promise<HistoryEventRecord[]>; // chronological
  listAssignments(requestId: number): Promise<AssignmentRecord[]>;

  findFeedbackByRequestId(requestId: number): Promise<FeedbackRecord | null>;
  listFeedback(): Promise<FeedbackRecord[]>;
  /** Throws StoreConflictError if the request already has feedback. */
  createFeedback(input: NewFeedback): Promise<FeedbackRecord>;
}
