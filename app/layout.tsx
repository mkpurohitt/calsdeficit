import "./globals.css";
import { AuthProvider } from "../lib/AuthContext"; 
import React from "react";

export const metadata = {
  title: "CalsDeficit",
  description: "AI Health Assistant",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-white">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}