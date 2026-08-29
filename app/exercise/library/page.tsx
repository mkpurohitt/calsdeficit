"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppLayout from "../../../components/AppLayout";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";

import ExerciseGif from "../../../components/ExerciseGif";
import { DifficultyChip, MetChip } from "../../../components/ExerciseMeta";

interface ExerciseItem {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string | null;
  gif_url?: string | null;
  frames?: string[];
  difficulty?: string | null;
  met_value?: number | null;
}

const FILTERS = ["All", "Chest", "Back", "Legs", "Arms", "Shoulders", "Core"] as const;
const muscleQueryMap: Record<string, string> = {
  Chest: "pectorals",
  Back: "lats",
  Legs: "quads",
  Arms: "biceps",
  Shoulders: "delts",
  Core: "abs",
};

export default function MuscleLibraryPage() {
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real library size for the header eyebrow
  useEffect(() => {
    let cancelled = false;
    fetch("/api/exercises?counts=1")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success && json.data) setTotal(json.data.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchExercises = useCallback(async (query: string, filter: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (filter !== "All") params.append("muscle", muscleQueryMap[filter] || filter.toLowerCase());
      params.append("limit", "60");
      const res = await fetch(`/api/exercises?${params.toString()}`);
      const json = await res.json();
      setExercises(json.success ? json.data || [] : []);
    } catch {
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises("", "All");
  }, [fetchExercises]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchExercises(value.trim(), activeFilter), 300);
  };

  const handleFilter = (filter: (typeof FILTERS)[number]) => {
    setActiveFilter(filter);
    fetchExercises(searchQuery.trim(), filter);
  };

  return (
    <AppLayout>
      <style>{`
        .lib-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
        @media (max-width: 1180px) { .lib-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
        @media (max-width: 720px) { .lib-grid { grid-template-columns: minmax(0, 1fr); } }
        .lib-head { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
        @media (max-width: 860px) {
          .lib-wrap { padding: 20px 16px 40px !important; }
          .lib-search { min-width: 100% !important; }
        }
      `}</style>
      <div className="lib-wrap" style={{ padding: "30px 38px 48px", maxWidth: 1380, margin: "0 auto" }}>
        {/* Header */}
        <div className="lib-head">
          <Link
            href="/exercise"
            aria-label="Back to Exercise"
            style={{
              flex: "none",
              width: 42,
              height: 42,
              borderRadius: 12,
              border: "1px solid var(--border-color)",
              background: "var(--surface-card)",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={19} />
          </Link>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="cl-mono" style={{ fontSize: 12, letterSpacing: ".12em", color: "var(--text-tertiary)", marginBottom: 5 }}>
              {total !== null ? `${total.toLocaleString()} EXERCISES` : "EXERCISE LIBRARY"}
            </div>
            <h1 className="cl-disp" style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Muscle Library
            </h1>
          </div>
          <div
            className="lib-search"
            style={{
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "var(--input-bg)",
              border: "1.5px solid var(--border-color)",
              borderRadius: 12,
              padding: "11px 15px",
              minWidth: 280,
            }}
          >
            <Search size={17} style={{ color: "var(--text-tertiary)" }} />
            <input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search exercises…"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 14, fontFamily: "inherit" }}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          {FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => handleFilter(filter)}
                style={{
                  padding: "8px 17px",
                  borderRadius: 99,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: active ? "var(--lime-400)" : "var(--surface-elevated)",
                  color: active ? "var(--on-accent)" : "var(--text-secondary)",
                  border: active ? "1px solid var(--lime-400)" : "1px solid var(--border-color)",
                }}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="lib-grid">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 88, borderRadius: 16 }} />
            ))}
          </div>
        ) : exercises.length === 0 ? (
          <div
            className="cl-card"
            style={{ borderRadius: 16, padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 14 }}
          >
            No exercises found{searchQuery ? ` for “${searchQuery}”` : ""}. Try a different search or filter.
          </div>
        ) : (
          <div className="lib-grid">
            {exercises.map((exercise) => (
              <Link
                key={exercise.id}
                href={`/exercise/${exercise.id}`}
                className="cl-card-hover"
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 16,
                  padding: 18,
                  boxShadow: "var(--shadow-card)",
                  textDecoration: "none",
                  display: "block",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span
                    style={{
                      flex: "none",
                      width: 52,
                      height: 52,
                      borderRadius: 13,
                      background: "var(--surface-elevated)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--lime-600)",
                      overflow: "hidden",
                    }}
                  >
                    <ExerciseGif frames={exercise.frames} src={exercise.gif_url} alt={exercise.name} radius={13} iconSize={24} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        textTransform: "capitalize",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {exercise.name}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 7,
                          background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                          color: "var(--lime-600)",
                          textTransform: "capitalize",
                        }}
                      >
                        {exercise.muscle_group}
                      </span>
                      {exercise.equipment && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: "3px 10px",
                            borderRadius: 7,
                            background: "var(--surface-elevated)",
                            color: "var(--text-tertiary)",
                            textTransform: "capitalize",
                          }}
                        >
                          {exercise.equipment}
                        </span>
                      )}
                      <DifficultyChip difficulty={exercise.difficulty} />
                      <MetChip met={exercise.met_value} />
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: "var(--text-tertiary)", flex: "none" }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
