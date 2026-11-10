import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, UserCircle2, ExternalLink } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { navigate } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import { apiFetch, formatAddress, loadProfile, type OrderSummary } from '@/lib/api';
import { formatCurrency } from '@/lib/pricing';
import ShippingCalculator, { type DeliveryAddress } from '@/components/ShippingCalculator';
import CheckoutSummary from '@/components/CheckoutSummary';

export default function CheckoutPage() {
    const { items: rawCartItems, clearCart } = useCart();
    const [success, setSuccess] = useState(false);
    const [orderId, setOrderId] = useState<string>('');
    const [confirmedOrder, setConfirmedOrder] = useState<OrderSummary | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [shippingCost, setShippingCost] = useState<number>(0);

    const [signedIn, setSignedIn] = useState(false);
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [saveToProfile, setSaveToProfile] = useState(true);

    const [form, setForm] = useState({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        company: '',
    });

    const [address, setAddress] = useState<DeliveryAddress>({
        name: '', street1: '', city: '', state: '', zip: '', country: 'CA',
    });

    // Price cart lines the same way the cart drawer does (daily rate x days x quantity)
    const cartItems = rawCartItems.map(item => ({
        id: item.equipment.id,
        name: item.equipment.name,
        quantity: item.quantity,
        rentalPeriod: item.rentalDays,
        startDate: item.startDate,
        endDate: item.endDate,
        unitPrice: item.equipment.price_1day * item.rentalDays,
        lineTotal: item.equipment.price_1day * item.rentalDays * item.quantity,
    }));
    const cartTotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);

    // Force a test item if the cart is empty so the page loads for testing
    const items = cartItems.length > 0 ? cartItems : [
        {
            id: "prod_test_123",
            name: "Velodyne Puck VLP-16 (Mock Test Item)",
            quantity: 1,
            rentalPeriod: 5,
            startDate: "2026-10-31",
            endDate: "2026-11-05",
            lineTotal: 750.00
        }
    ];

    const total = cartItems.length > 0 ? cartTotal : 750.00;

    // Prefill contact and delivery details from the signed-in customer's saved profile
    useEffect(() => {
        let cancelled = false;
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session || cancelled) return;
            setSignedIn(true);
            const result = await loadProfile().catch(() => null);
            if (!result || cancelled) return;
            const p = result.profile;
            setForm(f => ({
                customer_name: f.customer_name || p.fullName,
                customer_email: f.customer_email || session.user.email || '',
                customer_phone: f.customer_phone || p.phone,
                company: f.company || p.company,
            }));
            setAddress(a => a.street1 ? a : {
                name: p.fullName, street1: p.street1, city: p.city, state: p.state, zip: p.zip, country: p.country || 'CA',
            });
            setProfileLoaded(true);
        });
        return () => { cancelled = true; };
    }, []);

    // Catch returning users from Stripe and display the Order Received screen
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
        if (urlParams.get('success') !== 'true') return;

        const reference = urlParams.get('order_id') || '';
        const sessionId = urlParams.get('session_id') || '';
        setOrderId(reference);
        setSuccess(true);
        clearCart();
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash.split('?')[0]);

        if (reference) {
            setConfirming(true);
            apiFetch(`/api/orders/confirm?order_id=${encodeURIComponent(reference)}&session_id=${encodeURIComponent(sessionId)}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => data?.order && setConfirmedOrder(data.order))
                .catch(() => { })
                .finally(() => setConfirming(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const shippingAddress = formatAddress(address);

    const validate = () => {
        if (!form.customer_name.trim()) return 'Please enter your full name.';
        if (!form.customer_email.trim()) return 'Please enter your email address.';
        if (!address.street1 || !address.city || !address.zip) return 'Please enter your delivery address.';
        return null;
    };

    if (success) {
        const o = confirmedOrder;
        return (
            <div className="max-w-2xl mx-auto px-4 py-16 text-center">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-6" />
                <h2 className="text-3xl font-bold text-slate-900">Order Received!</h2>
                {orderId && (
                    <p className="text-xl text-slate-600 mt-3">Order Reference: <strong className="text-blue-600 font-mono">{orderId}</strong></p>
                )}

                {confirming && (
                    <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin" /> Confirming payment with Stripe…
                    </p>
                )}

                {o && (
                    <div className="my-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left max-w-md mx-auto text-sm text-slate-600 space-y-1">
                        <p><strong>Customer:</strong> {o.customerName}</p>
                        <p><strong>Email:</strong> {o.customerEmail}</p>
                        <p><strong>Delivery Site:</strong> {o.shippingAddress || '—'}</p>
                        <p><strong>Total:</strong> {formatCurrency(o.total)}</p>
                        <p>
                            <strong>Payment:</strong>{' '}
                            {o.status === 'paid' ? <span className="text-green-700 font-semibold">Confirmed by Stripe</span>
                                : o.status === 'test' ? <span className="text-amber-700 font-semibold">Test order (no charge)</span>
                                    : <span className="text-amber-700 font-semibold">Processing</span>}
                        </p>
                        {o.stripePaymentIntentId && <p className="font-mono text-xs break-all">Stripe ref: {o.stripePaymentIntentId}</p>}
                        {o.stripeReceiptUrl && (
                            <a href={o.stripeReceiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline pt-1">
                                View Stripe receipt <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        )}
                    </div>
                )}

                <p className="text-sm text-slate-500 mt-2">A confirmation email and rental equipment dispatch checklist have been prepared.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    {signedIn && (
                        <button onClick={() => navigate('/account')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">View My Orders</button>
                    )}
                    <button onClick={() => navigate('/')} className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition">Back to Home</button>
                </div>
            </div>
        );
    }

    const inputClass = "w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm";

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <button onClick={() => navigate('/equipment')} className="flex items-center gap-1 text-sm text-slate-500 mb-6">
                <ArrowLeft className="w-4 h-4" /> Continue shopping
            </button>
            <h1 className="text-3xl font-bold text-slate-900 mb-8">Checkout</h1>
            <div className="grid lg:grid-cols-2 gap-8">

                {/* Left Side: Contact Information and Shipping Calculator */}
                <div className="space-y-5">
                    {!signedIn && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl border border-blue-100 bg-blue-50 text-sm text-slate-700">
                            <UserCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                            <span>
                                <a href="#/account?mode=login" className="font-semibold text-blue-600 hover:underline">Sign in</a> to fill in your saved details automatically and track this order in your dashboard.
                            </span>
                        </div>
                    )}
                    {signedIn && profileLoaded && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-100 bg-green-50 text-sm text-slate-700">
                            <UserCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            <span>Your saved profile details have been filled in. <a href="#/account" className="font-semibold text-blue-600 hover:underline">Edit profile</a></span>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 p-6">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Contact Information</h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                                <input required type="text" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className={inputClass} placeholder="John Smith" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                                <input required type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} className={inputClass} placeholder="john@company.com" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                                <input type="tel" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} className={inputClass} placeholder="(555) 123-4567" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                                <input type="text" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={inputClass} placeholder="Company name" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <ShippingCalculator
                            address={address}
                            onAddressChange={setAddress}
                            onRateSelect={(amount) => setShippingCost(amount)}
                            autoCalculateKey={profileLoaded ? 'profile' : undefined}
                        />
                    </div>

                    {signedIn && (
                        <label className="flex items-center gap-2 text-sm text-slate-600 px-1">
                            <input type="checkbox" checked={saveToProfile} onChange={e => setSaveToProfile(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                            Save these details to my profile for next time
                        </label>
                    )}
                </div>

                {/* Right Side: Order Summary with nested Stripe Payment Button inside */}
                <div>
                    <CheckoutSummary
                        items={items}
                        total={total}
                        shippingCost={shippingCost}
                        validate={validate}
                        checkoutDetails={{
                            customer: { name: form.customer_name, email: form.customer_email, phone: form.customer_phone, company: form.company },
                            address: { street1: address.street1, city: address.city, state: address.state, zip: address.zip, country: address.country },
                            shippingAddress,
                            saveToProfile: signedIn && saveToProfile,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
