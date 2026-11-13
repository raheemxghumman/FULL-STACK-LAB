import { Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Put, UnprocessableEntityException } from "@nestjs/common";
import { ApiConflictResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ProductsService } from "../catalog/products.service.js";
import { DatabaseService } from "../database/database.service.js";
import { COUPONS, DELIVERY } from "../database/seed.js";
import type { Cart } from "../database/types.js";
import { randomId } from "../common/security.js";

/* ---------- DTOs ---------- */

export class AddItemDto {
  @ApiProperty({ example: "p9" })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: "Never goes above the stock" })
  @IsOptional() @IsInt({ message: "Quantity must be a whole number." }) @Min(1) @Max(1000)
  qty?: number;
}

export class SetQtyDto {
  @ApiProperty({ example: 2, description: "From 1 to the product's stock" })
  @IsInt({ message: "Quantity must be a whole number." })
  qty: number;
}

export class CouponDto {
  @ApiProperty({ example: "MULTAN10", description: "MULTAN10 = 10% off, KASHI500 = PKR 500 off orders over PKR 3,000" })
  @IsString() @MaxLength(20)
  code: string;
}

/* ---------- service ---------- */

export interface CartLine {
  id: string;
  qty: number;
  product: ReturnType<ProductsService["present"]>;
  lineTotal: number;
}

@Injectable()
export class CartsService {
  constructor(private readonly db: DatabaseService, private readonly products: ProductsService) {}

  find(id: string): Cart {
    const cart = this.db.data.carts.find((c) => c.id === id);
    if (!cart) throw new NotFoundException("Cart not found. Create a new one with POST /api/carts.");
    return cart;
  }

  /** Drops products that were deleted or sold out, and lowers quantities above the stock. */
  tidy(cart: Cart) {
    let changed = false;
    cart.items = cart.items.filter((item) => {
      const p = this.db.data.products.find((x) => x.id === item.productId);
      if (!p || p.stock <= 0) { changed = true; return false; }
      if (item.qty > p.stock) { item.qty = p.stock; changed = true; }
      return true;
    });
    if (changed) this.db.save();
  }

  private discount(code: string, subtotal: number) {
    const c = COUPONS[code];
    if (!c || subtotal <= 0 || (c.min && subtotal < c.min)) return 0;
    return c.type === "percent" ? Math.round((subtotal * c.value) / 100) : Math.min(c.value, subtotal);
  }

  /** All money maths lives here, so the cart, the checkout and the order always agree. */
  totals(lines: CartLine[], code: string, method: string) {
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const discount = code ? this.discount(code, subtotal) : 0;
    const d = DELIVERY[method];
    const delivery = subtotal > 0 ? (d.freeOver && subtotal >= d.freeOver ? 0 : d.fee) : 0;
    return {
      method, subtotal, discount, delivery,
      total: Math.max(0, subtotal - discount + delivery),
      count: lines.reduce((s, l) => s + l.qty, 0),
      coupon: code || "",
      couponLabel: code && COUPONS[code] ? COUPONS[code].label : "",
      couponInactive: Boolean(code) && discount === 0,
      freeDeliveryGap: Math.max(0, (DELIVERY.standard.freeOver || 0) - subtotal)
    };
  }

  present(cart: Cart) {
    const lines: CartLine[] = cart.items.map((item) => {
      const product = this.products.present(this.products.find(item.productId));
      return { id: product.id, qty: item.qty, product, lineTotal: product.price * item.qty };
    });
    return {
      id: cart.id,
      lines,
      coupon: cart.coupon,
      count: lines.reduce((s, l) => s + l.qty, 0),
      totals: Object.fromEntries(Object.keys(DELIVERY).map((m) => [m, this.totals(lines, cart.coupon, m)])),
      updated: cart.updated
    };
  }

  private touch(cart: Cart) {
    cart.updated = new Date().toISOString();
    this.db.save();
  }

  create() {
    const now = new Date().toISOString();
    const cart: Cart = { id: randomId(), items: [], coupon: "", created: now, updated: now };
    this.db.data.carts.push(cart);
    this.db.save();
    return { message: "Cart created.", data: this.present(cart) };
  }

  get(id: string) {
    const cart = this.find(id);
    this.tidy(cart);   // the stock may have fallen since the item was added
    return { data: this.present(cart) };
  }

