import React from 'react';
import { User, ShoppingCart } from 'lucide-react';

export default function Header() {
    // Mock authentication state - change to your actual auth check variable if different
    const user = null;

    const handleNav = (path: string, mode?: string) => {
        if (mode) {
            // Correctly appends the route parameter to switch between login and register views
            window.location.hash = `${path}?mode=${mode}`;
        } else {
            window.location.hash = path;
        }
    };

    return (
        <header className= "w-full bg-slate-900 border-b border-slate-800 sticky top-0 z-50" >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" >
            <div className="flex items-center justify-between h-20" >

            {/* Logo / Brand Section */ }
                < div className = "flex items-center gap-3 cursor-pointer" onClick = {() => handleNav('/')
}>
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center" >
        <span className="text-white font-bold text-lg" > L </span>
            </div>
            < span className = "text-xl font-bold text-white" >
                lidar < span className = "text-blue-500" >.rentals </span>
                    </span>
                    </div>

{/* Navigation Links */ }
<nav className="hidden md:flex items-center gap-8" >
    <a href="#/equipment" className = "text-sm font-medium text-slate-300 hover:text-white transition" > Equipment </a>
        < a href = "#/services" className = "text-sm font-medium text-slate-300 hover:text-white transition" > Services </a>
            < a href = "#/about" className = "text-sm font-medium text-slate-300 hover:text-white transition" > About </a>
                < a href = "#/downloads" className = "text-sm font-medium text-slate-300 hover:text-white transition" > Downloads </a>
                    < a href = "#/reviews" className = "text-sm font-medium text-slate-300 hover:text-white transition" > Reviews </a>
                        </nav>

{/* Action Actions / Authentication Buttons */ }
<div className="flex items-center gap-4" >
    <button 
                            onClick={ () => handleNav('/cart') }
className = "p-2 text-slate-400 hover:text-white relative bg-transparent border-0 cursor-pointer"
    >
    <ShoppingCart className="w-5 h-5" />
        </button>

{
    !user ? (
        <>
        <button 
                                    onClick= {() => handleNav('/account', 'login')
}
className = "text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl transition cursor-pointer bg-transparent border-0"
    >
    Log In
        </button>
        < button
onClick = {() => handleNav('/account', 'register')}
className = "text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer border-0"
    >
    Register
    </button>
    </>
                        ) : (
    <button 
                                onClick= {() => handleNav('/account')}
className = "flex items-center gap-2 p-2 text-sm font-semibold text-blue-400 hover:text-blue-300 border border-slate-800 hover:border-slate-700 rounded-xl hover:bg-slate-800 transition-all cursor-pointer bg-transparent"
    >
    <User className="w-4 h-4" />
        <span>My Account </span>
            </button>
                        )}
</div>

    </div>
    </div>
    </header>
    );
}
