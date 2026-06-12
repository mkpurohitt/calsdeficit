"use client";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}

export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-md)", className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="cl-card space-y-3" style={{ borderRadius: 20 }}>
      <Skeleton width="40%" height={14} />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} height={12} width={`${90 - index * 15}%`} />
      ))}
    </div>
  );
}

export function SkeletonRing({ size = 200 }: { size?: number }) {
  return (
    <div className="cl-card flex items-center justify-center" style={{ borderRadius: 20, padding: 28 }}>
      <Skeleton width={size} height={size} radius="50%" />
    </div>
  );
}
