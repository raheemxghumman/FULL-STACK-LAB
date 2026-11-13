import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";
import type { PublicUser } from "../database/types.js";

export type AuthLevel = "optional" | "user" | "admin";
export const AUTH_KEY = "auth-level";

/**
 * @Auth("user")      a logged-in user is required (401 otherwise)
 * @Auth("admin")     the admin account is required (401 / 403)
 * @Auth("optional")  anyone, but the user is attached when a valid token is sent
 * Routes without @Auth are public. AuthGuard reads this metadata.
 */
export function Auth(level: AuthLevel) {
  const docs = level === "optional" ? [ApiBearerAuth()] : [ApiBearerAuth(), ApiUnauthorizedResponse({ description: "Not logged in" })];
  if (level === "admin") docs.push(ApiForbiddenResponse({ description: "Logged in, but not the admin" }));
  return applyDecorators(SetMetadata(AUTH_KEY, level), ...docs);
}

/* Injects the logged-in user (or null) into a handler: handler(@CurrentUser() user) */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): PublicUser | null =>
  ctx.switchToHttp().getRequest().user ?? null);

/* Injects the token the request was made with (used by logout). */
export const CurrentToken = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null =>
  ctx.switchToHttp().getRequest().token ?? null);
