import AppLayout from "../../../components/AppLayout";

export const metadata = { title: "Terms of Service" };

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "1. Acceptance",
    body: [
      "By creating an account or using Calolean (calolean.com) you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service.",
    ],
  },
  {
    heading: "2. The service",
    body: [
      "Calolean provides AI-assisted nutrition estimates, food scanning, diet and workout tracking, and exercise form analysis. AI outputs are statistical estimates and general fitness information — NOT medical, dietary, or professional advice. Consult a qualified professional before changing your diet or exercise routine, especially if you have a medical condition.",
    ],
  },
  {
    heading: "3. Your account",
    body: [
      "You are responsible for your account credentials and for the accuracy of data you enter. You must be at least 13 years old (or the minimum digital-consent age in your country).",
    ],
  },
  {
    heading: "4. Fair use & subscription tiers",
    body: [
      "Free accounts include a daily limit of AI prompts and display advertising. Paid tiers, when available, raise limits and remove ads. We may adjust limits to keep the service sustainable, and will communicate material changes.",
    ],
  },
  {
    heading: "5. Acceptable use",
    body: [
      "Do not abuse, reverse-engineer, scrape, overload, or attempt to bypass usage limits or security of the service; do not upload unlawful content. We may suspend accounts that violate these rules.",
    ],
  },
  {
    heading: "6. Advertising & affiliate disclosure",
    body: [
      "Sponsored content is always labeled. Product suggestions may contain Amazon affiliate links; we may earn a commission on qualifying purchases at no extra cost to you.",
    ],
  },
  {
    heading: "7. Intellectual property",
    body: [
      "The Calolean name, logo, design, and software are our property. You retain ownership of the data you log; you grant us the limited license needed to store and process it to operate the service.",
    ],
  },
  {
    heading: "8. Disclaimers & liability",
    body: [
      "The service is provided 'as is' without warranties. Calorie counts, nutrition data, ratings, and form scores are estimates and may be inaccurate. To the maximum extent permitted by law, we are not liable for indirect or consequential damages, and our total liability is limited to the amount you paid us in the last 12 months.",
    ],
  },
  {
    heading: "9. Termination",
    body: [
      "You may delete your account at any time from the Profile page. We may suspend or terminate accounts that violate these Terms.",
    ],
  },
  {
    heading: "10. Changes & contact",
    body: [
      "We may update these Terms; continued use after changes means acceptance. Questions: social@calolean.com. Last updated: June 2026.",
    ],
  },
];

export default function TermsPage() {
  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="cl-card-elevated" style={{ borderRadius: 24, padding: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Terms of Service</h1>
          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                  {section.heading}
                </h2>
                {section.body.map((paragraph, index) => (
                  <p key={index} style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 8 }}>
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
