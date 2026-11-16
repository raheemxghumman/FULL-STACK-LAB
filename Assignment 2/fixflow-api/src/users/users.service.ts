import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Role } from '../common/enums';
import { FIXFLOW_STORE, FixflowStore, StoreConflictError, UserRecord } from '../storage/fixflow-store.interface';

/** What the API shows about a user: never the password hash. */
export interface PublicUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  supportedCategoryIds?: number[];
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(FIXFLOW_STORE) private readonly store: FixflowStore) {}

  toPublic(user: UserRecord): PublicUser {
    const { passwordHash, supportedCategoryIds, ...rest } = user;
    return user.role === Role.TECHNICIAN ? { ...rest, supportedCategoryIds } : rest;
  }

  findById(id: number) {
    return this.store.findUserById(id);
  }

  findByEmail(email: string) {
    return this.store.findUserByEmail(email);
  }

  /** Public registration always creates a REQUESTER; the role is fixed here, never taken from input. */
  async createRequester(input: { fullName: string; email: string; passwordHash: string }) {
    try {
      return await this.store.createUser({ ...input, role: Role.REQUESTER, supportedCategoryIds: [] });
    } catch (err) {
      if (err instanceof StoreConflictError) throw new ConflictException('An account with this email already exists.');
      throw err;
    }
  }

  async listTechnicians(): Promise<PublicUser[]> {
    const users = await this.store.listUsers();
    return users.filter((u) => u.role === Role.TECHNICIAN).sort((a, b) => a.id - b.id).map((u) => this.toPublic(u));
  }
}
