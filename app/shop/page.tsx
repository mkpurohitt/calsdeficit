"use client";
import AppLayout from "../../components/AppLayout";
import { ShoppingCart, Star } from "lucide-react";

export default function ShopPage() {
  const products = [
    { id: 1, name: "Premium Vegan Protein", price: "₹2,499", rating: 4.8, type: "Nutrition", img: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&q=80&w=400" },
    { id: 2, name: "Calolean Shaker Bottle", price: "₹499", rating: 4.9, type: "Accessories", img: "https://images.unsplash.com/photo-1622542796254-5cb9cece25c8?auto=format&fit=crop&q=80&w=400" },
    { id: 3, name: "Pre-Workout Energy", price: "₹1,899", rating: 4.7, type: "Nutrition", img: "https://images.unsplash.com/photo-1579722820308-d74e571900a9?auto=format&fit=crop&q=80&w=400" },
    { id: 4, name: "Lifting Straps", price: "₹399", rating: 4.6, type: "Gear", img: "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&q=80&w=400" }
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <header className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Calolean Shop</h2>
            <p className="text-gray-400">Fuel your progress.</p>
          </div>
          <button className="relative p-2 bg-[#112926] text-white rounded-full hover:bg-gray-700 transition-colors">
            <ShoppingCart size={24} />
            <span className="absolute top-0 right-0 bg-[#00ff9d] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">2</span>
          </button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-[#0a1f1c] border border-gray-800 rounded-2xl overflow-hidden hover:border-[#00ff9d] transition-colors group cursor-pointer flex flex-col">
              <div className="h-40 overflow-hidden relative">
                <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 text-xs text-yellow-400 font-bold">
                  <Star size={12} className="fill-yellow-400" /> {product.rating}
                </div>
              </div>
              <div className="p-4 flex flex-col flex-1">
                <span className="text-xs text-[#00ff9d] font-semibold mb-1">{product.type}</span>
                <h3 className="text-white font-medium text-sm mb-2 leading-tight flex-1">{product.name}</h3>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-lg font-bold text-white">{product.price}</span>
                  <button className="bg-[#112926] p-2 rounded-lg text-white group-hover:bg-[#00ff9d] group-hover:text-black transition-colors">
                    <ShoppingCart size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}