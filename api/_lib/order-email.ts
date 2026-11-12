import { Resend } from "resend";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Sends the customer an order status update. Only called by the admin-only order endpoint,
// using the customer email stored on the order (never an address supplied by the browser).
export async function sendOrderStatusEmail(opts: {
  to: string; name: string; reference: string; status: string;
  trackingNumber?: string | null; trackingCarrier?: string | null; origin: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !opts.to) return false;

  let subject = `Update on your lidar.rentals order ${esc(opts.reference)}`;
  let html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #1e293b;">Hello ${esc(opts.name) || "Customer"},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Your rental order status has been updated to: <strong style="color: #2563eb; text-transform: uppercase;">${esc(opts.status)}</strong>.
      </p>`;

  if (opts.status === "shipped" && opts.trackingNumber) {
    subject = "Your lidar.rentals package has shipped! 🚚";
    html += `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0f172a;">Shipping Details:</h4>
        <p style="margin: 5px 0; font-size: 14px; color: #475569;"><strong>Carrier:</strong> ${esc(opts.trackingCarrier || "UPS")}</p>
        <p style="margin: 5px 0; font-size: 14px; color: #475569;"><strong>Tracking Number:</strong> <code style="font-weight: bold; color: #0f172a;">${esc(opts.trackingNumber)}</code></p>
      </div>
      <p style="color: #475569; font-size: 14px;">A prepaid return courier label has been enclosed inside your delivery box for easy dropoff when your rental period ends.</p>`;
  } else {
    html += `<p style="color: #475569; font-size: 14px;">Log into your <a href="${esc(opts.origin)}/#/account" style="color: #2563eb; font-weight: bold; text-decoration: none;">Customer Account Dashboard</a> to view receipts, track updates, or submit documentation.</p>`;
  }

  html += `
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated notification from lidar.rentals. Please do not reply directly to this message.</p>
    </div>`;

  try {
    await new Resend(key).emails.send({
      from: "lidar.rentals Fulfillment <onboarding@resend.dev>",
      to: opts.to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Order email failed", err);
    return false;
  }
}
