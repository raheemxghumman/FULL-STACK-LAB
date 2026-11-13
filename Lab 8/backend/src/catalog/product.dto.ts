import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from "class-validator";
import { ART, CATEGORIES } from "../database/seed.js";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value);
export const SORTS = ["featured", "price-asc", "price-desc", "rating", "name", "newest"];

/* GET /api/products?category=&q=&sort=&minPrice=&maxPrice=&inStock= */
export class ProductQueryDto {
  @ApiPropertyOptional({ enum: ["all", ...Object.keys(CATEGORIES)] })
  @IsOptional() @IsIn(["all", ...Object.keys(CATEGORIES)], { message: `category must be one of: all, ${Object.keys(CATEGORIES).join(", ")}.` })
  category?: string;

  @ApiPropertyOptional({ description: "Words to search in the name, category and description", example: "blue vase" })
  @IsOptional() @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: SORTS, default: "featured" })
  @IsOptional() @IsIn(SORTS, { message: `sort must be one of: ${SORTS.join(", ")}.` })
  sort?: string;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional() @Type(() => Number) @IsNumber({}, { message: "minPrice must be a number." })
  minPrice?: number;

  @ApiPropertyOptional({ example: 6000 })
  @IsOptional() @Type(() => Number) @IsNumber({}, { message: "maxPrice must be a number." })
  maxPrice?: number;

  @ApiPropertyOptional({ enum: ["true", "false"], description: "true = only products that are in stock" })
  @IsOptional() @IsIn(["true", "false"])
  inStock?: string;
}

/* POST and PUT /api/products (admin) */
export class CreateProductDto {
  @ApiProperty({ example: "Kashi Pen Holder" })
  @Transform(trim) @IsString() @Length(3, 80, { message: "Name must be 3 to 80 characters." })
  name: string;

  @ApiProperty({ enum: Object.keys(CATEGORIES), example: "tableware" })
  @IsIn(Object.keys(CATEGORIES), { message: `Category must be one of: ${Object.keys(CATEGORIES).join(", ")}.` })
  category: string;

  @ApiProperty({ example: 900, description: "PKR, whole rupees" })
  @IsInt({ message: "Price must be a whole number." }) @Min(1) @Max(1000000)
  price: number;

  @ApiPropertyOptional({ example: 1100, description: "Price before the sale; must be higher than price" })
  @IsOptional() @IsInt() @Min(1) @Max(1000000)
  oldPrice?: number | null;

  @ApiProperty({ example: 15 })
  @IsInt({ message: "Stock must be a whole number." }) @Min(0) @Max(10000)
  stock: number;

  @ApiProperty({ example: "A small hand-painted pen holder for the study table." })
  @Transform(trim) @IsString() @Length(10, 600, { message: "Description must be 10 to 600 characters." })
  description: string;

  @ApiPropertyOptional({ enum: ART, default: "a-plate", description: "Which SVG picture of the store to use" })
  @IsOptional() @IsIn(ART)
  art?: string;

  @ApiPropertyOptional({ example: "#e6ecf7" })
  @IsOptional() @Matches(/^#[0-9a-f]{6}$/i, { message: "Background colour must look like #e6ecf7." })
  bg?: string;
}

/* PATCH /api/products/:id (admin): any of the fields above */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
