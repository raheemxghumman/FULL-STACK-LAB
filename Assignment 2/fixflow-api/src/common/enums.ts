export enum Role {
  REQUESTER = 'REQUESTER',
  TECHNICIAN = 'TECHNICIAN',
  DISPATCHER = 'DISPATCHER',
}

export enum RequestStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

/** "Active" means any status other than CLOSED or CANCELLED. */
export const ACTIVE_STATUSES: readonly RequestStatus[] = [
  RequestStatus.OPEN,
  RequestStatus.ASSIGNED,
  RequestStatus.IN_PROGRESS,
  RequestStatus.RESOLVED,
];

/** A technician's workload: jobs that are ASSIGNED or IN_PROGRESS. */
export const WORKLOAD_STATUSES: readonly RequestStatus[] = [RequestStatus.ASSIGNED, RequestStatus.IN_PROGRESS];

export const LIMITS = {
  /** At most five active requests per requester (create and reopen). */
  maxActiveRequestsPerRequester: 5,
  /** A technician may hold at most three ASSIGNED or IN_PROGRESS jobs. */
  maxActiveJobsPerTechnician: 3,
  defaultPage: 1,
  defaultLimit: 10,
  maxLimit: 50,
} as const;
