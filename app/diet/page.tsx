"use client";
import { useState } from "react";
import AppLayout from "../../components/AppLayout";
import { Droplet, Camera, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DietPage() {
  const router = useRouter();
  const [isOnboarded, setIsOnboarded] = useState(false); 
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [expandedMeal, setExpandedMeal] = useState<string | null>("Breakfast");

  const totalWaterMl = waterGlasses * 300;
  const waterGoal = 2500;

  // Mock calorie data
  const consumed = 1200;
  const goal = 2400;
  const percent = Math.min(consumed / goal, 1);
  const ringSize = 200;
  const r = (ringSize / 2) - 16;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - percent);

  const meals = [
    {
      name: "Breakfast",
      color: "var(--macro-carbs)",
      items: [
        { food: "Oatmeal & Protein Shake", portion: "250g + 300ml", calories: 450, protein: 30 },
      ]
    },
    {
      name: "Lunch",
      color: "var(--lime-400)",
      items: [
        { food: "Grilled Chicken Salad", portion: "350g", calories: 380, protein: 42 },
      ]
    },
    {
      name: "Dinner",
      color: "var(--macro-fat)",
      items: [
        { food: "Brown Rice & Paneer", portion: "300g", calories: 370, protein: 22 },
      ]
    },
    {
      name: "Snacks",
      color: "var(--info)",
      items: []
    },
  ];

  const macros = [
    { label: "Protein", current: 94, target: 150, color: "var(--macro-protein)" },
    { label: "Carbs", current: 120, target: 250, color: "var(--macro-carbs)" },
    { label: "Fat", current: 35, target: 65, color: "var(--macro-fat)" },
    { label: "Fiber", current: 12, target: 30, color: "var(--macro-fiber)" },
  ];

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
            
            <form onSubmit={(e) => { e.preventDefault(); setIsOnboarded(true); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="cl-label">Age</label>
                  <input type="number" placeholder="25" className="cl-input" required />
                </div>
                <div>
                  <label className="cl-label">Weight (kg)</label>
                  <input type="number" placeholder="75" className="cl-input" required />
                </div>
              </div>
              <div>
                <label className="cl-label">Height (cm)</label>
                <input type="number" placeholder="175" className="cl-input" required />
              </div>
              <div>
                <label className="cl-label">Primary Goal</label>
                <select className="cl-input" style={{ cursor: "pointer" }}>
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
            onClick={() => router.push('/?mode=food')}
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
                  { label: "P", value: "94g", color: "var(--macro-protein)" },
                  { label: "C", value: "120g", color: "var(--macro-carbs)" },
                  { label: "F", value: "35g", color: "var(--macro-fat)" },
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
              style={{ padding: "12px 16px", borderRadius: "var(--radius-lg)" }}
            >
              <button
                onClick={() => router.push('/?mode=food')}
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
                          key={idx}
                          className="flex items-center justify-between py-3"
                          style={{ borderBottom: idx < meal.items.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                        >
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{item.food}</p>
                            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{item.portion}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--lime-400)" }}>
                              {item.calories}
                            </span>
                            <button className="btn-icon" style={{ width: 28, height: 28, border: "none", background: "transparent" }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "12px 0" }}>No items logged yet</p>
                    )}

                    <button
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
    </AppLayout>
  );
}