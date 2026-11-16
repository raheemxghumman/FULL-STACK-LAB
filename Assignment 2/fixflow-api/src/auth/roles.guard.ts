import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, ROLES_KEY } from '../common/decorators';
import { Role } from '../common/enums';
import { traceStage } from '../common/request-context';

/**
 * Global guard (APP_GUARD, runs after JwtAuthGuard). Compares the user's role with @Roles(...).
 * It only checks the role. Record ownership ("is this MY request?") is checked in the services by
 * RequestAccessPolicy, because guards run before pipes and have no validated, transformed data.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !roles.includes(user.role)) {
      traceStage('2 guard', `RolesGuard -> ${user?.role ?? 'nobody'} is not ${roles.join('/')} (403)`);
      throw new ForbiddenException(`This action requires the ${roles.join(' or ')} role.`);
    }
    traceStage('2 guard', `RolesGuard -> pass (${user.role} is allowed)`);
    return true;
  }
}
