import { createSign } from "node:crypto";

const BUFFER_DAYS = 1; // 1 day before start & 1 day after end for shipping/inspection

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getGoogleAccessToken(): Promise<string | null> {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || "";
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  if (!clientEmail || !rawKey) return null;

  // Vercel env vars often store newlines as literal "\n"
  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://googleapis.com",
      aud: "https://googleapis.com",
      exp: now + 3600,
      iat: now,
    })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = base64Url(signer.sign(privateKey));
  const jwt = `${header}.${claim}.${signature}`;

  const tokenRes = await fetch("https://googleapis.com", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google OAuth token failed:", await tokenRes.text());
    return null;
  }

  const data = (await tokenRes.json()) as { access_token?: string };
  return data.access_token || null;
}

export interface CalendarOrderItem {
  item_name: string;
  quantity: number;
  start_date: string;
  end_date: string;
}

export interface CalendarOrderDetails {
  reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  company?: string | null;
  shipping_address?: string | null;
  rental_start: string;
  rental_end: string;
  items: CalendarOrderItem[];
}

export async function createRentalCalendarEvent(order: CalendarOrderDetails): Promise<string | null> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "";
  if (!calendarId) return null;

  const token = await getGoogleAccessToken();
  if (!token) return null;

  // Block 1 day before rental_start and 1 day after rental_end.
  // Note: Google Calendar all-day end dates are exclusive, so +2 days after rental_end covers the +1 buffer day.
  const blockedStart = addDays(order.rental_start, -BUFFER_DAYS);
  const blockedEndExclusive = addDays(order.rental_end, BUFFER_DAYS + 1);

  const itemSummary = order.items
    .map((i) => `${i.quantity}x ${i.item_name} (${i.start_date} to ${i.end_date})`)
    .join("\n");

  const description = [
    `Order Reference: ${order.reference}`,
    `Customer: ${order.customer_name}${order.company ? ` (${order.company})` : ""}`,
    `Email: ${order.customer_email}`,
    order.customer_phone ? `Phone: ${order.customer_phone}` : null,
    order.shipping_address ? `Delivery Address: ${order.shipping_address}` : null,
    ``,
    `Actual Rental Dates: ${order.rental_start} to ${order.rental_end}`,
    `Blocked Window (incl. 1-day shipping buffer): ${blockedStart} to ${addDays(order.rental_end, BUFFER_DAYS)}`,
    ``,
    `Items:`,
    itemSummary,
  ]
    .filter((line) => line !== null)
    .join("\n");

  const titleItems = order.items.map((i) => `${i.quantity}x ${i.item_name}`).join(", ");

  const res = await fetch(
    `https://googleapis.com{encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `[RENTAL] ${titleItems} — ${order.customer_name} (${order.reference})`,
        location: order.shipping_address || undefined,
        description,
        start: { date: blockedStart },
        end: { date: blockedEndExclusive },
      }),
    }
  );

  if (!res.ok) {
    console.error("Failed to create Google Calendar event:", await res.text());
    return null;
  }

  const created = (await res.json()) as { id?: string };
  return created.id || null;
}
