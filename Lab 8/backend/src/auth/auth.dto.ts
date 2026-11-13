import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from "class-validator";
import { CITIES } from "../database/seed.js";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value);
const lower = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toLowerCase() : value);

export const PHONE_RE = /^(\+92|0)3\d{9}$/;
export const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;

export class SignupDto {
  @ApiProperty({ example: "Sara Malik" })
  @Transform(trim) @IsString() @Length(3, 60, { message: "Name must be 3 to 60 characters." })
  @Matches(NAME_RE, { message: "Name may only contain letters, spaces and . ' -" })
  name: string;

  @ApiProperty({ example: "sara@example.com" })
  @Transform(lower) @IsEmail({}, { message: "Email must be a valid email address." }) @MaxLength(80)
  email: string;

  @ApiProperty({ example: "03211234567" })
  @Transform(trim) @IsString() @Matches(PHONE_RE, { message: "Phone must be a Pakistani mobile number, e.g. 03001234567." })
  phone: string;

  @ApiProperty({ enum: CITIES, example: "Lahore" })
  @IsIn(CITIES, { message: `City must be one of: ${CITIES.join(", ")}.` })
  city: string;

  @ApiProperty({ example: "Kashi#2026", minLength: 8 })
  @IsString() @MinLength(8, { message: "Password must be at least 8 characters." }) @MaxLength(128)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: "demo@kashighar.pk" })
  @Transform(lower) @IsEmail({}, { message: "Email must be a valid email address." })
  email: string;

  @ApiProperty({ example: "demo1234" })
  @IsString() @MinLength(1, { message: "Password is required." }) @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ description: "Keep the login for 30 days instead of 1", default: false })
  @IsOptional() @IsBoolean()
  remember?: boolean;
}

export class EmailQueryDto {
  @ApiProperty({ example: "demo@kashighar.pk" })
  @Transform(lower) @IsEmail({}, { message: "Send a valid ?email= to check." })
  email: string;
}
