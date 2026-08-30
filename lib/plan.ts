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
  /** How many weeks the user wants to take to reach goal_weight_kg. */
  timeframe_weeks?: number;
}

/** Energy in 1 kg of body mass — the standard 7,700 kcal figure. */
export const KCAL_PER_KG = 7700;

/**
 * Safe weekly rates of change. Losing faster than ~1% of bodyweight a week
 * costs lean mass and is rarely sustained; gaining faster than ~0.35 kg/week is
 * mostly fat. A requested pace beyond these is honoured only up to the cap, and
 * the plan reports the realistic finish date instead of silently obeying.
 */
export const MAX_LOSS_FRACTION_PER_WEEK = 0.01;
export const MAX_LOSS_KG_PER_WEEK = 1.0;
export const MAX_GAIN_KG_PER_WEEK = 0.35;

export type Pace = "gentle" | "steady" | "ambitious" | "capped";

/** How the requested timeframe was reconciled with what's safe. */
export interface Timeline {
  /** Weeks the user asked for (0 when they didn't say). */
  requested_weeks: number;
  /** kg/week actually planned for, after clamping. */
  weekly_rate_kg: number;
  /** Weeks it will realistically take at that rate. */
  projected_weeks: number;
  /** True when the request was faster than is safe and had to be slowed. */
  capped: boolean;
  pace: Pace;
  /** Daily calorie delta from TDEE implied by weekly_rate_kg. */
  daily_delta_kcal: number;
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
  /** Present when a goal weight and a timeframe were both supplied. */
  timeline?: Timeline;
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

/**
 * Reconciles "I want to lose 8 kg in 10 weeks" with what's physiologically
 * safe, and reports the daily calorie delta that implies. Returns null when
 * there's nothing to plan against (no goal weight, no timeframe, or already
 * at target).
 */
export function computeTimeline(input: PlanInput): Timeline | null {
  const { weight_kg, goal_weight_kg, goal, timeframe_weeks } = input;
  if (goal === "Maintain Weight") return null;
  if (!goal_weight_kg || !timeframe_weeks || timeframe_weeks <= 0) return null;

  const losing = goal === "Lose Weight";
  const delta_kg = Math.abs(weight_kg - goal_weight_kg);
  if (delta_kg < 0.5) return null;

  const requested_rate = delta_kg / timeframe_weeks;
  const cap = losing
    ? Math.min(MAX_LOSS_KG_PER_WEEK, weight_kg * MAX_LOSS_FRACTION_PER_WEEK)
    : MAX_GAIN_KG_PER_WEEK;

  const weekly_rate_kg = Math.min(requested_rate, cap);
  const capped = requested_rate > cap + 0.001;
  const projected_weeks = Math.ceil(delta_kg / weekly_rate_kg);

  // Fraction of the safe cap this pace uses — a stable way to describe effort
  // regardless of bodyweight.
  const intensity = weekly_rate_kg / cap;
  const pace: Pace = capped ? "capped" : intensity > 0.75 ? "ambitious" : intensity > 0.4 ? "steady" : "gentle";

  return {
    requested_weeks: timeframe_weeks,
    weekly_rate_kg: Math.round(weekly_rate_kg * 100) / 100,
    projected_weeks,
    capped,
    pace,
    daily_delta_kcal: Math.round((weekly_rate_kg * KCAL_PER_KG) / 7),
  };
}

export function calculatePlan(input: PlanInput): PlanResult {
  const { gender, age, height_cm, weight_kg, goal, activity_level } = input;

  // Mifflin-St Jeor
  const bmr = Math.round(10 * weight_kg + 6.25 * height_cm - 5 * age + (gender === "male" ? 5 : -161));
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[activity_level]);

  // Goal adjustment. With a target date the deficit/surplus is derived from the
  // pace the user asked for (clamped to what's safe); without one it falls back
  // to the standard moderate 500 kcal deficit / 300 kcal surplus.
  const timeline = computeTimeline(input);
  const floor = gender === "male" ? 1500 : 1200;

  let daily_calories = tdee;
  if (goal === "Lose Weight") {
    const deficit = timeline ? timeline.daily_delta_kcal : 500;
    daily_calories = Math.max(Math.round(tdee - deficit), floor);
  }
  if (goal === "Gain Muscle") {
    const surplus = timeline ? timeline.daily_delta_kcal : 300;
    daily_calories = Math.round(tdee + surplus);
  }

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

  return {
    bmr,
    tdee,
    daily_calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    step_goal,
    water_ml,
    meal_targets,
    ...(timeline ? { timeline } : {}),
  };
}

/* ── Steps → distance ───────────────────────────────────────────────────── */

/**
 * Walking stride is close to a fixed fraction of height, so a step count means
 * a different distance for different people — which is the whole point of
 * asking for height. 0.415 is the standard male ratio, 0.413 female; the
 * difference is under a percent, so one constant is honest enough here.
 */
export const STRIDE_HEIGHT_RATIO = 0.415;

export function strideMetres(height_cm: number): number {
  // Guard against an unset/absurd height rather than returning 0 km.
  const cm = height_cm >= 120 && height_cm <= 230 ? height_cm : 170;
  return (cm * STRIDE_HEIGHT_RATIO) / 100;
}

export function stepsToKm(steps: number, height_cm: number): number {
  if (!steps || steps < 0) return 0;
  return (steps * strideMetres(height_cm)) / 1000;
}

/** "3.2 km" — one decimal under 10 km, whole numbers above. */
export function formatKm(km: number): string {
  if (km <= 0) return "0 km";
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
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

/**
 * What each label actually rules in or out. These words mean different things
 * in different places — "vegetarian" includes eggs in much of the West but not
 * in India — so the UI spells the boundary out rather than assuming.
 */
export const DIETARY_PREFERENCE_NOTES: Record<string, string> = {
  Vegetarian: "No meat, fish or eggs. Milk, curd, paneer and ghee are fine.",
  Eggetarian: "Vegetarian plus eggs. No meat or fish.",
  "Non-vegetarian": "Everything — meat, fish, eggs and dairy.",
  Vegan: "No animal products at all: no dairy, eggs, honey or ghee.",
  Jain: "Vegetarian, and no onion, garlic, potato or other root vegetables.",
};

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
