import { getAuthUser, json, supabaseAdmin } from "../lib/supabase-admin.js";

// Admin-only order management. Admin rights come from the admin_users table,
// checked on the server for every request.
const STATUSES = new Set(["pending", "confirmed", "shipped", "returned"]);
const t = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export default async (req: Request) => {
  const user = await getAuthUser(req);
  if (!user) return json({ error: "Please sign in." }, 401);

  const db = supabaseAdmin();
  const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return json({ error: "Not authorized." }, 403);

  if (req.method === "GET") {
    const { data, error } = await db.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ orders: data || [] });
  }

  if (req.method === "PATCH") {
    const b = await req.json().catch(() => ({}));
    const id = t(b.id, 64);
    if (!id) return json({ error: "Missing order id" }, 400);

    // Only fulfilment fields can be changed here; payment fields belong to the Stripe webhook
    const update: Record<string, string> = {};
    for (const f of ["tracking_number", "tracking_carrier", "invoice_url", "coi_url"]) {
      const v = t(b[f]);
      if (v !== undefined) update[f] = v;
    }
    if (typeof b.status === "string" && STATUSES.has(b.status)) update.status = b.status;

    const { data, error } = await db.from("orders").update(update).eq("id", id).select("id, customer_email, customer_name").maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Order not found" }, 404);
    return json({ order: data });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/admin/orders" };
