import type { Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders } from "../../db/schema.js";
import { getAuthUser, json } from "../lib/auth.js";
import { syncOrderWithStripe, toPublicOrder } from "../lib/stripe.js";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(req.url);

  // Order confirmation lookup after returning from Stripe
  if (url.pathname.endsWith("/confirm")) {
    const sessionId = url.searchParams.get("session_id") || "";
    const reference = url.searchParams.get("order_id") || "";
    if (!reference) return json({ error: "Missing order reference" }, 400);

    const [order] = await db.select().from(orders).where(eq(orders.reference, reference));
    if (!order) return json({ error: "Order not found" }, 404);

    // Full details only when the caller holds the matching Stripe session id or owns the order
    const user = await getAuthUser(req);
    const authorized = (sessionId && order.stripeSessionId === sessionId) || (user && order.userId === user.id) || order.status === "test";
    if (!authorized) return json({ error: "Order not found" }, 404);

    const synced = await syncOrderWithStripe(order);
    return json({ order: toPublicOrder(synced) });
  }

  const user = await getAuthUser(req);
  if (!user) return json({ error: "Please sign in." }, 401);

  const rows = await db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt));

  // Confirm any recent orders still awaiting payment (e.g. if the customer closed the tab after paying)
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const synced = await Promise.all(
    rows.map((o) => (o.status === "pending" && o.createdAt.getTime() > dayAgo ? syncOrderWithStripe(o) : o))
  );

  // Hide abandoned checkouts
  const visible = synced.filter((o) => o.status === "paid" || o.status === "test" || (o.status === "pending" && o.createdAt.getTime() > dayAgo));
  return json({ orders: visible.map(toPublicOrder) });
};

export const config: Config = { path: ["/api/orders", "/api/orders/confirm"] };
