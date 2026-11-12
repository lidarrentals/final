import Stripe from "stripe";
import { json, supabaseAdmin } from "../lib/supabase-admin.js";

// Stripe calls this after every Checkout transaction. The signature is verified with
// STRIPE_WEBHOOK_SECRET before anything is written to Supabase, so forged requests are rejected.
export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  if (!secret || !stripeKey) {
    console.error("Stripe webhook is not configured");
    return json({ error: "Not configured" }, 500);
  }

  const stripe = new Stripe(stripeKey);
  const signature = req.headers.get("stripe-signature") || "";
  const payload = await req.text(); // raw body is required for signature verification

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err: any) {
    console.warn("Rejected Stripe webhook with invalid signature:", err?.message);
    return json({ error: "Invalid signature" }, 400);
  }

  const db = supabaseAdmin();
  const session = event.data.object as Stripe.Checkout.Session;

  const findOrder = async () => {
    const { data } = await db
      .from("orders")
      .select("id, reference, total, payment_status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();
    return data;
  };

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (session.payment_status !== "paid") break; // async methods confirm later
        const order = await findOrder();
        if (!order) {
          console.warn(`No order for Stripe session ${session.id}`);
          break;
        }
        if (order.payment_status === "paid") break; // already recorded (Stripe retries)

        // Cross-check the session against our own record
        const expectedCents = Math.round(Number(order.total) * 100);
        const referenceMatches = session.metadata?.order_reference === order.reference;
        const amountMatches = session.amount_total === expectedCents;

        let paymentIntentId: string | null = null;
        let receiptUrl: string | null = null;
        if (session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(
            typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id,
            { expand: ["latest_charge"] }
          );
          paymentIntentId = pi.id;
          const charge = pi.latest_charge as Stripe.Charge | null;
          receiptUrl = charge && typeof charge === "object" ? charge.receipt_url : null;
        }

        await db
          .from("orders")
          .update({
            payment_status: referenceMatches && amountMatches ? "paid" : "review",
            amount_paid: (session.amount_total ?? 0) / 100,
            stripe_payment_intent_id: paymentIntentId,
            stripe_receipt_url: receiptUrl,
            stripe_event_id: event.id,
            paid_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (!referenceMatches || !amountMatches) {
          console.error(`Order ${order.reference} flagged for review: Stripe amount/reference mismatch`);
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        await db.from("orders").update({ payment_status: "failed", stripe_event_id: event.id }).eq("stripe_session_id", session.id).neq("payment_status", "paid");
        break;
      }

      case "checkout.session.expired": {
        await db.from("orders").update({ payment_status: "expired", stripe_event_id: event.id }).eq("stripe_session_id", session.id).neq("payment_status", "paid");
        break;
      }
    }
  } catch (err) {
    console.error(`Failed to process Stripe event ${event.id}`, err);
    return json({ error: "Processing failed" }, 500); // Stripe will retry
  }

  return json({ received: true });
};

export const config = { path: "/api/stripe-webhook" };
