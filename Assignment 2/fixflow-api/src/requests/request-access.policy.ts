import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '../common/decorators';
import { Role } from '../common/enums';
import { ServiceRequestRecord } from '../storage/fixflow-store.interface';

/**
 * The dedicated authorization component for request records ("who may see or act on THIS record").
 * RolesGuard only knows the caller's role; ownership needs the stored record, so it is checked here,
 * from the services, after the record has been loaded and before any state is revealed or changed.
 *
 *   REQUESTER  -> only requests they created
 *   TECHNICIAN -> only requests currently assigned to them
 *   DISPATCHER -> every request
 */
@Injectable()
export class RequestAccessPolicy {
  canView(user: AuthUser, request: ServiceRequestRecord): boolean {
    switch (user.role) {
      case Role.DISPATCHER:
        return true;
      case Role.REQUESTER:
        return request.requesterId === user.id;
      case Role.TECHNICIAN:
        return request.assignedTechnicianId === user.id;
      default:
        return false;
    }
  }

  /** Limits a list to the caller's records. Applied BEFORE filters, totals and pagination. */
  scope(user: AuthUser, requests: ServiceRequestRecord[]): ServiceRequestRecord[] {
    return requests.filter((r) => this.canView(user, r));
  }

  assertCanView(user: AuthUser, request: ServiceRequestRecord): void {
    if (!this.canView(user, request)) {
      throw new ForbiddenException(`You do not have access to request ${request.id}.`);
    }
  }

  assertOwner(user: AuthUser, request: ServiceRequestRecord, action: string): void {
    if (user.role !== Role.REQUESTER || request.requesterId !== user.id) {
      throw new ForbiddenException(`Only the requester who created request ${request.id} can ${action} it.`);
    }
  }

  assertAssignedTechnician(user: AuthUser, request: ServiceRequestRecord, action: string): void {
    if (user.role !== Role.TECHNICIAN || request.assignedTechnicianId !== user.id) {
      throw new ForbiddenException(`Only the technician assigned to request ${request.id} can ${action} it.`);
    }
  }
}