  add(id: string, dto: AddItemDto) {
    const cart = this.find(id);
    const product = this.products.find(dto.productId, 422);
    const want = dto.qty ?? 1;
    const line = cart.items.find((i) => i.productId === product.id);
    const current = line ? line.qty : 0;
    if (product.stock === 0) throw new ConflictException(`${product.name} is sold out.`);
    if (current >= product.stock) throw new ConflictException(`You already have all ${product.stock} available in your cart.`);
    const next = Math.min(product.stock, current + want);
    if (line) line.qty = next; else cart.items.push({ productId: product.id, qty: next });
    this.touch(cart);
    const capped = current + want > product.stock;
    return { message: `${product.name} × ${next - current} added${capped ? " (limited by stock)" : ""}.`, added: next - current, capped, data: this.present(cart) };
  }

  setQty(id: string, productId: string, qty: number) {
    const cart = this.find(id);
    const line = cart.items.find((i) => i.productId === productId);
    if (!line) throw new NotFoundException("That item is not in your cart.");
    const product = this.products.find(productId);
    if (qty < 1 || qty > product.stock) {
      throw new UnprocessableEntityException({ error: `Enter a quantity from 1 to ${product.stock}.`, details: [{ field: "qty", message: `1 to ${product.stock} only.` }] });
    }
    line.qty = qty;
    this.touch(cart);
    return { message: "Quantity updated.", data: this.present(cart) };
  }

  removeItem(id: string, productId: string) {
    const cart = this.find(id);
    if (!cart.items.some((i) => i.productId === productId)) throw new NotFoundException("That item is not in your cart.");
    cart.items = cart.items.filter((i) => i.productId !== productId);
    this.touch(cart);
    return { message: "Item removed.", data: this.present(cart) };
  }

  clear(id: string) {
    const cart = this.find(id);
    cart.items = [];
    cart.coupon = "";
    this.touch(cart);
    return { message: "Cart cleared.", data: this.present(cart) };
  }

  applyCoupon(id: string, raw: string) {
    const cart = this.find(id);
    const code = String(raw || "").trim().toUpperCase();
    const fail = (msg: string) => new UnprocessableEntityException({ error: msg, details: [{ field: "code", message: msg }] });
    if (!code) throw fail("Enter a coupon code first.");
    const coupon = COUPONS[code];
    if (!coupon) throw fail(`“${code}” is not a valid coupon.`);
    const subtotal = this.present(cart).totals.standard.subtotal;
    if (coupon.min && subtotal < coupon.min) throw fail(`${code} works on orders of PKR ${coupon.min.toLocaleString("en-US")} or more.`);
    cart.coupon = code;
    this.touch(cart);
    return { message: `${code} applied: ${coupon.label}.`, data: this.present(cart) };
  }

  removeCoupon(id: string) {
    const cart = this.find(id);
    cart.coupon = "";
    this.touch(cart);
    return { message: "Coupon removed.", data: this.present(cart) };
  }
}

/* ---------- controller ---------- */

@ApiTags("Cart")
@Controller("api/carts")
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Post()
  @ApiOperation({ summary: "Start a new, empty cart (the browser keeps its id)" })
  create() {
    return this.carts.create();
  }

  @Get(":id")
  @ApiOperation({ summary: "A cart with its lines and the totals for each delivery method" })
  get(@Param("id") id: string) {
    return this.carts.get(id);
  }

  @Post(":id/items")
  @HttpCode(200)
  @ApiOperation({ summary: "Add a product (never more than the stock)" })
  @ApiConflictResponse({ description: "Already at the stock limit, or sold out" })
  add(@Param("id") id: string, @Body() dto: AddItemDto) {
    return this.carts.add(id, dto);
  }

  @Patch(":id/items/:productId")
  @ApiOperation({ summary: "Set the quantity of one line (1 to the stock)" })
  setQty(@Param("id") id: string, @Param("productId") productId: string, @Body() dto: SetQtyDto) {
    return this.carts.setQty(id, productId, dto.qty);
  }

  @Delete(":id/items/:productId")
  @ApiOperation({ summary: "Remove one line" })
  removeItem(@Param("id") id: string, @Param("productId") productId: string) {
    return this.carts.removeItem(id, productId);
  }

  @Delete(":id/items")
  @ApiOperation({ summary: "Empty the cart and remove the coupon" })
  clear(@Param("id") id: string) {
    return this.carts.clear(id);
  }

  @Put(":id/coupon")
  @ApiOperation({ summary: "Apply a coupon code" })
  applyCoupon(@Param("id") id: string, @Body() dto: CouponDto) {
    return this.carts.applyCoupon(id, dto.code);
  }

  @Delete(":id/coupon")
  @ApiOperation({ summary: "Remove the coupon" })
  removeCoupon(@Param("id") id: string) {
    return this.carts.removeCoupon(id);
  }
}

@Module({
  imports: [CatalogModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService]
})
export class CartsModule {}
