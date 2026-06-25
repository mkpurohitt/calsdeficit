"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "../../components/AppLayout";
import { Droplet, Camera, Plus, ChevronDown, ChevronUp, Trash2, X, Upload, Loader2, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";
import { addFoodLog, deleteFoodLog, getDateKey, getDateKeyDaysAgo, getDay, getFoodLogs, getUserGoal, saveDay, saveUserGoal } from "../../lib/user-data";
import { apiFetch } from "../../lib/api-client";
import { compressImage } from "../../lib/image-compress";
import FoodScanCard from "../../components/FoodScanCard";
import type { FoodScanResult } from "../../lib/schemas/food-scan";
import { WATER_GLASS_ML, WATER_GOAL_ML } from "../../lib/config/app";


interface FoodLogEntry {
  id?: string;
  user_id?: string;
  food_name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  meal_type: string;
  health_tip?: string;
  source?: string;
  verified?: boolean;
  confidence?: number;
  created_at?: string;
  date_key?: string;
}

interface MealSection {
  name: string;
  color: string;
  items: FoodLogEntry[];
}

export default function DietPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth() as { user: { uid: string } | null; loading: boolean };
  
  const [loading, setLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false); 
  const [userGoals, setUserGoals] = useState<{ daily_calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } | null>(null);

  // Weekly calorie data for the bar chart
  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [streak, setStreak] = useState(0);

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
  const [scanResult, setScanResult] = useState<FoodScanResult | null>(null);
  const [scanAdKeywords, setScanAdKeywords] = useState<string[]>([]);
  const [scanAdsEnabled, setScanAdsEnabled] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Fetch existing goals on load
  useEffect(() => {
    if (!user) return;
    
    const fetchGoals = async () => {
      const data = await getUserGoal(user.uid);
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
    const todayKey = getDateKey();
    const data = await getFoodLogs(user.uid, { from: todayKey, to: todayKey });

    setFoodLogs(data.map((log: FoodLogEntry) => ({
      ...log,
      portion: log.portion || '1 serving',
    })));
  }, [user]);

  useEffect(() => {
    if (user && isOnboarded) {
      fetchFoodLogs();
    }
  }, [user, isOnboarded, fetchFoodLogs]);

  // Persisted water intake for today
  useEffect(() => {
    if (!user) return;
    getDay(user.uid, getDateKey()).then((day) => {
      if (day?.water_ml) setWaterGlasses(Math.round(day.water_ml / WATER_GLASS_ML));
    });
  }, [user]);

  // Fetch calorie data + streak from the last 90 days (bounded read)
  const fetchWeeklyData = useCallback(async () => {
    if (!user) return;
    const logs = await getFoodLogs(user.uid, { from: getDateKeyDaysAgo(90), to: getDateKey() });
    const today = new Date();
    const daily = [0, 0, 0, 0, 0, 0, 0];

    logs.forEach((log) => {
      if (!log.created_at) return;
      const logDate = new Date(log.created_at);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      if (logDate >= weekStart && logDate < weekEnd) {
        daily[logDate.getDay()] += log.calories || 0;
      }
    });
    setWeeklyData(daily);

    // Streak: count consecutive days with food_logs going back from today
    let streakCount = 0;
    for (let i = 0; i < 90; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateKey = getDateKey(checkDate);
      const count = logs.filter((log) => log.date_key === dateKey).length;

      if ((count ?? 0) > 0) {
        streakCount++;
      } else {
        // If today has no logs yet, skip today but don't break
        if (i === 0) continue;
        break;
      }
    }
    setStreak(streakCount);
  }, [user]);

  useEffect(() => {
    if (user && isOnboarded) {
      fetchWeeklyData();
    }
  }, [user, isOnboarded, fetchWeeklyData]);

  // Scanner handlers
  const openScanner = (mealType?: string) => {
    setScannerOpen(true);
    setScanImage(null);
    setScanPreview(null);
    setScanResult(null);
    setScanError(null);
    setSaved(false);
    setSavingFood(false);
    if (mealType) setScanMealType(mealType);
  };

  const closeScanner = () => {
    setScannerOpen(false);
    setScanImage(null);
    setScanPreview(null);
    setScanResult(null);
    setScanError(null);
    setSaved(false);
    setSavingFood(false);
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
      // Standardize on-device (≤768px / 75% JPEG → flat 258 Gemini tokens)
      const compressed = await compressImage(scanImage);
      const formData = new FormData();
      formData.append('image', compressed);
      formData.append('meal_type', scanMealType);

      const res = await apiFetch('/api/food-scan', { method: 'POST', body: formData });
      const json = await res.json();

      if (!json.success) {
        setScanError(json.error || 'Analysis failed');
        return;
      }

      setScanResult(json.data);
      setScanAdKeywords(json.adKeywords || []);
      setScanAdsEnabled(json.adsEnabled ?? true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setScanning(false);
    }
  };

  const handleSaveManually = async () => {
    if (!scanResult || !user) return;
    setSavingFood(true);
    setScanError(null);

    try {
      await addFoodLog({
        user_id: user.uid,
        food_name: scanResult.food_name,
        portion: scanResult.portion,
        calories: scanResult.calories,
        protein_g: scanResult.protein_g,
        carbs_g: scanResult.carbs_g,
        fat_g: scanResult.fat_g,
        fiber_g: scanResult.fiber_g,
        meal_type: scanMealType,
        health_tip: scanResult.health_tip,
        source: scanResult.source,
        verified: scanResult.verified,
        confidence: scanResult.confidence,
        date_key: getDateKey(),
        date: getDateKey(),
      });

      setSaved(true);
      setExpandedMeal(scanMealType);
      fetchFoodLogs();
      fetchWeeklyData();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not save this food log.');
    } finally {
      setSavingFood(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!user) return;
    await deleteFoodLog(user.uid, id);
    setFoodLogs(prev => prev.filter(log => log.id !== id));
    fetchWeeklyData();
  };

  const handleAddWater = () => {
    setWaterGlasses(prev => {
      const next = Math.min(prev + 1, 8);
      if (user) saveDay(user.uid, getDateKey(), { water_ml: next * WATER_GLASS_ML });
      return next;
    });
  };

  // Handle calculation and database save
  const handleCalculatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert("Error: You are not logged in! Please log in first.");
      return;
    }

    const w = parseFloat(weight) || 0;
    const h = parseFloat(height) || 0;
    const a = parseInt(age) || 0;

    if (w <= 0 || h <= 0 || a <= 0) {
      alert("Please enter valid age, weight and height values.");
      return;
    }

    // Mifflin-St Jeor formula (male default)
    const bmr = (10 * w) + (6.25 * h) - (5 * a) + 5;
    const tdee = Math.round(bmr * 1.55);

    let targetCalories = tdee;
    if (goalType === "Lose Weight") targetCalories -= 500;
    if (goalType === "Build Muscle") targetCalories += 300;

    const protein = Math.round((targetCalories * 0.3) / 4);
    const carbs = Math.round((targetCalories * 0.4) / 4);
    const fat = Math.round((targetCalories * 0.3) / 9);

    try {
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

      await saveUserGoal(newGoals);

      setUserGoals(newGoals);
      setIsOnboarded(true);

    } catch (err) {
      alert("Unexpected Error: " + (err instanceof Error ? err.message : String(err)));
    }
  };
  
  const totalWaterMl = waterGlasses * WATER_GLASS_ML;
  const waterGoal = WATER_GOAL_ML;

  // Dynamic values from food logs
  const consumed = foodLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
  const totalProtein = foodLogs.reduce((sum, log) => sum + (log.protein_g || 0), 0);
  const totalCarbs = foodLogs.reduce((sum, log) => sum + (log.carbs_g || 0), 0);
  const totalFat = foodLogs.reduce((sum, log) => sum + (log.fat_g || 0), 0);
  const totalFiber = foodLogs.reduce((sum, log) => sum + (log.fiber_g || 0), 0);

  const goal = userGoals?.daily_calories || 2400;
  const remaining = Math.max(goal - consumed, 0);
  const percent = Math.min(consumed / goal, 1);
  const ringSize = 200;
  const r = 84;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - percent);

  // Eyebrow date (e.g. "WEDNESDAY · JUNE 24")
  const now = new Date();
  const eyebrowDate = `${now.toLocaleDateString("en-US", { weekday: "long" })} · ${now.toLocaleDateString("en-US", { month: "long" })} ${now.getDate()}`.toUpperCase();

  // Group food logs by meal type
  const getMealItems = (mealName: string): FoodLogEntry[] => {
    return foodLogs.filter(log => log.meal_type === mealName);
  };

  // Earliest logged time for a meal section, derived from real food-log data.
  const getMealTime = (items: FoodLogEntry[]): string => {
    const times = items
      .map((it) => it.created_at)
      .filter((t): t is string => !!t)
      .map((t) => new Date(t).getTime())
      .filter((t) => !Number.isNaN(t));
    if (times.length === 0) return "not logged";
    return new Date(Math.min(...times)).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const meals: (MealSection & { time: string })[] = [
    { name: "Breakfast", color: "var(--macro-carbs)", items: getMealItems("Breakfast"), time: getMealTime(getMealItems("Breakfast")) },
    { name: "Lunch", color: "var(--lime-400)", items: getMealItems("Lunch"), time: getMealTime(getMealItems("Lunch")) },
    { name: "Dinner", color: "var(--macro-fat)", items: getMealItems("Dinner"), time: getMealTime(getMealItems("Dinner")) },
    { name: "Snacks", color: "var(--macro-fiber)", items: getMealItems("Snacks"), time: getMealTime(getMealItems("Snacks")) },
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
  const macroChips = [
    { label: "Protein", value: totalProtein, color: "var(--macro-protein)" },
    { label: "Carbs", value: totalCarbs, color: "var(--macro-carbs)" },
    { label: "Fat", value: totalFat, color: "var(--macro-fat)" },
  ];

  return (
    <AppLayout>
      <div style={{ padding: "30px 38px 48px", maxWidth: 1380, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className="cl-mono"
              style={{ fontSize: 12, letterSpacing: ".12em", color: "var(--text-tertiary)", marginBottom: 7 }}
            >
              {eyebrowDate}
            </div>
            <h1
              style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}
            >
              Today&apos;s Diet
            </h1>
          </div>
          <button
            onClick={() => openScanner()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "12px 20px",
              background: "var(--lime-400)",
              color: "#0A0C0F",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <Camera size={18} /> Scan Food
          </button>
        </div>

        {/* 2-Column Layout */}
        <div className="diet-cols">

          {/* ── LEFT: Ring hero + scan bar + meal journal ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Ring hero */}
            <div
              className="cl-card"
              style={{ position: "relative", overflow: "hidden", borderRadius: 20, padding: 28 }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -40,
                  top: -40,
                  width: 280,
                  height: 280,
                  background: "radial-gradient(circle, rgba(170,255,0,.16), transparent 65%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  gap: 30,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative", width: ringSize, height: ringSize, flex: "none" }}>
                  <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                    <circle cx={ringSize / 2} cy={ringSize / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth="15" />
                    <circle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={r}
                      fill="none"
                      stroke="var(--lime-400)"
                      strokeWidth="15"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                      style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span className="cl-mono" style={{ fontSize: 38, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                      {consumed.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 5 }}>
                      of {goal.toLocaleString()} kcal
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 2 }}>Remaining today</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 20 }}>
                    <span className="cl-mono" style={{ fontSize: 42, fontWeight: 700, color: "var(--lime-400)", lineHeight: 1 }}>
                      {remaining.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 15, color: "var(--text-secondary)" }}>kcal</span>
                  </div>
                  <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                    {macroChips.map((m) => (
                      <div
                        key={m.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "8px 13px",
                          background: "var(--surface-elevated)",
                          borderRadius: 10,
                        }}
                      >
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: m.color }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.label}</span>
                        <span className="cl-mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                          {m.value}g
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Scan bar */}
            <div
              className="cl-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 13,
                borderRadius: 14,
                padding: "11px 14px",
                cursor: "pointer",
              }}
              onClick={() => openScanner()}
            >
              <span
                style={{
                  flex: "none",
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--lime-400)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0A0C0F",
                }}
              >
                <Camera size={19} />
              </span>
              <span style={{ flex: 1, fontSize: 15, color: "var(--text-tertiary)" }}>
                Scan a photo or search foods…
              </span>
            </div>

            {/* Meal journal */}
            <div className="cl-card" style={{ borderRadius: 20, padding: "8px 22px" }}>
              {meals.map((meal, mi) => {
                const isOpen = expandedMeal === meal.name;
                const total = meal.items.reduce((sum, item) => sum + item.calories, 0);
                return (
                  <div
                    key={meal.name}
                    style={{ borderBottom: mi < meals.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                  >
                    <div
                      onClick={() => setExpandedMeal(isOpen ? null : meal.name)}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "17px 2px", cursor: "pointer" }}
                    >
                      <span style={{ width: 4, height: 36, borderRadius: 99, background: meal.color, flex: "none" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>{meal.name}</span>
                          <span className="cl-mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{meal.time}</span>
                        </div>
                      </div>
                      <span className="cl-mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
                        {total} kcal
                      </span>
                      {isOpen ? (
                        <ChevronUp size={18} style={{ color: "var(--text-tertiary)" }} />
                      ) : (
                        <ChevronDown size={18} style={{ color: "var(--text-tertiary)" }} />
                      )}
                    </div>

                    {isOpen && (
                      <div style={{ padding: "0 0 16px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
                        {meal.items.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "11px 14px",
                              background: "var(--surface-elevated)",
                              borderRadius: 11,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.food_name}</div>
                              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1 }}>
                                {item.portion} · P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g
                              </div>
                            </div>
                            <span className="cl-mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--lime-600)" }}>
                              {item.calories} kcal
                            </span>
                            {item.id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteLog(item.id!); }}
                                className="btn-icon"
                                style={{ width: 28, height: 28, border: "none", background: "transparent", cursor: "pointer" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}

                        {meal.items.length === 0 && (
                          <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "6px 14px" }}>
                            Nothing logged yet.
                          </div>
                        )}

                        <div
                          onClick={() => openScanner(meal.name)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "10px 14px",
                            border: "1.5px dashed var(--border-color)",
                            borderRadius: 11,
                            color: "var(--text-tertiary)",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          <Plus size={16} /> Add food
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT RAIL ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Today's Macros */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 22 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 18 }}>
                Today&apos;s Macros
              </div>
              {macros.map((macro) => (
                <div key={macro.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{macro.label}</span>
                    <span className="cl-mono" style={{ color: "var(--text-tertiary)" }}>{macro.current} / {macro.target}g</span>
                  </div>
                  <div style={{ height: 7, background: "var(--surface-elevated)", borderRadius: 99, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min((macro.current / macro.target) * 100, 100)}%`,
                        background: macro.color,
                        borderRadius: 99,
                        transition: "width 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Water */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      background: "rgba(77,158,255,.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--info)",
                    }}
                  >
                    <Droplet size={16} fill="currentColor" />
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>Water</span>
                </div>
                <span className="cl-mono" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {totalWaterMl.toLocaleString()} / {waterGoal.toLocaleString()} ml
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 7, marginBottom: 16 }}>
                {Array.from({ length: 8 }).map((_, i) => {
                  const filled = i < waterGlasses;
                  return (
                    <div
                      key={i}
                      style={{
                        aspectRatio: "1",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1.5px solid ${filled ? "var(--lime-400)" : "var(--border-color)"}`,
                        background: filled ? "rgba(170,255,0,.14)" : "var(--surface-elevated)",
                        color: filled ? "var(--lime-400)" : "var(--text-tertiary)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Droplet size={14} fill="currentColor" />
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleAddWater}
                style={{
                  width: "100%",
                  padding: 10,
                  background: "var(--surface-elevated)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 10,
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                <Plus size={15} /> Add a glass
              </button>
            </div>

            {/* Weekly */}
            <div className="cl-card" style={{ borderRadius: 18, padding: 22 }}>
              {(() => {
                const daysWithData = weeklyData.filter((d) => d > 0).length;
                const weekAvg = daysWithData > 0 ? Math.round(weeklyData.reduce((a, b) => a + b, 0) / daysWithData) : 0;
                const maxCal = Math.max(...weeklyData, 1);
                const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const todayIdx = new Date().getDay();
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>Weekly</span>
                      <span className="cl-mono" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                        avg {weekAvg.toLocaleString()} kcal
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 9, height: 84 }}>
                      {days.map((day, i) => {
                        const isToday = i === todayIdx;
                        const heightPct = Math.max(6, Math.round((weeklyData[i] / maxCal) * 100));
                        return (
                          <div
                            key={day}
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 8,
                              height: "100%",
                              justifyContent: "flex-end",
                            }}
                          >
                            <div
                              style={{
                                width: "100%",
                                height: `${heightPct}%`,
                                borderRadius: "6px 6px 3px 3px",
                                background: isToday ? "var(--lime-400)" : "var(--surface-hover)",
                                transition: "height 0.3s ease",
                              }}
                            />
                            <span
                              className="cl-mono"
                              style={{ fontSize: 11, color: isToday ? "var(--lime-400)" : "var(--text-tertiary)" }}
                            >
                              {day[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Streak */}
            <div
              className="cl-card"
              style={{ position: "relative", overflow: "hidden", border: "1px solid rgba(255,184,0,.3)", borderRadius: 18, padding: 22 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span
                  style={{
                    flex: "none",
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "rgba(255,184,0,.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                  }}
                >
                  🔥
                </span>
                <div>
                  <div className="cl-mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--warning)", lineHeight: 1 }}>
                    {streak} {streak === 1 ? "day" : "days"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 3 }}>
                    {streak > 0 ? "Logging streak — keep it alive" : "Start logging food to build a streak!"}
                  </div>
                </div>
              </div>
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
                <div style={{ marginBottom: 16 }}>
                  <FoodScanCard
                    scan={scanResult}
                    adKeywords={scanAdKeywords}
                    adsEnabled={scanAdsEnabled}
                  />
                </div>

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
                    disabled={savingFood}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    style={{ height: 44, borderRadius: "var(--radius-md)", fontSize: 14, opacity: savingFood ? 0.7 : 1 }}
                  >
                    {savingFood ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={16} />}
                    {savingFood ? "Saving..." : `Save to ${scanMealType}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style jsx>{`
        .diet-cols {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 326px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .diet-cols {
            grid-template-columns: 1fr;
          }
        }
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
