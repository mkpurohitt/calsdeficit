"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "../../components/AppLayout";
import { Droplet, Camera, Plus, ChevronDown, ChevronUp, Trash2, X, Upload, Loader2, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/AuthContext";
import { addFoodLog, deleteFoodLog, deleteScanHistory, getDateKey, getDateKeyDaysAgo, getDay, getFoodLogs, getScanHistory, getUserGoal, saveDay, type ScanHistoryRecord } from "../../lib/user-data";
import { apiFetch } from "../../lib/api-client";
import { compressImage, makeImageThumb } from "../../lib/image-compress";
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
  photo_thumb?: string;
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
  const [userGoals, setUserGoals] = useState<{ daily_calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number; water_ml?: number } | null>(null);

  // Weekly calorie data for the bar chart
  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [streak, setStreak] = useState(0);

  const [waterGlasses, setWaterGlasses] = useState(0);
  const [expandedMeal, setExpandedMeal] = useState<string | null>("Breakfast");
  // Which day of the current week is shown in the meal journal (JS getDay()).
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [unsavedScans, setUnsavedScans] = useState<ScanHistoryRecord[]>([]);
  const [scanActionBusy, setScanActionBusy] = useState<string | null>(null);

  // Food logs from database
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);

  // Scanner modal state
  const [showScanner, setScannerOpen] = useState(false);
  const [scanImage, setScanImage] = useState<File | null>(null);
  const [scanContext, setScanContext] = useState("");
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

  // Goals loaded but none exist → send the user to the dedicated onboarding wizard
  useEffect(() => {
    if (!authLoading && user && !loading && !isOnboarded) {
      router.replace("/onboarding");
    }
  }, [authLoading, user, loading, isOnboarded, router]);

  // Fetch today's food logs
  // Selected calendar date within the current week (Sun-first, like Exercise).
  const selectedDateObj = (() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() + selectedDay);
    return d;
  })();
  const selectedDateKey = getDateKey(selectedDateObj);
  const isSelectedToday = selectedDateKey === getDateKey();

  const fetchFoodLogs = useCallback(async () => {
    if (!user) return;
    const data = await getFoodLogs(user.uid, { from: selectedDateKey, to: selectedDateKey });

    setFoodLogs(data.map((log: FoodLogEntry) => ({
      ...log,
      portion: log.portion || '1 serving',
    })));
  }, [user, selectedDateKey]);

  const fetchUnsavedScans = useCallback(async () => {
    if (!user) return;
    try {
      setUnsavedScans(await getScanHistory(user.uid, 10));
    } catch {
      /* card just stays empty */
    }
  }, [user]);

  useEffect(() => {
    if (user && isOnboarded) fetchUnsavedScans();
  }, [user, isOnboarded, fetchUnsavedScans]);

  /** Log an unsaved Home-chat scan into today's diary. */
  const handleLogUnsavedScan = async (scan: ScanHistoryRecord) => {
    if (!user || !scan.id || scanActionBusy) return;
    setScanActionBusy(scan.id);
    try {
      const hour = new Date().getHours();
      const slot = hour < 11 ? "Breakfast" : hour < 15 ? "Lunch" : hour < 18 ? "Snacks" : "Dinner";
      await addFoodLog({
        user_id: user.uid,
        food_name: scan.food_name,
        portion: scan.portion,
        calories: scan.calories,
        protein_g: scan.protein_g,
        carbs_g: scan.carbs_g,
        fat_g: scan.fat_g,
        fiber_g: scan.fiber_g,
        meal_type: slot,
        ...(scan.photo_thumb ? { photo_thumb: scan.photo_thumb } : {}),
        date_key: getDateKey(),
        date: getDateKey(),
      });
      await deleteScanHistory(user.uid, scan.id);
      setUnsavedScans((prev) => prev.filter((sRec) => sRec.id !== scan.id));
      fetchFoodLogs();
      fetchWeeklyData();
    } finally {
      setScanActionBusy(null);
    }
  };

  const handleDismissUnsavedScan = async (scan: ScanHistoryRecord) => {
    if (!user || !scan.id || scanActionBusy) return;
    setScanActionBusy(scan.id);
    try {
      await deleteScanHistory(user.uid, scan.id);
      setUnsavedScans((prev) => prev.filter((sRec) => sRec.id !== scan.id));
    } finally {
      setScanActionBusy(null);
    }
  };

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
    setScanContext("");
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
    setScanContext("");
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
    // Photo, text description, or both — the API supports all three.
    if (!scanImage && !scanContext.trim()) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const formData = new FormData();
      if (scanImage) {
        // Standardize on-device (≤768px / 75% JPEG → flat 258 Gemini tokens)
        const compressed = await compressImage(scanImage);
        formData.append('image', compressed);
      }
      if (scanContext.trim()) formData.append('context', scanContext.trim());
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
      // Tiny thumb of the scanned photo so the journal row can show it.
      const photoThumb = scanImage ? await makeImageThumb(scanImage) : null;
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
        ...(photoThumb ? { photo_thumb: photoThumb } : {}),
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

  /** Short synthesized "glug" — no audio asset needed. */
  const playWaterSound = () => {
    try {
      type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
      osc.onended = () => ctx.close();
    } catch {
      /* sound is decorative */
    }
  };

  const setWater = (next: number, withSound: boolean) => {
    const clamped = Math.max(0, Math.min(next, 8));
    setWaterGlasses(clamped);
    if (withSound) playWaterSound();
    if (user) saveDay(user.uid, getDateKey(), { water_ml: clamped * WATER_GLASS_ML });
  };

  const handleAddWater = () => setWater(waterGlasses + 1, true);

  /** Tapping a glass: filled top glass → undo it; empty glass → fill up to it. */
  const handleGlassTap = (index: number) => {
    if (index + 1 <= waterGlasses) {
      setWater(index, false); // undo down to this glass
    } else {
      setWater(index + 1, true);
    }
  };

  const totalWaterMl = waterGlasses * WATER_GLASS_ML;
  const waterGoal = userGoals?.water_ml || WATER_GOAL_ML;

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
    { label: "Fiber", current: totalFiber, target: userGoals?.fiber_g || 30, color: "var(--macro-fiber)" },
  ];

  if (loading) {
    return <AppLayout><div className="p-8 text-center text-[var(--text-secondary)]">Loading dashboard...</div></AppLayout>;
  }

  // ── No goals yet → redirecting to the /onboarding wizard ──
  if (!isOnboarded) {
    return (
      <AppLayout>
        <div
          className="flex flex-col items-center justify-center min-h-full p-6"
          style={{ gap: 12, color: "var(--text-secondary)" }}
        >
          <Loader2 size={26} className="animate-spin" style={{ color: "var(--lime-400)" }} />
          <span style={{ fontSize: 14 }}>Taking you to onboarding…</span>
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
        </div>

        {/* Scan Food hero */}
        <div
          className="cl-card"
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 20,
            padding: "26px 28px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 22,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -60,
              top: -60,
              width: 300,
              height: 300,
              background: "radial-gradient(circle, rgba(170,255,0,.14), transparent 65%)",
              pointerEvents: "none",
            }}
          />
          <span
            style={{
              position: "relative",
              flex: "none",
              width: 62,
              height: 62,
              borderRadius: 18,
              background: "var(--lime-400)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0A0C0F",
            }}
          >
            <Camera size={30} />
          </span>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <div className="cl-disp" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>
              Scan Your Food
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 3 }}>
              Snap a photo of any meal — AI logs calories and macros instantly.
            </div>
          </div>
          <button
            onClick={() => openScanner()}
            style={{
              position: "relative",
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "14px 26px",
              background: "var(--lime-400)",
              color: "#0A0C0F",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              borderRadius: 13,
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

            {/* Week day strip — view any day's food log */}
            <div className="cl-card" style={{ borderRadius: 16, padding: 10, display: "flex", gap: 6 }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                const now = new Date();
                const date = new Date(now);
                date.setDate(now.getDate() - now.getDay() + i);
                const isActive = selectedDay === i;
                const isFuture = date > now;
                return (
                  <button
                    key={day}
                    onClick={() => !isFuture && setSelectedDay(i)}
                    disabled={isFuture}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "9px 0",
                      borderRadius: 11,
                      cursor: isFuture ? "default" : "pointer",
                      border: "none",
                      background: isActive ? "var(--lime-400)" : "transparent",
                      opacity: isFuture ? 0.35 : 1,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 500, color: isActive ? "#0A0C0F" : "var(--text-tertiary)" }}>{day}</div>
                    <div className="cl-mono" style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: isActive ? "#0A0C0F" : "var(--text-primary)" }}>
                      {date.getDate()}
                    </div>
                  </button>
                );
              })}
            </div>

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

            {/* Meal journal (selected day) */}
            {!isSelectedToday && (
              <div className="cl-mono" style={{ fontSize: 12, letterSpacing: ".1em", color: "var(--text-tertiary)", margin: "-6px 2px" }}>
                VIEWING {selectedDateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}
              </div>
            )}
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
                            {item.photo_thumb && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.photo_thumb}
                                alt=""
                                style={{ flex: "none", width: 36, height: 36, borderRadius: 9, objectFit: "cover" }}
                              />
                            )}
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
                    <button
                      key={i}
                      onClick={() => handleGlassTap(i)}
                      title={filled ? "Tap to undo this glass" : "Tap to fill up to here"}
                      aria-label={filled ? `Undo glass ${i + 1}` : `Log glass ${i + 1}`}
                      style={{
                        aspectRatio: "1",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        border: `1.5px solid ${filled ? "var(--lime-400)" : "var(--border-color)"}`,
                        background: filled ? "rgba(170,255,0,.14)" : "var(--surface-elevated)",
                        color: filled ? "var(--lime-400)" : "var(--text-tertiary)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Droplet size={14} fill="currentColor" />
                    </button>
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

            {/* Unsaved Home-chat scans — compressed history, log or dismiss */}
            {unsavedScans.length > 0 && (
              <div className="cl-card" style={{ borderRadius: 18, padding: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 4 }}>Scanned, not logged</div>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>
                  Foods you scanned in Home chat but didn&apos;t save.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {unsavedScans.map((scanRec) => (
                    <div key={scanRec.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "var(--surface-elevated)", borderRadius: 11 }}>
                      {scanRec.photo_thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={scanRec.photo_thumb} alt="" style={{ flex: "none", width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
                      ) : (
                        <span style={{ flex: "none", width: 32, height: 32, borderRadius: 8, background: "var(--surface-card)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lime-600)" }}>
                          <Camera size={14} />
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{scanRec.food_name}</div>
                        <div className="cl-mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{scanRec.calories} kcal</div>
                      </div>
                      <button
                        onClick={() => handleLogUnsavedScan(scanRec)}
                        disabled={scanActionBusy === scanRec.id}
                        title="Add to today's diary"
                        style={{ flex: "none", padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--lime-400)", color: "#0A0C0F", fontSize: 11.5, fontWeight: 700, cursor: "pointer", opacity: scanActionBusy === scanRec.id ? 0.6 : 1 }}
                      >
                        {scanActionBusy === scanRec.id ? "…" : "Log"}
                      </button>
                      <button
                        onClick={() => handleDismissUnsavedScan(scanRec)}
                        title="Dismiss"
                        aria-label="Dismiss scan"
                        style={{ flex: "none", width: 22, height: 22, border: "none", background: "none", color: "var(--text-tertiary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

              </div>
            )}

            {/* Describe the food — works alone or together with a photo */}
            {!scanResult && (
              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={scanContext}
                  onChange={(e) => setScanContext(e.target.value)}
                  rows={2}
                  placeholder={scanImage ? "Add details (optional) — e.g. cooked in ghee, large portion…" : "No photo? Just type it — e.g. 2 rotis with dal and a bowl of rice"}
                  className="cl-input"
                  style={{ resize: "vertical", fontSize: 14, lineHeight: 1.55 }}
                />
              </div>
            )}

            {/* Analyze Button — enabled with a photo, a description, or both */}
            {!scanResult && (
              <button
                onClick={handleAnalyze}
                disabled={scanning || (!scanImage && !scanContext.trim())}
                className="btn-primary w-full flex items-center justify-center gap-2"
                style={{
                  height: 48,
                  borderRadius: "var(--radius-md)",
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 16,
                  opacity: scanning || (!scanImage && !scanContext.trim()) ? 0.6 : 1,
                  cursor: scanning || (!scanImage && !scanContext.trim()) ? "not-allowed" : "pointer",
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
