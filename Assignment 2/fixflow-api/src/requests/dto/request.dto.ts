import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { LIMITS, Priority, RequestStatus } from '../../common/enums';
import { toInteger, trimText } from '../../common/transformers';

/**
 * Body of POST /api/requests. The server supplies id, requesterId (from the token), status OPEN,
 * timestamps and history; sending any of those (or any unknown field) is rejected with 400.
 */
export class CreateRequestDto {
  /** 5-100 characters. @example "Projector flickering in Room A-12" */
  @Transform(trimText) @IsString()
  @Length(5, 100, { message: 'title must be 5-100 characters (after trimming).' })
  title: string;

  /** 20-1000 characters. @example "The projector flickers every few seconds and then switches off." */
  @Transform(trimText) @IsString()
  @Length(20, 1000, { message: 'description must be 20-1000 characters (after trimming).' })
  description: string;

  /** An active category id (JSON integer). @example 3 */
  @IsInt({ message: 'categoryId must be an integer.' }) @Min(1, { message: 'categoryId must be a positive integer.' })
  categoryId: number;

  /** 2-80 characters. @example "Academic Block A" */
  @Transform(trimText) @IsString()
  @Length(2, 80, { message: 'building must be 2-80 characters (after trimming).' })
  building: string;

  /** 1-30 characters. @example "A-12" */
  @Transform(trimText) @IsString()
  @Length(1, 30, { message: 'room must be 1-30 characters (after trimming).' })
  room: string;

  /** LOW, MEDIUM or HIGH. @example "HIGH" */
  @IsEnum(Priority, { message: 'priority must be one of: LOW, MEDIUM, HIGH.' })
  priority: Priority;
}

/**
 * Body of PATCH /api/requests/:id. Same rules as creation, every field optional, at least one
 * required (NonEmptyBodyPipe). status, requesterId, assignedTechnicianId, timestamps and history
 * are not fields of this class, so the ValidationPipe rejects them with 400.
 */
export class UpdateRequestDto {
  @IsOptional() @Transform(trimText) @IsString()
  @Length(5, 100, { message: 'title must be 5-100 characters (after trimming).' })
  title?: string;

  @IsOptional() @Transform(trimText) @IsString()
  @Length(20, 1000, { message: 'description must be 20-1000 characters (after trimming).' })
  description?: string;

  @IsOptional() @IsInt({ message: 'categoryId must be an integer.' }) @Min(1, { message: 'categoryId must be a positive integer.' })
  categoryId?: number;

  @IsOptional() @Transform(trimText) @IsString()
  @Length(2, 80, { message: 'building must be 2-80 characters (after trimming).' })
  building?: string;

  @IsOptional() @Transform(trimText) @IsString()
  @Length(1, 30, { message: 'room must be 1-30 characters (after trimming).' })
  room?: string;

  @IsOptional() @IsEnum(Priority, { message: 'priority must be one of: LOW, MEDIUM, HIGH.' })
  priority?: Priority;
}

/** Query of GET /api/requests. Numbers are converted explicitly (toInteger) and range-checked. */
export class ListRequestsQueryDto {
  /** Case-insensitive search in the title. @example "projector" */
  @IsOptional() @Transform(trimText) @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @Transform(toInteger)
  @IsInt({ message: 'categoryId must be an integer.' }) @Min(1, { message: 'categoryId must be a positive integer.' })
  categoryId?: number;

  @IsOptional() @IsEnum(RequestStatus, { message: `status must be one of: ${Object.values(RequestStatus).join(', ')}.` })
  status?: RequestStatus;

  @IsOptional() @IsEnum(Priority, { message: 'priority must be one of: LOW, MEDIUM, HIGH.' })
  priority?: Priority;

  /** Default 1. */
  @IsOptional() @Transform(toInteger)
  @IsInt({ message: 'page must be an integer.' }) @Min(1, { message: 'page must be at least 1.' })
  page?: number;

  /** Default 10, maximum 50. */
  @IsOptional() @Transform(toInteger)
  @IsInt({ message: 'limit must be an integer.' }) @Min(1, { message: 'limit must be between 1 and 50.' })
  @Max(LIMITS.maxLimit, { message: 'limit must be between 1 and 50.' })
  limit?: number;
}

export class AssignRequestDto {
  /** Id of an existing technician who supports the request's category. @example 5 */
  @IsInt({ message: 'technicianId must be an integer.' }) @Min(1, { message: 'technicianId must be a positive integer.' })
  technicianId: number;
}

export class ResolveRequestDto {
  /** 20-1000 characters. @example "Replaced the faulty HDMI cable and tested the projector." */
  @Transform(trimText) @IsString()
  @Length(20, 1000, { message: 'resolutionNote must be 20-1000 characters (after trimming).' })
  resolutionNote: string;
}

export class ReopenRequestDto {
  /** 10-500 characters. @example "The projector is flickering again." */
  @Transform(trimText) @IsString()
  @Length(10, 500, { message: 'reason must be 10-500 characters (after trimming).' })
  reason: string;
}

export class FeedbackDto {
  /** Whole number from 1 to 5. @example 5 */
  @IsInt({ message: 'rating must be an integer from 1 to 5.' })
  @Min(1, { message: 'rating must be an integer from 1 to 5.' }) @Max(5, { message: 'rating must be an integer from 1 to 5.' })
  rating: number;

  /** Optional, up to 500 characters. @example "Fixed quickly and politely." */
  @IsOptional() @Transform(trimText) @IsString()
  @Length(1, 500, { message: 'comment must be 1-500 characters (after trimming) when given.' })
  comment?: string;
}
