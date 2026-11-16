import { Inject, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/decorators';
import { ACTIVE_STATUSES, LIMITS, RequestStatus, Role, WORKLOAD_STATUSES } from '../common/enums';
import { FeedbackRecord, FIXFLOW_STORE, FixflowStore, ServiceRequestRecord, UserRecord } from '../storage/fixflow-store.interface';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Every number here is computed from stored data at the moment of the request; nothing is cached. */
@Injectable()
export class ReportsService {
  constructor(@Inject(FIXFLOW_STORE) private readonly store: FixflowStore) {}

  private countByStatus(rows: ServiceRequestRecord[]): Record<RequestStatus, number> {
    const counts = Object.fromEntries(Object.values(RequestStatus).map((s) => [s, 0])) as Record<RequestStatus, number>;
    rows.forEach((r) => (counts[r.status] += 1));
    return counts;
  }

  private workload(technician: UserRecord, requests: ServiceRequestRecord[]) {
    const mine = requests.filter((r) => r.assignedTechnicianId === technician.id);
    const assigned = mine.filter((r) => r.status === RequestStatus.ASSIGNED).length;
    const inProgress = mine.filter((r) => r.status === RequestStatus.IN_PROGRESS).length;
    const activeJobs = mine.filter((r) => WORKLOAD_STATUSES.includes(r.status)).length;
    return { assigned, inProgress, activeJobs, capacity: LIMITS.maxActiveJobsPerTechnician, available: Math.max(0, LIMITS.maxActiveJobsPerTechnician - activeJobs) };
  }

  /** Feedback count and average for a technician (attributed to who completed the final repair). */
  private rating(technicianId: number, feedback: FeedbackRecord[]) {
    const mine = feedback.filter((f) => f.technicianId === technicianId);
    return {
      feedbackCount: mine.length,
      averageRating: mine.length ? round2(mine.reduce((s, f) => s + f.rating, 0) / mine.length) : null,
    };
  }

  async dashboard(user: AuthUser) {
    const requests = await this.store.listRequests();

    if (user.role === Role.REQUESTER) {
      const mine = requests.filter((r) => r.requesterId === user.id);
      const active = mine.filter((r) => ACTIVE_STATUSES.includes(r.status)).length;
      return {
        role: user.role,
        totalRequests: mine.length,
        byStatus: this.countByStatus(mine),
        activeRequests: active,
        activeLimit: LIMITS.maxActiveRequestsPerRequester,
        canCreateMore: active < LIMITS.maxActiveRequestsPerRequester,
      };
    }

    if (user.role === Role.TECHNICIAN) {
      const technician = (await this.store.findUserById(user.id))!;
      const assignedToMe = requests.filter((r) => r.assignedTechnicianId === user.id);
      return {
        role: user.role,
        assignedJobs: assignedToMe.length,
        byStatus: this.countByStatus(assignedToMe),
        workload: this.workload(technician, requests),
        ...this.rating(user.id, await this.store.listFeedback()),
      };
    }

    // DISPATCHER: the whole system
    const [categories, users, feedback] = await Promise.all([this.store.listCategories(), this.store.listUsers(), this.store.listFeedback()]);
    return {
      role: user.role,
      totalRequests: requests.length,
      byStatus: this.countByStatus(requests),
      byCategory: categories.map((c) => ({
        categoryId: c.id, name: c.name, active: c.active,
        total: requests.filter((r) => r.categoryId === c.id).length,
        byStatus: this.countByStatus(requests.filter((r) => r.categoryId === c.id)),
      })),
      technicianWorkload: users
        .filter((u) => u.role === Role.TECHNICIAN)
        .sort((a, b) => a.id - b.id)
        .map((t) => ({ technicianId: t.id, fullName: t.fullName, ...this.workload(t, requests), ...this.rating(t.id, feedback) })),
    };
  }

  /** Dispatcher report: workload, completed jobs and ratings per technician. */
  async technicianReport() {
    const [requests, users, feedback] = await Promise.all([this.store.listRequests(), this.store.listUsers(), this.store.listFeedback()]);
    return users
      .filter((u) => u.role === Role.TECHNICIAN)
      .sort((a, b) => a.id - b.id)
      .map((t) => ({
        technicianId: t.id,
        fullName: t.fullName,
        supportedCategoryIds: t.supportedCategoryIds,
        ...this.workload(t, requests),
        resolvedJobs: requests.filter((r) => r.resolvedByTechnicianId === t.id && [RequestStatus.RESOLVED, RequestStatus.CLOSED].includes(r.status)).length,
        ...this.rating(t.id, feedback),
      }));
  }
}
