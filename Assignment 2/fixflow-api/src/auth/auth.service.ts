import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Role } from '../common/enums';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

/** What is signed into the access token. The role is re-read from storage on every request anyway. */
export interface JwtPayload {
  sub: number;
  role: Role;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await hash(dto.password, this.config.get<number>('BCRYPT_ROUNDS') ?? 10);
    // the store refuses a duplicate email atomically (409), even if two registrations race
    const user = await this.users.createRequester({ fullName: dto.fullName, email: dto.email, passwordHash });
    return this.users.toPublic(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    // same message for an unknown email and a wrong password, so emails cannot be discovered
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const payload: JwtPayload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN'),
      user: this.users.toPublic(user),
    };
  }
}
