import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { ApiConflictResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { Auth, CurrentToken, CurrentUser } from "./auth.decorators.js";
import { EmailQueryDto, LoginDto, SignupDto } from "./auth.dto.js";
import { AuthService } from "./auth.service.js";
import type { PublicUser } from "../database/types.js";

@ApiTags("Accounts")
@Controller("api/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("signup")
  @ApiOperation({ summary: "Create an account; returns a login token" })
  @ApiConflictResponse({ description: "The email already has an account" })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Log in; returns a login token (send it as Authorization: Bearer <token>)" })
  @ApiUnauthorizedResponse({ description: "Wrong email or password" })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get("me")
  @Auth("user")
  @ApiOperation({ summary: "The logged-in account" })
  me(@CurrentUser() user: PublicUser) {
    return { data: user };
  }

  @Post("logout")
  @HttpCode(200)
  @Auth("user")
  @ApiOperation({ summary: "End this login (the token stops working)" })
  logout(@CurrentToken() token: string) {
    return this.auth.logout(token);
  }

  @Get("email-available")
  @ApiOperation({ summary: "Is this email still free for signup? Used by the signup form while typing" })
  emailAvailable(@Query() query: EmailQueryDto) {
    return this.auth.emailAvailable(query.email);
  }
}
