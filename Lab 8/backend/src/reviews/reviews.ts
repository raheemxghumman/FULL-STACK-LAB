import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";
import { Auth, CurrentUser } from "../auth/auth.decorators.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ProductsService } from "../catalog/products.service.js";
import { DatabaseService } from "../database/database.service.js";
import type { PublicUser, Review } from "../database/types.js";
import { round1, todayISO } from "../common/security.js";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value);

/* ---------- DTOs ---------- */

export class CreateReviewDto {
  @ApiProperty({ example: "p6" })
  @IsString()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsInt({ message: "Rating must be a whole number." }) @Min(1, { message: "Rating must be at least 1." }) @Max(5, { message: "Rating must be at most 5." })
  rating: number;

  @ApiProperty({ example: "Sara Malik" })
  @Transform(trim) @IsString() @Length(2, 40, { message: "Name must be 2 to 40 characters." })
  name: string;

  @ApiProperty({ example: "The chai mugs arrived safely and look even better in person." })
  @Transform(trim) @IsString() @Length(10, 500, { message: "Review must be 10 to 500 characters." })
  text: string;
}

export class ReviewQueryDto {
  @ApiPropertyOptional({ example: "p1" })
  @IsOptional() @IsString()
  productId?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number;
}

/* ---------- service ---------- */

@Injectable()
export class ReviewsService {
  constructor(private readonly db: DatabaseService, private readonly products: ProductsService) {}

  private newestFirst = (a: Review, b: Review) => b.created - a.created;

  list(query: ReviewQueryDto) {
    let list = this.db.data.reviews.slice().sort(this.newestFirst);
    if (query.productId) list = list.filter((r) => r.productId === query.productId);
    const total = list.length;
    if (query.limit) list = list.slice(0, query.limit);
    return { count: list.length, total, data: list };
  }

  /** Star distribution for the whole shop: the Lab 3 totals plus every review written since. */
  summary() {
    const buckets: Record<number, number> = { ...this.db.data.ratingBase };
    this.db.data.reviews.filter((r) => !r.seeded).forEach((r) => (buckets[r.rating] = (buckets[r.rating] || 0) + 1));
    let total = 0, sum = 0;
    for (let s = 1; s <= 5; s++) { total += buckets[s] || 0; sum += s * (buckets[s] || 0); }
    return { data: { buckets, total, avg: total ? round1(sum / total) : 0 } };
  }

  create(dto: CreateReviewDto, user: PublicUser | null) {
    const product = this.products.find(dto.productId, 422);
    const data = this.db.data;
    const review: Review = {
      id: `r${++data.counters.review}`, productId: product.id, name: dto.name, rating: dto.rating, text: dto.text,
      city: user ? user.city : "", date: todayISO(), created: Date.now(), verified: Boolean(user), userId: user ? user.id : null
    };
    data.reviews.push(review);
    this.db.save();
    return { message: "Thanks! Your review was posted.", data: review, product: this.products.present(product) };
  }

  remove(id: string) {
    const review = this.db.data.reviews.find((r) => r.id === id);
    if (!review) throw new NotFoundException(`Review "${id}" not found.`);
    this.db.data.reviews = this.db.data.reviews.filter((r) => r !== review);
    this.db.save();
    return { message: "Review deleted.", data: review };
  }
}

/* ---------- controllers ---------- */

@ApiTags("Reviews")
@Controller("api/reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: "Reviews, newest first" })
  list(@Query() query: ReviewQueryDto) {
    return this.reviews.list(query);
  }

  @Get("summary")
  @ApiOperation({ summary: "1 to 5 star distribution for the whole shop" })
  summary() {
    return this.reviews.summary();
  }

  @Post()
  @Auth("optional")
  @ApiOperation({ summary: "Post a review (marked 'verified buyer' when logged in)" })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: PublicUser | null) {
    return this.reviews.create(dto, user);
  }

  @Delete(":id")
  @Auth("admin")
  @ApiOperation({ summary: "Delete a review (admin)" })
  remove(@Param("id") id: string) {
    return this.reviews.remove(id);
  }
}

@ApiTags("Reviews")
@Controller("api/products")
export class ProductReviewsController {
  constructor(private readonly reviews: ReviewsService, private readonly products: ProductsService) {}

  @Get(":id/reviews")
  @ApiOperation({ summary: "Reviews of one product" })
  forProduct(@Param("id") id: string) {
    this.products.find(id);
    return this.reviews.list({ productId: id });
  }
}

@Module({
  imports: [CatalogModule],
  controllers: [ReviewsController, ProductReviewsController],
  providers: [ReviewsService]
})
export class ReviewsModule {}
