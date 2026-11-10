import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { orders } from "../../db/schema.js";

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return key.startsWith("sk_") || key.startsWith("rk_") ? new Stripe(key) : null;
}

type OrderRow = typeof orders.$inferSelect;

// Looks up the Stripe Checkout Session for an order and records the payment confirmation.
export async function syncOrderWithStripe(order: OrderRow): Promise<OrderRow> {
  if (order.status !== "pending" || !order.stripeSessionId) return order;
  const stripe = getStripe();
  if (!stripe) return order;

  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId, {
      expand: ["payment_intent.latest_charge"],
    });

    if (session.payment_status === "paid") {
      const pi = session.payment_intent as Stripe.PaymentIntent | string | null;
      const paymentIntentId = typeof pi === "string" ? pi : pi?.id ?? null;
      const charge = typeof pi === "object" && pi ? (pi.latest_charge as Stripe.Charge | string | null) : null;
      const receiptUrl = charge && typeof charge === "object" ? charge.receipt_url ?? null : null;

      const [updated] = await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntentId,
          stripeReceiptUrl: receiptUrl,
          totalCents: session.amount_total ?? order.totalCents,
          currency: session.currency ?? order.currency,
        })
        .where(eq(orders.id, order.id))
        .returning();
      return updated ?? order;
    }

    if (session.status === "expired") {
      const [updated] = await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id)).returning();
      return updated ?? order;
    }
  } catch (err) {
    console.error(`Could not sync order ${order.reference} with Stripe`, err);
  }
  return order;
}

// Shape sent to the browser (no internal ids)
export function toPublicOrder(o: OrderRow) {
  return {
    reference: o.reference,
    status: o.status,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    company: o.company,
    shippingAddress: o.shippingAddress,
    items: o.items,
    subtotal: o.subtotalCents / 100,
    shipping: o.shippingCents / 100,
    total: o.totalCents / 100,
    currency: o.currency,
    rentalStart: o.rentalStart,
    rentalEnd: o.rentalEnd,
    stripePaymentIntentId: o.stripePaymentIntentId,
    stripeReceiptUrl: o.stripeReceiptUrl,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
  };
}
