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
const [unavailableDates, setUnavailableDates] = useState<string[]>([]);
const [stockQuantity, setStockQuantity] = useState(1);
const [availabilityLoading, setAvailabilityLoading] = useState(false);
const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
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
const checkUserAuth = async () => {
try {
const { data: { session } } = await supabase.auth.getSession();
setIsLoggedIn(!!session?.user);
} catch {
setIsLoggedIn(false);
}
};
checkUserAuth();
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
const url = '/api/availability?equipmentId=' + encodeURIComponent(productId);
const res = await fetch(url);
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
const upcomingBlockedRanges = useMemo(() => {
const future = unavailableDates.filter((d) => d >= today);
if (future.length === 0) return [];
const ranges: { start: string; end: string }[] = [];
let rangeStart = future.at(0) || '';
let prev = future.at(0) || '';
for (let i = 1; i < future.length; i++) {
const current = future.at(i) || '';
if (current === addDays(prev, 1)) {
prev = current;
} else {
ranges.push({ start: rangeStart, end: prev });
rangeStart = current;
prev = current;
}
}
ranges.push({ start: rangeStart, end: prev });
return ranges.slice(0, 5);
}, [unavailableDates, today]);
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
return ;
}
if (!equipment) {
return (

Equipment item record not found
<button onClick={() => navigate('/equipment')} className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">
Return to Catalog


);
}
const availablePoolCount = Math.max(1, stockQuantity || equipment.quantity || 1);
return (

<button onClick={() => navigate('/equipment')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors group">

Back to Equipment Catalog
{equipment.image_url ? (

) : (
📦
)}


Technical Specifications
{equipment.description}

Professional Asset

{equipment.name}
Serial SKU ID: {equipment.id.slice(0, 8).toUpperCase()}
Daily Standard Lease Rate
{isLoggedIn ? (

{formatCurrency(equipment.price_1day)} / day

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
