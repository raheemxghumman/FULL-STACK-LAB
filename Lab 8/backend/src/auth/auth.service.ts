import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { publicUser, PublicUser, User } from "../database/types.js";
import { hashPassword, randomId, todayISO, verifyPassword } from "../common/security.js";
import { LoginDto, SignupDto } from "./auth.dto.js";

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService) {}

  /** The user a token belongs to, or null if it is unknown or expired. */
  userForToken(token: string): PublicUser | null {
    const session = this.db.data.sessions.find((s) => s.token === token && s.expires > Date.now());
    const user = session && this.db.data.users.find((u) => u.id === session.userId);
    return user ? publicUser(user) : null;
  }

  private startSession(user: User, days: number) {
    const now = Date.now();
    const data = this.db.data;
    data.sessions = data.sessions.filter((s) => s.expires > now);   // tidy up expired logins
    const session = { token: randomId(), userId: user.id, created: now, expires: now + days * DAY };
    data.sessions.push(session);
    this.db.save();
    return { token: session.token, expires: new Date(session.expires).toISOString(), user: publicUser(user) };
  }

  async signup(dto: SignupDto) {
    const taken = () => this.db.data.users.some((u) => u.email === dto.email);
    const conflict = () => new ConflictException({
      error: "An account with this email already exists. Log in instead.",
      details: [{ field: "email", message: "Already registered." }]
    });
    if (taken()) throw conflict();
    const passHash = await hashPassword(dto.password);
    if (taken()) throw conflict();   // checked again: another signup may have finished while hashing
    const data = this.db.data;
    const user: User = { id: `u${++data.counters.user}`, name: dto.name, email: dto.email, phone: dto.phone, city: dto.city, role: "customer", passHash, created: todayISO() };
    data.users.push(user);
    return { message: `Welcome, ${user.name.split(" ")[0]}! Your account is ready.`, data: this.startSession(user, 30) };
  }

  async login(dto: LoginDto) {
    const user = this.db.data.users.find((u) => u.email === dto.email);
    // the same message for an unknown email and a wrong password, so emails cannot be guessed this way
    if (!user || !(await verifyPassword(dto.password, user.passHash))) {
      throw new UnauthorizedException("That email and password do not match an account.");
    }
    return { message: "Logged in.", data: this.startSession(user, dto.remember ? 30 : 1) };
  }

  logout(token: string) {
    this.db.data.sessions = this.db.data.sessions.filter((s) => s.token !== token);
    this.db.save();
    return { message: "Logged out." };
  }

  emailAvailable(email: string) {
    return { data: { email, available: !this.db.data.users.some((u) => u.email === email) } };
  }
}
