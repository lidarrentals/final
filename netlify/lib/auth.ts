// Verifies the Supabase access token sent by the browser and returns the user.
export type AuthUser = { id: string; email: string; metadata: Record<string, any> };

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !anonKey) {
    console.error("Supabase URL / anon key are not configured for functions");
    return null;
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return { id: user.id, email: user.email || "", metadata: user.user_metadata || {} };
  } catch (err) {
    console.error("Failed to verify Supabase session", err);
    return null;
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}
