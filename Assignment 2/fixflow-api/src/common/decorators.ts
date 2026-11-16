import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from './enums';

/** The authenticated user, as attached to the request by JwtAuthGuard. Never comes from the body. */
export interface AuthUser {
  id: number;
  role: Role;
  email: string;
  fullName: string;
}

export const IS_PUBLIC_KEY = 'fixflow:isPublic';
export const ROLES_KEY = 'fixflow:roles';

/** Marks a route as public: JwtAuthGuard lets it through without a token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Roles allowed to call a route, checked by RolesGuard: @Roles(Role.DISPATCHER) */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated user into a handler: handler(@CurrentUser() user: AuthUser) */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
