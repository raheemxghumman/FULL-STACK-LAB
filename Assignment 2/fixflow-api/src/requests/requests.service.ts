import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { AuthUser } from '../common/decorators';
import { ACTIVE_STATUSES, LIMITS, RequestStatus, Role, WORKLOAD_STATUSES } from '../common/enums';
import { traceStage } from '../common/request-context';
import {
  FIXFLOW_STORE, FixflowStore, RequestChange, ServiceRequestRecord, StoreConflictError,
} from '../storage/fixflow-store.interface';
import { UsersService } from '../users/users.service';
import {
  AssignRequestDto, CreateRequestDto, FeedbackDto, ListRequestsQueryDto, ReopenRequestDto, ResolveRequestDto, UpdateRequestDto,
} from './dto/request.dto';
import { RequestAccessPolicy } from './request-access.policy';
import { assertTransition } from './request-transitions';

/**
 * All business rules of the request workflow.
 *
 * Every action follows the same order, so authorization always comes before any state detail:
 *   1. load the request          -> 404 if it does not exist
 *   2. RequestAccessPolicy       -> 403 if the caller may not act on THIS record
 *   3. assertTransition          -> 409 if the status change is not allowed
 *   4. limits / eligibility      -> 409 (capacity, unsupported category, duplicate ...)
 *   5. ONE atomic store write    -> request + history event + assignment change together
 * Steps 1-5 run inside store.runExclusive(), so no other action can change the data between the
 * checks and the write; a failed check throws before step 5 and leaves everything unchanged.
 * Nothing request-specific is kept in fields of this (singleton) service.
 */
@Injectable()
export class RequestsService {
  constructor(
    @Inject(FIXFLOW_STORE) private readonly store: FixflowStore,
    private readonly policy: RequestAccessPolicy,
    private readonly categories: CategoriesService,
    private readonly users: UsersService,
  ) {}

  /* ------------------------------------------------------------ helpers */

  private async load(id: number): Promise<ServiceRequestRecord> {
    const request = await this.store.findRequestById(id);
    if (!request) throw new NotFoundException(`Request ${id} not found.`);
    return request;
  }

  private async countActiveFor(requesterId: number): Promise<number> {
    const all = await this.store.listRequests();
    return all.filter((r) => r.requesterId === requesterId && ACTIVE_STATUSES.includes(r.status)).length;
  }

  private async workloadOf(technicianId: number): Promise<number> {
    const all = await this.store.listRequests();
    return all.filter((r) => r.assignedTechnicianId === technicianId && WORKLOAD_STATUSES.includes(r.status)).length;
  }

  /** Writes a change; a stale version (somebody changed the request first) becomes 409. */
  private async commit(change: RequestChange): Promise<ServiceRequestRecord> {
    try {
      return await this.store.applyRequestChange(change);
    } catch (err) {
      if (err instanceof StoreConflictError) throw new ConflictException(err.message);
      throw err;
    }
  }

  /* ----------------------------------------------------------- creation */

  async create(user: AuthUser, dto: CreateRequestDto) {
    return this.store.runExclusive(async () => {
      await this.categories.getActiveOrThrow(dto.categoryId); // 404 / 409 for a deactivated category
      const active = await this.countActiveFor(user.id);
      if (active >= LIMITS.maxActiveRequestsPerRequester) {
        throw new ConflictException(
          `You already have ${active} active requests. At most ${LIMITS.maxActiveRequestsPerRequester} may be active (not CLOSED or CANCELLED).`,
        );
      }
      return this.store.createRequest(
        { ...dto, requesterId: user.id },
        { fromStatus: null, toStatus: RequestStatus.OPEN, actorId: user.id, note: 'Request created' },
      );
    });
  }

  /* -------------------------------------------------------------- reads */

