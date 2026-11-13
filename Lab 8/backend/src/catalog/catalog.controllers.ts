import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOperation, ApiTags, ApiUnprocessableEntityResponse } from "@nestjs/swagger";
import { Auth } from "../auth/auth.decorators.js";
import { CATEGORIES, DELIVERY } from "../database/seed.js";
import { DatabaseService } from "../database/database.service.js";
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from "./product.dto.js";
import { ProductsService } from "./products.service.js";

@ApiTags("Products")
@Controller("api/products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "List products: filter by category, search, price range and stock; sort" })
  list(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "One product with its rating" })
  @ApiNotFoundResponse({ description: "No such product" })
  one(@Param("id") id: string) {
    return { data: this.products.present(this.products.find(id)) };
  }

  @Post()
  @Auth("admin")
  @ApiOperation({ summary: "Add a product (admin)" })
  @ApiUnprocessableEntityResponse({ description: "Invalid fields, listed in details" })
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Put(":id")
  @Auth("admin")
  @ApiOperation({ summary: "Replace a product (admin)" })
  replace(@Param("id") id: string, @Body() dto: CreateProductDto) {
    return this.products.update(id, dto, true);
  }

  @Patch(":id")
  @Auth("admin")
  @ApiOperation({ summary: "Change some fields of a product, e.g. the stock (admin)" })
  patch(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto, false);
  }

  @Delete(":id")
  @Auth("admin")
  @ApiOperation({ summary: "Remove a product, also from carts (admin). Past orders keep their copy." })
  remove(@Param("id") id: string) {
    return this.products.remove(id);
  }
}

@ApiTags("Catalogue")
@Controller("api")
export class CatalogController {
  constructor(private readonly db: DatabaseService) {}

  @Get("categories")
  @ApiOperation({ summary: "Product categories with how many products each has" })
  categories() {
    return {
      data: Object.entries(CATEGORIES).map(([key, label]) => ({ key, label, count: this.db.data.products.filter((p) => p.category === key).length }))
    };
  }

  @Get("delivery-options")
  @ApiOperation({ summary: "Delivery methods, fees and the free-delivery limit" })
  delivery() {
    return { data: DELIVERY };
  }
}
