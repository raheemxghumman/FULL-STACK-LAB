import { ConflictException } from '@nestjs/common';
import { RequestStatus } from '../common/enums';

const { OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED } = RequestStatus;

/**
 * The only allowed status changes. Anything not listed is forbidden; CLOSED and CANCELLED are terminal.
 *   OPEN        -> ASSIGNED     dispatcher (eligible technician with capacity)
 *   OPEN        -> CANCELLED    owning requester
 *   ASSIGNED    -> IN_PROGRESS  assigned technician
 *   IN_PROGRESS -> RESOLVED     assigned technician (resolution note)
 *   RESOLVED    -> CLOSED       owning requester confirms
 *   RESOLVED    -> OPEN         owning requester reopens (reason)
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  [OPEN]: [ASSIGNED, CANCELLED],
  [ASSIGNED]: [IN_PROGRESS],
  [IN_PROGRESS]: [RESOLVED],
  [RESOLVED]: [CLOSED, OPEN],
  [CLOSED]: [],
  [CANCELLED]: [],
};

export function assertTransition(requestId: number, from: RequestStatus, to: RequestStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    const terminal = ALLOWED_TRANSITIONS[from].length === 0 ? ` ${from} is a final status.` : '';
    throw new ConflictException(`Request ${requestId} is ${from}; it cannot move to ${to}.${terminal}`);
  }
}
