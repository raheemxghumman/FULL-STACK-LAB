import { Priority, RequestStatus, Role } from '../common/enums';
import {
  AssignmentRecord, CategoryRecord, FeedbackRecord, HistoryEventRecord, ServiceRequestRecord, StoreSnapshot, UserRecord,
} from '../storage/fixflow-store.interface';

/**
 * Demonstration accounts. These passwords are documented demo values, not real credentials.
 * Public registration can only create REQUESTERs; technicians and the dispatcher exist only here.
 */
export const DEMO_ACCOUNTS = [
  { id: 1, fullName: 'Nadia Qureshi', email: 'dispatcher@fixflow.test', password: 'Dispatch2026', role: Role.DISPATCHER, supportedCategoryIds: [] },
  { id: 2, fullName: 'Ali Raza', email: 'ali@fixflow.test', password: 'Requester2026', role: Role.REQUESTER, supportedCategoryIds: [] },
  { id: 3, fullName: 'Sara Ahmed', email: 'sara@fixflow.test', password: 'Requester2026', role: Role.REQUESTER, supportedCategoryIds: [] },
  { id: 4, fullName: 'Usman Tariq', email: 'usman@fixflow.test', password: 'Requester2026', role: Role.REQUESTER, supportedCategoryIds: [] },
  { id: 5, fullName: 'Bilal Hussain', email: 'bilal@fixflow.test', password: 'Technician2026', role: Role.TECHNICIAN, supportedCategoryIds: [1, 3] },
  { id: 6, fullName: 'Imran Khan', email: 'imran@fixflow.test', password: 'Technician2026', role: Role.TECHNICIAN, supportedCategoryIds: [2, 4] },
  { id: 7, fullName: 'Zara Malik', email: 'zara@fixflow.test', password: 'Technician2026', role: Role.TECHNICIAN, supportedCategoryIds: [1, 3, 4, 5] },
] as const;

