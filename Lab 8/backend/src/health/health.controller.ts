import { Controller, Get, Redirect } from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "../database/database.service.js";

/* Filled in by main.ts from the OpenAPI document, so GET /api always matches the real routes. */
export const apiIndex: { endpoints: { method: string; path: string; summary: string }[] } = { endpoints: [] };

@ApiTags("General")
@Controller()
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  @Redirect("/store/", 302)
  @ApiExcludeEndpoint()
  home() {}

  @Get("health")
  @ApiOperation({ summary: "Server status, where the data is saved, record counts" })
  health() {
    const d = this.db.data;
    return {
      status: "ok",
      service: "kashi-ghar-api",
      framework: "NestJS",
      storage: `file (${this.db.label})`,
      counts: { products: d.products.length, users: d.users.length, carts: d.carts.length, orders: d.orders.length, reviews: d.reviews.length },
      lastChange: d.updatedAt
    };
  }

  @Get("api")
  @ApiOperation({ summary: "Every endpoint of this API (full documentation at /docs)" })
  index() {
    return { name: "Kashi Ghar store API (NestJS)", docs: "/docs", openapi: "/docs-json", endpoints: apiIndex.endpoints };
  }
}
