"use client";

import AppLayout from "../../../components/AppLayout";

export default function PrivacyPolicyPage() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Privacy Policy</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Calolean stores the account details, nutrition logs, workout logs, and settings required to run the product experience. Uploaded food images and workout videos are processed to generate nutrition or form-analysis results. This page is an in-app placeholder and should be replaced with your production legal copy before launch.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

