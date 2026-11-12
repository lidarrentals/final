import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { getAuthUser, json, supabaseAdmin } from "../lib/supabase-admin.js";

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(new Date(v).getTime());

// Same rule as the equipment page: whole days between the dates, minimum 1
function rentalDays(start: string, end: string) {
  const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  return Math.ceil(diff / 86_400_000) || 1;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  if (!stripeKey.startsWith("sk_") && !stripeKey.startsWith("rk_")) {
    return json({ error: "Payments are not configured." }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const rawItems: any[] = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
  if (rawItems.length === 0) return json({ error: "Your cart is empty." }, 400);

  const db = supabaseAdmin();

  // Never trust prices from the browser: look every item up in Supabase and price it here
  const ids = [...new Set(rawItems.map((i) => str(i.id, 64)).filter(Boolean))];
  const { data: equipment, error: eqError } = await db
    .from("equipment")
    .select("id, name, price_1day, is_active")
    .in("id", ids);
  if (eqError) {
    console.error("Equipment lookup failed", eqError);
    return json({ error: "Could not verify cart items." }, 500);
  }
  const byId = new Map((equipment || []).map((e: any) => [e.id, e]));

  const items = [];
  for (const raw of rawItems) {
    const eq: any = byId.get(str(raw.id, 64));
    const startDate = str(raw.startDate, 40);
    const endDate = str(raw.endDate, 40);
    if (!eq || !eq.is_active) return json({ error: `"${str(raw.name) || "An item"}" is no longer available.` }, 400);
    if (!isDate(startDate) || !isDate(endDate)) return json({ error: `Please choose rental dates for ${eq.name}.` }, 400);

    const days = rentalDays(startDate, endDate);
    const quantity = Math.min(100, Math.max(1, Math.floor(Number(raw.quantity) || 1)));
    const unitCents = Math.round(Number(eq.price_1day) * days * 100);
    items.push({ eq, startDate: startDate.slice(0, 10), endDate: endDate.slice(0, 10), days, quantity, unitCents });
  }

  const shippingCents = Math.min(1_000_000, Math.max(0, Math.round((Number(body.shippingCost) || 0) * 100)));
  const subtotalCents = items.reduce((s, i) => s + i.unitCents * i.quantity, 0);
  const totalCents = subtotalCents + shippingCents;

  const user = await getAuthUser(req);
  const customer = body.customer || {};
  const customerEmail = str(customer.email) || user?.email || "";
  if (!customerEmail) return json({ error: "Please enter your email address." }, 400);

  const reference = "LR-" + randomBytes(4).toString("hex").toUpperCase();
  const starts = items.map((i) => i.startDate).sort();
  const ends = items.map((i) => i.endDate).sort();

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      reference,
      user_id: user?.id ?? null,
      customer_name: str(customer.name) || "Customer",
      customer_email: customerEmail,
      customer_phone: str(customer.phone),
      company: str(customer.company),
      shipping_address: str(body.shippingAddress, 600),
      subtotal: subtotalCents / 100,
      shipping_cost: shippingCents / 100,
      total: totalCents / 100,
      currency: "usd",
      rental_start: starts[0],
      rental_end: ends[ends.length - 1],
      status: "pending",
      payment_status: "unpaid",
    })
    .select("id")
    .single();
  if (orderError || !order) {
    console.error("Order insert failed", orderError);
    return json({ error: "Could not create your order." }, 500);
  }

  const { error: itemsError } = await db.from("order_items").insert(
    items.map((i) => ({
      order_id: order.id,
      item_type: "equipment",
      item_id: i.eq.id,
      item_name: i.eq.name,
      rental_period: `${i.days} day${i.days === 1 ? "" : "s"}`,
      start_date: i.startDate,
      end_date: i.endDate,
      quantity: i.quantity,
      unit_price: i.unitCents / 100,
      line_total: (i.unitCents * i.quantity) / 100,
    }))
  );
  if (itemsError) {
    console.error("Order items insert failed", itemsError);
    await db.from("orders").delete().eq("id", order.id);
    return json({ error: "Could not create your order." }, 500);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((i) => ({
    price_data: {
      currency: "usd",
      product_data: { name: i.eq.name, description: `${i.days} Day Rental (${i.startDate} to ${i.endDate})` },
      unit_amount: i.unitCents,
    },
    quantity: i.quantity,
  }));
  if (shippingCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Round-Trip Courier Delivery Logistics", description: "Includes prepaid return label instructions packet" },
        unit_amount: shippingCents,
      },
      quantity: 1,
    });
  }

  const origin = new URL(req.url).origin;
  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      customer_email: customerEmail,
      client_reference_id: reference,
      metadata: { order_reference: reference },
      payment_intent_data: { metadata: { order_reference: reference } },
      success_url: `${origin}/#/checkout?success=true&order_id=${reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#/checkout?cancel=true`,
    });

    await db.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return json({ url: session.url, reference });
  } catch (err: any) {
    console.error("Stripe session creation failed", err);
    await db.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    return json({ error: "Failed to start Stripe checkout." }, 500);
  }
};

export const config = { path: "/api/checkout" };
