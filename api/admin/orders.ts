import { json, readJson, requestOrigin, type ApiRequest, type ApiResponse } from "../_lib/http.js";
import { getAuthUser, supabaseAdmin } from "../_lib/supabase-admin.js";
import { sendOrderStatusEmail } from "../_lib/order-email.js";

// GET/PATCH /api/admin/orders — admin-only order management. Admin rights come from the
// admin_users table, checked on the server for every request.
const STATUSES = new Set(["pending", "confirmed", "shipped", "returned"]);
const t = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const user = await getAuthUser(req);
  if (!user) return json(res, { error: "Please sign in." }, 401);

  const db = supabaseAdmin();
  const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return json(res, { error: "Not authorized." }, 403);

  if (req.method === "GET") {
    const { data, error } = await db.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (error) return json(res, { error: error.message }, 500);
    return json(res, { orders: data || [] });
  }

  if (req.method === "PATCH") {
    const b = readJson(req);
    const id = t(b.id, 64);
    if (!id) return json(res, { error: "Missing order id" }, 400);

    // Only fulfilment fields can be changed here; payment fields belong to the Stripe webhook
    const update: Record<string, string> = {};
    for (const f of ["tracking_number", "tracking_carrier", "invoice_url", "coi_url"]) {
      const v = t(b[f]);
      if (v !== undefined) update[f] = v;
    }
    if (typeof b.status === "string" && STATUSES.has(b.status)) update.status = b.status;

    const { data, error } = await db
      .from("orders")
      .update(update)
      .eq("id", id)
      .select("id, reference, customer_email, customer_name, status, tracking_number, tracking_carrier")
      .maybeSingle();
    if (error) return json(res, { error: error.message }, 500);
    if (!data) return json(res, { error: "Order not found" }, 404);

    let emailed = false;
    if (b.notify === true) {
      emailed = await sendOrderStatusEmail({
        to: data.customer_email,
        name: data.customer_name,
        reference: data.reference || String(data.id).slice(0, 8).toUpperCase(),
        status: data.status,
        trackingNumber: data.tracking_number,
        trackingCarrier: data.tracking_carrier,
        origin: requestOrigin(req),
      });
    }
    return json(res, { order: { id: data.id }, emailed });
  }

  return json(res, { error: "Method not allowed" }, 405);
}