  async list(user: AuthUser, query: ListRequestsQueryDto) {
    const page = query.page ?? LIMITS.defaultPage;
    const limit = query.limit ?? LIMITS.defaultLimit;
    const search = query.q?.toLowerCase();

    // 1. scope to the caller's records FIRST, so totals and pages never count other users' data
    let rows = this.policy.scope(user, await this.store.listRequests());
    // 2. all filters apply together
    if (search) rows = rows.filter((r) => r.title.toLowerCase().includes(search));
    if (query.categoryId !== undefined) rows = rows.filter((r) => r.categoryId === query.categoryId);
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    if (query.priority) rows = rows.filter((r) => r.priority === query.priority);
    // 3. newest first, id as the tie-breaker
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);

    const total = rows.length;
    const items = rows.slice((page - 1) * limit, page * limit);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async details(user: AuthUser, id: number) {
    const request = await this.load(id);
    this.policy.assertCanView(user, request);
    const [assignments, history, feedback, category, requester] = await Promise.all([
      this.store.listAssignments(id),
      this.store.listHistory(id),
      this.store.findFeedbackByRequestId(id),
      this.store.findCategoryById(request.categoryId),
      this.users.findById(request.requesterId),
    ]);
    const technician = request.assignedTechnicianId ? await this.users.findById(request.assignedTechnicianId) : null;
    return {
      request,
      category: category && { id: category.id, name: category.name, active: category.active },
      requester: requester && { id: requester.id, fullName: requester.fullName },
      assignment: assignments.find((a) => a.clearedAt === null) ?? null,
      assignedTechnician: technician && { id: technician.id, fullName: technician.fullName },
      assignmentHistory: assignments,
      history, // chronological, starting with the creation event
      feedback,
    };
  }

  /* ---------------------------------------------------- owner: edit/cancel */

