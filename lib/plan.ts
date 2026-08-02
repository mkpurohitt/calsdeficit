/**
 * Deterministic nutrition/fitness plan math shared by onboarding and the
 * goals editor. Mifflin-St Jeor BMR → activity-adjusted TDEE → goal-adjusted
 * calories, with evidence-based macro splits. Pure functions, client-safe.
 */

export type Gender = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "Lose Weight" | "Maintain Weight" | "Gain Muscle";
export type HeightUnit = "cm" | "ft";
export type WeightUnit = "kg" | "lbs";

export interface PlanInput {
  gender: Gender;
  age: number;
  height_cm: number;
  weight_kg: number;
  goal_weight_kg?: number;
  goal: GoalType;
  activity_level: ActivityLevel;
}

/** Per-meal calorie targets derived from the daily total. */
export interface MealTargets {
  breakfast: number;
  lunch: number;
  dinner: number;
  snacks: number;
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
  meal_targets: MealTargets;
}

/* ── Unit conversions (canonical storage is metric) ────────────────────── */

export const CM_PER_IN = 2.54;
export const KG_PER_LB = 0.45359237;

export function ftInToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_IN);
}

export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { feet: Math.floor(totalIn / 12), inches: totalIn % 12 };
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * KG_PER_LB * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round((kg / KG_PER_LB) * 10) / 10;
}

/** Age in full years from an ISO birth date (yyyy-mm-dd). */
export function ageFromBirthDate(birthDate: string, today: Date = new Date()): number {
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
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

  // Meal split of the daily calories: 25 / 35 / 30 / 10
  const meal_targets: MealTargets = {
    breakfast: Math.round(daily_calories * 0.25),
    lunch: Math.round(daily_calories * 0.35),
    dinner: Math.round(daily_calories * 0.3),
    snacks: Math.round(daily_calories * 0.1),
  };

  return { bmr, tdee, daily_calories, protein_g, carbs_g, fat_g, fiber_g, step_goal, water_ml, meal_targets };
}

/**
 * Detailed fallback weekly split (with exercises/sets) when the AI endpoint
 * is unavailable. Chooses a structure by how many days the user can train.
 */
export function templateWeeklyPlan(goal: GoalType, workoutDays: number = 4): string {
  const cardio =
    goal === "Lose Weight" ? "30–40 min brisk cardio + 10k steps" :
    goal === "Gain Muscle" ? "20 min easy cardio + 7k steps" :
    "30 min cardio you enjoy + 8k steps";

  if (workoutDays <= 3) {
    return [
      "**Mon — Full Body A** · Squat 3×8 · Bench Press 3×8 · Barbell Row 3×10 · Plank 3×45s",
      `**Tue — Active recovery** · ${cardio}`,
      "**Wed — Full Body B** · Deadlift 3×6 · Overhead Press 3×8 · Lat Pulldown 3×10 · Lunge 3×10",
      "**Thu — Rest** · stretch 10 min",
      "**Fri — Full Body C** · Leg Press 3×10 · Incline DB Press 3×10 · Cable Row 3×12 · Biceps Curl 3×12",
      `**Sat — Cardio** · ${cardio}`,
      "**Sun — Rest** · meal prep",
    ].join("\n");
  }
  if (workoutDays === 4) {
    return [
      "**Mon — Upper** · Bench Press 4×8 · Barbell Row 4×8 · Overhead Press 3×10 · Biceps Curl 3×12 · Triceps Pushdown 3×12",
      "**Tue — Lower** · Squat 4×8 · Romanian Deadlift 3×10 · Leg Press 3×12 · Calf Raise 4×15 · Plank 3×45s",
      `**Wed — Active recovery** · ${cardio}`,
      "**Thu — Upper** · Incline DB Press 4×10 · Lat Pulldown 4×10 · Lateral Raise 3×15 · Hammer Curl 3×12",
      "**Fri — Lower** · Deadlift 3×6 · Lunge 3×10 · Leg Curl 3×12 · Hanging Leg Raise 3×12",
      `**Sat — Cardio** · ${cardio}`,
      "**Sun — Rest** · stretch + meal prep",
    ].join("\n");
  }
  if (workoutDays === 5) {
    return [
      "**Mon — Push** · Bench Press 4×8 · Overhead Press 3×10 · Incline DB Press 3×10 · Lateral Raise 3×15 · Triceps Pushdown 3×12",
      "**Tue — Pull** · Deadlift 3×6 · Lat Pulldown 4×10 · Cable Row 3×12 · Face Pull 3×15 · Biceps Curl 3×12",
      "**Wed — Legs** · Squat 4×8 · Leg Press 3×12 · Leg Curl 3×12 · Calf Raise 4×15 · Plank 3×45s",
      "**Thu — Upper** · Incline Bench 3×10 · Barbell Row 3×10 · Lateral Raise 3×15 · Curls + Extensions 3×12",
      "**Fri — Lower** · Romanian Deadlift 3×10 · Lunge 3×10 · Hip Thrust 3×12 · Hanging Leg Raise 3×12",
      `**Sat — Cardio** · ${cardio}`,
      "**Sun — Rest** · stretch + meal prep",
    ].join("\n");
  }
  return [
    "**Mon — Push** · Bench Press 4×8 · Overhead Press 3×10 · Incline DB Press 3×10 · Lateral Raise 3×15 · Triceps Pushdown 3×12",
    "**Tue — Pull** · Barbell Row 4×8 · Lat Pulldown 4×10 · Cable Row 3×12 · Face Pull 3×15 · Biceps Curl 3×12",
    "**Wed — Legs** · Squat 4×8 · Romanian Deadlift 3×10 · Leg Press 3×12 · Calf Raise 4×15",
    "**Thu — Push** · Incline Bench 4×10 · Arnold Press 3×10 · Dips 3×10 · Lateral Raise 3×15",
    "**Fri — Pull** · Deadlift 3×6 · Pull-Up 4×AMRAP · Seated Row 3×12 · Hammer Curl 3×12",
    "**Sat — Legs + Core** · Front Squat 3×8 · Lunge 3×10 · Leg Curl 3×12 · Hanging Leg Raise 3×15",
    `**Sun — Rest** · ${cardio}`,
  ].join("\n");
}

/* ── Health context options (onboarding) ─────────────────────────────────── */

/** Conditions common enough to change nutrition guidance, in plain language. */
export const HEALTH_CONDITIONS = [
  "Type 2 diabetes",
  "Type 1 diabetes",
  "Pre-diabetes",
  "High blood pressure",
  "High cholesterol",
  "Thyroid (hypo/hyper)",
  "PCOS / PCOD",
  "Heart condition",
  "Fatty liver",
  "Kidney issues",
  "Acidity / GERD",
  "IBS / gut issues",
  "Asthma",
  "Joint pain / arthritis",
  "Pregnant / breastfeeding",
  "Recent injury or surgery",
] as const;

export const DIETARY_PREFERENCES = [
  "Vegetarian",
  "Eggetarian",
  "Non-vegetarian",
  "Vegan",
  "Jain",
] as const;

export const COMMON_ALLERGIES = [
  "Milk / lactose",
  "Gluten / wheat",
  "Peanuts",
  "Tree nuts",
  "Soy",
  "Eggs",
  "Fish",
  "Shellfish",
  "Sesame",
] as const;
