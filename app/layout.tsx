import "./globals.css";
import { AuthProvider } from "../lib/AuthContext"; 
import React from "react";
import { ThemeProvider } from "next-themes";

export const metadata = {
  title: "Calolean — AI Health Assistant",
  description: "Train smarter. Eat cleaner. Get leaner. Your AI-powered personal health assistant for nutrition tracking, form analysis, and fitness goals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html 
      lang="en" 
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
