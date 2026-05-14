import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LegalFooter } from "@/components/mutuals/LegalFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MUTUALS" },
      { name: "description", content: "What data MUTUALS collects, how we use it, and your rights." },
      { property: "og:title", content: "Privacy Policy — MUTUALS" },
      { property: "og:description", content: "What data MUTUALS collects, how we use it, and your rights." },
    ],
  }),
  component: PrivacyPage,
});

// TODO: legal review before launch
// TODO: replace privacy@mutuals.app with a real address before launch

function PrivacyPage() {
  return (
    <div className="bg-habitat min-h-screen pb-16">
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <header className="mt-6">
          <p className="label-mono text-muted-foreground">Legal</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight">Privacy Policy</h1>
          <p className="mt-2 text-xs text-muted-foreground">Last updated: May 12, 2026</p>
        </header>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <Section title="What we collect">
            <ul className="ml-5 mt-2 list-disc space-y-1.5">
              <li><strong className="text-foreground">Account info</strong>: email, display name, age, city, optional bio and avatar.</li>
              <li><strong className="text-foreground">Activity</strong>: posts, comments, likes, Hellos, Ventures, and messages you send.</li>
              <li><strong className="text-foreground">Usage data</strong>: device type, app version, and crash reports for product improvement.</li>
            </ul>
          </Section>
          <Section title="How we use it">
            To run MUTUALS — match you to people in your Tribe, deliver messages, surface relevant Ventures, prevent abuse, and improve the product.
          </Section>
          <Section title="Third parties">
            <ul className="ml-5 mt-2 list-disc space-y-1.5">
              <li><strong className="text-foreground">Supabase</strong> — database, authentication, and file storage.</li>
              <li><strong className="text-foreground">Vercel / Netlify</strong> — web hosting.</li>
              <li><strong className="text-foreground">Stripe</strong> — payments for MUTUALS+ subscriptions.</li>
              <li><strong className="text-foreground">PostHog</strong> — product analytics (usage patterns, feature adoption). No personally identifiable information is shared with PostHog.</li>
              <li><strong className="text-foreground">Sentry</strong> — error monitoring and crash reporting. Error reports are anonymised before transmission.</li>
            </ul>
            We never sell your data.
          </Section>
          <Section title="Your rights">
            <ul className="ml-5 mt-2 list-disc space-y-1.5">
              <li><strong className="text-foreground">Right to access</strong>: request a copy of all data we hold about you.</li>
              <li><strong className="text-foreground">Right to correction</strong>: update inaccurate personal information via Settings.</li>
              <li><strong className="text-foreground">Right to deletion</strong>: delete your account and all associated data via Settings → Delete Account.</li>
              <li><strong className="text-foreground">Right to portability</strong>: request your data in a machine-readable format by emailing privacy@mutuals.app.</li>
              <li><strong className="text-foreground">Right to object</strong>: opt out of analytics data collection by contacting us.</li>
            </ul>
            <p className="mt-3">
              We comply with applicable data protection laws including Indonesia's Personal Data Protection Law (UU PDP) and, where applicable, GDPR and CCPA.
            </p>
          </Section>
          <Section title="Contact">
            Privacy questions? Email <a className="text-primary hover:underline" href="mailto:privacy@mutuals.app">privacy@mutuals.app</a>.
          </Section>
        </article>

        <LegalFooter className="mt-12" />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
