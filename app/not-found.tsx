import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 p-6"
      style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}
    >
      <span className="brand-wordmark" style={{ fontSize: 26 }}>
        <span style={{ color: "var(--text-primary)" }}>calo</span>
        <span style={{ color: "var(--lime-400)" }}>lean</span>
      </span>
      <h1 style={{ fontSize: 48, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--lime-400)" }}>404</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>This page doesn&apos;t exist.</p>
      <Link href="/" className="btn-primary" style={{ marginTop: 8, textDecoration: "none" }}>
        Back to the app
      </Link>
    </div>
  );
}
