import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { traceStage } from './request-context';

/**
 * Equivalent of ParseIntPipe for route ids, applied at parameter scope:
 *   @Param('id', ParsePositiveIntPipe) id: number
 * Runs before the controller and accepts only a whole number of 1 or more written with digits
 * ("12"). It rejects "abc", "1.5", "0", "-3", "1e3" and " 7" with 400.
 */
@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const name = metadata.data ?? 'id';
    if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value) || !Number.isSafeInteger(Number(value))) {
      traceStage('4 pipe', `ParsePositiveIntPipe(${name}) -> rejected "${value}" (400)`);
      throw new BadRequestException(`${name} must be a positive integer (got "${value}").`);
    }
    traceStage('4 pipe', `ParsePositiveIntPipe(${name}) -> "${value}" became ${Number(value)}`);
    return Number(value);
  }
}

/** Options required by the assignment: transform, whitelist and forbidNonWhitelisted. */
export const VALIDATION_OPTIONS: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  // numbers are converted explicitly in the DTOs (see common/transformers.ts), never implicitly
  transformOptions: { enableImplicitConversion: false },
  stopAtFirstError: false,
};

/**
 * The global ValidationPipe (registered with APP_PIPE). It behaves exactly like ValidationPipe with
 * the options above; it only adds lifecycle-trace lines for the instrumented route.
 */
@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super(VALIDATION_OPTIONS);
  }

  override async transform(value: unknown, metadata: ArgumentMetadata) {
    // Route params are parsed only by ParsePositiveIntPipe (param scope). Without this, the global
    // pipe's primitive conversion would already turn "1.5" into 1.5 or "0x10" into 16 before it runs.
    if (metadata.type === 'param') return value;
    const target = metadata.metatype?.name ?? 'value';
    try {
      const result = await super.transform(value, metadata);
      if (metadata.type === 'body') traceStage('4 pipe', `ValidationPipe(${target}) -> body valid, transformed to ${target}`);
      return result;
    } catch (err) {
      traceStage('4 pipe', `ValidationPipe(${target}) -> invalid ${metadata.type} (400)`);
      throw err;
    }
  }
}

/** Rejects update bodies with no fields: @Body(NonEmptyBodyPipe) dto: UpdateXDto */
@Injectable()
export class NonEmptyBodyPipe implements PipeTransform {
  transform(value: unknown) {
    const hasField = value && typeof value === 'object' && Object.values(value).some((v) => v !== undefined);
    if (!hasField) throw new BadRequestException('The request body must contain at least one field to update.');
    return value;
  }
}
