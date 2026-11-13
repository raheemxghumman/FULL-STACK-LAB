import { Module } from "@nestjs/common";
import { CatalogController, ProductsController } from "./catalog.controllers.js";
import { ProductsService } from "./products.service.js";

@Module({
  controllers: [ProductsController, CatalogController],
  providers: [ProductsService],
  exports: [ProductsService]
})
export class CatalogModule {}
