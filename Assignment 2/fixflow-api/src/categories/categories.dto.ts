import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { trimText } from '../common/transformers';

export class CreateCategoryDto {
  /** Unique (case-insensitive), 3-50 characters. @example "Carpentry" */
  @Transform(trimText)
  @IsString()
  @Length(3, 50, { message: 'name must be 3-50 characters (after trimming).' })
  name: string;

  /** 10-300 characters. @example "Wooden fittings, shelves and notice boards." */
  @Transform(trimText)
  @IsString()
  @Length(10, 300, { message: 'description must be 10-300 characters (after trimming).' })
  description: string;

  /** A real JSON boolean ("true" as text is rejected). Defaults to true. */
  @IsOptional()
  @IsBoolean({ message: 'active must be a boolean (true or false), not text.' })
  active?: boolean;
}

/**
 * PATCH body: any of the fields, validated exactly like creation. Send { "active": false } to
 * deactivate. An empty body is rejected by NonEmptyBodyPipe.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(3, 50, { message: 'name must be 3-50 characters (after trimming).' })
  name?: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @Length(10, 300, { message: 'description must be 10-300 characters (after trimming).' })
  description?: string;

  @IsOptional()
  @IsBoolean({ message: 'active must be a boolean (true or false), not text.' })
  active?: boolean;
}

export class ListCategoriesQueryDto {
  /** Dispatchers only: "true" also lists deactivated categories. */
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'includeInactive must be "true" or "false".' })
  includeInactive?: 'true' | 'false';
}
