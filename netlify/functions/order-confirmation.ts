import { getAuthUser, json, supabaseAdmin } from "../lib/supabase-admin.js";

// Read-only lookup for the "Order Received" screen. It never changes payment status;
// only the signature-verified Stripe webhook does that.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(req.url);
  const reference = (url.searchParams.get("order_id") || "").slice(0, 40);
  const sessionId = (url.searchParams.get("session_id") || "").slice(0, 200);
  if (!reference) return json({ error: "Missing order reference" }, 400);

  const { data: order } = await supabaseAdmin()
    .from("orders")
    .select("*, order_items(*)")
    .eq("reference", reference)
    .maybeSingle();
  if (!order) return json({ error: "Order not found" }, 404);

  // Only reveal the order to the holder of its Stripe session id, or to its signed-in owner
  const user = await getAuthUser(req);
  const authorized = (sessionId && order.stripe_session_id === sessionId) || (user && order.user_id === user.id);
  if (!authorized) return json({ error: "Order not found" }, 404);

  return json({ order });
};

export const config = { path: "/api/orders/confirm" };
