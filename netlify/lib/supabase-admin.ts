import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// Server-only Supabase client using the service-role key. Never import this from src/.
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Supabase URL or SUPABASE_SERVICE_ROLE_KEY is not configured");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// Verifies the customer's Supabase access token (from the Authorization header)
export async function getAuthUser(req: Request): Promise<User | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
