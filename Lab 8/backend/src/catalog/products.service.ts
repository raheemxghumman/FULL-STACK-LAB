import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";
import { Product } from "../database/types.js";
import { CATEGORIES } from "../database/seed.js";
import { round1 } from "../common/security.js";
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from "./product.dto.js";

export type PublicProduct = Omit<Product, "baseRating" | "baseReviewCount"> & { rating: { avg: number; count: number } };

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}

  find(id: string, status: 404 | 422 = 404): Product {
    const product = this.db.data.products.find((p) => p.id === id);
    if (product) return product;
    if (status === 422) {
      throw new UnprocessableEntityException({ error: `Product "${id}" does not exist.`, details: [{ field: "productId", message: "Unknown product." }] });
    }
    throw new NotFoundException(`Product "${id}" does not exist.`);
  }

  /** The catalogue rating from Lab 3 plus every review written through the API. */
  present(p: Product): PublicProduct {
    const extra = this.db.data.reviews.filter((r) => r.productId === p.id && !r.seeded);
    const count = p.baseReviewCount + extra.length;
    const sum = p.baseRating * p.baseReviewCount + extra.reduce((s, r) => s + r.rating, 0);
    const { baseRating, baseReviewCount, ...rest } = p;
    return { ...rest, rating: { avg: count ? round1(sum / count) : 0, count } };
  }

  list(query: ProductQueryDto) {
    let list = this.db.data.products.map((p) => this.present(p));
    if (query.category && query.category !== "all") list = list.filter((p) => p.category === query.category);
    const q = (query.q || "").trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const haystack = `${p.name} ${CATEGORIES[p.category]} ${p.description}`.toLowerCase();
        return q.split(/\s+/).every((word) => haystack.includes(word));
      });
    }
    if (query.minPrice !== undefined) list = list.filter((p) => p.price >= query.minPrice!);
    if (query.maxPrice !== undefined) list = list.filter((p) => p.price <= query.maxPrice!);
    if (query.inStock === "true") list = list.filter((p) => p.stock > 0);
    const sorts: Record<string, ((a: PublicProduct, b: PublicProduct) => number) | null> = {
      featured: null,
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      rating: (a, b) => b.rating.avg - a.rating.avg,
      name: (a, b) => a.name.localeCompare(b.name),
      newest: (a, b) => b.created.localeCompare(a.created)
    };
    const sorter = sorts[query.sort || "featured"];
    if (sorter) list.sort(sorter);
    return { count: list.length, total: this.db.data.products.length, data: list };
  }

  private checkOldPrice(price: number, oldPrice: number | null | undefined) {
    if (oldPrice !== undefined && oldPrice !== null && oldPrice <= price) {
      throw new UnprocessableEntityException({ error: "1 field is invalid.", details: [{ field: "oldPrice", message: "Old price must be higher than the price." }] });
    }
  }

  create(dto: CreateProductDto) {
    this.checkOldPrice(dto.price, dto.oldPrice);
    const data = this.db.data;
    const now = new Date().toISOString();
    const product: Product = {
      id: `p${++data.counters.product}`, name: dto.name, category: dto.category, price: dto.price, oldPrice: dto.oldPrice ?? null,
      stock: dto.stock, art: dto.art ?? "a-plate", bg: dto.bg ?? "#e6ecf7", description: dto.description,
      baseRating: 0, baseReviewCount: 0, created: now, updated: now
    };
    data.products.push(product);
    this.db.save();
    return { message: `${product.name} was added to the catalogue.`, data: this.present(product) };
  }

  /** PUT sends every field (CreateProductDto), PATCH only the ones to change. */
  update(id: string, dto: CreateProductDto | UpdateProductDto, replace: boolean) {
    const product = this.find(id);
    const next = replace ? { art: "a-plate", bg: "#e6ecf7", oldPrice: null, ...dto } : { ...product, ...dto };
    this.checkOldPrice(next.price!, next.oldPrice);
    Object.assign(product, next, { id: product.id, oldPrice: next.oldPrice ?? null, updated: new Date().toISOString() });
    this.db.save();
    return { message: `${product.name} was updated.`, data: this.present(product) };
  }

  remove(id: string) {
    const product = this.find(id);
    const data = this.db.data;
    data.products = data.products.filter((p) => p.id !== id);
    const reviewsBefore = data.reviews.length;
    data.reviews = data.reviews.filter((r) => r.productId !== id);
    let carts = 0;
    for (const cart of data.carts) {
      const before = cart.items.length;
      cart.items = cart.items.filter((i) => i.productId !== id);
      if (cart.items.length !== before) carts++;
    }
    this.db.save();
    return {
      message: `${product.name} was removed (also from ${carts} cart${carts === 1 ? "" : "s"}; ${reviewsBefore - data.reviews.length} reviews deleted). Past orders keep their copy.`,
      data: this.present(product)
    };
  }
}
