import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { AuthUser, IS_PUBLIC_KEY } from '../common/decorators';
import { traceStage } from '../common/request-context';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.service';

/**
 * Global guard (APP_GUARD, runs first). Every route needs a valid "Authorization: Bearer <token>"
 * unless it is marked @Public(). Missing, malformed, wrongly signed and expired tokens all get 401.
 * The user is re-read from storage, so the role always comes from stored data, never from the client.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = request.headers.authorization ?? '';
    const match = /^Bearer ([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/.exec(header);
    if (!match) {
      traceStage('2 guard', 'JwtAuthGuard -> no bearer token (401); RolesGuard, interceptor, pipes, controller are skipped');
      throw new UnauthorizedException(header ? 'Authorization header must be "Bearer <token>".' : 'Missing access token.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(match[1]);
    } catch (err) {
      const expired = err instanceof TokenExpiredError;
      traceStage('2 guard', `JwtAuthGuard -> ${expired ? 'expired' : 'invalid'} token (401)`);
      throw new UnauthorizedException(expired ? 'Access token has expired. Please log in again.' : 'Invalid access token.');
    }

    const user = await this.users.findById(Number(payload.sub));
    if (!user) throw new UnauthorizedException('The account for this token no longer exists.');
    request.user = { id: user.id, role: user.role, email: user.email, fullName: user.fullName };
    traceStage('2 guard', `JwtAuthGuard -> pass (user #${user.id}, ${user.role})`);
    return true;
  }
}
