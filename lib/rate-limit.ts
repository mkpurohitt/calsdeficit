export const globalUsage = globalThis as unknown as { promptUsage?: Map<string, { date: string; count: number }> };

if (!globalUsage.promptUsage) {
  globalUsage.promptUsage = new Map<string, { date: string; count: number }>();
}

export function checkAndIncrementRateLimit(userId: string): boolean {
  if (!userId) return true; // If no user ID is provided, let it pass or fail elsewhere

  const today = new Date().toISOString().split("T")[0];
  const usageMap = globalUsage.promptUsage as Map<string, { date: string; count: number }>;
  
  const userUsage = usageMap.get(userId);

  if (userUsage && userUsage.date === today) {
    if (userUsage.count >= 10) {
      return false; // Limit reached
    }
    userUsage.count += 1;
  } else {
    usageMap.set(userId, { date: today, count: 1 });
  }

  return true;
}
