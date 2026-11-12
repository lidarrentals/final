import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { header, type ApiRequest } from "./http.js";

// Server-only Supabase client using the service-role key. Never import this from src/.
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

// Verifies the customer's Supabase access token (from the Authorization header)
export async function getAuthUser(req: ApiRequest): Promise<User | null> {
  const auth = header(req, "authorization");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
