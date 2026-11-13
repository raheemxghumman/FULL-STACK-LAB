import { Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query, UnprocessableEntityException } from "@nestjs/common";
import { ApiConflictResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength, ValidateNested, IsDefined, IsEmail } from "class-validator";
import { Auth, CurrentUser } from "../auth/auth.decorators.js";
import { NAME_RE, PHONE_RE } from "../auth/auth.dto.js";
import { CartsModule, CartsService } from "../carts/carts.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { ProductsService } from "../catalog/products.service.js";
import { DatabaseService } from "../database/database.service.js";
import { CITIES, DELIVERY } from "../database/seed.js";
import type { Order, OrderStatus, PublicUser } from "../database/types.js";
import { todayISO } from "../common/security.js";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value);
const STATUSES: OrderStatus[] = ["Processing", "Shipped", "Delivered", "Cancelled"];

/* ---------- DTOs (nested objects are validated too) ---------- */

export class ContactDto {
  @ApiProperty({ example: "Sara Malik" })
  @Transform(trim) @IsString() @Length(3, 60, { message: "Name must be 3 to 60 characters." }) @Matches(NAME_RE, { message: "Name may only contain letters, spaces and . ' -" })
  name: string;

  @ApiProperty({ example: "sara@example.com" })
  @Transform(trim) @IsEmail({}, { message: "Email must be a valid email address." })
  email: string;

  @ApiProperty({ example: "03211234567" })
  @Transform(trim) @Matches(PHONE_RE, { message: "Phone must be a Pakistani mobile number, e.g. 03001234567." })
  phone: string;
}

export class ShippingDto {
  @ApiProperty({ example: "House 7, Street 9, Gulberg III" })
  @Transform(trim) @IsString() @Length(8, 120, { message: "Street address must be 8 to 120 characters." })
  address: string;

  @ApiPropertyOptional({ example: "Near Liberty Market" })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60)
  area?: string;

  @ApiProperty({ enum: CITIES, example: "Lahore" })
  @IsIn(CITIES, { message: "City must be one of the listed cities." })
  city: string;

  @ApiProperty({ example: "54000" })
  @Matches(/^\d{5}$/, { message: "Postal code must be 5 digits, e.g. 60000." })
  postal: string;
}

export class PaymentDto {
  @ApiProperty({ enum: ["cod", "wallet", "card"], example: "cod" })
  @IsIn(["cod", "wallet", "card"], { message: "Payment method must be cod, wallet or card." })
  method: string;

  @ApiPropertyOptional({ example: "JazzCash", description: "Wallet name (JazzCash or Easypaisa)" })
  @IsOptional() @IsString() @MaxLength(30)
  label?: string;

  @ApiPropertyOptional({ example: "0300****567", description: "Masked wallet number" })
  @IsOptional() @Matches(/^03\d{2}\*{4}\d{3}$/, { message: "Wallet account must be masked like 0300****567." })
  account?: string;

  @ApiPropertyOptional({ example: "4242", description: "Only the last 4 digits of a card. Full card numbers are refused." })
  @IsOptional() @Matches(/^\d{4}$/, { message: "Card last 4 must be 4 digits." })
  last4?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: "The id from POST /api/carts" })
  @IsString()
  cartId: string;

  @ApiPropertyOptional({ enum: Object.keys(DELIVERY), default: "standard" })
  @IsOptional() @IsIn(Object.keys(DELIVERY))
  deliveryMethod?: string;

  @ApiProperty({ type: ContactDto })
  @IsDefined({ message: "Contact details are required." }) @ValidateNested() @Type(() => ContactDto)
  contact: ContactDto;

  @ApiProperty({ type: ShippingDto })
  @IsDefined({ message: "Shipping details are required." }) @ValidateNested() @Type(() => ShippingDto)
  shipping: ShippingDto;

  @ApiProperty({ type: PaymentDto })
  @IsDefined({ message: "Payment details are required." }) @ValidateNested() @Type(() => PaymentDto)
  payment: PaymentDto;

  @ApiPropertyOptional({ example: "Please call before delivery." })
  @IsOptional() @IsString() @MaxLength(300)
  notes?: string;
}

export class OrderStatusDto {
  @ApiProperty({ enum: STATUSES, example: "Cancelled" })
  @IsIn(STATUSES, { message: `Status must be one of: ${STATUSES.join(", ")}.` })
  status: OrderStatus;
}

export class OrderQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional() @IsIn(STATUSES)
  status?: OrderStatus;
}

/* ---------- service ---------- */

@Injectable()
export class OrdersService {
  constructor(private readonly db: DatabaseService, private readonly carts: CartsService, private readonly products: ProductsService) {}

  private canSee = (user: PublicUser, order: Order) => user.role === "admin" || order.userId === user.id;

  private newId() {
    const year = new Date().getFullYear();
    const taken = new Set(this.db.data.orders.map((o) => o.id));
    let id;
    do { id = `KG-${year}-${Math.floor(1000 + Math.random() * 9000)}`; } while (taken.has(id));
    return id;
  }

