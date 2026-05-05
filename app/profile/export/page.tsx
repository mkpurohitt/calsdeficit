"use client";

import AppLayout from "../../../components/AppLayout";
import { useAuth } from "../../../lib/AuthContext";
import { getFoodLogs, getWorkoutLogs } from "../../../lib/user-data";

export default function ExportPage() {
  const { user } = useAuth() as { user: { uid?: string } | null };

  const downloadCsv = async () => {
    if (!user?.uid) return;
    const [foodLogs, workoutLogs] = await Promise.all([getFoodLogs(user.uid), getWorkoutLogs(user.uid)]);
    const rows = [
      ["type", "name", "calories_or_sets", "date"],
      ...foodLogs.map((log) => ["food", log.food_name, String(log.calories), log.date_key]),
      ...workoutLogs.map((log) => ["workout", log.exercise_name, `${log.sets}x${log.reps}`, log.date_key]),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "calolean-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Export Data</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
            Download your food logs and workout logs as a CSV file.
          </p>
          <button className="btn-primary" onClick={downloadCsv}>Download CSV</button>
        </div>
      </div>
    </AppLayout>
  );
}

