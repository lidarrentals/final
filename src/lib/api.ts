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

export interface OrderSummary {
    reference: string;
    status: 'pending' | 'paid' | 'test' | 'cancelled';
    customerName: string;
    customerEmail: string;
    company: string;
    shippingAddress: string;
    items: { id?: string; name: string; quantity: number; rentalPeriod?: number | string; startDate?: string; endDate?: string; lineTotal: number }[];
    subtotal: number;
    shipping: number;
    total: number;
    currency: string;
    rentalStart: string | null;
    rentalEnd: string | null;
    stripePaymentIntentId: string | null;
    stripeReceiptUrl: string | null;
    paidAt: string | null;
    createdAt: string;
}

export const emptyProfile: CustomerProfile = {
    fullName: '', company: '', phone: '', street1: '', city: '', state: '', zip: '', country: 'CA',
};

// fetch() wrapper that attaches the signed-in customer's session token
export async function apiFetch(path: string, init: RequestInit = {}) {
    const { data } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
    return fetch(path, { ...init, headers });
}

export async function loadProfile(): Promise<{ profile: CustomerProfile; exists: boolean } | null> {
    const res = await apiFetch('/api/profile');
    if (!res.ok) return null;
    return res.json();
}

export async function saveProfile(profile: CustomerProfile): Promise<CustomerProfile> {
    const res = await apiFetch('/api/profile', { method: 'PUT', body: JSON.stringify(profile) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save profile');
    return data.profile;
}

export async function loadOrders(): Promise<OrderSummary[]> {
    const res = await apiFetch('/api/orders');
    if (!res.ok) throw new Error('Could not load orders');
    return (await res.json()).orders;
}

export function formatAddress(a: Pick<CustomerProfile, 'street1' | 'city' | 'state' | 'zip' | 'country'> & { name?: string }) {
    const cityLine = [a.city, [a.state, a.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [a.name, a.street1, cityLine, a.country].filter(Boolean).join(', ');
}

export function isProfileComplete(p: CustomerProfile) {
    return Boolean(p.fullName && p.phone && p.street1 && p.city && p.state && p.zip);
}
