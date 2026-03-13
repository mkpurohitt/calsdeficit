"use client";
import AppLayout from "../../components/AppLayout";
import { PlayCircle, Footprints, Flame, Timer, Video } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ExercisePage() {
  const router = useRouter();
  
  // Mock data for the UI
  const steps = 6430;
  const stepGoal = 10000;
  
  const todayWorkout = [
    { name: "Barbell Squats", sets: "4 x 8-10", completed: true },
    { name: "Leg Press", sets: "3 x 10-12", completed: false },
    { name: "Romanian Deadlifts", sets: "3 x 10", completed: false },
  ];

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        
        {/* Header & AI Shortcut */}
        <header className="flex justify-between items-center bg-[#0a1f1c] p-6 rounded-3xl border border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Leg Day 🦵</h2>
            <p className="text-gray-400 text-sm">45 mins • Hypertrophy</p>
          </div>
          <button 
            onClick={() => router.push('/?mode=gym')}
            className="flex items-center gap-2 bg-[#ff0000] text-white px-4 py-2 rounded-full font-bold hover:bg-[#cc0000] transition-all shadow-lg shadow-red-500/20"
          >
            <Video size={18} /> Check Form
          </button>
        </header>

        {/* Google Fit Steps Integration (UI) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#0a1f1c] border border-gray-800 p-5 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 text-[#00ff9d] mb-2">
              <Footprints size={20} /> <span className="font-semibold">Steps</span>
            </div>
            <p className="text-3xl font-bold text-white">{steps.toLocaleString()}</p>
            <div className="w-full bg-[#112926] rounded-full h-1.5 mt-3">
              <div className="bg-[#00ff9d] h-1.5 rounded-full" style={{ width: `${(steps/stepGoal)*100}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Goal: {stepGoal.toLocaleString()}</p>
          </div>

          <div className="grid grid-rows-2 gap-4">
            <div className="bg-[#0a1f1c] border border-gray-800 p-4 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg"><Flame size={20}/></div>
              <div>
                <p className="text-sm text-gray-400">Active Burn</p>
                <p className="text-lg font-bold text-white">420 kcal</p>
              </div>
            </div>
            <div className="bg-[#0a1f1c] border border-gray-800 p-4 rounded-2xl flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><Timer size={20}/></div>
              <div>
                <p className="text-sm text-gray-400">Active Time</p>
                <p className="text-lg font-bold text-white">52 min</p>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Workout Routine */}
        <div>
          <h3 className="text-lg font-bold text-white mb-3">Today's Plan</h3>
          <div className="space-y-3">
            {todayWorkout.map((exercise, idx) => (
              <div key={idx} className="bg-[#112926] border border-gray-800 p-4 rounded-xl flex items-center justify-between hover:border-gray-600 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${exercise.completed ? 'bg-[#00ff9d] border-[#00ff9d]' : 'border-gray-500'}`}>
                    {exercise.completed && <div className="w-2 h-2 bg-black rounded-full" />}
                  </div>
                  <div>
                    <p className={`font-semibold ${exercise.completed ? 'text-gray-400 line-through' : 'text-white'}`}>{exercise.name}</p>
                    <p className="text-xs text-gray-500">{exercise.sets}</p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-[#00ff9d]"><PlayCircle size={20} /></button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}