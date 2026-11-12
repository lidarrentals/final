import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, Loader2, Package, Save, UserCircle2, History, AlertCircle } from 'lucide-react';
import { emptyProfile, isProfileComplete, loadOrders, loadProfile, saveProfile, type CustomerProfile, type OrderSummary } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/pricing';

const todayISO = () => new Date().toISOString().slice(0, 10);

function safeDate(v: string | null | undefined) {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : formatDate(d);
}

function PaymentBadge({ status }: { status: OrderSummary['paymentStatus'] }) {
    if (status === 'paid') {
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Paid · verified by Stripe</span>;
    }
    if (status === 'review') {
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold"><AlertCircle className="w-3.5 h-3.5" /> Payment under review</span>;
    }
    if (status === 'failed') {
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold"><AlertCircle className="w-3.5 h-3.5" /> Payment failed</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold"><Clock className="w-3.5 h-3.5" /> Awaiting payment</span>;
}

const FULFILMENT: Record<string, string> = { pending: 'Pending review', confirmed: 'Confirmed', shipped: 'Shipped', returned: 'Returned' };

function OrderCard({ order }: { order: OrderSummary }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="font-mono font-semibold text-blue-600">{order.reference}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Placed {safeDate(order.createdAt)} · Rental {safeDate(order.rentalStart)} – {safeDate(order.rentalEnd)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <PaymentBadge status={order.paymentStatus} />
                    <span className="text-xs text-slate-500">Order status: {FULFILMENT[order.status] || order.status}</span>
                </div>
            </div>

            <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {order.items.map((item, i) => (
                    <li key={i} className="py-2 flex justify-between gap-4">
                        <span className="text-slate-700">{item.quantity}× {item.name}</span>
                        <span className="font-medium text-slate-900">{formatCurrency(item.lineTotal)}</span>
                    </li>
                ))}
                {order.shipping > 0 && (
                    <li className="py-2 flex justify-between gap-4">
                        <span className="text-slate-700">Round-trip delivery</span>
                        <span className="font-medium text-slate-900">{formatCurrency(order.shipping)}</span>
                    </li>
                )}
            </ul>

            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end justify-between gap-3 text-sm">
                <div className="text-slate-500 space-y-0.5">
                    {order.shippingAddress && <p><span className="font-medium text-slate-700">Delivery:</span> {order.shippingAddress}</p>}
                    {order.paymentStatus === 'paid' && (
                        <p>
                            <span className="font-medium text-slate-700">Payment confirmed:</span> {safeDate(order.paidAt)}
                            {order.stripePaymentIntentId && <span className="font-mono text-xs ml-1">({order.stripePaymentIntentId})</span>}
                        </p>
                    )}
                    {order.trackingNumber && <p><span className="font-medium text-slate-700">Tracking:</span> {order.trackingCarrier} {order.trackingNumber}</p>}
                    {order.invoiceUrl && (
                        <a href={order.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline mr-4">
                            Invoice <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                    {order.stripeReceiptUrl && (
                        <a href={order.stripeReceiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline">
                            Stripe receipt <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
                <p className="text-base font-bold text-slate-900">{formatCurrency(order.total)}</p>
            </div>
        </div>
    );
}

export default function AccountDashboard() {
    const [profile, setProfile] = useState<CustomerProfile>(emptyProfile);
    const [profileLoading, setProfileLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedMessage, setSavedMessage] = useState('');

    const [orders, setOrders] = useState<OrderSummary[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [ordersError, setOrdersError] = useState('');

    useEffect(() => {
        loadProfile()
            .then(res => res && setProfile({ ...emptyProfile, ...res.profile }))
            .finally(() => setProfileLoading(false));
        loadOrders()
            // Show paid orders, plus unpaid checkouts from the last day (hide abandoned ones)
            .then(rows => setOrders(rows.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'review'
                || (o.paymentStatus === 'unpaid' && Date.now() - new Date(o.createdAt).getTime() < 86_400_000))))
            .catch(() => setOrdersError('Could not load your orders right now.'))
            .finally(() => setOrdersLoading(false));
    }, []);

    const update = (field: keyof CustomerProfile) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setProfile(p => ({ ...p, [field]: e.target.value }));
        setSavedMessage('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const saved = await saveProfile(profile);
            setProfile({ ...emptyProfile, ...saved });
            setSavedMessage('Profile saved. These details will fill in automatically at checkout.');
        } catch (err: any) {
            setSavedMessage(err.message || 'Could not save profile.');
        } finally {
            setSaving(false);
        }
    };

    const today = todayISO();
    const currentOrders = orders.filter(o => !o.rentalEnd || o.rentalEnd.slice(0, 10) >= today);
    const pastOrders = orders.filter(o => o.rentalEnd && o.rentalEnd.slice(0, 10) < today);
    const complete = isProfileComplete(profile);
    const input = "w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
    const label = "block text-sm font-medium text-slate-700 mb-1.5";

    return (
        <div className="space-y-10">
            {/* Profile */}
            <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2"><UserCircle2 className="text-blue-600" /> My Profile</h2>
                    {!profileLoading && (
                        complete
                            ? <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">Profile complete</span>
                            : <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">Complete your profile for faster checkout</span>
                    )}
                </div>

                {profileLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : (
                    <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className={label}>Full Name *</label>
                                <input required className={input} value={profile.fullName} onChange={update('fullName')} placeholder="John Smith" />
                            </div>
                            <div>
                                <label className={label}>Company</label>
                                <input className={input} value={profile.company} onChange={update('company')} placeholder="Company name" />
                            </div>
                            <div>
                                <label className={label}>Phone *</label>
                                <input required type="tel" className={input} value={profile.phone} onChange={update('phone')} placeholder="(555) 123-4567" />
                            </div>
                            <div>
                                <label className={label}>Email</label>
                                <input disabled className={`${input} bg-slate-50 text-slate-500`} value={profile.email || ''} />
                            </div>
                        </div>

                        <h3 className="text-sm font-bold text-slate-800 pt-2">Default Delivery Address</h3>
                        <div>
                            <label className={label}>Street Address *</label>
                            <input required className={input} value={profile.street1} onChange={update('street1')} placeholder="123 Main Street" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="col-span-2 sm:col-span-1">
                                <label className={label}>City *</label>
                                <input required className={input} value={profile.city} onChange={update('city')} placeholder="Toronto" />
                            </div>
                            <div>
                                <label className={label}>Province *</label>
                                <input required className={input} value={profile.state} onChange={update('state')} placeholder="ON" />
                            </div>
                            <div>
                                <label className={label}>Postal Code *</label>
                                <input required className={input} value={profile.zip} onChange={update('zip')} placeholder="M5V 2T6" />
                            </div>
                            <div>
                                <label className={label}>Country</label>
                                <input className={input} value={profile.country} onChange={update('country')} placeholder="CA" />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
                            </button>
                            {savedMessage && <p className="text-sm text-slate-600">{savedMessage}</p>}
                        </div>
                    </form>
                )}
            </section>

            {/* Orders */}
            <section>
                <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><Package className="text-blue-600" /> Current Orders</h2>
                {ordersLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : ordersError ? (
                    <p className="text-sm text-red-600">{ordersError}</p>
                ) : currentOrders.length === 0 ? (
                    <p className="text-slate-500 text-sm bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-center">
                        No active rentals. <a href="#/equipment" className="text-blue-600 font-medium hover:underline">Browse equipment</a>
                    </p>
                ) : (
                    <div className="space-y-4">{currentOrders.map(o => <OrderCard key={o.reference} order={o} />)}</div>
                )}
            </section>

            {!ordersLoading && !ordersError && (
                <section>
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4"><History className="text-slate-500" /> Past Orders</h2>
                    {pastOrders.length === 0 ? (
                        <p className="text-slate-500 text-sm bg-slate-50 p-6 rounded-xl border border-dashed border-slate-200 text-center">No past orders yet.</p>
                    ) : (
                        <div className="space-y-4">{pastOrders.map(o => <OrderCard key={o.reference} order={o} />)}</div>
                    )}
                </section>
            )}
        </div>
    );
}
