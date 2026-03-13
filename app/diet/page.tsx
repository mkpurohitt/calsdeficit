"use client";
import { useState } from "react";
import AppLayout from "../../components/AppLayout";
import { Droplet, Camera, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DietPage() {
  const router = useRouter();
  // State to check if user has filled out their initial data
  const [isOnboarded, setIsOnboarded] = useState(false); 
  const [waterGlasses, setWaterGlasses] = useState(0);

  // If not onboarded, show the setup form
  if (!isOnboarded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="bg-[#0a1f1c] border border-gray-800 p-8 rounded-3xl w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-2">Let's set your goals 🎯</h2>
            <p className="text-gray-400 mb-6 text-sm">We need some details to calculate your daily calories.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); setIsOnboarded(true); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Age</label>
                  <input type="number" placeholder="25" className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl p-3 mt-1 focus:border-[#00ff9d] outline-none" required />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Weight (kg)</label>
                  <input type="number" placeholder="75" className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl p-3 mt-1 focus:border-[#00ff9d] outline-none" required />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Height (cm)</label>
                <input type="number" placeholder="175" className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl p-3 mt-1 focus:border-[#00ff9d] outline-none" required />
              </div>
              <div>
                <label className="text-sm text-gray-400">Primary Goal</label>
                <select className="w-full bg-[#112926] text-white border border-gray-700 rounded-xl p-3 mt-1 focus:border-[#00ff9d] outline-none">
                  <option>Lose Weight</option>
                  <option>Maintain Weight</option>
                  <option>Build Muscle</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#00ff9d] text-black font-bold py-3.5 rounded-xl mt-4 hover:bg-[#00cc7d] transition-all">
                Calculate My Plan
              </button>
            </form>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Once onboarded, show the Diet Dashboard
  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Today's Diet</h2>
            <p className="text-gray-400">1,200 / 2,400 kcal remaining</p>
          </div>
          {/* Shortcut to the Home Tab with Food Scanner active */}
          <button 
            onClick={() => router.push('/?mode=food')} 
            className="flex items-center gap-2 bg-[#00ff9d] text-black px-4 py-2 rounded-full font-semibold hover:bg-[#00cc7d] transition-all"
          >
            <Camera size={18} /> Scan Food
          </button>
        </header>

        {/* Water Tracker */}
        <div className="bg-[#0a1f1c] border border-gray-800 p-5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full">
              <Droplet size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Water Intake</h3>
              <p className="text-sm text-gray-400">{waterGlasses} / 8 glasses</p>
            </div>
          </div>
          <button onClick={() => setWaterGlasses(prev => prev + 1)} className="p-2 bg-[#112926] hover:bg-gray-700 rounded-full text-[#00ff9d] transition-all">
            <Plus size={20} />
          </button>
        </div>

        {/* Placeholder for Daily Logged Meals */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-300">Logged Meals</h3>
          <div className="bg-[#112926] border border-gray-800 p-4 rounded-xl flex justify-between items-center">
            <div>
              <p className="text-white font-medium">Oatmeal & Protein Shake</p>
              <p className="text-xs text-gray-400">450 kcal • 30g Protein</p>
            </div>
            <span className="text-xs font-bold text-[#00ff9d]">Breakfast</span>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}