  place(dto: CreateOrderDto, user: PublicUser) {
    const p = dto.payment;
    const errors = [];
    if (p.method === "wallet" && !["JazzCash", "Easypaisa"].includes(p.label || "")) errors.push({ field: "payment.label", message: "Choose JazzCash or Easypaisa." });
    if (p.method === "wallet" && !p.account) errors.push({ field: "payment.account", message: "Wallet account is required." });
    if (p.method === "card" && !p.last4) errors.push({ field: "payment.last4", message: "Card last 4 digits are required." });
    if (errors.length) throw new UnprocessableEntityException({ error: `${errors.length} field${errors.length > 1 ? "s are" : " is"} invalid.`, details: errors });

    const cart = this.carts.find(dto.cartId);
    this.carts.tidy(cart);
    if (!cart.items.length) throw new ConflictException("Your cart is empty.");
    const short = cart.items
      .map((i) => ({ i, product: this.products.find(i.productId) }))
      .filter(({ i, product }) => i.qty > product.stock)
      .map(({ i, product }) => ({ productId: product.id, name: product.name, requested: i.qty, available: product.stock }));
    if (short.length) throw new ConflictException({ error: "Some items no longer have enough stock.", details: short });

    const method = dto.deliveryMethod || "standard";
    const view = this.carts.present(cart);
    const t = view.totals[method];
    const order: Order = {
      id: this.newId(), userId: user.id, email: user.email, created: Date.now(), date: todayISO(), status: "Processing",
      items: view.lines.map((l) => ({ id: l.id, name: l.product.name, price: l.product.price, qty: l.qty })),
      subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total, coupon: t.discount ? t.coupon : "",
      deliveryMethod: method, eta: DELIVERY[method].eta,
      contact: { ...dto.contact }, shipping: { area: "", ...dto.shipping },
      payment: {
        method: p.method, label: p.method === "cod" ? "Cash on Delivery" : p.method === "card" ? "Card" : p.label!,
        ...(p.account ? { account: p.account } : {}), ...(p.last4 ? { last4: p.last4 } : {})
      },
      notes: dto.notes || "",
      history: [{ status: "Processing", at: new Date().toISOString() }]
    };

    // the order takes the items out of stock, and the cart starts again empty
    for (const item of cart.items) this.products.find(item.productId).stock -= item.qty;
    cart.items = [];
    cart.coupon = "";
    cart.updated = new Date().toISOString();
    this.db.data.orders.push(order);
    this.db.save();
    return { message: `Order ${order.id} placed.`, data: order };
  }

  list(user: PublicUser, status?: OrderStatus) {
    let list = this.db.data.orders.filter((o) => this.canSee(user, o));
    if (status) list = list.filter((o) => o.status === status);
    list.sort((a, b) => b.created - a.created);
    return { count: list.length, total: list.length, data: list };
  }

  find(id: string, user: PublicUser) {
    const order = this.db.data.orders.find((o) => o.id === id);
    // someone else's order looks exactly like a missing one
    if (!order || !this.canSee(user, order)) throw new NotFoundException(`Order ${id} not found.`);
    return order;
  }

  setStatus(id: string, status: OrderStatus, user: PublicUser) {
    const order = this.find(id, user);
    const allowed: OrderStatus[] = user.role === "admin"
      ? ({ Processing: ["Shipped", "Cancelled"], Shipped: ["Delivered"], Delivered: [], Cancelled: [] } as Record<OrderStatus, OrderStatus[]>)[order.status]
      : order.status === "Processing" ? ["Cancelled"] : [];
    if (!allowed.includes(status)) {
      const why = user.role === "admin" ? `An order that is ${order.status} cannot become ${status}.`
        : status === "Cancelled" ? "Only orders that are still processing can be cancelled." : "Customers can only cancel an order.";
      throw new ConflictException({ error: why, allowed });
    }
    if (status === "Cancelled") {
      // put the items back on the shelf
      for (const it of order.items) {
        const product = this.db.data.products.find((x) => x.id === it.id);
        if (product) product.stock += it.qty;
      }
    }
    order.status = status;
    order.history.push({ status, at: new Date().toISOString() });
    this.db.save();
    return { message: `Order ${order.id} is now ${status}.`, data: order };
  }
}

/* ---------- controller ---------- */

@ApiTags("Orders")
@Controller("api/orders")
@Auth("user")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: "Place an order from a cart: checks the stock, takes the items out of stock, empties the cart" })
  @ApiConflictResponse({ description: "The cart is empty or an item is short of stock" })
  place(@Body() dto: CreateOrderDto, @CurrentUser() user: PublicUser) {
    return this.orders.place(dto, user);
  }

  @Get()
  @ApiOperation({ summary: "My orders, newest first (the admin sees every order)" })
  list(@CurrentUser() user: PublicUser, @Query() query: OrderQueryDto) {
    return this.orders.list(user, query.status);
  }

  @Get(":id")
  @ApiOperation({ summary: "One order" })
  one(@Param("id") id: string, @CurrentUser() user: PublicUser) {
    return { data: this.orders.find(id, user) };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Change the status: customers may cancel while Processing (stock goes back); the admin ships and delivers" })
  setStatus(@Param("id") id: string, @Body() dto: OrderStatusDto, @CurrentUser() user: PublicUser) {
    return this.orders.setStatus(id, dto.status, user);
  }
}

@Module({
  imports: [CatalogModule, CartsModule],
  controllers: [OrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
