"use client";

import AppLayout from "../../../components/AppLayout";

export default function TermsPage() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Terms of Service</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Calolean provides fitness and nutrition guidance for informational use. Users remain responsible for training choices, nutrition decisions, and medical clearance. This page is an in-app placeholder and should be replaced with your final legal terms before release.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

