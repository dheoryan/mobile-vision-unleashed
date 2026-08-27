import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { LegalFooter } from "@/components/mutuals/LegalFooter";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MEUTUALS — Your tribe is waiting" },
      {
        name: "description",
        content: "What data MEUTUALS collects, how we use it, and your rights.",
      },
      { property: "og:title", content: "Privacy Policy — MEUTUALS — Your tribe is waiting" },
      {
        property: "og:description",
        content: "What data MEUTUALS collects, how we use it, and your rights.",
      },
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
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <header className="mt-6">
          <p className="label-mono text-muted-foreground">Legal</p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-tight">Privacy Policy</h1>
          <p className="mt-2 text-xs text-muted-foreground">Last updated: August 25, 2026</p>
        </header>

        <article className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <Section title="What we collect">
            <ul className="ml-5 mt-2 list-disc space-y-1.5">
              <li>
                <strong className="text-foreground">Account info</strong>: email, date of birth and
                age-verification result, display name, city, optional bio, handle, avatar,
                interests, social intentions, and availability.
              </li>
              <li>
                <strong className="text-foreground">Optional nearby data</strong>: if you opt in, we
                store a deliberately rounded location, discovery radius, and visibility setting.
                Other members receive only a distance band—not your coordinates or an address.
                MEUTUALS does not continuously track your movement.
              </li>
              <li>
                <strong className="text-foreground">Community activity</strong>: Tribe membership
                and messages, posts, comments, likes, follows, saved posts, Ventures and
                applications, reports, blocks, and direct messages.
              </li>
              <li>
                <strong className="text-foreground">Media and notifications</strong>: images you
                upload and, if you opt in, your web-push subscription endpoint and browser keys.
              </li>
              <li>
                <strong className="text-foreground">Service data</strong>: security, authentication,
                and delivery records produced while operating the app. MEUTUALS does not currently
                run a third-party product-analytics or crash-reporting service.
              </li>
            </ul>
          </Section>
          <Section title="How we use it">
            We use this data to create and secure your account, enforce the 21+ rule, show content
            to its intended audience, suggest relevant people using shared interests, intentions,
            availability and optional proximity, deliver messages and opted-in notifications,
            operate Tribes and Ventures, investigate reports, enforce blocks, and maintain the
            service.
          </Section>
          <Section title="Third parties">
            <ul className="ml-5 mt-2 list-disc space-y-1.5">
              <li>
                <strong className="text-foreground">Supabase</strong> — authentication, database,
                realtime delivery, and private file storage.
              </li>
              <li>
                <strong className="text-foreground">Cloudflare</strong> — application hosting,
                network delivery, and security.
              </li>
              <li>
                <strong className="text-foreground">Badan Informasi Geospasial (BIG)</strong> — when
                you explicitly use auto-location in Indonesia, our server sends an approximately
                one-kilometre-rounded coordinate without your account identifier to BIG's official
                boundary service so the app can derive a district and city/regency label.
              </li>
              <li>
                <strong className="text-foreground">Google and Apple</strong> — only when you choose
                the corresponding sign-in provider.
              </li>
              <li>
                <strong className="text-foreground">Your browser's push service</strong> — only
                after you grant notification permission; it receives the minimum subscription data
                needed to deliver a notification.
              </li>
            </ul>
            We never sell your data.
          </Section>
          <Section title="Your rights">
            <ul className="ml-5 mt-2 list-disc space-y-1.5">
              <li>
                <strong className="text-foreground">Right to access</strong>: request a copy of all
                data we hold about you.
              </li>
              <li>
                <strong className="text-foreground">Right to correction</strong>: update inaccurate
                personal information via Settings.
              </li>
              <li>
                <strong className="text-foreground">Right to deletion</strong>: delete your account
                and all associated data via Settings → Delete Account.
              </li>
              <li>
                <strong className="text-foreground">Right to portability</strong>: request your data
                in a machine-readable format by emailing privacy@mutuals.app.
              </li>
              <li>
                <strong className="text-foreground">Notification choice</strong>: decline push
                permission or revoke it in your browser or device settings.
              </li>
            </ul>
            <p className="mt-3">
              Requests are handled under the data-protection law that applies to you. Identity
              verification may be required before we disclose or change account data.
            </p>
          </Section>
          <Section title="Contact">
            Privacy questions? Email{" "}
            <a className="text-primary hover:underline" href="mailto:privacy@mutuals.app">
              privacy@mutuals.app
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
