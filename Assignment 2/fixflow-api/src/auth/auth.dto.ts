import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { normaliseEmail, trimText } from '../common/transformers';

/**
 * Public registration. Only these three fields are accepted: the global ValidationPipe
 * (whitelist + forbidNonWhitelisted) rejects "role", "id" or any other field with 400.
 */
export class RegisterDto {
  /** @example "Hamza Ali" */
  @Transform(trimText)
  @IsString()
  @Length(3, 80, { message: 'fullName must be 3-80 characters (after trimming).' })
  fullName: string;

  /** @example "hamza@fixflow.test" */
  @Transform(normaliseEmail)
  @IsString()
  @IsEmail({}, { message: 'email must be a valid email address.' })
  @MaxLength(254)
  email: string;

  /** 8-72 characters with at least one letter and one digit. Not trimmed or changed. @example "Campus2026" */
  @IsString()
  @Length(8, 72, { message: 'password must be 8-72 characters.' })
  @Matches(/[A-Za-z]/, { message: 'password must contain at least one letter.' })
  @Matches(/\d/, { message: 'password must contain at least one digit.' })
  password: string;
}

export class LoginDto {
  /** @example "ali@fixflow.test" */
  @Transform(normaliseEmail)
  @IsString()
  @IsEmail({}, { message: 'email must be a valid email address.' })
  email: string;

  /** @example "Requester2026" */
  @IsString()
  @Length(1, 72, { message: 'password is required.' })
  password: string;
}
