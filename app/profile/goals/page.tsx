"use client";

import { useEffect, useState } from "react";
import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getUserGoal, saveUserGoal } from "../../../lib/user-data";

export default function GoalsPage() {
  const { user } = useAuth() as { user: { uid?: string } | null };
  const [form, setForm] = useState({
    age: 25,
    weight_kg: 75,
    height_cm: 175,
    goal: "Maintain Weight",
    daily_calories: 2400,
    protein_g: 150,
    carbs_g: 250,
    fat_g: 65,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getUserGoal(user.uid).then((goal) => {
      if (goal) {
        setForm({
          age: goal.age,
          weight_kg: goal.weight_kg,
          height_cm: goal.height_cm,
          goal: goal.goal,
          daily_calories: goal.daily_calories,
          protein_g: goal.protein_g,
          carbs_g: goal.carbs_g,
          fat_g: goal.fat_g,
        });
      }
    });
  }, [user]);

  const handleSave = async () => {
    if (!user?.uid) return;
    await saveUserGoal({ user_id: user.uid, ...form });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Edit TDEE & Macros</h1>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Age", "age"],
              ["Weight (kg)", "weight_kg"],
              ["Height (cm)", "height_cm"],
              ["Daily Calories", "daily_calories"],
              ["Protein (g)", "protein_g"],
              ["Carbs (g)", "carbs_g"],
              ["Fat (g)", "fat_g"],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="cl-label">{label}</label>
                <input
                  className="cl-input"
                  type="number"
                  value={form[key as keyof typeof form] as number}
                  onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
                />
              </div>
            ))}
            <div>
              <label className="cl-label">Goal</label>
              <select className="cl-input" value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })}>
                <option>Lose Weight</option>
                <option>Maintain Weight</option>
                <option>Build Muscle</option>
              </select>
            </div>
          </div>
          <button className="btn-primary mt-6" onClick={handleSave}>Save Goals</button>
          {saved && <p style={{ fontSize: 13, color: "var(--lime-400)", marginTop: 12 }}>Goals updated.</p>}
        </div>
      </div>
    </AppLayout>
  );
}

