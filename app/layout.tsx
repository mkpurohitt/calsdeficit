import "./globals.css";
import { AuthProvider } from "../lib/AuthContext";
import React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { GoogleAnalytics } from "@next/third-parties/google";
import ConsentManager from "../components/ads/ConsentManager";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, APP_URL, BRAND_DARK } from "../lib/config/app";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — AI Health Assistant`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_TAGLINE} ${APP_DESCRIPTION}`,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — AI Health Assistant`,
    description: APP_TAGLINE,
    url: APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — AI Health Assistant`,
    description: APP_TAGLINE,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: BRAND_DARK,
  width: "device-width",
  initialScale: 1,
};

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
        <ConsentManager />
        {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      </body>
    </html>
  );
}
