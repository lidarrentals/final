import type { IncomingMessage, ServerResponse } from "node:http";

// Minimal shapes of the request/response objects Vercel passes to Node.js Serverless
// Functions (compatible with @vercel/node's VercelRequest / VercelResponse).
export type ApiRequest = IncomingMessage & {
  body?: any;
  query: Record<string, string | string[]>;
  cookies?: Record<string, string>;
};

export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse;
  json(body: unknown): ApiResponse;
  send(body: unknown): ApiResponse;
};

export function json(res: ApiResponse, data: unknown, status = 200) {
  return res.status(status).json(data);
}

export function header(req: ApiRequest, name: string): string {
  const v = req.headers[name.toLowerCase()];
  return (Array.isArray(v) ? v[0] : v) || "";
}

export function queryParam(req: ApiRequest, name: string): string {
  const v = req.query?.[name];
  return (Array.isArray(v) ? v[0] : v) || "";
}

// Parsed JSON body. Vercel parses JSON automatically; strings/buffers are handled as a fallback.
export function readJson(req: ApiRequest): Record<string, any> {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  try {
    const text = Buffer.isBuffer(b) ? b.toString("utf8") : typeof b === "string" ? b : "";
    const parsed = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// Unparsed request body, needed for Stripe signature verification.
// Only works when the function disables body parsing (config.api.bodyParser = false).
export async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// Public origin of the site (e.g. https://lidar.rentals), used for Stripe redirect URLs and email links.
export function requestOrigin(req: ApiRequest): string {
  const proto = header(req, "x-forwarded-proto").split(",")[0].trim() || "https";
  const host = header(req, "x-forwarded-host").split(",")[0].trim() || header(req, "host");
  return `${proto}://${host}`;
}
