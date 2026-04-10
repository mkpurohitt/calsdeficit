"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "../../components/AppLayout";
import { Droplet, Camera, Plus, ChevronDown, ChevronUp, Trash2, X, Upload, Loader2, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";

interface FoodLogEntry {
  id?: string;
  food_name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_type: string;
  health_tip?: string;
  created_at?: string;
}

interface MealSection {
  name: string;
  color: string;
  items: FoodLogEntry[];
}

export default function DietPage() {
  const router = useRouter();
  const { user } = useAuth() as { user: any };
  
  const [loading, setLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false); 
  const [userGoals, setUserGoals] = useState<any>(null);

  // Form State
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [goalType, setGoalType] = useState("Maintain Weight");

  const [waterGlasses, setWaterGlasses] = useState(0);
  const [expandedMeal, setExpandedMeal] = useState<string | null>("Breakfast");

  // Food logs from database
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);

  // Scanner modal state
  const [showScanner, setScannerOpen] = useState(false);
  const [scanImage, setScanImage] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanMealType, setScanMealType] = useState("Breakfast");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FoodLogEntry | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing goals on load
  useEffect(() => {
    if (!user) return;
    
    const fetchGoals = async () => {
      const { data, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.uid)
        .single();
        
      if (data) {
        setUserGoals(data);
        setIsOnboarded(true);
      }
      setLoading(false);
    };
    
    fetchGoals();
  }, [user]);

  // Fetch today's food logs
  const fetchFoodLogs = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
    
    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.uid)
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay)
      .order('created_at', { ascending: true });
    
    if (data) {
      setFoodLogs(data);
    }
    if (error) {
      console.error('Error fetching food logs:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user && isOnboarded) {
      fetchFoodLogs();
    }
  }, [user, isOnboarded, fetchFoodLogs]);

  // Scanner handlers
  const openScanner = (mealType?: string) => {
    setScannerOpen(true);
    setScanImage(null);
    setScanPreview(null);
    setScanResult(null);
    setScanError(null);
    setSaved(false);
    if (mealType) setScanMealType(mealType);
  };

  const closeScanner = () => {
    setScannerOpen(false);
    setScanImage(null);
    setScanPreview(null);
    setScanResult(null);
    setScanError(null);
    setSaved(false);
  };

  const handleImageSelect = (file: File) => {
    setScanImage(file);
    setScanResult(null);
    setScanError(null);
    setSaved(false);
    const reader = new FileReader();
    reader.onload = (e) => setScanPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageSelect(file);
    }
  };

  const handleAnalyze = async () => {
    if (!scanImage) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const formData = new FormData();
      formData.append('image', scanImage);
      formData.append('meal_type', scanMealType);
      if (user?.uid) formData.append('user_id', user.uid);

      const res = await fetch('/api/food-scan', { method: 'POST', body: formData });
      const json = await res.json();

      if (!json.success) {
        setScanError(json.error || 'Analysis failed');
        return;
      }

      setScanResult(json.data);
      if (json.db_saved) {
        setSaved(true);
        fetchFoodLogs(); // Refresh the food logs
      }
    } catch (err: any) {
      setScanError(err.message || 'Network error');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveManually = async () => {
    if (!scanResult || !user) return;
    
    const { error } = await supabase.from('food_logs').insert({
      user_id: user.uid,
      food_name: scanResult.food_name,
      portion: scanResult.portion,
      calories: scanResult.calories,
      protein_g: scanResult.protein_g,
      carbs_g: scanResult.carbs_g,
      fat_g: scanResult.fat_g,
      fiber_g: scanResult.fiber_g,
      meal_type: scanResult.meal_type,
    });

    if (!error) {
      setSaved(true);
      fetchFoodLogs();
    }
  };

  const handleDeleteLog = async (id: string) => {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (!error) {
      setFoodLogs(prev => prev.filter(log => log.id !== id));
    }
  };

  // Handle calculation and database save
  const handleCalculatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert("Error: You are not logged in! Please log in first.");
      return;
    }

    const bmr = (10 * parseFloat(weight)) + (6.25 * parseFloat(height)) - (5 * parseInt(age)) + 5;
    const tdee = Math.round(bmr * 1.55);

    let targetCalories = tdee;
    if (goalType === "Lose Weight") targetCalories -= 500;
    if (goalType === "Build Muscle") targetCalories += 300;

    const protein = Math.round((targetCalories * 0.3) / 4);
    const carbs = Math.round((targetCalories * 0.4) / 4);
    const fat = Math.round((targetCalories * 0.3) / 9);

    try {
      const { error: userError } = await supabase.from('users').upsert({
        id: user.uid,
        email: user.email,
        name: user.displayName || 'Athlete'
      });

      if (userError) {
        alert("Database Error (Users): " + userError.message);
        return;
      }

      const newGoals = {
        user_id: user.uid,
        age: parseInt(age),
        weight_kg: parseFloat(weight),
        height_cm: parseFloat(height),
        goal: goalType,
        daily_calories: targetCalories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat
      };

      const { error: goalError } = await supabase.from('user_goals').upsert(newGoals);

      if (goalError) {
        alert("Database Error (Goals): " + goalError.message);
        return;
      }

      setUserGoals(newGoals);
      setIsOnboarded(true);

    } catch (err: any) {
      alert("Unexpected Error: " + err.message);
    }
  };
  
  const totalWaterMl = waterGlasses * 300;
  const waterGoal = 2500;

  // Dynamic values from food logs
  const consumed = foodLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
  const totalProtein = foodLogs.reduce((sum, log) => sum + (log.protein_g || 0), 0);
  const totalCarbs = foodLogs.reduce((sum, log) => sum + (log.carbs_g || 0), 0);
  const totalFat = foodLogs.reduce((sum, log) => sum + (log.fat_g || 0), 0);
  const totalFiber = foodLogs.reduce((sum, log) => sum + (log.fiber_g || 0), 0);

  const goal = userGoals?.daily_calories || 2400;
  const percent = Math.min(consumed / goal, 1);
  const ringSize = 200;
  const r = (ringSize / 2) - 16;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - percent);

  // Group food logs by meal type
  const getMealItems = (mealName: string): FoodLogEntry[] => {
    return foodLogs.filter(log => log.meal_type === mealName);
  };

  const meals: MealSection[] = [
    { name: "Breakfast", color: "var(--macro-carbs)", items: getMealItems("Breakfast") },
    { name: "Lunch", color: "var(--lime-400)", items: getMealItems("Lunch") },
    { name: "Dinner", color: "var(--macro-fat)", items: getMealItems("Dinner") },
    { name: "Snacks", color: "var(--info)", items: getMealItems("Snacks") },
  ];

  // Dynamic Macros pulling from Database + food logs
  const macros = [
    { label: "Protein", current: totalProtein, target: userGoals?.protein_g || 150, color: "var(--macro-protein)" },
    { label: "Carbs", current: totalCarbs, target: userGoals?.carbs_g || 250, color: "var(--macro-carbs)" },
    { label: "Fat", current: totalFat, target: userGoals?.fat_g || 65, color: "var(--macro-fat)" },
    { label: "Fiber", current: totalFiber, target: 30, color: "var(--macro-fiber)" },
  ];

  if (loading) {
    return <AppLayout><div className="p-8 text-center text-[var(--text-secondary)]">Loading dashboard...</div></AppLayout>;
  }

  // ── Onboarding Form ──
  if (!isOnboarded) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-full p-6">
          <div className="cl-card-elevated w-full max-w-md animate-float-in" style={{ padding: "36px 32px" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              Set your daily goals 🎯
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 28 }}>
              We need some details to calculate your daily calories.
            </p>
            
            <form onSubmit={handleCalculatePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="cl-label">Age</label>
                  <input type="number" required value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" className="cl-input" />
                </div>
                <div>
                  <label className="cl-label">Weight (kg)</label>
                  <input type="number" required value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="75" className="cl-input" />
                </div>
              </div>
              <div>
                <label className="cl-label">Height (cm)</label>
                <input type="number" required value={height} onChange={(e) => setHeight(e.target.value)} placeholder="175" className="cl-input" />
              </div>
              <div>
                <label className="cl-label">Primary Goal</label>
                <select value={goalType} onChange={(e) => setGoalType(e.target.value)} className="cl-input" style={{ cursor: "pointer" }}>
                  <option>Lose Weight</option>
                  <option>Maintain Weight</option>
                  <option>Build Muscle</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full" style={{ height: 52, marginTop: 8 }}>
                Calculate My Plan
              </button>
            </form>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Diet Dashboard ──
  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              Today&apos;s Diet
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
              {consumed.toLocaleString()} / {goal.toLocaleString()} kcal consumed
            </p>
          </div>
          <button
            onClick={() => openScanner()}
            className="btn-primary flex items-center gap-2"
            style={{ borderRadius: "var(--radius-full)", padding: "10px 20px", fontSize: 14 }}
          >
            <Camera size={16} /> Scan Food
          </button>
        </div>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left Column: Calorie Ring + Water ── */}
          <div className="space-y-6">
            {/* Calorie Ring */}
            <div className="cl-card" style={{ borderRadius: 20, padding: 28, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ position: "relative", width: ringSize, height: ringSize }}>
                <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                  <circle cx={ringSize/2} cy={ringSize/2} r={r} fill="none" stroke="var(--surface-elevated)" strokeWidth="10" />
                  <circle
                    cx={ringSize/2} cy={ringSize/2} r={r}
                    fill="none" stroke="var(--lime-400)" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform={`rotate(-90 ${ringSize/2} ${ringSize/2})`}
                    style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 36, fontWeight: 700, color: "var(--lime-400)" }}>
                    {consumed.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                    of {goal.toLocaleString()} kcal
                  </span>
                </div>
              </div>

              {/* Macro pills */}
              <div className="flex gap-3 mt-5">
                {[
                  { label: "P", value: `${totalProtein}g`, color: "var(--macro-protein)" },
                  { label: "C", value: `${totalCarbs}g`, color: "var(--macro-carbs)" },
                  { label: "F", value: `${totalFat}g`, color: "var(--macro-fat)" },
                ].map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-full)",
                      background: "var(--surface-elevated)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} />
                    <span style={{ color: "var(--text-secondary)" }}>{m.label}</span>
                    <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Water Tracker */}
            <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div style={{ padding: 10, borderRadius: "var(--radius-full)", background: "rgba(77, 158, 255, 0.15)" }}>
                    <Droplet size={20} style={{ color: "var(--info)" }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Water Intake</h3>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{totalWaterMl.toLocaleString()}</span> / {waterGoal.toLocaleString()} ml
                    </p>
                  </div>
                </div>
              </div>

              {/* Glass grid */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: i < waterGlasses ? "none" : "1.5px dashed var(--border-color)",
                      background: i < waterGlasses ? "rgba(77, 158, 255, 0.15)" : "transparent",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Droplet
                      size={20}
                      style={{ color: i < waterGlasses ? "var(--info)" : "var(--text-disabled-dark)" }}
                      fill={i < waterGlasses ? "var(--info)" : "none"}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={() => setWaterGlasses(prev => Math.min(prev + 1, 8))}
                className="btn-secondary w-full flex items-center justify-center gap-2"
                style={{ fontSize: 13, padding: "8px 16px" }}
              >
                <Plus size={14} /> Add Water
              </button>
            </div>
          </div>

          {/* ── Center Column: Meal Journal ── */}
          <div className="space-y-3">
            {/* Quick scan bar */}
            <div
              className="cl-card flex items-center gap-3"
              style={{ padding: "12px 16px", borderRadius: "var(--radius-lg)", cursor: "pointer" }}
              onClick={() => openScanner()}
            >
              <button
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-md)",
                  background: "var(--lime-400)",
                  color: "#0A0C0F",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Camera size={18} />
              </button>
              <span style={{ flex: 1, fontSize: 14, color: "var(--text-tertiary)" }}>
                Scan food or search...
              </span>
            </div>

            {/* Meal Sections */}
            {meals.map((meal) => (
              <div key={meal.name} className="cl-card" style={{ borderRadius: "var(--radius-lg)", padding: 0, overflow: "hidden", borderLeft: `3px solid ${meal.color}` }}>
                <button
                  onClick={() => setExpandedMeal(expandedMeal === meal.name ? null : meal.name)}
                  className="w-full flex items-center justify-between p-4"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)" }}
                >
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{meal.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      {meal.items.reduce((sum, item) => sum + item.calories, 0)} kcal
                    </span>
                  </div>
                  {expandedMeal === meal.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {expandedMeal === meal.name && (
                  <div style={{ borderTop: "1px solid var(--border-color)", padding: "0 16px 16px" }}>
                    {meal.items.length > 0 ? (
                      meal.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="flex items-center justify-between py-3"
                          style={{ borderBottom: idx < meal.items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                        >
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.food_name}</p>
                            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{item.portion} · P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--lime-400)" }}>
                              {item.calories}
                            </span>
                            {item.id && (
                              <button
                                onClick={() => handleDeleteLog(item.id!)}
                                className="btn-icon"
                                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "12px 0" }}>No items logged yet</p>
                    )}

                    <button
                      onClick={() => openScanner(meal.name)}
                      className="w-full flex items-center justify-center gap-2 mt-2"
                      style={{
                        padding: "10px",
                        borderRadius: "var(--radius-md)",
                        border: "1.5px dashed var(--border-color)",
                        background: "transparent",
                        color: "var(--text-tertiary)",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> Add food
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Right Column: Macro Summary ── */}
          <div className="space-y-6">
            {/* Today's Macros */}
            <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Today&apos;s Macros</h3>
              {macros.map((macro, i) => (
                <div key={i} className="macro-bar">
                  <div className="macro-bar__header">
                    <span style={{ fontWeight: 500 }}>{macro.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{macro.current}g / {macro.target}g</span>
                  </div>
                  <div className="macro-bar__track">
                    <div
                      className="macro-bar__fill"
                      style={{ width: `${Math.min((macro.current / macro.target) * 100, 100)}%`, background: macro.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Weekly Average */}
            <div className="cl-card" style={{ borderRadius: 20, padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Weekly Average</h3>
              <div className="flex items-end justify-between gap-1" style={{ height: 80 }}>
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day, i) => {
                  const heights = [65, 80, 55, 90, 70, 40, 50];
                  const isToday = i === new Date().getDay() - 1;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 20,
                          height: `${heights[i]}%`,
                          borderRadius: "4px 4px 0 0",
                          background: isToday ? "var(--lime-400)" : "var(--surface-elevated)",
                          transition: "height 0.3s ease",
                        }}
                      />
                      <span style={{ fontSize: 10, color: isToday ? "var(--lime-400)" : "var(--text-tertiary)", fontWeight: isToday ? 600 : 400 }}>
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-center mt-3" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Avg: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>1,850</span> kcal/day
              </p>
            </div>

            {/* Nutrition Streak */}
            <div className="cl-card-accent" style={{ borderRadius: 20, padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 4 }}>🔥</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--warning)" }}>7</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>Day Streak</div>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Keep logging to maintain your streak</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Food Scanner Modal ── */}
      {showScanner && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeScanner(); }}
        >
          <div
            className="cl-card-elevated"
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 20,
              padding: "28px 24px",
              margin: 16,
              animation: "floatIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
              <div className="flex items-center gap-3">
                <div style={{
                  width: 40, height: 40, borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, var(--lime-400), #8BC34A)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={20} style={{ color: "#0A0C0F" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                    AI Food Scanner
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Powered by Gemini AI</p>
                </div>
              </div>
              <button
                onClick={closeScanner}
                style={{
                  width: 32, height: 32, borderRadius: "var(--radius-full)",
                  background: "var(--surface-elevated)", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--text-secondary)",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Meal Type Selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, display: "block" }}>
                Meal Type
              </label>
              <div className="flex gap-2">
                {["Breakfast", "Lunch", "Dinner", "Snacks"].map(type => (
                  <button
                    key={type}
                    onClick={() => setScanMealType(type)}
                    style={{
                      flex: 1,
                      padding: "8px 4px",
                      borderRadius: "var(--radius-md)",
                      border: scanMealType === type ? "1.5px solid var(--lime-400)" : "1.5px solid var(--border-color)",
                      background: scanMealType === type ? "rgba(190, 242, 100, 0.1)" : "transparent",
                      color: scanMealType === type ? "var(--lime-400)" : "var(--text-tertiary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Upload Area */}
            {!scanPreview ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border-color)",
                  borderRadius: 16,
                  padding: "40px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: 16,
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: "var(--radius-full)",
                  background: "var(--surface-elevated)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 12,
                }}>
                  <Upload size={24} style={{ color: "var(--text-tertiary)" }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Upload meal photo
                </p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  Drag & drop or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <img
                    src={scanPreview}
                    alt="Food preview"
                    style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 12 }}
                  />
                  <button
                    onClick={() => { setScanImage(null); setScanPreview(null); setScanResult(null); }}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      width: 28, height: 28, borderRadius: "var(--radius-full)",
                      background: "rgba(0,0,0,0.6)", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "#fff",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Analyze Button */}
                {!scanResult && (
                  <button
                    onClick={handleAnalyze}
                    disabled={scanning}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    style={{
                      height: 48,
                      borderRadius: "var(--radius-md)",
                      fontSize: 14,
                      fontWeight: 600,
                      opacity: scanning ? 0.7 : 1,
                    }}
                  >
                    {scanning ? (
                      <>
                        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                        Analyzing with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Analyze Food
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Error */}
            {scanError && (
              <div style={{
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                background: "rgba(255,77,77,0.1)",
                border: "1px solid rgba(255,77,77,0.3)",
                color: "#ff4d4d",
                fontSize: 13,
                marginBottom: 16,
              }}>
                {scanError}
              </div>
            )}

            {/* Results Card */}
            {scanResult && (
              <div style={{
                borderRadius: 16,
                background: "var(--surface-elevated)",
                padding: 20,
                animation: "floatIn 0.3s ease",
              }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{scanResult.food_name}</h4>
                    <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{scanResult.portion}</p>
                  </div>
                  <div style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-full)",
                    background: "rgba(190, 242, 100, 0.15)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--lime-400)",
                  }}>
                    {scanResult.calories} kcal
                  </div>
                </div>

                {/* Macro Grid */}
                <div className="grid grid-cols-4 gap-2" style={{ marginBottom: 16 }}>
                  {[
                    { label: "Protein", value: `${scanResult.protein_g}g`, color: "var(--macro-protein)" },
                    { label: "Carbs", value: `${scanResult.carbs_g}g`, color: "var(--macro-carbs)" },
                    { label: "Fat", value: `${scanResult.fat_g}g`, color: "var(--macro-fat)" },
                    { label: "Fiber", value: `${scanResult.fiber_g}g`, color: "var(--macro-fiber)" },
                  ].map((m, i) => (
                    <div key={i} style={{
                      textAlign: "center",
                      padding: "10px 4px",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-card)",
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: m.color, margin: "0 auto 6px",
                      }} />
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                        {m.value}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Health Tip */}
                {scanResult.health_tip && (
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(190, 242, 100, 0.08)",
                    borderLeft: "3px solid var(--lime-400)",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    marginBottom: 16,
                  }}>
                    💡 {scanResult.health_tip}
                  </div>
                )}

                {/* Save / Done Button */}
                {saved ? (
                  <div
                    className="w-full flex items-center justify-center gap-2"
                    style={{
                      height: 44,
                      borderRadius: "var(--radius-md)",
                      background: "rgba(77, 199, 77, 0.15)",
                      color: "#4dc74d",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    <Check size={16} /> Saved to {scanMealType}!
                  </div>
                ) : (
                  <button
                    onClick={handleSaveManually}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    style={{ height: 44, borderRadius: "var(--radius-md)", fontSize: 14 }}
                  >
                    <Plus size={16} /> Save to {scanMealType}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AppLayout>
  );
}