/** Builds the seed snapshot. hash() turns a demo password into a bcrypt hash. */
export async function buildSeedSnapshot(hash: (password: string) => Promise<string>): Promise<StoreSnapshot> {
  // fixed timestamps, so every seed run produces the same data
  let minute = 0;
  const t = (stepMinutes = 7) => {
    minute += stepMinutes;
    return new Date(Date.UTC(2026, 10, 10, 8, 0) + minute * 60_000).toISOString();
  };
  const created = '2026-11-01T08:00:00.000Z';

  const users: UserRecord[] = [];
  for (const a of DEMO_ACCOUNTS) {
    users.push({
      id: a.id, fullName: a.fullName, email: a.email, role: a.role,
      supportedCategoryIds: [...a.supportedCategoryIds], passwordHash: await hash(a.password), createdAt: created,
    });
  }

  const categories: CategoryRecord[] = [
    { id: 1, name: 'Electrical', description: 'Power sockets, lighting, wiring faults and breakers.', active: true, createdAt: created, updatedAt: created },
    { id: 2, name: 'Plumbing', description: 'Leaking pipes, taps, drains and washroom fittings.', active: true, createdAt: created, updatedAt: created },
    { id: 3, name: 'IT Support', description: 'Projectors, lab computers, Wi-Fi and network points.', active: true, createdAt: created, updatedAt: created },
    { id: 4, name: 'Furniture', description: 'Chairs, desks, doors, cupboards and whiteboards.', active: true, createdAt: created, updatedAt: created },
    // deactivated: no new requests, but its historical request (#6) stays in the system
    { id: 5, name: 'HVAC', description: 'Air conditioners, heaters and ventilation fans.', active: false, createdAt: created, updatedAt: created },
  ];

  const requests: ServiceRequestRecord[] = [];
  const history: HistoryEventRecord[] = [];
  const assignments: AssignmentRecord[] = [];
  const feedback: FeedbackRecord[] = [];

  /** Creates a request and walks it through real workflow steps, recording history for each. */
  const make = (
    base: Pick<ServiceRequestRecord, 'title' | 'description' | 'categoryId' | 'building' | 'room' | 'priority' | 'requesterId'>,
    steps: Array<
      | { to: RequestStatus.ASSIGNED; technicianId: number }
      | { to: RequestStatus.IN_PROGRESS }
      | { to: RequestStatus.RESOLVED; note: string }
      | { to: RequestStatus.CLOSED }
      | { to: RequestStatus.CANCELLED }
    >,
  ) => {
    const at = t(30);
    const request: ServiceRequestRecord = {
      id: requests.length + 1, ...base, status: RequestStatus.OPEN, assignedTechnicianId: null,
      resolvedByTechnicianId: null, resolutionNote: null, version: 1, createdAt: at, updatedAt: at,
    };
    history.push({ id: history.length + 1, requestId: request.id, fromStatus: null, toStatus: RequestStatus.OPEN, actorId: base.requesterId, note: 'Request created', at });
    for (const step of steps) {
      const when = t();
      const from = request.status;
      let actorId = base.requesterId;
      let note: string | null = null;
      if (step.to === RequestStatus.ASSIGNED) {
        actorId = 1; // the dispatcher
        request.assignedTechnicianId = step.technicianId;
        assignments.push({ id: assignments.length + 1, requestId: request.id, technicianId: step.technicianId, assignedById: 1, assignedAt: when, clearedAt: null, clearedReason: null });
        note = `Assigned to technician #${step.technicianId}`;
      } else if (step.to === RequestStatus.IN_PROGRESS) {
        actorId = request.assignedTechnicianId!;
      } else if (step.to === RequestStatus.RESOLVED) {
        actorId = request.assignedTechnicianId!;
        request.resolvedByTechnicianId = actorId;
        request.resolutionNote = step.note;
        note = step.note;
      } else if (step.to === RequestStatus.CANCELLED) {
        note = 'No longer needed';
      }
      request.status = step.to;
      request.version += 1;
      request.updatedAt = when;
      history.push({ id: history.length + 1, requestId: request.id, fromStatus: from, toStatus: step.to, actorId, note, at: when });
    }
    requests.push(request);
    return request;
  };

  make({ title: 'Projector not turning on in CS Lab 3', description: 'The ceiling projector shows no power light even though the wall switch is on.', categoryId: 3, building: 'Academic Block A', room: 'CS Lab 3', priority: Priority.HIGH, requesterId: 2 }, []);
  make({ title: 'Leaking pipe under washroom sink', description: 'Water drips continuously from the pipe joint under the second sink.', categoryId: 2, building: 'Academic Block B', room: 'Ground floor washroom', priority: Priority.MEDIUM, requesterId: 2 },
    [{ to: RequestStatus.ASSIGNED, technicianId: 6 }]);
  make({ title: 'Sparking power socket in B-204', description: 'The socket near the window sparks when a charger is plugged in. Please check urgently.', categoryId: 1, building: 'Academic Block B', room: 'B-204', priority: Priority.HIGH, requesterId: 3 },
    [{ to: RequestStatus.ASSIGNED, technicianId: 5 }, { to: RequestStatus.IN_PROGRESS }]);
  make({ title: 'Wi-Fi keeps dropping in the library', description: 'The library access point disconnects every few minutes on all devices.', categoryId: 3, building: 'Central Library', room: 'Reading Hall', priority: Priority.MEDIUM, requesterId: 3 },
    [{ to: RequestStatus.ASSIGNED, technicianId: 7 }, { to: RequestStatus.IN_PROGRESS }, { to: RequestStatus.RESOLVED, note: 'Replaced the faulty access point power adapter and updated its firmware.' }]);
  const chair = make({ title: 'Broken chair in lecture hall A-1', description: 'The front-row chair has a cracked leg and wobbles when anyone sits on it.', categoryId: 4, building: 'Academic Block A', room: 'A-1', priority: Priority.LOW, requesterId: 2 },
    [{ to: RequestStatus.ASSIGNED, technicianId: 6 }, { to: RequestStatus.IN_PROGRESS }, { to: RequestStatus.RESOLVED, note: 'Replaced the cracked leg and tightened all the bolts on the chair.' }, { to: RequestStatus.CLOSED }]);
  const ac = make({ title: 'Air conditioner making loud noise', description: 'The split AC in the staff room rattles loudly whenever the compressor starts.', categoryId: 5, building: 'Admin Block', room: 'Staff Room', priority: Priority.LOW, requesterId: 3 },
    [{ to: RequestStatus.ASSIGNED, technicianId: 7 }, { to: RequestStatus.IN_PROGRESS }, { to: RequestStatus.RESOLVED, note: 'Fixed the loose fan blade mount and cleaned the outdoor unit.' }, { to: RequestStatus.CLOSED }]);
  make({ title: 'Door hinge loose in room C-12', description: 'The classroom door hinge is loose and the door does not close properly.', categoryId: 4, building: 'Academic Block C', room: 'C-12', priority: Priority.LOW, requesterId: 3 },
    [{ to: RequestStatus.CANCELLED }]);

  feedback.push({ id: 1, requestId: chair.id, requesterId: 2, technicianId: 6, rating: 4, comment: 'Quick fix, thank you.', createdAt: t() });
  feedback.push({ id: 2, requestId: ac.id, requesterId: 3, technicianId: 7, rating: 5, comment: 'Very professional.', createdAt: t() });

  return { users, categories, requests, history, assignments, feedback };
}
