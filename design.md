DESIGN.md — Calolean Web App UI/UX Specification
Target Platform: Web Application (Responsive: Mobile-first with Desktop scaling)
Stack: Next.js (App Router), Tailwind CSS v4, Lucide React, Framer Motion, Recharts
Core Vibe: Premium, Futuristic Fitness, Neon-Tech, Clean & Minimalist.

1. Global Design Tokens (The Theme)
Stitch must strictly adhere to these color palettes using Tailwind's dark: variants to toggle between modes.

Brand Colors
Primary Accent (Lime): #bcfd01 (Used for primary buttons, active states, progress rings, and glowing text).

Primary Accent Hover: #a5de01

Danger/Error: #ef4444 (Red 500)

Success: #22c55e (Green 500)

Dark Mode (Default / Native Feel)
Background: #0a0f1a (Deep Navy/Black)

Surface/Cards: #111827 (Slate 900)

Surface Hover/Input Bg: rgba(255, 255, 255, 0.05)

Borders: rgba(255, 255, 255, 0.1)

Primary Text: #ffffff

Secondary Text: #9ca3af (Gray 400)

Effects: Heavy use of ambient glow. Background blobs using bg-[#bcfd01]/10 blur-3xl. Text drop shadows using drop-shadow-[0_0_15px_rgba(188,253,1,0.4)].

Light Mode
Background: #f8fafc (Slate 50)

Surface/Cards: #ffffff

Surface Hover/Input Bg: #f1f5f9 (Slate 100)

Borders: #e2e8f0 (Slate 200)

Primary Text: #0f172a (Slate 900)

Secondary Text: #64748b (Slate 500)

Effects: Soft, diffuse drop shadows shadow-[0_8px_30px_rgb(0,0,0,0.04)] instead of neon glows.

2. Typography & Core Components
Typography: font-sans (Inter).

Headings: font-bold tracking-tight.

Brand Logo Text: <span class="font-extrabold text-slate-900 dark:text-white">calo</span><span class="font-extrabold text-[#bcfd01] dark:drop-shadow-[0_0_15px_rgba(188,253,1,0.4)]">lean</span>

Buttons:

Primary: bg-[#bcfd01] text-[#0a0f1a] rounded-full font-bold px-6 py-3 transition-all hover:bg-[#a5de01] active:scale-[0.98]

Secondary (Dark Mode): bg-white/5 text-white ring-1 ring-inset ring-white/10 rounded-xl

Secondary (Light Mode): bg-white text-slate-900 ring-1 ring-inset ring-slate-200 rounded-xl

Cards & Surfaces:

Standard Border Radius: rounded-2xl or rounded-3xl.

Padding: p-6 or p-8.

3. Global Layout Rule (Web App Constraint)
Because this is a web app mimicking a premium mobile experience:

Mobile View (< 768px): Use a fixed bottom navigation bar (fixed bottom-0 w-full).

Desktop View (>= 768px): Constrain the main app content to a maximum width (max-w-xl mx-auto) to keep the mobile-app aesthetic, OR transition the bottom nav into a sleek left-hand side navigation bar (w-64 border-r).

Instruction for Stitch: Wrap all main pages in a responsive container that prevents UI stretching on large ultra-wide monitors.

4. Screen-by-Screen Specifications
Screen 1: Auth (Login / Signup)
Background: Full height, overflow hidden. Top-down subtle gradient glow.

Layout: Centered card max-w-md w-full.

Inputs: rounded-xl, padding left for Lucide icons. Focus state MUST ring with #bcfd01.

Features: Text-based logo at top. Google OAuth button below a divider.

Screen 2: Home (AI Chat)
Header: Sticky top, showing the "calolean" logo and current user streak.

Chat Area: Scrollable.

User Message: Bubbles aligned right, bg-slate-100 dark:bg-white/10.

AI Message: Bubbles aligned left, transparent bg, standard text.

Chat Input: Fixed at bottom (above nav). Pill-shaped rounded-full. Must include a paperclip/camera icon (<Paperclip />) to attach images/videos.

Screen 3: Diet (Tracker)
This is based directly on the provided Light/Dark mode tracker screenshots.

Hero Section (Calorie Ring): * Large, central Circular Progress bar (use SVG or Recharts).

Center text shows "Calories Remaining".

Track color: bg-slate-100 dark:bg-white/5. Progress color: #bcfd01.

Macro Bars: * Three horizontal progress bars (Protein, Carbs, Fats) below the ring.

Labels on left, grams (e.g., "120 / 160g") on right.

Meal Logs (Breakfast, Lunch, etc.): * Card layouts. If an AI photo was scanned, show a small rounded thumbnail of the food on the left.

Include a floating action button (FAB) + to open the camera scanner.

Screen 4: Exercise (Form Check & Log)
Top Widget: Step tracker and weekly calendar row (Mon-Sun) highlighting today.

Upload Section: A prominent dashed-border dropzone border-dashed border-2 border-slate-300 dark:border-white/20 rounded-3xl for uploading gym videos.

Form Feedback Card: Displays AI results. Must include a prominent "Score: 8/10" badge using the lime accent, with bullet points for "Strengths" and "Corrections".

Muscle Library: Grid of cards grid-cols-2. Each card has a muscle icon and text (e.g., "Chest", "Legs").

Screen 5: Shop
Grid: grid-cols-1 md:grid-cols-2 layout of product cards.

Cards: Image at top rounded-t-2xl, product name, price, and a full-width #bcfd01 "View Product" button at the bottom.

Tags: Add a tiny "Sponsored" or "Recommended" badge at the top left of the card.

Screen 6: Profile & Goals
This is based directly on the provided Dark Mode "Set your daily goals" screenshot.

Header: "Set your daily goals" with secondary text.

Sliders: Custom range sliders for Calories, Protein, Carbs, and Fats.

Slider track: #374151 (Dark mode) or #e2e8f0 (Light mode).

Slider fill: #bcfd01.

Slider thumb (knob): White circle with subtle shadow.

Live Numbers: Above each slider, display the exact number (e.g., "2,400 Kcal") in large, bold text.

Save Button: Fixed at bottom or bottom of list, large primary button.

5. Strict Instructions for the AI Generator (Stitch)
NO EXTERNAL CSS FILES: All styling must be done using inline Tailwind utility classes.

DARK MODE IMPLEMENTATION: Do not rely on system preferences alone. Build every component with explicitly defined dark: utility classes so the theme can be toggled manually via a parent .dark class.

USE LUCIDE REACT: Use lucide-react for all icons. Do not use SVGs unless it is for the circular progress rings.

ANIMATIONS: Use Tailwind's transition-all duration-300 for hover states. If generating complex components, wrap them in simple Framer Motion <motion.div> tags for fade-in (initial={{ opacity: 0, y: 10 }}).

MODULARITY: Break down the code into clear React functional components. Do not dump 1000 lines into one file.

How to use this with Stitch:
You can simply copy and paste the entire text above and say:
"Stitch, read this DESIGN.md specification and generate the app/diet/page.tsx screen for my Next.js web app. Ensure both light and dark modes are perfectly implemented as specified."