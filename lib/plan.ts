/**
 * Deterministic nutrition/fitness plan math shared by onboarding and the
 * goals editor. Mifflin-St Jeor BMR → activity-adjusted TDEE → goal-adjusted
 * calories, with evidence-based macro splits. Pure functions, client-safe.
 */

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "Lose Weight" | "Maintain Weight" | "Gain Muscle";

export interface PlanInput {
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg?: number;
  goal: GoalType;
  activity_level: ActivityLevel;
}

export interface PlanResult {
  bmr: number;
  tdee: number;
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  step_goal: number;
  water_ml: number;
}

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: "Sedentary", desc: "Desk job, little exercise" },
  light: { label: "Lightly active", desc: "Light exercise 1–3 days/week" },
  moderate: { label: "Moderately active", desc: "Exercise 3–5 days/week" },
  active: { label: "Very active", desc: "Hard exercise 6–7 days/week" },
  very_active: { label: "Athlete", desc: "Twice-daily training / physical job" },
};

export function calculatePlan(input: PlanInput): PlanResult {
  const { gender, age, height_cm, weight_kg, goal, activity_level } = input;

  // Mifflin-St Jeor
  const bmr = Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + (gender === "male" ? 5 : -161));
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activity_level]);

  // Goal adjustment: moderate, sustainable deficit/surplus
  let daily_calories = tdee;
  if (goal === "Lose Weight") daily_calories = Math.max(Math.round(tdee - 500), gender === "male" ? 1500 : 1200);
  if (goal === "Gain Muscle") daily_calories = Math.round(tdee + 300);

  // Protein by goal (g per kg bodyweight): cutting needs more to retain muscle
  const proteinPerKg = goal === "Lose Weight" ? 2.0 : goal === "Gain Muscle" ? 1.8 : 1.6;
  const protein_g = Math.round(proteinPerKg * weight_kg);

  // Fat: 25% of calories (9 kcal/g), carbs fill the remainder (4 kcal/g)
  const fat_g = Math.round((daily_calories * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((daily_calories - protein_g * 4 - fat_g * 9) / 4));

  // Fiber: 14 g per 1000 kcal (Institute of Medicine)
  const fiber_g = Math.round((daily_calories / 1000) * 14);

  // Steps: higher target when cutting
  const step_goal = goal === "Lose Weight" ? 10000 : goal === "Gain Muscle" ? 7000 : 8000;

  // Water: ~35 ml per kg, rounded to glass (250 ml), min 2000
  const water_ml = Math.max(2000, Math.round((weight_kg * 35) / 250) * 250);

  return { bmr, tdee, daily_calories, protein_g, carbs_g, fat_g, fiber_g, step_goal, water_ml };
}

/** Fallback weekly plan when the AI endpoint is unavailable. */
export function templateWeeklyPlan(goal: GoalType): string {
  if (goal === "Lose Weight") {
    return [
      "**Mon** — Full-body strength (45 min) + 10k steps",
      "**Tue** — Brisk walk / cycle 30–40 min",
      "**Wed** — Upper-body strength + core",
      "**Thu** — Active recovery: walk, stretch",
      "**Fri** — Lower-body strength",
      "**Sat** — Cardio you enjoy (45 min)",
      "**Sun** — Rest + meal prep",
    ].join("\n");
  }
  if (goal === "Gain Muscle") {
    return [
      "**Mon** — Push: chest, shoulders, triceps",
      "**Tue** — Pull: back, biceps",
      "**Wed** — Legs + core",
      "**Thu** — Rest",
      "**Fri** — Upper body (heavy)",
      "**Sat** — Lower body + accessories",
      "**Sun** — Rest, 7k steps",
    ].join("\n");
  }
  return [
    "**Mon** — Full-body strength (40 min)",
    "**Tue** — 8k steps + mobility",
    "**Wed** — Upper-body strength",
    "**Thu** — Cardio 30 min",
    "**Fri** — Lower-body strength",
    "**Sat** — Fun activity: hike, sport, swim",
    "**Sun** — Rest",
  ].join("\n");
}
