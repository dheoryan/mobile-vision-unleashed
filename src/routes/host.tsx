import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MONETIZATION_ENABLED } from "@/lib/feature-flags";
import { useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { TRIBES } from "@/lib/mutuals-data";

export const Route = createFileRoute("/host")({
  // Advertises $199–$499/month plans and "we'll be in touch within 48 hours",
  // but the form writes nothing. Gated until it's wired to a real table.
  beforeLoad: () => {
    if (!MONETIZATION_ENABLED) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Apply to host a Tribe — MEUTUALS — Your tribe is waiting" },
      { name: "description", content: "Brands, venues, and community builders can apply to run a Verified Hosted Tribe on MEUTUALS." },
      { property: "og:title", content: "Apply to host a Tribe — MEUTUALS — Your tribe is waiting" },
      { property: "og:description", content: "Verified host status, analytics, and pinned posts." },
    ],
  }),
  component: HostApplyPage,
});

function HostApplyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ org: "", email: "", tribe: "wolf", city: "", message: "" });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-habitat flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <CheckCircleIcon className="h-12 w-12 text-primary" />
        <h1 className="mt-4 font-display text-3xl font-bold">Application received.</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">We'll be in touch within 48 hours about hosting on MEUTUALS.</p>
        <Link to="/" className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Back to MEUTUALS</Link>
      </div>
    );
  }

  return (
    <div className="bg-habitat min-h-screen pb-16">
      <div className="mx-auto max-w-md px-5 pt-6">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
        </Link>

        <header className="mt-6">
          <p className="label-mono text-muted-foreground">For brands & venues</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight">Host a Tribe.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Run a Verified Hosted Tribe — your scene, your members, our platform. Plans from $199–$499/month.</p>
        </header>

        <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
          {[
            "Verified badge & custom branding",
            "Analytics dashboard",
            "Pin events & announcements",
            "Weekly opt-in DM blast",
            "Venue tagging on Ventures",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2"><CheckCircleIcon className="h-3.5 w-3.5 text-primary" /> {f}</li>
          ))}
        </ul>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <Field label="Organization" value={form.org} onChange={(v) => setForm({ ...form, org: v })} placeholder="Sightglass Coffee" required />
          <Field label="Contact email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="hello@sightglass.com" required />
          <label className="block">
            <span className="label-mono mb-1 block text-muted-foreground">Tribe interest</span>
            <select
              value={form.tribe}
              onChange={(e) => setForm({ ...form, tribe: e.target.value })}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none"
            >
              {TRIBES.map((t) => (<option key={t.id} value={t.id}>{t.name} — {t.scene}</option>))}
            </select>
          </label>
          <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="San Francisco" required />
          <Field label="Message" value={form.message} onChange={(v) => setForm({ ...form, message: v })} placeholder="Tell us about your scene." multiline />

          <button type="submit" className="mt-2 flex w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground">
            Submit application
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", multiline, required,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; multiline?: boolean; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1 block text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      )}
    </label>
  );
}
