"use client";
import React from "react";
import { MessageSquare, Utensils, ShoppingBag, Dumbbell, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Chat AI", href: "/", icon: MessageSquare },
    { name: "Diet", href: "/diet", icon: Utensils },
    { name: "Shop", href: "/shop", icon: ShoppingBag },
    { name: "Exercise", href: "/exercise", icon: Dumbbell },
    { name: "Profile", href: "/profile", icon: User },
  ];

  return (
    <div className="flex h-screen bg-[#05110f] text-white overflow-hidden">
      
      {/* Sidebar for Desktop */}
      <nav className="w-64 bg-[#0a1f1c] border-r border-gray-800 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">Calolean</h1>
        </div>
        
        <div className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive ? "bg-[#00ff9d] text-black font-bold" : "text-gray-400 hover:bg-[#112926] hover:text-[#00ff9d]"
                }`}
              >
                <item.icon size={20} />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-[#0a1f1c] border-t border-gray-800 flex justify-around p-3 z-50 safe-area-pb">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} className={`flex flex-col items-center p-2 rounded-xl transition-all ${isActive ? "text-[#00ff9d]" : "text-gray-500 hover:text-gray-300"}`}>
              <item.icon size={24} className={isActive ? "fill-[#00ff9d]/20" : ""} />
              <span className="text-[10px] mt-1 font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}