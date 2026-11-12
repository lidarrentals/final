import { json, type ApiRequest, type ApiResponse } from "./_lib/http.js";
import { supabaseAdmin } from "./_lib/supabase-admin.js";

const BUFFER_DAYS = 1; // 1 day before start & 1 day after end

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function eachDay(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  let cur = startIso.slice(0, 10);
  const end = endIso.slice(0, 10);
  while (cur <= end) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

// GET /api/availability?equipmentId=<id>
// Returns unavailable dates (where booked quantity + buffer >= stock_quantity)
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return json(res, { error: "Method not allowed" }, 405);

  const equipmentId = typeof req.query?.equipmentId === "string" ? req.query.equipmentId.trim() : "";
  if (!equipmentId) return json(res, { error: "equipmentId is required" }, 400);

  const db = supabaseAdmin();

  const { data: eq, error: eqErr } = await db
    .from("equipment")
    .select("id, stock_quantity")
    .eq("id", equipmentId)
    .maybeSingle();

  if (eqErr || !eq) return json(res, { error: "Equipment not found" }, 404);
  const stockQuantity = Math.max(1, Number(eq.stock_quantity) || 1);

  const today = new Date().toISOString().slice(0, 10);
  const lookback = addDays(today, -7);

  // 1. Fetch paid/review orders containing this equipment
  const { data: orderRows } = await db
    .from("order_items")
    .select("start_date, end_date, quantity, orders!inner(payment_status, status)")
    .eq("item_id", equipmentId)
    .gte("end_date", lookback)
    .in("orders.payment_status", ["paid", "review"])
    .neq("orders.status", "cancelled");

  // 2. Fetch manual maintenance/offline blocks
  const { data: blockRows } = await db
    .from("equipment_blocks")
    .select("start_date, end_date, quantity")
    .eq("equipment_id", equipmentId)
    .gte("end_date", lookback);

  const dailyBooked = new Map<string, number>();

  for (const row of orderRows || []) {
    if (!row.start_date || !row.end_date) continue;
    const qty = Math.max(1, Number(row.quantity) || 1);
    const blockedStart = addDays(row.start_date, -BUFFER_DAYS);
    const blockedEnd = addDays(row.end_date, BUFFER_DAYS);
    for (const day of eachDay(blockedStart, blockedEnd)) {
      dailyBooked.set(day, (dailyBooked.get(day) || 0) + qty);
    }
  }

  for (const block of blockRows || []) {
    if (!block.start_date || !block.end_date) continue;
    const qty = Math.max(1, Number(block.quantity) || 1);
    for (const day of eachDay(block.start_date, block.end_date)) {
      dailyBooked.set(day, (dailyBooked.get(day) || 0) + qty);
    }
  }

  const unavailableDates: string[] = [];
  for (const [day, used] of dailyBooked.entries()) {
    if (used >= stockQuantity) {
      unavailableDates.push(day);
    }
  }

  unavailableDates.sort();
  return json(res, { equipmentId, stockQuantity, bufferDays: BUFFER_DAYS, unavailableDates });
}
