import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/decorators';
import { Role } from '../common/enums';
import { CategoryRecord, FIXFLOW_STORE, FixflowStore, StoreConflictError } from '../storage/fixflow-store.interface';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(@Inject(FIXFLOW_STORE) private readonly store: FixflowStore) {}

  async list(user: AuthUser, includeInactive: boolean) {
    if (includeInactive && user.role !== Role.DISPATCHER) {
      throw new ForbiddenException('Only a dispatcher can list deactivated categories.');
    }
    const categories = await this.store.listCategories();
    return includeInactive ? categories : categories.filter((c) => c.active);
  }

  async create(dto: CreateCategoryDto) {
    try {
      // name uniqueness is checked inside the store's write, so two identical creates cannot both pass
      return await this.store.createCategory({ name: dto.name, description: dto.description, active: dto.active ?? true });
    } catch (err) {
      if (err instanceof StoreConflictError) throw new ConflictException(err.message);
      throw err;
    }
  }

  /** Update or deactivate. Deactivation keeps the category and all its historical requests. */
  async update(id: number, dto: UpdateCategoryDto) {
    return this.store.runExclusive(async () => {
      await this.getOrThrow(id);
      try {
        return await this.store.updateCategory(id, dto);
      } catch (err) {
        if (err instanceof StoreConflictError) throw new ConflictException(err.message);
        throw err;
      }
    });
  }

  async getOrThrow(id: number): Promise<CategoryRecord> {
    const category = await this.store.findCategoryById(id);
    if (!category) throw new NotFoundException(`Category ${id} not found.`);
    return category;
  }

  /** Used when creating or editing a request: the category must exist (404) and be active (409). */
  async getActiveOrThrow(id: number): Promise<CategoryRecord> {
    const category = await this.getOrThrow(id);
    if (!category.active) {
      throw new ConflictException(`Category "${category.name}" is deactivated and cannot be used for new requests.`);
    }
    return category;
  }
}
