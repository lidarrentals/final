import { json, queryParam, type ApiRequest, type ApiResponse } from "../_lib/http.js";
import { getAuthUser, supabaseAdmin } from "../_lib/supabase-admin.js";

// GET /api/orders/confirm — read-only lookup for the "Order Received" screen. It never
// changes payment status; only the signature-verified Stripe webhook does that.
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return json(res, { error: "Method not allowed" }, 405);
  const reference = queryParam(req, "order_id").slice(0, 40);
  const sessionId = queryParam(req, "session_id").slice(0, 200);
  if (!reference) return json(res, { error: "Missing order reference" }, 400);

  const { data: order } = await supabaseAdmin()
    .from("orders")
    .select("*, order_items(*)")
    .eq("reference", reference)
    .maybeSingle();
  if (!order) return json(res, { error: "Order not found" }, 404);

  // Only reveal the order to the holder of its Stripe session id, or to its signed-in owner
  const user = await getAuthUser(req);
  const authorized = (sessionId && order.stripe_session_id === sessionId) || (user && order.user_id === user.id);
  if (!authorized) return json(res, { error: "Order not found" }, 404);

  return json(res, { order });
}
