import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { CartsModule } from "./carts/carts.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { OrdersModule } from "./orders/orders.js";
import { ReviewsModule } from "./reviews/reviews.js";

/*
 * The root module: one feature module per part of the store.
 *
 *   DatabaseModule  data/db.json (global)       AuthModule     signup, login, tokens, AuthGuard
 *   CatalogModule   products, categories        ReviewsModule  reviews and star summary
 *   CartsModule     carts, quantities, coupons  OrdersModule   checkout, order history, cancel
 */
@Module({
  imports: [DatabaseModule, AuthModule, CatalogModule, ReviewsModule, CartsModule, OrdersModule],
  controllers: [HealthController]
})
export class AppModule {}
