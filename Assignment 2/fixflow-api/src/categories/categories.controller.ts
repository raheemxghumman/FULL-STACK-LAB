import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { NonEmptyBodyPipe, ParsePositiveIntPipe } from '../common/pipes';
import { CreateCategoryDto, ListCategoriesQueryDto, UpdateCategoryDto } from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Active categories (any authenticated user). Dispatchers may add ?includeInactive=true. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCategoriesQueryDto) {
    return this.categories.list(user, query.includeInactive === 'true');
  }

  /** Create a category (dispatcher). 201; duplicate name 409. */
  @Post()
  @Roles(Role.DISPATCHER)
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  /** Update or deactivate ({ "active": false }) a category (dispatcher). */
  @Patch(':id')
  @Roles(Role.DISPATCHER)
  update(@Param('id', ParsePositiveIntPipe) id: number, @Body(NonEmptyBodyPipe) dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }
}
