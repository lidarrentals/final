import { getAuthUser, json, supabaseAdmin } from "../lib/supabase-admin.js";

// The signed-in customer's own profile. The browser never queries Supabase tables
// directly; this function reads/writes only the row whose id matches the verified login.
const t = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 300) : "");

export default async (req: Request) => {
  const user = await getAuthUser(req);
  if (!user) return json({ error: "Please sign in." }, 401);
  const db = supabaseAdmin();
  const m = user.user_metadata || {};

  if (req.method === "GET") {
    const { data, error } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) console.error("Profile read failed", error.message);
    const p: any = data || {};
    return json({
      exists: Boolean(data && (p.full_name || p.street1)),
      profile: {
        email: user.email,
        fullName: p.full_name || m.full_name || "",
        company: p.company || m.company_name || "",
        phone: p.phone || "",
        street1: p.street1 || m.business_address || "",
        city: p.city || "",
        state: p.state || "",
        zip: p.zip || "",
        country: p.country || "CA",
      },
    });
  }

  if (req.method === "PUT") {
    const b = await req.json().catch(() => ({}));
    const row = {
      id: user.id,
      email: user.email || "",
      full_name: t(b.fullName),
      company: t(b.company),
      phone: t(b.phone),
      street1: t(b.street1),
      city: t(b.city),
      state: t(b.state),
      zip: t(b.zip),
      country: t(b.country) || "CA",
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("profiles").upsert(row, { onConflict: "id" });
    if (error) {
      console.error("Profile save failed", error.message);
      return json({ error: "Could not save your profile." }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/profile" };
