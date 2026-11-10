import { pgTable, serial, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

// One profile per signed-in customer (keyed by their Supabase auth user id)
export const customerProfiles = pgTable("customer_profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull().default(""),
  company: text("company").notNull().default(""),
  phone: text("phone").notNull().default(""),
  street1: text("street1").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  zip: text("zip").notNull().default(""),
  country: text("country").notNull().default("CA"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type OrderItem = {
  id?: string;
  name: string;
  quantity: number;
  rentalPeriod?: number | string;
  startDate?: string;
  endDate?: string;
  lineTotal: number;
};

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    userId: text("user_id"),
    customerName: text("customer_name").notNull().default(""),
    customerEmail: text("customer_email").notNull().default(""),
    customerPhone: text("customer_phone").notNull().default(""),
    company: text("company").notNull().default(""),
    shippingAddress: text("shipping_address").notNull().default(""),
    items: jsonb("items").$type<OrderItem[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    rentalStart: text("rental_start"),
    rentalEnd: text("rental_end"),
    // pending | paid | test | cancelled
    status: text("status").notNull().default("pending"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeReceiptUrl: text("stripe_receipt_url"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("orders_user_id_idx").on(t.userId), index("orders_stripe_session_idx").on(t.stripeSessionId)]
);
