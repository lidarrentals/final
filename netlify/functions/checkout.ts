import type { Config } from "@netlify/functions";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { customerProfiles, orders, type OrderItem } from "../../db/schema.js";
import { getAuthUser, json } from "../lib/auth.js";
import { getStripe } from "../lib/stripe.js";

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function newReference() {
  return "LR-" + randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  const rawItems: any[] = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return json({ error: "Your cart is empty." }, 400);

  const items: OrderItem[] = rawItems.map((i) => ({
    id: str(i.id, 100) || undefined,
    name: str(i.name) || "Rental item",
    quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
    rentalPeriod: i.rentalPeriod,
    startDate: str(i.startDate, 40) || undefined,
    endDate: str(i.endDate, 40) || undefined,
    lineTotal: Math.max(0, Number(i.lineTotal) || 0),
  }));

  const shippingCost = Math.max(0, Number(body.shippingCost) || 0);
  const subtotalCents = items.reduce((s, i) => s + Math.round(i.lineTotal * 100), 0);
  const shippingCents = Math.round(shippingCost * 100);

  const user = await getAuthUser(req);
  const customer = body.customer || {};
  const address = body.address || {};
  const customerEmail = str(customer.email) || user?.email || "";

  // Rental window covering every item, used to split current vs past orders
  const starts = items.map((i) => i.startDate).filter(Boolean).sort() as string[];
  const ends = items.map((i) => i.endDate).filter(Boolean).sort() as string[];

  const reference = newReference();
  const [order] = await db
    .insert(orders)
    .values({
      reference,
      userId: user?.id ?? null,
      customerName: str(customer.name),
      customerEmail,
      customerPhone: str(customer.phone),
      company: str(customer.company),
      shippingAddress: str(body.shippingAddress, 600),
      items,
      subtotalCents,
      shippingCents,
      totalCents: subtotalCents + shippingCents,
      rentalStart: starts[0] ?? null,
      rentalEnd: ends[ends.length - 1] ?? null,
    })
    .returning();

  // Keep the customer's profile up to date with what they used at checkout
  if (user && body.saveToProfile) {
    const values = {
      fullName: str(customer.name),
      company: str(customer.company),
      phone: str(customer.phone),
      street1: str(address.street1),
      city: str(address.city),
      state: str(address.state),
      zip: str(address.zip),
      country: str(address.country) || "CA",
    };
    await db
      .insert(customerProfiles)
      .values({ userId: user.id, email: user.email, ...values })
      .onConflictDoUpdate({ target: customerProfiles.userId, set: { ...values, updatedAt: new Date() } })
      .catch((err) => console.error("Failed to save profile at checkout", err));
  }

  const origin = new URL(req.url).origin;
  const successUrl = `${origin}/#/checkout?success=true&order_id=${reference}`;

  const stripe = getStripe();
  if (!stripe) {
    // No Stripe key configured: record as a test order so the flow can be exercised
    await db.update(orders).set({ status: "test", paidAt: new Date() }).where(eq(orders.id, order.id));
    return json({ url: successUrl, mock: true, reference });
  }

  const lineItems = items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.name,
        description: `${item.rentalPeriod || 1} Day Rental (${item.startDate || ""} to ${item.endDate || ""})`,
      },
      unit_amount: Math.round((item.lineTotal / item.quantity) * 100),
    },
    quantity: item.quantity,
  }));
  if (shippingCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Round-Trip Courier Delivery Logistics",
          description: "Includes prepaid return label instructions packet",
        },
        unit_amount: shippingCents,
      },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customerEmail || undefined,
      client_reference_id: reference,
      metadata: { order_reference: reference },
      payment_intent_data: { metadata: { order_reference: reference } },
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#/checkout?cancel=true`,
    });

    await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, order.id));
    return json({ url: session.url, reference });
  } catch (err: any) {
    console.error("Stripe session creation failed", err);
    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
    return json({ error: "Failed to start Stripe checkout.", details: err?.message }, 500);
  }
};

export const config: Config = { path: "/api/checkout" };
