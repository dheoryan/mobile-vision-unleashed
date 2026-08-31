import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { LegalFooter } from "@/components/mutuals/LegalFooter";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — MEUTUALS — Your tribe is waiting" },
      { name: "description", content: "The rules of the road for using MEUTUALS." },
      { property: "og:title", content: "Terms of Service — MEUTUALS — Your tribe is waiting" },
      {
        property: "og:description",
        content: "The rules of the road for using MEUTUALS. Last updated August 30, 2026.",
      },
    ],
  }),
  component: TermsPage,
});

// TODO: legal review before launch
// TODO: replace contact email with mutuals.app address before launch

function TermsPage() {
  return (
    <div className="bg-habitat min-h-screen pb-16">
      <div className="mx-auto max-w-2xl px-5 pt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
        </Link>
        <header className="mt-6">
          <p className="label-mono text-muted-foreground">Legal</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight">Terms of Service</h1>
          <p className="mt-2 text-xs text-muted-foreground">Last updated: August 30, 2026</p>
        </header>

        <article className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <Section title="1. Eligibility">
            MEUTUALS is built for socially curious adults. You must be at least{" "}
            <strong className="text-foreground">18 years old</strong> to create an account. By using
            MEUTUALS you confirm you meet this requirement.
          </Section>
          <Section title="2. Your account">
            You're responsible for keeping your login credentials safe. You agree to provide
            accurate information about yourself and not impersonate anyone else.
          </Section>
          <Section title="3. Prohibited content & conduct">
            <ul className="ml-5 mt-2 list-disc space-y-1.5">
              <li>No harassment, hate speech, or discrimination of any kind.</li>
              <li>No explicit, violent, or otherwise unlawful content.</li>
              <li>No spam, scams, or commercial solicitation outside Hosted Tribes.</li>
              <li>No sharing of others' personal information without consent.</li>
            </ul>
          </Section>
          <Section title="4. User content">
            You retain ownership of content you post on MEUTUALS. By posting, you grant MEUTUALS a
            non-exclusive, royalty-free, worldwide license to display and distribute your content
            within the platform. You may delete your content at any time.
          </Section>
          <Section title="5. Intellectual property">
            MEUTUALS and its logos, design, and original content are owned by MEUTUALS. You may not
            reproduce or redistribute any part of MEUTUALS without written permission.
          </Section>
          <Section title="6. Limitation of liability">
            To the maximum extent permitted by law, MEUTUALS shall not be liable for any indirect,
            incidental, or consequential damages arising from your use of the platform.
          </Section>
          <Section title="7. Termination">
            We may suspend or terminate accounts that violate these Terms or our Community
            Guidelines, at our sole discretion.
          </Section>
          <Section title="8. No warranty">
            MEUTUALS is provided "as is" without warranties of any kind, express or implied.
          </Section>
          <Section title="9. Governing law">
            These Terms are governed by the laws of the Republic of Indonesia. Any disputes shall be
            resolved in the courts of Jakarta, Indonesia.
          </Section>
          <Section title="10. Contact">
            Questions? Reach us at{" "}
            <a className="text-primary hover:underline" href="mailto:hello@mutuals.app">
              hello@mutuals.app
            </a>
            .
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
