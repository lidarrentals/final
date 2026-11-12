import { useState, useEffect, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { Calendar, ShoppingCart, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing';
import { navigate } from '@/lib/router';
import type { Equipment } from '@/types';

function addDays(isoDate: string, days: number): string {
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return dt.toISOString().slice(0, 10);
}

export default function EquipmentDetailPage({ id }: { id?: string } = {}) {
    const { addToCart, setIsOpen } = useCart();

    const [equipment, setEquipment] = useState<Equipment | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [rentalDays, setRentalDays] = useState(1);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Live availability state
    const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
    const [stockQuantity, setStockQuantity] = useState<number>(1);
    const [availabilityLoading, setAvailabilityLoading] = useState(false);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

    // Extract the URL id parameter directly using native location methods
    const getNativeProductId = () => {
        const hash = window.location.hash || '';
        const parts = hash.split('/');
        return parts[parts.length - 1] || null;
    };

    useEffect(() => {
        const productId = id || getNativeProductId();
        if (productId) {
            fetchProductDetails(productId);
            fetchAvailability(productId);
        }

        // Explicit and safe session tracking
        const checkUserAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setIsLoggedIn(!!session?.user);
            } catch {
                setIsLoggedIn(false);
            }
        };

        checkUserAuth();

        // Listen to real-time auth changes if they log out
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsLoggedIn(!!session?.user);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [id]);

    useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            setRentalDays(diffDays);
        }
    }, [startDate, endDate]);

    const fetchProductDetails = async (productId: string) => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('equipment')
                .select('*')
                .eq('id', productId)
                .single();
            setEquipment(data);
            setStockQuantity(Number(data?.stock_quantity || data?.quantity || 1));
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const fetchAvailability = async (productId: string) => {
        setAvailabilityLoading(true);
        try {
            const res = await fetch(`/api/availability?equipmentId=${encodeURIComponent(productId)}`);
            if (res.ok) {
                const json = await res.json();
                setUnavailableDates(Array.isArray(json.unavailableDates) ? json.unavailableDates : []);
                if (typeof json.stockQuantity === 'number') {
                    setStockQuantity(json.stockQuantity);
                }
            }
        } catch (err) {
            console.error('Availability lookup failed', err);
        } finally {
            setAvailabilityLoading(false);
        }
    };

    // Check if chosen range (including 1-day shipping buffer before & after) overlaps unavailable dates
    const conflictingDates = useMemo(() => {
        if (!startDate || !endDate || endDate < startDate) return [];
        const blockedSet = new Set(unavailableDates);
        const conflicts: string[] = [];
        let cur = addDays(startDate, -1);
        const last = addDays(endDate, 1);
        while (cur <= last) {
            if (blockedSet.has(cur)) conflicts.push(cur);
            cur = addDays(cur, 1);
        }
        return conflicts;
    }, [startDate, endDate, unavailableDates]);

    const invalidRange = Boolean(startDate && endDate && endDate < startDate);
    const hasConflict = conflictingDates.length > 0;

    // Group upcoming unavailable dates into readable ranges
    const upcomingBlockedRanges = useMemo(() => {
        const future = unavailableDates.filter((d) => d >= today);
        if (future.length === 0) return [];
        const ranges: { start: string; end: string }[] = [];
        let rangeStart = future[0];
        let prev = future[0];
        for (let i = 1; i < future.length; i++) {
            if (future[i] === addDays(prev, 1)) {
                prev = future[i];
            } else {
                ranges.push({ start: rangeStart, end: prev });
                rangeStart = future[i];
                prev = future[i];
            }
        }
        ranges.push({ start: rangeStart, end: prev });
        return ranges.slice(0, 5);
    }, [unavailableDates, today]);

    // Add the item to the cart and go straight to checkout (shipping, then payment)
    const handleReserve = () => {
        if (!equipment) return;
        if (!startDate || !endDate) {
            alert('Please select your rental start and end dates first.');
            return;
        }
        if (invalidRange) {
            alert('Lease Return date must be on or after Lease Start.');
            return;
        }
        if (hasConflict) {
            alert('Those dates overlap with an existing booking or 1-day shipping buffer. Please select different dates.');
            return;
        }
        addToCart(equipment, rentalDays, startDate, endDate, quantity);
        setIsOpen(false);
        navigate('/checkout');
    };

    if (loading) {
        return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" /></div>;
    }

    if (!equipment) {
        return (
            <div className="max-w-md mx-auto my-20 text-center">
                <h3 className="text-lg font-bold text-slate-900">Equipment item record not found</h3>
                <button onClick={() => navigate('/equipment')} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
                    Return to Catalog
                </button>
            </div>
        );
    }

    const availablePoolCount = Math.max(1, stockQuantity || equipment.quantity || 1);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button onClick={() => navigate('/equipment')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors group">
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to Equipment Catalog</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
                <div className="space-y-4">
                    <div className="aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                        {equipment.image_url ? (
                            <img src={equipment.image_url} alt={equipment.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300 text-6xl">📦</div>
                        )}
                    </div>
                    <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed pt-2">
                        <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider mb-2">Technical Specifications</h3>
                        <p>{equipment.description}</p>
                    </div>
                </div>

                <div className="flex flex-col justify-between h-full space-y-6">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 inline-block mb-3">
                            Professional Asset
                        </span>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{equipment.name}</h1>
                        <p className="text-sm text-slate-400 font-mono mt-1">Serial SKU ID: {equipment.id.slice(0, 8).toUpperCase()}</p>

                        <div className="my-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between">
                            <div>
                                <span className="text-xs text-slate-400 block font-medium">Daily Standard Lease Rate</span>
                                {isLoggedIn ? (
                                    <span className="text-2xl font-black text-slate-900 mt-0.5">
                                        {formatCurrency(equipment.price_1day)} <span className="text-xs text-slate-500 font-normal">/ day</span>
                                    </span>
                                ) : (
Gated: Authorized Accounts Only
)}


