import type { MetadataRoute } from "next";
import { APP_URL } from "../lib/config/app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${APP_URL}/diet`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/exercise`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${APP_URL}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${APP_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_URL}/profile/privacy-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP_URL}/profile/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
