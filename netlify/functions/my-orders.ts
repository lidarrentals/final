import { getAuthUser, json, supabaseAdmin } from "../lib/supabase-admin.js";

// The signed-in customer's own orders (current + past) with Stripe-verified payment status.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const user = await getAuthUser(req);
  if (!user) return json({ error: "Please sign in." }, 401);

  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Orders read failed", error.message);
    return json({ error: "Could not load orders." }, 500);
  }

  // Never expose internal Stripe event ids
  const orders = (data || []).map(({ stripe_event_id, stripe_session_id, ...o }: any) => o);
  return json({ orders });
};

export const config = { path: "/api/my-orders" };