Availability Pool

{availablePoolCount} units ready


Lease Start
<input
type="date"
min={today}
value={startDate}
onChange={(e) => {
setStartDate(e.target.value);
if (endDate && e.target.value > endDate) setEndDate('');
}}
className="w-full p-2.5 border rounded-xl text-sm bg-white"
/>

Lease Return
<input
type="date"
min={startDate || today}
value={endDate}
onChange={(e) => setEndDate(e.target.value)}
className="w-full p-2.5 border rounded-xl text-sm bg-white"
/>

{invalidRange && (


Lease Return date must be on or after Lease Start.

)}
{!invalidRange && hasConflict && (



Unavailable for these dates (includes 1-day courier transit & inspection buffer before and after bookings). Please choose another window.


)}
{!invalidRange && !hasConflict && startDate && endDate && (


Dates available!

)}
{availabilityLoading ? 'Checking live calendar...' : 'Calendar Availability (incl. 1-day shipping buffer)'}

{upcomingBlockedRanges.length === 0 ? (
All upcoming dates are currently open.
) : (

{upcomingBlockedRanges.map((r, idx) => (

• Unavailable: {r.start} to {r.end}

))}

)}
Lease Quantity (Units)
<select
value={quantity}
onChange={(e) => setQuantity(Number(e.target.value))}
className="w-full p-2.5 border rounded-xl text-sm bg-white cursor-pointer font-semibold"
>
{[...Array(availablePoolCount)].map((_, i) => (
<option key={i + 1} value={i + 1}>
{i + 1} Unit{i > 0 ? 's' : ''}

))}



{startDate && endDate && (

Timeline Duration Summary:
{rentalDays} rental operation days

)}
{isLoggedIn ? (
<button
onClick={handleReserve}
disabled={hasConflict || invalidRange}
className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 group cursor-pointer text-sm"
>
{hasConflict ? 'Dates Unavailable' : 'Reserve Equipment'}

) : (
<button
onClick={() => navigate('/account')}
className="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
>
Log In / Register to View Rates

)}




);
}
