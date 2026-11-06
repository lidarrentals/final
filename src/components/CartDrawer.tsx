import React, { useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/pricing';
import { navigate } from '@/lib/router';
import { X, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';

export default function CartDrawer() {
    const { items, isOpen, setIsOpen, removeFromCart, clearCart } = useCart();

    // Close drawer if user presses Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, setIsOpen]);

    // Calculate shopping matrix totals
    const subtotal = items.reduce((sum, item) => {
        return sum + (item.equipment.price_1day * item.rentalDays * item.quantity);
    }, 0);

    return (
        <>
        {/* Background Overlay Dimmer */ }
        < div 
        className = {`fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`
}
onClick = {() => setIsOpen(false)}
      />

{/* Slide-out Sidebar Layout Container */ }
<div 
        className={
    `fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-100 z-50 flex flex-col justify-between transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'
    }`
}
      >
{/* Drawer Header Area */ }
    < div className = "p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50" >
        <div className="flex items-center gap-2.5" >
            <ShoppingBag className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-black text-slate-900" > Your Lease Reservation </h2>
                    < span className = "text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full border border-blue-100" >
                    { items.length } item{ items.length !== 1 ? 's' : '' }
</span>
    </div>
    < button
onClick = {() => setIsOpen(false)}
className = "p-1.5 text-slate-400 hover:text-slate-900 bg-transparent hover:bg-slate-100 rounded-xl transition cursor-pointer border-0"
    >
    <X className="w-5 h-5" />
        </button>
        </div>

{/* Drawer Line Item Content Area */ }
<div className="flex-1 overflow-y-auto p-6 space-y-4" >
{
    items.length === 0 ? (
        <div className= "h-full flex flex-col items-center justify-center text-center space-y-3 py-20" >
        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-2xl shadow-sm">🛒</div>
    < div >
    <h4 className="font-bold text-slate-800 text-sm" > Lease allocation queue is empty </h4>
        < p className = "text-xs text-slate-400 mt-1 max-w-[200px]" > Select deployment dates and add items from our equipment catalog.</p>
            </div>
            </div>
          ) : (
    items.map((item) => (
        <div key= { item.id } className = "flex gap-4 p-4 border border-slate-100 rounded-2xl bg-white hover:border-slate-200/80 transition shadow-sm relative group" >
        <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 shrink-0" >
    {
        item.equipment.image_url ? (
            <img src= { item.equipment.image_url } alt={ item.equipment.name } className="w-full h-full object-cover" />
                  ) : (
    <div className= "w-full h-full flex items-center justify-center text-slate-300 text-xl" >📦</div>
                  )}
</div>

    < div className = "flex-1 flex flex-col justify-between min-w-0 pr-4" >
        <div>
        <h4 className="font-bold text-slate-900 text-sm truncate" > { item.equipment.name } </h4>
            < div className = "flex items-center gap-1.5 text-xs text-slate-400 mt-0.5" >
                <span>Qty: { item.quantity } </span>
                    <span>•</span>
                        < span > { item.rentalDays } days({ item.startDate } to { item.endDate }) </span>
                            </div>
                            </div>
                            < div className = "font-bold text-slate-800 text-xs mt-1" >
                                Total: { formatCurrency(item.equipment.price_1day * item.rentalDays * item.quantity) }
</div>
    </div>

    < button
onClick = {() => removeFromCart(item.id)}
className = "absolute right-3 top-3 p-1.5 text-slate-400 hover:text-red-500 bg-transparent rounded-lg hover:bg-red-50/50 opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer border-0"
    >
    <Trash2 className="w-4 h-4" />
        </button>
        </div>
            ))
          )}
</div>

{/* Drawer Footer Checkout Action Bar */ }
{
    items.length > 0 && (
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4" >
            <div className="flex items-center justify-between text-sm" >
                <span className="text-slate-500 font-medium" > Estimated Lease Subtotal </span>
                    < span className = "text-xl font-black text-slate-900" > { formatCurrency(subtotal) } </span>
                        </div>

                        < div className = "grid grid-cols-1 gap-2.5" >
                            <button 
                onClick={
        () => {
            setIsOpen(false);
            navigate('/checkout');
        }
    }
    className = "w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md flex items-center justify-center gap-2 cursor-pointer border-0 text-sm"
        >
        <span>Proceed to Allocation Checkout </span>
            < ArrowRight className = "w-4 h-4" />
                </button>

                < button
    onClick = { clearCart }
    className = "w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-transparent cursor-pointer border-0 transition"
        >
        Clear All Reserved Line Items
            </button>
            </div>
            </div>
        )
}

</div>
    </>
  );
}
