import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** The authenticated account (any role). */
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const record = await this.users.findById(user.id);
    if (!record) throw new NotFoundException('User not found.');
    return this.users.toPublic(record);
  }

  /** Technicians and the categories they support, so a dispatcher can pick one to assign (dispatcher). */
  @Get('technicians')
  @Roles(Role.DISPATCHER)
  technicians() {
    return this.users.listTechnicians();
  }
}
