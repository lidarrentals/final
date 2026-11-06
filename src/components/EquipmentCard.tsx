import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/pricing';
import { navigate } from '@/lib/router';
import type { Equipment } from '@/types';

export default function EquipmentCard(props: any) {
    const targetItem =
        props.item ||
        props.equipment ||
        props.equipmentItem ||
        props.data ||
        Object.values(props).find((val: any) => val && typeof val === 'object' && 'id' in val && 'name' in val) as Equipment;

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setIsLoggedIn(!!session?.user);
            } catch (err) {
                setIsLoggedIn(false);
            }
        };
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsLoggedIn(!!session?.user);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (!targetItem) {
        return (
            <div className= "bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm flex flex-col items-center justify-center min-h-[250px]" >
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" > </div>
                < span className = "text-xs font-semibold text-slate-400 tracking-wide uppercase" > Verifying Asset Record Mapping...</span>
                    </div>
    );
    }

    return (
        <div className= "bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col h-full" >
        <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden group cursor-pointer" onClick = {() => navigate(`/equipment/${targetItem.id}`)
}>
    {
        targetItem.image_url ? (
            <img 
            src= { targetItem.image_url } 
            alt={ targetItem.name } 
            className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
        />
        ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl" >📦</div>
        )}
</div>

    < div className = "p-5 flex flex-col justify-between flex-grow" >
        <div>
        <h3 
            className="font-bold text-slate-900 text-lg hover:text-blue-600 transition cursor-pointer line-clamp-1"
onClick = {() => navigate(`/equipment/${targetItem.id}`)}
          >
{ targetItem.name }
    </h3>
    < p className = "text-slate-500 text-sm mt-1 line-clamp-2 min-h-[40px]" >
    { targetItem.description }
        </p>
        </div>

        < div className = "mt-5 pt-4 border-t border-slate-100 flex items-center justify-between" >
            <div>
            <span className="text-xs text-slate-400 block font-medium" > Daily Rate </span>
{
    isLoggedIn ? (
        <span className= "text-xl font-black text-slate-900 mt-0.5" >
        { formatCurrency(targetItem.price_1day) }
        </span>
            ) : (
        <span className= "text-xs font-semibold text-blue-600 block mt-1.5 bg-blue-50/70 px-2.5 py-1 rounded-lg border border-blue-100" >
        Login to view pricing
            </span>
            )
}
</div>

    < button
onClick = {() => navigate(`/equipment/${targetItem.id}`)}
className = "px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer border-0"
    >
    View Details
        </button>
        </div>
        </div>
        </div>
  );
}
