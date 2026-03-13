"use client";
import AppLayout from "../../components/AppLayout";
import { useAuth } from "../../lib/AuthContext";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import { Settings, User, Bell, Shield, CreditCard, LogOut, ChevronRight } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth() as { user: any };
  const router = useRouter();

  const handleLogout = () => {
    auth.signOut();
    router.push("/login");
  };

  const menuItems = [
    { icon: User, label: "Personal Information" },
    { icon: CreditCard, label: "Subscription & Billing" },
    { icon: Bell, label: "Notifications" },
    { icon: Shield, label: "Privacy & Security" },
    { icon: Settings, label: "App Settings" },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        
        {/* Profile Card */}
        <div className="bg-[#0a1f1c] border border-gray-800 p-6 rounded-3xl flex items-center gap-6">
          <div className="w-20 h-20 bg-[#112926] rounded-full flex items-center justify-center text-[#00ff9d] text-2xl font-bold border-2 border-[#00ff9d]">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{user?.displayName || "Fitness Enthusiast"}</h2>
            <p className="text-gray-400 text-sm">{user?.email}</p>
            <div className="mt-2 inline-block bg-[#00ff9d]/20 text-[#00ff9d] text-xs font-bold px-3 py-1 rounded-full border border-[#00ff9d]/50">
              PRO MEMBER
            </div>
          </div>
        </div>

        {/* Menu List */}
        <div className="bg-[#0a1f1c] border border-gray-800 rounded-2xl overflow-hidden">
          {menuItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border-b border-gray-800/50 hover:bg-[#112926] transition-colors cursor-pointer last:border-0">
              <div className="flex items-center gap-4 text-gray-300">
                <item.icon size={20} className="text-gray-500" />
                <span className="font-medium">{item.label}</span>
              </div>
              <ChevronRight size={18} className="text-gray-600" />
            </div>
          ))}
        </div>

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full bg-[#112926] border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
        >
          <LogOut size={20} /> Sign Out
        </button>

      </div>
    </AppLayout>
  );
}