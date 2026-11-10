import { supabase } from '@/lib/supabase';

export interface CustomerProfile {
    email?: string;
    fullName: string;
    company: string;
    phone: string;
    street1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}

export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'expired' | 'review';

export interface OrderSummary {
    reference: string;
    status: string; // fulfilment: pending / confirmed / shipped / returned
    paymentStatus: PaymentStatus;
    customerName: string;
    customerEmail: string;
    company: string;
    shippingAddress: string;
    items: { name: string; quantity: number; rentalPeriod?: string; startDate?: string; endDate?: string; lineTotal: number }[];
    subtotal: number;
    shipping: number;
    total: number;
    amountPaid: number | null;
    rentalStart: string | null;
    rentalEnd: string | null;
    stripePaymentIntentId: string | null;
    stripeReceiptUrl: string | null;
    trackingNumber: string | null;
    trackingCarrier: string | null;
    invoiceUrl: string | null;
    paidAt: string | null;
    createdAt: string;
}

export const emptyProfile: CustomerProfile = {
    fullName: '', company: '', phone: '', street1: '', city: '', state: '', zip: '', country: 'CA',
};

// fetch() wrapper that attaches the signed-in customer's session token (for Netlify Functions)
export async function apiFetch(path: string, init: RequestInit = {}) {
    const { data } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
    return fetch(path, { ...init, headers });
}

// ---- Profiles (Supabase table: customer_profiles, row-level security = own row only) ----

export async function loadProfile(): Promise<{ profile: CustomerProfile; exists: boolean } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (error) throw error;

    if (data) {
        return {
            exists: true,
            profile: {
                email: user.email, fullName: data.full_name, company: data.company, phone: data.phone,
                street1: data.street1, city: data.city, state: data.state, zip: data.zip, country: data.country || 'CA',
            },
        };
    }

    // No saved profile yet: start from what the customer entered at registration
    const m = user.user_metadata || {};
    return {
        exists: false,
        profile: { ...emptyProfile, email: user.email, fullName: m.full_name || '', company: m.company_name || '', street1: m.business_address || '' },
    };
}

export async function saveProfile(profile: CustomerProfile): Promise<CustomerProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in.');

    const t = (v: string) => (v || '').trim().slice(0, 300);
    const { error } = await supabase.from('customer_profiles').upsert({
        user_id: user.id,
        email: user.email || '',
        full_name: t(profile.fullName),
        company: t(profile.company),
        phone: t(profile.phone),
        street1: t(profile.street1),
        city: t(profile.city),
        state: t(profile.state),
        zip: t(profile.zip),
        country: t(profile.country) || 'CA',
        updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ...profile, email: user.email };
}

// ---- Orders (Supabase tables: orders + order_items, read-only for customers) ----

export function mapOrder(row: any): OrderSummary {
    return {
        reference: row.reference || String(row.id).slice(0, 8).toUpperCase(),
        status: row.status || 'pending',
        paymentStatus: row.payment_status || 'unpaid',
        customerName: row.customer_name || '',
        customerEmail: row.customer_email || '',
        company: row.company || '',
        shippingAddress: row.shipping_address || '',
        items: (row.order_items || []).map((i: any) => ({
            name: i.item_name, quantity: i.quantity, rentalPeriod: i.rental_period,
            startDate: i.start_date, endDate: i.end_date, lineTotal: Number(i.line_total) || 0,
        })),
        subtotal: Number(row.subtotal) || 0,
        shipping: Number(row.shipping_cost) || 0,
        total: Number(row.total) || 0,
        amountPaid: row.amount_paid != null ? Number(row.amount_paid) : null,
        rentalStart: row.rental_start,
        rentalEnd: row.rental_end,
        stripePaymentIntentId: row.stripe_payment_intent_id,
        stripeReceiptUrl: row.stripe_receipt_url,
        trackingNumber: row.tracking_number,
        trackingCarrier: row.tracking_carrier,
        invoiceUrl: row.invoice_url,
        paidAt: row.paid_at,
        createdAt: row.created_at,
    };
}

export async function loadOrders(): Promise<OrderSummary[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(mapOrder);
}

export function formatAddress(a: Pick<CustomerProfile, 'street1' | 'city' | 'state' | 'zip' | 'country'> & { name?: string }) {
    const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [a.name, a.street1, cityLine, a.country].filter(Boolean).join(', ');
}

export function isProfileComplete(p: CustomerProfile) {
    return Boolean(p.fullName && p.phone && p.street1 && p.city && p.state && p.zip);
}
