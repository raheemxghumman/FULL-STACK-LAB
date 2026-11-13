import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_KEY, AuthLevel } from "./auth.decorators.js";
import { AuthService } from "./auth.service.js";

/**
 * Registered for every route (APP_GUARD in app.module.ts).
 * Reads "Authorization: Bearer <token>", finds the session, and attaches request.user.
 * Then checks the level the route asked for with @Auth().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const level = this.reflector.getAllAndOverride<AuthLevel | undefined>(AUTH_KEY, [context.getHandler(), context.getClass()]);
    if (!level) return true;   // public route

    const request = context.switchToHttp().getRequest();
    const match = /^Bearer\s+(\S+)$/i.exec(String(request.headers.authorization || ""));
    const user = match ? this.auth.userForToken(match[1]) : null;
    request.user = user;
    request.token = match ? match[1] : null;

    if (level === "optional") return true;
    if (!user) throw new UnauthorizedException(match ? "Your login has expired. Please log in again." : "Please log in first.");
    if (level === "admin" && user.role !== "admin") throw new ForbiddenException("Only the store admin can do this.");
    return true;
  }
}
