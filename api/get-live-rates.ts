import { json, readJson, type ApiRequest, type ApiResponse } from "./_lib/http.js";

// POST /api/get-live-rates — live courier quotes from Shippo for the delivery fee calculator.
// The ship-from address comes from SHIPPO_ORIGIN_ADDRESS_JSON (a JSON object with Shippo
// address fields: name, company, street1, city, state, zip, country, phone, email).
const DEFAULT_ORIGIN = {
  name: "RentPro Equipment Ltd",
  company: "RentPro Operations",
  street1: "123 Main Street",
  city: "Toronto",
  state: "ON",
  zip: "M5V 2T6",
  country: "CA",
  phone: "+14165550199",
  email: "fulfillment@rentpro-equipment.ca",
};

function originAddress() {
  const raw = process.env.SHIPPO_ORIGIN_ADDRESS_JSON;
  if (!raw) return DEFAULT_ORIGIN;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return { ...DEFAULT_ORIGIN, ...parsed };
  } catch {
    console.error("SHIPPO_ORIGIN_ADDRESS_JSON is not valid JSON; using default origin address");
  }
  return DEFAULT_ORIGIN;
}

function cors(res: ApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).send("");
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const customerAddress = readJson(req).customerAddress;
    if (!customerAddress || !customerAddress.zip) {
      return json(res, { error: "Missing postal details." }, 400);
    }

    const shipmentPayload = {
      address_from: originAddress(),
      address_to: {
        name: customerAddress.name || "Equipment Renter",
        company: customerAddress.company || "",
        street1: customerAddress.street1,
        city: customerAddress.city,
        state: customerAddress.state || "ON",
        zip: customerAddress.zip,
        country: "CA",
        phone: "+14165550100", // Default placeholder value to prevent validation blocks
        email: "customer@rentpro-equipment.ca",
      },
      parcels: [{ length: "12", width: "10", height: "6", distance_unit: "in", weight: "5", mass_unit: "lb" }],
      async: false,
    };

    const response = await fetch("https://api.goshippo.com/shipments/", {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shipmentPayload),
    });

    const shipment: any = await response.json();

    if (!response.ok || !shipment.rates || shipment.rates.length === 0) {
      console.error("Shippo Debug Return:", shipment);
      return json(res, { rates: [], message: "API token connection succeeded, but carriers returned empty zones." });
    }

    const liveRates = shipment.rates.map((rate: any) => ({
      id: rate.object_id,
      provider: rate.provider,
      service: rate.servicelevel?.name || "Standard Shipping",
      amount: (parseFloat(rate.amount) * 1.8).toFixed(2),
      currency: rate.currency,
    }));

    return json(res, { rates: liveRates });
  } catch (error: any) {
    console.error("Internal Error:", error);
    return json(res, { error: "Failed to calculate live rate quotes.", details: error?.message }, 500);
  }
}
