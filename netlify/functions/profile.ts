import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { customerProfiles } from "../../db/schema.js";
import { getAuthUser, json } from "../lib/auth.js";

const FIELDS = ["fullName", "company", "phone", "street1", "city", "state", "zip", "country"] as const;

export default async (req: Request) => {
  const user = await getAuthUser(req);
  if (!user) return json({ error: "Please sign in." }, 401);

  if (req.method === "GET") {
    const [profile] = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, user.id));
    if (profile) return json({ profile, exists: true });

    // No saved profile yet: seed from what the customer entered at registration
    const m = user.metadata;
    return json({
      exists: false,
      profile: {
        email: user.email,
        fullName: m.full_name || "",
        company: m.company_name || "",
        phone: "",
        street1: m.business_address || "",
        city: "",
        state: "",
        zip: "",
        country: "CA",
      },
    });
  }

  if (req.method === "PUT" || req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const values: Record<string, string> = {};
    for (const f of FIELDS) {
      if (typeof body[f] === "string") values[f] = body[f].trim().slice(0, 300);
    }

    const [profile] = await db
      .insert(customerProfiles)
      .values({ userId: user.id, email: user.email, ...values })
      .onConflictDoUpdate({
        target: customerProfiles.userId,
        set: { ...values, email: user.email, updatedAt: new Date() },
      })
      .returning();
    return json({ profile, exists: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/profile" };
