"use client";

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";

interface ExerciseGifProps {
  /** Animation frames (start/end positions). Cycled to simulate motion. */
  frames?: string[] | null;
  /** Single image fallback when frames aren't available. */
  src?: string | null;
  alt: string;
  /** ms between frames. */
  interval?: number;
  /** Fills its container; caller controls the box + border-radius. */
  radius?: number;
  /** Icon size for the empty fallback. */
  iconSize?: number;
}

/**
 * The free-exercise-db provides 2 still photos per move (start + end), not
 * animated GIFs — cycling them client-side reads as a looping animation and
 * needs no extra data.
 */
export default function ExerciseGif({ frames, src, alt, interval = 650, radius = 0, iconSize = 24 }: ExerciseGifProps) {
  const list = (frames && frames.length > 0 ? frames : src ? [src] : []).filter(Boolean) as string[];
  const key = list.join("|");
  const [index, setIndex] = useState(0);
  // Reset to the first frame whenever the frame set changes (render-phase,
  // no effect → avoids cascading-render lint).
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setIndex(0);
  }
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (list.length < 2 || failed) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % list.length), interval);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [list.length, interval, failed]);

  if (list.length === 0 || failed) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: "100%", height: "100%", background: "var(--surface-elevated)", borderRadius: radius, color: "var(--text-tertiary)" }}
      >
        <Activity size={iconSize} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: radius, overflow: "hidden", background: "#fff" }}>
      {list.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={i === 0 ? alt : ""}
          loading="lazy"
          onError={() => i === index && setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: i === index ? 1 : 0,
            transition: "opacity 0.25s ease",
          }}
        />
      ))}
    </div>
  );
}
