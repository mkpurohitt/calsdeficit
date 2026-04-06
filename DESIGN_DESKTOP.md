# Calolean — Desktop Design System & UI Specification
> For: Web App (Desktop, ≥1024px) · Both Light & Dark Mode · All Screens
> Brand: calolean · Theme: Neon-Tech · Accent: Electric Lime

---

## Table of Contents
1. [Design Tokens](#1-design-tokens)
2. [Typography](#2-typography)
3. [Component Library](#3-component-library)
4. [Layout System](#4-layout-system)
5. [Screen: Landing Page](#5-screen-landing-page)
6. [Screen: Auth — Login & Signup](#6-screen-auth--login--signup)
7. [Screen: Onboarding — Profile & Goals](#7-screen-onboarding--profile--goals)
8. [Screen: Home — AI Chat](#8-screen-home--ai-chat)
9. [Screen: Diet Tracker](#9-screen-diet-tracker)
10. [Screen: Exercise — Form Check & Log](#10-screen-exercise--form-check--log)
11. [Screen: Shop](#11-screen-shop)
12. [Screen: Profile](#12-screen-profile)
13. [Navigation](#13-navigation)
14. [Animations & Transitions](#14-animations--transitions)
15. [Dark Mode Implementation](#15-dark-mode-implementation)

---

## 1. Design Tokens

### Color Palette

```css
:root {
  /* ─── Brand Accent ─── */
  --lime-400: #AAFF00;        /* Primary CTA, active states, progress */
  --lime-500: #8FE000;        /* Hover state on lime buttons */
  --lime-600: #72B800;        /* Pressed state */
  --lime-100: #EEFFCC;        /* Lime tint for light mode backgrounds */
  --lime-950: #1A2600;        /* Lime tint for dark mode surfaces */

  /* ─── Dark Mode Backgrounds ─── */
  --dark-950: #0A0C0F;        /* App background — deepest */
  --dark-900: #0F1218;        /* Sidebar, nav background */
  --dark-800: #161B24;        /* Card background */
  --dark-700: #1E2533;        /* Elevated card, modal */
  --dark-600: #252D3D;        /* Input background */
  --dark-500: #2E3848;        /* Border, divider */
  --dark-400: #3D4A5C;        /* Subtle border */

  /* ─── Light Mode Backgrounds ─── */
  --light-50:  #FFFFFF;       /* Pure white — card, modal */
  --light-100: #F8F9FB;       /* App background */
  --light-200: #F1F3F7;       /* Sidebar, nav */
  --light-300: #E8ECF2;       /* Input background */
  --light-400: #D8DDE8;       /* Border */
  --light-500: #C2C9D6;       /* Subtle border */

  /* ─── Text — Dark Mode ─── */
  --text-primary-dark: #FFFFFF;
  --text-secondary-dark: #A0ABBF;
  --text-tertiary-dark: #6B7A94;
  --text-disabled-dark: #3D4A5C;

  /* ─── Text — Light Mode ─── */
  --text-primary-light: #0F1218;
  --text-secondary-light: #4A5568;
  --text-tertiary-light: #718096;
  --text-disabled-light: #CBD5E0;

  /* ─── Semantic Colors ─── */
  --success: #AAFF00;         /* Same as lime — success = brand */
  --warning: #FFB800;
  --error: #FF4D4D;
  --info: #4D9EFF;

  /* ─── Macro Colors ─── */
  --macro-protein: #AAFF00;   /* Lime — protein bars */
  --macro-carbs: #FFB800;     /* Amber — carb bars */
  --macro-fat: #FF6B4D;       /* Coral — fat bars */
  --macro-fiber: #4D9EFF;     /* Blue — fiber bars */
}
```

### Spacing Scale

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### Border Radius

```css
--radius-sm:  6px;    /* Chips, tags, small badges */
--radius-md:  10px;   /* Inputs, small cards */
--radius-lg:  16px;   /* Cards, modals */
--radius-xl:  24px;   /* Large cards, panels */
--radius-2xl: 32px;   /* Hero cards */
--radius-full: 9999px; /* Pills, avatars, circular elements */
```

### Shadows

```css
/* Dark mode — glow effects */
--shadow-lime-sm:  0 0 12px rgba(170, 255, 0, 0.15);
--shadow-lime-md:  0 0 24px rgba(170, 255, 0, 0.20);
--shadow-lime-lg:  0 0 48px rgba(170, 255, 0, 0.25);
--shadow-card-dark: 0 4px 24px rgba(0, 0, 0, 0.4);
--shadow-modal-dark: 0 8px 48px rgba(0, 0, 0, 0.6);

/* Light mode — standard elevation */
--shadow-sm:  0 1px 3px rgba(0, 0, 0, 0.08);
--shadow-md:  0 4px 16px rgba(0, 0, 0, 0.10);
--shadow-lg:  0 8px 32px rgba(0, 0, 0, 0.12);
--shadow-xl:  0 16px 48px rgba(0, 0, 0, 0.14);
```

---

## 2. Typography

### Font Stack

```css
/* Primary — use for all UI text */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Display — use for hero headlines only */
--font-display: 'Space Grotesk', var(--font-sans);

/* Mono — use for numbers, calorie counts, stats */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

Import in `app/layout.tsx`:
```typescript
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
```

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | 11px | 400 | 1.4 | Labels, badges, captions |
| `--text-sm` | 13px | 400 | 1.5 | Secondary body, table cells |
| `--text-base` | 15px | 400 | 1.6 | Primary body text |
| `--text-md` | 17px | 500 | 1.5 | Card titles, nav items |
| `--text-lg` | 20px | 600 | 1.4 | Section headings |
| `--text-xl` | 24px | 700 | 1.3 | Page titles |
| `--text-2xl` | 32px | 700 | 1.2 | Hero stats (calorie ring number) |
| `--text-3xl` | 40px | 800 | 1.1 | Landing hero headline |
| `--text-4xl` | 56px | 800 | 1.0 | Max headline size |

### Brand Wordmark

```css
/* "calolean" wordmark — always this exact rendering */
.brand-wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.5px;
}
.brand-wordmark span:first-child { color: var(--text-primary); }  /* "calo" */
.brand-wordmark span:last-child  { color: var(--lime-400); }       /* "lean" */
```

---

## 3. Component Library

### 3.1 Buttons

```css
/* Primary CTA — lime green, used for main actions */
.btn-primary {
  background: var(--lime-400);
  color: #0A0C0F;                /* Always dark text on lime */
  font-weight: 700;
  font-size: 15px;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
}
.btn-primary:hover  { background: var(--lime-500); box-shadow: var(--shadow-lime-sm); }
.btn-primary:active { transform: scale(0.98); background: var(--lime-600); }

/* Secondary — outlined */
.btn-secondary {
  background: transparent;
  color: var(--lime-400);
  border: 1.5px solid var(--lime-400);
  font-weight: 600;
  padding: 11px 24px;
  border-radius: var(--radius-md);
  transition: background 0.15s, box-shadow 0.15s;
}
.btn-secondary:hover { background: rgba(170, 255, 0, 0.08); box-shadow: var(--shadow-lime-sm); }

/* Ghost — for subtle actions */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 10px 20px;
  border-radius: var(--radius-md);
}
.btn-ghost:hover { background: var(--surface-elevated); }

/* Icon button — square, icon only */
.btn-icon {
  width: 40px; height: 40px;
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  background: var(--surface-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-icon:hover { color: var(--lime-400); border-color: var(--lime-400); }

/* Social auth button — Google */
.btn-social {
  background: var(--surface-elevated);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 12px 20px;
  border-radius: var(--radius-md);
  display: flex; align-items: center; gap: 10px;
  font-weight: 500; width: 100%;
  transition: background 0.15s;
}
.btn-social:hover { background: var(--surface-hover); }
```

### 3.2 Inputs

```css
.input {
  width: 100%;
  padding: 12px 16px;
  background: var(--input-bg);
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 15px;
  font-family: var(--font-sans);
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}
.input::placeholder { color: var(--text-tertiary); }
.input:focus {
  border-color: var(--lime-400);
  box-shadow: 0 0 0 3px rgba(170, 255, 0, 0.12);
}
.input-error { border-color: var(--error); }
.input-error:focus { box-shadow: 0 0 0 3px rgba(255, 77, 77, 0.12); }

/* Label */
.input-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
```

### 3.3 Cards

```css
/* Base card */
.card {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
}

/* Elevated card — for widgets and feature panels */
.card-elevated {
  background: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-card);
}

/* Lime-accent card — for featured/highlighted cards */
.card-accent {
  background: var(--surface-card);
  border: 1px solid rgba(170, 255, 0, 0.25);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  box-shadow: 0 0 20px rgba(170, 255, 0, 0.06);
}

/* Stat card — for numbers/metrics */
.card-stat {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card-stat__label { font-size: 12px; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
.card-stat__value { font-size: 28px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary); }
.card-stat__unit  { font-size: 14px; color: var(--text-secondary); }
```

### 3.4 Progress & Macro Bars

```css
/* Macro progress bar */
.macro-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}
.macro-bar__header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}
.macro-bar__track {
  height: 6px;
  background: var(--surface-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.macro-bar__fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.macro-bar__fill--protein { background: var(--macro-protein); }
.macro-bar__fill--carbs   { background: var(--macro-carbs); }
.macro-bar__fill--fat     { background: var(--macro-fat); }
.macro-bar__fill--fiber   { background: var(--macro-fiber); }
```

### 3.5 Calorie Ring (SVG)

The calorie ring shown in Diet screen — large circular progress indicator:

```typescript
// components/ui/NutrientRing.tsx
interface NutrientRingProps {
  consumed: number
  goal: number
  size?: number
}

export function NutrientRing({ consumed, goal, size = 180 }: NutrientRingProps) {
  const percent = Math.min(consumed / goal, 1)
  const r = (size / 2) - 16
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - percent)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="var(--surface-elevated)" strokeWidth="10" />
        {/* Progress — lime green */}
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="#AAFF00" strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono text-primary">{consumed.toLocaleString()}</span>
        <span className="text-sm text-tertiary">of {goal.toLocaleString()} kcal</span>
      </div>
    </div>
  )
}
```

### 3.6 Navigation Sidebar (Desktop)

```
Width: 240px (collapsed: 64px)
Background: var(--dark-900) / var(--light-200)
Border-right: 1px solid var(--border-color)

Items:
- Logo area: 64px height, calolean wordmark
- Nav items: 48px height each, 12px padding, 8px gap
- Active item: lime green left border (3px), lime text, lime-tinted background
- Hover item: surface-elevated background, text-primary color
- Bottom: user avatar + name + settings icon

Nav order:
1. Home (chat icon)
2. Diet (fork-knife icon)
3. Exercise (dumbbell icon)
4. Shop (shopping bag icon)
5. Profile (user icon)
```

### 3.7 Chat Message Bubble

```css
/* User message — right aligned */
.chat-bubble-user {
  background: var(--lime-400);
  color: #0A0C0F;
  border-radius: 18px 18px 4px 18px;
  padding: 12px 16px;
  max-width: 72%;
  font-size: 15px;
  line-height: 1.5;
  margin-left: auto;
}

/* AI message — left aligned */
.chat-bubble-ai {
  background: var(--surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 18px 18px 18px 4px;
  padding: 14px 18px;
  max-width: 80%;
  font-size: 15px;
  line-height: 1.6;
}

/* AI typing indicator */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 14px 18px;
  background: var(--surface-elevated);
  border-radius: 18px 18px 18px 4px;
  width: fit-content;
}
.typing-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  animation: typing-bounce 1.2s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-8px); opacity: 1; }
}
```

### 3.8 Native Ad Card

```css
/* Below every 3rd AI response, free users only */
.ad-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  position: relative;
}
.ad-card__label {
  position: absolute;
  top: 8px; right: 12px;
  font-size: 10px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.ad-card__image {
  width: 56px; height: 56px;
  border-radius: var(--radius-md);
  object-fit: cover;
}
.ad-card__content { flex: 1; }
.ad-card__headline { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.ad-card__body     { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.ad-card__cta {
  font-size: 12px;
  font-weight: 700;
  color: var(--lime-400);
  white-space: nowrap;
  padding: 6px 14px;
  border: 1px solid var(--lime-400);
  border-radius: var(--radius-sm);
}
```

---

## 4. Layout System

### Desktop Grid

```
Total width:         100vw
Max content width:   1440px (centered)
Sidebar width:       240px (fixed left)
Main content width:  calc(100% - 240px)
Main content padding: 32px

Breakpoints:
  lg: 1024px  — sidebar visible, single column content
  xl: 1280px  — sidebar + 2-column content
  2xl: 1440px — sidebar + 2-3 column content
```

### Main Content Layout Pattern

```
All main screens use this 3-column grid where applicable:
  Left column:    380px  — primary widget / chart / main interaction
  Center column:  1fr    — secondary content / lists
  Right column:   320px  — stats / summary cards

On xl and below: 2 columns (right column drops below or merges)
```

---

## 5. Screen: Landing Page

### Hero Section

```
Full viewport height (100vh)
Background: split image — food photo (left 50%) + gym photo (right 50%)
Dark overlay on both images: linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.55))

Logo: top-left, 24px from edges — "calolean" wordmark white/lime
Pink top bar from existing MVP: keep (1px, brand accent)

Headline (center, over both images):
  "The Future of Personal Health is Coming."
  Font: Space Grotesk, 56px, weight 800, white, max-width 600px

Subtext:
  "Join the waitlist for calolean today and be the first to experience it."
  Font: Inter, 18px, weight 400, rgba(255,255,255,0.85)

Email input + Join button (side by side):
  Input: white bg, 400px wide, 52px height, border-radius 10px
  Button: var(--lime-400), dark text, 52px height, 120px wide, font-weight 700
  Hover: button gets var(--lime-500) + subtle lime glow
```

### Feature Sections

```
Section 2 — AI Nutrition (white bg):
  Left: food bowl photo (550px × 400px, border-radius 16px)
        Dark overlay card on photo: protein/carbs/fat bars in lime
  Right: 3-step process list with lime icon backgrounds

Section 3 — AI Form Analysis (dark navy bg: #0F1218):
  Left: text + description
  Right: gym photo with green badge overlays ("Knees aligned", "Back straight")
         Lime progress bar at bottom: "Analysis in progress"

Section 4 — Muscle Library (light bg):
  Two cards side-by-side:
    Left: "Explore Exercises" — filter chips + exercise list
    Right: "Track Your Progress" — calendar + workout log

Section 5 — Shop/Products (light bg):
  Headline: "Affordable High-Quality Protein Products"
  4 feature cards: Zero Additives / No Extra Calories / Zero Sugar / Pure Plant Based

Footer (dark navy):
  "© 2026 calolean. All rights reserved." — centered, text-tertiary
```

---

## 6. Screen: Auth — Login & Signup

### Layout (Desktop)

```
Split layout — 50/50
Left half:
  Background image: gym/athlete photo (dark, moody)
  Dark overlay: rgba(10, 12, 15, 0.7)
  Centered content:
    calolean wordmark (large, 32px)
    Tagline: "Train smarter . Eat Cleaner . Get Leaner"
    3 feature bullets with lime checkmarks:
      ✓ Advanced Tracking
      ✓ AI Nutrition Analysis
      ✓ Form Analysis

Right half:
  Background: var(--dark-900) [dark] / var(--light-50) [light]
  Centered card (480px wide, no border in dark mode, subtle shadow in light)
```

### Login Screen — Dark Mode

```
Card content (top to bottom):
  1. calolean wordmark — 24px
  2. Headline: "Welcome back, athlete" — 28px, Space Grotesk, white
  3. Subtext: "Your goals are waiting." — 14px, text-secondary
  4. Gap: 32px
  5. Email input — full width
  6. Password input — full width, eye icon toggle
  7. "Forgot password?" — right-aligned link, lime, 13px
  8. Gap: 24px
  9. "Sign In" button — full width, lime, 52px height
  10. Divider: "— or continue with —" — text-tertiary
  11. "Continue with Google" — social button, full width
  12. Bottom: "No account? Sign up" — centered, lime link
```

### Signup Screen — Dark Mode

```
Card content:
  1. calolean wordmark — 24px
  2. Headline: "Create Account" — 28px, Space Grotesk
  3. Subtext: "Start your health transformation today."
  4. Full Name input
  5. Email Address input
  6. Password input (show/hide)
  7. Confirm Password input
  8. Checkbox: "I agree to Terms of Service and Privacy Policy"
  9. "Create Account" button — lime, full width, 52px
  10. "Continue with Google" — social button
  11. "Already have an account? Sign in"
```

### OTP Verification Screen

```
Center card (400px wide):
  calolean wordmark
  Lock icon in lime circle (48px)
  Headline: "Verify Account"
  Subtext: "Enter the 6-digit code sent to your email"
  4-digit OTP input boxes (60px × 64px each, auto-advance, lime border on focus)
  "Verify" button — full width lime
  "Resend code" — lime link, 13px
```

### Light Mode Auth Differences

```
Right half background: #FFFFFF
Input background: var(--light-300) — #F1F3F7
Input border: var(--light-400) — #D8DDE8
Card: white, subtle shadow (var(--shadow-lg))
Text: dark navy (#0F1218)
All lime accents remain identical
```

---

## 7. Screen: Onboarding — Profile & Goals

### Layout

```
Single centered column — max-width 580px, centered in main area
Dark background with subtle texture
Step indicator at top: 4 dots, current step filled lime
```

### Step 1 — Basic Info

```
Headline: "Set your daily goals" — 28px, Space Grotesk
Subtext: "Help us personalize your experience"

Fields (stacked):
  - Age (number input, stepper +/-)
  - Weight (kg/lbs toggle, number input)
  - Height (cm/ft toggle, number input)
  - Sex (toggle chips: Male / Female)

"Next" button — lime, full width
```

### Step 2 — Activity Level

```
5 selection cards in a column:
  Each card: icon + label + description
  Selected: lime border (1.5px) + lime-tinted background + lime checkmark
  
  Sedentary — "Little to no exercise"
  Lightly Active — "Exercise 1-3 days/week"
  Moderately Active — "Exercise 3-5 days/week"
  Very Active — "Exercise 6-7 days/week"
  Super Active — "Physical job + daily training"
```

### Step 3 — Goal

```
3 large selection cards:
  "Lose Weight" — trending-down icon
  "Maintain Weight" — balance icon
  "Gain Muscle" — trending-up icon
  
Each card: 140px height, centered content, icon + title + brief description
Selected: lime border + lime glow shadow + lime background tint
```

### Step 4 — Results & Targets

```
Calculated TDEE display:
  Large number (2,450 kcal) in lime — JetBrains Mono, 48px
  Label: "Daily Calorie Target"

Macro sliders (from your Stitch screen):
  Protein: slider with lime thumb + fill, current value badge
  Carbs: slider, current value badge
  Fat: slider, current value badge
  
  Each slider: 6px track, 18px lime thumb, value shown right

"Start Your Journey" button — lime, full width, 52px
Subtext: "You can change these anytime in Profile"
```

---

## 8. Screen: Home — AI Chat

### Desktop Layout

```
Sidebar (240px): Standard nav
Main area: 2-column split
  Left column (640px): Chat interface
  Right column (340px): Quick stats panel

Quick stats panel (right):
  Today's summary card: calories remaining, protein status
  Quick action chips: "Scan food", "Check form"
  Recent activity: last 3 food logs
```

### Chat Interface (Left Column)

```
Top bar:
  "CalAI" title + green dot (online indicator)
  Clear chat button (ghost, icon only)

Messages area:
  Full height minus input, scrollable
  Padding: 24px horizontal, 16px vertical between messages
  
  AI message: left-aligned, surface-elevated bg, lime-accent left border (2px)
  User message: right-aligned, lime bg, dark text
  
  AI food scan response includes:
    Food photo thumbnail (80px × 80px, border-radius 10px)
    Food name (bold)
    Macro pills: protein / carbs / fat in colored chips
    "Add to diary" button — lime, small
  
  Ad card: appears after every 3rd AI response (free users)
    Shows: "Sponsored" label + ad content (your design, AdSense fills content)

Input area (sticky bottom):
  Background: var(--surface-card), border-top: var(--border-color)
  Textarea: auto-resize, 44px min height, 120px max height
  Left of input: camera icon button (attach food photo)
  Right of input: send button (lime, disabled when empty)
  Below input: free tier counter — "3/5 daily scans used"
```

### Light Mode Differences

```
Background: var(--light-100)
Chat bubble AI: white background, light border
Quick stats panel: white cards with light shadows
Input area: white background
```

---

## 9. Screen: Diet Tracker

### Desktop Layout

```
3 columns:
  Left (360px): Calorie ring + Water widget
  Center (1fr): Meal journal (breakfast/lunch/dinner/snacks)
  Right (300px): Macro summary + Today's stats
```

### Left Column

```
Calorie Ring Widget:
  Size: 200px diameter
  Background card: var(--surface-card), border-radius 20px, padding 28px
  Ring: lime green progress on dark track
  Center: calories consumed (JetBrains Mono, 36px, lime) / goal (text-secondary)
  Below ring: 3 macro pills (P / C / F) with current values

Water Tracker Widget (below calorie ring):
  8 glass icons in 2×4 grid
  Filled glasses: lime color
  Empty glasses: text-tertiary outline
  ml counter: "1,500 / 2,500 ml" — text-primary / text-secondary
  "+ Add Water" chip button at bottom
```

### Center Column — Meal Journal

```
Quick scan bar (top):
  Camera icon button (lime bg) + "Scan food or search..." placeholder
  Right: Barcode icon (Pro feature, locked for free)

4 meal sections (accordion style):
  Header: meal name + calorie total + expand chevron
  Active: expanded showing food items
  
  Each food item row:
    Food name (text-primary, 14px)
    Portion size (text-tertiary, 12px)
    Calories (lime, 14px, font-mono)
    Delete button (ghost, icon only)
  
  "Add food" row at bottom of each section:
    "+" icon + "Add food" text — text-tertiary, dashed border

Section colors (left border accents):
  Breakfast: var(--macro-carbs) — amber
  Lunch:     var(--lime-400)    — lime
  Dinner:    var(--macro-fat)   — coral
  Snacks:    var(--info)        — blue
```

### Right Column — Macro Summary

```
Card: "Today's Macros"
  4 macro bars: Protein / Carbs / Fat / Fiber
  Each bar: label left, value right, colored fill bar
  
  Under each bar:
    Consumed: Xg / Goal: Yg (13px, text-secondary)

Card: "Weekly Average" (below)
  Mini bar chart — 7 days, bars in lime, current day highlighted
  Avg calorie label below

Card: "Nutrition Streak" (below)
  Flame icon (amber) + streak number + "days" label
  Subtext: "Keep logging to maintain your streak"
```

---

## 10. Screen: Exercise — Form Check & Log

### Desktop Layout

```
3 columns:
  Left (360px): Step counter + Form check shortcut
  Center (1fr): Exercise calendar + Workout log
  Right (300px): Muscle library shortcut
```

### Left Column

```
Step Counter Widget:
  Circular progress (smaller, 120px diameter)
  Center: step count (font-mono, lime)
  Below: "X / 8,000 steps goal"
  Source: "synced from Google Fit" (text-tertiary, 11px)
  
Form Check Shortcut Card:
  Headline: "Check Your Form"
  Subtext: "Upload a video for AI form analysis"
  Dashed upload area (200px height):
    Camera icon (lime, 32px)
    "Drop video or click to upload"
    "MP4, MOV up to 50MB"
  Select exercise dropdown
  "Analyse Form" button — lime, full width
  
  After analysis:
    Score badge: X/10 in lime circle
    Strengths list (lime checkmarks)
    Corrections list (amber warning icons)
    Injury risk badge: Low/Medium/High
```

### Center Column

```
Exercise Calendar (top):
  Week view — 7 day columns
  Each day: date number + day name
  Workout days: lime dot indicator below date
  Today: lime underline
  Click day → show workout detail panel
  
Workout Log (below calendar):
  For selected day: list of exercises
  Each exercise row:
    Exercise name + muscle group chip
    Sets × Reps × Weight
    Status: "Done" (lime) / "In progress" (amber)
    "Log" button or edit pencil icon
  
  "+ Add Exercise" button at bottom (secondary button style)
  
Form Analysis History (below):
  "Past Form Checks"
  Mini cards: exercise name + date + score/10 badge
  Click → expand full analysis
```

### Right Column — Muscle Library

```
"Muscle Library" header

Search input: "Search exercises..."

Filter chips (horizontal scroll):
  Chest / Back / Legs / Arms / Shoulders / Core / Full Body
  Active chip: lime bg + dark text
  Inactive: surface-elevated bg

Exercise cards (2 per row):
  GIF preview (120px × 80px, border-radius 8px)
  Exercise name (13px, font-weight 600)
  Muscle group chip (lime-tinted, lime text)
  
  On hover: card lifts slightly, "Add to today" button appears
  
"View full library →" link at bottom (lime)
```

---

## 11. Screen: Shop

### Desktop Layout

```
Full width main content (no sidebar columns)
Max-width: 1200px, centered
```

### Coming Soon State (Desktop)

```
Full page overlay with animated "Coming Soon":

Background: dark or light depending on mode
Center content:
  calolean wordmark (large, 40px)
  Headline: "Elevate Your Performance"
  Subtext: "Premium nutrition products coming soon. Built for athletes."
  
  Animated lime ring around "COMING SOON" badge:
    CSS animation: rotate gradient border, pulse glow
    Inner: "COMING SOON" text in lime
    
  Product preview cards (blurred/dimmed, 40% opacity):
    Show ghost versions of product grid
    Backdrop-filter: blur(4px)
  
  Email notification signup:
    "Get notified when we launch"
    Email input + "Notify Me" lime button
```

### Hover animation on product cards

```css
.shop-coming-soon-card {
  filter: blur(3px);
  opacity: 0.4;
  transition: filter 0.3s, opacity 0.3s;
  pointer-events: none;
}

/* Animated lime border on coming soon badge */
@keyframes lime-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.coming-soon-badge {
  position: relative;
  padding: 16px 32px;
  border-radius: 50px;
  font-size: 18px;
  font-weight: 800;
  color: var(--lime-400);
  letter-spacing: 0.1em;
}
.coming-soon-badge::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 52px;
  background: conic-gradient(var(--lime-400), transparent, var(--lime-400));
  animation: lime-rotate 2s linear infinite;
  z-index: -1;
}
```

---

## 12. Screen: Profile

### Desktop Layout

```
2 columns:
  Left (400px): User card + subscription status
  Right (1fr): Settings sections
```

### Left Column

```
User Card (top):
  Avatar: 80px circle, initials fallback (lime bg)
  Name: 22px, font-weight 700
  Email: 14px, text-secondary
  Streak badge: "🔥 X days" — amber chip
  Member since: text-tertiary, 12px

Subscription Card (below):
  Current plan: "Free" or "Pro" — large badge
  If Free:
    Usage: "3/5 food scans today" — progress bar
    "Upgrade to Pro" button — lime, full width
    Pro features list with lock icons
  If Pro:
    "Active until [date]"
    "Manage subscription" — ghost button
    Unlimited badge in lime
```

### Right Column — Settings Sections

```
Section: Personal Goals
  Edit TDEE inputs (same as onboarding step 4 sliders)
  "Recalculate" button — secondary

Section: Notifications
  Toggle list:
    Daily diary reminder — [time picker]
    Water reminder — [interval picker]
    Workout reminder — [time picker]
    Weekly progress report — [on/off]

Section: Connected Apps
  Apple Health (iOS): connect/disconnect toggle
  Google Fit: connect/disconnect toggle
  Status: "Last synced: X mins ago" (text-tertiary)

Section: Account
  Export data (CSV) — ghost button with download icon
  Delete account — ghost button with error color

Section: Legal
  Privacy Policy link
  Terms of Service link
  App version: "v1.0.0"
```

---

## 13. Navigation

### Desktop Sidebar

```
Position: fixed left, full height
Width: 240px
Background:
  Dark: var(--dark-900) — #0F1218
  Light: var(--light-200) — #F1F3F7
Border-right: 1px solid var(--border-color)

Top section (64px):
  calolean wordmark — 22px

Nav items (48px each, 8px gap):
  Icon (20px) + Label (15px, font-weight 500)
  Padding: 0 16px
  Border-radius: var(--radius-md) on hover/active
  
  Active state:
    Left border: 3px solid var(--lime-400)
    Background: rgba(170, 255, 0, 0.08)
    Text + icon: var(--lime-400)
    Border-radius: 0 on left, var(--radius-md) on right
  
  Hover state:
    Background: var(--surface-elevated)
    Text: var(--text-primary)

Bottom section:
  User avatar (32px) + name truncated + settings icon
  Height: 64px
  Border-top: 1px solid var(--border-color)
```

---

## 14. Animations & Transitions

```css
/* Global transition default */
* { transition-duration: 150ms; transition-timing-function: ease; }

/* Page transitions — Next.js */
.page-enter  { opacity: 0; transform: translateY(8px); }
.page-active { opacity: 1; transform: translateY(0); transition: all 300ms ease; }

/* Calorie ring count-up animation */
@keyframes count-up {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}

/* Lime pulse — for active recording/analyzing states */
@keyframes lime-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(170, 255, 0, 0.4); }
  50%       { box-shadow: 0 0 0 12px rgba(170, 255, 0, 0); }
}
.recording { animation: lime-pulse 2s ease infinite; }

/* Card hover lift */
.card-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
.card-hover:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

/* Skeleton loading */
@keyframes skeleton-shimmer {
  from { background-position: -200% 0; }
  to   { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--surface-card) 25%, var(--surface-elevated) 50%, var(--surface-card) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease infinite;
  border-radius: var(--radius-md);
}
```

---

## 15. Dark Mode Implementation

### CSS Variable Mapping

```css
/* Apply to :root for light mode default */
:root {
  --bg-app:          var(--light-100);
  --bg-sidebar:      var(--light-200);
  --surface-card:    var(--light-50);
  --surface-elevated: var(--light-200);
  --surface-hover:   var(--light-300);
  --input-bg:        var(--light-300);
  --border-color:    var(--light-400);
  --border-subtle:   var(--light-300);
  --text-primary:    var(--text-primary-light);
  --text-secondary:  var(--text-secondary-light);
  --text-tertiary:   var(--text-tertiary-light);
  --shadow-card:     var(--shadow-md);
}

/* Dark mode — class-based (class="dark" on <html>) */
.dark {
  --bg-app:          var(--dark-950);
  --bg-sidebar:      var(--dark-900);
  --surface-card:    var(--dark-800);
  --surface-elevated: var(--dark-700);
  --surface-hover:   var(--dark-600);
  --input-bg:        var(--dark-600);
  --border-color:    var(--dark-500);
  --border-subtle:   var(--dark-400);
  --text-primary:    var(--text-primary-dark);
  --text-secondary:  var(--text-secondary-dark);
  --text-tertiary:   var(--text-tertiary-dark);
  --shadow-card:     var(--shadow-card-dark);
}
```

### Dark Mode Toggle

```typescript
// In next.config.ts — use next-themes
npm install next-themes

// In app/layout.tsx
import { ThemeProvider } from 'next-themes'
export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Note:** Default theme is DARK — your designs are primarily dark-first. Light mode is the secondary option.

---

*Desktop DESIGN.md complete. See DESIGN_MOBILE.md for Android + mobile web specifications.*
