/* The shape of everything saved in data/db.json. */

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  art: string;
  bg: string;
  description: string;
  baseRating: number;        // catalogue rating from Lab 3
  baseReviewCount: number;   // reviews written through the API are added on top
  created: string;
  updated: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  role: "customer" | "admin";
  passHash: string;
  created: string;
}

export interface Session {
  token: string;
  userId: string;
  created: number;
  expires: number;
}

export interface CartItem {
  productId: string;
  qty: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  coupon: string;
  created: string;
  updated: string;
}

export interface Review {
  id: string;
  productId: string;
  name: string;
  rating: number;
  text: string;
  city: string;
  date: string;
  created: number;
  verified: boolean;
  seeded?: boolean;
  userId?: string | null;
}

export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled";

export interface Order {
  id: string;
  userId: string;
  email: string;
  created: number;
  date: string;
  status: OrderStatus;
  items: { id: string; name: string; price: number; qty: number }[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  coupon: string;
  deliveryMethod: string;
  eta: string;
  contact: { name: string; email: string; phone: string };
  shipping: { address: string; area?: string; city: string; postal: string };
  payment: { method: string; label: string; account?: string; last4?: string };
  notes: string;
  history: { status: OrderStatus; at: string }[];
}

export interface Database {
  version: number;
  createdAt: string;
  updatedAt: string;
  counters: { product: number; user: number; review: number };
  products: Product[];
  users: User[];
  sessions: Session[];
  carts: Cart[];
  orders: Order[];
  reviews: Review[];
  ratingBase: Record<number, number>;
}

/* A user as the API shows it: never with the password hash. */
export type PublicUser = Omit<User, "passHash">;
export const publicUser = ({ passHash, ...user }: User): PublicUser => user;
