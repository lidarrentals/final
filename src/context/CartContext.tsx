import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Equipment } from '@/types';

interface CartItem {
    id: string;
    equipment: Equipment;
    rentalDays: number;
    startDate: string;
    endDate: string;
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    addToCart: (equipment: Equipment, rentalDays: number, startDate: string, endDate: string, quantity: number) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem('lidar_cart_items');
        return saved ? JSON.parse(saved) : [];
    });
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('lidar_cart_items', JSON.stringify(items));
    }, [items]);

    const addToCart = (equipment: Equipment, rentalDays: number, startDate: string, endDate: string, quantity: number) => {
        setItems(prev => {
            const existingIndex = prev.findIndex(i => i.equipment.id === equipment.id && i.startDate === startDate);
            if (existingIndex > -1) {
                const next = [...prev];
                next[existingIndex].quantity += quantity;
                return next;
            }
            return [...prev, {
                id: `${equipment.id}-${Date.now()}`,
                equipment,
                rentalDays,
                startDate,
                endDate,
                quantity
            }];
        });

        // Explicitly triggers the visibility frame drawer state mutation layout view slide-in
        setIsOpen(true);
    };

    const removeFromCart = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const clearCart = () => {
        setItems([]);
    };

    return (
        <CartContext.Provider value= {{ items, isOpen, setIsOpen, addToCart, removeFromCart, clearCart }
}>
{ children }
    </CartContext.Provider>
  );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
}
