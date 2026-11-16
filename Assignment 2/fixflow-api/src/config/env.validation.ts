import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

/** Environment variables, checked once at start-up. The app refuses to start without a JWT secret. */
class EnvironmentVariables {
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(65535)
  PORT: number = 3000;

  @IsString() @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters (see .env.example)' })
  JWT_SECRET: string;

  @IsOptional() @IsString() @Matches(/^\d+$|^\d+(ms|s|m|h|d)$/, { message: 'JWT_EXPIRES_IN must be seconds or a value like 15m, 1h, 1d' })
  JWT_EXPIRES_IN: string = '1h';

  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(4) @Max(15)
  BCRYPT_ROUNDS: number = 10;

  @IsOptional() @IsString()
  SEED_FILE: string = 'data/seed.json';

  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean()
  LIFECYCLE_TRACE: boolean = false;
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Invalid configuration:\n${errors.flatMap((e) => Object.values(e.constraints ?? {})).join('\n')}`);
  }
  return env;
}