  async update(user: AuthUser, id: number, dto: UpdateRequestDto) {
    traceStage('5 service', `RequestsService.update(#${id}) -> checking owner, status and category`);
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertOwner(user, request, 'edit');
      if (request.status !== RequestStatus.OPEN) {
        throw new ConflictException(`Request ${id} is ${request.status}; it can only be edited while OPEN.`);
      }
      if (dto.categoryId !== undefined && dto.categoryId !== request.categoryId) {
        await this.categories.getActiveOrThrow(dto.categoryId);
      }
      // only the submitted fields change: never the owner, status, assignment or history
      return this.commit({ requestId: id, expectedVersion: request.version, patch: { ...dto } });
    });
  }

  async cancel(user: AuthUser, id: number) {
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertOwner(user, request, 'cancel');
      assertTransition(id, request.status, RequestStatus.CANCELLED);
      return this.commit({
        requestId: id, expectedVersion: request.version, patch: { status: RequestStatus.CANCELLED },
        historyEvent: { fromStatus: request.status, toStatus: RequestStatus.CANCELLED, actorId: user.id, note: 'Cancelled by the requester' },
      });
    });
  }

  /* ----------------------------------------------------- dispatcher: assign */

  async assign(user: AuthUser, id: number, dto: AssignRequestDto) {
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertCanView(user, request); // dispatchers see every request
      assertTransition(id, request.status, RequestStatus.ASSIGNED); // only OPEN requests

      const technician = await this.users.findById(dto.technicianId);
      if (!technician) throw new NotFoundException(`User ${dto.technicianId} not found.`);
      if (technician.role !== Role.TECHNICIAN) {
        throw new ConflictException(`User ${technician.id} is a ${technician.role}, not a TECHNICIAN.`);
      }
      if (!technician.supportedCategoryIds.includes(request.categoryId)) {
        throw new ConflictException(`Technician ${technician.id} does not support category ${request.categoryId}.`);
      }
      const workload = await this.workloadOf(technician.id);
      if (workload >= LIMITS.maxActiveJobsPerTechnician) {
        throw new ConflictException(
          `Technician ${technician.id} already has ${workload} ASSIGNED/IN_PROGRESS jobs (maximum ${LIMITS.maxActiveJobsPerTechnician}).`,
        );
      }
      return this.commit({
        requestId: id, expectedVersion: request.version,
        patch: { status: RequestStatus.ASSIGNED, assignedTechnicianId: technician.id },
        createAssignment: { technicianId: technician.id, assignedById: user.id },
        historyEvent: {
          fromStatus: request.status, toStatus: RequestStatus.ASSIGNED, actorId: user.id,
          note: `Assigned to technician #${technician.id} (${technician.fullName})`,
        },
      });
    });
  }

  /* -------------------------------------------- assigned technician: work */

  async start(user: AuthUser, id: number) {
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertAssignedTechnician(user, request, 'start');
      assertTransition(id, request.status, RequestStatus.IN_PROGRESS);
      return this.commit({
        requestId: id, expectedVersion: request.version, patch: { status: RequestStatus.IN_PROGRESS },
        historyEvent: { fromStatus: request.status, toStatus: RequestStatus.IN_PROGRESS, actorId: user.id, note: 'Work started' },
      });
    });
  }

  async resolve(user: AuthUser, id: number, dto: ResolveRequestDto) {
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertAssignedTechnician(user, request, 'resolve');
      assertTransition(id, request.status, RequestStatus.RESOLVED); // must be IN_PROGRESS (started)
      return this.commit({
        requestId: id, expectedVersion: request.version,
        // remembered so feedback goes to the technician who did the final successful repair
        patch: { status: RequestStatus.RESOLVED, resolutionNote: dto.resolutionNote, resolvedByTechnicianId: user.id },
        historyEvent: { fromStatus: request.status, toStatus: RequestStatus.RESOLVED, actorId: user.id, note: dto.resolutionNote },
      });
    });
  }

  /* ------------------------------------------------- owner: close / reopen */

  async close(user: AuthUser, id: number) {
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertOwner(user, request, 'close');
      assertTransition(id, request.status, RequestStatus.CLOSED);
      return this.commit({
        requestId: id, expectedVersion: request.version, patch: { status: RequestStatus.CLOSED },
        historyEvent: { fromStatus: request.status, toStatus: RequestStatus.CLOSED, actorId: user.id, note: 'Completion confirmed by the requester' },
      });
    });
  }

  async reopen(user: AuthUser, id: number, dto: ReopenRequestDto) {
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertOwner(user, request, 'reopen');
      assertTransition(id, request.status, RequestStatus.OPEN); // only RESOLVED requests
      // The limit applies to reopening too. A RESOLVED request already counts as active, so if the
      // owner has five active requests (including this one) the reopen is refused.
      const active = await this.countActiveFor(user.id);
      if (active >= LIMITS.maxActiveRequestsPerRequester) {
        throw new ConflictException(
          `You already have ${active} active requests (maximum ${LIMITS.maxActiveRequestsPerRequester}); close or cancel one before reopening.`,
        );
      }
      return this.commit({
        requestId: id, expectedVersion: request.version,
        patch: { status: RequestStatus.OPEN, assignedTechnicianId: null }, // reopening clears the assignment
        clearActiveAssignment: { reason: dto.reason },
        historyEvent: { fromStatus: request.status, toStatus: RequestStatus.OPEN, actorId: user.id, note: dto.reason },
      });
    });
  }

  /* ---------------------------------------------------------- feedback */

  async submitFeedback(user: AuthUser, id: number, dto: FeedbackDto) {
    return this.store.runExclusive(async () => {
      const request = await this.load(id);
      this.policy.assertOwner(user, request, 'give feedback on');
      if (request.status !== RequestStatus.CLOSED) {
        throw new ConflictException(`Feedback can only be given for a CLOSED request; request ${id} is ${request.status}.`);
      }
      if (await this.store.findFeedbackByRequestId(id)) {
        throw new ConflictException(`Feedback for request ${id} has already been submitted.`);
      }
      try {
        return await this.store.createFeedback({
          requestId: id, requesterId: user.id, technicianId: request.resolvedByTechnicianId!,
          rating: dto.rating, comment: dto.comment ?? null,
        });
      } catch (err) {
        if (err instanceof StoreConflictError) throw new ConflictException(err.message);
        throw err;
      }
    });
  }
}
